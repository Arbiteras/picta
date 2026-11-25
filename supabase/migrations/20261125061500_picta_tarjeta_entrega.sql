begin;

create table public.picta_intentos_tarjeta (
  compra_id uuid not null references public.picta_compras(id) on delete cascade,
  id uuid not null,
  estado text not null check (estado in ('aprobado', 'rechazado')),
  creado_en timestamptz not null default now(),
  primary key (compra_id, id)
);
alter table public.picta_intentos_tarjeta enable row level security;
revoke all on public.picta_intentos_tarjeta from public, anon, authenticated;
grant select, insert on public.picta_intentos_tarjeta to service_role;

alter table public.pedidos add column solicitud_id uuid unique references public.picta_solicitudes(id);
alter table public.pedidos drop constraint pedidos_estado_check;
alter table public.pedidos add constraint pedidos_estado_check check (
  estado in ('pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'listo_para_recojo', 'entregado', 'cancelado')
);

create or replace function picta_private.validar_estado_picta()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.estado is distinct from old.estado and not (
    (old.estado = 'pendiente' and new.estado in ('confirmado', 'cancelado'))
    or (old.estado = 'confirmado' and new.estado in ('en_preparacion', 'cancelado'))
    or (old.estado = 'en_preparacion' and new.estado in ('en_camino', 'listo_para_recojo', 'entregado', 'cancelado'))
    or (old.estado in ('en_camino', 'listo_para_recojo') and new.estado in ('entregado', 'cancelado'))
  ) then
    raise exception using errcode = 'PT409', message = 'estado_de_pedido_invalido';
  end if;
  return new;
end;
$$;

create or replace function public.resumen_mis_pedidos_picta()
returns table (total bigint, en_curso bigint, entregados bigint)
language sql stable security invoker set search_path = '' as $$
  select count(*),
    count(*) filter (where estado in ('pendiente', 'confirmado', 'en_preparacion', 'en_camino', 'listo_para_recojo')
      and not (formato is not distinct from 'digital' and pago is not distinct from 'aprobado')),
    count(*) filter (where estado = 'entregado' or (formato = 'digital' and pago = 'aprobado'))
  from public.pedidos where cliente_id = (select auth.uid());
$$;

create function public.picta_pagar_tarjeta(p_id uuid, p_cliente uuid, p_intento uuid, p_token text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  compra public.picta_compras;
  resultado text;
  envio_pendiente integer;
  fila record;
begin
  if p_token is null or p_token not in ('picta_test_visa_4242', 'picta_test_visa_0002') then
    raise exception using errcode = 'PT400', message = 'tarjeta_de_prueba_requerida';
  end if;
  select * into compra from public.picta_compras
  where id = p_id and cliente_id = p_cliente for update;
  if not found then raise exception using errcode = 'PT404', message = 'compra_no_encontrada'; end if;

  select estado into resultado from public.picta_intentos_tarjeta where compra_id = p_id and id = p_intento;
  if not found and compra.estado = 'pendiente' and compra.vence_en > now() then
    resultado := case when p_token = 'picta_test_visa_4242' then 'aprobado' else 'rechazado' end;
    if resultado = 'aprobado' then
      perform public.picta_confirmar_compra(compra.id, compra.referencia, compra.total_centavos);
      update public.pedidos set sandbox = true where compra_id = compra.id;
      envio_pendiente := case when exists (select 1 from public.pedidos where compra_id = compra.id and formato = 'fisico')
        then 0 else compra.envio_centavos end;

      for fila in select s.id as solicitud_id, r.producto_id, r.nombre, r.precio_centavos
        from jsonb_to_recordset(compra.lineas) r(producto_id bigint, formato text, nombre text, precio_centavos integer, paquete integer)
        join public.picta_solicitudes s on s.compra_id = compra.id and s.formato = 'fisico' and s.paquete_pictogramas = r.paquete
        where r.formato = 'fisico' and r.paquete is not null order by r.paquete
      loop
        insert into public.pedidos(compra_id, cliente_id, producto_id, producto_nombre, formato,
          precio_unitario_centavos, cantidad, estado, pago, pagado_en, entrega, envio_centavos, sandbox, solicitud_id)
        values (compra.id, compra.cliente_id, fila.producto_id, fila.nombre, 'fisico', fila.precio_centavos,
          1, 'confirmado', 'aprobado', now(), compra.entrega, envio_pendiente, true, fila.solicitud_id);
        envio_pendiente := 0;
      end loop;
      compra.estado := 'pagada';
    end if;
    insert into public.picta_intentos_tarjeta (compra_id, id, estado) values (p_id, p_intento, resultado);
  end if;
  return jsonb_build_object('compra', to_jsonb(compra), 'resultado', resultado);
end;
$$;
revoke all on function public.picta_pagar_tarjeta(uuid, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.picta_pagar_tarjeta(uuid, uuid, uuid, text) to service_role;

create index picta_pedidos_despacho_demo on public.pedidos (pagado_en)
where sandbox and compra_id is not null and formato = 'fisico' and estado not in ('entregado', 'cancelado');

create function picta_private.procesar_despachos_de_prueba()
returns void language sql security invoker set search_path = '' as $$
  update public.pedidos p
  set estado = case p.estado
    when 'confirmado' then 'en_preparacion'
    when 'en_preparacion' then case when p.entrega = 'envio' then 'en_camino' else 'listo_para_recojo' end
    else 'entregado' end
  where p.sandbox and p.compra_id is not null and p.formato = 'fisico' and p.pago = 'aprobado'
    and (p.solicitud_id is null or exists (select 1 from public.picta_solicitudes s
      where s.id = p.solicitud_id and s.estado = 'completada'))
    and case p.estado
      when 'confirmado' then p.pagado_en <= now() - interval '1 minute'
      when 'en_preparacion' then p.pagado_en <= now() - interval '3 minutes'
      when 'en_camino' then p.pagado_en <= now() - interval '6 minutes'
      when 'listo_para_recojo' then p.pagado_en <= now() - interval '6 minutes'
      else false end;
$$;
revoke all on function picta_private.procesar_despachos_de_prueba() from public, anon, authenticated;

create extension if not exists pg_cron with schema pg_catalog;
select cron.schedule('picta-despachos-de-prueba', '* * * * *', 'select picta_private.procesar_despachos_de_prueba()');

commit;

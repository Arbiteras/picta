begin;

create function public.picta_pagar_tarjeta(p_id uuid, p_cliente uuid, p_intento uuid)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare
  compra public.picta_compras;
  resultado text;
  envio_pendiente integer;
  fila record;
begin
  if p_intento is null then raise exception using errcode = 'PT400', message = 'intento_invalido'; end if;

  select * into compra from public.picta_compras
  where id = p_id and cliente_id = p_cliente for update;
  if not found then raise exception using errcode = 'PT404', message = 'compra_no_encontrada'; end if;

  select estado into resultado from public.picta_intentos_tarjeta where compra_id = p_id and id = p_intento;
  if not found and compra.estado = 'pendiente' and compra.vence_en > now() then
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
    resultado := 'aprobado';
    insert into public.picta_intentos_tarjeta (compra_id, id, estado) values (p_id, p_intento, resultado);
  end if;
  return jsonb_build_object('compra', to_jsonb(compra), 'resultado', resultado);
end;
$$;
revoke all on function public.picta_pagar_tarjeta(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.picta_pagar_tarjeta(uuid, uuid, uuid) to service_role;

drop function public.picta_pagar_tarjeta(uuid, uuid, uuid, text);

commit;

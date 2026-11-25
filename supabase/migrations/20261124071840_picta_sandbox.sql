begin;

update public.productos set nombre = 'Picta Esencial', precio_centavos = 3900,
  descripcion = '4 tableros interactivos y 57 pictogramas en el navegador. Renovación mensual opcional.'
where destacado and formato = 'digital';
update public.productos set nombre = 'Picta a tu medida', precio_centavos = 17900,
  descripcion = '90 días de acceso, hasta 10 pictogramas nuevos sencillos y una revisión.'
where destacado and formato = 'personalizado';
update public.productos set nombre = 'Mi diario visual', precio_centavos = 34900,
  descripcion = 'Cuadernillo de 4 hojas a doble cara con 57 pictogramas imantados. Pago único y envío aparte.'
where destacado and formato = 'fisico';

alter table public.pedidos
  add column sandbox boolean not null default false,
  add column formato text check (formato in ('digital', 'personalizado', 'fisico')),
  add column entrega text check (entrega in ('recojo', 'envio')),
  add column envio_centavos integer not null default 0 check (envio_centavos >= 0),
  add column pago text check (pago in ('pendiente', 'aprobado', 'rechazado')),
  add column pagado_en timestamptz;
grant insert (sandbox, entrega) on public.pedidos to authenticated;

create table public.picta_accesos (
  cliente_id uuid primary key references public.clientes(id) on delete cascade,
  formato text not null check (formato in ('digital', 'personalizado')),
  vence_en timestamptz not null
);
create table public.picta_solicitudes (
  id uuid primary key,
  cliente_id uuid not null default auth.uid() references public.clientes(id) on delete cascade,
  formato text not null check (formato in ('personalizado', 'fisico', 'contacto')),
  entorno text not null check (entorno in ('hogar', 'escuela', 'salud', 'ciudad', 'otro')),
  descripcion text not null check (char_length(btrim(descripcion)) between 1 and 600),
  autorizado boolean not null check (autorizado),
  estado text not null default 'recibida' check (estado in ('recibida', 'cotizada', 'en_diseno', 'en_revision', 'saldo_pendiente', 'completada')),
  cotizacion_centavos integer check (cotizacion_centavos > 0),
  creado_en timestamptz not null default now()
);
create index picta_solicitudes_cliente_fecha on public.picta_solicitudes (cliente_id, creado_en desc);

create table public.picta_rutinas (
  cliente_id uuid not null default auth.uid() references public.clientes(id) on delete cascade,
  tablero text not null check (tablero in ('day', 'phrases', 'say')),
  casillas jsonb not null check (jsonb_typeof(casillas) = 'array' and pg_column_size(casillas) <= 4096),
  primary key (cliente_id, tablero)
);

alter table public.picta_accesos enable row level security;
alter table public.picta_solicitudes enable row level security;
alter table public.picta_rutinas enable row level security;
revoke all on public.picta_accesos, public.picta_solicitudes, public.picta_rutinas from public, anon, authenticated;
grant select on public.picta_accesos, public.picta_solicitudes, public.picta_rutinas to authenticated;
grant insert (id, formato, entorno, descripcion, autorizado) on public.picta_solicitudes to authenticated;
grant insert (tablero, casillas), update (casillas) on public.picta_rutinas to authenticated;

create policy picta_accesos_propios on public.picta_accesos for select to authenticated using (cliente_id = (select auth.uid()));
create policy picta_solicitudes_propias on public.picta_solicitudes for select to authenticated using (cliente_id = (select auth.uid()));
create policy picta_solicitudes_crear on public.picta_solicitudes for insert to authenticated with check (cliente_id = (select auth.uid()));
create policy picta_rutinas_propias on public.picta_rutinas for select to authenticated using (cliente_id = (select auth.uid()));
create policy picta_rutinas_crear on public.picta_rutinas for insert to authenticated with check (
  cliente_id = (select auth.uid()) and exists (select 1 from public.picta_accesos where vence_en > now())
);
create policy picta_rutinas_editar on public.picta_rutinas for update to authenticated
using (cliente_id = (select auth.uid())) with check (
  cliente_id = (select auth.uid()) and exists (select 1 from public.picta_accesos where vence_en > now())
);

create or replace function picta_private.preparar_pedido_picta()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  producto public.productos;
begin
  select * into producto from public.productos where id = new.producto_id and activo;
  if not found then raise exception using errcode = 'PT409', message = 'producto_no_disponible'; end if;
  if new.precio_unitario_centavos is distinct from producto.precio_centavos then
    raise exception using errcode = 'PT409', message = 'precio_actualizado';
  end if;
  new.producto_nombre := producto.nombre;
  new.formato := producto.formato;
  if new.sandbox then
    if producto.formato = 'personalizado'
      or (producto.formato = 'digital' and (new.cantidad <> 1 or new.entrega is not null))
      or (producto.formato = 'fisico' and new.entrega is null) then
      raise exception using errcode = 'PT409', message = 'pedido_invalido';
    end if;
    new.pago := 'pendiente';
    new.envio_centavos := case when new.entrega = 'envio' then 2500 else 0 end;
  elsif new.entrega is not null then
    raise exception using errcode = 'PT409', message = 'pedido_invalido';
  end if;
  return new;
end;
$$;

create function picta_private.activar_acceso_prueba(p_cliente uuid, p_formato text)
returns void language sql set search_path = '' as $$
  insert into public.picta_accesos as acceso (cliente_id, formato, vence_en)
  values (p_cliente, p_formato, now() + case when p_formato = 'digital' then interval '1 month' else interval '90 days' end)
  on conflict (cliente_id) do update set
    formato = case when excluded.formato = 'personalizado' then excluded.formato else acceso.formato end,
    vence_en = case when excluded.formato = 'digital' then greatest(now(), acceso.vence_en) + interval '1 month'
      else greatest(excluded.vence_en, acceso.vence_en) end;
$$;

create function picta_private.avanzar_pedido_prueba(p_id uuid, p_accion text, p_pago_esperado text, p_estado_esperado text)
returns public.pedidos language plpgsql security definer set search_path = '' as $$
declare
  pedido public.pedidos;
  titular uuid := auth.uid();
begin
  select * into pedido from public.pedidos where id = p_id and sandbox and cliente_id = titular for update;
  if not found then raise exception using errcode = 'PT404', message = 'pedido_no_encontrado'; end if;
  if pedido.pago is distinct from p_pago_esperado or pedido.estado is distinct from p_estado_esperado then
    return pedido;
  end if;
  if p_accion in ('aprobar', 'rechazar') and pedido.estado = 'pendiente' and pedido.pago in ('pendiente', 'rechazado') then
    if p_accion = 'rechazar' then
      update public.pedidos set pago = 'rechazado' where id = p_id returning * into pedido;
    else
      update public.pedidos set pago = 'aprobado', estado = 'confirmado', pagado_en = now() where id = p_id returning * into pedido;
      if pedido.formato = 'digital' then perform picta_private.activar_acceso_prueba(titular, 'digital'); end if;
    end if;
  elsif p_accion = 'entrega' and pedido.formato = 'fisico' and pedido.pago = 'aprobado'
    and pedido.estado in ('confirmado', 'en_preparacion') then
    update public.pedidos set estado = case pedido.estado when 'confirmado' then 'en_preparacion' else 'entregado' end
    where id = p_id returning * into pedido;
  elsif p_accion = 'cancelar' and pedido.pago in ('pendiente', 'rechazado') and pedido.estado = 'pendiente' then
    update public.pedidos set estado = 'cancelado' where id = p_id returning * into pedido;
  else
    raise exception using errcode = 'PT409', message = 'accion_no_disponible';
  end if;
  return pedido;
end;
$$;

create function picta_private.avanzar_solicitud_prueba(p_id uuid, p_estado_esperado text)
returns public.picta_solicitudes language plpgsql security definer set search_path = '' as $$
declare
  solicitud public.picta_solicitudes;
  nuevo_estado text;
  precio integer;
  titular uuid := auth.uid();
begin
  select * into solicitud from public.picta_solicitudes where id = p_id and cliente_id = titular for update;
  if not found then raise exception using errcode = 'PT404', message = 'solicitud_no_encontrada'; end if;
  if solicitud.estado is distinct from p_estado_esperado then return solicitud; end if;
  if solicitud.formato = 'contacto' or solicitud.estado = 'completada' then
    raise exception using errcode = 'PT409', message = 'accion_no_disponible';
  end if;
  precio := solicitud.cotizacion_centavos;
  if solicitud.estado = 'recibida' then
    select precio_centavos into precio from public.productos where destacado and activo and formato = solicitud.formato;
    if not found then raise exception using errcode = 'PT409', message = 'producto_no_disponible'; end if;
    if solicitud.formato = 'fisico' then precio := precio + 5000; end if;
  end if;
  nuevo_estado := case solicitud.estado when 'recibida' then 'cotizada' when 'cotizada' then 'en_diseno'
    when 'en_diseno' then 'en_revision' when 'en_revision' then 'saldo_pendiente' else 'completada' end;
  update public.picta_solicitudes set estado = nuevo_estado, cotizacion_centavos = precio
  where id = p_id returning * into solicitud;
  if nuevo_estado = 'completada' and solicitud.formato = 'personalizado' then
    perform picta_private.activar_acceso_prueba(titular, 'personalizado');
  end if;
  return solicitud;
end;
$$;

revoke all on function picta_private.activar_acceso_prueba(uuid, text),
  picta_private.avanzar_pedido_prueba(uuid, text, text, text), picta_private.avanzar_solicitud_prueba(uuid, text)
from public, anon, authenticated;
grant usage on schema picta_private to authenticated;
grant execute on function picta_private.avanzar_pedido_prueba(uuid, text, text, text),
  picta_private.avanzar_solicitud_prueba(uuid, text) to authenticated;

create function public.picta_avanzar_pedido(p_id uuid, p_accion text, p_pago_esperado text, p_estado_esperado text)
returns public.pedidos language sql security invoker set search_path = '' as $$
  select picta_private.avanzar_pedido_prueba(p_id, p_accion, p_pago_esperado, p_estado_esperado);
$$;
create function public.picta_avanzar_solicitud(p_id uuid, p_estado_esperado text)
returns public.picta_solicitudes language sql security invoker set search_path = '' as $$
  select picta_private.avanzar_solicitud_prueba(p_id, p_estado_esperado);
$$;
revoke all on function public.picta_avanzar_pedido(uuid, text, text, text), public.picta_avanzar_solicitud(uuid, text)
from public, anon, authenticated;
grant execute on function public.picta_avanzar_pedido(uuid, text, text, text),
  public.picta_avanzar_solicitud(uuid, text) to authenticated;

commit;

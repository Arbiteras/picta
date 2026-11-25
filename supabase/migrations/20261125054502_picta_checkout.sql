begin;

create table public.picta_compras (
  id uuid primary key,
  cliente_id uuid not null references public.clientes(id),
  lineas jsonb not null,
  entrega text check (entrega in ('recojo', 'envio')),
  direccion text,
  envio_centavos integer not null check (envio_centavos >= 0),
  total_centavos integer not null check (total_centavos > 0),
  estado text not null default 'pendiente' check (estado in ('pendiente', 'pagada', 'rechazada', 'vencida')),
  referencia text not null unique default gen_random_uuid()::text,
  vence_en timestamptz not null default (now() + interval '10 minutes'),
  creado_en timestamptz not null default now(),
  pagado_en timestamptz
);
create index picta_compras_cliente_fecha on public.picta_compras (cliente_id, creado_en desc);
alter table public.picta_compras enable row level security;
revoke all on public.picta_compras from public, anon, authenticated;
grant select (id, cliente_id, lineas, entrega, envio_centavos, total_centavos, estado, vence_en, creado_en)
  on public.picta_compras to authenticated;
grant all on public.picta_compras to service_role;
create policy picta_compras_propias on public.picta_compras for select to authenticated
  using (cliente_id = (select auth.uid()));

alter table public.pedidos add column compra_id uuid references public.picta_compras(id);
alter table public.picta_solicitudes add column compra_id uuid references public.picta_compras(id);

create or replace function picta_private.preparar_pedido_picta()
returns trigger language plpgsql security invoker set search_path = '' as $$
declare
  producto public.productos;
begin
  select * into producto from public.productos where id = new.producto_id;
  if not found or (new.compra_id is null and not producto.activo) then
    raise exception using errcode = 'PT409', message = 'producto_no_disponible';
  end if;
  if new.compra_id is not null then
    return new;
  end if;
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

create function public.picta_preparar_compra(
  p_id uuid, p_cliente uuid, p_lineas jsonb, p_entrega text, p_direccion text, p_total integer
) returns public.picta_compras
language plpgsql security invoker set search_path = '' as $$
declare
  compra public.picta_compras;
  producto public.productos;
  fila record;
  tipo text;
  nombre text;
  precio integer;
  n integer;
  total integer := 0;
  envio integer;
  lineas jsonb := '[]'::jsonb;
  hay_fisico boolean := false;
begin
  if jsonb_typeof(p_lineas) is distinct from 'array' or jsonb_array_length(p_lineas) not between 1 and 8
    or p_total is null then
    raise exception using errcode = 'PT400', message = 'carrito_invalido';
  end if;
  for fila in
    select * from jsonb_to_recordset(p_lineas) as r(sku text, cantidad integer, detalle text)
  loop
    if fila.sku is null or fila.sku !~ '^(digital|fisico)(-(10|25|50))?$'
      or fila.cantidad is null or fila.cantidad not between 1 and 10
      or lineas @> jsonb_build_array(jsonb_build_object('sku', fila.sku)) then
      raise exception using errcode = 'PT400', message = 'carrito_invalido';
    end if;
    tipo := split_part(fila.sku, '-', 1);
    hay_fisico := hay_fisico or tipo = 'fisico';
    n := nullif(split_part(fila.sku, '-', 2), '')::integer;
    select * into producto from public.productos p where p.formato = tipo and activo and destacado;
    if not found then raise exception using errcode = 'PT409', message = 'producto_no_disponible'; end if;

    if n is null then
      nombre := producto.nombre;
      precio := producto.precio_centavos;
      if tipo = 'digital' and fila.cantidad <> 1 then
        raise exception using errcode = 'PT400', message = 'carrito_invalido';
      end if;
    else
      if fila.cantidad <> 1 or char_length(btrim(coalesce(fila.detalle, ''))) not between 1 and 600 then
        raise exception using errcode = 'PT400', message = 'personalizacion_incompleta';
      end if;
      nombre := case n when 10 then 'Mi mundo' when 25 then 'Mi universo' else 'A mi medida' end
        || case tipo when 'digital' then ' · Picta Digital' else ' · Picta Físico' end;
      precio := case tipo when 'digital' then
        case n when 10 then 3900 when 25 then 8900 else 16900 end
        else case n when 10 then 7900 when 25 then 14900 else 24900 end end;
    end if;
    lineas := lineas || jsonb_build_array(jsonb_build_object(
      'sku', fila.sku, 'producto_id', producto.id, 'formato', tipo, 'nombre', nombre,
      'cantidad', fila.cantidad, 'precio_centavos', precio, 'paquete', n,
      'detalle', case when n is not null then btrim(fila.detalle) end
    ));
    total := total + precio * fila.cantidad;
  end loop;
  if (hay_fisico and (p_entrega is null or p_entrega not in ('recojo', 'envio')))
    or (not hay_fisico and p_entrega is not null)
    or (p_entrega = 'envio' and char_length(btrim(coalesce(p_direccion, ''))) not between 8 and 300) then
    raise exception using errcode = 'PT400', message = 'entrega_incompleta';
  end if;
  envio := case when p_entrega = 'envio' then 2500 else 0 end;
  if total + envio <> p_total then
    raise exception using errcode = 'PT409', message = 'precio_actualizado';
  end if;
  insert into public.picta_compras(id, cliente_id, lineas, entrega, direccion, envio_centavos, total_centavos)
  values (p_id, p_cliente, lineas, p_entrega, case when p_entrega = 'envio' then btrim(p_direccion) end, envio, total + envio)
  on conflict (id) do nothing;
  select * into compra from public.picta_compras where id = p_id and cliente_id = p_cliente;
  if not found or compra.lineas is distinct from lineas or compra.entrega is distinct from p_entrega
    or compra.direccion is distinct from (case when p_entrega = 'envio' then btrim(p_direccion) end) then
    raise exception using errcode = 'PT409', message = 'compra_existente';
  end if;
  return compra;
end;
$$;

create function public.picta_confirmar_compra(p_id uuid, p_referencia text, p_total integer)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  compra public.picta_compras;
  fila record;
  envio_pendiente integer;
begin
  select * into compra from public.picta_compras where id = p_id for update;
  if not found or p_referencia is null or compra.referencia is distinct from p_referencia or compra.total_centavos is distinct from p_total then
    raise exception using errcode = 'PT409', message = 'pago_no_coincide';
  end if;
  if compra.estado = 'pagada' then return; end if;
  if compra.estado <> 'pendiente' or compra.vence_en <= now() then
    raise exception using errcode = 'PT409', message = 'pago_cerrado';
  end if;
  envio_pendiente := compra.envio_centavos;

  for fila in select * from jsonb_to_recordset(compra.lineas) as r(
    producto_id bigint, formato text, nombre text, cantidad integer, precio_centavos integer, paquete integer, detalle text
  ) loop
    if fila.paquete is null then
      insert into public.pedidos(
        compra_id, cliente_id, producto_id, producto_nombre, formato, precio_unitario_centavos,
        cantidad, estado, pago, pagado_en, entrega, envio_centavos
      ) values (
        compra.id, compra.cliente_id, fila.producto_id, fila.nombre, fila.formato, fila.precio_centavos,
        fila.cantidad, 'confirmado', 'aprobado', now(),
        case when fila.formato = 'fisico' then compra.entrega end,
        case when fila.formato = 'fisico' then envio_pendiente else 0 end
      );
      if fila.formato = 'fisico' then envio_pendiente := 0; end if;
      if fila.formato = 'digital' then perform picta_private.activar_acceso_prueba(compra.cliente_id, 'digital'); end if;
    else
      insert into public.picta_solicitudes(
        id, compra_id, cliente_id, formato, entorno, descripcion, autorizado, estado, paquete_pictogramas, cotizacion_centavos
      ) values (
        gen_random_uuid(), compra.id, compra.cliente_id,
        case when fila.formato = 'digital' then 'personalizado' else 'fisico' end,
        'otro', fila.detalle, true, 'en_diseno', fila.paquete, fila.precio_centavos
      );
    end if;
  end loop;

  update public.picta_compras set estado = 'pagada', pagado_en = now() where id = p_id;
end;
$$;

grant usage on schema picta_private to service_role;
grant execute on function picta_private.activar_acceso_prueba(uuid, text) to service_role;
revoke all on function public.picta_preparar_compra(uuid, uuid, jsonb, text, text, integer),
  public.picta_confirmar_compra(uuid, text, integer) from public, anon, authenticated;
grant execute on function public.picta_preparar_compra(uuid, uuid, jsonb, text, text, integer),
  public.picta_confirmar_compra(uuid, text, integer) to service_role;

create or replace function picta_private.avanzar_solicitud_prueba(p_id uuid, p_estado_esperado text)
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
  if solicitud.compra_id is not null or solicitud.formato = 'contacto' or solicitud.estado = 'completada' then
    raise exception using errcode = 'PT409', message = 'accion_no_disponible';
  end if;
  precio := solicitud.cotizacion_centavos;
  if solicitud.estado = 'recibida' and precio is null then
    if solicitud.paquete_pictogramas is null then
      -- Legacy standalone requests keep their previous simulated quote.
      precio := case solicitud.formato when 'personalizado' then 17900 else 39900 end;
    else
      select tarifas.centavos into strict precio
      from (values
        ('personalizado', 10, 3900), ('personalizado', 25, 8900), ('personalizado', 50, 16900),
        ('fisico', 10, 7900), ('fisico', 25, 14900), ('fisico', 50, 24900)
      ) as tarifas (formato, cantidad, centavos)
      where tarifas.formato = solicitud.formato and tarifas.cantidad = solicitud.paquete_pictogramas;
    end if;
  end if;
  nuevo_estado := case solicitud.estado when 'recibida' then 'cotizada' when 'cotizada' then 'en_diseno'
    when 'en_diseno' then 'en_revision' when 'en_revision' then 'saldo_pendiente' else 'completada' end;
  update public.picta_solicitudes set estado = nuevo_estado, cotizacion_centavos = precio
  where id = p_id returning * into solicitud;
  if nuevo_estado = 'completada' and solicitud.formato = 'personalizado'
    and solicitud.paquete_pictogramas is null then
    perform picta_private.activar_acceso_prueba(titular, 'personalizado');
  end if;
  return solicitud;
end;
$$;

revoke execute on function public.picta_avanzar_pedido(uuid, text, text, text)
  from public, anon, authenticated;
revoke execute on function public.picta_avanzar_solicitud(uuid, text)
  from public, anon, authenticated;
revoke insert (id, producto_id, cantidad, precio_unitario_centavos, sandbox, entrega)
  on public.pedidos from authenticated;

commit;

begin;

create table public.productos (
  id bigint generated always as identity primary key,
  destacado boolean not null default false,
  formato text not null check (formato in ('digital', 'personalizado', 'fisico')),
  nombre text not null check (char_length(btrim(nombre)) between 1 and 100),
  descripcion text not null default '' check (char_length(descripcion) <= 500),
  precio_centavos integer not null check (precio_centavos between 1 and 100000000),
  activo boolean not null default true
);

create unique index productos_destacado_por_formato on public.productos (formato) where destacado;

alter table public.productos enable row level security;
revoke all on table public.productos from public, anon, authenticated;
grant select on table public.productos to anon, authenticated;

create policy productos_publicados
on public.productos for select to anon, authenticated
using (activo);

create table public.pedidos (
  id uuid primary key default gen_random_uuid(),
  folio bigint generated always as identity unique,
  cliente_id uuid default auth.uid() references public.clientes (id) on delete set null,
  producto_id bigint not null references public.productos (id),
  producto_nombre text not null,
  precio_unitario_centavos bigint not null check (precio_unitario_centavos between 1 and 100000000),
  cantidad integer not null check (cantidad between 1 and 99),
  total_centavos bigint generated always as (precio_unitario_centavos * cantidad) stored,
  estado text not null default 'pendiente' check (
    estado in ('pendiente', 'confirmado', 'en_preparacion', 'entregado', 'cancelado')
  ),
  creado_en timestamptz not null default now()
);

create index pedidos_cliente_fecha on public.pedidos (cliente_id, creado_en desc, folio desc);
create index pedidos_producto on public.pedidos (producto_id);

alter table public.pedidos enable row level security;
revoke all on table public.pedidos from public, anon, authenticated;
grant select on table public.pedidos to authenticated;
grant insert (id, producto_id, cantidad, precio_unitario_centavos)
on table public.pedidos to authenticated;

create policy pedidos_leer_propios
on public.pedidos for select to authenticated
using ((select auth.uid()) = cliente_id);

create policy pedidos_registrar
on public.pedidos for insert to authenticated
with check ((select auth.uid()) = cliente_id);

create function picta_private.preparar_pedido_picta()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  producto record;
begin
  select nombre, precio_centavos into producto
  from public.productos where id = new.producto_id and activo;

  if not found then
    raise exception using errcode = 'PT409', message = 'producto_no_disponible';
  end if;
  if new.precio_unitario_centavos is distinct from producto.precio_centavos then
    raise exception using errcode = 'PT409', message = 'precio_actualizado';
  end if;
  new.producto_nombre = producto.nombre;
  new.precio_unitario_centavos = producto.precio_centavos;
  return new;
end;
$$;

create function picta_private.validar_estado_picta()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.estado is distinct from old.estado and not (
    (old.estado = 'pendiente' and new.estado in ('confirmado', 'cancelado'))
    or (old.estado = 'confirmado' and new.estado in ('en_preparacion', 'cancelado'))
    or (old.estado = 'en_preparacion' and new.estado in ('entregado', 'cancelado'))
  ) then
    raise exception using errcode = 'PT409', message = 'estado_de_pedido_invalido';
  end if;
  return new;
end;
$$;

revoke all on function picta_private.preparar_pedido_picta(), picta_private.validar_estado_picta()
from public, anon, authenticated;

create trigger pedidos_preparar
before insert on public.pedidos for each row execute function picta_private.preparar_pedido_picta();

create trigger pedidos_validar_estado
before update of estado on public.pedidos for each row execute function picta_private.validar_estado_picta();

create function public.resumen_mis_pedidos_picta()
returns table (
  total bigint, en_curso bigint, entregados bigint
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    count(*),
    count(*) filter (where estado in ('pendiente', 'confirmado', 'en_preparacion')),
    count(*) filter (where estado = 'entregado')
  from public.pedidos
  where cliente_id = (select auth.uid());
$$;

revoke all on function public.resumen_mis_pedidos_picta() from public, anon, authenticated;
grant execute on function public.resumen_mis_pedidos_picta() to authenticated;

insert into public.productos (destacado, formato, nombre, descripcion, precio_centavos)
values
  (true, 'digital', 'Biblioteca esencial', '40–60 recursos visuales en PDF para imprimir en casa, organizados por categoría.', 3900),
  (true, 'personalizado', 'Hecho para tu rutina', 'Tarjetas y secuencias digitales adaptadas a tus actividades, personas y lugares.', 12000),
  (true, 'fisico', 'Kit Picta', 'Tarjetas impresas y laminadas, listas para usar. Producción bajo pedido.', 25000);

commit;

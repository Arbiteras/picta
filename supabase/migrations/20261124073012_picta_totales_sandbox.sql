begin;

alter table public.pedidos add column total_con_envio_centavos bigint
  generated always as (precio_unitario_centavos * cantidad + envio_centavos) stored;

create or replace function public.resumen_mis_pedidos_picta()
returns table (total bigint, en_curso bigint, entregados bigint)
language sql stable security invoker set search_path = '' as $$
  select count(*),
    count(*) filter (where estado in ('pendiente', 'confirmado', 'en_preparacion')
      and not (formato is not distinct from 'digital' and pago is not distinct from 'aprobado')),
    count(*) filter (where estado = 'entregado' or (formato = 'digital' and pago = 'aprobado'))
  from public.pedidos where cliente_id = (select auth.uid());
$$;

commit;

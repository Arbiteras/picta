begin;

create function picta_private.bloquear_compra_digital_activa()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if new.lineas @> '[{"sku":"digital"}]'::jsonb
    and exists (select 1 from public.picta_accesos
      where cliente_id = new.cliente_id and vence_en > now())
    and not exists (select 1 from public.picta_compras
      where id = new.id and cliente_id = new.cliente_id and estado = 'pagada') then
    raise exception using errcode = 'PT409', message = 'acceso_digital_activo';
  end if;
  return new;
end;
$$;

revoke all on function picta_private.bloquear_compra_digital_activa() from public, anon, authenticated;

create trigger picta_compras_acceso_digital_activo
before insert on public.picta_compras
for each row execute function picta_private.bloquear_compra_digital_activa();

create or replace function picta_private.activar_acceso_prueba(p_cliente uuid, p_formato text)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  -- The entitlement row also serializes payments for different purchases of the same plan.
  insert into public.picta_accesos as acceso (cliente_id, formato, vence_en)
  values (p_cliente, p_formato, now() + case when p_formato = 'digital' then interval '1 month' else interval '90 days' end)
  on conflict (cliente_id) do update set
    formato = excluded.formato,
    vence_en = greatest(excluded.vence_en, acceso.vence_en)
  where excluded.formato <> 'digital' or acceso.vence_en <= now();

  if not found then
    raise exception using errcode = 'PT409', message = 'acceso_digital_activo';
  end if;
end;
$$;

commit;

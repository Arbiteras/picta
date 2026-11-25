begin;

create function picta_private.bloquear_paquete_digital()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_op = 'INSERT' or (new.estado = 'pagada' and old.estado is distinct from new.estado))
    and exists (
      select 1 from pg_catalog.jsonb_to_recordset(new.lineas) as linea(formato text, paquete integer)
      where linea.formato = 'digital' and linea.paquete is not null
    )
    and not (tg_op = 'INSERT' and exists (
      select 1 from public.picta_compras
      where id = new.id and cliente_id = new.cliente_id and estado = 'pagada'
    )) then
    raise exception using errcode = 'PT409', message = 'paquete_digital_no_disponible';
  end if;
  return new;
end;
$$;

revoke all on function picta_private.bloquear_paquete_digital() from public, anon, authenticated;

create trigger picta_compras_solo_extras_fisicos
before insert or update of estado on public.picta_compras
for each row execute function picta_private.bloquear_paquete_digital();

commit;

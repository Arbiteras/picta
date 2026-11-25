begin;

alter table public.picta_rutinas
  drop constraint picta_rutinas_tablero_check,
  add constraint picta_rutinas_tablero_check
    check (tablero in ('day', 'phrases', 'say', 'people', 'care', 'collection', 'school'));

alter policy picta_rutinas_propias on public.picta_rutinas
  using (
    cliente_id = (select auth.uid()) and exists (
      select 1 from public.picta_accesos
      where cliente_id = (select auth.uid()) and vence_en > now()
    )
  );

update public.productos
set descripcion = 'Cuadernillo digital de 8 páginas con 4 tableros de uso, 4 páginas para organizar fichas y 57 pictogramas. Renovación mensual manual.'
where destacado and formato = 'digital';

commit;

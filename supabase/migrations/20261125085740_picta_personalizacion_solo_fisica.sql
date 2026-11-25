alter policy picta_solicitudes_crear on public.picta_solicitudes
with check (
  cliente_id = (select auth.uid())
  and formato in ('fisico', 'contacto')
);

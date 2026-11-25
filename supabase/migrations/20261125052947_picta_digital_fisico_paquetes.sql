begin;

update public.productos
set precio_centavos = 5900,
  descripcion = '57 pictogramas generales y 4 tableros digitales. Renovación mensual manual.'
where destacado and formato = 'digital';

update public.productos
set precio_centavos = 49900,
  descripcion = 'Cuadernillo imantado de 4 hojas a doble cara con 57 pictogramas generales. Pago único y envío aparte.'
where destacado and formato = 'fisico';

update public.productos
set activo = false
where activo and formato = 'personalizado';

alter table public.picta_solicitudes
  add column paquete_pictogramas smallint,
  add constraint picta_solicitudes_paquete_valido check (
    paquete_pictogramas is null
    or (formato in ('personalizado', 'fisico') and paquete_pictogramas in (10, 25, 50))
  );

grant insert (paquete_pictogramas) on public.picta_solicitudes to authenticated;

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
  if solicitud.formato = 'contacto' or solicitud.estado = 'completada' then
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

commit;

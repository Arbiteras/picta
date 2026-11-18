begin;

create schema if not exists picta_private;
revoke all on schema picta_private from public, anon, authenticated;

create table public.clientes (
  id uuid primary key references auth.users (id) on delete cascade,
  nombre text check (
    char_length(nombre) between 1 and 100 and nombre ~ '[^[:space:]]'
  ),
  correo text,
  creado_en timestamptz not null default now()
);

alter table public.clientes enable row level security;
revoke all on table public.clientes from public, anon, authenticated;
grant select on table public.clientes to authenticated;
grant update (nombre) on table public.clientes to authenticated;

create policy clientes_leer_perfil_propio
on public.clientes for select to authenticated
using ((select auth.uid()) = id);

create policy clientes_editar_perfil_propio
on public.clientes for update to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- Auth creates the profile and keeps its email in sync. Only Auth controls the email.
create function picta_private.sincronizar_cliente()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  nombre_perfil text := left(btrim(new.raw_user_meta_data ->> 'nombre'), 100);
begin
  if nullif(new.email, '') is null then
    update public.clientes set correo = null where id = new.id;
  elsif new.is_anonymous is not true then
    insert into public.clientes (id, nombre, correo, creado_en)
    values (
      new.id,
      case when nombre_perfil ~ '[^[:space:]]' then nombre_perfil end,
      new.email,
      coalesce(new.created_at, now())
    )
    on conflict (id) do update set correo = excluded.correo;
  end if;
  return new;
end;
$$;

revoke all on function picta_private.sincronizar_cliente() from public, anon, authenticated;

create trigger picta_sincronizar_cliente
after insert or update of email, is_anonymous on auth.users
for each row execute function picta_private.sincronizar_cliente();

insert into public.clientes (id, nombre, correo, creado_en)
select usuarios.id,
       case when perfil.nombre ~ '[^[:space:]]' then perfil.nombre end,
       usuarios.email,
       coalesce(usuarios.created_at, now())
from auth.users as usuarios
cross join lateral (
  select left(btrim(usuarios.raw_user_meta_data ->> 'nombre'), 100) as nombre
) as perfil
where nullif(usuarios.email, '') is not null
  and usuarios.is_anonymous is not true
on conflict (id) do nothing;

commit;

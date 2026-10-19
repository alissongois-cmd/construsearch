-- REVIEW ONLY: do not apply until the import report and admin emails have been reviewed.
begin;
create schema if not exists private;
create table if not exists private.catalog_admin_emails (
  email text primary key check (email = lower(btrim(email)) and email <> '')
);
insert into private.catalog_admin_emails(email) values
  ('alisson.gois@unesp.br'), ('gois17541@gmail.com')
  on conflict (email) do nothing;
revoke all on private.catalog_admin_emails from public, anon, authenticated;
create or replace function public.is_catalog_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.users u join private.catalog_admin_emails a
    on lower(u.email) = a.email where u.id = auth.uid() and u.email_confirmed_at is not null);
$$;
revoke all on function public.is_catalog_admin() from public, anon;
grant execute on function public.is_catalog_admin() to authenticated;

create or replace function public.normalizar_texto_catalogo(valor text)
returns text language sql immutable strict set search_path = '' as $$
  select btrim(regexp_replace(regexp_replace(regexp_replace(normalize(lower(valor), NFD),
    U&'[\0300-\036F]', '', 'g'),
    '([0-9])([a-z])', '\1 \2', 'g'), '[^a-z0-9]+', ' ', 'g'));
$$;
create table if not exists public.catalogo_imagens (
  sku text primary key check (sku = btrim(sku) and sku <> ''),
  nome_oficial text not null check (btrim(nome_oficial) <> ''),
  nome_normalizado text generated always as (public.normalizar_texto_catalogo(nome_oficial)) stored,
  marca text, linha text,
  categoria text not null check (btrim(categoria) <> ''),
  especificacao_tecnica text, cor text, peso text,
  arquivo_imagem text not null check (btrim(arquivo_imagem) <> ''),
  imagem_path text, imagem_url text,
  sinonimos text[] not null default '{}',
  ean text check (ean is null or ean ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create or replace function public.preparar_catalogo_imagem()
returns trigger language plpgsql set search_path = '' as $$
begin
  select coalesce(array_agg(distinct normalizado order by normalizado), '{}'::text[])
    into new.sinonimos from (
      select public.normalizar_texto_catalogo(valor) normalizado
      from unnest(coalesce(new.sinonimos, '{}'::text[])) itens(valor)
    ) normalizados where normalizado <> '';
  new.updated_at := now();
  return new;
end;
$$;
drop trigger if exists preparar_catalogo_imagem on public.catalogo_imagens;
create trigger preparar_catalogo_imagem before insert or update on public.catalogo_imagens
for each row execute function public.preparar_catalogo_imagem();
create index if not exists catalogo_imagens_nome_idx on public.catalogo_imagens(nome_normalizado);
create index if not exists catalogo_imagens_ean_idx on public.catalogo_imagens(ean) where ean is not null;
create index if not exists catalogo_imagens_sinonimos_idx on public.catalogo_imagens using gin(sinonimos);
alter table public.materiais add column if not exists catalogo_sku text
  references public.catalogo_imagens(sku) on delete set null;
create index if not exists materiais_catalogo_sku_idx on public.materiais(catalogo_sku);

-- Existing materials policies allow authenticated writes. A trigger protects this
-- column specifically, including inserts, without breaking public price submissions.
create or replace function public.proteger_vinculo_catalogo()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if (tg_op = 'INSERT' and new.catalogo_sku is not null)
    or (tg_op = 'UPDATE' and new.catalogo_sku is distinct from old.catalogo_sku) then
    if not public.is_catalog_admin() then raise exception 'Somente administradores podem alterar o vínculo do catálogo' using errcode = '42501'; end if;
  end if;
  return new;
end;
$$;
drop trigger if exists proteger_vinculo_catalogo on public.materiais;
create trigger proteger_vinculo_catalogo before insert or update of catalogo_sku on public.materiais
for each row execute function public.proteger_vinculo_catalogo();
alter table public.catalogo_imagens enable row level security;
grant select on public.catalogo_imagens to anon, authenticated;
grant insert, update, delete on public.catalogo_imagens to authenticated;
drop policy if exists "Public read image catalog" on public.catalogo_imagens;
create policy "Public read image catalog" on public.catalogo_imagens
for select to anon, authenticated using (true);
drop policy if exists "Authenticated can manage image catalog" on public.catalogo_imagens;
drop policy if exists "Admins manage image catalog" on public.catalogo_imagens;
create policy "Admins manage image catalog" on public.catalogo_imagens
for all to authenticated using (public.is_catalog_admin()) with check (public.is_catalog_admin());
-- Only the two explicitly approved emails are seeded. Manage via SQL Editor after review:
-- insert into private.catalog_admin_emails(email) values ('email-confirmado@example.com');
commit;

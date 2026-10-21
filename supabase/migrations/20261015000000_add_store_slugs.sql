-- Stable QR links: renaming a store does not change an existing slug.
begin;
alter table public.lojas add column if not exists slug text;

create or replace function public.definir_slug_loja()
returns trigger language plpgsql set search_path = '' as $$
begin
  if new.slug is null or btrim(new.slug) = '' then
    new.slug := coalesce(nullif(trim(both '-' from regexp_replace(
      translate(lower(new.nome), 'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
      '[^a-z0-9]+', '-', 'g')), ''), 'loja') || '-' || new.id::text;
  end if;
  return new;
end;
$$;

drop trigger if exists lojas_definir_slug on public.lojas;
create trigger lojas_definir_slug before insert or update on public.lojas
for each row execute function public.definir_slug_loja();
-- Only fill missing values, preserving printed QR links on repeated runs.
update public.lojas set slug = null where slug is null or btrim(slug) = '';
alter table public.lojas alter column slug set not null;
create unique index if not exists lojas_slug_unique on public.lojas (slug);
commit;

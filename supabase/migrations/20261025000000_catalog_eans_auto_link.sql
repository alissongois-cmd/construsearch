begin;

create or replace function public.normalizar_ean_gtin(p_valor text)
returns text
language plpgsql immutable
set search_path = ''
as $$
declare
  v text;
  soma integer := 0;
  digito integer;
  peso integer := 3;
  i integer;
begin
  if p_valor is null or btrim(p_valor) = '' then return null; end if;
  v := pg_catalog.regexp_replace(p_valor, '[^0-9]', '', 'g');
  if pg_catalog.length(v) not in (8, 12, 13, 14) then return null; end if;
  for i in reverse pg_catalog.length(v) - 1 .. 1 loop
    soma := soma + pg_catalog.substr(v, i, 1)::integer * peso;
    peso := case when peso = 3 then 1 else 3 end;
  end loop;
  digito := (10 - soma % 10) % 10;
  if digito <> pg_catalog.right(v, 1)::integer then return null; end if;
  return pg_catalog.lpad(v, 14, '0');
end;
$$;
revoke all on function public.normalizar_ean_gtin(text) from public, anon, authenticated;
grant execute on function public.normalizar_ean_gtin(text) to anon, authenticated;

create table if not exists public.catalogo_eans (
  ean_normalizado text primary key
    check (ean_normalizado ~ '^[0-9]{14}$'),
  sku text not null references public.catalogo_imagens(sku) on delete cascade,
  origem text,
  criado_em timestamptz not null default now()
);
create index if not exists catalogo_eans_sku_idx on public.catalogo_eans(sku);
alter table public.catalogo_eans enable row level security;
grant select on public.catalogo_eans to anon, authenticated;
grant insert, update, delete on public.catalogo_eans to authenticated;
drop policy if exists "Public read catalog EANs" on public.catalogo_eans;
create policy "Public read catalog EANs" on public.catalogo_eans
  for select to anon, authenticated using (true);
drop policy if exists "Admins manage catalog EANs" on public.catalogo_eans;
create policy "Admins manage catalog EANs" on public.catalogo_eans
  for all to authenticated using (public.is_catalog_admin())
  with check (public.is_catalog_admin());

alter table public.materiais add column if not exists vinculo_origem text;
alter table public.materiais drop constraint if exists materiais_vinculo_origem_check;
alter table public.materiais add constraint materiais_vinculo_origem_check
  check (vinculo_origem is null or vinculo_origem in ('ean','nome','manual'));
update public.materiais set ean = public.normalizar_ean_gtin(ean)
  where ean is not null;
alter table public.materiais drop constraint if exists materiais_ean_normalizado_check;
alter table public.materiais add constraint materiais_ean_normalizado_check
  check (ean is null or ean ~ '^[0-9]{14}$');

-- Invalid legacy EANs are deliberately nulled, never used as a match.
update public.catalogo_imagens
  set ean = public.normalizar_ean_gtin(ean)
  where ean is not null;
alter table public.catalogo_imagens drop constraint if exists catalogo_imagens_ean_check;
alter table public.catalogo_imagens add constraint catalogo_imagens_ean_check
  check (ean is null or ean ~ '^[0-9]{14}$');

-- Fail safely if legacy catalog data assigns the same normalized GTIN to
-- multiple SKUs. Resolve these rows before retrying this migration.
do $$
begin
  if exists (
    select public.normalizar_ean_gtin(ean)
    from public.catalogo_imagens
    where ean is not null
    group by public.normalizar_ean_gtin(ean)
    having count(distinct sku) > 1
  ) then
    raise exception 'EAN duplicado em mais de um SKU de catalogo_imagens; revise os conflitos antes de aplicar esta migration.';
  end if;
end;
$$;

insert into public.catalogo_eans(ean_normalizado, sku, origem)
select public.normalizar_ean_gtin(ean), sku, 'catalogo_imagens.ean'
from public.catalogo_imagens
where ean is not null and public.normalizar_ean_gtin(ean) is not null
on conflict (ean_normalizado) do update
set sku = excluded.sku, origem = excluded.origem;

create or replace function public.sincronizar_ean_catalogo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_ean text;
begin
  if tg_op = 'UPDATE' and old.ean is not null then
    v_ean := public.normalizar_ean_gtin(old.ean);
    if v_ean is not null and (new.ean is null or v_ean is distinct from public.normalizar_ean_gtin(new.ean)) then
      delete from public.catalogo_eans where ean_normalizado = v_ean and sku = old.sku;
    end if;
  elsif tg_op = 'DELETE' and old.ean is not null then
    v_ean := public.normalizar_ean_gtin(old.ean);
    if v_ean is not null then
      delete from public.catalogo_eans where ean_normalizado = v_ean and sku = old.sku;
    end if;
    return old;
  end if;

  if new.ean is not null then
    v_ean := public.normalizar_ean_gtin(new.ean);
    if v_ean is null then
      raise exception 'EAN inválido: GTIN-8/12/13/14 e dígito verificador obrigatório';
    end if;
    begin
      insert into public.catalogo_eans(ean_normalizado, sku, origem)
      values (v_ean, new.sku, 'catalogo_imagens.ean')
      on conflict (ean_normalizado) do update
        set sku = excluded.sku, origem = excluded.origem
        where public.catalogo_eans.sku = excluded.sku;
      if not found then
        raise exception 'EAN % já está associado a outro SKU do catálogo', v_ean
          using errcode = '23505';
      end if;
    exception when unique_violation then
      raise exception 'EAN % já está associado a outro SKU do catálogo', v_ean
        using errcode = '23505';
    end;
  end if;
  return new;
end;
$$;
drop trigger if exists sincronizar_ean_catalogo on public.catalogo_imagens;
create trigger sincronizar_ean_catalogo
  after insert or update of ean, sku or delete on public.catalogo_imagens
  for each row execute function public.sincronizar_ean_catalogo();

create or replace function public.normalizar_ean_envio_trigger()
returns trigger language plpgsql set search_path = '' as $
begin
  if new.ean is not null then new.ean := public.normalizar_ean_gtin(new.ean); end if;
  return new;
end;
$;
drop trigger if exists normalizar_ean_envio on public.envios_pendentes;
create trigger normalizar_ean_envio
  before insert or update of ean on public.envios_pendentes
  for each row execute function public.normalizar_ean_envio_trigger();

create or replace function public.normalizar_ean_material_trigger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.ean is not null then
    new.ean := public.normalizar_ean_gtin(new.ean);
  end if;
  if tg_op = 'INSERT' and new.catalogo_sku is not null and new.vinculo_origem is null then
    new.vinculo_origem := 'manual';
  end if;
  return new;
end;
$$;
drop trigger if exists normalizar_ean_material on public.materiais;
create trigger normalizar_ean_material
  before insert or update of ean, catalogo_sku on public.materiais
  for each row execute function public.normalizar_ean_material_trigger();

-- Trigger-only worker. It can update an automatic link even when the material
-- was submitted by a non-admin; manual links are never changed.
create or replace function public.aplicar_vinculo_ean_material(p_material_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare v_sku text;
begin
  update public.materiais m
    set catalogo_sku = e.sku, vinculo_origem = 'ean'
    from public.catalogo_eans e
    where m.id = p_material_id
      and m.ean = e.ean_normalizado
      and m.catalogo_sku is null
      and coalesce(m.vinculo_origem, '') <> 'manual'
    returning e.sku into v_sku;
  return found;
end;
$$;
revoke all on function public.aplicar_vinculo_ean_material(uuid) from public, anon, authenticated;

create or replace function public.tentar_vinculo_ean_material_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ean is not null and new.catalogo_sku is null
     and coalesce(new.vinculo_origem, '') <> 'manual' then
    perform public.aplicar_vinculo_ean_material(new.id);
  end if;
  return null;
end;
$$;
revoke all on function public.tentar_vinculo_ean_material_trigger() from public, anon, authenticated;
drop trigger if exists tentar_vinculo_ean_material on public.materiais;
create trigger tentar_vinculo_ean_material
  after insert or update of ean on public.materiais
  for each row execute function public.tentar_vinculo_ean_material_trigger();

create or replace function public.vincular_materiais_por_ean()
returns table(vinculados bigint, sem_correspondencia bigint, conflitos bigint)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_catalog_admin() then
    raise exception 'Acesso restrito a administradores' using errcode = '42501';
  end if;

  update public.materiais m
    set catalogo_sku = e.sku, vinculo_origem = 'ean'
    from public.catalogo_eans e
    where m.ean = e.ean_normalizado
      and m.catalogo_sku is null
      and coalesce(m.vinculo_origem, '') <> 'manual';
  get diagnostics vinculados = row_count;

  select count(*) into sem_correspondencia
  from public.materiais m
  where m.ean is not null
    and m.catalogo_sku is null
    and coalesce(m.vinculo_origem, '') <> 'manual'
    and not exists (select 1 from public.catalogo_eans e where e.ean_normalizado = m.ean);

  -- PK guarantees one catalog SKU per EAN. Count legacy duplicate material
  -- EANs as conflicts for operator review, without choosing a material.
  select count(*) into conflitos
  from (
    select m.ean from public.materiais m
    where m.ean is not null and m.catalogo_sku is null
      and coalesce(m.vinculo_origem, '') <> 'manual'
    group by m.ean having count(*) > 1
  ) d;
  return next;
end;
$$;
revoke all on function public.vincular_materiais_por_ean() from public, anon;
grant execute on function public.vincular_materiais_por_ean() to authenticated;

create or replace function public.revincular_materiais_ao_inserir_ean_catalogo()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.materiais m
    set catalogo_sku = new.sku, vinculo_origem = 'ean'
    where m.ean = new.ean_normalizado
      and m.catalogo_sku is null
      and coalesce(m.vinculo_origem, '') <> 'manual';
  return new;
end;
$$;
revoke all on function public.revincular_materiais_ao_inserir_ean_catalogo() from public, anon, authenticated;
drop trigger if exists revincular_materiais_ao_inserir_ean_catalogo on public.catalogo_eans;
create trigger revincular_materiais_ao_inserir_ean_catalogo
  after insert or update of sku on public.catalogo_eans
  for each row execute function public.revincular_materiais_ao_inserir_ean_catalogo();

-- Preserve the existing catalog-link guard while allowing only nested writes
-- initiated by the trusted SECURITY DEFINER trigger functions above.
create or replace function public.proteger_vinculo_catalogo()
returns trigger language plpgsql security invoker set search_path = '' as $$
begin
  if ((tg_op = 'INSERT' and new.catalogo_sku is not null)
    or (tg_op = 'UPDATE' and new.catalogo_sku is distinct from old.catalogo_sku))
    and pg_catalog.pg_trigger_depth() <= 1 then
    if not public.is_catalog_admin() then
      raise exception 'Somente administradores podem alterar o vínculo do catálogo'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;

commit;

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
-- Preserve every legacy row whose EAN cannot be validated before NULL normalization.
create schema if not exists private;
create table if not exists private.materiais_ean_invalidos_backup as
  select m.*, now()::timestamptz as backup_at
  from public.materiais m where false;
create unique index if not exists materiais_ean_invalidos_backup_id_idx
  on private.materiais_ean_invalidos_backup(id);
revoke all on private.materiais_ean_invalidos_backup from public, anon, authenticated;
insert into private.materiais_ean_invalidos_backup
select m.*, now()::timestamptz
from public.materiais m
where m.ean is not null and public.normalizar_ean_gtin(m.ean) is null
on conflict (id) do nothing;

create table if not exists private.catalogo_imagens_ean_invalidos_backup as
  select c.*, now()::timestamptz as backup_at
  from public.catalogo_imagens c where false;
create unique index if not exists catalogo_imagens_ean_invalidos_backup_sku_idx
  on private.catalogo_imagens_ean_invalidos_backup(sku);
revoke all on private.catalogo_imagens_ean_invalidos_backup from public, anon, authenticated;
insert into private.catalogo_imagens_ean_invalidos_backup
select c.*, now()::timestamptz
from public.catalogo_imagens c
where c.ean is not null and public.normalizar_ean_gtin(c.ean) is null
on conflict (sku) do nothing;

-- GTIN-13 and GTIN-14 may represent the same product after canonicalization.
-- Material EAN is not required to be unique; keep all source rows and index lookups.
drop index if exists public.materiais_ean_unique;
create index if not exists materiais_ean_normalizado_idx
  on public.materiais(ean) where ean is not null;

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

-- Keep legacy conflicts visible for administrator review, without choosing a SKU.
create table if not exists public.catalogo_ean_conflitos (
  ean_normalizado text primary key,
  skus text[] not null,
  criado_em timestamptz not null default now()
);
alter table public.catalogo_ean_conflitos enable row level security;
grant select on public.catalogo_ean_conflitos to authenticated;
drop policy if exists "Admins read catalog EAN conflicts" on public.catalogo_ean_conflitos;
create policy "Admins read catalog EAN conflicts" on public.catalogo_ean_conflitos
  for select to authenticated using (public.is_catalog_admin());

insert into public.catalogo_ean_conflitos(ean_normalizado,skus)
select public.normalizar_ean_gtin(ean), pg_catalog.array_agg(sku order by sku)
from public.catalogo_imagens
where ean is not null and public.normalizar_ean_gtin(ean) is not null
group by public.normalizar_ean_gtin(ean)
having count(distinct sku) > 1
on conflict (ean_normalizado) do update set skus=excluded.skus;

insert into public.catalogo_eans(ean_normalizado, sku, origem)
select public.normalizar_ean_gtin(ci.ean), ci.sku, 'catalogo_imagens.ean'
from public.catalogo_imagens ci
where ci.ean is not null
  and public.normalizar_ean_gtin(ci.ean) is not null
  and not exists (
    select 1 from public.catalogo_ean_conflitos c
    where c.ean_normalizado=public.normalizar_ean_gtin(ci.ean)
  )
on conflict (ean_normalizado) do update
set sku = excluded.sku, origem = excluded.origem;

create or replace function public.bloquear_ean_catalogo_duplicado()
returns trigger language plpgsql set search_path = '' as $$
declare v_ean text;
begin
  v_ean := public.normalizar_ean_gtin(new.ean);
  if v_ean is not null and exists (
    select 1 from public.catalogo_imagens ci
    where ci.sku <> new.sku
      and public.normalizar_ean_gtin(ci.ean) = v_ean
  ) then
    raise exception 'EAN % já está associado a outro SKU do catálogo; revise o conflito antes de salvar', v_ean
      using errcode = '23505';
  end if;
  return new;
end;
$$;
drop trigger if exists bloquear_ean_catalogo_duplicado on public.catalogo_imagens;
create trigger bloquear_ean_catalogo_duplicado
  before insert or update of ean, sku on public.catalogo_imagens
  for each row execute function public.bloquear_ean_catalogo_duplicado();

create or replace function public.normalizar_ean_catalogo_trigger()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ean text;
begin
  if new.ean is null or pg_catalog.btrim(new.ean) = '' then
    new.ean := null;
    return new;
  end if;
  v_ean := public.normalizar_ean_gtin(new.ean);
  if v_ean is null then
    raise exception 'EAN inválido no catálogo: informe GTIN-8, GTIN-12, GTIN-13 ou GTIN-14 com dígito verificador válido.'
      using errcode = '22023';
  end if;
  new.ean := v_ean;
  return new;
end;
$$;
drop trigger if exists normalizar_ean_catalogo on public.catalogo_imagens;
create trigger normalizar_ean_catalogo
  before insert or update of ean on public.catalogo_imagens
  for each row execute function public.normalizar_ean_catalogo_trigger();

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
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_ean text;
begin
  if new.ean is not null and pg_catalog.btrim(new.ean) <> '' then
    v_ean := public.normalizar_ean_gtin(new.ean);
    if v_ean is null then
      raise exception 'EAN inválido no envio: informe GTIN-8, GTIN-12, GTIN-13 ou GTIN-14 com dígito verificador válido.'
        using errcode = '22023';
    end if;
    new.ean := v_ean;
  else
    new.ean := null;
  end if;
  return new;
end;
$$;
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

create or replace function public.marcar_vinculo_catalogo_manual()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.catalogo_sku is distinct from old.catalogo_sku
     and pg_catalog.pg_trigger_depth() <= 1
     and public.is_catalog_admin()
     and coalesce(pg_catalog.current_setting('app.catalog_ean_link', true), 'off') <> 'on' then
    new.vinculo_origem := 'manual';
  end if;
  return new;
end;
$$;
drop trigger if exists marcar_vinculo_catalogo_manual on public.materiais;
create trigger marcar_vinculo_catalogo_manual
  before update of catalogo_sku on public.materiais
  for each row execute function public.marcar_vinculo_catalogo_manual();

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
  perform pg_catalog.set_config('app.catalog_ean_link', 'on', true);
  update public.materiais m
    set catalogo_sku = e.sku, vinculo_origem = 'ean'
    from public.catalogo_eans e
    where m.id = p_material_id
      and m.ean = e.ean_normalizado
      and m.catalogo_sku is null
      and coalesce(m.vinculo_origem, '') <> 'manual'
    returning e.sku into v_sku;
  perform pg_catalog.set_config('app.catalog_ean_link', 'off', true);
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

  perform pg_catalog.set_config('app.catalog_ean_link', 'on', true);
  update public.materiais m
    set catalogo_sku = e.sku, vinculo_origem = 'ean'
    from public.catalogo_eans e
    where m.ean = e.ean_normalizado
      and m.catalogo_sku is null
      and coalesce(m.vinculo_origem, '') <> 'manual';
  perform pg_catalog.set_config('app.catalog_ean_link', 'off', true);
  get diagnostics vinculados = row_count;

  select count(*) into sem_correspondencia
  from public.materiais m
  where m.ean is not null
    and m.catalogo_sku is null
    and coalesce(m.vinculo_origem, '') <> 'manual'
    and not exists (select 1 from public.catalogo_eans e where e.ean_normalizado = m.ean);

  select
    (select count(*) from public.catalogo_ean_conflitos)
    + (select count(*) from (
      select m.ean from public.materiais m
      where m.ean is not null and m.catalogo_sku is null
        and coalesce(m.vinculo_origem, '') <> 'manual'
      group by m.ean having count(*) > 1
    ) d)
  into conflitos;
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
  perform pg_catalog.set_config('app.catalog_ean_link', 'on', true);
  update public.materiais m
    set catalogo_sku = new.sku, vinculo_origem = 'ean'
    where m.ean = new.ean_normalizado
      and m.catalogo_sku is null
      and coalesce(m.vinculo_origem, '') <> 'manual';
  perform pg_catalog.set_config('app.catalog_ean_link', 'off', true);
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

create or replace function public.aprovar_envio(p_envio_id uuid)
returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
  envio public.envios_pendentes%rowtype;
  loja_id_encontrada uuid;
  material_id_encontrado uuid;
  candidatos uuid[];
  erro text;
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(610100000);
  select * into envio from public.envios_pendentes
    where id = p_envio_id for update;
  if not found then raise exception 'Envio não encontrado'; end if;
  if envio.status <> 'pendente' then return; end if;

  if envio.ean is not null then
    envio.ean := public.normalizar_ean_gtin(envio.ean);
    if envio.ean is null then
      raise exception 'EAN inválido no envio; corrija o código de barras antes de aprovar.'
        using errcode = '22023';
    end if;
  end if;

  -- EAN takes priority even when the submitted name is different.
  if envio.ean is not null then
    select pg_catalog.array_agg(id order by created_at, id)
      into candidatos from public.materiais where ean = envio.ean;
    if pg_catalog.cardinality(candidatos) > 1 then
      erro := 'EAN duplicado em materiais; revise os cadastros antes de aprovar';
    else
      material_id_encontrado := candidatos[1];
    end if;
  end if;

  if material_id_encontrado is null and erro is null then
    select pg_catalog.array_agg(id order by created_at, id)
      into candidatos from public.materiais
      where public.normalizar_nome_material(nome)
        = public.normalizar_nome_material(envio.nome_produto);

    if envio.ean is not null and exists (
      select 1 from public.materiais
      where id = any(candidatos)
        and ean is not null and ean <> envio.ean
    ) then
      erro := 'nome igual a um material existente, mas com EAN diferente';
    elsif pg_catalog.cardinality(candidatos) > 1 then
      erro := 'Mais de um material com o mesmo nome normalizado; revisão necessária';
    else
      material_id_encontrado := candidatos[1];
    end if;
  end if;

  if erro is not null then
    update public.envios_pendentes set erro_aprovacao = erro
      where id = envio.id;
    return;
  end if;

  if material_id_encontrado is null then
    insert into public.materiais(nome, categoria, unidade_medida, ean)
      values(envio.nome_produto, envio.categoria, envio.unidade_medida, envio.ean)
      returning id into material_id_encontrado;
  elsif envio.ean is not null then
    update public.materiais set ean = envio.ean
      where id = material_id_encontrado and ean is null;
  end if;

  select id into loja_id_encontrada from public.lojas
    where lower(trim(nome)) = lower(trim(envio.nome_loja))
      and lower(trim(cidade)) = lower(trim(envio.cidade))
    order by created_at, id limit 1;
  if loja_id_encontrada is null then
    insert into public.lojas(nome,cidade,contato,frete_fixo,frete_gratis_acima)
      values(envio.nome_loja,envio.cidade,envio.contato,
             envio.frete_fixo,envio.frete_gratis_acima)
      returning id into loja_id_encontrada;
  else
    update public.lojas set
      frete_fixo = coalesce(envio.frete_fixo, frete_fixo),
      frete_gratis_acima = coalesce(envio.frete_gratis_acima, frete_gratis_acima)
      where id = loja_id_encontrada;
  end if;

  update public.precos set valor = envio.preco,
    data_atualizacao = now(), atualizado_por = auth.uid()
    where material_id = material_id_encontrado and loja_id = loja_id_encontrada;
  if not found then
    insert into public.precos(material_id,loja_id,valor,atualizado_por)
      values(material_id_encontrado,loja_id_encontrada,envio.preco,auth.uid());
  end if;

  insert into public.buscas_imagem_ean(material_id,ean)
    select id, ean from public.materiais
    where id = material_id_encontrado and ean is not null
      and imagem_ean_url is null
    on conflict (material_id) do update set
      ean = excluded.ean, status = 'pendente', lease_token = null,
      ultimo_erro = null, atualizado_em = now()
      where public.buscas_imagem_ean.ean <> excluded.ean;

  update public.envios_pendentes
    set status = 'aprovado', erro_aprovacao = null where id = envio.id;
end;
$$;
revoke all on function public.aprovar_envio(uuid) from public, anon;
grant execute on function public.aprovar_envio(uuid) to authenticated;

commit;

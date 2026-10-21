begin;
do $$ begin
  if not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'materiais' and column_name = 'imagem_ean_url')
    or not exists (select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'lojas' and column_name = 'slug') then
    raise exception 'Aplique primeiro as migrações de slugs e imagens por categoria.';
  end if;
end; $$;


alter table public.envios_pendentes
  add column if not exists ean text,
  add column if not exists erro_aprovacao text;
alter table public.envios_pendentes
  drop constraint if exists envios_pendentes_ean_formato_check;
alter table public.envios_pendentes
  add constraint envios_pendentes_ean_formato_check check (
    ean is null or ean ~ '^([0-9]{8}|[0-9]{12}|[0-9]{13}|[0-9]{14})$'
  );
grant insert (ean) on public.envios_pendentes to anon, authenticated;
grant select (ean, erro_aprovacao) on public.envios_pendentes to authenticated;

-- Prerequisites: slugs, category images (imagem_ean_url).
-- Also run the duplicate diagnostic separately BEFORE applying this migration.
-- Explicitly preserve UPDATE permission even on column-scoped installations.
grant update (erro_aprovacao) on public.envios_pendentes to authenticated;

-- Read-only diagnostic before attempting a unique index.
lock table public.materiais in share row exclusive mode;
select ean, count(*) from public.materiais
where ean is not null group by ean having count(*) > 1;
do $$
begin
  if not exists (
    select 1 from public.materiais where ean is not null
    group by ean having count(*) > 1
  ) then
    create unique index if not exists materiais_ean_unique
      on public.materiais (ean) where ean is not null;
  else
    raise warning 'EANs duplicados: índice único não criado; revisão manual necessária.';
  end if;
end;
$$;

-- Reuse this normalization in both sides of the name lookup.
create or replace function public.normalizar_nome_material(valor text)
returns text language sql immutable strict set search_path = '' as $$
  select pg_catalog.btrim(pg_catalog.regexp_replace(
    pg_catalog.translate(pg_catalog.lower(valor),
      'áàâãäéèêëíìîïóòôõöúùûüç', 'aaaaaeeeeiiiiooooouuuuc'),
    '[[:space:]]+', ' ', 'g'));
$$;
revoke all on function public.normalizar_nome_material(text) from public, anon;
grant execute on function public.normalizar_nome_material(text) to authenticated;

-- Durable jobs, one per material. No public writes or public reads.
create table if not exists public.buscas_imagem_ean (
  material_id uuid primary key references public.materiais(id) on delete cascade,
  ean text not null,
  status text not null default 'pendente'
    check (status in ('pendente','processando','concluido','sem_imagem','erro')),
  tentativas integer not null default 0,
  ultimo_erro text,
  atualizado_em timestamptz not null default now(),
  lease_token uuid
);
alter table public.buscas_imagem_ean add column if not exists lease_token uuid;
alter table public.buscas_imagem_ean enable row level security;
revoke all on public.buscas_imagem_ean from anon;
grant select, insert, update, delete on public.buscas_imagem_ean to authenticated;
drop policy if exists "Authenticated manage EAN image jobs" on public.buscas_imagem_ean;
create policy "Authenticated manage EAN image jobs"
  on public.buscas_imagem_ean for all to authenticated
  using (true) with check (true);

create or replace function public.aprovar_envio(p_envio_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
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

  -- Persist the conflict without raising: an exception would undo this message.
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

  -- The external request happens only after commit, never inside this function.
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

-- One active request globally, across all serverless instances.
-- Every claim is bounded by a three-minute lease, and carries a fencing token.
create or replace function public.reservar_busca_imagem_ean()
returns setof public.buscas_imagem_ean
language plpgsql security invoker set search_path = '' as $$
declare job public.buscas_imagem_ean%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(610100001) then return; end if;
  update public.buscas_imagem_ean set status = 'pendente', lease_token = null,
    ultimo_erro = 'Processamento interrompido; disponível para nova tentativa',
    atualizado_em = now()
    where status = 'processando' and atualizado_em < now() - interval '3 minutes';
  if exists (select 1 from public.buscas_imagem_ean where status = 'processando')
    or exists (select 1 from public.buscas_imagem_ean
      where tentativas > 0 and atualizado_em > now() - interval '1 second') then return; end if;
  select * into job from public.buscas_imagem_ean where status = 'pendente'
    order by atualizado_em, material_id limit 1 for update skip locked;
  if not found then return; end if;
  return query update public.buscas_imagem_ean
    set status = 'processando', tentativas = tentativas + 1,
        lease_token = pg_catalog.gen_random_uuid(), atualizado_em = now()
    where material_id = job.material_id returning *;
end;
$$;

create or replace function public.concluir_busca_imagem_ean(
  p_material_id uuid, p_token uuid, p_url text, p_erro text
) returns boolean language plpgsql security invoker set search_path = '' as $$
declare job public.buscas_imagem_ean%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  perform pg_catalog.pg_advisory_xact_lock(610100001);
  select * into job from public.buscas_imagem_ean
    where material_id = p_material_id for update;
  if not found or job.status <> 'processando' or job.lease_token is distinct from p_token
    or job.atualizado_em < now() - interval '3 minutes' then return false; end if;
  if p_url is not null and p_url !~ '^https?://' then
    raise exception 'URL inválida';
  end if;
  if p_url is not null then
    update public.materiais set imagem_ean_url = coalesce(imagem_ean_url, p_url)
      where id = job.material_id and ean = job.ean;
    if not found then
      update public.buscas_imagem_ean set status = 'erro',
        ultimo_erro = 'Material removido ou EAN alterado; revise antes de tentar novamente',
        lease_token = null, atualizado_em = now() where material_id = job.material_id;
      return false;
    end if;
  end if;
  update public.buscas_imagem_ean set
    status = case when p_erro is not null then 'erro'
                  when p_url is not null then 'concluido' else 'sem_imagem' end,
    ultimo_erro = left(p_erro, 300), lease_token = null, atualizado_em = now()
    where material_id = job.material_id;
  return true;
end;
$$;
revoke all on function public.reservar_busca_imagem_ean() from public, anon;
revoke all on function public.concluir_busca_imagem_ean(uuid,uuid,text,text) from public, anon;
grant execute on function public.reservar_busca_imagem_ean() to authenticated;
grant execute on function public.concluir_busca_imagem_ean(uuid,uuid,text,text) to authenticated;

commit;


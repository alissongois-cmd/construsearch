-- Public submissions stay private until an authenticated administrator approves them.
create table if not exists public.envios_pendentes (
  id uuid primary key default gen_random_uuid(),
  nome_loja text not null check (length(trim(nome_loja)) between 1 and 160),
  cidade text not null check (length(trim(cidade)) between 1 and 160),
  contato text check (contato is null or length(contato) <= 160),
  nome_produto text not null check (length(trim(nome_produto)) between 1 and 160),
  categoria text not null check (length(trim(categoria)) between 1 and 160),
  unidade_medida text not null check (length(trim(unidade_medida)) between 1 and 160),
  preco numeric(12, 2) not null check (preco >= 0),
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'rejeitado')),
  created_at timestamptz not null default now()
);
create index if not exists envios_pendentes_status_created_idx
  on public.envios_pendentes (created_at) where status = 'pendente';

alter table public.envios_pendentes enable row level security;
revoke all on public.envios_pendentes from anon;
grant insert (nome_loja, cidade, contato, nome_produto, categoria, unidade_medida, preco)
  on public.envios_pendentes to anon;
grant select, insert, update, delete on public.envios_pendentes to authenticated;

drop policy if exists "Public can submit pending products" on public.envios_pendentes;
create policy "Public can submit pending products" on public.envios_pendentes
  for insert to anon, authenticated with check (status = 'pendente');
drop policy if exists "Authenticated users can read submissions" on public.envios_pendentes;
create policy "Authenticated users can read submissions" on public.envios_pendentes
  for select to authenticated using (true);
drop policy if exists "Authenticated users can update submissions" on public.envios_pendentes;
create policy "Authenticated users can update submissions" on public.envios_pendentes
  for update to authenticated using (true) with check (true);
drop policy if exists "Authenticated users can delete submissions" on public.envios_pendentes;
create policy "Authenticated users can delete submissions" on public.envios_pendentes
  for delete to authenticated using (true);

-- SECURITY INVOKER preserves the existing authenticated-user RLS rules.
-- All publication writes and the status transition commit or roll back together.
create or replace function public.aprovar_envio(p_envio_id uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare
  envio public.envios_pendentes%rowtype;
  loja_id_encontrada uuid;
  material_id_encontrado uuid;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  -- Serialize approvals, including two different submissions for the same product/shop.
  perform pg_catalog.pg_advisory_xact_lock(610100000);
  select * into envio from public.envios_pendentes where id = p_envio_id for update;
  if not found then raise exception 'Envio não encontrado'; end if;
  if envio.status <> 'pendente' then return; end if;

  select id into loja_id_encontrada from public.lojas
    where lower(trim(nome)) = lower(trim(envio.nome_loja))
      and lower(trim(cidade)) = lower(trim(envio.cidade))
    order by created_at, id limit 1;
  if loja_id_encontrada is null then
    insert into public.lojas (nome, cidade, contato)
      values (envio.nome_loja, envio.cidade, envio.contato) returning id into loja_id_encontrada;
  end if;

  select id into material_id_encontrado from public.materiais
    where lower(trim(nome)) = lower(trim(envio.nome_produto))
    order by created_at, id limit 1;
  if material_id_encontrado is null then
    insert into public.materiais (nome, categoria, unidade_medida)
      values (envio.nome_produto, envio.categoria, envio.unidade_medida)
      returning id into material_id_encontrado;
  end if;

  update public.precos set valor = envio.preco, data_atualizacao = now(), atualizado_por = auth.uid()
    where material_id = material_id_encontrado and loja_id = loja_id_encontrada;
  if not found then
    insert into public.precos (material_id, loja_id, valor, atualizado_por)
      values (material_id_encontrado, loja_id_encontrada, envio.preco, auth.uid());
  end if;
  update public.envios_pendentes set status = 'aprovado' where id = envio.id;
end;
$$;
revoke all on function public.aprovar_envio(uuid) from public, anon;
grant execute on function public.aprovar_envio(uuid) to authenticated;

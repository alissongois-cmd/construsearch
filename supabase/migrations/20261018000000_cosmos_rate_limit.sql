-- Apply after 20261017000000_tolerant_submission_ean.sql, before deploying this version.
begin;
create table if not exists public.cosmos_limite (
  id boolean primary key default true check (id),
  estado text not null default 'limite_atingido' check (estado = 'limite_atingido'),
  atingido_em timestamptz not null,
  bloqueado_ate timestamptz not null,
  mensagem text not null,
  cabecalhos jsonb not null default '{}'::jsonb
);
alter table public.cosmos_limite enable row level security;
revoke all on public.cosmos_limite from anon;
grant select, insert, update on public.cosmos_limite to authenticated;
drop policy if exists "Authenticated manage Cosmos limit" on public.cosmos_limite;
create policy "Authenticated manage Cosmos limit" on public.cosmos_limite
  for all to authenticated using (true) with check (true);

create or replace function public.registrar_limite_cosmos(
  p_material_id uuid, p_token uuid, p_bloqueado_ate timestamptz,
  p_mensagem text, p_cabecalhos jsonb
) returns void language plpgsql security invoker set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  perform pg_catalog.pg_advisory_xact_lock(610100001);
  insert into public.cosmos_limite(id, atingido_em, bloqueado_ate, mensagem, cabecalhos)
    values (true, now(), greatest(now() + interval '1 second', coalesce(p_bloqueado_ate, now() + interval '1 hour')),
      coalesce(p_mensagem, ''), coalesce(p_cabecalhos, '{}'::jsonb))
    on conflict (id) do update set atingido_em = excluded.atingido_em,
      bloqueado_ate = greatest(public.cosmos_limite.bloqueado_ate, excluded.bloqueado_ate),
      mensagem = excluded.mensagem, cabecalhos = excluded.cabecalhos;
  -- The reservation counted the call; a 429 must refund it and preserve the job.
  -- Fencing prevents a late response from touching a newer reservation.
  update public.buscas_imagem_ean set status = 'pendente',
    tentativas = greatest(0, tentativas - 1), lease_token = null,
    ultimo_erro = null, atualizado_em = now()
    where material_id = p_material_id and status = 'processando' and lease_token = p_token;
end;
$$;
revoke all on function public.registrar_limite_cosmos(uuid,uuid,timestamptz,text,jsonb) from public, anon;
grant execute on function public.registrar_limite_cosmos(uuid,uuid,timestamptz,text,jsonb) to authenticated;

create or replace function public.reservar_busca_imagem_ean()
returns setof public.buscas_imagem_ean
language plpgsql security invoker set search_path = '' as $$
declare job public.buscas_imagem_ean%rowtype;
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória'; end if;
  if not pg_catalog.pg_try_advisory_xact_lock(610100001) then return; end if;
  -- Authoritative server-side circuit breaker: not merely a disabled browser button.
  if exists (select 1 from public.cosmos_limite where bloqueado_ate > now()) then return; end if;
  update public.buscas_imagem_ean set status = 'pendente', lease_token = null,
    ultimo_erro = 'Processamento interrompido; disponível para nova tentativa', atualizado_em = now()
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
revoke all on function public.reservar_busca_imagem_ean() from public, anon;
grant execute on function public.reservar_busca_imagem_ean() to authenticated;
commit;

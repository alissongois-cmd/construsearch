-- Optional estimates; existing rows retain NULL and their previous totals.
alter table public.lojas
  add column if not exists frete_fixo numeric(12,2),
  add column if not exists frete_gratis_acima numeric(12,2);
alter table public.envios_pendentes
  add column if not exists frete_fixo numeric(12,2),
  add column if not exists frete_gratis_acima numeric(12,2);

alter table public.lojas drop constraint if exists lojas_shipping_check;
alter table public.lojas add constraint lojas_shipping_check check (
  (frete_fixo is null or (frete_fixo >= 0 and frete_fixo <> 'NaN'::numeric)) and
  (frete_gratis_acima is null or (frete_gratis_acima >= 0 and frete_gratis_acima <> 'NaN'::numeric))
);
alter table public.envios_pendentes drop constraint if exists envios_shipping_check;
alter table public.envios_pendentes add constraint envios_shipping_check check (
  (frete_fixo is null or (frete_fixo >= 0 and frete_fixo <> 'NaN'::numeric)) and
  (frete_gratis_acima is null or (frete_gratis_acima >= 0 and frete_gratis_acima <> 'NaN'::numeric))
);
-- Anonymous INSERT is column-scoped; explicitly allow the new fields.
grant insert (frete_fixo, frete_gratis_acima) on public.envios_pendentes to anon;

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
    insert into public.lojas (nome, cidade, contato, frete_fixo, frete_gratis_acima)
      values (envio.nome_loja, envio.cidade, envio.contato, envio.frete_fixo, envio.frete_gratis_acima) returning id into loja_id_encontrada;
  else
    -- Blank fields on later submissions preserve the existing shop settings.
    update public.lojas set
      frete_fixo = coalesce(envio.frete_fixo, frete_fixo),
      frete_gratis_acima = coalesce(envio.frete_gratis_acima, frete_gratis_acima)
      where id = loja_id_encontrada;
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

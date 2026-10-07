-- Schema inicial do Comparador de Materiais.
-- Esta migração deve ser executada no banco PostgreSQL do projeto Supabase.

create table public.materiais (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria text not null,
  unidade_medida text not null,
  created_at timestamptz not null default now()
);

create table public.lojas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  cidade text not null,
  contato text,
  created_at timestamptz not null default now()
);

create table public.precos (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materiais (id),
  loja_id uuid not null references public.lojas (id),
  valor numeric(12, 2) not null check (valor >= 0),
  data_atualizacao timestamptz not null default now(),
  atualizado_por uuid references auth.users (id) on delete set null
);

create index precos_material_id_idx on public.precos (material_id);
create index precos_loja_id_idx on public.precos (loja_id);

alter table public.materiais enable row level security;
alter table public.lojas enable row level security;
alter table public.precos enable row level security;

-- Permissões: visitantes podem ler; apenas o papel authenticated pode escrever.
grant select on table public.materiais, public.lojas, public.precos to anon, authenticated;
grant insert, update, delete on table public.materiais, public.lojas, public.precos to authenticated;
revoke insert, update, delete on table public.materiais, public.lojas, public.precos from anon;

create policy "Public can read materiais"
  on public.materiais
  for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can insert materiais"
  on public.materiais
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update materiais"
  on public.materiais
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete materiais"
  on public.materiais
  for delete
  to authenticated
  using (true);

create policy "Public can read lojas"
  on public.lojas
  for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can insert lojas"
  on public.lojas
  for insert
  to authenticated
  with check (true);

create policy "Authenticated users can update lojas"
  on public.lojas
  for update
  to authenticated
  using (true)
  with check (true);

create policy "Authenticated users can delete lojas"
  on public.lojas
  for delete
  to authenticated
  using (true);

create policy "Public can read precos"
  on public.precos
  for select
  to anon, authenticated
  using (true);

create policy "Authenticated users can insert precos"
  on public.precos
  for insert
  to authenticated
  with check (atualizado_por is null or atualizado_por = auth.uid());

create policy "Authenticated users can update precos"
  on public.precos
  for update
  to authenticated
  using (true)
  with check (atualizado_por is null or atualizado_por = auth.uid());

create policy "Authenticated users can delete precos"
  on public.precos
  for delete
  to authenticated
  using (true);

begin;
alter table public.materiais add column if not exists imagem_ean_url text;
create table if not exists public.categorias_imagens (
  categoria_chave text primary key check (categoria_chave <> ''),
  nome text not null,
  imagem_url text
);
alter table public.categorias_imagens enable row level security;
grant select on public.categorias_imagens to anon, authenticated;
grant insert, update, delete on public.categorias_imagens to authenticated;
drop policy if exists "Public can read category images" on public.categorias_imagens;
create policy "Public can read category images" on public.categorias_imagens
for select to anon, authenticated using (true);
drop policy if exists "Authenticated users can manage category images" on public.categorias_imagens;
create policy "Authenticated users can manage category images" on public.categorias_imagens
for all to authenticated using (true) with check (true);
-- Existing imagem_url values remain untouched; their provenance was not stored.
commit;

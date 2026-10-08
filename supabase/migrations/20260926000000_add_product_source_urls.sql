-- Metadados coletados das páginas públicas dos produtos.
alter table public.precos
  add column if not exists url_imagem text,
  add column if not exists url_produto text;

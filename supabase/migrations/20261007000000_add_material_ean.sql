-- Optional GTIN/EAN used to enrich materials through the Bluesoft Cosmos API.

alter table public.materiais
  add column if not exists ean text;

create index if not exists materiais_ean_idx
  on public.materiais (ean)
  where ean is not null;

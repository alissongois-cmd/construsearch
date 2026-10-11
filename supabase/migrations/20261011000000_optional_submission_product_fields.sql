-- Preserve the existing table, permissions and approval function. Optional fields
-- are stored as empty strings, also accepted by the materiais table on approval.
alter table public.envios_pendentes
  drop constraint if exists envios_pendentes_categoria_check,
  drop constraint if exists envios_pendentes_unidade_medida_check;
alter table public.envios_pendentes
  add constraint envios_pendentes_categoria_check check (length(categoria) <= 160),
  add constraint envios_pendentes_unidade_medida_check check (length(unidade_medida) <= 160);

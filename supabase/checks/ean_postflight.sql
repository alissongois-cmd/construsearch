-- Run SEPARATELY after the EAN submissions migration.
select indexname from pg_indexes
where schemaname = 'public' and indexname = 'materiais_ean_unique';

select
  has_function_privilege('authenticated', 'public.aprovar_envio(uuid)', 'EXECUTE') as authenticated_can_approve,
  has_function_privilege('anon', 'public.aprovar_envio(uuid)', 'EXECUTE') as anon_can_approve,
  has_column_privilege('authenticated', 'public.envios_pendentes', 'erro_aprovacao', 'UPDATE') as authenticated_can_record_error;
-- Expected: one index row (when preflight has no duplicates), then true / false / true.

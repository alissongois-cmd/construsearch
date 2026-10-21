-- Explicit access for the catalog allowlist; keep existing policies and the
-- proteger_vinculo_catalogo trigger that protects this column for other users.
begin;
drop policy if exists "Catalog admins update materiais" on public.materiais;
create policy "Catalog admins update materiais" on public.materiais
for update to authenticated
using (public.is_catalog_admin())
with check (public.is_catalog_admin());
commit;

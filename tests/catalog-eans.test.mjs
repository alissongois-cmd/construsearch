import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { normalizeEAN } from "../src/lib/ean.ts";

test("normaliza GTIN-8/12/13/14 para GTIN-14 preservando zeros", () => {
  assert.equal(normalizeEAN("96385074"), "00000096385074");
  assert.equal(normalizeEAN("012345678905"), "00012345678905");
  assert.equal(normalizeEAN("4006381333931"), "04006381333931");
  assert.equal(normalizeEAN("04006381333931"), "04006381333931");
  assert.equal(normalizeEAN("400-638-133-3931"), "04006381333931");
});

test("rejeita EAN inválido e dígito verificador incorreto", () => {
  assert.throws(() => normalizeEAN("4006381333932"), /dígito verificador/i);
  assert.throws(() => normalizeEAN("123456789"), /8, 12, 13 ou 14/);
});

test("vazio continua opcional", () => {
  assert.equal(normalizeEAN(""), null);
});

test("migration preserves invalid legacy EANs before normalizing columns", () => {
  const sql = readFileSync(new URL("../supabase/migrations/20261025000000_catalog_eans_auto_link.sql", import.meta.url), "utf8");
  const materialBackup = sql.indexOf("insert into private.materiais_ean_invalidos_backup");
  const materialUpdate = sql.indexOf("update public.materiais set ean");
  const catalogBackup = sql.indexOf("insert into private.catalogo_imagens_ean_invalidos_backup");
  const catalogUpdate = sql.indexOf("update public.catalogo_imagens");
  assert.ok(materialBackup >= 0 && materialBackup < materialUpdate);
  assert.ok(catalogBackup >= 0 && catalogBackup < catalogUpdate);
  assert.match(sql, /normalizar_ean_envio_trigger[\s\S]*?as \$\$/);
  assert.match(sql, /normalizar_ean_catalogo_trigger[\s\S]*?before insert or update of ean on public\.catalogo_imagens/i);
  assert.match(sql, /marcar_vinculo_catalogo_manual[\s\S]*?pg_trigger_depth\(\) <= 1[\s\S]*?vinculo_origem := 'manual'/);
  assert.match(sql, /current_setting\('app\.catalog_ean_link'/);
});

import test from "node:test";
import assert from "node:assert/strict";
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

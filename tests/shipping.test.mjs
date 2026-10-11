import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

function load(path, dependencies = {}) {
  const exports = {};
  const code = ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText;
  runInNewContext(code, { exports, Error, require: (name) => dependencies[name] });
  return exports;
}
const shipping = load("../src/lib/shipping.ts");
const { rankStores } = load("../src/lib/shopping-list.ts", { "./shipping": shipping });

test("shipping handles absent fields, fixed fees, free thresholds and numeric strings", () => {
  const estimate = shipping.shippingEstimate;
  assert.equal(estimate(100, { frete_fixo: null, frete_gratis_acima: null }), null);
  assert.equal(estimate(100, { frete_fixo: "25.50", frete_gratis_acima: null }), 25.5);
  assert.equal(estimate(199.99, { frete_fixo: 25, frete_gratis_acima: 200 }), 25);
  assert.equal(estimate(200, { frete_fixo: 25, frete_gratis_acima: "200" }), 0);
  assert.equal(estimate(201, { frete_fixo: 25, frete_gratis_acima: 200 }), 0);
  assert.equal(estimate(50, { frete_fixo: null, frete_gratis_acima: 200 }), null);
  assert.equal(estimate(200, { frete_fixo: null, frete_gratis_acima: 200 }), 0);
  assert.equal(estimate(1, { frete_fixo: 0, frete_gratis_acima: null }), 0);
  assert.equal(estimate(0, { frete_fixo: 25, frete_gratis_acima: 0 }), 0);
  assert.equal(estimate(0.1 + 0.2, { frete_fixo: 25, frete_gratis_acima: 0.3 }), 0);
});

test("ranking applies quantities and shipping once and uses final totals", () => {
  const offer = (storeId, price, frete_fixo, frete_gratis_acima = null) => ({ storeId, store: storeId, city: "Cidade", price, frete_fixo, frete_gratis_acima });
  const items = [
    { id: "x", name: "Cimento", quantity: 2, offers: [offer("a", 20, 30, 100), offer("b", 25, null), offer("c", 1, 0)] },
    { id: "y", name: "Areia", quantity: 1, offers: [offer("a", 10, 30, 100), offer("b", 15, null)] },
  ];
  const totals = rankStores(items);
  assert.equal(totals.find((entry) => entry.id === "b").total, 65);
  assert.equal(totals.find((entry) => entry.id === "b").shipping, null);
  const a = totals.find((entry) => entry.id === "a");
  assert.equal(a.subtotal, 50);
  assert.equal(a.total, 80);
  assert.equal(a.shipping, 30);
  assert.equal(totals.find((entry) => entry.id === "c").missing[0], "Areia");
  assert.ok(totals.findIndex((entry) => entry.id === "b") < totals.findIndex((entry) => entry.id === "a"));
  const free = rankStores([{ ...items[0], quantity: 5 }]).find((entry) => entry.id === "a");
  assert.equal(free.total, 100);
  assert.equal(free.shipping, 0);
});

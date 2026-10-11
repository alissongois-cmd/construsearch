import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';

const source = ts.transpileModule(readFileSync(new URL('../src/lib/shopping-list.ts', import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 } }).outputText;
const { rankStores } = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const offer = (storeId, price) => ({ storeId, store: storeId, city: 'Cidade', price });
const items = [
  { id: 'cement', name: 'Cimento', quantity: 2, offers: [offer('complete', 10), offer('partial', 1), offer('tie', 10)] },
  { id: 'mortar', name: 'Argamassa', quantity: 3, offers: [offer('complete', 5), offer('tie', 5)] },
];
test('orders totals while identifying missing materials and cheapest complete ties', () => {
  const ranked = rankStores(items);
  assert.deepEqual(ranked.map(({ total, missing }) => ({ total, missing })), [
    { total: 2, missing: ['Argamassa'] }, { total: 35, missing: [] }, { total: 35, missing: [] },
  ]);
  assert.equal(ranked.find(store => !store.missing.length).total, 35);
});
test('quantity changes, removal, and fractional currency totals', () => {
  assert.equal(rankStores([{ ...items[0], quantity: 4 }]).find(store => store.id === 'complete').total, 40);
  assert.deepEqual(rankStores([items[0]]).map(store => store.missing), [[], [], []]);
  assert.equal(rankStores([{ ...items[0], quantity: 3, offers: [offer('decimal', 0.1)] }])[0].total, 0.3);
});
test('materials without prices prevent complete coverage; empty list has no stores', () => {
  assert.deepEqual(rankStores([]), []);
  assert.deepEqual(rankStores([{ ...items[0], offers: [] }]), []);
  assert.ok(rankStores([...items, { id: 'unpriced', name: 'Tinta', quantity: 1, offers: [] }]).every(store => store.missing.includes('Tinta')));
});

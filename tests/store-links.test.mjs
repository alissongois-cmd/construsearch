import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";
import { PGlite } from "@electric-sql/pglite";

const exports = {};
runInNewContext(ts.transpileModule(readFileSync("src/lib/store-links.ts", "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText, { exports, URL });

test("store links match normalized names, prefer slugs and reject ambiguous names", () => {
  const stores = [
    { id: "1", nome: "Depósito São João", slug: "deposito-1" },
    { id: "2", nome: "Casa Central", slug: "casa-2" },
    { id: "3", nome: "Casa Central", slug: "casa-3" },
  ];
  assert.equal(exports.matchStore(stores, "depósito são joão").id, "1");
  assert.equal(exports.matchStore(stores, "deposito-sao-joao").id, "1");
  assert.equal(exports.matchStore(stores, "casa-3").id, "3");
  assert.equal(exports.matchStore(stores, "casa-central"), null);
  assert.equal(exports.matchStore(stores, "inexistente"), null);
  assert.equal(exports.matchStore(stores, "---"), null);
  assert.equal(exports.submissionUrl("https://example.com/base", "deposito-1"), "https://example.com/cadastrar-produto?loja=deposito-1");
  assert.equal(exports.submissionUrl("http://localhost:3000", "a b"), "http://localhost:3000/cadastrar-produto?loja=a+b");
  assert.throws(() => exports.submissionUrl("http://example.com", "a"));
});

test("slug migration fills existing stores, handles duplicates and preserves printed links on rename/reapply", async () => {
  const db = new PGlite();
  try {
    await db.exec("create table public.lojas (id uuid primary key default gen_random_uuid(), nome text not null); insert into public.lojas(nome) values ('Depósito São João'), ('Depósito São João')");
    const migration = readFileSync("supabase/migrations/20261015000000_add_store_slugs.sql", "utf8");
    await db.exec(migration);
    const rows = (await db.query("select * from public.lojas order by id")).rows;
    assert.notEqual(rows[0].slug, rows[1].slug);
    assert.match(rows[0].slug, /^deposito-sao-joao-/);
    await db.query("update public.lojas set nome='Nome novo' where id=$1", [rows[0].id]);
    await db.exec(migration);
    assert.equal((await db.query("select slug from public.lojas where id=$1", [rows[0].id])).rows[0].slug, rows[0].slug);
    await db.exec("insert into public.lojas(nome) values ('Nova loja')");
    assert.match((await db.query("select slug from public.lojas where nome='Nova loja'")).rows[0].slug, /^nova-loja-/);
    await assert.rejects(db.query("insert into public.lojas(nome,slug) values ('Duplicada',$1)", [rows[0].slug]));
  } finally { await db.close(); }
});

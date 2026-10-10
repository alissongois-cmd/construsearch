import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";

const migration = readFileSync(new URL("../supabase/migrations/20261010000000_create_envios_pendentes.sql", import.meta.url), "utf8");
const baseSchema = readFileSync(new URL("../supabase/migrations/20260919000000_create_comparador_materiais_schema.sql", import.meta.url), "utf8");
const userId = "11111111-1111-4111-8111-111111111111";

test("migration is repeatable; anonymous submissions remain private; moderation publishes atomically", async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated;
      create schema auth;
      create table auth.users (id uuid primary key);
      insert into auth.users values ('${userId}');
      create function auth.uid() returns uuid language sql as
        $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated;
      grant execute on function auth.uid() to anon, authenticated;
    `);
    await db.exec(baseSchema);
    await db.exec(migration);
    await db.exec(migration);
    await db.exec("set role anon");
    const insert = "insert into public.envios_pendentes (nome_loja,cidade,nome_produto,categoria,unidade_medida,preco) values ($1,$2,$3,'cimento','saco', $4)";
    await db.query(insert, ["Depósito", "São Paulo", "Cimento", 35.9]);
    for (const sql of [
      "select * from public.envios_pendentes",
      "update public.envios_pendentes set status = 'aprovado'",
      "delete from public.envios_pendentes",
      "select public.aprovar_envio(gen_random_uuid())",
      "insert into public.envios_pendentes (nome_loja,cidade,nome_produto,categoria,unidade_medida,preco,status) values ('x','x','x','x','x',1,'aprovado')",
    ]) await assert.rejects(db.exec(sql));
    assert.equal((await db.query("select count(*)::int as count from public.precos")).rows[0].count, 0);

    await db.exec(`reset role; set role authenticated; set "request.jwt.claim.sub" = '${userId}'`);
    const first = (await db.query("select * from public.envios_pendentes")).rows[0];
    assert.equal(first.status, "pendente");
    await db.query("select public.aprovar_envio($1)", [first.id]);
    await db.query("select public.aprovar_envio($1)", [first.id]);
    assert.equal((await db.query("select count(*)::int as count from public.precos")).rows[0].count, 1);
    assert.equal((await db.query("select status from public.envios_pendentes where id=$1", [first.id])).rows[0].status, "aprovado");

    await db.query(insert, [" DEPÓSITO ", " SÃO PAULO ", " CIMENTO ", 40]);
    const second = (await db.query("select id from public.envios_pendentes where status='pendente'")).rows[0].id;
    await db.query("select public.aprovar_envio($1)", [second]);
    for (const table of ["lojas", "materiais", "precos"]) {
      assert.equal((await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count, 1);
    }
    assert.equal(Number((await db.query("select valor from public.precos")).rows[0].valor), 40);

    await db.query(insert, ["Depósito", "Outra cidade", "Cimento", 50]);
    const third = (await db.query("select id from public.envios_pendentes where status='pendente'")).rows[0].id;
    await db.query("select public.aprovar_envio($1)", [third]);
    assert.equal((await db.query("select count(*)::int as count from public.lojas")).rows[0].count, 2);

    await db.query(insert, ["Rejeitado", "Cidade", "Produto rejeitado", 99]);
    const rejected = (await db.query("select id from public.envios_pendentes where status='pendente'")).rows[0].id;
    await db.query("update public.envios_pendentes set status='rejeitado' where id=$1 and status='pendente'", [rejected]);
    await db.query("select public.aprovar_envio($1)", [rejected]);
    assert.equal((await db.query("select status from public.envios_pendentes where id=$1", [rejected])).rows[0].status, "rejeitado");
    assert.equal((await db.query("select count(*)::int as count from public.materiais where nome='Produto rejeitado'")).rows[0].count, 0);

    await db.exec("reset role; alter table public.precos add constraint test_failure check (valor <> 777); set role authenticated");
    await db.query(insert, ["Rollback", "Cidade", "Rollback produto", 777]);
    const rollback = (await db.query("select id from public.envios_pendentes where status='pendente'")).rows[0].id;
    await assert.rejects(db.query("select public.aprovar_envio($1)", [rollback]));
    assert.equal((await db.query("select count(*)::int as count from public.lojas where nome='Rollback'")).rows[0].count, 0);
    assert.equal((await db.query("select count(*)::int as count from public.materiais where nome='Rollback produto'")).rows[0].count, 0);
    assert.equal((await db.query("select status from public.envios_pendentes where id=$1", [rollback])).rows[0].status, "pendente");
    await db.query("delete from public.envios_pendentes where id=$1", [rollback]);
    await db.exec(`set "request.jwt.claim.sub" = ''`);
    await assert.rejects(db.query("select public.aprovar_envio($1)", [first.id]));
  } finally { await db.close(); }
});

const actionSource = ts.transpileModule(readFileSync(new URL("../src/app/cadastrar-produto/actions.ts", import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS },
}).outputText;

function submissionAction(error = null) {
  const stored = [];
  const exports = {};
  runInNewContext(actionSource, {
    exports,
    require(name) {
      assert.equal(name, "@/lib/supabase/server");
      return { async createClient() { return { from(table) {
        assert.equal(table, "envios_pendentes");
        return { async insert(value) { stored.push(value); return { error }; } };
      } }; } };
    },
  });
  return { submit: exports.submitProduct, stored };
}

function validForm() {
  const form = new FormData();
  for (const [key, value] of Object.entries({ nome_loja: " Depósito ", cidade: "Cidade", nome_produto: "Cimento", categoria: "cimento", unidade_medida: "saco", preco: "35,90" })) form.set(key, value);
  return form;
}

test("public action validates fields and price, discards honeypot, and confirms only successful inserts", async () => {
  const { submit, stored } = submissionAction();
  const state = { success: false, message: "" };
  assert.equal((await submit(state, validForm())).success, true);
  assert.equal(stored[0].preco, 35.9);
  assert.equal(stored[0].nome_loja, "Depósito");
  assert.equal(stored[0].contato, null);
  assert.equal(stored[0].status, undefined);
  const bot = validForm(); bot.set("website", "spam.example");
  assert.equal((await submit(state, bot)).success, true);
  assert.equal(stored.length, 1);
  for (const value of ["", "-1", "1e3", "NaN", "2.345", "10000000000", "1,000.00"]) {
    const form = validForm(); form.set("preco", value);
    assert.equal((await submit(state, form)).success, false);
  }
  const missing = validForm(); missing.delete("nome_produto");
  assert.equal((await submit(state, missing)).success, false);
  const long = validForm(); long.set("contato", "x".repeat(161));
  assert.equal((await submit(state, long)).success, false);
  assert.equal(stored.length, 1);
  const failed = submissionAction({ message: "database unavailable" });
  const result = await failed.submit(state, validForm());
  assert.equal(result.success, false);
  assert.ok(!result.message.includes("database unavailable"));
});

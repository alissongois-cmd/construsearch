import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { runInNewContext } from "node:vm";
import { PGlite } from "@electric-sql/pglite";
import ts from "typescript";
import * as XLSX from "xlsx";

const migration = readFileSync(new URL("../supabase/migrations/20261010000000_create_envios_pendentes.sql", import.meta.url), "utf8");
const baseSchema = readFileSync(new URL("../supabase/migrations/20260919000000_create_comparador_materiais_schema.sql", import.meta.url), "utf8");
const optionalMigration = readFileSync(new URL("../supabase/migrations/20261011000000_optional_submission_product_fields.sql", import.meta.url), "utf8");
const shippingMigration = readFileSync(new URL("../supabase/migrations/20261011010000_add_estimated_shipping.sql", import.meta.url), "utf8");
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
    await db.exec(optionalMigration);
    await db.exec(optionalMigration);
    await db.exec(shippingMigration);
    await db.exec(shippingMigration);
    await db.exec("set role anon");
    const insert = "insert into public.envios_pendentes (nome_loja,cidade,nome_produto,categoria,unidade_medida,preco) values ($1,$2,$3,'cimento','saco', $4)";
    await db.query("insert into public.envios_pendentes (nome_loja,cidade,nome_produto,categoria,unidade_medida,preco,frete_fixo,frete_gratis_acima) values ('Depósito','São Paulo','Cimento','cimento','saco',35.9,25,200)");
    await assert.rejects(db.exec("insert into public.envios_pendentes (nome_loja,cidade,nome_produto,categoria,unidade_medida,preco,frete_fixo) values ('x','x','x','','',1,-1)"));
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

    const shipping = (await db.query("select frete_fixo,frete_gratis_acima from public.lojas")).rows[0];
    assert.equal(Number(shipping.frete_fixo), 25);
    assert.equal(Number(shipping.frete_gratis_acima), 200);

    await db.query(insert, [" DEPÓSITO ", " SÃO PAULO ", " CIMENTO ", 40]);
    const second = (await db.query("select id from public.envios_pendentes where status='pendente'")).rows[0].id;
    await db.query("select public.aprovar_envio($1)", [second]);
    for (const table of ["lojas", "materiais", "precos"]) {
      assert.equal((await db.query(`select count(*)::int as count from public.${table}`)).rows[0].count, 1);
    }
    assert.equal(Number((await db.query("select valor from public.precos")).rows[0].valor), 40);

    assert.equal(Number((await db.query("select frete_fixo from public.lojas")).rows[0].frete_fixo), 25);
    await db.exec("insert into public.envios_pendentes (nome_loja,cidade,nome_produto,categoria,unidade_medida,preco,frete_fixo,frete_gratis_acima) values ('Depósito','São Paulo','Cimento','','',40,0,300)");
    const updated = (await db.query("select id from public.envios_pendentes where status='pendente'")).rows[0].id;
    await db.query("select public.aprovar_envio($1)", [updated]);
    const newShipping = (await db.query("select frete_fixo,frete_gratis_acima from public.lojas")).rows[0];
    assert.equal(Number(newShipping.frete_fixo), 0);
    assert.equal(Number(newShipping.frete_gratis_acima), 300);

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
    await db.query("insert into public.envios_pendentes (nome_loja,cidade,nome_produto,categoria,unidade_medida,preco) values ('Opcional','Cidade','Sem categoria','','',10)");
    const optional = (await db.query("select id from public.envios_pendentes where nome_produto='Sem categoria'")).rows[0].id;
    await db.query("select public.aprovar_envio($1)", [optional]);
    const material = (await db.query("select categoria,unidade_medida from public.materiais where nome='Sem categoria'")).rows[0];
    assert.equal(material.categoria, "");
    assert.equal(material.unidade_medida, "");
    await db.exec(`set "request.jwt.claim.sub" = ''`);
    await assert.rejects(db.query("select public.aprovar_envio($1)", [first.id]));
  } finally { await db.close(); }
});

const compile = (path) => ts.transpileModule(readFileSync(new URL(path, import.meta.url), "utf8"), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
}).outputText;
const parserExports = {};
runInNewContext(compile("../src/lib/product-spreadsheet.ts"), {
  exports: parserExports, Buffer, Error,
  require(name) { assert.equal(name, "xlsx"); return XLSX; },
});
const shippingExports = {};
runInNewContext(compile("../src/lib/shipping.ts"), { exports: shippingExports, Error });
const actionSource = compile("../src/app/cadastrar-produto/actions.ts");

function submissionAction(error = null, throws = false) {
  const stored = [];
  const exports = {};
  runInNewContext(actionSource, {
    exports, File, Error,
    require(name) {
      if (name === "@/lib/shipping") return shippingExports;
      if (name === "@/lib/product-spreadsheet") return parserExports;
      assert.equal(name, "@/lib/supabase/server");
      return { async createClient() { return { from(table) {
        assert.equal(table, "envios_pendentes");
        return { async insert(value) {
          if (throws) throw new Error("database unavailable");
          if (!error) stored.push(...value);
          return { error };
        } };
      } }; } };
    },
  });
  return { submit: exports.submitProduct, stored };
}
const header = "nome_produto,categoria,unidade_medida,preco";
const state = { success: false, message: "", received: 0, ignored: [] };
function validForm(content = `${header}\nCimento,cimento,saco,35.90\nAreia,,,120`, name = "produtos.csv") {
  const form = new FormData();
  form.set("nome_loja", " Depósito ");
  form.set("cidade", "Cidade");
  form.set("arquivo", new File([content], name));
  return form;
}
function xlsxFile(rows) {
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, XLSX.utils.aoa_to_sheet(rows), "Produtos");
  return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}

test("CSV batches valid rows with shared shop data and reports physical line numbers", async () => {
  const { submit, stored } = submissionAction();
  const csv = `${header}\r\nCimento,cimento,saco,35.90\r\nAreia,,,120\r\n\r\nTijolo,,,0\r\n,,,9\r\nPedra,,,abc\r\nCal,,,\r\n"Produto, especial",,,"1,25"`;
  const result = await submit(state, validForm(csv));
  assert.equal(result.success, true);
  assert.equal(result.received, 3);
  assert.deepEqual(Array.from(result.ignored, (row) => row.line), [5,6,7,8]);
  assert.match(result.ignored[0].reason, /preço inválido/);
  assert.match(result.ignored[1].reason, /nome/);
  assert.match(result.ignored[3].reason, /obrigatório/);
  assert.equal(stored[0].preco, 35.9);
  assert.equal(stored[1].categoria, "");
  assert.equal(stored[1].unidade_medida, "");
  assert.equal(stored[2].nome_produto, "Produto, especial");
  assert.equal(stored[2].preco, 1.25);
  for (const row of stored) {
    assert.equal(row.nome_loja, "Depósito");
    assert.equal(row.cidade, "Cidade");
    assert.equal(row.contato, null);
    assert.equal(row.status, undefined);
  }
});

test("XLSX supports numeric prices, optional fields, reordered headers, and ignores formulas", async () => {
  const data = xlsxFile([
    ["preco", "nome_produto", "unidade_medida", "categoria"],
    [35.9, "Cimento", "saco", "cimento"],
    [20, "Areia"],
    [{ t: "n", f: "10+10", v: 20 }, "Fórmula"],
    [-1, "Inválido"],
  ]);
  const { submit, stored } = submissionAction();
  const form = validForm(data, "produtos.XLSX"); form.set("contato", "11999999999");
  const result = await submit(state, form);
  assert.equal(result.received, 2);
  assert.deepEqual(Array.from(result.ignored, (row) => row.line), [4,5]);
  assert.match(result.ignored[0].reason, /fórmulas/);
  assert.equal(stored[0].preco, 35.9);
  assert.equal(stored[1].categoria, "");
  assert.equal(stored[1].contato, "11999999999");
});

test("rejects unsupported, empty, malformed and oversized files before inserting", async () => {
  const { submit, stored } = submissionAction();
  for (const form of [
    validForm("", "produtos.csv"),
    validForm("x".repeat(1024 * 1024 + 1)),
    validForm(`${header}\nCimento,,,1`, "produtos.txt"),
    validForm("invalid", "produtos.xlsx"),
    validForm("x", "produtos.xlsx"),
    validForm("nome,preco\nCimento,1"),
    validForm(header),
    validForm(`${header},extra\nCimento,,,1,x`),
  ]) {
    const result = await submit(state, form);
    assert.equal(result.success, false);
    assert.equal(result.received, 0);
  }
  assert.equal(stored.length, 0);
});

test("enforces exactly 500 product rows in both formats without partially inserting oversized sheets", async () => {
  for (const format of ["csv", "xlsx"]) {
    for (const count of [500, 501]) {
      const data = format === "csv"
        ? `${header}\n${Array(count).fill("Cimento,,,35.90").join("\n")}`
        : xlsxFile([header.split(","), ...Array.from({length: count}, () => ["Cimento", "", "", 35.9])]);
      const { submit, stored } = submissionAction();
      const result = await submit(state, validForm(data, `produtos.${format}`));
      assert.equal(result.success, count === 500);
      assert.equal(result.received, count === 500 ? 500 : 0);
      assert.equal(stored.length, count === 500 ? 500 : 0);
      if (count === 501) assert.match(result.message, /500/);
    }
  }
});

test("invalid prices, oversized text, missing shop data and honeypot never write records", async () => {
  const { submit, stored } = submissionAction();
  for (const value of ["", "0", "-1", "1e3", "NaN", "Infinity", "2.345", "10000000000", "1,000.00"]) {
    const result = await submit(state, validForm(`${header}\nCimento,,,"${value}"`));
    assert.equal(result.success, false);
    assert.equal(result.ignored.length, 1);
  }
  const long = validForm(`${header}\n${"x".repeat(161)},,,1`);
  assert.equal((await submit(state, long)).success, false);
  const missing = validForm(); missing.delete("nome_loja");
  assert.equal((await submit(state, missing)).success, false);
  const contact = validForm(); contact.set("contato", "x".repeat(161));
  assert.equal((await submit(state, contact)).success, false);
  const file = validForm(); file.delete("arquivo");
  assert.equal((await submit(state, file)).success, false);
  const bot = validForm(); bot.set("website", "spam.example");
  assert.equal((await submit(state, bot)).success, true);
  assert.equal(stored.length, 0);
});

test("database errors and exceptions never confirm products or leak database details", async () => {
  for (const failing of [submissionAction({ message: "database unavailable" }), submissionAction(null, true)]) {
    const result = await failing.submit(state, validForm(`${header}\nCimento,,,35.90\nAreia,,,0`));
    assert.equal(result.success, false);
    assert.equal(result.received, 0);
    assert.equal(result.ignored.length, 1);
    assert.ok(!result.message.includes("database unavailable"));
    assert.equal(failing.stored.length, 0);
  }
});

test("downloadable template can be submitted with its three examples", async () => {
  const template = readFileSync(new URL("../public/modelo-produtos.csv", import.meta.url));
  const { submit, stored } = submissionAction();
  const result = await submit(state, validForm(template));
  assert.equal(result.received, 3);
  assert.equal(result.ignored.length, 0);
  assert.equal(stored.length, 3);
});


test("public submissions share optional shipping values and reject invalid shipping", async () => {
  const { submit, stored } = submissionAction();
  const form = validForm();
  form.set("frete_fixo", "25,50");
  form.set("frete_gratis_acima", "200");
  assert.equal((await submit(state, form)).success, true);
  for (const row of stored) {
    assert.equal(row.frete_fixo, 25.5);
    assert.equal(row.frete_gratis_acima, 200);
  }
  for (const value of ["-1", "NaN", "Infinity", "1e3", "0.001", "10000000000"]) {
    const action = submissionAction();
    const invalid = validForm(); invalid.set("frete_fixo", value);
    assert.equal((await action.submit(state, invalid)).success, false);
    assert.equal(action.stored.length, 0);
  }
});

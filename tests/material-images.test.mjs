import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { PGlite } from "@electric-sql/pglite";
const require = createRequire(import.meta.url);
function load(path) {
  const exports = {};
  runInNewContext(ts.transpileModule(readFileSync(path,"utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX } }).outputText, {exports, require});
  return exports;
}
const {categoryImage} = load("src/lib/material-images.ts");
const {MaterialImage} = load("src/components/material-image.tsx");
test("shared category SVGs, aliases, uploaded overrides and unknown categories", () => {
  assert.equal(categoryImage(" Tíjolos ",[]), "/category-images/tijolo.svg");
  assert.equal(categoryImage("areia",[{categoria_chave:"areia",imagem_url:"https://example.com/sand.jpg"}]), "https://example.com/sand.jpg");
  assert.equal(categoryImage("desconhecida",[]),null);
  for (const key of ["areia","brita","tijolo","cimento","ferragens","tintas"]) assert.match(readFileSync(`public/category-images/${key}.svg`,"utf8"), /<svg/);
});
test("image precedence, illustrative badge and neutral placeholder", () => {
  const render = (props) => renderToStaticMarkup(React.createElement(MaterialImage,{name:"Areia",...props}));
  const own = render({upload:"/own.jpg",ean:"/ean.jpg",category:"/sand.svg"});
  assert.match(own,/src="\/own.jpg"/); assert.doesNotMatch(own,/figcaption/);
  assert.match(render({ean:"/ean.jpg",category:"/sand.svg"}),/src="\/ean.jpg"/);
  const category = render({category:"/sand.svg"});
  assert.match(category,/src="\/sand.svg"/); assert.match(category,/Imagem ilustrativa/);
  assert.match(render({}),/Imagem não disponível/); assert.doesNotMatch(render({}),/figcaption/);
});
test("migration is repeatable; category images are public read and authenticated write",async () => {
 const db=new PGlite();
 try {
  await db.exec("create role anon; create role authenticated; create table public.materiais(id uuid, imagem_url text); insert into public.materiais(imagem_url) values ('https://legacy.example/image.jpg')");
  const sql=readFileSync("supabase/migrations/20261016000000_add_category_images.sql","utf8");
  await db.exec(sql); await db.exec(sql);
  assert.equal((await db.query("select imagem_url from public.materiais")).rows[0].imagem_url,"https://legacy.example/image.jpg");
  await db.exec("set role authenticated; insert into public.categorias_imagens values ('areia','Areia','https://example.com/sand.jpg'); reset role; set role anon");
  assert.equal((await db.query("select * from public.categorias_imagens")).rows.length,1);
  await assert.rejects(db.exec("insert into public.categorias_imagens values ('x','x',null)"));
  await assert.rejects(db.exec("update public.categorias_imagens set imagem_url=null"));
 } finally {await db.close();}
});

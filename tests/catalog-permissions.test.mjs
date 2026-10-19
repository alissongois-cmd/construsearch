import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";

test("catalog SQL: allowlisted admins only, materials column protected, normalization agrees",async()=>{
 const db=new PGlite();try{
  await db.exec(`create role anon;create role authenticated;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
   insert into auth.users values ('11111111-1111-4111-8111-111111111111','alisson.gois@unesp.br',now()),('22222222-2222-4222-8222-222222222222','other@example.com',now());
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
   create table public.materiais(id uuid primary key default gen_random_uuid(),nome text);grant select,insert,update,delete on public.materiais to authenticated;`);
  const sql=readFileSync("supabase/migrations/20261019000000_master_image_catalog.sql","utf8");await db.exec(sql);await db.exec(sql);
  assert.equal((await db.query("select public.normalizar_texto_catalogo('CIMENTO 20kg') v")).rows[0].v,"cimento 20 kg");
  assert.equal((await db.query("select public.normalizar_texto_catalogo('Añil20kg') v")).rows[0].v,"anil20 kg");
  await db.exec(`set role authenticated;set "request.jwt.claim.sub"='22222222-2222-4222-8222-222222222222'`);
  await assert.rejects(db.exec("insert into private.catalog_admin_emails values ('other@example.com')"));
  await assert.rejects(db.exec("insert into public.catalogo_imagens(sku,nome_oficial,categoria,arquivo_imagem) values ('X','X','X','x.jpg')"));
  await db.exec("insert into public.materiais(nome) values ('Material sem vínculo')");
  await db.exec(`set "request.jwt.claim.sub"='11111111-1111-4111-8111-111111111111'`);
  await db.exec("insert into public.catalogo_imagens(sku,nome_oficial,categoria,arquivo_imagem,sinonimos) values ('A','Cimento 20kg','Cimento','A.JPG',array['CIMENTO 20kg','cimento 20 kg']);update public.materiais set catalogo_sku='A'");
  assert.equal((await db.query("select nome_normalizado,sinonimos from public.catalogo_imagens")).rows[0].sinonimos.length,1);
  await db.exec("insert into public.catalogo_imagens(sku,nome_oficial,categoria,arquivo_imagem) values ('A','Novo nome','Cimento','A.JPG') on conflict(sku) do update set nome_oficial=excluded.nome_oficial");
  assert.equal((await db.query("select count(*)::int n from public.catalogo_imagens")).rows[0].n,1);
  await db.exec(`set "request.jwt.claim.sub"='22222222-2222-4222-8222-222222222222'`);
  await assert.rejects(db.exec("update public.materiais set catalogo_sku=null"));
  await assert.rejects(db.exec("insert into public.materiais(nome,catalogo_sku) values ('Bypass','A')"));
  await db.exec("update public.materiais set nome='Other field remains allowed'");
  await db.exec("reset role;set role anon");assert.equal((await db.query("select count(*)::int n from public.catalogo_imagens")).rows[0].n,1);
 }finally{await db.close()}
});

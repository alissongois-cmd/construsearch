import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";

test("global 429 circuit refunds only its reservation, blocks claims and reopens after expiry",async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon;create role authenticated;create schema auth;
   create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
   grant usage on schema auth to anon,authenticated;grant execute on function auth.uid() to anon,authenticated;
   create table public.buscas_imagem_ean(material_id uuid primary key,ean text,status text,tentativas integer,ultimo_erro text,lease_token uuid,atualizado_em timestamptz);
   grant select,update on public.buscas_imagem_ean to authenticated;
   insert into public.buscas_imagem_ean values ('11111111-1111-4111-8111-111111111111','01234565','pendente',4,null,null,now()-interval '2 seconds');`);
  const migration=readFileSync("supabase/migrations/20261018000000_cosmos_rate_limit.sql","utf8");
  await db.exec(migration);await db.exec(migration);
  await db.exec("set role anon");
  await assert.rejects(db.exec("select * from public.cosmos_limite"));
  await assert.rejects(db.exec("select public.registrar_limite_cosmos(null,null,now(),'x','{}')"));
  await db.exec(`reset role;set role authenticated;set "request.jwt.claim.sub"='11111111-1111-4111-8111-111111111111'`);
  const job=(await db.query("select * from public.reservar_busca_imagem_ean()")).rows[0];
  assert.equal(job.tentativas,5);
  await db.query("select public.registrar_limite_cosmos($1,$2,now()+interval '1 hour',$3,$4)",[job.material_id,job.lease_token,'{"message":"25 consultas excedidas"}',{"retry-after":"3600"}]);
  const after=(await db.query("select * from public.buscas_imagem_ean")).rows[0];
  assert.equal(after.tentativas,4);assert.equal(after.status,"pendente");assert.equal(after.ultimo_erro,null);assert.equal(after.lease_token,null);
  const limit=(await db.query("select * from public.cosmos_limite")).rows[0];
  assert.equal(limit.estado,"limite_atingido");assert.match(limit.mensagem,/25 consultas/);assert.ok(limit.atingido_em);assert.equal(limit.cabecalhos["retry-after"],"3600");
  assert.equal((await db.query("select * from public.reservar_busca_imagem_ean()")).rows.length,0);
  // Duplicate or late callbacks cannot decrement an item twice or shorten the circuit.
  await db.query("select public.registrar_limite_cosmos($1,$2,now()+interval '1 minute','429','{}')",[job.material_id,job.lease_token]);
  assert.equal((await db.query("select tentativas from public.buscas_imagem_ean")).rows[0].tentativas,4);
  assert.deepEqual((await db.query("select bloqueado_ate from public.cosmos_limite")).rows[0].bloqueado_ate,limit.bloqueado_ate);
  await db.exec("update public.cosmos_limite set bloqueado_ate=now()-interval '1 second';update public.buscas_imagem_ean set atualizado_em=now()-interval '2 seconds'");
  const next=(await db.query("select * from public.reservar_busca_imagem_ean()")).rows[0];assert.equal(next.tentativas,5);assert.notEqual(next.lease_token,job.lease_token);
  await db.query("select public.registrar_limite_cosmos($1,$2,now()+interval '1 hour','late 429','{}')",[job.material_id,job.lease_token]);
  assert.equal((await db.query("select tentativas from public.buscas_imagem_ean")).rows[0].tentativas,5);
  await db.exec("reset role");await db.exec(migration);
  assert.equal((await db.query("select count(*)::int n from public.cosmos_limite")).rows[0].n,1);
 }finally{await db.close();}
});

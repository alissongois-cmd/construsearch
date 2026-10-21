import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {PGlite} from "@electric-sql/pglite";
const sql=(name)=>readFileSync(`supabase/migrations/${name}.sql`,"utf8");
const user="11111111-1111-4111-8111-111111111111";

test("EAN approval: permissions, conflicts, deduplication, atomicity and recoverable global queue",async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create role anon; create role authenticated; create schema auth; create table auth.users(id uuid primary key); insert into auth.users values ('${user}'); create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;`);
  for(const name of ["20260919000000_create_comparador_materiais_schema","20261007000000_add_material_ean","20261010000000_create_envios_pendentes","20261011000000_optional_submission_product_fields","20261011010000_add_estimated_shipping","20261015000000_add_store_slugs","20261016000000_add_category_images"])await db.exec(sql(name));
  const migration=sql("20261017000000_tolerant_submission_ean");
  // Duplicates must not be hidden by silently creating an index.
  await db.exec("insert into public.materiais(nome,categoria,unidade_medida,ean) values ('Duplicado A','','','12345670'),('Duplicado B','','','12345670')");
  await db.exec(migration);
  assert.equal((await db.query("select count(*)::int n from pg_indexes where indexname='materiais_ean_unique'")).rows[0].n,0);
  await db.exec("set role anon");
  for(const query of ["select public.aprovar_envio(gen_random_uuid())","select public.reservar_busca_imagem_ean()","select * from public.buscas_imagem_ean","update public.envios_pendentes set erro_aprovacao='x'"])await assert.rejects(db.exec(query));
  await db.exec("insert into public.envios_pendentes(nome_loja,cidade,nome_produto,categoria,unidade_medida,preco,ean) values ('Loja','Cidade','Duplicado','','',10,'12345670')");
  await db.exec(`reset role; set role authenticated; set "request.jwt.claim.sub"='${user}'`);
  const duplicate=(await db.query("select id from public.envios_pendentes")).rows[0].id;
  await db.query("select public.aprovar_envio($1)",[duplicate]);
  assert.match((await db.query("select erro_aprovacao from public.envios_pendentes where id=$1",[duplicate])).rows[0].erro_aprovacao,/EAN duplicado/);
  await db.exec("reset role; delete from public.envios_pendentes; delete from public.materiais;");
  await db.exec(migration);await db.exec(migration);
  assert.equal((await db.query("select count(*)::int n from pg_indexes where indexname='materiais_ean_unique'")).rows[0].n,1);
  await db.exec(`set role authenticated; set "request.jwt.claim.sub"='${user}'`);
  async function submit(name,ean,price=10){
   const id=(await db.query("insert into public.envios_pendentes(nome_loja,cidade,nome_produto,categoria,unidade_medida,preco,ean) values ('Loja','Cidade',$1,'','',$3,$2) returning id",[name,ean,price])).rows[0].id;
   await db.query("select public.aprovar_envio($1)",[id]);
   return (await db.query("select * from public.envios_pendentes where id=$1",[id])).rows[0];
  }
  const first=await submit("Címento  a granel","7891234567895");assert.equal(first.status,"aprovado");
  await db.query("select public.aprovar_envio($1)",[first.id]);
  assert.equal((await submit("Nome diferente","7891234567895")).status,"aprovado");
  assert.equal((await submit(" CIMENTO  A GRANEL ",null)).status,"aprovado");
  const conflict=await submit("Cimento a granel","12345670");
  assert.equal(conflict.status,"pendente");assert.match(conflict.erro_aprovacao,/EAN diferente/);
  assert.equal((await db.query("select count(*)::int n from public.materiais")).rows[0].n,1);
  assert.equal((await db.query("select ean from public.materiais")).rows[0].ean,"7891234567895");
  await submit("Areia",null);await submit("areia","12345670");
  assert.equal((await db.query("select count(*)::int n from public.materiais where lower(nome)='areia'")).rows[0].n,1);
  // Failed publication must not commit material/shop/image-job writes.
  await db.exec("reset role; alter table public.precos add constraint fail_price check(valor<>777); set role authenticated");
  const rollback=(await db.query("insert into public.envios_pendentes(nome_loja,cidade,nome_produto,categoria,unidade_medida,preco,ean) values ('Rollback','Cidade','Rollback','','',777,'4006381333931') returning id")).rows[0].id;
  await assert.rejects(db.query("select public.aprovar_envio($1)",[rollback]));
  assert.equal((await db.query("select status from public.envios_pendentes where id=$1",[rollback])).rows[0].status,"pendente");
  assert.equal((await db.query("select count(*)::int n from public.materiais where nome='Rollback'")).rows[0].n,0);
  const job=(await db.query("select * from public.reservar_busca_imagem_ean()")).rows[0];assert.ok(job.lease_token);
  assert.equal((await db.query("select * from public.reservar_busca_imagem_ean()")).rows.length,0);
  assert.equal((await db.query("select public.concluir_busca_imagem_ean($1,gen_random_uuid(),'https://example.com/img.jpg',null) ok",[job.material_id])).rows[0].ok,false);
  await db.query("update public.materiais set imagem_url='https://example.com/own.jpg' where id=$1",[job.material_id]).catch(async()=>{
   await db.exec("reset role; alter table public.materiais add column imagem_url text; set role authenticated");
   await db.query("update public.materiais set imagem_url='https://example.com/own.jpg' where id=$1",[job.material_id]);
  });
  assert.equal((await db.query("select public.concluir_busca_imagem_ean($1,$2,'https://example.com/ean.jpg',null) ok",[job.material_id,job.lease_token])).rows[0].ok,true);
  const material=(await db.query("select imagem_url,imagem_ean_url from public.materiais where id=$1",[job.material_id])).rows[0];
  assert.equal(material.imagem_url,"https://example.com/own.jpg");assert.equal(material.imagem_ean_url,"https://example.com/ean.jpg");
  assert.equal((await db.query("select * from public.reservar_busca_imagem_ean()")).rows.length,0); // global pause
  await db.exec("update public.buscas_imagem_ean set atualizado_em=now()-interval '2 seconds'");
  const next=(await db.query("select * from public.reservar_busca_imagem_ean()")).rows[0];assert.ok(next);
  await db.exec("update public.buscas_imagem_ean set atualizado_em=now()-interval '4 minutes' where status='processando'");
  await db.query("select * from public.reservar_busca_imagem_ean()");
  assert.equal((await db.query("select status from public.buscas_imagem_ean where material_id=$1",[next.material_id])).rows[0].status,"pendente");
  await db.exec("update public.buscas_imagem_ean set atualizado_em=now()-interval '2 seconds'");
  const recovered=(await db.query("select * from public.reservar_busca_imagem_ean()")).rows[0];
  assert.notEqual(recovered.lease_token,next.lease_token);
  assert.equal((await db.query("select public.concluir_busca_imagem_ean($1,$2,null,'timeout') ok",[next.material_id,next.lease_token])).rows[0].ok,false);
  await db.query("select public.concluir_busca_imagem_ean($1,$2,null,'Cosmos HTTP 429')",[recovered.material_id,recovered.lease_token]);
  const failed=(await db.query("select * from public.buscas_imagem_ean where material_id=$1",[recovered.material_id])).rows[0];
  assert.equal(failed.status,"erro");assert.equal(failed.tentativas,2);assert.match(failed.ultimo_erro,/429/);
 }finally{await db.close();}
});

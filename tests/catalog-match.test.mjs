import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import ts from 'typescript';
import {PGlite} from '@electric-sql/pglite';

const id='11111111-1111-4111-8111-111111111111';
const source=readFileSync('src/app/(dashboard)/admin/catalogo-imagens/actions.ts','utf8');
function action(result,{denied=false,fail=false}={}) {
 const exports={};const pages=[];let updates=0;
 const query={eq(){return this},select(){return this},async maybeSingle(){if(fail)throw new Error('offline');return result}};
 runInNewContext(ts.transpileModule(source,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText,{
  exports,console:{error(){}},require(name){
   if(name==='next/cache')return {revalidatePath:p=>pages.push(p)};
   if(name==='@/lib/catalog-server')return {requireCatalogAdmin:async()=>{if(denied)throw new Error('denied');return {supabase:{from:()=>({update(){updates++;return query}})}}}};
   return {};
  }
 });
 return {run:async(material=id)=>{const form=new FormData();form.set('material_id',material);form.set('sku','A');return exports.confirmCatalogMatch({success:false,message:''},form)},pages,updates:()=>updates};
}
test('zero-row update produces a visible error and no cache invalidation',async()=>{
 const a=action({data:null,error:null});const state=await a.run();assert.equal(state.success,false);assert.match(state.message,/Nenhum material.*RLS/);assert.equal(a.pages.length,0);
});
test('database error is safe and actionable',async()=>{
 const a=action({data:null,error:{message:'secret database detail'}});const state=await a.run();assert.equal(state.success,false);assert.match(state.message,/permissões/);assert.doesNotMatch(state.message,/secret/);
});
test('successful update returns success and invalidates affected pages',async()=>{
 const a=action({data:{id,catalogo_sku:'A'},error:null});assert.equal((await a.run()).success,true);assert.equal(a.pages.length,4);
});
test('invalid input never updates materials',async()=>{
 const a=action({});assert.equal((await a.run('invalid')).success,false);assert.equal(a.updates(),0);
});
test('denied access and unexpected failures return clear messages',async()=>{
 for(const options of [{denied:true},{fail:true}]){const a=action({},options);assert.equal((await a.run()).success,false);assert.equal(a.pages.length,0)}
});
test('RLS: zero rows before migration, allowlisted confirmed admin updates after, other users stay blocked',async()=>{
 const db=new PGlite();try{
 await db.exec(`create role anon;create role authenticated;create schema auth;
 create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);
 insert into auth.users values ('${id}','alisson.gois@unesp.br',now()),('22222222-2222-4222-8222-222222222222','other@example.com',now()),('33333333-3333-4333-8333-333333333333','gois17541@gmail.com',null);
 create function auth.uid() returns uuid language sql as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
 grant usage on schema auth to authenticated;grant execute on function auth.uid() to authenticated;
 create table public.materiais(id uuid primary key,nome text);grant select,update on public.materiais to authenticated;`);
 await db.exec(readFileSync('supabase/migrations/20261019000000_master_image_catalog.sql','utf8'));
 await db.exec(`insert into public.materiais(id,nome) values ('${id}','Cimento');
 insert into public.catalogo_imagens(sku,nome_oficial,categoria,arquivo_imagem) values ('A','Cimento','Cimento','A.jpg');
 alter table public.materiais enable row level security;
 create policy read_materials on public.materiais for select to authenticated using(true);
 set role authenticated;set "request.jwt.claim.sub"='${id}';`);
 assert.equal((await db.query("update public.materiais set catalogo_sku='A' returning id")).rows.length,0);
 await db.exec('reset role');const migration=readFileSync('supabase/migrations/20261021000000_catalog_material_update_policy.sql','utf8');await db.exec(migration);await db.exec(migration);
 await db.exec('set role authenticated');
 assert.equal((await db.query("update public.materiais set catalogo_sku='A' returning id,catalogo_sku")).rows[0].catalogo_sku,'A');
 for(const uid of ['22222222-2222-4222-8222-222222222222','33333333-3333-4333-8333-333333333333']){
 await db.exec(`set "request.jwt.claim.sub"='${uid}'`);
 assert.equal((await db.query('update public.materiais set catalogo_sku=null returning id')).rows.length,0);
 }
 // Even installations with a permissive legacy UPDATE policy retain column protection.
 await db.exec('reset role;create policy legacy_update on public.materiais for update to authenticated using(true) with check(true);set role authenticated');
 await assert.rejects(db.exec('update public.materiais set catalogo_sku=null'),/Somente administradores/);
 }finally{await db.close()}
});

test('form renders loading, success and accessible errors',async()=>{
 const React=await import('react');const {renderToStaticMarkup}=await import('react-dom/server');const jsx=await import('react/jsx-runtime');
 const code=ts.transpileModule(readFileSync('src/components/catalog-match-form.tsx','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 for(const [state,pending,label,role] of [
  [{success:false,message:''},true,'Confirmando…',null],
  [{success:true,message:'Vínculo confirmado com sucesso.'},false,'Vínculo confirmado','status'],
  [{success:false,message:'Nenhum material foi atualizado.'},false,'Confirmar vínculo','alert']
 ]){
  const exports={};runInNewContext(code,{exports,require(name){if(name==='react')return {useActionState:()=>[state,()=>{},pending]};if(name==='react/jsx-runtime')return jsx;return {confirmCatalogMatch(){}}}});
  const html=renderToStaticMarkup(React.createElement(exports.CatalogMatchForm,{materialId:id,sku:'A'}));
  assert.ok(html.includes(label));if(role)assert.ok(html.includes(`role="${role}"`));
  assert.equal(html.includes('disabled=""'),pending||state.success);
 }
});

import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const compile=path=>ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const normalization={};runInNewContext(compile("src/lib/ean.ts"),{exports:normalization,Error});
function action(){
 const written=[];const exports={};
 const supabase={from(){return{select(){return{async in(){return{data:[{sku:"A",imagem_path:"old.webp",imagem_url:"https://example.com/old.webp"}],error:null}}}},upsert(rows){written.push(...rows);return{async select(){return{data:rows.map(row=>({sku:row.sku})),error:null}}}}}},storage:{from(){return{getPublicUrl(path){return{data:{publicUrl:"https://storage.example/"+path}}}}}}};
 runInNewContext(compile("src/app/(dashboard)/admin/catalogo-imagens/actions.ts"),{exports,Error,require(name){
  if(name==="@/lib/catalog-server")return{async requireCatalogAdmin(){return{supabase,user:{id:"11111111-1111-4111-8111-111111111111"}}}};
  if(name==="@/lib/image-catalog")return{normalizeCatalog:value=>value.toLowerCase(),requiredCatalog:["sku","nome_oficial","categoria","arquivo_imagem"]};
  if(name==="@/lib/ean")return normalization;
  if(name==="next/cache")return{revalidatePath(){}};
  if(name==="next/navigation")return{redirect(){}};
  if(name==="node:crypto")return{};
  if(name==="@/lib/catalog-image")return{};
  assert.fail(name);
 }});
 return{save:exports.saveCatalogBatch,written};
}
const row={sku:"A",nome_oficial:"Cimento 20kg",marca:"",linha:"",categoria:"Cimento",especificacao_tecnica:"",cor:"",peso:"20kg",arquivo_imagem:"A.JPG",sinonimos:[],ean:null};
test("reimport uses SKU and preserves image when no replacement is selected",async()=>{
 const a=action();assert.equal((await a.save([{row}])).saved,1);
 assert.equal(a.written[0].sku,"A");assert.equal(a.written[0].imagem_url,"https://example.com/old.webp");
 const path="11111111-1111-4111-8111-111111111111/catalogo/"+"a".repeat(64)+".webp";
 assert.equal((await a.save([{row,path}])).saved,1);assert.equal(a.written[1].imagem_url,"https://storage.example/"+path);
 const before=a.written.length;
 assert.ok((await a.save([{row},{row}])).error);
 assert.ok((await a.save([{row:{...row,nome_oficial:""}}])).error);
 assert.ok((await a.save([{row,path:"other-user/catalogo/evil.webp"}])).error);
 assert.equal(a.written.length,before);
});

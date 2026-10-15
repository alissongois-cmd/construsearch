import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const source=ts.transpileModule(readFileSync("src/lib/ean-image-queue.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function worker({job=null,auth=true,saveError=null,lookup={url:null,error:null},lookupThrows=false}={}){
 const exports={};const calls=[];
 const supabase={auth:{async getUser(){return{data:{user:auth?{id:"admin"}:null}}}},async rpc(name,args){calls.push([name,args]);return name==="reservar_busca_imagem_ean"?{data:job?[job]:[],error:null}:{data:true,error:saveError}}};
 runInNewContext(source,{exports,Error,require(name){
  if(name==="server-only")return {};
  if(name==="@/lib/supabase/server")return{async createClient(){return supabase}};
  if(name==="@/lib/cosmos")return{async lookupCosmosImage(ean){calls.push(["cosmos",ean]);if(lookupThrows)throw new Error("API unexpectedly failed");return lookup}};
  assert.fail(name);
 }});
 return{run:exports.processOneEANImage,calls};
}
test("serverless worker is bounded to one claimed job and preserves failure details",async()=>{
 const empty=worker();assert.equal(await empty.run(),false);assert.equal(empty.calls.length,1);
 const unauth=worker({auth:false});await assert.rejects(unauth.run(),/Autenticação/);assert.equal(unauth.calls.length,0);
 const job={material_id:"material",ean:"01234565",lease_token:"token"};
 const failed=worker({job,lookup:{url:null,error:"Cosmos HTTP 429"}});
 assert.equal(await failed.run(),true);
 assert.deepEqual(failed.calls.map(([name])=>name),["reservar_busca_imagem_ean","cosmos","concluir_busca_imagem_ean"]);
 assert.equal(failed.calls[2][1].p_erro,"Cosmos HTTP 429");assert.equal(failed.calls[2][1].p_token,"token");
 const saveFailure=worker({job,saveError:{message:"database failure"}});
 await assert.rejects(saveFailure.run(),/reserva expirará/);
});

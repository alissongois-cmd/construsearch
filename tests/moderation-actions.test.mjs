import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const source=ts.transpileModule(readFileSync("src/app/(dashboard)/admin/pendentes/actions.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
function moderation(status="aprovado",workerFails=false){
 const exports={};let imageCalls=0;
 const supabase={auth:{async getUser(){return{data:{user:{id:"admin"}}}}},async rpc(){return{error:null}},from(){return{select(){return{eq(){return{async single(){return{data:{status,erro_aprovacao:status==="pendente"?"EAN diferente":null},error:null}}}}}}}}};
 runInNewContext(source,{exports,Error,require(name){
  if(name==="next/navigation")return{redirect(url){throw new Error(url)}};
  if(name==="next/cache")return{revalidatePath(){}};
  if(name==="@/lib/supabase/server")return{async createClient(){return supabase}};
  if(name==="@/lib/ean-image-queue")return{async processOneEANImage(){imageCalls++;if(workerFails)throw new Error("Cosmos unavailable")}};
  assert.fail(name);
 }});
 const form=new FormData();form.set("id","11111111-1111-4111-8111-111111111111");
 return{run:()=>exports.approveSubmission(form),imageCalls:()=>imageCalls};
}
test("pending conflict is not announced as approved and does not trigger Cosmos",async()=>{
 const action=moderation("pendente");await assert.rejects(action.run(),/resultado=conflito/);assert.equal(action.imageCalls(),0);
 const rejected=moderation("rejeitado");await assert.rejects(rejected.run(),/resultado=erro/);assert.equal(rejected.imageCalls(),0);
});
test("image failure after approval never undoes or hides a successful publication",async()=>{
 const action=moderation("aprovado",true);await assert.rejects(action.run(),/resultado=processado/);assert.equal(action.imageCalls(),1);
});

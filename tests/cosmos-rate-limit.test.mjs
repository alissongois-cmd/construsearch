import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
const source=ts.transpileModule(readFileSync("src/lib/cosmos.ts","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const now=Date.parse("2026-10-16T12:00:00Z");
function cosmos({headers={},body='{"message":"Você excedeu 25 consultas diárias"}',config,blocked=false,throwsBody=false}={}){
 const exports={};let calls=0;const recorded=[];
 class Clock extends Date { static now(){return now;} }
 const response=new Response(body,{status:429,headers});
 if(throwsBody)response.text=async()=>{throw new Error("interrupted")};
 runInNewContext(source,{exports,URL,Date:Clock,AbortSignal,process:{env:{COSMOS_API_TOKEN:"secret-token",COSMOS_API_USER_AGENT:"agent",COSMOS_RATE_LIMIT_COOLDOWN_SECONDS:config}},fetch:async()=>{calls++;return response;},require(name){if(name==="server-only")return {};if(name==="@/lib/cosmos-limits")return{async isCosmosBlocked(){return blocked;},async recordCosmosRateLimit(value){recorded.push(value);}};assert.fail(name);}});
 return {...exports,calls:()=>calls,recorded};
}
test("429 keeps exact body/counts and only rate headers, redacting the token",async()=>{
 const api=cosmos({headers:{"Retry-After":"120","X-RateLimit-Limit":"25","X-RateLimit-Remaining":"0","Set-Cookie":"secret-cookie","X-Cosmos-Token":"secret-token"}});
 const result=await api.lookupCosmosImage("01234565");
 assert.equal(result.error,"Limite diário do Cosmos atingido; tente novamente mais tarde");
 assert.equal(result.rateLimit.message,'{"message":"Você excedeu 25 consultas diárias"}');
 assert.equal(result.rateLimit.blockedUntil,"2026-10-16T12:02:00.000Z");
 assert.equal(result.rateLimit.headers["x-ratelimit-limit"],"25");
 assert.doesNotMatch(JSON.stringify(result),/secret-cookie|secret-token/);
 const safe=await cosmos({body:'quota exceeded secret-token'}).lookupCosmosImage("01234565");
 assert.equal(safe.rateLimit.message,"quota exceeded [TOKEN OCULTO]");
});
test("cooldown honors HTTP dates, reset timestamps, relative resets and configured fallback",async()=>{
 const cases=[
  [{"Retry-After":"Fri, 16 Oct 2026 14:00:00 GMT"},undefined,"2026-10-16T14:00:00.000Z"],
  [{"X-RateLimit-Reset":String((now+7200000)/1000)},undefined,"2026-10-16T14:00:00.000Z"],
  [{"RateLimit-Reset":"300"},undefined,"2026-10-16T12:05:00.000Z"],
  [{"RateLimit":"limit=25, remaining=0, reset=600"},undefined,"2026-10-16T12:10:00.000Z"],
  [{},undefined,"2026-10-16T13:00:00.000Z"],
  [{},"1800","2026-10-16T12:30:00.000Z"],
  [{"Retry-After":"nonsense"},"invalid","2026-10-16T13:00:00.000Z"],
 ];
 for(const [headers,config,expected] of cases)assert.equal((await cosmos({headers,config}).lookupCosmosImage("01234565")).rateLimit.blockedUntil,expected);
 assert.ok((await cosmos({throwsBody:true}).lookupCosmosImage("01234565")).rateLimit);
});
test("manual registration also skips calls during a global block and records a new 429",async()=>{
 const blocked=cosmos({blocked:true});assert.equal(await blocked.findCosmosThumbnail("01234565"),null);assert.equal(blocked.calls(),0);
 const open=cosmos();assert.equal(await open.findCosmosThumbnail("01234565"),null);assert.equal(open.recorded.length,1);
});

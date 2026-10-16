import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import {createRequire} from "node:module";
import React from "react";
import {renderToStaticMarkup} from "react-dom/server";
import ts from "typescript";
const require=createRequire(import.meta.url);
const exports={};
runInNewContext(ts.transpileModule(readFileSync("src/components/queue-submit-button.tsx","utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require(name){if(name==="next/navigation")return{useRouter(){return{refresh(){}}}};return require(name);}});
test("process button is disabled during circuit cooldown, enabled after expiry, and fail-closed on state error",()=>{
 const render=props=>renderToStaticMarkup(React.createElement(exports.QueueSubmitButton,props,"Processar próximo"));
 assert.match(render({blockedUntil:new Date(Date.now()+3600000).toISOString()}),/disabled="/);
 assert.doesNotMatch(render({blockedUntil:new Date(Date.now()-1000).toISOString()}),/disabled="/);
 assert.match(render({disabled:true}),/disabled="/);
});

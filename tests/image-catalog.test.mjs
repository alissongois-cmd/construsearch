import assert from "node:assert/strict";
import test from "node:test";
import {readFileSync} from "node:fs";
import {runInNewContext} from "node:vm";
import ts from "typescript";
import * as XLSX from "xlsx";
import sharp from "sharp";
const compile=path=>ts.transpileModule(readFileSync(path,"utf8"),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
const ean={};runInNewContext(compile("src/lib/ean.ts"),{exports:ean,Error});
export const catalog={};runInNewContext(compile("src/lib/image-catalog.ts"),{exports:catalog,Error,TextDecoder,require(name){if(name==="xlsx")return XLSX;if(name==="./ean")return ean;assert.fail(name)}});
test("CSV master import report: original ten headers, case-insensitive image matching, normalized synonyms",()=>{
 const result=catalog.parseImageCatalog(readFileSync("tests/fixtures/catalogo-mestre-amostra.csv"),["argamassa.jpg","TINTA.PNG","sem-linha.jpg"]);
 assert.equal(result.total,6);assert.equal(result.rows.length,3);assert.equal(result.errors.length,1);assert.equal(result.errors[0].line,7);
 assert.equal(result.duplicates[0].sku,"DUP-1");assert.deepEqual(Array.from(result.duplicates[0].lines),[5,6]);
 assert.equal(result.missingImages.length,1);assert.equal(result.missingImages[0].sku,"SKU-003");
 assert.deepEqual(Array.from(result.unusedImages),["sem-linha.jpg"]);
 assert.deepEqual(Array.from(result.rows[0].sinonimos),["argamassa 20 kg","massa ac ii"]);
 assert.equal(catalog.normalizeCatalog("CIMENTO 20kg"),catalog.normalizeCatalog("cimento 20 kg"));
 console.log(JSON.stringify({amostra:"catalogo-mestre-amostra.csv",linhas:result.total,validas:result.rows.length,semImagem:result.missingImages.length,imagensSemLinha:result.unusedImages.length,skusDuplicados:result.duplicates.length,linhasObrigatoriasInvalidas:result.errors.length}));
});
test("matching precedence and ambiguous exact matches; suggestions never become automatic",()=>{
 const entries=[{sku:"A",nome_oficial:"Cimento 20kg",sinonimos:["cimento especial"],ean:"12345670",imagem_url:"a"},{sku:"B",nome_oficial:"Outra marca",sinonimos:["cimento 20 kg"],ean:null,imagem_url:"b"}];
 assert.equal(catalog.matchCatalog({nome:"Outro nome",ean:"12345670"},entries).entry.sku,"A");
 assert.equal(catalog.matchCatalog({nome:"CIMENTO 20 KG",ean:null},entries).entry.sku,"A");
 assert.equal(catalog.matchCatalog({nome:"cimento especial",ean:null},entries).entry.sku,"A");
 assert.equal(catalog.matchCatalog({nome:"Cimento 20 KG Premium",ean:null},entries).entry,null);
 assert.ok(catalog.catalogSuggestions({nome:"Cimento 20 KG Premium"},entries).length);
 assert.equal(catalog.matchCatalog({nome:"Cimento 20 KG Premium",ean:null,catalogo_sku:"A"},entries).method,"manual");
 assert.equal(catalog.matchCatalog({nome:"Cimento 20kg",ean:null},[...entries,{...entries[0],sku:"C"}]).ambiguous,true);
});
test("duplicate image filenames reported; required columns cannot be omitted",()=>{
 const result=catalog.parseImageCatalog(readFileSync("tests/fixtures/catalogo-mestre-amostra.csv"),["argamassa.JPG","ARGAMASSA.jpg"]);
 assert.deepEqual(Array.from(result.ambiguousImages),["argamassa.jpg"]);
 assert.throws(()=>catalog.parseImageCatalog(new TextEncoder().encode("ID SKU;Categoria\n1;Areia"),[]),/obrigatórias/);
});
test("image pipeline produces WebP with longest side 800 and preserves small dimensions",async()=>{
 const input=await sharp({create:{width:1600,height:1000,channels:3,background:"#ddd"}}).png().toBuffer();
 const converter={};runInNewContext(compile("src/lib/catalog-image.ts"),{exports:converter,Error,require(name){assert.equal(name,"sharp");return {default:sharp};}});
 const output=await converter.convertCatalogImage(input);
 const meta=await sharp(output).metadata();assert.equal(meta.format,"webp");assert.equal(meta.width,800);assert.equal(meta.height,500);
 const small=await sharp({create:{width:100,height:50,channels:3,background:"white"}}).png().toBuffer();
 const smallMeta=await sharp(await converter.convertCatalogImage(small)).metadata();assert.equal(smallMeta.width,100);assert.equal(smallMeta.height,50);
});

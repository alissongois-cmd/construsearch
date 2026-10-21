import * as XLSX from "xlsx";
import { normalizeEAN } from "./ean";
export function normalizeCatalog(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
    .replace(/([0-9])([a-z])/g, "$1 $2").replace(/[^a-z0-9]+/g, " ").trim();
}
export const imageFilename = (value: string) => value.split(/[\\/]/).pop()!.trim().normalize("NFC").toLowerCase();
export type CatalogRow = { sku: string; nome_oficial: string; marca: string; linha: string; categoria: string; especificacao_tecnica: string; cor: string; peso: string; arquivo_imagem: string; sinonimos: string[]; ean: string | null };
export type CatalogEntry = CatalogRow & { imagem_url: string | null; imagem_path?: string | null };
const headers: Record<string, keyof CatalogRow> = {
  "id sku": "sku", "nome oficial do produto": "nome_oficial", marca: "marca", linha: "linha", categoria: "categoria",
  "especificacao tecnica": "especificacao_tecnica", cor: "cor", peso: "peso", "arquivo de imagem": "arquivo_imagem", "sinonimos para busca matching": "sinonimos", ean: "ean",
};
export const requiredCatalog = ["sku", "nome_oficial", "categoria", "arquivo_imagem"] as const;
export function parseImageCatalog(bytes: Uint8Array, filenames: string[]) {
  if (!bytes.length || bytes.length > 1024 * 1024) throw new Error("CSV deve ter até 1 MB e não pode estar vazio.");
  let text: string;
  try { text = new TextDecoder("utf-8", {fatal:true}).decode(bytes); } catch { throw new Error("Salve o CSV em UTF-8."); }
  const wb = XLSX.read(text, {type:"string", FS:";", raw:true, cellFormula:true, sheetRows:2002});
  const sheet = wb.Sheets[wb.SheetNames[0]];
  if (!sheet?.["!ref"]) throw new Error("CSV vazio.");
  const range = XLSX.utils.decode_range(sheet["!fullref"] ?? sheet["!ref"]);
  if (range.e.r > 2000) throw new Error("Use até 2000 linhas por importação.");
  const indexes = new Map<keyof CatalogRow, number>();
  for (let c=0;c<=range.e.c;c++) {
    const cell = sheet[XLSX.utils.encode_cell({r:0,c})];
    if (cell?.f || cell?.t === "e") throw new Error("Cabeçalho não pode conter fórmulas.");
    const title = normalizeCatalog(String(cell?.v ?? ""));
    const column = Object.prototype.hasOwnProperty.call(headers,title) ? headers[title] : undefined;
    if (column) { if (indexes.has(column)) throw new Error(`Coluna duplicada: ${column}`); indexes.set(column,c); }
  }
  const missing = requiredCatalog.filter(key=>!indexes.has(key));
  if (missing.length) throw new Error(`Colunas obrigatórias ausentes: ${missing.join(", ")}`);
  const records: {line:number; row:CatalogRow; errors:string[]}[]=[];
  for(let r=1;r<=range.e.r;r++) {
    const values: Record<string,string>={};const errors:string[]=[];
    for(const [key,c] of indexes) {
      const cell=sheet[XLSX.utils.encode_cell({r,c})];
      values[key]=String(cell?.v ?? "").trim();
      if(cell?.f || cell?.t === "e") errors.push(`${key}: fórmulas/erros não são aceitos`);
      if(values[key].length>4000)errors.push(`${key}: máximo 4000 caracteres`);
    }
    if(Object.values(values).every(v=>!v)&&!errors.length)continue;
    requiredCatalog.forEach(key=>{if(!values[key])errors.push(`${key}: campo obrigatório vazio`)});
    if((values.sku?.length ?? 0)>160)errors.push("sku: máximo 160 caracteres");
    let ean:string|null=null;try{ean=normalizeEAN(values.ean ?? "")}catch(error){errors.push(error instanceof Error?error.message:"EAN inválido")}
    const row:CatalogRow={sku:values.sku||"",nome_oficial:values.nome_oficial||"",marca:values.marca||"",linha:values.linha||"",categoria:values.categoria||"",especificacao_tecnica:values.especificacao_tecnica||"",cor:values.cor||"",peso:values.peso||"",arquivo_imagem:values.arquivo_imagem||"",sinonimos:[...new Set((values.sinonimos||"").split(/[|,;\r\n]+/).map(normalizeCatalog).filter(Boolean))].sort(),ean};
    records.push({line:r+1,row,errors});
  }
  const skus=new Map<string,number[]>();records.forEach(({row,line})=>{if(row.sku)skus.set(row.sku,[...(skus.get(row.sku)||[]),line])});
  const duplicates=[...skus].filter(([,lines])=>lines.length>1).map(([sku,lines])=>({sku,lines}));
  const duplicateSKUs=new Set(duplicates.map(d=>d.sku));
  const counts=new Map<string,number>();filenames.forEach(n=>counts.set(imageFilename(n),(counts.get(imageFilename(n))||0)+1));
  const valid=records.filter(r=>!r.errors.length&&!duplicateSKUs.has(r.row.sku));
  const references=new Set(records.map(r=>imageFilename(r.row.arquivo_imagem)));
  return {rows:valid.map(r=>r.row),errors:records.filter(r=>r.errors.length).map(r=>({line:r.line,errors:r.errors})),duplicates,
    missingImages:valid.filter(r=>!counts.has(imageFilename(r.row.arquivo_imagem))).map(r=>({line:r.line,sku:r.row.sku,file:r.row.arquivo_imagem})),
    unusedImages:filenames.filter(n=>!references.has(imageFilename(n))),ambiguousImages:[...counts].filter(([,n])=>n>1).map(([name])=>name),total:records.length};
}
export type CatalogMaterial = {id:string;nome:string;ean:string|null;catalogo_sku?:string|null};
type CatalogIndex = {ean:Map<string,CatalogEntry[]>;name:Map<string,CatalogEntry[]>;synonym:Map<string,CatalogEntry[]>;sku:Map<string,CatalogEntry>};
const indexesByCatalog=new WeakMap<CatalogEntry[],CatalogIndex>();
function indexCatalog(catalog:CatalogEntry[]) {
  let index=indexesByCatalog.get(catalog);if(index)return index;
  index={ean:new Map(),name:new Map(),synonym:new Map(),sku:new Map()};
  const add=(map:Map<string,CatalogEntry[]>,key:string,row:CatalogEntry)=>{if(key)map.set(key,[...(map.get(key)||[]),row]);};
  for(const row of catalog){index.sku.set(row.sku,row);if(row.ean)add(index.ean,row.ean,row);add(index.name,normalizeCatalog(row.nome_oficial),row);for(const synonym of new Set(row.sinonimos))add(index.synonym,synonym,row);}
  indexesByCatalog.set(catalog,index);return index;
}
export function matchCatalog(material: CatalogMaterial, catalog: CatalogEntry[]) {
  const index=indexCatalog(catalog);
  const key=normalizeCatalog(material.nome);
  const eligible=(items:CatalogEntry[])=>items.filter(c=>!material.ean||!c.ean||material.ean===c.ean);
  const stages:[string,CatalogEntry[]][]=[
    ["ean",material.ean?index.ean.get(material.ean)||[]:[]],
    ["nome",eligible(index.name.get(key)||[])],
    ["sinonimo",eligible(index.synonym.get(key)||[])],
  ];
  for(const [method,items] of stages)if(items.length)return {entry:items.length===1?items[0]:null,method,ambiguous:items.length>1};
  const manual=material.catalogo_sku?index.sku.get(material.catalogo_sku):null;
  return {entry:manual||null,method:manual?"manual":null,ambiguous:false};
}
export function catalogSuggestions(material: CatalogMaterial, catalog: CatalogEntry[]) {
  const words=new Set(normalizeCatalog(material.nome).split(" ").filter(Boolean));
  return catalog.map(entry=>{const other=new Set(normalizeCatalog(entry.nome_oficial).split(" ").filter(Boolean));const shared=[...words].filter(w=>other.has(w)).length;return {entry,score:shared/(new Set([...words,...other]).size||1)}})
    .filter(r=>r.score>=0.25).sort((a,b)=>b.score-a.score||a.entry.sku.localeCompare(b.entry.sku)).slice(0,3);
}

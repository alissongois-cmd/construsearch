"use server";
import { convertCatalogImage } from "@/lib/catalog-image";
import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireCatalogAdmin } from "@/lib/catalog-server";
import { normalizeCatalog, requiredCatalog, type CatalogRow } from "@/lib/image-catalog";
import { normalizeEAN } from "@/lib/ean";

export async function uploadCatalogImage(form:FormData):Promise<{path?:string;error?:string}> {
  const {supabase,user}=await requireCatalogAdmin();
  try {
    const file=form.get("imagem");
    if(!(file instanceof File)||!file.size||file.size>2*1024*1024)throw new Error("Imagem deve ter até 2 MB após redução no navegador.");
    const input=Buffer.from(await file.arrayBuffer());
    const output=await convertCatalogImage(input);
    const path=`${user.id}/catalogo/${createHash("sha256").update(output).digest("hex")}.webp`;
    const {error}=await supabase.storage.from("materiais-imagens").upload(path,output,{contentType:"image/webp",upsert:true,cacheControl:"3600"});
    if(error){console.error("[catalogo.upload]",error);throw new Error("Não foi possível salvar a imagem no bucket.");}
    return {path};
  }catch(error){return {error:error instanceof Error?error.message:"Falha no upload"};}
}
export async function saveCatalogBatch(input:{row:CatalogRow;path?:string}[]):Promise<{saved:number;error?:string}> {
  const {supabase,user}=await requireCatalogAdmin();
  try{
    if(!Array.isArray(input)||!input.length||input.length>25)throw new Error("Use lotes de até 25 registros.");
    const keys=["sku","nome_oficial","marca","linha","categoria","especificacao_tecnica","cor","peso","arquivo_imagem"] as const;
    for(const {row,path} of input){
      if(!row||keys.some(k=>typeof row[k]!=="string"||row[k].length>4000)||requiredCatalog.some(k=>!row[k].trim())||row.sku.length>160)throw new Error("Linha inválida ou campo obrigatório vazio.");
      if(!Array.isArray(row.sinonimos)||row.sinonimos.length>100||row.sinonimos.some(v=>typeof v!=="string"||v.length>500))throw new Error("Sinônimos inválidos (máximo 100 por produto).");
      if(path&&!new RegExp(`^${user.id}/catalogo/[a-f0-9]{64}\\.webp$`).test(path))throw new Error("Caminho de imagem inválido.");
      normalizeEAN(row.ean||"");
    }
    if(new Set(input.map(v=>v.row.sku)).size!==input.length)throw new Error("SKU duplicado no lote.");
    const {data:existing,error:readError}=await supabase.from("catalogo_imagens").select("sku,imagem_path,imagem_url").in("sku",input.map(v=>v.row.sku));
    if(readError)throw new Error("Não foi possível consultar o catálogo existente.");
    const rows=input.map(({row,path})=>{
      const previous=existing?.find(v=>v.sku===row.sku);
      const imagem_path=path||previous?.imagem_path||null;
      return {...Object.fromEntries(keys.map(k=>[k,row[k].trim()])),ean:normalizeEAN(row.ean||""),sinonimos:[...new Set(row.sinonimos.map(normalizeCatalog).filter(Boolean))],imagem_path,
        imagem_url:path?supabase.storage.from("materiais-imagens").getPublicUrl(path).data.publicUrl:previous?.imagem_url||null};
    });
    const {data,error}=await supabase.from("catalogo_imagens").upsert(rows,{onConflict:"sku"}).select("sku");
    if(error){console.error("[catalogo.import]",error);throw new Error("Falha ao salvar o lote; reimporte para tentar novamente.");}
    for(const page of ["/admin/catalogo-imagens","/admin/materiais","/lista","/"])revalidatePath(page);
    return {saved:data?.length||0};
  }catch(error){return {saved:0,error:error instanceof Error?error.message:"Falha na importação"};}
}
export async function confirmCatalogMatch(form:FormData) {
  const {supabase}=await requireCatalogAdmin();
  const id=String(form.get("material_id")||"");const sku=String(form.get("sku")||"");
  if(!/^[a-f0-9-]{36}$/i.test(id)||!sku)throw new Error("Vínculo inválido.");
  const {error}=await supabase.from("materiais").update({catalogo_sku:sku}).eq("id",id);
  if(error){console.error("[catalogo.vincular]",error);throw new Error("Não foi possível confirmar o vínculo.");}
  for(const page of ["/admin/catalogo-imagens","/admin/materiais","/lista","/"])revalidatePath(page);
  redirect("/admin/catalogo-imagens?resultado=vinculado");
}

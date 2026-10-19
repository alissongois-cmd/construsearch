import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import type { CatalogEntry, CatalogMaterial } from "./image-catalog";
export async function requireCatalogAdmin() {
  const supabase=await createClient();
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login?redirectTo=/admin/catalogo-imagens");
  const {data,error}=await supabase.rpc("is_catalog_admin");
  if(error||!data)throw new Error("Acesso restrito aos e-mails administradores permitidos.");
  return {supabase,user};
}
export async function loadImageCatalog():Promise<CatalogEntry[]> {
  const supabase=await createClient();const rows:CatalogEntry[]=[];
  for(let from=0;;from+=500){
    const {data,error}=await supabase.from("catalogo_imagens").select("*").order("sku").range(from,from+499);
    if(error)throw new Error("Não foi possível carregar o catálogo. Confira a migração.");
    rows.push(...(data||[]));if(!data||data.length<500)return rows;
  }
}
export async function loadCatalogMaterials():Promise<CatalogMaterial[]> {
  const supabase=await createClient();const rows:CatalogMaterial[]=[];
  for(let from=0;;from+=500){
    const {data,error}=await supabase.from("materiais").select("id,nome,ean,catalogo_sku").order("id").range(from,from+499);
    if(error)throw new Error("Não foi possível carregar os materiais.");
    rows.push(...(data||[]));if(!data||data.length<500)return rows;
  }
}

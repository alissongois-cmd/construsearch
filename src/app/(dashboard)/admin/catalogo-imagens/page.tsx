import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { loadImageCatalog, loadCatalogMaterials } from "@/lib/catalog-server";
import { matchCatalog, catalogSuggestions } from "@/lib/image-catalog";
import { CatalogImport } from "@/components/catalog-import";
import { MaterialImage } from "@/components/material-image";
import { CatalogMatchForm } from "@/components/catalog-match-form";
import { RelinkEANButton } from "@/components/relink-ean-button";
export default async function CatalogPage() {
  const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/login?redirectTo=/admin/catalogo-imagens");
  const access=await supabase.rpc("is_catalog_admin");
  if(access.error||!access.data)return <p role="alert">Acesso restrito. Configure os e-mails permitidos e aplique a migração do catálogo antes de usar esta tela.</p>;
  try{
    const [catalog,materials]=await Promise.all([loadImageCatalog(),loadCatalogMaterials()]);
    const {data:eanConflicts}=await supabase.from("catalogo_ean_conflitos").select("ean_normalizado,skus").order("ean_normalizado");
    const withoutPhoto=materials.filter(material=>material.ean&&!material.catalogo_sku);
    const missingEANs=new Map<string,number>();
    for(const material of withoutPhoto)missingEANs.set(material.ean!, (missingEANs.get(material.ean!)||0)+1);
    const matches=materials.map(material=>({material,match:matchCatalog(material,catalog)}));
    const methods:Record<string,string>={ean:"EAN",nome:"nome oficial",sinonimo:"sinônimo exato",manual:"confirmação manual"};
    return <div className="space-y-8"><CatalogImport /><section className="rounded border border-mist p-4"><h2 className="text-xl font-bold">Vínculo automático por EAN</h2><p className="my-2 text-sm">Associa materiais ao SKU do catálogo pelo GTIN-14 validado, sem depender do nome. Vínculos manuais são preservados.</p><RelinkEANButton /></section>
      <section><h2 className="text-xl font-bold">Vínculos com materiais</h2><p className="mt-2 text-sm">EAN → nome oficial → sinônimo exato. Correspondências ambíguas não são escolhidas. Similaridade só é aplicada após sua confirmação.</p>
        <ul className="mt-4 space-y-3">{matches.map(({material,match})=><li key={material.id} className="rounded border border-mist p-4">
          <h3 className="font-bold">{material.nome}</h3>
          {match.entry?<div className="mt-2 flex items-center gap-3"><MaterialImage name={match.entry.nome_oficial} catalog={match.entry.imagem_url} className="w-16" /><p>SKU {match.entry.sku} · {methods[match.method||""]}</p></div>:<>
            <p className="mt-2 text-sm">{match.ambiguous?"Correspondência exata ambígua — revise os cadastros.":"Sem vínculo exato. Sugestões para revisão:"}</p>
            {!match.ambiguous&&<ul>{catalogSuggestions(material,catalog).map(({entry,score})=><li key={entry.sku} className="mt-3 flex flex-wrap items-center gap-3 text-sm"><span>{entry.sku} · {entry.nome_oficial} ({Math.round(score*100)}% de palavras em comum)</span><CatalogMatchForm materialId={material.id} sku={entry.sku} /></li>)}</ul>}
          </>}
        </li>)}</ul>
      </section><section><h2 className="text-xl font-bold">Conflitos de EAN no catálogo</h2><p className="mt-1 text-sm text-ash">EANs legados encontrados em mais de um SKU. Eles não são usados para vincular materiais.</p><ul className="mt-3 space-y-2">{(eanConflicts||[]).map(conflict=><li key={conflict.ean_normalizado} className="rounded border border-mist p-3 text-sm">EAN {conflict.ean_normalizado} · SKUs: {conflict.skus.join(", ")}</li>)}</ul>{!eanConflicts?.length&&<p className="mt-2 text-sm">Nenhum conflito legado.</p>}</section><section><h2 className="text-xl font-bold">EANs sem foto no catálogo</h2><p className="mt-1 text-sm text-ash">{withoutPhoto.length} materiais sem vínculo de catálogo.</p><ul className="mt-3 space-y-2">{[...missingEANs].map(([ean,count])=><li key={ean} className="rounded border border-mist p-3 text-sm">EAN {ean} · {count} {count===1?"material":"materiais"}</li>)}</ul></section><section><h2 className="text-xl font-bold">Catálogo · {catalog.length} SKUs</h2><ul className="mt-4 grid gap-3 md:grid-cols-2">{catalog.map(entry=><li key={entry.sku} className="flex items-center gap-3 rounded border border-mist p-4"><MaterialImage name={entry.nome_oficial} catalog={entry.imagem_url} className="w-16" /><div><h3 className="font-bold">{entry.sku} · {entry.nome_oficial}</h3><p className="text-sm">{entry.marca} · {entry.categoria}</p><p className="text-xs text-ash">{entry.sinonimos.join(" · ")}</p></div></li>)}</ul></section>
    </div>;
  }catch{return <p role="alert">Não foi possível carregar o catálogo ou os materiais. Confira a migração e tente novamente.</p>;}
}

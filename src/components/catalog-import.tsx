"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseImageCatalog, imageFilename } from "@/lib/image-catalog";
import { uploadCatalogImage, saveCatalogBatch } from "@/app/(dashboard)/admin/catalogo-imagens/actions";
type Report=ReturnType<typeof parseImageCatalog>;
async function resizeImage(file:File) {
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw new Error("Use JPG, PNG ou WebP.");
  const image=await createImageBitmap(file);
  try{
    const ratio=Math.min(1,800/image.width,800/image.height);
    const canvas=document.createElement("canvas");canvas.width=Math.max(1,Math.round(image.width*ratio));canvas.height=Math.max(1,Math.round(image.height*ratio));
    const context=canvas.getContext("2d");if(!context)throw new Error("Conversão não disponível no navegador.");
    context.drawImage(image,0,0,canvas.width,canvas.height);
    const blob=await new Promise<Blob>((resolve,reject)=>canvas.toBlob(value=>value?resolve(value):reject(new Error("Não foi possível converter a imagem")),"image/webp",0.85));
    return new File([blob],"imagem.webp",{type:blob.type});
  }finally{image.close();}
}
export function CatalogImport() {
  const router=useRouter();const [report,setReport]=useState<Report|null>(null);const [saved,setSaved]=useState<number|null>(null);const [errors,setErrors]=useState<string[]>([]);const [progress,setProgress]=useState("");const [busy,setBusy]=useState(false);const [csv,setCsv]=useState<File|null>(null);const [images,setImages]=useState<File[]>([]);
  async function preview(){if(!csv)throw new Error("Selecione o CSV.");if(csv.size>1024*1024)throw new Error("CSV deve ter até 1 MB.");const result=parseImageCatalog(new Uint8Array(await csv.arrayBuffer()),images.map(f=>f.name));setReport(result);return result;}
  async function run(importing:boolean){setBusy(true);setErrors([]);setSaved(null);let count=0;const failures:string[]=[];
    try{
      const result=await preview();if(!importing)return;
      const paths=new Map<string,string>();const invalid=new Set(result.ambiguousImages);
      const used=new Set(result.rows.map(row=>imageFilename(row.arquivo_imagem)));
      for(const file of images){const key=imageFilename(file.name);if(!used.has(key)||invalid.has(key))continue;
        setProgress(`Convertendo e enviando ${file.name}…`);
        try{const form=new FormData();form.set("imagem",await resizeImage(file));const uploaded=await uploadCatalogImage(form);if(!uploaded.path)throw new Error(uploaded.error||"Falha no upload");paths.set(key,uploaded.path);}catch(error){invalid.add(key);failures.push(`${file.name}: ${error instanceof Error?error.message:"Falha no upload"}`);}
      }
      const rows=result.rows.filter(row=>!invalid.has(imageFilename(row.arquivo_imagem)));
      for(let i=0;i<rows.length;i+=25){setProgress(`Salvando registros ${i+1} a ${Math.min(rows.length,i+25)}…`);const batch=rows.slice(i,i+25).map(row=>({row,path:paths.get(imageFilename(row.arquivo_imagem))}));const response=await saveCatalogBatch(batch);count+=response.saved;if(response.error)failures.push(`${batch.map(v=>v.row.sku).join(", ")}: ${response.error}`);}
      setSaved(count);setErrors(failures);router.refresh();
    }catch(error){setErrors([...failures,error instanceof Error?error.message:"Falha na importação"]);setSaved(importing?count:null);}finally{setBusy(false);setProgress("");}
  }
  return <section className="rounded border border-mist p-5">
    <h2 className="text-xl font-bold">Importar catálogo mestre</h2>
    <p className="mt-2 text-sm">CSV UTF-8 separado por ponto e vírgula, até 1 MB e 2000 linhas. Obrigatórios: ID SKU, Nome Oficial do Produto, Categoria e Arquivo de Imagem. EAN é uma coluna adicional opcional.</p>
    <p className="mt-2 text-sm">Selecione o CSV e todas as imagens. O nome do arquivo é comparado sem diferenciar caixa. Sinônimos: separe com |, vírgula ou ponto e vírgula dentro de uma célula entre aspas.</p>
    <label className="mt-4 block text-sm font-bold">CSV do catálogo<input disabled={busy} type="file" accept=".csv" onChange={e=>{setCsv(e.target.files?.[0]||null);setReport(null);setSaved(null)}} className="mt-2 block w-full" /></label>
    <label className="mt-4 block text-sm font-bold">Imagens do catálogo (seleção múltipla)<input disabled={busy} type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={e=>{setImages(Array.from(e.target.files||[]));setReport(null);setSaved(null)}} className="mt-2 block w-full" /></label>
    <p className="mt-3 text-xs text-ash">Imagens são reduzidas para até 800 px e WebP. Uploads e registros são enviados em chamadas pequenas para funcionar no Netlify. Arquivos sem linha não são enviados; SKUs e nomes de arquivo ambíguos são ignorados.</p>
    <div className="mt-4 flex gap-3"><button disabled={busy||!csv} onClick={()=>run(false)} className="rounded border border-carbon px-4 py-2 disabled:opacity-50">Validar sem importar</button><button disabled={busy||!csv} onClick={()=>run(true)} className="rounded bg-carbon px-4 py-2 text-white disabled:opacity-50">Importar registros válidos</button></div>
    {busy&&<p role="status" className="mt-3">{progress||"Validando…"}</p>}
    {saved!==null&&<p role="status" className="mt-3 font-bold">{saved} SKUs gravados/atualizados.</p>}
    {errors.length>0&&<ul role="alert" className="mt-3 list-disc pl-5">{errors.map((error,i)=><li key={i}>{error}</li>)}</ul>}
    {report&&<div className="mt-4 space-y-2 text-sm">
      <p>{report.total} linhas · {report.rows.length} válidas · {report.errors.length} com erros · {report.duplicates.length} SKUs duplicados</p>
      <p>Sem imagem selecionada: {report.missingImages.length}. Na reimportação, a imagem existente será preservada.</p>
      <ul>{report.missingImages.map(r=><li key={r.line}>Linha {r.line} · {r.sku}: imagem não encontrada ({r.file})</li>)}</ul>
      <p>Imagens sem linha: {report.unusedImages.join(", ")||"nenhuma"}</p>
      <p>Imagens com nome ambíguo: {report.ambiguousImages.join(", ")||"nenhuma"}</p>
      <ul>{report.duplicates.map(r=><li key={r.sku}>SKU duplicado {r.sku}: linhas {r.lines.join(", ")} (ignoradas)</li>)}{report.errors.map(r=><li key={r.line}>Linha {r.line}: {r.errors.join("; ")}</li>)}</ul>
    </div>}
  </section>;
}

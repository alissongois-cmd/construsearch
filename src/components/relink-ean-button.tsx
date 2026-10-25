"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { relinkCatalogByEAN } from "@/app/(dashboard)/admin/catalogo-imagens/actions";

export function RelinkEANButton() {
  const [busy,setBusy]=useState(false);
  const [report,setReport]=useState<{success:boolean;message:string;linked?:number;missing?:number;conflicts?:number}|null>(null);
  const router=useRouter();
  async function run(){
    setBusy(true);setReport(null);
    try { const result=await relinkCatalogByEAN();setReport(result);if(result.success)router.refresh(); }
    catch { setReport({success:false,message:"Não foi possível executar a revinculação."}); }
    finally { setBusy(false); }
  }
  return <div className="space-y-2">
    <button type="button" disabled={busy} onClick={run} className="rounded bg-carbon px-4 py-2 text-white disabled:opacity-50">
      {busy?"Revinculando…":"Revincular por EAN"}
    </button>
    {report&&<p role={report.success?"status":"alert"} className="text-sm">
      {report.message}{report.success&&" Vinculados: "+report.linked+" · Sem correspondência: "+report.missing+" · Conflitos: "+report.conflicts}
    </p>}
  </div>;
}

"use client";

import { useActionState } from "react";
import { confirmCatalogMatch } from "@/app/(dashboard)/admin/catalogo-imagens/actions";

export function CatalogMatchForm({materialId,sku}:{materialId:string;sku:string}) {
  const [state,action,pending]=useActionState(confirmCatalogMatch,{success:false,message:""});
  return <form action={action} className="space-y-2" aria-busy={pending}>
    <input type="hidden" name="material_id" value={materialId} />
    <input type="hidden" name="sku" value={sku} />
    <button disabled={pending||state.success} className="rounded border border-carbon px-3 py-2 disabled:opacity-60">
      {pending?"Confirmando…":state.success?"Vínculo confirmado":"Confirmar vínculo"}
    </button>
    {state.message&&<p role={state.success?"status":"alert"}>{state.message}</p>}
  </form>;
}

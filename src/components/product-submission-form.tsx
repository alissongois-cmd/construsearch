"use client";

import { useActionState } from "react";
import { submitProduct } from "@/app/cadastrar-produto/actions";

const fields = [
  ["nome_loja", "Nome da loja", "Ex.: Depósito São João"],
  ["cidade", "Cidade", "Ex.: São Paulo"],
  ["contato", "Contato / WhatsApp (opcional)", "Ex.: (11) 99999-9999"],
  ["nome_produto", "Nome do produto", "Ex.: Cimento CP II 50 kg"],
  ["categoria", "Categoria", "Ex.: cimento"],
  ["unidade_medida", "Unidade de medida", "Ex.: saco 50 kg"],
] as const;

export function ProductSubmissionForm() {
  const [state, action, pending] = useActionState(submitProduct, { success: false, message: "" });
  if (state.success) {
    return <div role="status" className="rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900"><h2 className="mb-2 text-lg font-bold">Obrigado pelo envio!</h2><p>{state.message}</p><button onClick={() => window.location.reload()} className="mt-4 font-semibold underline">Enviar outro produto</button></div>;
  }
  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {fields.map(([name, label, placeholder]) => (
        <label key={name} className="block text-sm font-medium">
          {label}
          <input name={name} required={name !== "contato"} maxLength={160} type={name === "contato" ? "tel" : "text"} placeholder={placeholder} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </label>
      ))}
      <label className="block text-sm font-medium">Preço (R$)
        <input name="preco" type="text" inputMode="decimal" required maxLength={13} pattern="[0-9]{1,10}([.,][0-9]{1,2})?" placeholder="Ex.: 35,90" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </label>
      <div hidden aria-hidden="true"><label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label></div>
      {state.message && <p role="alert" className="text-sm text-red-700">{state.message}</p>}
      <p className="text-sm text-slate-600">Seu envio será analisado antes de aparecer na busca. Não é necessário criar uma conta.</p>
      <button disabled={pending} className="w-full rounded-md bg-carbon px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Enviando..." : "Enviar produto para análise"}</button>
    </form>
  );
}

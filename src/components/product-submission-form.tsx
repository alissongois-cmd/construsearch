"use client";

import { useActionState } from "react";
import { submitProduct, type SubmissionState } from "@/app/cadastrar-produto/actions";

import { ShippingFields } from "@/components/shipping-fields";

const fields = [
  ["nome_loja", "Nome da loja", "Ex.: Depósito São João"],
  ["cidade", "Cidade", "Ex.: São Paulo"],
  ["contato", "Contato / WhatsApp (opcional)", "Ex.: (11) 99999-9999"],
] as const;
const initialState: SubmissionState = { success: false, message: "", received: 0, ignored: [] };

function SubmissionSummary({ state }: { state: SubmissionState }) {
  return (
    <div role={state.success ? "status" : "alert"} className={state.success ? "rounded-xl border border-emerald-300 bg-emerald-50 p-6 text-emerald-900" : "rounded-md border border-red-200 bg-red-50 p-4 text-red-800"}>
      <h2 className="mb-2 text-lg font-bold">{state.received} {state.received === 1 ? "produto recebido" : "produtos recebidos"} com sucesso</h2>
      <p>{state.message}</p>
      {state.ignored.length > 0 && <><p className="mt-3 font-semibold">{state.ignored.length} {state.ignored.length === 1 ? "linha ignorada" : "linhas ignoradas"}:</p><ul className="mt-1 list-disc space-y-1 pl-5">{state.ignored.map(({ line, reason }) => <li key={line}>Linha {line}: {reason}.</li>)}</ul></>}
    </div>
  );
}

export function ProductSubmissionForm() {
  const [state, action, pending] = useActionState(submitProduct, initialState);
  if (state.success) {
    return <div><SubmissionSummary state={state} /><p className="mt-3 text-sm text-slate-600">Para corrigir as linhas ignoradas, envie uma nova planilha apenas com esses produtos.</p><button onClick={() => window.location.reload()} className="mt-4 font-semibold underline">Enviar outra planilha</button></div>;
  }
  return (
    <form action={action} className="space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {fields.map(([name, label, placeholder]) => (
        <label key={name} className="block text-sm font-medium">
          {label}
          <input name={name} required={name !== "contato"} maxLength={160} type={name === "contato" ? "tel" : "text"} placeholder={placeholder} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
        </label>
      ))}
      <ShippingFields />
      <div className="rounded-md bg-slate-50 p-4 text-sm text-slate-700">
        <a href="/modelo-produtos.csv" download="modelo-produtos.csv" className="font-semibold text-orange-700 underline">Baixar modelo de planilha (CSV)</a>
        <p className="mt-2">Preencha nome_produto e preco em cada linha. Categoria e unidade_medida são opcionais. Use preços positivos, sem R$, com até duas casas decimais.</p>
        <p className="mt-2">Arquivos CSV ou XLSX de até 1 MB e 500 linhas de produtos, além do cabeçalho. Em XLSX, usamos a primeira aba. Linhas vazias são desconsideradas.</p>
      </div>
      <label className="block text-sm font-medium">Planilha de produtos
        <input name="arquivo" type="file" accept=".csv,.xlsx" required aria-describedby="file-help" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-orange-500" />
      </label>
      <p id="file-help" className="text-sm text-slate-600">Os dados da loja serão associados a todos os produtos válidos da planilha.</p>
      <div hidden aria-hidden="true"><label>Website<input name="website" type="text" tabIndex={-1} autoComplete="off" /></label></div>
      {state.message && <SubmissionSummary state={state} />}
      <p className="text-sm text-slate-600">Seu envio será analisado antes de aparecer na busca. Não é necessário criar uma conta.</p>
      <button disabled={pending} className="w-full rounded-md bg-carbon px-4 py-3 font-semibold text-white hover:opacity-90 disabled:opacity-60">{pending ? "Enviando..." : "Enviar produtos para análise"}</button>
    </form>
  );
}

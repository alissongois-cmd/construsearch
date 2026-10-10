import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { approveSubmission, rejectSubmission } from "./actions";

type Submission = {
  id: string; nome_loja: string; cidade: string; contato: string | null;
  nome_produto: string; categoria: string; unidade_medida: string;
  preco: number; created_at: string;
};

export default async function PendingSubmissionsPage({ searchParams }: {
  searchParams: Promise<{ resultado?: string }>;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/pendentes");
  const { data, error } = await supabase.from("envios_pendentes")
    .select("id,nome_loja,cidade,contato,nome_produto,categoria,unidade_medida,preco,created_at")
    .eq("status", "pendente").order("created_at");
  const { resultado } = await searchParams;
  const submissions = (data ?? []) as Submission[];
  return (
    <section>
      <h2 className="text-xl font-bold text-slate-900">Produtos pendentes de aprovação</h2>
      <p className="mt-2 text-sm text-slate-600">Aprovar publica o produto e seu preço. Rejeitar mantém o envio no histórico, sem publicação.</p>
      {resultado === "processado" && <p role="status" className="mt-4 text-emerald-700">Envio processado. A lista foi atualizada.</p>}
      {(error || resultado === "erro") && <p role="alert" className="mt-4 text-red-700">Não foi possível concluir a operação. Tente novamente.</p>}
      {!error && submissions.length === 0 && <p className="mt-6 rounded-xl border bg-white p-6">Nenhum envio pendente.</p>}
      <ul className="mt-6 space-y-4">
        {submissions.map((item) => (
          <li key={item.id} className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
            <h3 className="text-lg font-bold">{item.nome_produto}</h3>
            <p>{item.categoria} · {item.unidade_medida}</p>
            <p className="mt-2 font-semibold">{Number(item.preco).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
            <p className="mt-2">{item.nome_loja} · {item.cidade}</p>
            {item.contato && <p className="text-sm">Contato: {item.contato}</p>}
            <p className="mt-1 text-xs text-slate-500">Recebido em {new Date(item.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}</p>
            <div className="mt-4 flex gap-3">
              <form action={approveSubmission}><input type="hidden" name="id" value={item.id} /><button className="rounded-md bg-emerald-700 px-4 py-2 font-semibold text-white hover:bg-emerald-800">Aprovar</button></form>
              <form action={rejectSubmission}><input type="hidden" name="id" value={item.id} /><button className="rounded-md border border-red-700 px-4 py-2 font-semibold text-red-700 hover:bg-red-50">Rejeitar</button></form>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}

import { createPreco, deletePreco } from "../actions";
import { createClient } from "@/lib/supabase/server";

type Option = { id: string; nome: string };
type Relation<T> = T | T[] | null;
type Price = { id: string; valor: number | string; data_atualizacao: string; materiais: Relation<{ nome: string }>; lojas: Relation<{ nome: string; cidade: string }> };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function firstRelation<T>(relation: Relation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export default async function PrecosPage() {
  const supabase = await createClient();
  const [{ data: materiaisData }, { data: lojasData }, { data: precosData }] = await Promise.all([
    supabase.from("materiais").select("id, nome").order("nome"),
    supabase.from("lojas").select("id, nome").order("nome"),
    supabase.from("precos").select("id, valor, data_atualizacao, materiais(nome), lojas(nome, cidade)").order("data_atualizacao", { ascending: false }),
  ]);
  const materiais = (materiaisData ?? []) as Option[];
  const lojas = (lojasData ?? []) as Option[];
  const precos: Price[] = precosData ?? [];
  const canAddPrice = materiais.length > 0 && lojas.length > 0;

  return <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]"><section><h2 className="text-xl font-bold text-slate-900">Novo preço</h2><p className="mt-1 text-sm text-slate-600">Informe o valor de um material em uma loja.</p><form action={createPreco} className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"><label className="block text-sm font-medium">Material<select required disabled={!canAddPrice} name="material_id" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-blue-500 focus:ring-2"><option value="">Selecione um material</option>{materiais.map((material) => <option key={material.id} value={material.id}>{material.nome}</option>)}</select></label><label className="block text-sm font-medium">Loja<select required disabled={!canAddPrice} name="loja_id" className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 outline-none ring-blue-500 focus:ring-2"><option value="">Selecione uma loja</option>{lojas.map((loja) => <option key={loja.id} value={loja.id}>{loja.nome}</option>)}</select></label><label className="block text-sm font-medium">Valor<input required disabled={!canAddPrice} name="valor" type="number" step="0.01" min="0" inputMode="decimal" className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2" placeholder="0,00" /></label>{!canAddPrice && <p className="text-sm text-amber-700">Cadastre ao menos um material e uma loja antes de incluir preços.</p>}<button disabled={!canAddPrice} className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">Adicionar preço</button></form></section><section><h2 className="text-xl font-bold text-slate-900">Preços cadastrados</h2><div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{precos.length === 0 ? <p className="p-6 text-sm text-slate-600">Nenhum preço cadastrado.</p> : <ul className="divide-y divide-slate-200">{precos.map((preco) => { const material = firstRelation(preco.materiais); const loja = firstRelation(preco.lojas); return <li key={preco.id} className="flex items-center justify-between gap-4 p-4"><div><p className="font-semibold text-slate-900">{material?.nome ?? "Material removido"}</p><p className="text-sm text-slate-600">{loja?.nome ?? "Loja removida"}{loja?.cidade ? ` · ${loja.cidade}` : ""}</p><p className="mt-1 text-sm font-medium text-emerald-700">{currency.format(Number(preco.valor))} · {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(preco.data_atualizacao))}</p></div><form action={deletePreco}><input type="hidden" name="id" value={preco.id} /><button className="text-sm font-medium text-red-600 hover:underline">Excluir</button></form></li>; })}</ul>}</div></section></div>;
}

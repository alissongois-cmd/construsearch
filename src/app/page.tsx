import { Header } from "@/components/header";
import { createClient } from "@/lib/supabase/server";

type Relation<T> = T | T[] | null;
type SearchResult = { valor: number | string; data_atualizacao: string; materiais: Relation<{ nome: string }>; lojas: Relation<{ nome: string; cidade: string }> };
const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

function firstRelation<T>(relation: Relation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export default async function Home({ searchParams }: { searchParams: Promise<{ query?: string }> }) {
  const { query = "" } = await searchParams;
  const searchTerm = query.trim();
  let results: SearchResult[] = [];

  if (searchTerm) {
    const supabase = await createClient();
    const { data } = await supabase.from("precos").select("valor, data_atualizacao, materiais!inner(nome), lojas!inner(nome, cidade)").ilike("materiais.nome", `%${searchTerm}%`).order("valor", { ascending: true });
    results = data ?? [];
  }

  return <><Header /><main className="mx-auto max-w-6xl px-6 py-20"><p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">Planeje melhor sua obra</p><h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Encontre e compare materiais de construção.</h1><p className="mt-5 max-w-2xl text-lg text-slate-600">Pesquise produtos e encontre os menores preços nas lojas cadastradas.</p><form className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row"><label className="sr-only" htmlFor="search">Buscar materiais</label><input id="search" name="query" defaultValue={searchTerm} type="search" placeholder="Ex.: cimento, argamassa, piso..." className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 outline-none ring-blue-500 focus:ring-2" /><button type="submit" className="rounded-md bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Buscar</button></form>{searchTerm && <section className="mt-12 max-w-4xl" aria-live="polite"><h2 className="text-2xl font-bold text-slate-900">Resultados para “{searchTerm}”</h2>{results.length === 0 ? <p className="mt-4 text-slate-600">Nenhum preço encontrado para este material.</p> : <ul className="mt-5 divide-y divide-slate-200 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">{results.map((result, index) => { const material = firstRelation(result.materiais); const loja = firstRelation(result.lojas); return <li key={`${material?.nome}-${loja?.nome}-${result.data_atualizacao}-${index}`} className="flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="font-semibold text-slate-900">{material?.nome}</p><p className="text-sm text-slate-600">{loja?.nome} · {loja?.cidade}</p></div><div className="sm:text-right"><p className="font-bold text-emerald-700">{currency.format(Number(result.valor))}</p><p className="text-sm text-slate-500">Atualizado em {new Intl.DateTimeFormat("pt-BR", { dateStyle: "medium" }).format(new Date(result.data_atualizacao))}</p></div></li>; })}</ul>}</section>}</main></>;
}

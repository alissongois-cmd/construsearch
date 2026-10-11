"use client";

import { useState } from "react";
import { SearchForm } from "@/components/search-form";
import { useShoppingList } from "@/components/shopping-list-provider";
import { rankStores, type Material } from "@/lib/shopping-list";

const currency = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });
const inputClass = "min-h-11 w-24 rounded-[4px] border border-mist bg-bone px-3 py-2";

export function ShoppingList() {
  const { items, setItems } = useShoppingList();
  const [results, setResults] = useState<Material[]>([]);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const stores = rankStores(items);
  const bestTotal = stores.find((store) => store.missing.length === 0)?.total;

  async function search(data: FormData) {
    const query = String(data.get("query") ?? "").trim();
    if (!query) return;
    setError("");
    try {
      const response = await fetch(`/api/lista/busca?query=${encodeURIComponent(query)}`, { cache: "no-store" });
      if (!response.ok) throw new Error();
      setResults(await response.json());
      setSearched(true);
    } catch {
      setError("Não foi possível buscar materiais. Tente novamente.");
      setResults([]);
      setSearched(false);
    }
  }

  return <>
    <SearchForm initialQuery="" action={search} />
    <div aria-live="polite" className="mt-4 text-sm">{error || notice}</div>
    <section aria-label="Materiais encontrados" className="mt-4">
      {searched && <p className="mb-3 text-sm text-ash">{results.length ? `${results.length} materiais encontrados (até 50). Refine a busca se necessário.` : "Nenhum material encontrado. Tente outro nome."}</p>}
      <ul className="grid gap-3 md:grid-cols-2">{results.map((material) => <li key={material.id} className="border border-mist p-4">
        <h2 className="font-bold">{material.name}</h2><p className="mt-1 text-sm text-ash">Unidade: {material.unit} · {material.offers.length} lojas com preço</p>
        <form className="mt-3 flex flex-wrap items-end gap-3" onSubmit={(event) => {
          event.preventDefault();
          const quantity = quantities[material.id] ?? 1;
          setItems((current) => {
            const existing = current.find((item) => item.id === material.id);
            return existing ? current.map((item) => item.id === material.id ? { ...material, quantity: item.quantity + quantity } : item) : [...current, { ...material, quantity }];
          });
          setNotice(`${material.name} adicionado à lista.`);
        }}>
          <label className="text-sm">Quantidade<input className={`${inputClass} ml-2`} type="number" min="0.01" step="0.01" required value={quantities[material.id] ?? 1} onChange={(event) => setQuantities((current) => ({ ...current, [material.id]: Number(event.target.value) }))} /></label>
          <button className="min-h-11 rounded-[4px] bg-carbon px-4 py-2 text-sm font-bold text-paper">Adicionar</button>
        </form>
      </li>)}</ul>
    </section>
    <section className="mt-10" aria-labelledby="list-heading">
      <h2 id="list-heading" className="border-b border-carbon pb-3 text-lg font-bold">Sua lista · {items.length} itens</h2>
      {!items.length && <p className="mt-4 text-sm text-ash">Busque materiais e adicione-os para comparar o total por loja.</p>}
      <ul>{items.map((item) => <li key={item.id} className="flex flex-wrap items-center justify-between gap-3 border-b border-mist py-4">
        <div><h3 className="font-bold">{item.name}</h3><p className="text-sm text-ash">Unidade: {item.unit}</p></div>
        <div className="flex flex-wrap items-center gap-3"><label className="text-sm">Quantidade de {item.name}<input className={`${inputClass} ml-2`} type="number" min="0.01" step="0.01" value={item.quantity} onChange={(event) => {
          const quantity = Number(event.target.value);
          if (event.target.validity.valid && Number.isFinite(quantity) && quantity > 0) setItems((current) => current.map((entry) => entry.id === item.id ? { ...entry, quantity } : entry));
        }} /></label><button className="min-h-11 px-3 text-sm underline" aria-label={`Remover ${item.name}`} onClick={() => setItems((current) => current.filter((entry) => entry.id !== item.id))}>Remover</button></div>
      </li>)}</ul>
    </section>
    {!!items.length && <section className="mt-10" aria-labelledby="ranking-heading" aria-live="polite">
      <h2 id="ranking-heading" className="text-lg font-bold">Total por loja</h2>
      <p className="mt-2 text-sm text-ash">Ordenado do menor ao maior total. Totais parciais incluem somente os itens com preço cadastrado e não representam a lista completa. Valores sem frete; confirme preço e estoque com a loja.</p>
      {bestTotal === undefined && <p className="mt-4 text-sm font-bold">Nenhuma loja tem preço para todos os itens da lista.</p>}
      {!stores.length && <p className="mt-4 text-sm">Nenhum preço cadastrado para os itens selecionados.</p>}
      <ol className="mt-4 grid gap-3 md:grid-cols-2">{stores.map((store) => {
        const complete = store.missing.length === 0;
        const best = complete && store.total === bestTotal;
        return <li key={store.id} className={`border border-mist p-5 ${best ? "border-l-[3px] border-l-best" : ""}`}>
          <h3 className="font-bold">{store.name}</h3><p className="text-sm text-ash">{store.city}</p>
          <p className={`mt-3 text-xs font-bold ${best ? "text-best" : "text-carbon"}`}>{best ? "Menor total completo" : complete ? "Lista completa" : "Cobertura parcial"} · {items.length - store.missing.length}/{items.length} itens</p>
          <p className={`mt-2 text-xl font-bold ${best ? "text-best" : "text-carbon"}`}>{currency.format(store.total)}{!complete && <span className="ml-2 text-sm">(parcial)</span>}</p>
          {!complete && <p className="mt-3 text-sm">Não disponível nesta loja: {store.missing.join(", ")}. Sem preço cadastrado para esses itens.</p>}
        </li>;
      })}</ol>
    </section>}
  </>;
}

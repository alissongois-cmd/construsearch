import { createLoja, deleteLoja, updateLoja } from "../actions";
import { createClient } from "@/lib/supabase/server";
import { ShippingFields } from "@/components/shipping-fields";
import type { Shipping } from "@/lib/shipping";

type Loja = Shipping & { id: string; nome: string; cidade: string; contato: string | null };

function StoreFields({ loja }: { loja?: Loja }) {
  return <>
    <label className="block text-sm font-medium">Nome<input required name="nome" defaultValue={loja?.nome} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
    <label className="block text-sm font-medium">Cidade<input required name="cidade" defaultValue={loja?.cidade} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
    <label className="block text-sm font-medium">Contato (opcional)<input name="contato" defaultValue={loja?.contato ?? ""} className="mt-1 w-full rounded-md border px-3 py-2" /></label>
    <ShippingFields store={loja} />
  </>;
}

export default async function LojasPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.from("lojas").select("id, nome, cidade, contato, frete_fixo, frete_gratis_acima").order("nome");
  const lojas = (data ?? []) as Loja[];
  return <div className="grid gap-8 lg:grid-cols-2">
    <section>
      <h2 className="text-xl font-bold">Nova loja</h2>
      <form action={createLoja} className="mt-5 space-y-4 rounded-xl border bg-white p-6">
        <StoreFields />
        <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Adicionar loja</button>
      </form>
    </section>
    <section>
      <h2 className="text-xl font-bold">Lojas cadastradas</h2>
      {error && <p role="alert">Não foi possível carregar as lojas. Tente novamente.</p>}
      {!error && lojas.length === 0 && <p className="mt-5">Nenhuma loja cadastrada.</p>}
      <ul className="mt-5 space-y-4">{lojas.map((loja) => <li key={loja.id} className="rounded-xl border bg-white p-6">
        <h3 className="font-semibold">{loja.nome} · {loja.cidade}</h3>
        <details className="mt-3"><summary className="cursor-pointer text-blue-700">Editar loja e frete</summary>
          <form action={updateLoja} className="mt-4 space-y-4">
            <input type="hidden" name="id" value={loja.id} />
            <StoreFields loja={loja} />
            <button className="rounded-md bg-blue-600 px-4 py-2 font-semibold text-white">Salvar alterações</button>
          </form>
        </details>
        <form action={deleteLoja} className="mt-4"><input type="hidden" name="id" value={loja.id} /><button className="text-sm text-red-600 hover:underline">Excluir</button></form>
      </li>)}</ul>
    </section>
  </div>;
}

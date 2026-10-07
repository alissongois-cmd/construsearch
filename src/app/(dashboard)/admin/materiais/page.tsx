import { createMaterial, deleteMaterial } from "../actions";
import { createClient } from "@/lib/supabase/server";

type Material = {
  id: string;
  nome: string;
  categoria: string;
  unidade_medida: string;
  imagem_url: string | null;
};

export default async function MateriaisPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("materiais")
    .select("id, nome, categoria, unidade_medida, imagem_url")
    .order("nome");
  const materiais = (data ?? []) as Material[];

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
      <section>
        <h2 className="text-xl font-bold text-slate-900">Novo material</h2>
        <p className="mt-1 text-sm text-slate-600">
          Cadastre os itens que poderão ser comparados.
        </p>
        <form
          action={createMaterial}
          className="mt-5 space-y-4 rounded-xl border border-slate-200 bg-white p-6 shadow-sm"
        >
          <label className="block text-sm font-medium">
            Nome
            <input
              required
              name="nome"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
              placeholder="Ex.: Cimento CP II"
            />
          </label>
          <label className="block text-sm font-medium">
            Categoria
            <input
              required
              name="categoria"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
              placeholder="Ex.: cimento"
            />
          </label>
          <label className="block text-sm font-medium">
            Unidade de medida
            <input
              required
              name="unidade_medida"
              className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2"
              placeholder="Ex.: saco 50kg"
            />
          </label>
          <label className="block text-sm font-medium">
            Imagem (opcional)
            <input
              name="imagem"
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="mt-1 block w-full rounded-md border border-slate-300 text-sm text-slate-600 file:mr-3 file:border-0 file:border-r file:border-slate-300 file:bg-slate-50 file:px-3 file:py-2 file:font-semibold file:text-slate-900"
            />
            <span className="mt-1 block text-xs font-normal text-slate-500">
              JPG, PNG ou WebP, com no máximo 2 MB.
            </span>
          </label>
          <button className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700">
            Adicionar material
          </button>
        </form>
      </section>

      <section>
        <h2 className="text-xl font-bold text-slate-900">Materiais cadastrados</h2>
        <div className="mt-5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          {materiais.length === 0 ? (
            <p className="p-6 text-sm text-slate-600">Nenhum material cadastrado.</p>
          ) : (
            <ul className="divide-y divide-slate-200">
              {materiais.map((material) => (
                <li
                  key={material.id}
                  className="flex items-center justify-between gap-4 p-4"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    {material.imagem_url ? (
                      // The image host is the project's configurable Supabase URL.
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={material.imagem_url}
                        alt=""
                        className="h-12 w-12 shrink-0 rounded-md border border-slate-200 object-cover"
                      />
                    ) : (
                      <div
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-xs text-slate-400"
                        aria-hidden="true"
                      >
                        sem foto
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="truncate font-semibold text-slate-900">{material.nome}</p>
                      <p className="text-sm text-slate-600">
                        {material.categoria} · {material.unidade_medida}
                      </p>
                    </div>
                  </div>
                  <form action={deleteMaterial}>
                    <input type="hidden" name="id" value={material.id} />
                    <button className="text-sm font-medium text-red-600 hover:underline">
                      Excluir
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}

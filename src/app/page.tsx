import { Header } from "@/components/header";
import { PriceResultCard } from "@/components/price-result-card";
import { SearchForm } from "@/components/search-form";
import { createClient } from "@/lib/supabase/server";

// Price results must always reflect the current Supabase data and the current UI deploy.
export const dynamic = "force-dynamic";
export const revalidate = 0;

type Relation<T> = T | T[] | null;
type SearchResult = {
  valor: number | string;
  data_atualizacao: string;
  materiais: Relation<{ nome: string; imagem_url: string | null }>;
  lojas: Relation<{ nome: string; cidade: string }>;
};

function firstRelation<T>(relation: Relation<T>) {
  return Array.isArray(relation) ? relation[0] ?? null : relation;
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ query?: string }>;
}) {
  const { query = "" } = await searchParams;
  const searchTerm = query.trim();
  let results: SearchResult[] = [];

  if (searchTerm) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("precos")
      .select(
        "valor, data_atualizacao, materiais!inner(nome, imagem_url), lojas!inner(nome, cidade)",
      )
      .ilike("materiais.nome", `%${searchTerm}%`)
      .order("valor", { ascending: true });

    results = data ?? [];
  }

  const lowestPriceByMaterial = results.reduce((prices, result) => {
    const material = firstRelation(result.materiais);
    const materialKey = material?.nome.trim().toLocaleLowerCase("pt-BR");
    const price = Number(result.valor);

    if (!materialKey || !Number.isFinite(price)) return prices;

    const currentPrice = prices.get(materialKey);
    if (currentPrice === undefined || price < currentPrice) {
      prices.set(materialKey, price);
    }

    return prices;
  }, new Map<string, number>());

  return (
    <>
      <Header />
      <main>
        <section className="border-b border-mist">
          <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-ash">
              Pesquisa de preços
            </p>
            <h1 className="mt-3 max-w-2xl text-2xl font-bold leading-snug text-carbon sm:text-[32px]">
              Compare materiais de construção sem complicação.
            </h1>
            <p className="mt-3 max-w-xl text-sm leading-relaxed text-ash sm:text-base">
              Consulte preços em diferentes lojas e encontre a melhor opção
              para sua obra.
            </p>
            <SearchForm initialQuery={searchTerm} />
            <p className="mt-3 text-xs leading-relaxed text-ash">
              Experimente buscar por cimento, argamassa, tinta ou telha.
            </p>
          </div>
        </section>

        <section
          className="mx-auto max-w-[1200px] px-4 py-8 sm:px-6 sm:py-10 lg:px-8"
          aria-live="polite"
          aria-busy="false"
        >
          {!searchTerm ? (
            <div className="max-w-2xl border border-mist p-5 sm:p-6">
              <h2 className="text-base font-bold text-carbon">
                Comece com o nome de um material
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-ash">
                As ofertas encontradas serão organizadas pelo menor preço,
                com loja, cidade e data de atualização.
              </p>
            </div>
          ) : (
            <>
              <div className="flex flex-col gap-1 border-b border-carbon pb-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-[0.1em] text-ash">
                    Resultados
                  </p>
                  <h2 className="mt-1 text-base font-bold text-carbon">
                    “{searchTerm}”
                  </h2>
                </div>
                <p className="text-xs text-ash">
                  {results.length} {results.length === 1 ? "oferta" : "ofertas"}
                </p>
              </div>

              {results.length === 0 ? (
                <div className="border-b border-x border-mist px-4 py-10 text-center sm:px-6 sm:py-14">
                  <h3 className="text-base font-bold text-carbon">
                    Nenhum preço encontrado
                  </h3>
                  <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ash">
                    Não encontramos ofertas para “{searchTerm}”. Tente um nome
                    mais curto, outra grafia ou uma categoria como “cimento”.
                  </p>
                </div>
              ) : (
                <ul className="mt-4 grid gap-3 md:grid-cols-2">
                  {results.map((result, index) => {
                    const material = firstRelation(result.materiais);
                    const store = firstRelation(result.lojas);
                    const price = Number(result.valor);
                    const materialKey = material?.nome
                      .trim()
                      .toLocaleLowerCase("pt-BR");

                    return (
                      <PriceResultCard
                        key={`${material?.nome}-${store?.nome}-${result.data_atualizacao}-${index}`}
                        material={material?.nome ?? "Material não identificado"}
                        imageUrl={material?.imagem_url ?? null}
                        store={store?.nome ?? "Loja não identificada"}
                        city={store?.cidade ?? "Cidade não identificada"}
                        price={price}
                        updatedAt={result.data_atualizacao}
                        isBestPrice={
                          materialKey !== undefined &&
                          price === lowestPriceByMaterial.get(materialKey)
                        }
                      />
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </main>
    </>
  );
}

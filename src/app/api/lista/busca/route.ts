import { loadImageCatalog } from "@/lib/catalog-server";
import { matchCatalog } from "@/lib/image-catalog";
import { categoryImage } from "@/lib/material-images";
import { getCategoryImages } from "@/lib/category-images";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { Material, Offer } from "@/lib/shopping-list";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) return NextResponse.json([]);
  try {
    const supabase = await createClient();
    const catalog = await loadImageCatalog().catch(() => []);
    const categoryImages = await getCategoryImages();
    // Same material-name search as the public price search, including materials without offers.
    const { data, error } = await supabase.from("materiais")
      .select("id, nome, ean, catalogo_sku, categoria, imagem_url, imagem_ean_url, unidade_medida, precos(valor, data_atualizacao, lojas(id, nome, cidade, frete_fixo, frete_gratis_acima))")
      .ilike("nome", `%${query}%`).order("nome").limit(50);
    if (error) throw error;
    const materials: Material[] = (data ?? []).map((material) => {
      const offers = new Map<string, Offer>();
      // Duplicate quotes for a store/material use the most recently updated price.
      for (const quote of [...material.precos].sort((a, b) => b.data_atualizacao.localeCompare(a.data_atualizacao))) {
        const store = Array.isArray(quote.lojas) ? quote.lojas[0] : quote.lojas;
        const price = Number(quote.valor);
        if (!store || !Number.isFinite(price) || price < 0 || offers.has(store.id)) continue;
        offers.set(store.id, { storeId: store.id, store: store.nome, city: store.cidade, price, frete_fixo: store.frete_fixo, frete_gratis_acima: store.frete_gratis_acima });
      }
      return { id: material.id, name: material.nome, unit: material.unidade_medida, imageUrl: material.imagem_url, eanImageUrl: material.imagem_ean_url, catalogImageUrl: matchCatalog(material,catalog).entry?.imagem_url, categoryImageUrl: categoryImage(material.categoria, categoryImages), offers: [...offers.values()] };
    });
    return NextResponse.json(materials, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Não foi possível buscar materiais. Tente novamente." }, { status: 503 });
  }
}

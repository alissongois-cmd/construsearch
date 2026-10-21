/// <reference lib="deno.ns" />

import { createClient } from "npm:@supabase/supabase-js@2";
import { extractLowestRelevantPrice } from "../_shared/price-parser.ts";

const STORE_NAME = "HidroRoma";
const STORE_URL = "https://www.hidroroma.com.br/";
const SEARCH_URL = "https://www.hidroroma.com.br/busca?q=";
const REQUEST_DELAY_MS = 2_500;

type Material = { id: string; nome: string };
type ScrapeResult = { materialId: string; material: string; status: "found" | "failed"; price?: number; error?: string };

class SiteBlockedError extends Error {
  constructor(readonly status: 403 | 429) {
    super(`HidroRoma respondeu HTTP ${status}; coleta interrompida sem novas tentativas.`);
    this.name = "SiteBlockedError";
  }
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function sleep(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function scrapeMaterial(material: Material) {
  const response = await fetch(`${SEARCH_URL}${encodeURIComponent(material.nome)}`, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      "Accept-Language": "pt-BR,pt;q=0.9",
      "User-Agent": "ComparadorDeMateriais/1.0 (+manual Supabase price check)",
    },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000),
  });

  if (response.status === 403 || response.status === 429) throw new SiteBlockedError(response.status);
  if (!response.ok) throw new Error(`HidroRoma respondeu HTTP ${response.status}`);

  const price = extractLowestRelevantPrice(await response.text(), material.nome);
  if (price === null) throw new Error("Nenhum preço reconhecido na página de busca");
  return price;
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") {
    return Response.json({ error: "Use POST para iniciar a coleta." }, { status: 405, headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) {
    return Response.json({ error: "SUPABASE_URL ou SUPABASE_SERVICE_ROLE_KEY não configurada." }, { status: 500, headers: corsHeaders });
  }

  if (request.headers.get("Authorization") !== `Bearer ${serviceRoleKey}`) {
    return Response.json({ error: "Apenas uma invocação administrativa manual é permitida." }, { status: 403, headers: corsHeaders });
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false } });

  try {
    const { data: materiais, error: materialsError } = await supabase.from("materiais").select("id, nome").order("nome");
    if (materialsError) throw materialsError;

    const { data: existingStores, error: storeLookupError } = await supabase.from("lojas").select("id").ilike("nome", STORE_NAME).limit(1);
    if (storeLookupError) throw storeLookupError;

    let lojaId = existingStores?.[0]?.id as string | undefined;
    if (!lojaId) {
      const { data: loja, error: storeCreateError } = await supabase.from("lojas").insert({ nome: STORE_NAME, cidade: "São Paulo", contato: STORE_URL }).select("id").single();
      if (storeCreateError) throw storeCreateError;
      lojaId = loja.id;
    }

    const results: ScrapeResult[] = [];
    let blockedStatus: 403 | 429 | null = null;

    for (const [index, material] of ((materiais ?? []) as Material[]).entries()) {
      try {
        const price = await scrapeMaterial(material);
        const { data: existingPrices, error: priceLookupError } = await supabase.from("precos").select("id").eq("material_id", material.id).eq("loja_id", lojaId).limit(1);
        if (priceLookupError) throw priceLookupError;

        const payload = { valor: price, data_atualizacao: new Date().toISOString(), atualizado_por: null };
        const priceId = existingPrices?.[0]?.id as string | undefined;
        const { error: saveError } = priceId
          ? await supabase.from("precos").update(payload).eq("id", priceId)
          : await supabase.from("precos").insert({ ...payload, material_id: material.id, loja_id: lojaId });
        if (saveError) throw saveError;

        results.push({ materialId: material.id, material: material.nome, status: "found", price });
        console.log(`[found] ${material.nome}: R$ ${price.toFixed(2)}`);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        results.push({ materialId: material.id, material: material.nome, status: "failed", error: message });
        console.error(`[failed] ${material.nome}: ${message}`);

        if (error instanceof SiteBlockedError) {
          blockedStatus = error.status;
          console.error(`[blocked] status=${blockedStatus}; stopping immediately`);
          break;
        }
      }

      if (index < (materiais?.length ?? 0) - 1) await sleep(REQUEST_DELAY_MS);
    }

    const found = results.filter((result) => result.status === "found").length;
    const failed = results.length - found;
    console.log(`[summary] total=${results.length} found=${found} failed=${failed}`);
    return Response.json(
      { total: results.length, found, failed, delayMs: REQUEST_DELAY_MS, blocked: blockedStatus !== null, blockedStatus, results },
      { status: blockedStatus ? 502 : 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`[fatal] ${message}`);
    return Response.json({ error: message }, { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});

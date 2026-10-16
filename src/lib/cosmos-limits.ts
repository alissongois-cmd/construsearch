import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { CosmosRateLimit } from "./cosmos";

export async function isCosmosBlocked() {
  const supabase = await createClient();
  const {data, error} = await supabase.from("cosmos_limite").select("bloqueado_ate").eq("id", true).maybeSingle();
  if (error) throw new Error("Não foi possível consultar o bloqueio Cosmos");
  return Boolean(data && Date.parse(data.bloqueado_ate) > Date.now());
}

export async function recordCosmosRateLimit(limit: CosmosRateLimit) {
  const supabase = await createClient();
  const {error} = await supabase.rpc("registrar_limite_cosmos", {
    p_material_id: null, p_token: null, p_bloqueado_ate: limit.blockedUntil,
    p_mensagem: limit.message, p_cabecalhos: limit.headers,
  });
  if (error) throw new Error("Não foi possível registrar o bloqueio Cosmos");
}

import "server-only";
import { createClient } from "@/lib/supabase/server";
import { lookupCosmosImage } from "@/lib/cosmos";

/** At most one five-second request per invocation; DB lease enforces a global limit. */
export async function processOneEANImage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Autenticação obrigatória");
  const { data, error } = await supabase.rpc("reservar_busca_imagem_ean");
  if (error) throw new Error("Não foi possível reservar a busca de imagem");
  const job = data?.[0];
  if (!job) return false;
  const result = await lookupCosmosImage(job.ean);
  const { data: completed, error: saveError } = await supabase.rpc("concluir_busca_imagem_ean", {
    p_material_id: job.material_id, p_token: job.lease_token,
    p_url: result.url, p_erro: result.error,
  });
  if (saveError) throw new Error("Não foi possível registrar a tentativa; a reserva expirará automaticamente");
  return Boolean(completed);
}

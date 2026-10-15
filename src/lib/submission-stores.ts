import { createClient } from "@/lib/supabase/server";
import { matchStore, type SubmissionStore } from "@/lib/store-links";

export async function listSubmissionStores(): Promise<SubmissionStore[]> {
  const supabase = await createClient();
  const stores: SubmissionStore[] = [];
  for (let start = 0; ; start += 500) {
    const { data, error } = await supabase.from("lojas").select("id,nome,cidade,slug").order("nome").order("id").range(start, start + 499);
    if (error) throw new Error("Não foi possível carregar as lojas.");
    stores.push(...(data ?? []));
    if (!data || data.length < 500) return stores;
  }
}

export async function findSubmissionStore(value: string) {
  if (!value || value.length > 300) return null;
  return matchStore(await listSubmissionStores(), value);
}

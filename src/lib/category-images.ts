import { createClient } from "@/lib/supabase/server";
import type { CategoryImage } from "./material-images";
export async function getCategoryImages(): Promise<CategoryImage[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("categorias_imagens").select("categoria_chave,nome,imagem_url");
  if (error) return [];
  return data ?? [];
}

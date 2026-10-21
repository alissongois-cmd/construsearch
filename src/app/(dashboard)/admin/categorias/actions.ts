"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { categoryKey } from "@/lib/material-images";

export async function saveCategoryImage(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/categorias");
  const nome = String(form.get("nome") ?? "").trim();
  const key = categoryKey(nome);
  const file = form.get("imagem");
  const extensions: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
  if (!key || nome.length > 160 || !(file instanceof File) || !file.size || file.size > 2 * 1024 * 1024 || !extensions[file.type]) {
    redirect("/admin/categorias?resultado=invalido");
  }
  const path = `${user.id}/categorias/${crypto.randomUUID()}.${extensions[file.type]}`;
  const bucket = supabase.storage.from("materiais-imagens");
  const { error: uploadError } = await bucket.upload(path, file, { cacheControl: "3600", contentType: file.type, upsert: false });
  if (uploadError) redirect("/admin/categorias?resultado=erro");
  const { data: { publicUrl } } = bucket.getPublicUrl(path);
  const { error } = await supabase.from("categorias_imagens").upsert({ categoria_chave: key, nome, imagem_url: publicUrl });
  if (error) {
    await bucket.remove([path]);
    redirect("/admin/categorias?resultado=erro");
  }
  // Do not delete a previously shared image: it may belong to another user or still be cached.
  for (const page of ["/admin/categorias", "/admin/materiais", "/lista", "/"]) revalidatePath(page);
  redirect("/admin/categorias?resultado=salvo");
}

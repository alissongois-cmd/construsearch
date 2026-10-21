"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { processOneEANImage } from "@/lib/ean-image-queue";

export async function processNextImage() {
  let result = "aguarde";
  try { if (await processOneEANImage()) result = "processado"; }
  catch { result = "erro"; }
  for (const path of ["/admin/imagens-ean", "/admin/materiais", "/lista", "/"]) revalidatePath(path);
  redirect(`/admin/imagens-ean?resultado=${result}`);
}

export async function retryImage(form: FormData) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/imagens-ean");
  const id = String(form.get("material_id") ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/admin/imagens-ean?resultado=erro");
  const { error } = await supabase.from("buscas_imagem_ean")
    .update({status: "pendente", ultimo_erro: null, lease_token: null})
    .eq("material_id", id).in("status", ["erro", "sem_imagem"]);
  if (error) redirect("/admin/imagens-ean?resultado=erro");
  revalidatePath("/admin/imagens-ean");
  redirect("/admin/imagens-ean?resultado=reagendado");
}

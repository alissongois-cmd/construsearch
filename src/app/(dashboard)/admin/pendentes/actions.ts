"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

import { processOneEANImage } from "@/lib/ean-image-queue";

async function moderate(formData: FormData, approve: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/pendentes");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/pendentes?resultado=erro");
  }
  let failed = false;
  let conflict = false;
  try {
    const { error } = approve
      ? await supabase.rpc("aprovar_envio", { p_envio_id: id })
      : await supabase.from("envios_pendentes").update({ status: "rejeitado" }).eq("id", id).eq("status", "pendente");
    failed = Boolean(error);
    if (approve && !failed) {
      const result = await supabase.from("envios_pendentes").select("status,erro_aprovacao").eq("id", id).single();
      failed = Boolean(result.error);
      conflict = result.data?.status === "pendente";
      if (!conflict && result.data?.status !== "aprovado") failed = true;
    }
  } catch {
    failed = true;
  }
  if (conflict) { revalidatePath("/admin/pendentes"); redirect("/admin/pendentes?resultado=conflito"); }
  if (failed) redirect("/admin/pendentes?resultado=erro");
  // RPC has committed. Image lookup failure must never undo publication.
  if (approve) {
    try { await processOneEANImage(); } catch { /* Durable job stays retryable. */ }
  }
  for (const path of ["/admin/pendentes", "/admin/imagens-ean", "/admin/lojas", "/admin/materiais", "/admin/precos", "/lista", "/"]) revalidatePath(path);
  redirect("/admin/pendentes?resultado=processado");
}

export async function approveSubmission(formData: FormData) { await moderate(formData, true); }
export async function rejectSubmission(formData: FormData) { await moderate(formData, false); }

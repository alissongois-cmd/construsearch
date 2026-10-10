"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function moderate(formData: FormData, approve: boolean) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/pendentes");
  const id = String(formData.get("id") ?? "");
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
    redirect("/admin/pendentes?resultado=erro");
  }
  let failed = false;
  try {
    const { error } = approve
      ? await supabase.rpc("aprovar_envio", { p_envio_id: id })
      : await supabase.from("envios_pendentes").update({ status: "rejeitado" }).eq("id", id).eq("status", "pendente");
    failed = Boolean(error);
  } catch {
    failed = true;
  }
  if (failed) redirect("/admin/pendentes?resultado=erro");
  for (const path of ["/admin/pendentes", "/admin/lojas", "/admin/materiais", "/admin/precos", "/"]) revalidatePath(path);
  redirect("/admin/pendentes?resultado=processado");
}

export async function approveSubmission(formData: FormData) { await moderate(formData, true); }
export async function rejectSubmission(formData: FormData) { await moderate(formData, false); }

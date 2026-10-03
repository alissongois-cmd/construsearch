"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

async function getAuthenticatedClient() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  return { supabase, user };
}

function requiredValue(formData: FormData, field: string) {
  const value = String(formData.get(field) ?? "").trim();
  if (!value) throw new Error(`O campo ${field} é obrigatório.`);
  return value;
}

export async function createMaterial(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.from("materiais").insert({
    nome: requiredValue(formData, "nome"),
    categoria: requiredValue(formData, "categoria"),
    unidade_medida: requiredValue(formData, "unidade_medida"),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/materiais");
  revalidatePath("/");
}

export async function createLoja(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const contato = String(formData.get("contato") ?? "").trim();
  const { error } = await supabase.from("lojas").insert({
    nome: requiredValue(formData, "nome"),
    cidade: requiredValue(formData, "cidade"),
    contato: contato || null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/lojas");
  revalidatePath("/");
}

export async function createPreco(formData: FormData) {
  const { supabase, user } = await getAuthenticatedClient();
  const valor = Number(String(formData.get("valor") ?? "").replace(",", "."));
  if (!Number.isFinite(valor) || valor < 0) throw new Error("Informe um preço válido.");

  const { error } = await supabase.from("precos").insert({
    material_id: requiredValue(formData, "material_id"),
    loja_id: requiredValue(formData, "loja_id"),
    valor,
    atualizado_por: user.id,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/precos");
  revalidatePath("/");
}

export async function deleteMaterial(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.from("materiais").delete().eq("id", requiredValue(formData, "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/materiais");
  revalidatePath("/admin/precos");
  revalidatePath("/");
}

export async function deleteLoja(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.from("lojas").delete().eq("id", requiredValue(formData, "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/lojas");
  revalidatePath("/admin/precos");
  revalidatePath("/");
}

export async function deletePreco(formData: FormData) {
  const { supabase } = await getAuthenticatedClient();
  const { error } = await supabase.from("precos").delete().eq("id", requiredValue(formData, "id"));
  if (error) throw new Error(error.message);
  revalidatePath("/admin/precos");
  revalidatePath("/");
}

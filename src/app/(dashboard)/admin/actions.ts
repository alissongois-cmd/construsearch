"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { findCosmosThumbnail } from "@/lib/cosmos";
import { createClient } from "@/lib/supabase/server";

const MATERIAL_IMAGES_BUCKET = "materiais-imagens";
const MAX_IMAGE_SIZE = 2 * 1024 * 1024;
const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

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
  const { supabase, user } = await getAuthenticatedClient();
  const image = formData.get("imagem");
  const ean = String(formData.get("ean") ?? "")
    .trim()
    .replace(/[\s-]/g, "");
  let imagePath: string | null = null;
  let imageUrl = await findCosmosThumbnail(ean);

  if (!imageUrl && image instanceof File && image.size > 0) {
    const extension = ALLOWED_IMAGE_TYPES[image.type];

    if (!extension) {
      throw new Error("A imagem deve estar no formato JPG, PNG ou WebP.");
    }

    if (image.size > MAX_IMAGE_SIZE) {
      throw new Error("A imagem deve ter no máximo 2 MB.");
    }

    imagePath = `${user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage
      .from(MATERIAL_IMAGES_BUCKET)
      .upload(imagePath, image, {
        cacheControl: "3600",
        contentType: image.type,
        upsert: false,
      });

    if (uploadError) throw new Error(`Falha ao enviar a imagem: ${uploadError.message}`);

    const { data } = supabase.storage
      .from(MATERIAL_IMAGES_BUCKET)
      .getPublicUrl(imagePath);
    imageUrl = data.publicUrl;
  }

  const { error } = await supabase.from("materiais").insert({
    nome: requiredValue(formData, "nome"),
    categoria: requiredValue(formData, "categoria"),
    unidade_medida: requiredValue(formData, "unidade_medida"),
    ean: ean || null,
    imagem_url: imageUrl,
  });

  if (error) {
    if (imagePath) {
      await supabase.storage.from(MATERIAL_IMAGES_BUCKET).remove([imagePath]);
    }
    throw new Error(error.message);
  }
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
  const id = requiredValue(formData, "id");
  const { data: material } = await supabase
    .from("materiais")
    .select("imagem_url")
    .eq("id", id)
    .maybeSingle();
  const { error } = await supabase.from("materiais").delete().eq("id", id);
  if (error) throw new Error(error.message);

  const publicPathMarker = `/storage/v1/object/public/${MATERIAL_IMAGES_BUCKET}/`;
  const imagePath = material?.imagem_url?.split(publicPathMarker)[1];
  if (imagePath) {
    await supabase.storage
      .from(MATERIAL_IMAGES_BUCKET)
      .remove([decodeURIComponent(imagePath)]);
  }

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

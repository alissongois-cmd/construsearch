"use server";

import { createClient } from "@/lib/supabase/server";

export type SubmissionState = { success: boolean; message: string };

export async function submitProduct(
  _previous: SubmissionState,
  formData: FormData,
): Promise<SubmissionState> {
  const confirmation = { success: true, message: "Envio recebido! Seu produto está em análise e aparecerá na busca após a aprovação do administrador." };
  // Return the same confirmation to bots, without storing their submission.
  if (String(formData.get("website") ?? "").trim()) return confirmation;

  const fields = ["nome_loja", "cidade", "nome_produto", "categoria", "unidade_medida"] as const;
  const values = Object.fromEntries(fields.map((field) => [field, String(formData.get(field) ?? "").trim()]));
  if (fields.some((field) => !values[field] || values[field].length > 160)) {
    return { success: false, message: "Preencha todos os campos obrigatórios com até 160 caracteres." };
  }
  const contato = String(formData.get("contato") ?? "").trim();
  const priceText = String(formData.get("preco") ?? "").trim().replace(",", ".");
  if (contato.length > 160 || !/^\d{1,10}(\.\d{1,2})?$/.test(priceText)) {
    return { success: false, message: "Informe um preço válido, com até duas casas decimais, e contato de até 160 caracteres." };
  }
  try {
    const supabase = await createClient();
    // Do not request returning rows: anonymous callers have INSERT only.
    const { error } = await supabase.from("envios_pendentes").insert({
      ...values, contato: contato || null, preco: Number(priceText),
    });
    if (error) return { success: false, message: "Não foi possível enviar agora. Tente novamente em instantes." };
    return confirmation;
  } catch {
    return { success: false, message: "Não foi possível enviar agora. Tente novamente em instantes." };
  }
}

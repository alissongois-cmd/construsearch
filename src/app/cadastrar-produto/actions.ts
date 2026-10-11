"use server";

import { createClient } from "@/lib/supabase/server";
import { MAX_FILE_BYTES, parseProductSpreadsheet, type IgnoredRow } from "@/lib/product-spreadsheet";

export type SubmissionState = {
  success: boolean;
  message: string;
  received: number;
  ignored: IgnoredRow[];
};

export async function submitProduct(
  _previous: SubmissionState,
  formData: FormData,
): Promise<SubmissionState> {
  const failure = (message: string, ignored: IgnoredRow[] = []): SubmissionState => ({ success: false, message, received: 0, ignored });
  // Keep the honeypot from writing any records.
  if (String(formData.get("website") ?? "").trim()) {
    return { success: true, message: "Envio recebido para análise.", received: 0, ignored: [] };
  }
  const nome_loja = String(formData.get("nome_loja") ?? "").trim();
  const cidade = String(formData.get("cidade") ?? "").trim();
  const contato = String(formData.get("contato") ?? "").trim();
  if (!nome_loja || !cidade || [nome_loja, cidade, contato].some((value) => value.length > 160)) {
    return failure("Preencha nome da loja e cidade, com até 160 caracteres por campo.");
  }
  const file = formData.get("arquivo");
  if (!(file instanceof File) || !file.size) return failure("Selecione uma planilha .csv ou .xlsx.");
  if (file.size > MAX_FILE_BYTES) return failure("O arquivo deve ter no máximo 1 MB.");
  let parsed: ReturnType<typeof parseProductSpreadsheet>;
  try {
    parsed = parseProductSpreadsheet(await file.arrayBuffer(), file.name);
  } catch (error) {
    return failure(error instanceof Error ? error.message : "Não foi possível ler a planilha.");
  }
  const { products, ignored } = parsed;
  if (!products.length) return failure("Nenhum produto foi recebido. Corrija as linhas indicadas e envie novamente.", ignored);
  try {
    const supabase = await createClient();
    // One atomic insert; anonymous callers have INSERT only, so do not request returning rows.
    const { error } = await supabase.from("envios_pendentes").insert(products.map((product) => ({
      ...product, nome_loja, cidade, contato: contato || null,
    })));
    if (error) return failure("Nenhum produto foi recebido. Não foi possível salvar agora; tente novamente em instantes.", ignored);
    return {
      success: true, received: products.length, ignored,
      message: "Os produtos recebidos estão em análise e aparecerão na busca após a aprovação do administrador.",
    };
  } catch {
    return failure("Nenhum produto foi recebido. Não foi possível salvar agora; tente novamente em instantes.", ignored);
  }
}

import { Header } from "@/components/header";
import { ProductSubmissionForm } from "@/components/product-submission-form";

import { findSubmissionStore } from "@/lib/submission-stores";

export const metadata = { title: "Cadastrar produto | OBRASEARCH" };

export default async function RegisterProductPage({ searchParams }: { searchParams: Promise<{ loja?: string | string[] }> }) {
  const { loja } = await searchParams;
  const store = typeof loja === "string" ? await findSubmissionStore(loja).catch(() => null) : null;
  return <><Header /><main className="mx-auto max-w-xl px-4 py-10"><h1 className="text-3xl font-bold text-carbon">Cadastre seus produtos</h1><p className="mb-6 mt-3 text-slate-600">Tem um depósito de construção? Envie uma planilha com seus produtos e preços para que mais pessoas encontrem sua loja.</p><ProductSubmissionForm key={store?.id ?? "normal"} store={store} /></main></>;
}

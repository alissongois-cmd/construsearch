import { Header } from "@/components/header";
import { ProductSubmissionForm } from "@/components/product-submission-form";

export const metadata = { title: "Cadastrar produto | OBRASEARCH" };

export default function RegisterProductPage() {
  return <><Header /><main className="mx-auto max-w-xl px-4 py-10"><h1 className="text-3xl font-bold text-carbon">Cadastre seu produto</h1><p className="mb-6 mt-3 text-slate-600">Tem um depósito de construção? Envie seus produtos e preços para que mais pessoas encontrem sua loja.</p><ProductSubmissionForm /></main></>;
}

import { createClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return <main className="mx-auto max-w-6xl px-6 py-16"><p className="text-sm font-semibold text-blue-600">Área privada</p><h1 className="mt-2 text-3xl font-bold text-slate-900">Olá{user?.email ? `, ${user.email}` : ""}!</h1><p className="mt-4 text-slate-600">Seu painel está pronto para receber os recursos de comparação de materiais.</p></main>;
}

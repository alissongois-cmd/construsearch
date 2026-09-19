"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthFormProps = { mode: "login" | "signup" };

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const isLogin = mode === "login";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setLoading(true);
    const formData = new FormData(event.currentTarget);
    const email = String(formData.get("email"));
    const password = String(formData.get("password"));
    const supabase = createClient();

    const result = isLogin
      ? await supabase.auth.signInWithPassword({ email, password })
      : await supabase.auth.signUp({ email, password, options: { emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard` } });

    setLoading(false);
    if (result.error) { setError(result.error.message); return; }
    if (!result.data.session) {
      setMessage("Cadastro realizado. Verifique seu e-mail para confirmar a conta.");
      return;
    }
    const redirectTo = new URLSearchParams(window.location.search).get("redirectTo");
    router.push(isLogin && redirectTo?.startsWith("/") ? redirectTo : "/dashboard");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 rounded-xl border border-slate-200 bg-white p-7 shadow-sm">
      <div><label className="mb-2 block text-sm font-medium" htmlFor="email">E-mail</label><input required id="email" name="email" type="email" autoComplete="email" className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2" /></div>
      <div><label className="mb-2 block text-sm font-medium" htmlFor="password">Senha</label><input required id="password" name="password" type="password" minLength={6} autoComplete={isLogin ? "current-password" : "new-password"} className="w-full rounded-md border border-slate-300 px-3 py-2 outline-none ring-blue-500 focus:ring-2" /></div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      {message && <p role="status" className="text-sm text-emerald-700">{message}</p>}
      <button disabled={loading} className="w-full rounded-md bg-blue-600 px-4 py-2.5 font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60">{loading ? "Aguarde..." : isLogin ? "Entrar" : "Criar conta"}</button>
      <p className="text-center text-sm text-slate-600">{isLogin ? "Ainda não tem conta?" : "Já tem uma conta?"} <Link className="font-semibold text-blue-600 hover:underline" href={isLogin ? "/cadastro" : "/login"}>{isLogin ? "Cadastre-se" : "Entrar"}</Link></p>
    </form>
  );
}

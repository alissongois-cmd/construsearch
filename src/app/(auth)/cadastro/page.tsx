import { AuthForm } from "@/components/auth-form";

export default function SignupPage() {
  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12"><div className="mb-8"><p className="text-sm font-semibold text-blue-600">Comparador de Materiais</p><h1 className="mt-2 text-3xl font-bold">Crie sua conta</h1><p className="mt-2 text-slate-600">Comece a organizar suas comparações.</p></div><AuthForm mode="signup" /></main>;
}

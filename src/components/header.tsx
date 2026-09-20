import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Link href="/" className="text-lg font-bold text-slate-900">Comparador de Materiais</Link>
        <nav className="flex items-center gap-4 text-sm font-medium">
          <Link className="text-slate-600 hover:text-slate-950" href="/login">Entrar</Link>
          <Link className="rounded-md bg-blue-600 px-4 py-2 text-white hover:bg-blue-700" href="/cadastro">Criar conta</Link>
        </nav>
      </div>
    </header>
  );
}

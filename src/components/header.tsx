import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-carbon bg-paper">
      <div className="mx-auto flex min-h-14 max-w-[1200px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="max-w-40 text-sm font-bold uppercase leading-tight tracking-[-0.02em] text-carbon sm:max-w-none sm:text-base"
        >
          Comparador de Materiais
        </Link>
        <nav aria-label="Navegação principal" className="flex items-center gap-3 text-sm">
          <Link
            className="px-1 py-3 font-bold text-carbon underline-offset-4 hover:underline"
            href="/login"
          >
            Entrar
          </Link>
          <Link
            className="rounded-[4px] border border-carbon px-3 py-2 font-bold text-carbon hover:bg-bone"
            href="/cadastro"
          >
            Criar conta
          </Link>
        </nav>
      </div>
    </header>
  );
}

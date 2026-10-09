import Image from "next/image";
import Link from "next/link";

export function Header() {
  return (
    <header className="border-b border-carbon bg-paper">
      <div className="mx-auto flex min-h-14 max-w-[1200px] flex-wrap items-center justify-between gap-x-4 gap-y-1 px-4 py-2 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="block shrink-0 rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-carbon"
          aria-label="OBRASEARCH — página inicial"
        >
          <Image
            src="/obrasearch-logo.png"
            alt="OBRASEARCH"
            width={1699}
            height={926}
            priority
            sizes="(min-width: 640px) 192px, 160px"
            className="h-auto w-40 sm:w-48"
          />
        </Link>
        <nav aria-label="Navegação principal" className="flex items-center gap-3 text-sm">
          <a
            className="px-1 py-3 font-bold text-carbon underline-offset-4 hover:underline"
            href="https://github.com/alissongois-cmd/construsearch/pull/16"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Ver PR #16 no GitHub (abre em nova aba)"
          >
            PR #16
          </a>
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

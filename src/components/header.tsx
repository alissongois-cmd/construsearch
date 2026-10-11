"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export function Header() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const toggle = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <header className="border-b border-carbon bg-paper">
      <div className="mx-auto flex min-h-16 max-w-[1200px] flex-wrap items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 rounded-sm text-carbon"
          aria-label="OBRASEARCH — página inicial"
        >
          <svg aria-hidden="true" viewBox="0 0 32 32" className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 28V12L16 4l12 8v16H4Z" />
            <path d="M11 28V15h10v13M11 20h10M16 15v13" />
          </svg>
          <span className="text-lg font-bold tracking-[-0.04em] sm:text-xl">OBRASEARCH</span>
        </Link>
        <button
          ref={toggle}
          type="button"
          aria-expanded={open}
          aria-controls="header-navigation"
          aria-label={open ? "Fechar menu" : "Abrir menu"}
          onClick={() => setOpen(!open)}
          className="flex h-11 w-11 items-center justify-center rounded-[4px] border border-mist text-carbon hover:bg-bone lg:hidden"
        >
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            {open ? <path d="m6 6 12 12M6 18 18 6" /> : <path d="M4 6h16M4 12h16M4 18h16" />}
          </svg>
        </button>
        <nav
          id="header-navigation"
          aria-label="Navegação principal"
          className={`${open ? "flex" : "hidden"} w-full flex-col gap-4 border-t border-mist pt-4 text-sm lg:flex lg:w-auto lg:flex-row lg:items-center lg:gap-6 lg:border-t-0 lg:pt-0`}
          onClick={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape" && open) {
              setOpen(false);
              toggle.current?.focus();
            }
          }}
        >
          <div className="flex flex-col gap-1 lg:flex-row lg:items-center lg:gap-3">
            <Link href="/lista" className="px-1 py-3 font-bold text-carbon underline-offset-4 hover:underline">Lista de compras</Link>
            <Link href="/cadastrar-produto" className="px-1 py-3 font-bold text-carbon underline-offset-4 hover:underline">Cadastrar produto</Link>
          </div>
          <div className="flex items-center gap-4 border-t border-mist pt-4 lg:border-l lg:border-t-0 lg:pl-6 lg:pt-0">
            <Link href="/login" className="px-1 py-3 font-bold text-carbon underline-offset-4 hover:underline">Entrar</Link>
            <Link href="/cadastro" className="rounded-[4px] border border-carbon px-3 py-3 font-bold text-carbon hover:bg-bone">Criar conta</Link>
          </div>
        </nav>
      </div>
    </header>
  );
}

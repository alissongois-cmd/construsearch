"use client";

import { useFormStatus } from "react-dom";

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="flex min-h-11 items-center justify-center gap-2 rounded-[4px] border border-carbon bg-carbon px-6 py-3 text-sm font-bold text-paper transition-colors hover:bg-paper hover:text-carbon disabled:cursor-wait disabled:border-ash disabled:bg-ash disabled:text-paper"
    >
      {pending ? (
        <>
          <span
            className="h-4 w-4 animate-spin rounded-full border-2 border-paper border-r-transparent"
            aria-hidden="true"
          />
          Buscando…
        </>
      ) : (
        "Buscar"
      )}
    </button>
  );
}

export function SearchForm({ initialQuery }: { initialQuery: string }) {
  return (
    <form
      action="/"
      className="mt-7 flex max-w-2xl flex-col gap-2 sm:flex-row"
      role="search"
    >
      <label className="sr-only" htmlFor="search">
        Buscar materiais
      </label>
      <input
        id="search"
        name="query"
        defaultValue={initialQuery}
        type="search"
        enterKeyHint="search"
        placeholder="Ex.: Cimento CP II 50 kg"
        className="min-h-11 min-w-0 flex-1 rounded-[4px] border border-mist bg-bone px-4 py-3 text-base text-carbon outline-none placeholder:text-ash focus:border-carbon sm:text-sm"
      />
      <SubmitButton />
    </form>
  );
}

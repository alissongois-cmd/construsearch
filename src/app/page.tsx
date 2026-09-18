import { Header } from "@/components/header";

export default function Home() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-6xl px-6 py-20">
        <p className="mb-3 text-sm font-semibold uppercase tracking-widest text-blue-600">Planeje melhor sua obra</p>
        <h1 className="max-w-3xl text-4xl font-bold tracking-tight text-slate-900 sm:text-5xl">Encontre e compare materiais de construção.</h1>
        <p className="mt-5 max-w-2xl text-lg text-slate-600">Pesquise produtos e tome decisões mais informadas para o seu projeto.</p>
        <form className="mt-10 flex max-w-2xl flex-col gap-3 sm:flex-row" action="#">
          <label className="sr-only" htmlFor="search">Buscar materiais</label>
          <input id="search" type="search" placeholder="Ex.: cimento, argamassa, piso..." className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-4 py-3 outline-none ring-blue-500 focus:ring-2" />
          <button type="submit" className="rounded-md bg-blue-600 px-6 py-3 font-semibold text-white hover:bg-blue-700">Buscar</button>
        </form>
      </main>
    </>
  );
}

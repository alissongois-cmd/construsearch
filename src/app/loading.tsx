import { Header } from "@/components/header";

export default function Loading() {
  return (
    <>
      <Header />
      <main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8">
        <div className="h-3 w-28 animate-pulse bg-bone" />
        <div className="mt-4 h-8 max-w-xl animate-pulse bg-bone" />
        <div className="mt-8 h-11 max-w-2xl animate-pulse rounded-[4px] bg-bone" />
        <p className="mt-8 text-sm font-bold text-carbon" role="status">
          Buscando preços…
        </p>
        <div className="mt-4 grid gap-3 md:grid-cols-2" aria-hidden="true">
          {[0, 1, 2, 3].map((item) => (
            <div key={item} className="h-44 animate-pulse border border-mist bg-bone" />
          ))}
        </div>
      </main>
    </>
  );
}

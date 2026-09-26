import Link from "next/link";

const links = [
  ["Materiais", "/admin/materiais"],
  ["Lojas", "/admin/lojas"],
  ["Preços", "/admin/precos"],
] as const;

export default function AdminLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-8 flex flex-col gap-4 border-b border-slate-200 pb-6 sm:flex-row sm:items-end sm:justify-between">
        <div><p className="text-sm font-semibold text-blue-600">Administração</p><h1 className="mt-1 text-3xl font-bold text-slate-900">Comparador de Materiais</h1></div>
        <nav className="flex flex-wrap gap-2 text-sm font-medium">{links.map(([label, href]) => <Link key={href} href={href} className="rounded-md border border-slate-300 px-3 py-2 text-slate-700 hover:border-blue-600 hover:text-blue-700">{label}</Link>)}</nav>
      </div>
      {children}
    </main>
  );
}

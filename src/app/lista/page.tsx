import { Header } from "@/components/header";
import { ShoppingList } from "@/components/shopping-list";

export default function ListPage() {
  return <><Header /><main className="mx-auto max-w-[1200px] px-4 py-10 sm:px-6 lg:px-8"><p className="text-xs font-bold uppercase tracking-[0.12em] text-ash">Comparação por loja</p><h1 className="mt-3 text-2xl font-bold sm:text-[32px]">Lista de compras</h1><p className="mt-3 text-sm text-ash">Grátis para todos, sem conta. A lista permanece durante a navegação e é apagada ao recarregar ou fechar a página.</p><p className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900">O frete é uma estimativa informada pela própria loja e pode variar conforme endereço, produtos e condições de entrega. Confirme o valor com a loja antes da compra.</p><ShoppingList /></main></>;
}

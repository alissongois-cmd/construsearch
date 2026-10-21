import type { Shipping } from "@/lib/shipping";

export function ShippingFields({ store }: { store?: Shipping }) {
  return <>
    <label className="block text-sm font-medium">Frete fixo estimado (R$, opcional)
      <input name="frete_fixo" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={store?.frete_fixo ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
    <label className="block text-sm font-medium">Frete grátis a partir de (R$, opcional)
      <input name="frete_gratis_acima" type="number" min="0" max="9999999999.99" step="0.01" defaultValue={store?.frete_gratis_acima ?? ""} className="mt-1 w-full rounded-md border border-slate-300 px-3 py-2" />
    </label>
  </>;
}

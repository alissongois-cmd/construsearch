export type Shipping = { frete_fixo: number | string | null; frete_gratis_acima: number | string | null };

export function optionalMoney(formData: FormData, field: string): number | null {
  const value = String(formData.get(field) ?? "").trim().replace(",", ".");
  if (!value) return null;
  if (!/^\d+(?:\.\d{1,2})?$/.test(value) || Number(value) > 9999999999.99) {
    throw new Error("Informe valores de frete não negativos, com até duas casas decimais.");
  }
  return Number(value);
}

export function shippingEstimate(subtotal: number, store: Shipping): number | null {
  if (store.frete_fixo == null && store.frete_gratis_acima == null) return null;
  const subtotalCents = Math.round(subtotal * 100);
  if (store.frete_gratis_acima != null && subtotalCents >= Math.round(Number(store.frete_gratis_acima) * 100)) return 0;
  return store.frete_fixo == null ? null : Number(store.frete_fixo);
}

export function money(value: number | string) {
  return Number(value).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

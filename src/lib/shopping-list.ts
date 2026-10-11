import { shippingEstimate, type Shipping } from "./shipping";

export type Offer = { storeId: string; store: string; city: string; price: number; frete_fixo?: Shipping["frete_fixo"]; frete_gratis_acima?: Shipping["frete_gratis_acima"] };
export type Material = { id: string; name: string; unit: string; offers: Offer[] };
export type ListItem = Material & { quantity: number };

export function rankStores(items: ListItem[]) {
  const stores = new Map<string, { id: string; name: string; city: string; subtotal: number; shipping: number | null; frete_fixo: Shipping["frete_fixo"]; frete_gratis_acima: Shipping["frete_gratis_acima"]; total: number; missing: string[] }>();
  for (const item of items) {
    for (const offer of item.offers) {
      if (!stores.has(offer.storeId)) stores.set(offer.storeId, { id: offer.storeId, name: offer.store, city: offer.city, frete_fixo: offer.frete_fixo ?? null, frete_gratis_acima: offer.frete_gratis_acima ?? null, subtotal: 0, shipping: null, total: 0, missing: [] });
    }
  }
  for (const store of stores.values()) {
    for (const item of items) {
      const offer = item.offers.find((offer) => offer.storeId === store.id);
      if (offer) store.total += Math.round(offer.price * 100) * item.quantity;
      else store.missing.push(item.name);
    }
    store.subtotal = Math.round(store.total) / 100;
    store.shipping = shippingEstimate(store.subtotal, store);
    store.total = (Math.round(store.subtotal * 100) + Math.round((store.shipping ?? 0) * 100)) / 100;
  }
  return [...stores.values()].sort((a, b) => a.total - b.total || a.name.localeCompare(b.name, "pt-BR"));
}

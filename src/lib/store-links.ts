export type SubmissionStore = { id: string; nome: string; cidade: string; slug: string };

export function normalizeStoreName(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

export function matchStore(stores: SubmissionStore[], value: string) {
  const exact = stores.find((store) => store.slug === value);
  if (exact) return exact;
  const name = normalizeStoreName(value);
  const matches = name ? stores.filter((store) => normalizeStoreName(store.nome) === name) : [];
  return matches.length === 1 ? matches[0] : null;
}

export function submissionUrl(origin: string, slug: string) {
  const url = new URL(origin);
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (url.protocol !== "https:" && !(local && url.protocol === "http:")) {
    throw new Error("Configure uma URL HTTPS para o site.");
  }
  const target = new URL("/cadastrar-produto", url.origin);
  target.searchParams.set("loja", slug);
  return target.toString();
}

type ProductCandidate = { name: string; price: number };

function parsePrice(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) && value > 0 ? value : null;
  if (typeof value !== "string") return null;

  const normalized = value
    .replace(/[^\d,.]/g, "")
    .replace(/\.(?=\d{3}(?:\D|$))/g, "")
    .replace(",", ".");
  const price = Number(normalized);
  return Number.isFinite(price) && price > 0 ? price : null;
}

function priceFromOffer(value: unknown): number | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const price = priceFromOffer(item);
      if (price) return price;
    }
    return null;
  }
  if (!value || typeof value !== "object") return parsePrice(value);

  const record = value as Record<string, unknown>;
  for (const key of ["price", "lowPrice", "salePrice", "currentPrice", "bestPrice"]) {
    const price = parsePrice(record[key]);
    if (price) return price;
  }
  return null;
}

function collectCandidates(value: unknown, candidates: ProductCandidate[]) {
  if (Array.isArray(value)) {
    value.forEach((item) => collectCandidates(item, candidates));
    return;
  }
  if (!value || typeof value !== "object") return;

  const record = value as Record<string, unknown>;
  const name = [record.name, record.productName, record.title].find((item) => typeof item === "string");
  const price = priceFromOffer(record.offers) ?? priceFromOffer(record);
  if (typeof name === "string" && price) candidates.push({ name, price });
  Object.values(record).forEach((item) => collectCandidates(item, candidates));
}

function relevance(name: string, searchTerm: string) {
  const normalizedName = name.toLocaleLowerCase("pt-BR");
  return searchTerm.toLocaleLowerCase("pt-BR").split(/\s+/).filter((term) => term.length > 2 && normalizedName.includes(term)).length;
}

export function extractLowestRelevantPrice(html: string, searchTerm: string): number | null {
  const candidates: ProductCandidate[] = [];
  const scripts = html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);

  for (const match of scripts) {
    try {
      collectCandidates(JSON.parse(match[1]), candidates);
    } catch {
      // Ignore malformed structured-data blocks and continue with the others.
    }
  }

  // Some search pages keep product data in serialized application state instead of JSON-LD.
  // Only use this less precise fallback when structured product candidates are unavailable.
  if (candidates.length === 0) {
    for (const match of html.matchAll(/"(?:price|lowPrice|salePrice|currentPrice|bestPrice)"\s*:\s*"?(\d+(?:[.,]\d{1,2})?)/gi)) {
      const price = parsePrice(match[1]);
      if (price) candidates.push({ name: searchTerm, price });
    }
  }

  const relevant = candidates.filter((candidate) => relevance(candidate.name, searchTerm) > 0);
  const pool = relevant.length > 0 ? relevant : candidates;
  return pool.length > 0 ? Math.min(...pool.map((candidate) => candidate.price)) : null;
}

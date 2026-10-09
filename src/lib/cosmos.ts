import "server-only";

const COSMOS_API_URL = "https://api.cosmos.bluesoft.com.br";
const COSMOS_TIMEOUT_MS = 5_000;

function safeImageUrl(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return null;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

/**
 * Looks up a product image without ever exposing the Cosmos token to the client.
 * Cosmos failures are intentionally non-fatal because manual upload is the fallback.
 */
export async function findCosmosThumbnail(ean: string) {
  const token = process.env.COSMOS_API_TOKEN;
  const userAgent = process.env.COSMOS_API_USER_AGENT;

  if (!ean || !token?.trim() || !userAgent?.trim()) return null;

  try {
    const response = await fetch(
      `${COSMOS_API_URL}/gtins/${encodeURIComponent(ean)}.json`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent": userAgent,
          "X-Cosmos-Token": token,
        },
        cache: "no-store",
        redirect: "error",
        signal: AbortSignal.timeout(COSMOS_TIMEOUT_MS),
      },
    );

    if (!response.ok) return null;

    const product: unknown = await response.json();
    if (!product || typeof product !== "object" || !("thumbnail" in product)) {
      return null;
    }
    return safeImageUrl(product.thumbnail);
  } catch {
    return null;
  }
}

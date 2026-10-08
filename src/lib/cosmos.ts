const COSMOS_API_URL = "https://api.cosmos.bluesoft.com.br";
const COSMOS_TIMEOUT_MS = 5_000;

type CosmosProduct = {
  thumbnail?: unknown;
};

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

  if (!ean || !token) {
    if (ean && !token) {
      console.warn("COSMOS_API_TOKEN não configurado; busca por EAN ignorada.");
    }
    return null;
  }

  try {
    const response = await fetch(
      `${COSMOS_API_URL}/gtins/${encodeURIComponent(ean)}.json`,
      {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "User-Agent":
            process.env.COSMOS_API_USER_AGENT ?? "ComparadorDeMateriais/1.0",
          "X-Cosmos-Token": token,
        },
        cache: "no-store",
        signal: AbortSignal.timeout(COSMOS_TIMEOUT_MS),
      },
    );

    if (response.status === 404) return null;

    if (!response.ok) {
      console.warn(`Cosmos respondeu com HTTP ${response.status} para o EAN informado.`);
      return null;
    }

    const product = (await response.json()) as CosmosProduct;
    return safeImageUrl(product.thumbnail);
  } catch (error) {
    const message = error instanceof Error ? error.message : "erro desconhecido";
    console.warn(`Não foi possível consultar a Cosmos: ${message}`);
    return null;
  }
}

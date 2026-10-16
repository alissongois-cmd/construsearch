import "server-only";
import { isCosmosBlocked, recordCosmosRateLimit } from "@/lib/cosmos-limits";

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

export const COSMOS_LIMIT_MESSAGE = "Limite diário do Cosmos atingido; tente novamente mais tarde";
export type CosmosRateLimit = { blockedUntil: string; message: string; headers: Record<string, string> };

function safeLimitText(text: string, token: string) {
  return text.split(token).join("[TOKEN OCULTO]")
    .replace(/Bearer\s+[^\s"',;]+/gi, "Bearer [TOKEN OCULTO]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[TOKEN OCULTO]");
}

async function readRateLimit(response: Response, token: string): Promise<CosmosRateLimit> {
  const headers: Record<string, string> = {};
  response.headers.forEach((value, name) => {
    if (/^(?:x-)?rate-?limit(?:-(?:limit|remaining|reset|policy)(?:-[a-z]+)?)?$/i.test(name) || name === "retry-after" || name === "date") headers[name] = safeLimitText(value, token);
  });
  const now = Date.now();
  const deadlines: number[] = [];
  const retry = headers["retry-after"];
  if (retry) {
    const at = /^\d+(?:\.\d+)?$/.test(retry) ? now + Number(retry) * 1000 : Date.parse(retry);
    if (Number.isFinite(at) && at > now) deadlines.push(at);
  }
  for (const [name, value] of Object.entries(headers)) {
    if (!/reset/i.test(name)) continue;
    const number = Number(value);
    const at = /^\d+(?:\.\d+)?$/.test(value)
      ? (number >= 1e12 ? number : number >= 1e9 ? number * 1000 : now + number * 1000)
      : Date.parse(value);
    if (Number.isFinite(at) && at > now) deadlines.push(at);
  }
  for (const name of ["ratelimit", "x-ratelimit"]) {
    const reset = headers[name]?.match(/(?:^|[,;])\s*reset\s*=\s*"?(\d+)/i);
    if (reset && Number(reset[1]) > 0) deadlines.push(now + Number(reset[1]) * 1000);
  }
  const configured = Number(process.env.COSMOS_RATE_LIMIT_COOLDOWN_SECONDS);
  const seconds = Number.isFinite(configured) && configured > 0 ? Math.min(configured, 30 * 86400) : 3600;
  const validDeadlines = deadlines.filter((time) => Number.isFinite(time) && time <= 8.64e15);
  const until = validDeadlines.length ? Math.max(...validDeadlines) : now + seconds * 1000;
  // Store the original body as text (including counts), redacting only credentials.
  let message = "";
  try { message = safeLimitText(await response.text(), token); } catch { /* A failed body read must still open the breaker. */ }
  return { blockedUntil: new Date(until).toISOString(), message, headers };
}

/**
 * Looks up a product image without ever exposing the Cosmos token to the client.
 * Cosmos failures are intentionally non-fatal because manual upload is the fallback.
 */
export async function findCosmosThumbnail(ean: string) {
  // Manual material registration shares the quota with the queue.
  try {
    if (!ean || !process.env.COSMOS_API_TOKEN?.trim() || !process.env.COSMOS_API_USER_AGENT?.trim()) return null;
    if (await isCosmosBlocked()) return null;
    const result = await lookupCosmosImage(ean);
    if (result.rateLimit) await recordCosmosRateLimit(result.rateLimit);
    return result.url;
  } catch { return null; } // Image enrichment remains optional; fail closed on missing circuit state.
}

export async function lookupCosmosImage(ean: string): Promise<{ url: string | null; error: string | null; rateLimit?: CosmosRateLimit }> {
  const token = process.env.COSMOS_API_TOKEN;
  const userAgent = process.env.COSMOS_API_USER_AGENT;

  if (!ean || !token?.trim() || !userAgent?.trim()) return { url: null, error: "EAN ou credenciais Cosmos não configurados no servidor" };

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

    if (response.status === 429) return { url: null, error: COSMOS_LIMIT_MESSAGE, rateLimit: await readRateLimit(response, token) };
    if (response.status === 404) return { url: null, error: null };
    if (!response.ok) return { url: null, error: `Cosmos indisponível (HTTP ${response.status})` };

    const product: unknown = await response.json();
    if (!product || typeof product !== "object" || !("thumbnail" in product)) {
      return { url: null, error: null };
    }
    return { url: safeImageUrl(product.thumbnail), error: null };
  } catch {
    return { url: null, error: "Falha ou timeout na consulta Cosmos; tente novamente" };
  }
}

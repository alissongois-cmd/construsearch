import { extractLowestRelevantPrice } from "../_shared/price-parser.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

Deno.test("extracts the lowest relevant JSON-LD product price", () => {
  const html = `<script type="application/ld+json">{"itemListElement":[{"name":"Tinta branca premium","offers":{"price":"149.90"}},{"name":"Tinta branca econômica","offers":{"price":"R$ 89,90"}},{"name":"Pincel","offers":{"price":"12.00"}}]}</script>`;
  assertEquals(extractLowestRelevantPrice(html, "tinta branca"), 89.9);
});

Deno.test("reads serialized fallback prices", () => {
  assertEquals(extractLowestRelevantPrice('<script>{"currentPrice":"42,50"}</script>', "cimento"), 42.5);
});

Deno.test("returns null when no price is available", () => {
  assertEquals(extractLowestRelevantPrice("<html>sem resultados</html>", "argamassa"), null);
});

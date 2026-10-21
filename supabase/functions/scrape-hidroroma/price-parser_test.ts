import { extractLowestRelevantPrice } from "../_shared/price-parser.ts";

function assertEquals(actual: unknown, expected: unknown) {
  if (actual !== expected) throw new Error(`Expected ${expected}, received ${actual}`);
}

Deno.test("extracts the lowest listing price and ignores installment amounts", () => {
  const html = `<article><h2>Torneira cromada</h2><span>10x de R$ 12,99</span><strong>R$ 119,90</strong></article><article><h2>Torneira simples</h2><strong>R$ 89,90</strong></article>`;
  assertEquals(extractLowestRelevantPrice(html, "torneira"), 89.9);
});

Deno.test("supports JSON-LD prices from a product listing", () => {
  const html = `<script type="application/ld+json">{"name":"Registro hidráulico","offers":{"price":"54.75"}}</script>`;
  assertEquals(extractLowestRelevantPrice(html, "registro hidráulico"), 54.75);
});

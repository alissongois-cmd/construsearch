/** GTIN-8/12/13/14. Keep digits only, validate and normalize to GTIN-14. */
export function normalizeEAN(value: string): string | null {
  if (!value.trim()) return null;
  const ean = value.replace(/\D/g, "");
  if (!/^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(ean)) {
    throw new Error("EAN: informe 8, 12, 13 ou 14 dígitos");
  }
  let sum = 0;
  for (let i = ean.length - 2, weight = 3; i >= 0; i--, weight = weight === 3 ? 1 : 3) sum += Number(ean[i]) * weight;
  if ((10 - sum % 10) % 10 !== Number(ean.at(-1))) throw new Error("EAN: dígito verificador inválido");
  return ean.padStart(14, "0");
}

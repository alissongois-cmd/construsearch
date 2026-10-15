export const defaultCategories = ["areia", "brita", "tijolo", "cimento", "ferragens", "tintas"];
export function categoryKey(value: string) {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}
export type CategoryImage = { categoria_chave: string; nome: string; imagem_url: string | null };
export function categoryImage(category: string, images: CategoryImage[]) {
  const key = categoryKey(category);
  const aliases: Record<string, string> = { tijolos: "tijolo", cimentos: "cimento", tinta: "tintas", ferragem: "ferragens" };
  const canonical = aliases[key] ?? key;
  return images.find((image) => image.categoria_chave === key)?.imagem_url
    || images.find((image) => image.categoria_chave === canonical)?.imagem_url
    || (defaultCategories.includes(canonical) ? `/category-images/${canonical}.svg` : null);
}

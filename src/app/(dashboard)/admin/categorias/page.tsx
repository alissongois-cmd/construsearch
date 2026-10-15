import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { categoryImage, categoryKey, defaultCategories, type CategoryImage } from "@/lib/material-images";
import { MaterialImage } from "@/components/material-image";
import { ImageUploadField } from "@/components/image-upload-field";
import { saveCategoryImage } from "./actions";

export default async function CategoriesPage({ searchParams }: { searchParams: Promise<{ resultado?: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/categorias");
  const { data, error } = await supabase.from("categorias_imagens").select("categoria_chave,nome,imagem_url").order("nome");
  const images = (data ?? []) as CategoryImage[];
  const names = new Map(defaultCategories.map((name) => [categoryKey(name), name]));
  // Include all text categories already used by materials, beyond Supabase's row cap.
  let materialsError = false;
  for (let start = 0; ; start += 500) {
    const result = await supabase.from("materiais").select("id,categoria").order("id").range(start, start + 499);
    if (result.error) { materialsError = true; break; }
    for (const material of result.data ?? []) {
      if (categoryKey(material.categoria)) names.set(categoryKey(material.categoria), material.categoria);
    }
    if (!result.data || result.data.length < 500) break;
  }
  images.forEach((image) => names.set(image.categoria_chave, image.nome));
  const { resultado } = await searchParams;
  return <section>
    <h2 className="text-xl font-bold">Imagens ilustrativas por categoria</h2>
    <p className="mt-2 text-sm text-ash">Uma imagem compartilhada por categoria, usada apenas quando o material não tem imagem própria ou do EAN.</p>
    {(error || materialsError) && <p role="alert" className="mt-4">Não foi possível carregar todas as categorias. Confira a migração e tente novamente.</p>}
    {resultado === "salvo" && <p role="status" className="mt-4">Imagem da categoria atualizada.</p>}
    {resultado === "invalido" && <p role="alert" className="mt-4">Informe uma categoria (até 160 caracteres) e uma imagem JPG, PNG ou WebP de até 2 MB.</p>}
    {resultado === "erro" && <p role="alert" className="mt-4">Não foi possível salvar a imagem. Tente novamente.</p>}
    <form action={saveCategoryImage} className="my-6 max-w-xl space-y-4 rounded border border-mist p-4">
      <h3 className="font-bold">Adicionar categoria e imagem</h3>
      <label className="block text-sm">Categoria<input required name="nome" maxLength={160} className="mt-1 block w-full rounded border border-mist p-2" /></label>
      <ImageUploadField required />
      <button className="rounded bg-carbon px-4 py-2 font-bold text-white">Salvar imagem</button>
    </form>
    <ul className="grid gap-4 md:grid-cols-2">{[...names].sort((a,b) => a[1].localeCompare(b[1], "pt-BR")).map(([key, name]) => <li key={key} className="rounded border border-mist p-4">
      <h3 className="mb-3 font-bold">{name}</h3>
      <MaterialImage name={name} category={categoryImage(name, images)} />
      <form action={saveCategoryImage} className="mt-4 space-y-3">
        <input type="hidden" name="nome" value={name} />
        <ImageUploadField required />
        <button className="rounded border border-carbon px-4 py-2 text-sm font-bold">Enviar / trocar imagem</button>
      </form>
    </li>)}</ul>
  </section>;
}

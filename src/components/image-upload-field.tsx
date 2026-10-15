export function ImageUploadField({ help = "JPG, PNG ou WebP, até 2 MB.", required = false }: { help?: string; required?: boolean }) {
  return <label className="block text-sm font-medium">Imagem {required ? "" : "(opcional)"}<input required={required} name="imagem" type="file" accept="image/jpeg,image/png,image/webp" className="mt-1 block w-full rounded-md border border-slate-300 text-sm file:mr-3 file:border-0 file:border-r file:px-3 file:py-2" /><span className="mt-1 block text-xs font-normal text-slate-500">{help}</span></label>;
}

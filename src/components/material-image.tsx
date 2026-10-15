"use client";
import { useState } from "react";

type Props = { name: string; upload?: string | null; ean?: string | null; category?: string | null; className?: string };
export function MaterialImage(props: Props) {
  const key = JSON.stringify([props.upload, props.ean, props.category]);
  return <ImageFallback key={key} {...props} />;
}
function ImageFallback({ name, upload, ean, category, className = "w-24" }: Props) {
  const [failed, setFailed] = useState<string[]>([]);
  const candidates = [{ url: upload, illustrative: false }, { url: ean, illustrative: false }, { url: category, illustrative: true }];
  const image = candidates.find((item) => item.url && !failed.includes(item.url));
  return <figure className={`shrink-0 ${className}`}>
    <div className="flex aspect-square items-center justify-center overflow-hidden border border-mist bg-bone">
      {image?.url ? (
        // URLs come from the material record, category uploads or local SVG assets.
        // eslint-disable-next-line @next/next/no-img-element
        <img src={image.url} alt={`${image.illustrative ? "Imagem ilustrativa de" : "Imagem de"} ${name}`} onError={() => setFailed((current) => [...current, image.url!])} className="h-full w-full object-contain" />
      ) : <svg viewBox="0 0 24 24" className="h-8 w-8 text-ash" fill="none" stroke="currentColor" role="img" aria-label="Imagem não disponível"><path d="M4 5h16v14H4zM5 17l5-5 4 3 2-2 3 4" /><circle cx="9" cy="9" r="1" /></svg>}
    </div>
    {image?.illustrative && <figcaption className="mt-1 text-center text-[10px] leading-tight text-ash">Imagem ilustrativa</figcaption>}
  </figure>;
}

"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { submissionUrl, type SubmissionStore } from "@/lib/store-links";
import styles from "./store-qrcodes.module.css";

type Code = SubmissionStore & { url: string; png: string };

export function StoreQRCodes({ stores, siteUrl }: { stores: SubmissionStore[]; siteUrl?: string }) {
  const [codes, setCodes] = useState<Code[]>([]);
  const [error, setError] = useState("");
  const [printing, setPrinting] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    Promise.all(stores.map(async (store) => {
      const url = submissionUrl(siteUrl || window.location.origin, store.slug);
      const png = await QRCode.toDataURL(url, { width: 768, margin: 4, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } });
      return { ...store, url, png };
    })).then((result) => { if (!cancelled) setCodes(result); })
      .catch(() => { if (!cancelled) setError("Não foi possível gerar os QR codes. Verifique NEXT_PUBLIC_SITE_URL (HTTPS) e recarregue a página."); });
    return () => { cancelled = true; };
  }, [stores, siteUrl]);

  useEffect(() => {
    if (!printing) return;
    const reset = () => setPrinting(null);
    window.addEventListener("afterprint", reset);
    const frame = requestAnimationFrame(() => window.print());
    return () => { cancelAnimationFrame(frame); window.removeEventListener("afterprint", reset); };
  }, [printing]);

  return <div>
    <div className="print:hidden">
      <h2 className="text-xl font-bold">QR codes das lojas</h2>
      <p className="mt-2 text-sm text-slate-600">Baixe o PNG ou imprima um cartaz para a loja atualizar seus preços. Os envios continuam sujeitos à aprovação.</p>
      {error && <p role="alert" className="mt-4">{error}</p>}
      {!error && stores.length > 0 && !codes.length && <p role="status" className="mt-4">Gerando QR codes…</p>}
      {!stores.length && <p className="mt-4">Nenhuma loja cadastrada.</p>}
    </div>
    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3 print:block">
      {codes.map((code) => <article key={code.id} className={`${styles.card} ${printing && printing !== code.id ? styles.excluded : ""} rounded-xl border border-mist bg-white p-6 text-center`}>
        <h3 className="text-lg font-bold">{code.nome}</h3>
        <p className="mt-1 text-sm text-slate-600">{code.cidade}</p>
        {/* A data URL is generated locally; keep the PNG unchanged for download/print. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={code.png} width={256} height={256} alt={`QR code para enviar preços para ${code.nome}`} className="mx-auto h-auto w-full max-w-64" />
        <p className="font-bold">Atualize seus preços aqui</p>
        <a href={code.url} className="mt-3 block break-all text-xs underline print:hidden">{code.url}</a>
        <div className="mt-5 flex flex-wrap justify-center gap-3 print:hidden">
          <a download={`${code.slug}.png`} href={code.png} className="rounded border border-carbon px-3 py-2 text-sm font-bold">Baixar PNG</a>
          <button type="button" onClick={() => setPrinting(code.id)} className="rounded bg-carbon px-3 py-2 text-sm font-bold text-white">Imprimir</button>
        </div>
      </article>)}
    </div>
  </div>;
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { QueueSubmitButton } from "@/components/queue-submit-button";
import { processNextImage, retryImage } from "./actions";

const labels: Record<string, string> = {pendente: "Na fila", processando: "Processando", concluido: "Imagem encontrada", sem_imagem: "Sem imagem na Cosmos", erro: "Falha na consulta"};
export default async function EANImagesPage({searchParams}: {searchParams: Promise<{resultado?: string; pagina?: string}>}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/imagens-ean");
  const { resultado, pagina } = await searchParams;
  const page = /^\d{1,6}$/.test(pagina ?? "") ? Math.max(1, Number(pagina)) : 1;
  const { data, error, count } = await supabase.from("buscas_imagem_ean")
    .select("material_id,ean,status,tentativas,ultimo_erro,atualizado_em,materiais(nome)", {count: "exact"})
    .order("atualizado_em", {ascending: false}).order("material_id").range((page - 1) * 100, page * 100 - 1);
  const messages: Record<string,string> = {processado: "Tentativa registrada. Confira o resultado abaixo.", aguarde: "Fila vazia, consulta em andamento ou intervalo entre chamadas. Aguarde um segundo e tente novamente.", erro: "Não foi possível processar agora. A aprovação foi preservada; tente novamente.", reagendado: "Material recolocado na fila. Clique em Processar próximo."};
  return <section>
    <h2 className="text-xl font-bold">Imagens por EAN</h2>
    <p className="mt-2 text-sm text-ash">Uma consulta por clique, com timeout de 5 segundos. A fila permite uma chamada global por vez e intervalo mínimo de 1 segundo. Reservas interrompidas são recuperadas após 3 minutos ao processar o próximo item.</p>
    <form action={processNextImage} className="mt-4"><QueueSubmitButton>Processar próximo</QueueSubmitButton></form>
    {resultado && messages[resultado] && <p role="status" className="mt-4">{messages[resultado]}</p>}
    {error && <p role="alert" className="mt-4">Não foi possível carregar a fila. Confira a migração e tente novamente.</p>}
    {!error && !data?.length && <p className="mt-4">Nenhuma busca registrada.</p>}
    <p className="mt-4 text-xs text-ash">Página {page} · {count ?? 0} registros. Falhas e materiais sem imagem permanecem registrados para nova tentativa.</p>
    <ul className="mt-4 space-y-3">{data?.map((job) => {
      const material = Array.isArray(job.materiais) ? job.materiais[0] : job.materiais;
      return <li key={job.material_id} className="rounded border border-mist p-4">
        <h3 className="font-bold">{material?.nome ?? job.material_id}</h3>
        <p className="mt-1 text-sm">EAN: {job.ean} · {labels[job.status]} · Tentativas: {job.tentativas}</p>
        {job.ultimo_erro && <p className="mt-2 text-sm">{job.ultimo_erro}</p>}
        {["erro","sem_imagem"].includes(job.status) && <form action={retryImage} className="mt-3"><input name="material_id" type="hidden" value={job.material_id} /><QueueSubmitButton>Tentar novamente</QueueSubmitButton></form>}
      </li>;
    })}</ul>
    <nav aria-label="Páginas da fila" className="mt-4 flex gap-4 text-sm underline">
      {page > 1 && <Link href={`/admin/imagens-ean?pagina=${page - 1}`}>Anterior</Link>}
      {(count ?? 0) > page * 100 && <Link href={`/admin/imagens-ean?pagina=${page + 1}`}>Próxima</Link>}
    </nav>
  </section>;
}

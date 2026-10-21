import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { listSubmissionStores } from "@/lib/submission-stores";
import { StoreQRCodes } from "@/components/store-qrcodes";

export const metadata = { title: "QR codes das lojas | OBRASEARCH" };

export default async function StoreQRCodesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?redirectTo=/admin/qrcodes");
  const stores = await listSubmissionStores().catch(() => null);
  if (!stores) return <p role="alert">Não foi possível carregar as lojas. Verifique se a migração de slugs foi aplicada e tente novamente.</p>;
  return <StoreQRCodes stores={stores} siteUrl={process.env.NEXT_PUBLIC_SITE_URL} />;
}

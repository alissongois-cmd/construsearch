"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useFormStatus } from "react-dom";
export function QueueSubmitButton({ children, disabled = false, blockedUntil }: { children: React.ReactNode; disabled?: boolean; blockedUntil?: string }) {
  const router = useRouter();
  const [blocked, setBlocked] = useState(Boolean(blockedUntil && Date.parse(blockedUntil) > Date.now()));
  useEffect(() => {
    const end = Date.parse(blockedUntil ?? "");
    setBlocked(end > Date.now());
    if (!(end > Date.now())) return;
    const timer = setInterval(() => {
      if (end <= Date.now()) { setBlocked(false); clearInterval(timer); router.refresh(); }
    }, 1000);
    return () => clearInterval(timer);
  }, [blockedUntil, router]);
  const { pending } = useFormStatus();
  return <button disabled={pending || disabled || blocked} className="rounded border border-carbon px-3 py-2 text-sm font-bold disabled:opacity-50">{pending ? "Processando…" : children}</button>;
}

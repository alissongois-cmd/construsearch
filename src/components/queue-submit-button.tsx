"use client";
import { useFormStatus } from "react-dom";
export function QueueSubmitButton({ children }: { children: React.ReactNode }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="rounded border border-carbon px-3 py-2 text-sm font-bold disabled:opacity-50">{pending ? "Processando…" : children}</button>;
}

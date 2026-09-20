import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Comparador de Materiais",
  description: "Compare materiais de construção em um só lugar.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}

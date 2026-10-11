import type { Metadata, Viewport } from "next";
import "./globals.css";
import { ShoppingListProvider } from "@/components/shopping-list-provider";

export const metadata: Metadata = {
  title: "Comparador de Materiais",
  description: "Compare materiais de construção em um só lugar.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body data-ui-version="editorial-v1"><ShoppingListProvider>{children}</ShoppingListProvider></body>
    </html>
  );
}

"use client";

import { createContext, useContext, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import type { ListItem } from "@/lib/shopping-list";

const Context = createContext<{ items: ListItem[]; setItems: Dispatch<SetStateAction<ListItem[]>> } | null>(null);

export function ShoppingListProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ListItem[]>([]);
  return <Context.Provider value={{ items, setItems }}>{children}</Context.Provider>;
}

export function useShoppingList() {
  const context = useContext(Context);
  if (!context) throw new Error("ShoppingListProvider ausente");
  return context;
}

#!/usr/bin/env python3
"""Importa produtos_comparador.xlsx nas tabelas materiais, lojas e precos do Supabase."""

from __future__ import annotations

import argparse
import logging
import os
from pathlib import Path
from typing import Any

import pandas as pd
import requests

REQUIRED_COLUMNS = {"Loja", "Categoria", "Produto", "Preco_BRL", "URL_Imagem", "URL_Produto"}
DEFAULT_INPUT = Path(__file__).resolve().parents[1] / "produtos_comparador.xlsx"
STORE_CITIES = {
    "Leroy Merlin": "Online",
    "Obramax": "Online",
    "Sodimac": "Online",
    "C&C Casa e Construção": "Online",
    "MadeiraMadeira": "Online",
}


def load_dotenv(path: Path) -> None:
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        os.environ.setdefault(key.strip(), value.strip().strip('"\''))


class SupabaseRest:
    def __init__(self, url: str, service_key: str) -> None:
        self.base_url = f"{url.rstrip('/')}/rest/v1"
        self.session = requests.Session()
        self.session.headers.update({
            "apikey": service_key,
            "Authorization": f"Bearer {service_key}",
            "Content-Type": "application/json",
        })

    def find_one(self, table: str, filters: dict[str, str]) -> dict[str, Any] | None:
        params = {"select": "*", "limit": "1", **filters}
        response = self.session.get(f"{self.base_url}/{table}", params=params, timeout=30)
        response.raise_for_status()
        rows = response.json()
        return rows[0] if rows else None

    def insert(self, table: str, payload: dict[str, Any]) -> dict[str, Any]:
        response = self.session.post(
            f"{self.base_url}/{table}",
            json=payload,
            headers={"Prefer": "return=representation"},
            timeout=30,
        )
        response.raise_for_status()
        return response.json()[0]

    def update(self, table: str, row_id: str, payload: dict[str, Any]) -> None:
        response = self.session.patch(
            f"{self.base_url}/{table}",
            params={"id": f"eq.{row_id}"},
            json=payload,
            headers={"Prefer": "return=minimal"},
            timeout=30,
        )
        response.raise_for_status()


def ensure_material(client: SupabaseRest, name: str, category: str) -> str:
    row = client.find_one("materiais", {"nome": f"eq.{name}"})
    if row:
        return str(row["id"])
    return str(client.insert("materiais", {"nome": name, "categoria": category, "unidade_medida": "unidade"})["id"])


def ensure_store(client: SupabaseRest, name: str, product_url: str) -> str:
    row = client.find_one("lojas", {"nome": f"eq.{name}"})
    if row:
        return str(row["id"])
    contact = product_url.split("/", 3)[:3]
    return str(client.insert("lojas", {
        "nome": name,
        "cidade": STORE_CITIES.get(name, "Online"),
        "contato": "/".join(contact) + "/",
    })["id"])


def import_row(client: SupabaseRest, row: pd.Series) -> str:
    material_id = ensure_material(client, str(row["Produto"]).strip(), str(row["Categoria"]).strip())
    store_id = ensure_store(client, str(row["Loja"]).strip(), str(row["URL_Produto"]).strip())
    existing = client.find_one("precos", {"material_id": f"eq.{material_id}", "loja_id": f"eq.{store_id}"})
    payload = {
        "valor": float(row["Preco_BRL"]),
        "data_atualizacao": pd.Timestamp.now(tz="UTC").isoformat(),
        "atualizado_por": None,
        "url_imagem": str(row["URL_Imagem"]).strip(),
        "url_produto": str(row["URL_Produto"]).strip(),
    }
    if existing:
        client.update("precos", str(existing["id"]), payload)
        return "updated"
    client.insert("precos", {**payload, "material_id": material_id, "loja_id": store_id})
    return "inserted"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--arquivo", type=Path, default=DEFAULT_INPUT)
    parser.add_argument("--env", type=Path, default=Path(__file__).resolve().parents[1] / ".env.local")
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

    load_dotenv(args.env)
    supabase_url = os.getenv("SUPABASE_URL") or os.getenv("NEXT_PUBLIC_SUPABASE_URL")
    service_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
    if not supabase_url or not service_key:
        raise RuntimeError("Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente; não use a chave pública.")

    frame = pd.read_excel(args.arquivo, engine="openpyxl")
    missing = REQUIRED_COLUMNS.difference(frame.columns)
    if missing:
        raise ValueError(f"Colunas ausentes na planilha: {', '.join(sorted(missing))}")

    client = SupabaseRest(supabase_url, service_key)
    counters = {"inserted": 0, "updated": 0, "failed": 0}
    for index, row in frame.iterrows():
        try:
            result = import_row(client, row)
            counters[result] += 1
        except Exception as error:
            counters["failed"] += 1
            logging.error("Linha %d (%s): %s", index + 2, row.get("Produto", "sem produto"), error)
    logging.info("Importação concluída: %s", counters)
    return 1 if counters["failed"] else 0


if __name__ == "__main__":
    raise SystemExit(main())

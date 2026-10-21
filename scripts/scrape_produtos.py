#!/usr/bin/env python3
"""Coleta ofertas públicas de lojas, respeitando robots.txt e sem contornar bloqueios."""

from __future__ import annotations

import argparse
import json
import logging
import re
import time
from dataclasses import asdict, dataclass
from pathlib import Path
from typing import Any, Iterable
from urllib.parse import quote_plus, urljoin
from urllib.robotparser import RobotFileParser

import pandas as pd
import requests
from bs4 import BeautifulSoup, Tag

USER_AGENT = "ComparadorDeMateriais/1.0 (+coleta manual de precos)"
REQUEST_DELAY_SECONDS = 2.5
DEFAULT_OUTPUT = Path(__file__).resolve().parents[1] / "produtos_comparador.xlsx"
COLUMNS = ["Loja", "Categoria", "Produto", "Preco_BRL", "URL_Imagem", "URL_Produto"]


@dataclass(frozen=True)
class Store:
    name: str
    base_url: str
    search_url: str


@dataclass(frozen=True)
class Product:
    Loja: str
    Categoria: str
    Produto: str
    Preco_BRL: float
    URL_Imagem: str
    URL_Produto: str


STORES = (
    Store("Leroy Merlin", "https://www.leroymerlin.com.br/", "https://www.leroymerlin.com.br/busca?q={query}"),
    Store("Obramax", "https://www.obramax.com.br/", "https://www.obramax.com.br/busca?q={query}"),
    Store("Sodimac", "https://www.sodimac.com.br/", "https://www.sodimac.com.br/sodimac-br/search?Ntt={query}"),
    Store("C&C Casa e Construção", "https://www.cec.com.br/", "https://www.cec.com.br/busca?q={query}"),
    Store("MadeiraMadeira", "https://www.madeiramadeira.com.br/", "https://www.madeiramadeira.com.br/busca?q={query}"),
)

DEFAULT_SEARCHES = (
    ("cimento", "Cimento CP-II 50kg"),
    ("hidráulica", "Tubo PVC 25mm"),
    ("aço", "Vergalhão 8mm"),
)

PRICE_KEYS = ("pixPrice", "cashPrice", "bestPrice", "salePrice", "currentPrice", "lowPrice", "price", "priceTo")
NAME_KEYS = ("name", "productName", "title")
IMAGE_KEYS = ("image", "imageUrl", "imageURL", "thumbnail", "thumbnailUrl")
URL_KEYS = ("url", "productUrl", "link", "href")


def parse_price(value: Any) -> float | None:
    if isinstance(value, (int, float)):
        return round(float(value), 2) if value > 0 else None
    if not isinstance(value, str):
        return None
    cleaned = re.sub(r"[^\d,.]", "", value)
    if not cleaned:
        return None
    if "," in cleaned:
        cleaned = cleaned.replace(".", "").replace(",", ".")
    elif cleaned.count(".") > 1:
        cleaned = cleaned.replace(".", "")
    try:
        price = float(cleaned)
    except ValueError:
        return None
    return round(price, 2) if price > 0 else None


def first_text(record: dict[str, Any], keys: Iterable[str]) -> str:
    for key in keys:
        value = record.get(key)
        if isinstance(value, str) and value.strip():
            return value.strip()
        if key in IMAGE_KEYS and isinstance(value, list) and value:
            item = value[0]
            if isinstance(item, str):
                return item
            if isinstance(item, dict):
                return first_text(item, ("url", "contentUrl"))
        if key in IMAGE_KEYS and isinstance(value, dict):
            return first_text(value, ("url", "contentUrl"))
    return ""


def offer_price(value: Any) -> float | None:
    if isinstance(value, list):
        prices = [price for item in value if (price := offer_price(item)) is not None]
        return min(prices) if prices else None
    if not isinstance(value, dict):
        return parse_price(value)
    for key in PRICE_KEYS:
        if (price := parse_price(value.get(key))) is not None:
            return price
    return None


def walk_records(value: Any) -> Iterable[dict[str, Any]]:
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk_records(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk_records(child)


def products_from_json(value: Any, store: Store, category: str) -> list[Product]:
    products: list[Product] = []
    for record in walk_records(value):
        name = first_text(record, NAME_KEYS)
        price = offer_price(record.get("offers")) or offer_price(record)
        if not name or price is None:
            continue
        product_url = first_text(record, URL_KEYS)
        image_url = first_text(record, IMAGE_KEYS)
        if not product_url or not image_url:
            continue
        products.append(Product(store.name, category, name, price, urljoin(store.base_url, image_url), urljoin(store.base_url, product_url)))
    return products


def element_text(element: Tag | None) -> str:
    return element.get_text(" ", strip=True) if element else ""


def products_from_cards(soup: BeautifulSoup, store: Store, category: str) -> list[Product]:
    selectors = "[data-testid*='product-card'], [data-product-id], [class*='product-card'], [class*='ProductCard'], article"
    products: list[Product] = []
    for card in soup.select(selectors):
        name_node = card.select_one("[itemprop='name'], [class*='product-name'], [class*='productName'], [class*='ProductName'], h2, h3")
        link_node = card.select_one("a[href]")
        image_node = card.select_one("img[src], img[data-src], img[data-lazy-src]")
        price_nodes = card.select("[itemprop='price'], [class*='pix'], [class*='Pix'], [class*='cash'], [class*='price'], [class*='Price']")
        name = element_text(name_node)
        product_url = link_node.get("href", "") if link_node else ""
        image_url = ""
        if image_node:
            image_url = image_node.get("src") or image_node.get("data-src") or image_node.get("data-lazy-src") or ""
        preferred_prices: list[float] = []
        regular_prices: list[float] = []
        for node in price_nodes:
            text = element_text(node)
            context = f"{' '.join(node.get('class', []))} {text}".casefold()
            if re.search(r"(?:\d+\s*x\s*(?:de)?|parcela|mensais)", context):
                continue
            price = parse_price(node.get("content") or text)
            if price is None:
                continue
            (preferred_prices if "pix" in context or "vista" in context else regular_prices).append(price)
        prices = preferred_prices or regular_prices
        if name and product_url and image_url and prices:
            products.append(Product(store.name, category, name, min(prices), urljoin(store.base_url, image_url), urljoin(store.base_url, product_url)))
    return products


def parse_products(html: str, store: Store, category: str) -> list[Product]:
    soup = BeautifulSoup(html, "html.parser")
    products: list[Product] = []
    for script in soup.select("script[type='application/ld+json'], script#__NEXT_DATA__"):
        try:
            products.extend(products_from_json(json.loads(script.string or script.get_text()), store, category))
        except (json.JSONDecodeError, TypeError):
            continue
    products.extend(products_from_cards(soup, store, category))

    unique: dict[tuple[str, str], Product] = {}
    for product in products:
        key = (product.Produto.casefold(), product.URL_Produto)
        current = unique.get(key)
        if current is None or product.Preco_BRL < current.Preco_BRL:
            unique[key] = product
    return list(unique.values())


def load_robots(session: requests.Session, store: Store) -> RobotFileParser:
    robots_url = urljoin(store.base_url, "/robots.txt")
    response = session.get(robots_url, timeout=20)
    if response.status_code in (403, 429):
        raise RuntimeError(f"robots.txt respondeu HTTP {response.status_code}; loja interrompida")
    response.raise_for_status()
    parser = RobotFileParser(robots_url)
    parser.parse(response.text.splitlines())
    return parser


def scrape_store(store: Store, searches: tuple[tuple[str, str], ...], limit: int) -> list[Product]:
    session = requests.Session()
    session.headers.update({"User-Agent": USER_AGENT, "Accept-Language": "pt-BR,pt;q=0.9"})
    collected: list[Product] = []
    robots = load_robots(session, store)
    time.sleep(REQUEST_DELAY_SECONDS)

    for index, (category, term) in enumerate(searches):
        search_url = store.search_url.format(query=quote_plus(term))
        if not robots.can_fetch(USER_AGENT, search_url):
            raise RuntimeError(f"robots.txt não permite {search_url}")

        response = session.get(search_url, timeout=30)
        if response.status_code in (403, 429):
            raise RuntimeError(f"bloqueio HTTP {response.status_code}; loja interrompida sem novas tentativas")
        response.raise_for_status()
        found = sorted(parse_products(response.text, store, category), key=lambda item: item.Preco_BRL)[:limit]
        logging.info("%s | %s | %d produtos", store.name, term, len(found))
        collected.extend(found)
        if index < len(searches) - 1:
            time.sleep(REQUEST_DELAY_SECONDS)
    return collected


def parse_searches(values: list[str]) -> tuple[tuple[str, str], ...]:
    if not values:
        return DEFAULT_SEARCHES
    searches = []
    for value in values:
        if "::" not in value:
            raise ValueError(f"Use CATEGORIA::TERMO em --produto: {value}")
        category, term = (part.strip() for part in value.split("::", 1))
        if not category or not term:
            raise ValueError(f"Categoria e termo são obrigatórios: {value}")
        searches.append((category, term))
    return tuple(searches)


def write_excel(products: list[Product], output: Path) -> None:
    frame = pd.DataFrame([asdict(product) for product in products], columns=COLUMNS)
    if not frame.empty:
        frame = frame.sort_values(["Categoria", "Produto", "Preco_BRL", "Loja"])
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        frame.to_excel(writer, index=False, sheet_name="Produtos")
        sheet = writer.book["Produtos"]
        sheet.freeze_panes = "A2"
        sheet.auto_filter.ref = sheet.dimensions
        widths = {"A": 24, "B": 20, "C": 52, "D": 15, "E": 60, "F": 60}
        for column, width in widths.items():
            sheet.column_dimensions[column].width = width
        for row in sheet.iter_rows():
            for cell in row:
                if isinstance(cell.value, str) and cell.value.startswith(("=", "+", "-", "@")):
                    cell.data_type = "s"
        for cell in sheet["D"][1:]:
            cell.number_format = 'R$ #,##0.00'


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--produto", action="append", default=[], help="Busca no formato CATEGORIA::TERMO; pode ser repetida")
    parser.add_argument("--limite", type=int, default=20, help="Máximo de itens por loja e termo")
    parser.add_argument("--saida", type=Path, default=DEFAULT_OUTPUT)
    args = parser.parse_args()
    logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)s | %(message)s")

    searches = parse_searches(args.produto)
    all_products: list[Product] = []
    failures: list[dict[str, str]] = []
    for store in STORES:
        try:
            all_products.extend(scrape_store(store, searches, max(1, args.limite)))
        except Exception as error:  # each store is isolated by design
            logging.error("%s | %s", store.name, error)
            failures.append({"loja": store.name, "erro": str(error)})

    write_excel(all_products, args.saida)
    logging.info("Arquivo salvo: %s | produtos=%d | lojas_com_falha=%d", args.saida, len(all_products), len(failures))
    if failures:
        logging.warning("Falhas: %s", json.dumps(failures, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

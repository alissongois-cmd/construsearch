from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import pandas as pd

from scrape_produtos import Product, Store, parse_price, parse_products, write_excel


class ScraperTests(unittest.TestCase):
    store = Store("Loja Teste", "https://example.com/", "https://example.com/busca?q={query}")

    def test_parse_brazilian_prices(self):
        self.assertEqual(parse_price("R$ 1.234,56"), 1234.56)
        self.assertEqual(parse_price("89.90"), 89.9)
        self.assertIsNone(parse_price("indisponível"))

    def test_parse_json_ld_product(self):
        html = '''<script type="application/ld+json">{
          "@type":"Product", "name":"Cimento CP-II 50kg",
          "image":"/cimento.jpg", "url":"/cimento",
          "offers":{"price":"39.90"}
        }</script>'''
        products = parse_products(html, self.store, "cimento")
        self.assertEqual(len(products), 1)
        self.assertEqual(products[0].Preco_BRL, 39.9)
        self.assertEqual(products[0].URL_Imagem, "https://example.com/cimento.jpg")

    def test_card_prefers_pix_and_ignores_installment(self):
        html = '''<article data-product-id="1"><h2>Tubo PVC 25mm</h2>
          <a href="/tubo"><img src="/tubo.jpg"></a>
          <span class="installment price">10x de R$ 12,00</span>
          <span class="regular-price">R$ 110,00</span>
          <span class="pix-price">R$ 99,90 no PIX</span>
        </article>'''
        products = parse_products(html, self.store, "hidráulica")
        self.assertEqual(products[0].Preco_BRL, 99.9)

    def test_write_excel_with_expected_columns(self):
        item = Product("Loja", "cimento", "Produto", 10.5, "https://example.com/a.jpg", "https://example.com/p")
        with TemporaryDirectory() as directory:
            output = Path(directory) / "produtos.xlsx"
            write_excel([item], output)
            frame = pd.read_excel(output)
            self.assertEqual(list(frame.columns), ["Loja", "Categoria", "Produto", "Preco_BRL", "URL_Imagem", "URL_Produto"])
            self.assertEqual(frame.iloc[0]["Preco_BRL"], 10.5)


if __name__ == "__main__":
    unittest.main()

# Coleta e importação de produtos

Os scripts consultam apenas páginas públicas permitidas pelo `robots.txt`. Não
fazem login, não resolvem CAPTCHA, não rotacionam proxies e não repetem uma loja
após HTTP 403/429. Uma falha é registrada e as demais lojas continuam.

## Instalação

```bash
python3 -m venv .venv
. .venv/bin/activate
pip install -r scripts/requirements-scraper.txt
```

## Gerar o Excel

```bash
python scripts/scrape_produtos.py \
  --produto 'cimento::Cimento CP-II 50kg' \
  --produto 'hidráulica::Tubo PVC 25mm' \
  --produto 'aço::Vergalhão 8mm'
```

O resultado é salvo em `produtos_comparador.xlsx`. Cada site é isolado: se uma
loja bloquear a coleta ou mudar o HTML, o erro aparece no log e as outras lojas
continuam. Revise manualmente os resultados antes da importação.

## Importar no Supabase

Primeiro aplique a migration que adiciona `url_imagem` e `url_produto` em
`precos`. Depois configure a chave exclusivamente no terminal (nunca no
frontend ou Git):

```bash
export SUPABASE_URL='https://SEU_PROJECT_REF.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='SUA_SERVICE_ROLE_KEY'
python scripts/import_produtos_supabase.py
```

O importador cria materiais e lojas ausentes e insere ou atualiza um preço por
combinação material/loja. Como a planilha não possui unidade de medida, novos
materiais recebem `unidade` e devem ser revisados no painel administrativo.

# scrape-hidroroma

Coleta **manual** de preços da listagem de busca da HidroRoma. A busca confirmada
usa `https://www.hidroroma.com.br/busca?q=TERMO`, sem os parâmetros dinâmicos de
filtro restringidos pelo `robots.txt` (`marcas`, `precos`, `categorias`,
`departamentos` e `ordenacao`). Nenhum agendamento é criado por este projeto.

A função percorre os materiais, espera 2,5 segundos entre requisições e cria ou
atualiza o preço associado à loja `HidroRoma` (`São Paulo`). Se a loja responder
HTTP 403 ou 429, a execução para imediatamente, sem retry, e devolve
`blocked: true` e `blockedStatus`.

## Deploy

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy scrape-hidroroma
```

## Primeira execução manual

Copie a chave `service_role` em **Project Settings → API** e execute o comando
abaixo localmente. Nunca exponha essa chave no navegador ou no repositório.

```bash
curl -i --request POST \
  'https://SEU_PROJECT_REF.supabase.co/functions/v1/scrape-hidroroma' \
  --header 'Authorization: Bearer SUA_SERVICE_ROLE_KEY' \
  --header 'apikey: SUA_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

A resposta preserva `total`, `found`, `failed`, `delayMs` e `results`. Os campos
`blocked` e `blockedStatus` indicam que a HidroRoma recusou a automação; nesse
caso, não repita a chamada. Consulte detalhes em **Edge Functions →
scrape-hidroroma → Logs** no Dashboard do Supabase.

# scrape-leroy-merlin

Edge Function para coleta **manual** de preços na busca pública da Leroy Merlin.
A função percorre os materiais cadastrados, espera 2,5 segundos entre requisições
e cria ou atualiza o preço associado à loja `Leroy Merlin`.

## Deploy e primeira execução

```bash
supabase login
supabase link --project-ref SEU_PROJECT_REF
supabase functions deploy scrape-leroy-merlin
```

Copie a `service_role` em **Project Settings → API** e execute localmente (nunca
exponha essa chave no navegador ou em código versionado):

```bash
curl -i --request POST \
  'https://SEU_PROJECT_REF.supabase.co/functions/v1/scrape-leroy-merlin' \
  --header 'Authorization: Bearer SUA_SERVICE_ROLE_KEY' \
  --header 'Content-Type: application/json' \
  --data '{}'
```

A função exige a chave `service_role`, portanto usuários comuns do aplicativo não
podem iniciar uma coleta. `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são secrets
disponibilizados automaticamente às Edge Functions hospedadas pelo Supabase.

A resposta JSON contém `total`, `found`, `failed`, `delayMs` e `results`. Cada item
em `results` informa o material, o status, o preço encontrado ou a mensagem de erro.
Os mesmos eventos aparecem em **Edge Functions → scrape-leroy-merlin → Logs** no
Dashboard do Supabase.

> O HTML de lojas virtuais muda com frequência e pode aplicar bloqueios anti-bot.
> Se a resposta indicar HTTP 403/429 ou nenhum preço reconhecido, interrompa os
> testes e ajuste o extrator ou o intervalo; não contorne mecanismos de proteção.

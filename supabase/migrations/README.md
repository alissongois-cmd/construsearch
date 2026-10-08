# Aplicando migrations pelo SQL Editor

Para adicionar imagens aos materiais:

1. Abra o projeto no painel do Supabase.
2. Acesse **SQL Editor > New query**.
3. Copie todo o conteúdo de
   `20261006000000_add_material_images.sql` e clique em **Run**.
4. Em **Table Editor > materiais**, confirme a coluna opcional `imagem_url`.
5. Em **Storage**, confirme o bucket público `materiais-imagens`.

A migration pode ser executada novamente: a coluna usa `if not exists`, o
bucket usa `on conflict` e as políticas são recriadas de forma controlada.

## Políticas do bucket

- `anon` e `authenticated` podem ler as imagens;
- apenas `authenticated` pode fazer upload;
- cada usuário grava, substitui ou remove arquivos somente dentro da pasta com
  o próprio UUID (`<user-id>/<arquivo>`);
- o próprio bucket também limita cada arquivo a 2 MB e aceita somente JPEG,
  PNG ou WebP.

As mesmas regras de tamanho e formato são validadas pela aplicação antes do
upload, oferecendo uma mensagem imediata ao administrador.

## Busca automática por EAN na Cosmos

Depois da migration de imagens, execute também
`20261007000000_add_material_ean.sql` no SQL Editor. Ela adiciona a coluna
opcional `ean` e um índice para consultas futuras.

Crie uma conta na Cosmos/Bluesoft e gere a credencial da API. Depois configure
`COSMOS_API_TOKEN` somente no servidor:

- localmente: adicione a variável ao arquivo `.env.local` e reinicie `npm run dev`;
- no Netlify: use **Project configuration > Environment variables**, adicione a
  chave e faça um novo deploy;
- nunca use o prefixo `NEXT_PUBLIC_`, pois ele exporia o token no navegador.

A Cosmos também informa um User-Agent junto às credenciais. Ele pode ser
configurado como `COSMOS_API_USER_AGENT`; se omitido, a aplicação usa o nome do
app. Erros, timeout e EAN não encontrado não impedem o cadastro: nesse caso, a
aplicação usa o upload manual quando ele tiver sido informado.

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

A Cosmos também informa um User-Agent junto às credenciais. Configure esse valor
em `COSMOS_API_USER_AGENT`, também somente no servidor e sem `NEXT_PUBLIC_`.
Sem token ou User-Agent, a consulta é ignorada silenciosamente. A requisição usa
`GET /gtins/{codigo}.json`, não usa cache e tem timeout de 5 segundos. Apenas
imagens com URL HTTP ou HTTPS são aceitas. Erros, resposta inválida, timeout e EAN
não encontrado não impedem o cadastro: nesses casos, a aplicação usa o upload
manual quando ele tiver sido informado, ou cadastra o material sem imagem.

## Produtos enviados pelo público

Execute `20261010000000_create_envios_pendentes.sql` depois das migrations anteriores.
Pode ser executada novamente: tabela/índice usam `if not exists`, políticas são
recriadas e a função de aprovação usa `create or replace`.

`/cadastrar-produto` aceita envios sem login. A tabela `envios_pendentes` permite
inserção anônima apenas dos campos do formulário, com status inicial `pendente`;
visitantes não podem consultar os envios, alterar status ou remover registros.
O honeypot é validado no servidor e envios que o preenchem não são gravados.

Administradores acessam `/admin/pendentes` após login. Conforme o modelo atual do
projeto, o papel `authenticated` tem acesso administrativo (não há um papel de
administrador separado). Aprovação reutiliza loja por nome/cidade e material por
nome, ignorando diferenças de caixa e espaços nas extremidades. Atualiza o preço
existente ou cria um novo. Todas as etapas e o status `aprovado` são atômicos;
aprovações são serializadas para evitar duplicação entre envios simultâneos.
Rejeição altera somente o status e preserva o histórico na tabela.

`npm run test:submissions` verifica a migration duas vezes em PostgreSQL local
embutido (PGlite), as permissões/RLS, aprovação repetida, reutilização de registros,
atualização de preço e rollback em caso de falha. Também testa a validação do
formulário e o descarte pelo honeypot, sem acessar o banco de produção.

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

Execute também `20261011000000_optional_submission_product_fields.sql` para permitir
categoria e unidade opcionais nos produtos da planilha. A migration preserva as
políticas e a função de aprovação e pode ser executada novamente. Campos opcionais
vazios são armazenados como strings vazias e continuam compatíveis com a aprovação.

`/cadastrar-produto` aceita planilhas CSV e XLSX sem login (primeira aba), com até
1 MB e 500 linhas de produtos além do cabeçalho. O modelo está disponível em
`/modelo-produtos.csv`. Nome e preço positivo são obrigatórios; categoria e unidade
são opcionais. Preços usam até duas casas decimais e respeitam `numeric(12,2)`.
Fórmulas, erros de células e textos acima de 160 caracteres são ignorados com o
número da linha e o motivo. Linhas vazias são desconsideradas; linhas internas
vazias contam para o limite físico de 500 linhas. Arquivos acima dos limites ou
com cabeçalho inválido são rejeitados sem inserir produtos.

Cada linha válida recebe os mesmos dados da loja e vira um item pendente individual.
A inserção em lote é atômica: falha de banco confirma zero produtos recebidos.
O resumo lista a quantidade recebida e as linhas ignoradas. Para corrigir um envio
parcial, reenvie somente as linhas ignoradas, evitando duplicar os produtos recebidos.

A tabela `envios_pendentes` permite
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

## Frete estimado

Execute `20261011010000_add_estimated_shipping.sql` após as migrations de envios pendentes.
A migration pode ser reaplicada e preserva os dados existentes. Ela adiciona os campos
opcionais de frete, libera seu envio anônimo e atualiza a aprovação atômica.
Na aprovação, valores preenchidos atualizam a loja; campos vazios preservam o frete
já cadastrado. Para remover uma configuração, use a edição em `/admin/lojas`.
Em `/lista`, o frete é calculado uma vez por loja sobre o subtotal dos produtos,
com gratuidade ao atingir o mínimo, e lojas com itens sem preço são sinalizadas
como incompletas.

## QR codes por loja

Aplique `20261015000000_add_store_slugs.sql` no SQL Editor do Supabase antes de
usar `/admin/qrcodes`. A migração adiciona `lojas.slug`, preenche lojas existentes
com nome normalizado + UUID e gera slugs automaticamente para novas lojas,
inclusive as criadas pela aprovação. Pode ser reaplicada; renomear uma loja não
altera seu slug, preservando os QR codes impressos. Não altera RLS.

Configure `NEXT_PUBLIC_SITE_URL=https://seu-dominio.com` em `.env.local` e no deploy
para que os QR codes apontem para o domínio público correto. Sem essa variável,
é usada a origem do navegador. HTTP é aceito apenas para localhost nos testes.
Reinicie o servidor após configurar a variável.

Teste local: execute `npm install` e `npm run dev`. Faça login e abra
`/admin/qrcodes`: baixe um PNG, confira o link e use Imprimir (nome, cidade, QR e
“Atualize seus preços aqui”, uma loja por impressão). Sem login, a rota redireciona
para login, seguindo a mesma regra do painel de aprovação (usuário autenticado).

Abra o link de uma loja: nome e cidade estarão preenchidos e travados. Envie o
modelo CSV e confira os registros em `/admin/pendentes`; a publicação continua
exigindo aprovação. `?loja=nome-normalizado` também funciona quando há uma única
loja com esse nome. Nomes ambíguos, parâmetros repetidos e lojas inexistentes
exibem o formulário normal, sem erro. A ação revalida a loja no servidor e ignora
nome/cidade adulterados em envios vinculados. O link público identifica a loja,
mas não autentica quem envia.

Verificações: `node --test tests/store-links.test.mjs`, `npm run test:submissions`,
`npm run lint`, `npm run typecheck` e `npm run build`.

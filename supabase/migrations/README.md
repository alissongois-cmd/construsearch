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

## Imagens ilustrativas por categoria

Aplique `20261016000000_add_category_images.sql` após as migrations de imagens e EAN.
A migration repetível adiciona `materiais.imagem_ean_url` e `categorias_imagens`,
com leitura pública e escrita autenticada, preservando as URLs antigas e as
políticas do bucket. Não foi aplicada automaticamente ao Supabase.

Novos materiais guardam upload em `imagem_url` e resultado Cosmos em
`imagem_ean_url`. A consulta EAN mantém as mesmas credenciais, timeout e tratamento
de erros. Upload agora tem prioridade, conforme a regra aprovada. Registros
antigos continuam usando `imagem_url` sem tentar adivinhar sua origem.

A ordem de exibição é upload/URL legada, EAN, categoria e placeholder neutro.
Falhas de carregamento também avançam para a próxima opção. O mesmo componente
exibe o selo “Imagem ilustrativa” nos resultados, admin e lista de compras.
Não existe página de detalhe no projeto atual.

As categorias continuam como texto livre, associadas por chave normalizada
(sem acentos, caixa ou espaços extras). Os SVGs de areia, brita, tijolo, cimento,
ferragens e tintas ficam em `public/category-images/`. Cada arquivo é compartilhado
por todos os produtos correspondentes. Categorias desconhecidas usam o placeholder
neutro até receberem uma imagem em `/admin/categorias`.

Para testar: `npm install`, `npm run dev`, faça login e abra `/admin/categorias`.
Envie ou troque uma imagem JPG/PNG/WebP de até 2 MB. O arquivo é guardado uma única
vez na pasta do usuário em `materiais-imagens`. A substituição preserva o arquivo
anterior para não quebrar referências em cache ou de outro usuário.
Crie materiais sem EAN/foto em `/admin/materiais`, com categorias areia e uma
categoria desconhecida; confira os resultados de busca e `/lista`. A primeira
recebe imagem ilustrativa com selo, a segunda placeholder neutro. Adicione uma
imagem própria e confira que o selo desaparece; com upload + EAN válido, upload
vence e a imagem EAN fica disponível como alternativa. Para imagens em itens já
adicionados à lista, remova e adicione novamente para atualizar os dados da sessão.

Verificações: `node --test tests/material-images.test.mjs`, `npm run test:cosmos`,
`npm run lint`, `npm run typecheck`, `npm run build`.

## Importação tolerante e EAN opcional

**Ordem de aplicação:** migrations base de materiais/EAN/envios/frete, depois
`20261015000000_add_store_slugs.sql`, depois
`20261016000000_add_category_images.sql` (inclui `imagem_ean_url`), por último
`20261017000000_tolerant_submission_ean.sql`. A última verifica os pré-requisitos
antes de alterar o banco. Não foi aplicada automaticamente ao Supabase.

Antes de aplicá-la, execute **separadamente** `supabase/checks/ean_preflight.sql`:

```sql
select ean, count(*) from public.materiais
where ean is not null group by ean having count(*) > 1;
```

Revise qualquer duplicata manualmente. A migration nunca apaga ou mescla produtos
existentes: se houver duplicatas, não cria o índice único, e a aprovação bloqueia
EANs ambíguos. Depois de resolver as duplicatas, reaplique a migration. Ao final,
execute **separadamente** `supabase/checks/ean_postflight.sql` para confirmar o
índice parcial `materiais_ean_unique`, execução autenticada (não `anon`) e permissão
de gravar `erro_aprovacao`. A criação do índice é protegida de escritas concorrentes.

O importador continua aceitando o modelo antigo de quatro colunas. Só produto e
preço são obrigatórios; cabeçalhos aceitam aliases sem distinção de caixa, acentos,
espaços ou underscores. CSV é UTF-8 com ou sem BOM, separado por vírgula ou ponto e
vírgula; em XLSX usa-se a primeira aba. Preços aceitam `32,90`, `32.90` e `R$ 32,90`
(sem separadores de milhar), sempre positivos, até duas casas decimais. Em CSV
separado por vírgula, coloque preços com vírgula entre aspas. Categorias e unidades
podem faltar. Colunas desconhecidas, como Loja, geram aviso e são ignoradas; a loja
vem do formulário/link. Cabeçalhos reconhecidos duplicados são rejeitados para
não escolher arbitrariamente uma coluna. Limites de 1 MB e 500 linhas permanecem.

EAN pode faltar na planilha ou ficar vazio em uma linha. Quando preenchido, aceita
espaços/hífens, removidos antes de validar GTIN-8/12/13/14 e o dígito verificador.
Guarde EAN como **texto** no Excel para preservar zeros à esquerda; se o Excel já
removeu zeros, eles não são adivinhados. EAN inválido ignora apenas sua linha, com
coluna e motivo. O modelo CSV público inclui uma coluna EAN opcional vazia.

Aprovação preserva SECURITY INVOKER, search_path vazio, RLS, bloqueio consultivo
transacional e FOR UPDATE. EAN tem prioridade sobre o nome, mesmo que o nome seja
diferente. Sem correspondência de EAN, busca nome normalizado (caixa/acentos/espaços).
EAN existente nunca é apagado por envio vazio. Nome igual com EAN diferente,
EAN duplicado e nomes ambíguos deixam o envio **pendente**, com erro persistente
visível em `/admin/pendentes`, onde o EAN também é mostrado. A ação confere o
status após a RPC; não trata o retorno sem exceção como aprovação automática.

### Cosmos em Netlify/serverless

Não há processo permanente, timer em background ou promessa abandonada. A
aprovação grava um job na mesma transação e, após o commit, aguarda no máximo uma
consulta Cosmos (timeout de 5 s). A falha de imagem não desfaz a aprovação. O
restante da fila é acionado pelo botão **Processar próximo** em
`/admin/imagens-ean`: uma consulta por chamada. Cada chamada termina normalmente.

A RPC de reserva usa bloqueio consultivo no banco para exclusão mútua global,
permitindo só um job em `processando` em todas as instâncias. Exige intervalo
mínimo de 1 s entre tentativas; chamadas antecipadas retornam sem consultar a API.
Cada reserva tem token e prazo de 3 minutos. A próxima chamada recupera reservas
vencidas para `pendente`; resultados de workers antigos não podem finalizar uma
nova reserva. Após recuperar, pode ser necessário aguardar 1 s e clicar novamente.
Nada roda automaticamente se não houver nova chamada.

A fila registra status, tentativas e erro sanitizado. HTTP 404/retorno sem foto
vira `sem_imagem`; falta de credenciais, HTTP 5xx e falha de rede viram `erro`.
HTTP 429 usa o bloqueio global descrito abaixo, sem falha do item.
O admin tem paginação e botão **Tentar novamente**, que recoloca o item na fila.
O resultado só atualiza `imagem_ean_url` se o EAN do material ainda corresponde;
`imagem_url` (upload) permanece intacta e tem prioridade sobre EAN/categoria.

Configure `COSMOS_API_TOKEN` e `COSMOS_API_USER_AGENT` **apenas no servidor**, nunca
com prefixo NEXT_PUBLIC_. Não são enviados ao cliente nem registrados nos erros.
Uma função agendada pode usar as mesmas reservas no futuro, mas não é necessária
para esse fluxo e não foi adicionada uma rota pública ou chave administrativa.

### Verificação local e no Supabase real

Execute `npm install`, `npm test`, `npm run lint`, `npm run typecheck` e
`npm run build`. Testes usam PostgreSQL local embutido (PGlite), sem gravar no
Supabase real. Os testes de SQL cobrem conflitos persistidos, restrições/permissões,
EAN prioritário, duplicatas, atomicidade, exclusão mútua da fila, pausa e recuperação
de reservas com proteção contra resposta atrasada.

No ambiente de homologação, após aplicar a migration e executar o postflight:

1. Entre com um usuário autenticado e crie um material de teste com EAN válido.
2. Envie uma planilha com o mesmo nome e outro EAN válido, além de uma linha válida
   sem conflito. Aprove a primeira: deve continuar pendente, com o erro “nome igual
   a um material existente, mas com EAN diferente”, sem novos materiais/preços.
3. Aprove a linha válida: deve aparecer na busca. Teste novamente aprovar o mesmo
   envio e confirme que não publica duas vezes.
4. Em `/admin/imagens-ean`, confira o resultado; teste credenciais ausentes/falha
   e nova tentativa. Uma falha de imagem deve preservar a aprovação.
5. Teste o fluxo acima como `authenticated` real: o teste local não substitui as
   políticas e grants efetivamente instalados no Supabase.
6. Faça upload manual de `produtos_leroy_merlin_teste.csv` sem alterar o arquivo,
   em `/cadastrar-produto`. Esse arquivo não foi disponibilizado no repositório;
   o teste de aceite com o arquivo original será feito pelo usuário no site.

## Bloqueio global ao atingir o limite Cosmos (HTTP 429)

Aplique `20261018000000_cosmos_rate_limit.sql` **depois** da migration de EAN
`20261017000000_tolerant_submission_ean.sql` e **antes** de publicar esta versão.
Não foi aplicada automaticamente. A migration é repetível e adiciona o estado
compartilhado `cosmos_limite` (RLS: apenas authenticated), substitui a reserva da
fila para respeitar o bloqueio e adiciona a RPC autenticada de registro do limite.
Nenhuma tabela ou permissão de produtos é alterada.

Ao receber 429, o worker registra `limite_atingido`, data/hora, fim do bloqueio,
corpo original da resposta e cabeçalhos de limite permitidos. O item retorna a
`pendente`, sem erro: a tentativa incrementada na reserva é devolvida atomicamente.
Callbacks repetidos ou com token antigo não descontam tentativas novamente nem
alteram uma reserva mais recente. O circuito é global entre instâncias Netlify;
novos cliques e aprovações automáticas não chamam a API durante o bloqueio. O
cadastro manual de material também verifica esse estado antes de consultar Cosmos.

Use `COSMOS_RATE_LIMIT_COOLDOWN_SECONDS=3600` no servidor para configurar o período
padrão (1 hora; valores positivos, máximo 30 dias). Se a resposta trouxer
`Retry-After` em segundos/data HTTP ou cabeçalhos RateLimit/X-RateLimit de reset
(segundos relativos, timestamp Unix em segundos/milissegundos ou data), usa-se o
maior horário futuro informado. Sem horário válido, usa-se o período configurado.
O token permanece exclusivamente em `COSMOS_API_TOKEN`, sem prefixo NEXT_PUBLIC_.

Em `/admin/imagens-ean`, o aviso é “Limite diário do Cosmos atingido; tente
novamente mais tarde”. Mostra o início/fim em horário de Brasília e a resposta
original, inclusive quantidades, além dos cabeçalhos de limite. Apenas o token e
credenciais são ocultados antes de persistir; cookies e cabeçalhos de autenticação
não são registrados. O botão Processar próximo fica desativado e a tela atualiza
quando o período termina. A verificação no banco continua impedindo chamadas
mesmo se alguém tentar contornar o botão. Se não for possível consultar o estado,
o botão permanece desativado e o enriquecimento manual não consulta a API.

O bloqueio expira pelo relógio do banco, sem processo permanente. O próximo
processamento permitido continua a fila normalmente. O último limite fica no
histórico do painel. Imagens de upload/categoria e aprovações permanecem intactas.
Erros 429 registrados antes desta versão não têm suas tentativas históricas
reescritas automaticamente.

Testes: `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`. Incluem
429 com corpo/quantidade, ocultação do token, Retry-After/data/reset/configuração,
reservas bloqueadas entre chamadas, devolução de tentativa uma única vez,
reabertura após expiração, permissões e botão desativado. Os testes não consomem a
cota Cosmos real nem alteram o Supabase remoto.

## Catálogo mestre de imagens (revisar antes de aplicar)

`20261019000000_master_image_catalog.sql` cria o catálogo com SKU único e campos do
CSV, EAN opcional, sinônimos normalizados e vínculo manual `materiais.catalogo_sku`.
**Não foi aplicada ao Supabase.** A aplicação deve aguardar o relatório do CSV real
fornecido pelo usuário, além dos testes locais. Depende do esquema de materiais e
das migrations de imagens/EAN; reutiliza o bucket `materiais-imagens` e suas regras.

Hoje as outras tabelas administrativas consideram qualquer authenticated um admin.
Para **o novo catálogo e a alteração de catalogo_sku**, a migration usa a lista
protegida `private.catalog_admin_emails`, com os e-mails expressamente aprovados:
`alisson.gois@unesp.br` e `gois17541@gmail.com`. Nenhum usuário da aplicação pode
ler ou editar essa lista; a manutenção é pelo SQL Editor. A função
`is_catalog_admin()` usa o usuário real de `auth.users` e exige e-mail confirmado,
não user_metadata nem um e-mail enviado pelo navegador. É SECURITY DEFINER com
search_path vazio e execução apenas authenticated. RLS restringe a escrita do
catálogo; um trigger protege catalogo_sku inclusive contra INSERT/UPDATE diretos
pelas políticas amplas já existentes em materiais. As permissões das demais
colunas/telas não são alteradas por esta migration. A policy ampla da proposta
anterior, caso exista, é removida.

A normalização SQL e TypeScript é equivalente: minúsculas, decomposição Unicode,
remoção de acentos, separação entre dígito/letra (`20kg` → `20 kg`), remoção de
pontuação e colapso de espaços. Aplica-se tanto ao nome do material quanto ao nome
oficial e sinônimos. SKU é texto e mantém caixa e zeros à esquerda; somente nomes
de arquivos são comparados sem diferenciar maiúsculas/minúsculas.

`/admin/catalogo-imagens` aceita um CSV UTF-8 separado por `;` e seleção múltipla de
JPG/PNG/WebP. Até 1 MB e 2000 linhas por importação. As quatro colunas obrigatórias
são ID SKU, Nome Oficial do Produto, Categoria e Arquivo de Imagem. Demais colunas:
Marca, Linha, Especificacao Tecnica, Cor, Peso e Sinonimos para Busca (Matching).
Sinônimos podem ser separados por `|`, vírgula ou ponto e vírgula dentro de célula
entre aspas. Coluna extra EAN é opcional e valida GTIN/dígito verificador; não se
adivinha EAN a partir do SKU. A importação usa upsert por SKU, nunca por nome.

**Validar sem importar** mostra linhas inválidas, SKUs duplicados (todas as linhas
correspondentes são ignoradas), imagens sem linha, linhas sem imagem e nomes de
imagem ambíguos. A importação grava somente linhas válidas. Sem imagem selecionada,
uma reimportação preserva a imagem já cadastrada; um SKU novo pode ficar sem foto,
com a ausência informada no relatório. Falhas de upload não substituem a imagem
existente e são reportadas; os SKUs associados à imagem falha não são gravados.

Para Netlify, as imagens são primeiro reduzidas no navegador; uma chamada pequena
por imagem usa Sharp no servidor para validar, corrigir orientação e converter
para WebP com lado máximo de 800 px, sem ampliar imagens pequenas. Metadados são
gravados em lotes de 25, cada lote atômico; o relatório mostra quantos SKUs foram
salvos e lotes com falha. Reimportar permite retomar sem duplicar registros. O
arquivo fica em `<user-id>/catalogo/<hash-do-webp>.webp`: imagens idênticas são
reutilizadas, inclusive entre SKUs. Arquivos antigos não são apagados para evitar
quebrar referências.

Nas fotos públicas, a ordem permanece upload próprio → Cosmos/EAN → catálogo →
categoria ilustrativa → placeholder. Não se sobrescreve imagem_url nem se fazem
novas chamadas Cosmos durante a importação. O vínculo exato é resolvido por EAN,
nome oficial normalizado e sinônimo exato, nessa ordem. Mais de um candidato na
mesma etapa gera ambiguidade, sem escolha automática. Um EAN conhecido divergente
não é associado por nome/sinônimo. Sem correspondência exata, o painel apresenta
sugestões por palavras em comum; só o botão Confirmar vínculo grava catalogo_sku.
As correspondências exatas são resolvidas na leitura, sem gravar vínculos pelo
visitante. Sugestões nunca entram na exibição pública sem confirmação.

### Resultado local antes da aplicação

Amostra de teste `tests/fixtures/catalogo-mestre-amostra.csv` (não é o arquivo real):
6 linhas, 3 válidas, 1 linha sem imagem selecionada, 1 imagem sem linha,
1 SKU duplicado em 2 linhas, 1 linha com campo obrigatório vazio. `ARGAMASSA.JPG`
foi associado a `argamassa.jpg`; `20kg` e `20 kg` foram equivalentes e sinônimos
repetidos foram deduplicados. A conversão testada de 1600×1000 gerou WebP 800×500;
imagem 100×50 permaneceu 100×50.

Testes SQL locais verificam que usuário autenticado fora da lista não escreve no
catálogo, não altera catalogo_sku e não pode promover a si próprio. Admin permitido
pode fazer upsert e confirmar vínculos; visitantes leem somente o catálogo público.
Executar `npm test`, `npm run lint`, `npm run typecheck`, `npm run build`.

O CSV real do catálogo ainda será enviado pelo usuário. **Não confundir a amostra
com esse teste de aceite; nenhuma migration deve ser aplicada antes desse relatório.**


## Vínculo automático de catálogo por EAN/GTIN

Aplique a migration 20261025000000_catalog_eans_auto_link.sql somente depois de 20261019000000_master_image_catalog.sql e das migrations anteriores de materiais, EAN e envios. Esta migration cria catalogo_eans, normaliza GTIN-8, GTIN-12, GTIN-13 e GTIN-14 para GTIN-14 (somente dígitos, zeros à esquerda e dígito verificador), migra o EAN legado de catalogo_imagens e mantém a coluna legada sincronizada por trigger. EAN inválido vira NULL e nunca é usado para associação. EAN que já esteja em outro SKU interrompe a gravação; revise o SKU conflitante antes de importar novamente.

A função vincular_materiais_por_ean() exige e-mail presente em private.catalog_admin_emails. Leitura de catalogo_eans é pública; escrita e execução manual da revinculação são restritas a administradores. Triggers executam tentativas internas ao aprovar envios, criar/editar materiais e adicionar/alterar EAN no catálogo. Vínculos manual nunca são sobrescritos. Nome/sinônimo continua sendo sugestão, e confirmar uma sugestão grava vinculo_origem='manual'.

Em /admin/catalogo-imagens, use Revincular por EAN para executar a reconciliação e ver contagens de vinculados, materiais sem correspondência e EANs repetidos em materiais. A seção EANs sem foto no catálogo agrupa materiais sem vínculo por EAN. A ordem de imagem é upload do usuário, imagem do catálogo pelo catalogo_sku, imagem EAN/Cosmos, imagem ilustrativa da categoria e placeholder.

Não executar a migration no Supabase remoto durante o desenvolvimento. Revisar conflitos legados antes de aplicá-la. Ordem de deploy:
1. Revisar/aplicar as migrations prévias, inclusive catálogo mestre.
2. Fazer backup e revisar EANs duplicados/legados.
3. Executar 20261025000000_catalog_eans_auto_link.sql no SQL Editor.
4. Validar permissões com um administrador e um usuário comum.
5. Abrir /admin/catalogo-imagens, conferir os conflitos e clicar em Revincular por EAN.

Testes locais: node --test tests/catalog-eans.test.mjs, npm test, npm run lint, npm run typecheck e npm run build. Não usar dados de planilhas reais nem credenciais nos testes.

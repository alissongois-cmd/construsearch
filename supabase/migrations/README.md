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

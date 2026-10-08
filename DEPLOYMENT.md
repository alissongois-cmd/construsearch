# Publicação do design no Netlify

O projeto fixa no repositório as configurações esperadas pelo Netlify:

- comando de build: `npm run build`;
- diretório publicado: `.next`;
- Node.js 20;
- página inicial sem cache persistente no navegador/CDN.

## Verificação após o merge

1. No Netlify, abra **Deploys** e confirme que o deploy mais recente usa o
   commit deste pull request.
2. Use **Trigger deploy > Clear cache and deploy site** uma vez após o merge.
3. Abra a página publicada em uma janela anônima.
4. No console do navegador, execute:

   ```js
   document.body.dataset.uiVersion
   ```

   O resultado esperado é `editorial-v1`. Se o valor estiver vazio, o domínio
   ainda está servindo outro deploy ou outra branch.
5. Confirme visualmente que a home contém o texto **Pesquisa de preços** e que
   o botão **Buscar** é preto. O verde deve aparecer somente no menor preço de
   cada material.

## Se a versão continuar antiga

Confira em **Project configuration > Build & deploy**:

- a branch de produção deve ser a branch na qual o PR foi mesclado;
- o diretório base deve estar vazio, pois o `package.json` está na raiz;
- o deploy precisa concluir `npm run build` sem reutilizar um deploy anterior.

O arquivo `netlify.toml` tem precedência sobre valores conflitantes configurados
na interface do Netlify para comando de build e diretório de publicação.

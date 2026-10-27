# CineMatch

Descoberta inteligente de filmes — projeto de portfólio em **HTML5, CSS3 e JavaScript puro**, sem frameworks e sem build.

## Funcionalidades

- Catálogo com busca por título, filtros (gênero, nota mínima, ano) e ordenação.
- Favoritos persistidos em `localStorage`.
- Avaliação pessoal de 1 a 5 estrelas (clique de novo na mesma estrela para limpar).
- Recomendações por similaridade de gênero, ponderadas por favoritos e notas.
- Comparação lado a lado entre dois filmes.
- Perfil de gosto com favoritos, avaliações e gêneros dominantes.
- Layout responsivo (desktop, tablet, celular).

## Como rodar

1. Abra a pasta `cinematch/` no VS Code.
2. Instale a extensão **Live Server**.
3. Clique com o botão direito em `index.html` → **Open with Live Server**.

> Também funciona abrindo o `index.html` direto no navegador — só não terá o reload automático.

## Modo demonstração x TMDB

Por padrão o app roda com **dados de demonstração** (24 filmes embutidos no `js/app.js`), sem precisar de chave.

Para usar dados reais:

1. Crie uma conta em <https://www.themoviedb.org>.
2. Gere um **API Read Access Token** em *Settings → API*.
3. Cole o token em `js/config.js`, no campo `TMDB_TOKEN`.
4. Recarregue a página — o badge do cabeçalho passa a mostrar `TMDB`.

**Segurança:** em site estático, qualquer token no navegador é visível. Para publicar em produção, use um backend/proxy para proteger a credencial e respeite os termos de atribuição do TMDB.

## Estrutura

/* CineMatch — app.js */
(() => {
  "use strict";

  const CFG = Object.assign(
    { TMDB_TOKEN: "", LANGUAGE: "pt-BR", REGION: "BR" },
    window.CINEMATCH_CONFIG || {}
  );
  const HAS_API = Boolean(String(CFG.TMDB_TOKEN || "").trim());
  const TMDB_BASE = "https://api.themoviedb.org/3";
  const IMG_BASE = "https://image.tmdb.org/t/p/w500";
  const LS_FAV = "cinematch:favorites";
  const LS_RATE = "cinematch:ratings";
  const LS_COMMENTS = "cinematch:comments";

  /* ---------------- Estado ---------------- */
  const state = {
    movies: [],
    filters: { query: "", genre: "", year: "", minRating: 0, sortBy: "popularity" },
    favorites: new Set(loadJSON(LS_FAV, [])),
    ratings: loadJSON(LS_RATE, {}),
    comments: loadJSON(LS_COMMENTS, {}), // { [movieId]: [{ id, text, date }] }
    compare: [],
    tab: "catalog",
    surprise: null,
    featured: null
  };

  /* ---------------- Utilidades ---------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function esc(s) {
    return String(s).replace(/[&<>"']/g, c => (
      { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
    ));
  }
  function loadJSON(key, fallback) {
    try { const raw = localStorage.getItem(key); return raw ? JSON.parse(raw) : fallback; }
    catch { return fallback; }
  }
  function saveJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  }
  function debounce(fn, ms = 150) {
    let t;
    return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
  }
  function hashHue(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
    return h % 360;
  }
  function getRating(id) { return Number(state.ratings[String(id)] || 0); }
  function setRating(id, value) {
    if (value <= 0) delete state.ratings[String(id)];
    else state.ratings[String(id)] = value;
    saveJSON(LS_RATE, state.ratings);
  }
  function toggleFavorite(id) {
    const wasFav = state.favorites.has(id);
    if (wasFav) state.favorites.delete(id);
    else state.favorites.add(id);
    saveJSON(LS_FAV, Array.from(state.favorites));
    updateFavCount();
    return !wasFav;
  }

  /* ---------------- Ícones por gênero ---------------- */
  const GENRE_ICON = {
    "Ficção": "ph-rocket", "Drama": "ph-mask-happy", "Crime": "ph-gun", "Ação": "ph-explosion",
    "Aventura": "ph-compass", "Suspense": "ph-knife", "Mistério": "ph-detective", "Terror": "ph-ghost",
    "Animação": "ph-sparkle", "Fantasia": "ph-magic-wand", "Comédia": "ph-smiley", "Romance": "ph-heart",
    "Musical": "ph-music-notes", "Música": "ph-music-note", "Família": "ph-users", "Faroeste": "ph-cowboy-hat"
  };
  function genreIcon(genres) {
    for (const g of genres) if (GENRE_ICON[g]) return `<i class="ph ${GENRE_ICON[g]}"></i>`;
    return `<i class="ph ph-film-script"></i>`;
  }

  /* ---------------- Toast ---------------- */
  function toast(message, type = "info") {
    const container = $("#toastContainer");
    if (!container) return;
    const el = document.createElement("div");
    el.className = `toast toast-${type}`;
    el.innerHTML = message; // Permite ícones no toast
    container.appendChild(el);
    requestAnimationFrame(() => el.classList.add("show"));
    setTimeout(() => {
      el.classList.remove("show");
      setTimeout(() => el.remove(), 320);
    }, 2200);
  }

  /* ---------------- Dados de demonstração ---------------- */
  const DEMO_MOVIES = [
    { id: 1,  title: "Duna", year: "2021", genres: ["Ficção", "Aventura"], rating: 8.0, popularity: 95, synopsis: "Uma jornada épica de Paul Atreides, um jovem brilhante e talentoso, que deve viajar para o planeta mais perigoso do universo para garantir o futuro de sua família e de seu povo.", trailer: "n9xhJrPXop4" },
    { id: 2,  title: "Interestelar", year: "2014", genres: ["Ficção", "Drama"], rating: 8.7, popularity: 96, synopsis: "Com a Terra se tornando inabitável, um fazendeiro e ex-piloto da NASA viaja através de um buraco de minhoca em busca de um novo lar para a humanidade.", trailer: "zSWdZVtXT7E" },
    { id: 3,  title: "Parasita", year: "2019", genres: ["Drama", "Suspense"], rating: 8.5, popularity: 90, synopsis: "Toda a família de Ki-taek está desempregada e vive em um porão apertado. Um dia, o filho mais velho consegue um emprego na casa de uma família rica, dando início a uma série de eventos inesperados.", trailer: "5xH0HfJHsaY" },
    { id: 4,  title: "O Poderoso Chefão", year: "1972", genres: ["Drama", "Crime"], rating: 9.2, popularity: 88, synopsis: "A saga da família Corleone, uma das mais poderosas máfias de Nova York, e a relutância de Michael Corleone em assumir os negócios do pai.", trailer: "sY1S34973zA" },
    { id: 5,  title: "Pulp Fiction", year: "1994", genres: ["Crime", "Drama"], rating: 8.9, popularity: 86, synopsis: "Histórias de dois assassinos da máfia, um boxeador, um gângster e sua esposa se entrelaçam em quatro contos de violência e redenção.", trailer: "s7EdQ4FqbhY" },
    { id: 6,  title: "Cidade de Deus", year: "2002", genres: ["Crime", "Drama"], rating: 8.6, popularity: 84, synopsis: "Buscapé cresce em meio à violência da Cidade de Deus, no Rio de Janeiro, e tenta escapar de seu destino usando sua habilidade com a fotografia.", trailer: "RfsGd1y3hEA" },
    { id: 7,  title: "Matrix", year: "1999", genres: ["Ficção", "Ação"], rating: 8.7, popularity: 93, synopsis: "Um hacker descobre que a realidade em que vive é uma simulação e se junta a uma rebelião contra as máquinas que controlam o mundo.", trailer: "vKQi3bBA1y8" },
    { id: 8,  title: "A Origem", year: "2010", genres: ["Ficção", "Ação", "Suspense"], rating: 8.8, popularity: 91, synopsis: "Um ladrão que rouba segredos corporativos através da tecnologia de compartilhamento de sonhos recebe a tarefa inversa: plantar uma ideia na mente de um CEO.", trailer: "JvurpfJjq6A" },
    { id: 9,  title: "Whiplash", year: "2014", genres: ["Drama", "Música"], rating: 8.5, popularity: 80, synopsis: "Um jovem baterista entra para um conservatório de elite e sofre abusos de um instrutor implacável que fará de tudo para realizar o potencial do aluno.", trailer: "7d_jQycdQGo" },
    { id: 10, title: "La La Land", year: "2016", genres: ["Musical", "Romance", "Drama"], rating: 8.0, popularity: 78, synopsis: "Um pianista de jazz e uma aspirante a atriz se apaixonam em Los Angeles, enquanto tentam equilibrar seus sonhos profissionais com o relacionamento.", trailer: "0pdqf4P9MB8" },
    ...Array.from({ length: 66 }, (_, i) => {
      const titles = ["O Grande Truque", "Mad Max: Estrada da Fúria", "Blade Runner 2049", "Tropa de Elite", "Central do Brasil", "Bacurau", "Clube da Luta", "A Viagem de Chihiro", "Homem-Aranha no Aranhaverso", "Alien", "O Iluminado", "Corra!", "Divertida Mente", "Tudo em Todo Lugar ao Mesmo Tempo", "Batman: O Cavaleiro das Trevas", "O Senhor dos Anéis: O Retorno do Rei", "O Silêncio dos Inocentes", "Seven", "De Volta Para o Futuro", "Forrest Gump", "O Rei Leão", "Toy Story", "Jurassic Park", "E.T.", "Star Wars", "O Império Contra-Ataca", "2001", "Psicose", "Casablanca", "O Exorcista", "Tubarão", "Rocky", "Blade Runner", "Aliens", "Nascido Para Matar", "Duro de Matar", "Cinema Paradiso", "O Show de Truman", "O Resgate do Soldado Ryan", "Trainspotting", "Amélie Poulain", "O Senhor dos Anéis: A Sociedade do Anel", "O Senhor dos Anéis: As Duas Torres", "Kill Bill", "Encontros e Desencontros", "Oldboy", "Brilho Eterno", "Up", "Bastardos Inglórios", "Avatar", "Cisne Negro", "Django Livre", "Gravidade", "O Lobo de Wall Street", "O Regresso", "Moonlight", "A Chegada", "Coringa", "1917", "Tenet", "Soul", "Top Gun: Maverick", "Oppenheimer", "Barbie", "Pobres Criaturas", "Ainda Estou Aqui"];
      const genresList = [["Mistério", "Suspense"], ["Ação", "Aventura"], ["Ficção", "Drama"], ["Ação", "Crime"], ["Drama"], ["Suspense", "Faroeste"], ["Drama", "Suspense"], ["Animação", "Fantasia"], ["Animação", "Ação"], ["Terror", "Ficção"], ["Terror", "Drama"], ["Terror", "Suspense"], ["Animação", "Família"], ["Ficção", "Comédia"], ["Ação", "Crime"], ["Fantasia", "Aventura"], ["Suspense", "Crime"], ["Crime", "Mistério"], ["Ficção", "Aventura"], ["Drama", "Romance"], ["Animação", "Família"], ["Animação", "Família"], ["Aventura", "Ficção"], ["Ficção", "Família"], ["Ficção", "Aventura"], ["Ficção", "Aventura"], ["Ficção", "Aventura"], ["Terror", "Suspense"], ["Drama", "Romance"], ["Terror"], ["Terror", "Suspense"], ["Drama", "Ação"], ["Ficção", "Suspense"], ["Ficção", "Ação"], ["Drama"], ["Ação", "Suspense"], ["Drama", "Romance"], ["Drama", "Ficção"], ["Drama", "Ação"], ["Drama", "Crime"], ["Romance", "Comédia"], ["Fantasia", "Aventura"], ["Fantasia", "Aventura"], ["Ação", "Crime"], ["Drama", "Romance"], ["Suspense", "Ação"], ["Romance", "Ficção"], ["Animação", "Aventura"], ["Drama", "Ação"], ["Ficção", "Aventura"], ["Drama", "Suspense"], ["Faroeste", "Ação"], ["Ficção", "Suspense"], ["Drama", "Comédia"], ["Drama", "Aventura"], ["Drama"], ["Ficção", "Mistério"], ["Drama", "Crime"], ["Drama", "Ação"], ["Ficção", "Ação"], ["Animação", "Drama"], ["Ação", "Drama"], ["Drama"], ["Comédia", "Aventura"], ["Comédia", "Drama"], ["Drama"]];
      return {
        id: 11 + i,
        title: titles[i],
        year: ["2006", "2015", "2017", "2007", "1998", "2019", "1999", "2001", "2018", "1979", "1980", "2017", "2015", "2022", "2008", "2003", "1991", "1995", "1985", "1994", "1994", "1995", "1993", "1982", "1977", "1980", "1968", "1960", "1942", "1973", "1975", "1976", "1982", "1986", "1987", "1988", "1988", "1998", "1998", "1996", "2001", "2001", "2002", "2003", "2003", "2003", "2004", "2009", "2009", "2009", "2010", "2012", "2013", "2013", "2015", "2016", "2016", "2019", "2019", "2020", "2020", "2022", "2023", "2023", "2023", "2024"][i],
        genres: genresList[i],
        rating: Number((7.0 + Math.random() * 2).toFixed(1)),
        popularity: Math.floor(60 + Math.random() * 40),
        synopsis: "Uma história incrível sobre escolhas, consequências e a jornada humana. (Sinopse detalhada disponível ao conectar a API do TMDB).",
        trailer: ""
      };
    })
  ];

  /* ---------------- API TMDB ---------------- */
  let GENRE_MAP = {};
  async function tmdbFetch(path) {
    const res = await fetch(TMDB_BASE + path, { headers: { Authorization: `Bearer ${CFG.TMDB_TOKEN}`, accept: "application/json" } });
    if (!res.ok) throw new Error(`TMDB ${res.status}`);
    return res.json();
  }
  async function loadFromAPI() {
    const g = await tmdbFetch(`/genre/movie/list?language=${CFG.LANGUAGE}`);
    GENRE_MAP = Object.fromEntries(g.genres.map(x => [x.id, x.name]));
    const pages = [1, 2, 3, 4];
    const data = await Promise.all(pages.map(p => tmdbFetch(`/discover/movie?language=${CFG.LANGUAGE}&region=${CFG.REGION}&sort_by=popularity.desc&vote_count.gte=200&page=${p}`)));
    return data.flatMap(d => d.results).map(r => ({
      id: r.id, title: r.title, year: (r.release_date || "").slice(0, 4) || "—",
      genres: (r.genre_ids || []).map(id => GENRE_MAP[id]).filter(Boolean),
      rating: r.vote_average || 0, popularity: r.popularity || 0,
      poster: r.poster_path ? IMG_BASE + r.poster_path : "",
      synopsis: r.overview || "Sinopse não disponível.", trailer: ""
    }));
  }
  async function fetchTrailerFromAPI(movieId) {
    try {
      const data = await tmdbFetch(`/movie/${movieId}/videos?language=${CFG.LANGUAGE}`);
      const trailer = data.results.find(v => v.type === "Trailer" && v.site === "YouTube");
      return trailer ? trailer.key : null;
    } catch { return null; }
  }

  /* ---------------- Filtros e Recomendação ---------------- */
  const SORTERS = { popularity: (a, b) => b.popularity - a.popularity, rating: (a, b) => b.rating - a.rating, year: (a, b) => Number(b.year) - Number(a.year), title: (a, b) => a.title.localeCompare(b.title, "pt-BR") };
  function applyFilters() {
    const { query, genre, year, minRating, sortBy } = state.filters;
    let list = state.movies.slice();
    if (query) list = list.filter(m => m.title.toLowerCase().includes(query.toLowerCase()));
    if (genre) list = list.filter(m => m.genres.includes(genre));
    if (year) list = list.filter(m => String(m.year) === String(year));
    if (minRating > 0) list = list.filter(m => Number(m.rating) >= minRating);
    list.sort(SORTERS[sortBy] || SORTERS.popularity);
    return list;
  }
  function genreWeights() {
    const w = {};
    const add = (id, weight) => { const m = state.movies.find(x => x.id === id); if (m) m.genres.forEach(g => { w[g] = (w[g] || 0) + weight; }); };
    for (const id of state.favorites) add(id, 1);
    for (const [id, r] of Object.entries(state.ratings)) add(Number(id), (Number(r) - 2.5) * 0.8);
    return w;
  }
  function computeRecommendations(limit = 6) {
    const weights = genreWeights();
    const seen = new Set([...state.favorites, ...Object.keys(state.ratings).map(Number)]);
    return state.movies.filter(m => !seen.has(m.id)).map(m => {
      let base = 0; for (const g of m.genres) base += weights[g] || 0;
      base /= Math.sqrt(m.genres.length || 1);
      return { m, base };
    }).filter(x => x.base > 0).map(x => ({ ...x, score: x.base + Number(x.m.rating) * 0.05 })).sort((a, b) => b.score - a.score).slice(0, limit).map(x => x.m);
  }

  /* ---------------- Hero ---------------- */
  function pickFeatured() {
    const pool = state.movies.filter(m => Number(m.rating) >= 8 && Number(m.popularity) > 0);
    return pool.length ? pool.slice().sort((a, b) => (b.popularity * b.rating) - (a.popularity * a.rating))[0] : state.movies[0];
  }
  function renderHero() {
    const m = state.featured; if (!m) return;
    const hue = hashHue(m.genres[0] || m.title); const hue2 = (hue + 130) % 360; const hue3 = (hue + 60) % 360;
    const isFav = state.favorites.has(m.id);
    const posterInner = m.poster ? `<img src="${esc(m.poster)}" alt="${esc(m.title)}" />` : `<span class="poster-emoji">${genreIcon(m.genres)}</span>`;
    $("#hero").innerHTML = `
      <div class="hero-bg" style="--c1:hsl(${hue} 70% 32%);--c2:hsl(${hue2} 70% 28%)"></div>
      <div class="hero-content">
        <div class="hero-text">
          <span class="hero-eyebrow"><i class="ph ph-film-strip"></i> Em destaque</span>
          <h1 class="hero-title">${esc(m.title)}</h1>
          <p class="hero-meta"><span>${esc(m.year)}</span><span class="dot">·</span><span>${esc(m.genres.slice(0, 3).join(" · "))}</span><span class="dot">·</span><span class="hero-stars"><i class="ph-fill ph-star"></i> ${Number(m.rating).toFixed(1)}</span></p>
          <div class="hero-actions">
            <button class="btn btn-primary ${isFav ? "is-on" : ""}" data-hero-action="fav">
              <i class="ph${isFav ? '-fill' : ''} ph-heart"></i> ${isFav ? "Nos favoritos" : "Favoritar"}
            </button>
            <button class="btn btn-ghost" data-hero-action="details"><i class="ph ph-play"></i> Assistir Trailer</button>
          </div>
        </div>
        <div class="hero-poster-wrap"><div class="hero-poster" style="--p1:hsl(${hue} 55% 26%);--p2:hsl(${hue3} 60% 10%)" data-hero-action="details">${posterInner}</div></div>
      </div>`;
  }

  /* ---------------- Detalhes (Trailer + Sinopse + Comentários) ---------------- */
  async function showMovieDetails(movieId) {
    const m = state.movies.find(x => x.id === movieId); if (!m) return;
    const isFav = state.favorites.has(m.id); const hue = hashHue(m.genres[0] || m.title);
    const posterInner = m.poster ? `<img src="${esc(m.poster)}" alt="${esc(m.title)}" />` : `<span class="poster-emoji" style="font-size:4rem">${genreIcon(m.genres)}</span>`;

    $("#movieDetailsBody").innerHTML = `
      <div class="movie-hero" id="trailerContainer"><div class="trailer-placeholder"><i class="ph ph-spinner-gap" style="font-size:2rem"></i> Carregando trailer...</div></div>
      <div class="movie-details-content">
        <div class="movie-details-text">
          <h1>${esc(m.title)}</h1>
          <div class="movie-details-meta"><span>${esc(m.year)}</span><span class="dot">·</span><span>${esc(m.genres.join(" · "))}</span><span class="dot">·</span><span class="rating"><i class="ph-fill ph-star"></i> ${Number(m.rating).toFixed(1)}</span></div>
          <div class="movie-synopsis-title">Sinopse</div>
          <p class="movie-synopsis">${esc(m.synopsis)}</p>
          
          <div class="movie-details-actions">
            <button class="btn ${isFav ? "btn-primary" : ""}" data-detail-action="fav">
              <i class="ph${isFav ? '-fill' : ''} ph-heart"></i> ${isFav ? "Nos favoritos" : "Favoritar"}
            </button>
            <button class="btn" data-detail-action="close">Voltar</button>
          </div>

          <!-- Área de Comentários -->
          <div class="comments-section">
            <h3 class="comments-title"><i class="ph ph-chat-centered-text"></i> Comentários</h3>
            <div class="comment-form">
              <textarea id="commentInput" placeholder="O que você achou deste filme?" rows="3"></textarea>
              <button class="btn btn-primary" id="submitCommentBtn"><i class="ph ph-paper-plane-right"></i> Publicar</button>
            </div>
            <div class="comment-list" id="commentList"></div>
          </div>
        </div>
        <div class="movie-details-poster" style="--p1:hsl(${hue} 55% 24%);--p2:hsl(${(hue + 40) % 360} 60% 9%)">${posterInner}</div>
      </div>
    `;
    renderComments(m.id);

    const dlg = $("#movieModal"); if (!dlg.open) dlg.showModal();

    let trailerKey = m.trailer; if (HAS_API && !trailerKey) trailerKey = await fetchTrailerFromAPI(m.id);
    const container = $("#trailerContainer");
    if (container) {
      if (trailerKey) container.innerHTML = `<iframe src="https://www.youtube.com/embed/${trailerKey}?autoplay=1&rel=0" title="Trailer" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
      else container.innerHTML = `<div class="trailer-placeholder"><i class="ph ph-film-strip" style="font-size:2rem"></i><br>Trailer não disponível.</div>`;
    }
  }

  /* ---------------- Comentários (Lógica) ---------------- */
  function renderComments(movieId) {
    const listEl = $("#commentList"); if (!listEl) return;
    const comments = state.comments[movieId] || [];
    
    if (comments.length === 0) {
      listEl.innerHTML = `<p class="comment-empty">Nenhum comentário ainda. Seja o primeiro!</p>`;
      return;
    }
    
    listEl.innerHTML = comments.map(c => `
      <div class="comment-item">
        <div class="comment-header">
          <span class="comment-author"><i class="ph ph-user-circle"></i> Você</span>
          <span class="comment-date">${new Date(c.date).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
        </div>
        <p class="comment-text">${esc(c.text)}</p>
      </div>
    `).join("");
  }

  function addComment(movieId) {
    const input = $("#commentInput");
    const text = input.value.trim();
    if (!text) { toast("<i class='ph ph-warning'></i> Escreva algo antes de publicar.", "info"); return; }

    if (!state.comments[movieId]) state.comments[movieId] = [];
    state.comments[movieId].unshift({ id: Date.now(), text, date: new Date().toISOString() });
    saveJSON(LS_COMMENTS, state.comments);
    
    input.value = "";
    renderComments(movieId);
    toast("<i class='ph ph-check-circle'></i> Comentário publicado!", "fav");
  }

  /* ---------------- Renderização de Cards e Grids ---------------- */
  function cardHTML(m, index = 0) {
    const rating = getRating(m.id); const isFav = state.favorites.has(m.id); const isCmp = state.compare.includes(m.id);
    const hue = hashHue(m.genres[0] || m.title); const delay = Math.min(index * 22, 400);
    const posterInner = m.poster ? `<img src="${esc(m.poster)}" alt="${esc(m.title)}" loading="lazy" />` : `<div class="poster" style="--p1:hsl(${hue} 55% 24%);--p2:hsl(${(hue + 40) % 360} 60% 9%)"><span class="poster-emoji">${genreIcon(m.genres)}</span><div class="poster-info"><span class="poster-title">${esc(m.title)}</span><span class="poster-year">${esc(m.year)}</span></div></div>`;
    return `
      <article class="card" data-id="${m.id}" style="animation-delay:${delay}ms">
        <div class="card-poster" data-action="details" style="cursor:pointer" title="Ver detalhes">
          ${posterInner}
          <span class="badge-rating"><i class="ph-fill ph-star"></i> ${Number(m.rating).toFixed(1)}</span>
        </div>
        <div class="card-body">
          <h3 class="card-title" data-action="details" style="cursor:pointer">${esc(m.title)}</h3>
          <p class="card-meta">${esc(m.year)} · ${esc(m.genres.slice(0, 2).join(" · "))}</p>
          <div class="card-actions">
            <button class="btn btn-icon ${isFav ? "is-on" : ""}" data-action="fav" aria-pressed="${isFav}"><i class="ph${isFav ? '-fill' : ''} ph-heart"></i></button>
            <button class="btn btn-icon ${isCmp ? "is-on" : ""}" data-action="compare"><i class="ph ph-arrows-left-right"></i></button>
            <div class="stars">${[1, 2, 3, 4, 5].map(n => `<button class="star ${n <= rating ? "on" : ""}" data-action="rate" data-value="${n}"><i class="ph${n <= rating ? '-fill' : ''} ph-star"></i></button>`).join("")}</div>
          </div>
        </div>
      </article>`;
  }

  function renderGrid() {
    const list = applyFilters();
    $("#grid").innerHTML = list.map((m, i) => cardHTML(m, i)).join("");
    $("#resultsCount").textContent = `${list.length} filme${list.length === 1 ? "" : "s"}`;
    $("#empty").hidden = list.length > 0;
  }
  function renderRecommendations() {
    const reco = computeRecommendations(6); const section = $("#recoSection");
    if (reco.length === 0) { section.hidden = true; return; }
    section.hidden = false; $("#recoGrid").innerHTML = reco.map((m, i) => cardHTML(m, i)).join("");
  }
  function renderFavorites() {
    const favs = state.movies.filter(m => state.favorites.has(m.id)); const grid = $("#favGrid");
    $("#favHeaderCount").textContent = `${favs.length} salvo${favs.length === 1 ? "" : "s"}`;
    if (favs.length === 0) { grid.innerHTML = ""; $("#favEmpty").hidden = false; return; }
    $("#favEmpty").hidden = true; grid.innerHTML = favs.map((m, i) => cardHTML(m, i)).join("");
  }
  function refreshCardStates(id) {
    const isFav = state.favorites.has(id); const rating = getRating(id);
    $$(`.card[data-id="${id}"]`).forEach(card => {
      const favBtn = card.querySelector('[data-action="fav"]');
      if (favBtn) { favBtn.classList.toggle("is-on", isFav); favBtn.innerHTML = `<i class="ph${isFav ? '-fill' : ''} ph-heart"></i>`; }
      card.querySelectorAll('[data-action="rate"]').forEach(s => {
        const on = Number(s.dataset.value) <= rating;
        s.classList.toggle("on", on); s.innerHTML = `<i class="ph${on ? '-fill' : ''} ph-star"></i>`;
      });
    });
  }
  function updateFavCount() {
    const count = state.favorites.size; const el = $("#favCount");
    el.textContent = count; el.hidden = count === 0;
  }

  /* ---------------- Abas e Outros ---------------- */
  function switchTab(tab) {
    state.tab = tab;
    $$(".tab").forEach(t => { const a = t.dataset.tab === tab; t.classList.toggle("active", a); t.setAttribute("aria-selected", String(a)); });
    $("#tab-catalog").hidden = tab !== "catalog"; $("#tab-favorites").hidden = tab !== "favorites";
    if (tab === "favorites") renderFavorites(); window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function toggleCompare(id) {
    const i = state.compare.indexOf(id);
    if (i >= 0) state.compare.splice(i, 1);
    else { if (state.compare.length >= 2) state.compare.shift(); state.compare.push(id); }
    $$(".card").forEach(card => { const cid = Number(card.dataset.id); const btn = card.querySelector('[data-action="compare"]'); if (btn) btn.classList.toggle("is-on", state.compare.includes(cid)); });
    renderCompareTray();
  }
  function chipHTML(m) { return `<span class="chip"><strong>${esc(m.title)}</strong><button class="chip-x" data-remove="${m.id}"><i class="ph ph-x"></i></button></span>`; }
  function renderCompareTray() {
    const tray = $("#compareTray"); const active = state.compare.length > 0;
    tray.hidden = !active; document.body.classList.toggle("has-compare", active);
    if (!active) return;
    const [a, b] = state.compare.map(id => state.movies.find(m => m.id === id));
    $("#slot0").innerHTML = a ? chipHTML(a) : `<span class="muted">Escolha um filme</span>`;
    $("#slot1").innerHTML = b ? chipHTML(b) : `<span class="muted">Escolha outro filme</span>`;
    $("#openCompare").disabled = state.compare.length < 2;
  }
  function renderCompareModal() {
    const [a, b] = state.compare.map(id => state.movies.find(m => m.id === id)); if (!a || !b) return;
    const overlap = a.genres.filter(g => b.genres.includes(g));
    const row = (l, va, vb) => `<tr><th>${l}</th><td>${va}</td><td>${vb}</td></tr>`;
    $("#compareBody").innerHTML = `<table class="compare-table"><thead><tr><th>Critério</th><th>${esc(a.title)}</th><th>${esc(b.title)}</th></tr></thead><tbody>${row("Ano", esc(a.year), esc(b.year))}${row("Nota", Number(a.rating).toFixed(1), Number(b.rating).toFixed(1))}${row("Gêneros", esc(a.genres.join(", ")), esc(b.genres.join(", ")))}</tbody></table><p class="compare-note">Gêneros em comum: <strong>${overlap.length ? esc(overlap.join(", ")) : "nenhum"}</strong></p>`;
  }
  function renderProfile() {
    const favs = state.movies.filter(m => state.favorites.has(m.id));
    const ratedVals = Object.values(state.ratings);
    const avg = ratedVals.length ? ratedVals.reduce((s, v) => s + v, 0) / ratedVals.length : 0;
    const counts = {}; favs.forEach(m => m.genres.forEach(g => counts[g] = (counts[g] || 0) + 1));
    const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 5); const max = top.length ? top[0][1] : 1;
    
    $("#profileBody").innerHTML = `
      <div class="stats">
        <div class="stat"><div class="stat-value">${favs.length}</div><div class="stat-label">Favoritos</div></div>
        <div class="stat"><div class="stat-value">${ratedVals.length}</div><div class="stat-label">Avaliações</div></div>
        <div class="stat"><div class="stat-value">${avg ? avg.toFixed(1) : "—"}</div><div class="stat-label">Nota média</div></div>
      </div>
      <h3 class="profile-sub">Gêneros favoritos</h3>
      ${top.length ? `<div class="bars">${top.map(([g, c]) => `<div class="bar-row"><span>${esc(g)}</span><span class="bar-track"><span class="bar-fill" style="width:${(c/max)*100}%"></span></span></div>`).join("")}</div>` : `<p class="muted">Sem dados.</p>`}
    `;
  }
  function resetFilters() {
    state.filters = { query: "", genre: "", year: "", minRating: 0, sortBy: "popularity" };
    $("#search").value = ""; $("#genreFilter").value = ""; $("#yearFilter").value = ""; $("#minRating").value = "0"; $("#minRatingVal").textContent = "0.0"; $("#sortBy").value = "popularity";
    renderGenreChips(); renderGrid(); toast("<i class='ph ph-broom'></i> Filtros limpos", "info");
  }
  function renderGenreChips() {
    const genres = Array.from(new Set(state.movies.flatMap(m => m.genres))).sort((a, b) => a.localeCompare(b, "pt-BR"));
    $("#genreChips").innerHTML = `<button class="chip-genre ${state.filters.genre === "" ? "active" : ""}" data-chip-genre=""><i class="ph ph-film-script"></i> Todos</button>` + genres.map(g => `<button class="chip-genre ${state.filters.genre === g ? "active" : ""}" data-chip-genre="${esc(g)}">${genreIcon([g])} ${esc(g)}</button>`).join("");
  }
  function buildFilterOptions() {
    const genres = Array.from(new Set(state.movies.flatMap(m => m.genres))).sort();
    const years = Array.from(new Set(state.movies.map(m => String(m.year)))).filter(y => y && y !== "—").sort((a, b) => Number(b) - Number(a));
    $("#genreFilter").innerHTML = `<option value="">Todos os gêneros</option>` + genres.map(g => `<option value="${esc(g)}">${esc(g)}</option>`).join("");
    $("#yearFilter").innerHTML = `<option value="">Todos os anos</option>` + years.map(y => `<option value="${esc(y)}">${esc(y)}</option>`).join("");
  }

  /* ---------------- Eventos Globais ---------------- */
  function bindEvents() {
    $("#search").addEventListener("input", debounce(e => { state.filters.query = e.target.value.trim(); renderGrid(); }, 150));
    $("#genreFilter").addEventListener("change", e => { state.filters.genre = e.target.value; renderGenreChips(); renderGrid(); });
    $("#yearFilter").addEventListener("change", e => { state.filters.year = e.target.value; renderGrid(); });
    $("#sortBy").addEventListener("change", e => { state.filters.sortBy = e.target.value; renderGrid(); });
    $("#minRating").addEventListener("input", e => { state.filters.minRating = Number(e.target.value); $("#minRatingVal").textContent = Number(e.target.value).toFixed(1); renderGrid(); });
    $("#resetFilters").addEventListener("click", resetFilters);
    $("#surpriseBtn").addEventListener("click", () => showSurprise(pickSurprise()));

    document.addEventListener("click", e => {
      // Ações nos cards
      const actionBtn = e.target.closest("[data-action]");
      if (actionBtn) {
        const card = actionBtn.closest(".card"); if (!card) return;
        const id = Number(card.dataset.id); const act = actionBtn.dataset.action;
        const movie = state.movies.find(m => m.id === id);
        if (act === "details") { showMovieDetails(id); return; }
        if (act === "fav") {
          const added = toggleFavorite(id); refreshCardStates(id); renderRecommendations(); renderHero();
          if (state.tab === "favorites") renderFavorites();
          toast(added ? `<i class='ph ph-heart'></i> Adicionado aos favoritos` : `<i class='ph ph-x'></i> Removido dos favoritos`, "fav");
        } else if (act === "rate") {
          const v = Number(actionBtn.dataset.value); const wasOn = getRating(id) === v;
          setRating(id, wasOn ? 0 : v); refreshCardStates(id); renderRecommendations();
          toast(wasOn ? "Avaliação removida" : `<i class='ph-fill ph-star'></i> Avaliado com ${v} estrelas`, "rate");
        } else if (act === "compare") toggleCompare(id);
      }

      // Chips de gênero
      const chip = e.target.closest("[data-chip-genre]");
      if (chip) { state.filters.genre = chip.dataset.chipGenre; $("#genreFilter").value = state.filters.genre; renderGenreChips(); renderGrid(); return; }

      // Tabs
      const tab = e.target.closest(".tab[data-tab]"); if (tab) switchTab(tab.dataset.tab);
      const goto = e.target.closest("[data-goto]"); if (goto) switchTab(goto.dataset.goto);

      // Hero
      const heroBtn = e.target.closest("[data-hero-action]");
      if (heroBtn && state.featured) {
        if (heroBtn.dataset.heroAction === "fav") { toggleFavorite(state.featured.id); renderHero(); renderGrid(); renderRecommendations(); }
        else if (heroBtn.dataset.heroAction === "details") showMovieDetails(state.featured.id);
      }

      // Surprise
      const sBtn = e.target.closest("[data-surprise-action]");
      if (sBtn && state.surprise) {
        if (sBtn.dataset.surpriseAction === "fav") { toggleFavorite(state.surprise.id); showSurprise(state.surprise); }
        else if (sBtn.dataset.surpriseAction === "again") showSurprise(pickSurprise());
      }

      // Detalhes (Botões do Modal)
      const dBtn = e.target.closest("[data-detail-action]");
      if (dBtn) {
        if (dBtn.dataset.detailAction === "close") $("#movieModal").close();
        else if (dBtn.dataset.detailAction === "fav") {
          const title = $("#movieDetailsBody h1")?.textContent;
          const m = state.movies.find(x => x.title === title);
          if (m) { toggleFavorite(m.id); showMovieDetails(m.id); refreshCardStates(m.id); renderHero(); renderRecommendations(); }
        }
      }

      // Submeter Comentário
      if (e.target.closest("#submitCommentBtn")) {
        const title = $("#movieDetailsBody h1")?.textContent;
        const m = state.movies.find(x => x.title === title);
        if (m) addComment(m.id);
      }

      // Fechar Modais (Backdrop)
      if (e.target.tagName === "DIALOG") e.target.close();
    });

    $$("[data-close]").forEach(btn => btn.addEventListener("click", () => btn.closest("dialog").close()));
    $("#profileBtn").addEventListener("click", () => { renderProfile(); $("#profileModal").showModal(); });
    $("#openCompare").addEventListener("click", () => { renderCompareModal(); $("#compareModal").showModal(); });
    $("#clearCompare").addEventListener("click", () => { state.compare = []; $$('.card [data-action="compare"]').forEach(b => b.classList.remove("is-on")); renderCompareTray(); });
    $("#compareTray").addEventListener("click", e => { const rm = e.target.closest("[data-remove]"); if (rm) toggleCompare(Number(rm.dataset.remove)); });
  }

  /* ---------------- Surpreenda-me ---------------- */
  function pickSurprise() {
    let candidates = state.movies.filter(m => !state.favorites.has(m.id)); if (!candidates.length) return null;
    return candidates[Math.floor(Math.random() * candidates.length)];
  }
  function showSurprise(movie) {
    if (!movie) return toast("Você favoritou todos!", "info");
    state.surprise = movie; const isFav = state.favorites.has(movie.id); const hue = hashHue(movie.genres[0] || movie.title);
    const posterInner = movie.poster ? `<img src="${esc(movie.poster)}" alt="${esc(movie.title)}" />` : `<span class="poster-emoji">${genreIcon(movie.genres)}</span>`;
    $("#surpriseBody").innerHTML = `
      <div class="surprise-content">
        <div class="surprise-poster" style="--p1:hsl(${hue} 55% 26%);--p2:hsl(${(hue + 40) % 360} 60% 10%)">${posterInner}</div>
        <div class="surprise-info">
          <span class="surprise-label"><i class="ph ph-dice-five"></i> Sua surpresa</span>
          <h2>${esc(movie.title)}</h2>
          <p class="muted">${esc(movie.year)} · ${esc(movie.genres.join(" · "))}</p>
          <div class="surprise-actions">
            <button class="btn btn-primary" data-surprise-action="fav"><i class="ph${isFav ? '-fill' : ''} ph-heart"></i> ${isFav ? "Favoritado" : "Favoritar"}</button>
            <button class="btn" data-surprise-action="again"><i class="ph ph-arrows-clockwise"></i> Outra</button>
          </div>
        </div>
      </div>`;
    const dlg = $("#surpriseModal"); if (!dlg.open) dlg.showModal();
  }

  /* ---------------- Init ---------------- */
  async function init() {
    bindEvents();
    const badge = $("#modeBadge");
    if (HAS_API) {
      badge.textContent = "TMDB"; $("#footerApi").hidden = false;
      try { state.movies = await loadFromAPI(); } catch { state.movies = DEMO_MOVIES.slice(); badge.textContent = "demo (fallback)"; }
    } else {
      state.movies = DEMO_MOVIES.slice(); badge.textContent = "demonstração";
    }
    state.featured = pickFeatured();
    renderHero(); buildFilterOptions(); renderGenreChips(); renderGrid(); renderRecommendations(); renderCompareTray(); updateFavCount();
  }
  document.addEventListener("DOMContentLoaded", init);
})();

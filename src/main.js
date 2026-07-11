
'use strict';
    // ══════════════════════════════════════════
    const S = {
      // Auth
      traktCid: '', traktToken: '', traktUser: '',
      alToken: '', alUser: '', alUserId: 0, alClientId: '',
      tmdbKey: '', omdbKey: '',
      timerActive: false, timerSeconds: 0, timerInterval: null, timerCategory: 'media', timerItemId: 'untracked', customTimeMinutes: 0,
      // Data
      allItems: [], filtered: [], historyRaw: [], revisitedData: null, franchises: [],
      posterCache: {},
      pinnedIds: new Set(), // IDs fixados manualmente no topo
      // UI
      view: 'list', currentTab: 'fila', sort1: 'alpha', sort2: 'none',
      types: new Set(), states: new Set(), decades: new Set(), activePreset: null,
      availableLists: [], selectedLists: new Set(),
      autoRefreshMin: 15, autoRefreshTimer: null, lastRefresh: null
    };
    const SK = 'filadetelav4';
    const SKF = 'filadetelafr_v2';
    const SKP = 'filadetelap_v1';
    const SKN = 'filadetelap_pins_v1'; // pinned items
    const SKR = 'filadetela_ratings_cache';
    let ratingsCache = {};

    export function saveRatingsCache() { try { localStorage.setItem(SKR, JSON.stringify(ratingsCache)); } catch (e) { } }
    export function loadRatingsCache() { try { const r = localStorage.getItem(SKR); if (r) ratingsCache = JSON.parse(r); } catch (e) { } }
    const AL_CLIENT_ID_DEFAULT = ''; // usuário deve criar o próprio app no AniList

    // ══════════════════════════════════════════
    // SESSION
    // ══════════════════════════════════════════
    export function saveSess() {
      try {
        localStorage.setItem(SK, JSON.stringify({
          traktCid: S.traktCid, traktToken: S.traktToken, traktUser: S.traktUser,
          alToken: S.alToken, alUser: S.alUser, alUserId: S.alUserId, alClientId: S.alClientId,
          tmdbKey: S.tmdbKey, omdbKey: S.omdbKey,
          availableLists: S.availableLists,
          customTimeMinutes: S.customTimeMinutes,
          t: Date.now()
        }));
      } catch (e) { }
    }
    export function loadSess() {
      try {
        const d = JSON.parse(localStorage.getItem(SK) || 'null');
        if (!d) return false;
        if (d.traktToken) { S.traktCid = d.traktCid || ''; S.traktToken = d.traktToken; S.traktUser = d.traktUser; }
        if (d.alToken) { S.alToken = d.alToken; S.alUser = d.alUser; S.alUserId = d.alUserId; S.alClientId = d.alClientId || ''; }
        if (d.tmdbKey) S.tmdbKey = d.tmdbKey;
        if (d.omdbKey) S.omdbKey = d.omdbKey;
        if (d.customTimeMinutes) S.customTimeMinutes = d.customTimeMinutes;
        if (d.availableLists?.length) {
          S.availableLists = d.availableLists;
          S.selectedLists = new Set(d.selectedListIds || d.availableLists.map(l => l.id));
        }
        loadRatingsCache();
        return !!(d.traktToken || d.alToken);
      } catch (e) { return false; }
    }
    export function clearSess() { try { localStorage.removeItem(SK); S.customTimeMinutes = 0; } catch (e) { } }
    export function saveFranchises() { try { localStorage.setItem(SKF + '_' + (S.traktUser || S.alUser), JSON.stringify(S.franchises)); } catch (e) { } }
    export function loadFranchises() { try { const d = JSON.parse(localStorage.getItem(SKF + '_' + (S.traktUser || S.alUser)) || '[]'); S.franchises = Array.isArray(d) ? d : []; } catch (e) { S.franchises = []; } }
    export function savePosterCache() { try { localStorage.setItem(SKP, JSON.stringify(S.posterCache)); } catch (e) { } }
    export function loadPosterCache() { try { const d = JSON.parse(localStorage.getItem(SKP) || '{}'); S.posterCache = d || {}; } catch (e) { S.posterCache = {} } }
    export function savePins() { try { localStorage.setItem(SKN + '_' + (S.traktUser || S.alUser), JSON.stringify([...S.pinnedIds])); } catch (e) { } }
    export function loadPins() { try { const d = JSON.parse(localStorage.getItem(SKN + '_' + (S.traktUser || S.alUser)) || '[]'); S.pinnedIds = new Set(d); } catch (e) { S.pinnedIds = new Set(); } }

    // ══════════════════════════════════════════
    let pollT = null, expT = null;
    export async function startTraktFlow() {
      const cid = document.getElementById('inp-cid').value.trim();
      if (!cid) { showErr('Informe o Client ID.'); return; }
      S.traktCid = cid;
      try {
        const r = await fetch('https://api.trakt.tv/oauth/device/code', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ client_id: cid }) });
        if (!r.ok) throw new Error('Falha OAuth Trakt (' + r.status + ')');
        const d = await r.json();
        document.getElementById('card-main').style.display = 'none';
        document.getElementById('card-device').style.display = 'flex';
        document.getElementById('dev-code').textContent = d.user_code;
        const u = document.getElementById('dev-url'); u.href = d.verification_url; u.textContent = d.verification_url;
        let secs = d.expires_in;
        expT = setInterval(() => { secs--; document.getElementById('dev-timer').textContent = `Expira em ${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`; if (secs <= 0) { clearInterval(expT); cancelDevice(); } }, 1000);
        pollT = setInterval(async () => {
          try {
            const pr = await fetch('https://api.trakt.tv/oauth/device/token', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ grant_type: 'device_code', code: d.device_code, client_id: cid, client_secret: '' }) });
            if (pr.status === 200) {
              clearInterval(pollT); clearInterval(expT);
              const pd = await pr.json(); S.traktToken = pd.access_token;
              await resolveTraktUser();
              document.getElementById('card-device').style.display = 'none';
              document.getElementById('card-main').style.display = 'flex';
              document.getElementById('trakt-status').textContent = '✓ conectado como @' + S.traktUser;
              document.getElementById('trakt-status').style.color = 'var(--green)';
              document.getElementById('btn-enter').style.display = 'flex';
            }
            else if (pr.status === 410 || pr.status === 404) { clearInterval(pollT); clearInterval(expT); document.getElementById('poll-msg').textContent = 'Código expirado.'; }
          } catch (e) { }
        }, (d.interval + 1) * 1000);
      } catch (e) { showErr(e.message); }
    }
    export function cancelDevice() { clearInterval(pollT); clearInterval(expT); document.getElementById('card-device').style.display = 'none'; document.getElementById('card-main').style.display = 'flex'; }
    export function loginTraktManual() {
      const tok = document.getElementById('inp-tok').value.trim(), usr = document.getElementById('inp-usr').value.trim();
      if (!tok || !usr) { showErr('Preencha usuário e token.'); return; }
      S.traktCid = document.getElementById('inp-cid').value.trim() || 'placeholder'; S.traktToken = tok; S.traktUser = usr;
      document.getElementById('trakt-status').textContent = '✓ @' + usr; document.getElementById('trakt-status').style.color = 'var(--green)';
      document.getElementById('btn-enter').style.display = 'flex';
    }
    export async function resolveTraktUser() { try { const r = await traktGet('/users/me'); S.traktUser = r.username; } catch (e) { S.traktUser = 'me'; } }

    // ══════════════════════════════════════════
    export async function startAniListFlow() {
      if (!S.alClientId) { alert('Cole o Client ID do AniList nas configurações (⚙️).'); return; }
      openALPopup();
    }

    export async function startAniListFlowFromLogin() {
      const cid = document.getElementById('inp-al-cid').value.trim();
      if (!cid) { alert('Cole o Client ID do AniList no campo acima.'); return; }
      S.alClientId = cid;
      openALPopup(() => {
        document.getElementById('al-connected').style.display = 'block';
        document.getElementById('btn-enter').style.display = 'flex';
      });
    }

    export function openALPopup(onSuccess) {
      // Salva o client ID e um flag para retomar após redirect
      sessionStorage.setItem('al_auth_pending', '1');
      sessionStorage.setItem('al_client_id', S.alClientId);
      // Redireciona a página inteira — mais confiável que popup
      const redirectUri = window.location.href.split('#')[0].split('?')[0];
      const url = `https://anilist.co/api/v2/oauth/authorize?client_id=${S.alClientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=token`;
      window.location.href = url;
    }

    export async function loginALManual() {
      const tok = document.getElementById('inp-al-tok').value.trim();
      if (!tok) { showErr('Preencha o Access Token.'); return; }
      S.alToken = tok;
      try {
        const data = await alQuery(`{Viewer{id name}}`);
        S.alUser = data.Viewer.name;
        S.alUserId = data.Viewer.id;
        const statusEl = document.getElementById('al-status');
        if (statusEl) {
          statusEl.textContent = '✓ conectado como @' + S.alUser;
          statusEl.style.color = 'var(--green)';
        }
        document.getElementById('btn-enter').style.display = 'flex';
        const connectedEl = document.getElementById('al-connected');
        const disconnectedEl = document.getElementById('al-disconnected');
        if (connectedEl) connectedEl.style.display = 'flex';
        if (disconnectedEl) disconnectedEl.style.display = 'none';
        const lists = await fetchALLists(true);
        const countsByStatus = {};
        for (const lst of lists) countsByStatus[lst.status] = (countsByStatus[lst.status] || 0) + lst.entries.length;
        const statuses = ['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'];
        const labels = { 'CURRENT': 'Assistindo', 'PLANNING': 'Planejado', 'COMPLETED': 'Completo', 'PAUSED': 'Pausado', 'DROPPED': 'Abandonado' };
        const statusGrid = document.getElementById('al-status-grid');
        if (statusGrid) {
          statusGrid.innerHTML = statuses.map(s => `<div class="al-status-item ${countsByStatus[s] ? 'has' : ''}">${labels[s]}<br/><strong>${countsByStatus[s] || 0}</strong></div>`).join('');
        }
        saveSess();
      } catch (e) {
        showErr('Erro AniList manual: ' + e.message);
      }
    }

    // Chamado no INIT para detectar retorno do AniList OAuth
    export function checkALCallback() {
      const hash = window.location.hash;
      if (!hash.includes('access_token')) return;
      const params = new URLSearchParams(hash.substring(1));
      const token = params.get('access_token');
      if (!token) return;
      // Limpa o hash da URL sem recarregar
      history.replaceState(null, '', window.location.pathname);
      // Restaura o client ID salvo antes do redirect
      const savedCid = sessionStorage.getItem('al_client_id');
      if (savedCid) S.alClientId = savedCid;
      sessionStorage.removeItem('al_auth_pending');
      sessionStorage.removeItem('al_client_id');
      S.alToken = token;
      // Carrega a sessão salva e completa o login
      loadSess();
      resolveALUser().then(() => {
        saveSess();
        if (S.traktToken || S.alToken) {
          proceedToApp();
        }
      });
    }

    export async function resolveALUser() {
      try {
        const data = await alQuery(`{Viewer{id name}}`);
        S.alUser = data.Viewer.name; S.alUserId = data.Viewer.id;
        const connectedEl = document.getElementById('al-connected');
        if (connectedEl) connectedEl.style.display = 'block';
        const disconnectedEl = document.getElementById('al-disconnected');
        if (disconnectedEl) disconnectedEl.style.display = 'none';
        const statusEl = document.getElementById('al-status');
        if (statusEl) {
          statusEl.textContent = '✓ conectado como @' + S.alUser;
          statusEl.style.color = 'var(--green)';
        }
        // Fetch status counts
        const lists = await fetchALLists(true);
        const countsByStatus = {};
        for (const lst of lists) countsByStatus[lst.status] = (countsByStatus[lst.status] || 0) + lst.entries.length;
        const statuses = ['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'];
        const labels = { 'CURRENT': 'Assistindo', 'PLANNING': 'Planejado', 'COMPLETED': 'Completo', 'PAUSED': 'Pausado', 'DROPPED': 'Abandonado' };
        const gridEl = document.getElementById('al-status-grid');
        if (gridEl) gridEl.innerHTML = statuses.map(s => `<div class="al-status-item ${countsByStatus[s] ? 'has' : ''}">${labels[s]}<br/><strong>${countsByStatus[s] || 0}</strong></div>`).join('');
        document.getElementById('btn-enter').style.display = 'flex';
      } catch (e) { showErr('Erro AniList: ' + e.message); }
    }

    export async function alQuery(query, variables = {}) {
      const r = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + S.alToken },
        body: JSON.stringify({ query, variables })
      });
      if (!r.ok) throw new Error('AniList ' + r.status);
      const d = await r.json();
      if (d.errors) throw new Error(d.errors[0].message);
      return d.data;
    }

    export async function fetchALLists(minimal = false) {
      const query = `query($userId:Int){MediaListCollection(userId:$userId,type:ANIME){lists{name status entries{mediaId status progress media{title{romaji english}episodes startDate{year}genres coverImage{medium}averageScore}}}}}`;
      const data = await alQuery(query, { userId: S.alUserId });
      return data.MediaListCollection.lists || [];
    }

    // ══════════════════════════════════════════
    // LAUNCH APP
    // ══════════════════════════════════════════
    export function proceedToApp() {
      const tmdbInp = document.getElementById('inp-tmdb');
      if (tmdbInp?.value.trim()) S.tmdbKey = tmdbInp.value.trim();
      const omdbInp = document.getElementById('inp-omdb');
      if (omdbInp?.value.trim()) {
        let val = omdbInp.value.trim();
        const m = val.match(/apikey=([a-zA-Z0-9]+)/);
        S.omdbKey = m ? m[1] : val;
        ratingsCache = {};
        saveRatingsCache();
      }
      saveSess();
      loadPosterCache();
      document.getElementById('screen-login').style.display = 'none';
      document.getElementById('screen-app').style.display = 'flex';
      document.getElementById('lbl-user').textContent = S.traktUser || S.alUser || 'user';
      if (S.traktToken) { document.getElementById('pill-trakt').style.display = 'inline-flex'; }
      if (S.alToken) { document.getElementById('pill-al').style.display = 'inline-flex'; }
      loadFranchises();
      setAutoRefresh(S.autoRefreshMin);
      // Sempre re-descobre listas para garantir dados frescos
      // Se já temos listas salvas, mostra o picker enquanto busca
      if (S.availableLists.length > 0) renderListPicker();
      loadLists();
    }
    export function doLogout() {
      clearInterval(S.autoRefreshTimer);
      Object.assign(S, { 
        traktToken: '', 
        traktUser: '', 
        alToken: '', 
        alUser: '', 
        alUserId: 0, 
        availableLists: [], 
        selectedLists: new Set(), 
        allItems: [],
        historyRaw: null,
        revisitedData: null
      });
      saveSess();
      document.getElementById('screen-app').style.display = 'none';
      document.getElementById('screen-login').style.display = 'flex';
      document.getElementById('card-saved').style.display = 'none';
      document.getElementById('card-main').style.display = 'flex';
      document.getElementById('card-device').style.display = 'none';
      document.getElementById('btn-enter').style.display = 'none';
      document.getElementById('trakt-status').textContent = 'não conectado';
      document.getElementById('trakt-status').style.color = '';
      document.getElementById('al-connected').style.display = 'none';
      if (document.getElementById('al-status')) {
        document.getElementById('al-status').textContent = 'não conectado';
        document.getElementById('al-status').style.color = '';
      }
      document.getElementById('pill-trakt').style.display = 'none';
      document.getElementById('pill-al').style.display = 'none';
      
      // Pre-fill inputs on login screen
      if (S.tmdbKey) document.getElementById('inp-tmdb').value = S.tmdbKey;
      if (S.traktCid) document.getElementById('inp-cid').value = S.traktCid;
      if (S.alClientId) document.getElementById('inp-al-cid').value = S.alClientId;
    }

    // ══════════════════════════════════════════
    export async function traktGet(path) {
      const r = await fetch('https://api.trakt.tv' + path, { headers: { 'Content-Type': 'application/json', 'trakt-api-version': '2', 'trakt-api-key': S.traktCid || 'placeholder', 'Authorization': 'Bearer ' + S.traktToken } });
      if (r.status === 401) throw new Error('Token Trakt inválido.');
      if (!r.ok) throw new Error('Trakt ' + r.status);
      return r.json();
    }

    // ══════════════════════════════════════════
    export async function loadLists() {
      document.getElementById('list-picker').innerHTML = '<div class="poll-row"><div class="spinner"></div><span style="font-size:.75rem;color:var(--t3)">Buscando listas…</span></div>';
      try {
        S.availableLists = [];
        // TRAKT lists
        if (S.traktToken) {
          const custom = await traktGet(`/users/${S.traktUser}/lists`).catch(() => []);
          S.availableLists.push({ id: '__tw__', name: 'Watchlist', slug: 'watchlist', src: 'trakt', icon: '📋', sclass: 'ls-trakt', count: null });
          custom.forEach(l => S.availableLists.push({ id: '__tc__' + l.ids.trakt, name: l.name, slug: l.ids.slug, traktId: l.ids.trakt, src: 'trakt', icon: '📁', sclass: 'ls-trakt', count: l.item_count || null }));
          S.availableLists.push({ id: '__th__', name: 'Histórico', slug: 'history', src: 'trakt', icon: '✅', sclass: 'ls-history', count: null });
        }
        // ANILIST lists by status
        if (S.alToken && S.alUserId) {
          const alLists = await fetchALLists().catch(() => []);
          const statusLabel = { 'CURRENT': 'Assistindo', 'PLANNING': 'Planejado', 'COMPLETED': 'Completo', 'PAUSED': 'Pausado', 'DROPPED': 'Abandonado' };
          const statusClass = { 'CURRENT': 'ls-watching', 'PLANNING': 'ls-planning', 'COMPLETED': 'ls-completed', 'PAUSED': 'ls-paused', 'DROPPED': 'ls-dropped' };
          const statusOrder = ['CURRENT', 'PLANNING', 'PAUSED', 'COMPLETED', 'DROPPED'];
          const byStatus = new Map();
          alLists.forEach(l => { if (l.entries?.length) byStatus.set(l.status, l); });
          statusOrder.forEach(st => {
            if (byStatus.has(st)) {
              const l = byStatus.get(st);
              S.availableLists.push({ id: '__al__' + st, name: 'AL: ' + statusLabel[st], slug: st, src: 'anilist', alStatus: st, icon: '⛩', sclass: statusClass[st] || 'ls-planning', count: l.entries.length, entries: l.entries });
            }
          });
        }
        // Sempre seleciona todas ao carregar — evita tela em branco após refresh
        S.selectedLists = new Set(S.availableLists.map(l => l.id));
        renderListPicker();
        saveSess();
        await loadData();
      } catch (e) {
        document.getElementById('list-picker').innerHTML = `<div style="font-size:.75rem;color:var(--red);padding:.35rem">${e.message}</div>`;
      }
    }

    export function renderListPicker() {
      document.getElementById('list-picker').innerHTML = S.availableLists.map(l => {
        const on = S.selectedLists.has(l.id);
        const srcIcon = l.src === 'trakt' ? '<span class="src-trakt">T</span>' : '<span class="src-al">AL</span>';
        return `<div class="lpick-item ${on ? 'on' : ''}" onclick="toggleList('${l.id}')">
      <div class="lchk">${on ? '✓' : ''}</div>
      <span class="lname">${l.icon} ${l.name}</span>
      ${l.count != null ? `<span style="font-size:.62rem;color:var(--t4);font-family:var(--mono)">${l.count}</span>` : ''}
      ${srcIcon}
    </div>`;
      }).join('');
    }

    export function toggleList(id) {
      if (S.selectedLists.has(id)) S.selectedLists.delete(id); else S.selectedLists.add(id);
      renderListPicker();
      if (S.traktUser === 'demo') { demoRebuild(); return; } loadData();
    }
    export function selectAllLists() { S.selectedLists = new Set(S.availableLists.map(l => l.id)); renderListPicker(); if (S.traktUser === 'demo') { demoRebuild(); return; } loadData(); }
    export function deselectAllLists() { S.selectedLists.clear(); renderListPicker(); S.allItems = []; updateStats(); render(); }

    // ══════════════════════════════════════════
    export async function loadData() {
      if (!S.selectedLists.size) { S.allItems = []; updateStats(); render(); return; }
      const sel = S.availableLists.filter(l => S.selectedLists.has(l.id));
      setSyncing(true, `Carregando ${sel.length} lista${sel.length !== 1 ? 's' : ''}…`);
      // Não limpa S.allItems durante o carregamento — mantém dados anteriores visíveis
      try {
        const [bySource, histData] = await Promise.all([
          Promise.all(sel.map(l => fetchListItems(l))),
          S.traktToken ? fetchHistory().catch(() => ({ raw: [], revisited: null })) : Promise.resolve({ raw: [], revisited: null })
        ]);
        const byId = new Map();
        const byTitle = new Map(); // Cross-source dedup by normalized title+year
        for (const items of bySource) for (const item of items) {
          const k = item.type + '_' + item.id; const ex = byId.get(k);
          if (!ex || item.totalEps > ex.totalEps) byId.set(k, { ...item, sourceLists: [...(ex?.sourceLists || []), item._src] });
          else ex.sourceLists.push(item._src);
        }
        // Merge cross-source duplicates (same title from AniList + Trakt)
        const merged = new Map();
        for (const [k, item] of byId) {
          const normTitle = item.title.toLowerCase().replace(/[^a-z0-9]/g, '');
          const dedupKey = normTitle + '_' + (item.year || 0);
          const existing = merged.get(dedupKey);
          if (existing) {
            // Merge: keep the one with more data, combine sourceLists
            existing.sourceLists = [...new Set([...(existing.sourceLists || []), ...(item.sourceLists || [])])];
            // Prefer AniList score if available
            if (item.alScore && !existing.alScore) existing.alScore = item.alScore;
            // Prefer Trakt IMDb ID if available
            if (item._imdbId && !existing._imdbId) existing._imdbId = item._imdbId;
            // Keep the one with more watched progress
            if (item.watchedEps > existing.watchedEps) {
              existing.watchedEps = item.watchedEps;
              existing.remainingEps = Math.max(0, existing.totalEps - item.watchedEps);
              existing.progress = existing.totalEps > 0 ? Math.round((item.watchedEps / existing.totalEps) * 100) : existing.progress;
              existing.inProgress = item.inProgress || existing.inProgress;
            }
            if (item.totalEps > existing.totalEps) existing.totalEps = item.totalEps;
          } else {
            merged.set(dedupKey, { ...item });
          }
        }
        S.allItems = [...merged.values()];
        S.historyRaw = histData.raw || [];
        S.revisitedData = histData.revisited || null;
        S.lastRefresh = new Date();
        updateStats(); render();
        if (S.currentTab === 'history') renderHistory();
        if (S.currentTab === 'revisited') renderRevisited();
        if (S.currentTab === 'franchise') renderFranchises();
        updateTabCounts();
        setSyncing(false);
      } catch (e) { setSyncing(false); showContainerMsg('Erro: ' + e.message); console.error(e); }
    }

    export async function fetchListItems(lst) {
      // ANILIST lists — entries cached in lst.entries
      if (lst.src === 'anilist') {
        const entries = lst.entries || [];
        return entries.map(e => buildALItem(e, lst.name));
      }
      // TRAKT lists
      if (lst.id === '__tw__') {
        const [m, s] = await Promise.all([traktGet(`/users/${S.traktUser}/watchlist/movies?limit=500`).catch(e => { console.error(e); return []; }), traktGet(`/users/${S.traktUser}/watchlist/shows?limit=500`).catch(e => { console.error(e); return []; })]);
        const sp = await fetchShowsProgress(s);
        return [...m.map(x => ({ ...buildTraktMovie(x), _src: lst.name, traktWatchlist: true })), ...sp.map(({ e, p }) => ({ ...buildTraktShow(e, p), _src: lst.name, traktWatchlist: true }))];
      }
      if (lst.id === '__tp__') {
        // Em progresso: séries/filmes com pelo menos 1 ep assistido mas não concluídos
        const [watchedShows, watchedMovies] = await Promise.all([
          traktGet(`/users/${S.traktUser}/watched/shows?limit=500`).catch(e => { console.error(e); return []; }),
          traktGet(`/users/${S.traktUser}/watched/movies?limit=500`).catch(e => { console.error(e); return []; })
        ]);
        // For shows: fetch progress and keep only truly in-progress ones
        const showsWithProg = await fetchShowsProgress(
          watchedShows.map(s => ({ show: s.show }))
        );
        const inProgressShows = showsWithProg
          .map(({ e, p }) => ({ ...buildTraktShow(e, p), _src: lst.name }))
          .filter(item => item.inProgress); // watched>0 && remaining>0
        // For movies: a watched movie is "done", skip — but include ones started via history
        // (movies don't have episodes so they're either watched or not — skip them here)
        return inProgressShows;
      }
      if (lst.id === '__th__') {
        const [m, s] = await Promise.all([traktGet(`/users/${S.traktUser}/watched/movies?limit=500`).catch(e => { console.error(e); return []; }), traktGet(`/users/${S.traktUser}/watched/shows?limit=500`).catch(e => { console.error(e); return []; })]);
        return [...m.map(x => ({ ...buildWatchedMovie(x), _src: lst.name })), ...s.map(x => ({ ...buildWatchedShow(x), _src: lst.name }))];
      }
      if (lst.id.startsWith('__tc__')) {
        const items = await traktGet(`/users/${S.traktUser}/lists/${lst.slug}/items?limit=500`).catch(e => { console.error(e); return []; });
        const mi = items.filter(i => i.type === 'movie'), si = items.filter(i => i.type === 'show');
        const sp = await fetchShowsProgress(si.map(i => ({ show: i.show })));
        return [...mi.map(x => ({ ...buildTraktMovie({ movie: x.movie }), _src: lst.name })), ...sp.map(({ e, p }) => ({ ...buildTraktShow(e, p), _src: lst.name }))];
      }
      return [];
    }

    export function buildALItem(entry, srcName) {
      const m = entry.media;
      const title = (m.title.english || m.title.romaji || '?');
      const alScore = m.averageScore || null;
      const isAnime = true;
      const totalEps = m.episodes || 0;
      const watched = entry.progress || 0;
      const remaining = Math.max(0, totalEps - watched);
      const pct = totalEps > 0 ? Math.round((watched / totalEps) * 100) : 0;
      const inProgress = entry.status === 'CURRENT' && watched > 0 && remaining > 0;
      const alStatus = entry.status; // CURRENT PLANNING COMPLETED PAUSED DROPPED
      return {
        id: 'al_' + entry.mediaId, title, year: m.startDate?.year || 0,
        type: 'anime', genres: m.genres || [], isAnime: true,
        totalEps, watchedEps: watched, remainingEps: remaining, progress: pct,
        newSeason: false, inProgress,
        alStatus, alPlanning: alStatus === 'PLANNING', alPaused: alStatus === 'PAUSED', alScore,
        src: 'anilist', _src: srcName, sourceLists: [srcName],
        slug: String(entry.mediaId),
        poster: m.coverImage?.medium || null
      };
    }

    export async function fetchShowsProgress(shows) {
      const out = []; const B = 5;
      for (let i = 0; i < shows.length; i += B) {
        const r = await Promise.all(shows.slice(i, i + B).map(async s => { let p = null; try { p = await traktGet(`/shows/${s.show.ids.trakt}/progress/watched`); } catch (e) { } return { e: s, p }; }));
        out.push(...r); if (i + B < shows.length) await sleep(300);
      }
      return out;
    }

    export async function fetchHistory() {
      const [hm, he, wm, ws] = await Promise.all([
        traktGet(`/users/${S.traktUser}/history/movies?limit=200`).catch(e => { console.error(e); return []; }),
        traktGet(`/users/${S.traktUser}/history/episodes?limit=500`).catch(e => { console.error(e); return []; }),
        traktGet(`/users/${S.traktUser}/watched/movies?limit=1000`).catch(e => { console.error(e); return []; }),
        traktGet(`/users/${S.traktUser}/watched/shows?limit=1000`).catch(e => { console.error(e); return []; })
      ]);
      const raw = [
        ...hm.map(e => ({ type: 'movie', title: e.movie?.title || '?', year: e.movie?.year || 0, watchedAt: e.watched_at, id: e.movie?.ids?.trakt })),
        ...he.map(e => ({ type: 'episode', showTitle: e.show?.title || '?', year: e.show?.year || 0, season: e.episode?.season, ep: e.episode?.number, epTitle: e.episode?.title || '', watchedAt: e.watched_at, showId: e.show?.ids?.trakt }))
      ].sort((a, b) => new Date(b.watchedAt) - new Date(a.watchedAt));
      const revMovies = wm.filter(m => m.plays > 1).map(m => ({ id: m.movie.ids.trakt, title: m.movie.title, year: m.movie.year || 0, type: 'movie', plays: m.plays })).sort((a, b) => b.plays - a.plays);
      const revShows = ws.filter(s => s.plays > (s.completed || 0)).map(s => ({ id: s.show.ids.trakt, title: s.show.title, year: s.show.year || 0, type: 'show', plays: s.plays }));
      const epMap = new Map();
      for (const e of he) { if (!e.show || !e.episode) continue; const k = `${e.show.ids.trakt}_s${e.episode.season}e${e.episode.number}`; if (!epMap.has(k)) epMap.set(k, { showId: e.show.ids.trakt, showTitle: e.show.title, showYear: e.show.year || 0, showType: (e.show.genres || []).includes('anime') ? 'anime' : 'show', s: e.episode.season, ep: e.episode.number, title: e.episode.title || '', count: 0 }); epMap.get(k).count++; }
      const rewByShow = new Map();
      for (const [, d] of epMap) { if (d.count < 2) continue; if (!rewByShow.has(d.showId)) rewByShow.set(d.showId, { id: d.showId, title: d.showTitle, year: d.showYear, type: d.showType, plays: 0, episodes: [] }); const sh = rewByShow.get(d.showId); sh.episodes.push({ s: d.s, ep: d.ep, title: d.title, count: d.count }); sh.plays = Math.max(sh.plays, d.count); }
      return { raw, revisited: { movies: revMovies, shows: revShows, epShows: [...rewByShow.values()].sort((a, b) => b.plays - a.plays) } };
    }

    export function buildTraktMovie(e) { const m = e.movie; return { id: m.ids.trakt, _imdbId: m.ids.imdb || null, title: m.title, year: m.year || 0, type: 'movie', genres: m.genres || [], isAnime: false, totalEps: 1, watchedEps: 0, remainingEps: 1, progress: 0, newSeason: false, inProgress: false, src: 'trakt', slug: m.ids.slug || '', alStatus: null }; }
    export function buildTraktShow(e, p) { const s = e.show, g = s.genres || [], isAnime = g.includes('anime'), watched = p?.completed || 0, aired = p?.aired || 0, remaining = Math.max(0, aired - watched), pct = aired > 0 ? Math.round((watched / aired) * 100) : 0, inProgress = watched > 0 && remaining > 0; let ns = false; if (p?.seasons?.length) { const l = p.seasons[p.seasons.length - 1]; if (l && l.aired > 0 && l.completed === 0 && watched > 0) ns = true; } return { id: s.ids.trakt, _imdbId: s.ids.imdb || null, title: s.title, year: s.year || 0, type: isAnime ? 'anime' : 'show', genres: g, isAnime, totalEps: aired, watchedEps: watched, remainingEps: remaining, progress: pct, newSeason: ns, inProgress, src: 'trakt', slug: s.ids.slug || '', alStatus: null }; }
    export function buildWatchedMovie(e) { const m = e.movie; return { id: m.ids.trakt, _imdbId: m.ids.imdb || null, title: m.title, year: m.year || 0, type: 'movie', genres: m.genres || [], isAnime: false, totalEps: 1, watchedEps: 1, remainingEps: 0, progress: 100, newSeason: false, inProgress: false, src: 'trakt', slug: m.ids.slug || '', alStatus: null }; }
    export function buildWatchedShow(e) { const s = e.show; return { id: s.ids.trakt, _imdbId: s.ids.imdb || null, title: s.title, year: s.year || 0, type: (s.genres || []).includes('anime') ? 'anime' : 'show', genres: s.genres || [], isAnime: false, totalEps: e.plays || 0, watchedEps: e.plays || 0, remainingEps: 0, progress: 100, newSeason: false, inProgress: false, src: 'trakt', slug: s.ids.slug || '', alStatus: null }; }
    export function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

    // ══════════════════════════════════════════
    const DSEED = [
      ['Blade Runner', 'movie', 1982, '__tw__', 'trakt'], ['2001: A Space Odyssey', 'movie', 1968, '__tc__1', 'trakt'],
      ['Stalker', 'movie', 1979, '__tc__1', 'trakt'], ['Alien', 'movie', 1979, '__tc__1', 'trakt'],
      ['The Godfather', 'movie', 1972, '__tc__1', 'trakt'], ['Mad Max: Fury Road', 'movie', 2015, '__tw__', 'trakt'],
      ['Parasite', 'movie', 2019, '__tw__', 'trakt'], ['Oppenheimer', 'movie', 2023, '__tw__', 'trakt'],
      ['Breaking Bad', 'show', 2008, '__tc__2', 'trakt'], ['True Detective', 'show', 2014, '__tc__2', 'trakt'],
      ['Dark', 'show', 2017, '__tc__2', 'trakt'], ['Severance', 'show', 2022, '__tw__', 'trakt'],
      // Em progresso — séries começadas mas não terminadas
      ['The Leftovers', 'show', 2014, '__tp__', 'trakt'],
      ['Twin Peaks', 'show', 1990, '__tp__', 'trakt'],
      ['Chernobyl', 'show', 2019, '__tp__', 'trakt'],
      // AniList items
      ['Neon Genesis Evangelion', 'anime', 1995, '__al__COMPLETED', 'anilist'],
      ['Fullmetal Alchemist: Brotherhood', 'anime', 2009, '__al__COMPLETED', 'anilist'],
      ['Attack on Titan', 'anime', 2013, '__al__COMPLETED', 'anilist'],
      ['Cowboy Bebop', 'anime', 1998, '__al__COMPLETED', 'anilist'],
      ['Breaking Bad (Rewatch)', 'show', 2008, '__al__PLANNING', 'trakt'],
      ['Vinland Saga', 'anime', 2019, '__al__PLANNING', 'anilist'],
      ['Jujutsu Kaisen', 'anime', 2020, '__al__CURRENT', 'anilist'],
      ["Frieren: Beyond Journey's End", 'anime', 2023, '__al__CURRENT', 'anilist'],
      ['Demon Slayer', 'anime', 2019, '__al__PLANNING', 'anilist'],
      ['Monster', 'anime', 2004, '__al__PLANNING', 'anilist'],
      ['Parasyte', 'anime', 2014, '__al__PLANNING', 'anilist'],
      ['Cyberpunk: Edgerunners', 'anime', 2022, '__al__PLANNING', 'anilist'],
      ['One-Punch Man', 'anime', 2015, '__al__PAUSED', 'anilist'],
      ['Code Geass', 'anime', 2006, '__al__PLANNING', 'anilist'],
      ['ERASED', 'anime', 2016, '__al__PLANNING', 'anilist'],
      ['91 Days', 'anime', 2016, '__al__PLANNING', 'anilist'],
    ];
    let _dAll = [];
    export function loadDemo() {
      S.traktUser = 'demo'; S.traktCid = 'demo'; S.traktToken = 'demo'; S.alUser = 'demo_al'; S.alToken = 'demo'; S.alUserId = 1;
      S.availableLists = [
        { id: '__tw__', name: 'Watchlist', slug: 'watchlist', src: 'trakt', icon: '📋', sclass: 'ls-trakt', count: 4 },
        { id: '__tc__1', name: 'Filmes pra ver', slug: 'filmes', traktId: 1, src: 'trakt', icon: '📁', sclass: 'ls-trakt', count: 5 },
        { id: '__tc__2', name: 'Séries', slug: 'series', traktId: 2, src: 'trakt', icon: '📁', sclass: 'ls-trakt', count: 3 },
        { id: '__tp__', name: 'Em progresso', slug: 'inprogress', src: 'trakt', icon: '▶', sclass: 'ls-watching', count: null },
        { id: '__th__', name: 'Histórico', slug: 'history', src: 'trakt', icon: '✅', sclass: 'ls-history', count: null },
        { id: '__al__CURRENT', name: 'AL: Assistindo', slug: 'CURRENT', src: 'anilist', alStatus: 'CURRENT', icon: '⛩', sclass: 'ls-watching', count: 2 },
        { id: '__al__PLANNING', name: 'AL: Planejado', slug: 'PLANNING', src: 'anilist', alStatus: 'PLANNING', icon: '⛩', sclass: 'ls-planning', count: 9 },
        { id: '__al__COMPLETED', name: 'AL: Completo', slug: 'COMPLETED', src: 'anilist', alStatus: 'COMPLETED', icon: '⛩', sclass: 'ls-completed', count: 4 },
        { id: '__al__PAUSED', name: 'AL: Pausado', slug: 'PAUSED', src: 'anilist', alStatus: 'PAUSED', icon: '⛩', sclass: 'ls-paused', count: 1 },
      ];
      S.selectedLists = new Set(S.availableLists.map(l => l.id));
      const alStatusMap = { '__al__CURRENT': 'CURRENT', '__al__PLANNING': 'PLANNING', '__al__COMPLETED': 'COMPLETED', '__al__PAUSED': 'PAUSED' };
      _dAll = DSEED.map(([title, type, year, lid, src], i) => {
        const isAnime = type === 'anime' || src === 'anilist';
        const tot = type === 'movie' ? 1 : Math.floor(Math.random() * 90) + 8;
        const alSt = alStatusMap[lid] || null;
        const forceInProgress = lid === '__tp__';
        const w = alSt === 'COMPLETED' ? tot : alSt === 'CURRENT' ? Math.floor(tot * .5) : alSt === 'PAUSED' ? Math.floor(tot * .3) : forceInProgress ? Math.max(1, Math.floor(tot * .4)) : type === 'movie' ? 0 : Math.floor(Math.random() * tot);
        const rem = tot - w, pct = Math.round((w / tot) * 100), inp = (w > 0 && rem > 0), ns = type !== 'movie' && inp && !alSt && Math.random() < .2;
        const lst = S.availableLists.find(l => l.id === lid);
        return { id: src === 'anilist' ? 'al_' + (1000 + i) : i + 1, title, year, type: isAnime ? 'anime' : type, genres: [], isAnime, totalEps: tot, watchedEps: w, remainingEps: rem, progress: pct, newSeason: ns, inProgress: inp, alStatus: alSt, alPlanning: alSt === 'PLANNING', alPaused: alSt === 'PAUSED', traktWatchlist: lid === '__tw__', src, _src: lst?.name || '', _lid: lid, sourceLists: [lst?.name || ''], slug: title.toLowerCase().replace(/ /g, '-'), poster: null };
      });
      S.historyRaw = buildDemoHistory();
      S.revisitedData = buildDemoRevisited();
      S.franchises = [
        { id: 1, name: 'Alien', items: [{ traktId: 3, title: 'Alien', year: 1979, type: 'movie' }, { traktId: 901, title: 'Aliens', year: 1986, type: 'movie' }, { traktId: 902, title: 'Alien 3', year: 1992, type: 'movie' }] },
        { id: 2, name: 'O Poderoso Chefão', items: [{ traktId: 5, title: 'The Godfather', year: 1972, type: 'movie' }, { traktId: 903, title: 'The Godfather Part II', year: 1974, type: 'movie' }] },
      ];
      document.getElementById('screen-login').style.display = 'none';
      document.getElementById('screen-app').style.display = 'flex';
      document.getElementById('lbl-user').textContent = 'demo';
      document.getElementById('pill-trakt').style.display = 'inline-flex';
      document.getElementById('pill-al').style.display = 'inline-flex';
      renderListPicker(); demoRebuild(); updateTabCounts();
    }
    export function demoRebuild() { S.allItems = _dAll.filter(i => S.selectedLists.has(i._lid)); updateStats(); render(); }
    export function buildDemoHistory() { const n = new Date(); return [{ type: 'movie', title: 'Blade Runner', year: 1982, watchedAt: new Date(n - 86400000).toISOString() }, { type: 'episode', showTitle: 'Breaking Bad', year: 2008, season: 5, ep: 14, epTitle: 'Ozymandias', watchedAt: new Date(n - 2 * 86400000).toISOString() }, { type: 'episode', showTitle: 'Breaking Bad', year: 2008, season: 5, ep: 15, epTitle: 'Granite State', watchedAt: new Date(n - 2 * 86400000).toISOString() }, { type: 'movie', title: 'Parasite', year: 2019, watchedAt: new Date(n - 3 * 86400000).toISOString() }, { type: 'episode', showTitle: 'Dark', year: 2017, season: 2, ep: 1, epTitle: 'Beginnings and Endings', watchedAt: new Date(n - 4 * 86400000).toISOString() }, { type: 'movie', title: '2001: A Space Odyssey', year: 1968, watchedAt: new Date(n - 6 * 86400000).toISOString() }]; }
    export function buildDemoRevisited() { return { movies: [{ id: 1, title: 'Blade Runner', year: 1982, type: 'movie', plays: 5 }, { id: 2, title: '2001: A Space Odyssey', year: 1968, type: 'movie', plays: 3 }], shows: [], epShows: [{ id: 21, title: 'Breaking Bad', year: 2008, type: 'show', plays: 3, episodes: [{ s: 5, ep: 14, title: 'Ozymandias', count: 3 }, { s: 5, ep: 16, title: 'Felina', count: 2 }] }] }; }

    // ══════════════════════════════════════════
    export function toggleType(t) { if (S.types.has(t)) S.types.delete(t); else S.types.add(t); document.getElementById('chip-' + t).classList.toggle('on', S.types.has(t)); S.activePreset = null; clearPHL(); render(); }
    export function toggleState(st) { if (S.states.has(st)) S.states.delete(st); else S.states.add(st); document.getElementById('chip-' + st).classList.toggle('on', S.states.has(st)); S.activePreset = null; clearPHL(); render(); }
    export function toggleDecade(d) { if (S.decades.has(d)) S.decades.delete(d); else S.decades.add(d); document.getElementById('chip-' + d).classList.toggle('on', S.decades.has(d)); S.activePreset = null; clearPHL(); render(); }
    export function setSort(s) { S.sort1 = s; document.querySelectorAll('#sort-list .sitem').forEach(el => el.classList.toggle('on', el.dataset.s === s)); render(); }
    export function clearPHL() { document.querySelectorAll('.preset').forEach(b => b.classList.remove('on')); }

    export function applyPreset(name) {
      resetFilters(); S.activePreset = name;
      const el = document.getElementById('pr-' + name); if (el) el.classList.add('on');
      switch (name) {
        case 'oldmovies': S.types.add('movie'); document.getElementById('chip-movie').classList.add('on'); setSort('year-asc'); break;
        case 'almostdone': S.states.add('inprogress'); document.getElementById('chip-inprogress').classList.add('on'); S.states.add('almostdone'); document.getElementById('chip-almostdone').classList.add('on'); setSort('eps-asc'); break;
        case 'newseason': S.states.add('newseason'); document.getElementById('chip-newseason').classList.add('on'); setSort('eps-asc'); break;
        case 'inprogress': S.states.add('inprogress'); document.getElementById('chip-inprogress').classList.add('on'); setSort('prog-desc'); break;
        case 'combo': S.types.add('movie'); document.getElementById('chip-movie').classList.add('on'); S.states.add('inprogress'); document.getElementById('chip-inprogress').classList.add('on'); setSort('year-asc'); document.getElementById('sel-sort2').value = 'eps-asc'; S.sort2 = 'eps-asc'; break;
        case 'planning': S.states.add('planning'); document.getElementById('chip-planning').classList.add('on'); setSort('alpha'); break;
      }
      render();
    }

    export function resetFilters() {
      S.types.clear(); S.states.clear(); S.decades.clear(); S.sort1 = 'alpha'; S.sort2 = 'none'; S.activePreset = null;
      document.querySelectorAll('.chip').forEach(c => c.classList.remove('on'));
      document.querySelectorAll('#sort-list .sitem').forEach(el => el.classList.toggle('on', el.dataset.s === 'alpha'));
      document.getElementById('sel-sort2').value = 'none';
      document.getElementById('inp-yfrom').value = ''; document.getElementById('inp-yto').value = '';
      document.getElementById('inp-search').value = ''; clearPHL(); render();
    }

    export function applyFilters() {
      let items = [...S.allItems];
      const q = document.getElementById('inp-search').value.toLowerCase().trim();
      const yF = parseInt(document.getElementById('inp-yfrom').value) || 0, yT = parseInt(document.getElementById('inp-yto').value) || 9999;
      if (q) items = items.filter(i => i.title.toLowerCase().includes(q));
      if (yF > 0 || yT < 9999) items = items.filter(i => i.year >= yF && i.year <= yT);
      if (S.decades.size > 0) items = items.filter(i => { for (const d of S.decades) { if (d === '2020s' && i.year >= 2020) return true; if (d === '2010s' && i.year >= 2010 && i.year < 2020) return true; if (d === '2000s' && i.year >= 2000 && i.year < 2010) return true; if (d === '1990s' && i.year >= 1990 && i.year < 2000) return true; if (d === 'pre1990' && i.year < 1990) return true; } return false; });
      if (S.activePreset === 'combo') { items = items.filter(i => i.type === 'movie' || (i.type !== 'movie' && i.inProgress)); }
      else {
        if (S.types.size > 0) items = items.filter(i => S.types.has(i.type));
        if (S.states.size > 0) items = items.filter(i => {
          for (const st of S.states) {
            if (st === 'inprogress' && i.inProgress) return true;
            if (st === 'newseason' && i.newSeason) return true;
            if (st === 'notseen' && i.watchedEps === 0 && !i.alPaused && !i.alPlanning && !i.traktWatchlist) return true;
            if (st === 'almostdone' && i.remainingEps > 0 && i.remainingEps <= 5) return true;
            if (st === 'planning' && (i.alPlanning || i.alStatus === 'PLANNING' || i.traktWatchlist)) return true;
            if (st === 'paused' && (i.alPaused || i.alStatus === 'PAUSED')) return true;
          } return false;
        });
      }
      const c1 = sf(S.sort1), c2 = S.sort2 !== 'none' ? sf(S.sort2) : null;
      items.sort((a, b) => { const r = c1(a, b); return r !== 0 || !c2 ? r : c2(a, b); });
      items = applyFrPromo(items);
      // Pins always float to the very top, preserving their relative order
      const pinned = items.filter(i => S.pinnedIds.has(String(i.id)));
      const rest = items.filter(i => !S.pinnedIds.has(String(i.id)));
      items = [...pinned, ...rest];
      S.filtered = items;
      document.getElementById('lbl-count').textContent = items.length + ' itens';
      document.getElementById('tc-fila').textContent = items.length;
      updateFBar(); return items;
    }
    export function sf(s) { switch (s) { case 'year-asc': return (a, b) => a.year - b.year; case 'year-desc': return (a, b) => b.year - a.year; case 'eps-asc': return (a, b) => a.remainingEps - b.remainingEps; case 'eps-desc': return (a, b) => b.remainingEps - a.remainingEps; case 'prog-desc': return (a, b) => b.progress - a.progress; case 'alpha': return (a, b) => a.title.localeCompare(b.title, 'pt'); default: return () => 0; } }

    export function togglePin(id) {
      const sid = String(id);
      if (S.pinnedIds.has(sid)) S.pinnedIds.delete(sid);
      else S.pinnedIds.add(sid);
      savePins(); render();
    }

    export function updateFBar() {
      const bar = document.getElementById('fbar'), tags = document.getElementById('ftags'), t = [];
      if (S.activePreset) { const n = { oldmovies: '🎬 Filmes antigos', almostdone: '🏁 Quase terminei', newseason: '🆕 Nova temporada', inprogress: '▶ Em andamento', combo: '🎬+▶', planning: '📋 Planejados' }; t.push(`<span class="tag">${n[S.activePreset] || S.activePreset}<button onclick="resetFilters()">×</button></span>`); }
      const tl = { movie: '🎬', show: '📺', anime: '⛩' }; S.types.forEach(v => t.push(`<span class="tag">${tl[v]}<button onclick="toggleType('${v}')">×</button></span>`));
      const sl = { inprogress: '▶', newseason: '🆕', notseen: '👁', almostdone: '🏁', planning: '📋', paused: '⏸' }; S.states.forEach(v => t.push(`<span class="tag">${sl[v]}<button onclick="toggleState('${v}')">×</button></span>`));
      S.decades.forEach(v => t.push(`<span class="tag">${v}<button onclick="toggleDecade('${v}')">×</button></span>`));
      bar.style.display = t.length ? 'flex' : 'none'; tags.innerHTML = t.join('');
    }

    // ══════════════════════════════════════════
    export function cfgSaveOMDb() {
      let val = document.getElementById('cfg-omdb-key').value.trim();
      const match = val.match(/apikey=([a-zA-Z0-9]+)/);
      S.omdbKey = match ? match[1] : (val || null);
      saveSess();
      ratingsCache = {};
      saveRatingsCache();
      render();
      const m = document.getElementById('cfg-omdb-msg');
      m.style.display = 'block'; m.style.color = 'var(--green)';
      m.textContent = "Key salva!";
      setTimeout(() => m.style.display = 'none', 2000);
    }
    
    export function cfgClearRatings() {
      if(confirm('Limpar o cache de notas do OMDb?')) {
        ratingsCache = {};
        saveRatingsCache();
        const m = document.getElementById('cfg-omdb-msg');
        m.style.display = 'block'; m.style.color = 'var(--t3)';
        m.textContent = "Cache limpo!";
        setTimeout(() => m.style.display = 'none', 2000);
      }
    }

    // ══════════════════════════════════════════
    export function getFrNextIds() {
      const nextIds = new Set();
      const watchedIds = new Set(S.allItems.filter(i => i.progress === 100 || i.remainingEps === 0 || i.alStatus === 'COMPLETED').map(i => i.id));
      for (const h of S.historyRaw) { if (h.type === 'movie' && h.id) watchedIds.add(h.id); }
      for (const fr of S.franchises) {
        for (const fi of fr.items) {
          if (!watchedIds.has(fi.traktId)) { nextIds.add(fi.traktId); break; }
        }
      }
      return nextIds;
    }
    export function applyFrPromo(items) {
      if (!S.franchises.length) return items;
      const nextIds = getFrNextIds(); if (!nextIds.size) return items;
      return [...items.filter(i => nextIds.has(i.id)), ...items.filter(i => !nextIds.has(i.id))];
    }
    export function getFrInfo(id) {
      for (const fr of S.franchises) { const idx = fr.items.findIndex(fi => fi.traktId === id); if (idx >= 0) return { name: fr.name, pos: idx + 1, total: fr.items.length }; } return null;
    }

    export function autoDetect() {
      const btn = document.getElementById('btn-autodetect'); btn.disabled = true; btn.textContent = '⚡ Detectando…';
      const movies = S.allItems.filter(i => i.type === 'movie');
      const hmap = new Map();
      for (const m of movies) {
        const base = m.title.replace(/[\s:–-]+(?:part|vol|volume|chapter|parte)[\s.]+\w+$/i, '').replace(/[\s:–-]+[IVX]{2,}$/, '').replace(/[\s:–-]+\d+$/, '').replace(/\s+\(.*?\)$/, '').trim();
        if (base.length < 3 || base === m.title) continue;
        const k = 'h_' + base.toLowerCase();
        if (!hmap.has(k)) hmap.set(k, { name: base, movies: [] });
        hmap.get(k).movies.push({ traktId: m.id, title: m.title, year: m.year, type: m.type });
      }
      let added = 0;
      for (const [, g] of hmap) {
        if (g.movies.length >= 2) {
          const exists = S.franchises.some(fr => fr.name === g.name);
          if (!exists) { S.franchises.push({ id: Date.now() + Math.random(), name: g.name, items: g.movies.sort((a, b) => a.year - b.year) }); added++; }
        }
      }
      saveFranchises(); renderFranchises(); updateTabCounts(); render();
      btn.textContent = `✓ ${added} detectado${added !== 1 ? 's' : ''}`;
      setTimeout(() => { btn.disabled = false; btn.textContent = '⚡ Detectar auto'; }, 2500);
    }

    export function renderFranchises() {
      const c = document.getElementById('franchise-container');
      const q = document.getElementById('inp-fr-search').value.toLowerCase().trim();
      let frs = S.franchises; if (q) frs = frs.filter(fr => fr.name.toLowerCase().includes(q));
      document.getElementById('lbl-fr-count').textContent = frs.length;
      document.getElementById('tc-franchise').textContent = S.franchises.length;
      if (!frs.length) { c.innerHTML = `<div class="state-box"><span class="stico">🎬</span>${q ? 'Nenhuma franquia encontrada.' : 'Nenhuma franquia.<br><span style="font-size:.72rem;color:var(--t4);margin-top:.3rem;display:block">Clique em "Detectar auto" ou crie manualmente.</span>'}</div>`; return; }
      const watchedIds = new Set(S.allItems.filter(i => i.progress === 100 || i.remainingEps === 0 || i.alStatus === 'COMPLETED').map(i => i.id));
      for (const h of S.historyRaw) { if (h.type === 'movie' && h.id) watchedIds.add(h.id); }
      const byId = new Map(S.allItems.map(i => [i.id, i]));
      const tC = { movie: 'bm', show: 'bs', anime: 'ba' }, tL = { movie: 'Filme', show: 'Série', anime: 'Anime' };
      c.innerHTML = frs.map(fr => {
        let nextIdx = -1; for (let i = 0; i < fr.items.length; i++) { if (!watchedIds.has(fr.items[i].traktId)) { nextIdx = i; break; } }
        const doneCount = fr.items.filter(fi => watchedIds.has(fi.traktId)).length;
        const allDone = doneCount === fr.items.length;
        const items = fr.items.map((fi, idx) => {
          const inQ = byId.has(fi.traktId), watched = watchedIds.has(fi.traktId), isNext = idx === nextIdx;
          const si = watched ? '✅' : isNext ? '▶' : inQ ? '⏳' : '—';
          return `<div class="fritem ${watched ? 'isw' : ''} ${isNext ? 'isnext' : ''} ${!inQ && !watched ? 'nolist' : ''}">
        <div class="frinum">${idx + 1}</div><div class="frstat">${si}</div>
        <div class="friinfo">
          <div class="frititle">${fi.title}${isNext ? '<span class="nextpill">próximo</span>' : ''}${!inQ && !watched ? '<span style="font-size:.62rem;color:var(--t4)">fora da fila</span>' : ''}</div>
          <div class="frimeta"><span class="badge ${tC[fi.type] || 'bm'}">${tL[fi.type] || 'Filme'}</span><span>${fi.year || '—'}</span></div>
        </div>
      </div>`;
        }).join('');
        const sb = allDone ? '<span class="frdone">✓ Completa</span>' : nextIdx >= 0 ? `<span class="frnext">▶ ${fr.items[nextIdx].title}</span>` : '';
        return `<div class="frgroup"><div class="frhead" onclick="toggleFrGrp(this)"><span class="frname">${fr.name}</span><div class="frmeta">${sb}<span>${doneCount}/${fr.items.length}</span><button class="btn btn-xs btn-ghost" onclick="event.stopPropagation();openFrEditor('${fr.id}')" style="padding:.1rem .4rem">✏️</button></div><span class="frchev">▶</span></div><div class="fritems">${items}</div></div>`;
      }).join('');
    }
    export function toggleFrGrp(h) { const it = h.nextElementSibling, cv = h.querySelector('.frchev'); it.classList.toggle('open'); cv.classList.toggle('open'); }

    // franchise editor
    let _frId = null, _frItems = [], _frSel = null, _drIdx = null;
    export function openFrEditor(id) {
      _frId = id; const fr = id ? S.franchises.find(f => f.id == id) : null;
      _frItems = fr ? [...fr.items.map(i => ({ ...i }))] : [];
      document.getElementById('fr-modal-title').textContent = fr ? 'Editar Franquia' : 'Nova Franquia';
      document.getElementById('fr-modal-name').value = fr ? fr.name : '';
      document.getElementById('fr-del-btn').style.display = fr ? 'inline-flex' : 'none';
      document.getElementById('fr-add-inp').value = ''; document.getElementById('fr-ac').style.display = 'none'; _frSel = null;
      renderFrList(); document.getElementById('fr-modal').style.display = 'flex';
    }
    export function closeFrModal() { document.getElementById('fr-modal').style.display = 'none'; }
    export function renderFrList() {
      const el = document.getElementById('fr-modal-list');
      if (!_frItems.length) { el.innerHTML = '<div style="font-size:.75rem;color:var(--t4);padding:.35rem">Nenhum item.</div>'; return; }
      el.innerHTML = _frItems.map((item, i) => `<div class="freitem" draggable="true" data-idx="${i}" ondragstart="frDS(event,${i})" ondragover="frDO(event,${i})" ondrop="frDR(event,${i})"><span class="frdrag">⠿</span><span class="frinum">${i + 1}</span><span class="frename">${item.title} <span style="color:var(--t4);font-size:.68rem">(${item.year || '?'})</span></span><button class="frerm" onclick="frRm(${i})">×</button></div>`).join('');
    }
    export function frRm(i) { _frItems.splice(i, 1); renderFrList(); }
    export function frDS(e, i) { _drIdx = i; } function frDO(e, i) { e.preventDefault(); } function frDR(e, i) { e.preventDefault(); if (_drIdx === null || _drIdx === i) return; const m = _frItems.splice(_drIdx, 1)[0]; _frItems.splice(i, 0, m); _drIdx = null; renderFrList(); }
    export function frAC(q) {
      const ac = document.getElementById('fr-ac'); if (!q.trim()) { ac.style.display = 'none'; return; }
      const matches = S.allItems.filter(i => i.title.toLowerCase().includes(q.toLowerCase()) && !_frItems.find(fi => fi.traktId === i.id)).slice(0, 8);
      if (!matches.length) { ac.style.display = 'none'; return; }
      ac.innerHTML = matches.map(m => `<div class="acitem" onclick="frSel(${typeof m.id === 'string' ? '"' + m.id + '"' : m.id},'${m.title.replace(/'/g, "\\'")}',${m.year},'${m.type}')">${m.title} <span style="color:var(--t4);font-size:.68rem">(${m.year || '?'})</span></div>`).join('');
      ac.style.display = 'block';
    }
    export function frSel(id, title, year, type) { _frSel = { traktId: id, title, year, type }; document.getElementById('fr-add-inp').value = title + ' (' + (year || '?') + ')'; document.getElementById('fr-ac').style.display = 'none'; }
    export function frAddSel() { if (!_frSel) { const q = document.getElementById('fr-add-inp').value.trim(); const m = S.allItems.find(i => i.title.toLowerCase() === q.toLowerCase()); if (m) _frSel = { traktId: m.id, title: m.title, year: m.year, type: m.type }; } if (!_frSel) { alert('Selecione um item da lista.'); return; } if (_frItems.find(fi => fi.traktId === _frSel.traktId)) { alert('Já está na franquia.'); return; } _frItems.push({ ..._frSel }); _frSel = null; document.getElementById('fr-add-inp').value = ''; document.getElementById('fr-ac').style.display = 'none'; renderFrList(); }
    export function saveFr() { const name = document.getElementById('fr-modal-name').value.trim(); if (!name) { alert('Informe o nome.'); return; } if (!_frItems.length) { alert('Adicione pelo menos um item.'); return; } if (_frId) { const idx = S.franchises.findIndex(f => f.id == _frId); if (idx >= 0) S.franchises[idx] = { id: _frId, name, items: _frItems }; } else { S.franchises.push({ id: Date.now(), name, items: _frItems }); } saveFranchises(); closeFrModal(); renderFranchises(); updateTabCounts(); render(); }
    export function deleteFr() { if (!_frId || !confirm('Excluir?')) return; S.franchises = S.franchises.filter(f => f.id != _frId); saveFranchises(); closeFrModal(); renderFranchises(); updateTabCounts(); render(); }

    // ══════════════════════════════════════════
    // RENDER — FILA
    // ══════════════════════════════════════════
    export function render() {
      applyFilters(); const items = S.filtered, c = document.getElementById('media-container');
      if (!items.length) { c.innerHTML = `<div class="state-box"><span class="stico">🔍</span>Nenhum item com esses filtros.</div>`; return; }
      S.view === 'grid' ? renderGrid(c, items) : renderList(c, items);
      lazyLoadPosters(items);
      lazyLoadRatings(items);
    }

    export function alStatusBadge(item) {
      if (!item.alStatus) return '';
      const cls = { CURRENT: 'als-watching', PLANNING: 'als-planning', PAUSED: 'als-paused', DROPPED: 'als-dropped', COMPLETED: 'als-completed' };
      const lbl = { CURRENT: 'Assistindo', PLANNING: 'Planejado', PAUSED: 'Pausado', DROPPED: 'Abandonado', COMPLETED: 'Completo' };
      return `<span class="al-status ${cls[item.alStatus] || ''}">${lbl[item.alStatus] || item.alStatus}</span>`;
    }

    export function renderList(c, items) {
      const tC = { movie: 'bm', show: 'bs', anime: 'ba' }, tL = { movie: 'Filme', show: 'Série', anime: 'Anime' };
      const tI = { movie: '🎬', show: '📺', anime: '⛩' };
      const nextIds = getFrNextIds();
      c.innerHTML = '<div class="mlist">' + items.map((item, i) => {
        const al = item.remainingEps > 0 && item.remainingEps <= 5, fc = al ? 'fg' : item.newSeason ? 'fo' : item.progress === 100 ? 'fd' : 'fa';
        const eL = item.type === 'movie' ? (item.progress === 100 ? '✓ Assistido' : '—') : item.remainingEps === 0 ? '✓ Concluído' : `${item.remainingEps} ep${item.remainingEps !== 1 ? 's' : ''} rest.`;
        const ud = item.type === 'movie' ? '' : item.remainingEps <= 3 && item.remainingEps > 0 ? '<span class="dot dh"></span>' : item.remainingEps <= 10 && item.remainingEps > 0 ? '<span class="dot dm"></span>' : '<span class="dot dl"></span>';
        const src = item.sourceLists?.length > 1 ? `<span class="stag" title="${item.sourceLists.join(', ')}">${item.sourceLists.length} listas</span>` : item.sourceLists?.length === 1 ? `<span class="stag">${item.sourceLists[0]}</span>` : '';
        const srcBadge = item.src === 'anilist' ? '<span class="src-al">AL</span>' : '<span class="src-trakt">T</span>';
        const frInfo = getFrInfo(item.id); const isNext = nextIds.has(item.id);
        const frBadge = frInfo ? `<span class="badge ${isNext ? 'bnx' : 'bfr'}">${isNext ? '▶ próximo' : frInfo.name} ${frInfo.pos}/${frInfo.total}</span>` : '';
        const isPinned = S.pinnedIds.has(String(item.id));
        const pinBadge = isPinned ? '<span class="badge-pin">📌 Prioridade</span>' : '';
        const rowCls = `lrow${isNext ? ' promo' : ''}${isPinned ? ' pinned' : ''}`;
        const rankContent = isPinned ? '📌' : isNext ? '▶' : i + 1;
        const cachedUrl = getCachedPoster('tmdb_' + item.id) || (item.src === 'anilist' ? item.poster : null);
        const thumbInner = cachedUrl
          ? `<img class="poster loaded" src="${cachedUrl}" alt="" onerror="this.parentElement.innerHTML='${tI[item.type] || '🎬'}'">`
          : (tI[item.type] || '🎬');
        return `<div class="${rowCls}"><div class="rank">${rankContent}</div>
      <div class="poster-wrap" style="width:36px;height:52px" data-poster-id="${item.id}" data-poster-type="${item.type}" data-fallback="${tI[item.type]}">${thumbInner}</div>
      <div class="rinfo"><div class="rtitle"><span class="rtt">${item.title}</span>${pinBadge}${item.newSeason ? '<span class="badge bn">Nova temp.</span>' : ''}${item.inProgress && !item.newSeason ? '<span class="badge bp">▶</span>' : ''}${frBadge}${alStatusBadge(item)}<span id="rat-list-${item.id}"></span></div><div class="rmeta"><span class="badge ${tC[item.type]}">${tL[item.type]}</span><span class="rsep">·</span><span>${item.year || '—'}</span>${item.type !== 'movie' && item.totalEps > 0 ? `<span class="rsep">·</span><span>${item.watchedEps}/${item.totalEps} ep</span>` : ''}${srcBadge}${src}</div></div>
      <div class="rprog"><div class="rprog-lbl">${eL}</div>${item.type !== 'movie' && item.totalEps > 0 ? `<div class="progress-bar"><div class="progress-fill ${fc}" style="width:${item.progress}%"></div></div>` : ''}</div>
      <div class="ryear">${item.year || ''}</div>
      <button class="pin-btn${isPinned ? ' on' : ''}" onclick="togglePin('${item.id}')" title="${isPinned ? 'Remover prioridade' : 'Fixar como prioridade'}">📌</button>
      ${ud}</div>`;
      }).join('') + '</div>';
    }

    export function renderGrid(c, items) {
      const tC = { movie: 'bm', show: 'bs', anime: 'ba' }, tI = { movie: '🎬', show: '📺', anime: '⛩' }, tL = { movie: 'Filme', show: 'Série', anime: 'Anime' };
      c.innerHTML = '<div class="mgrid">' + items.map(item => {
        const al = item.remainingEps > 0 && item.remainingEps <= 5, fc = al ? 'fg' : item.newSeason ? 'fo' : item.progress === 100 ? 'fd' : 'fa';
        const isPinned = S.pinnedIds.has(String(item.id));
        const cachedUrl = getCachedPoster('tmdb_' + item.id) || (item.src === 'anilist' ? item.poster : null);
        const thumbInner = cachedUrl
          ? `<img class="poster loaded" src="${cachedUrl}" alt="" style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">`
          : `<span style="font-size:1.9rem">${tI[item.type]}</span>`;
        const pinBtn = `<button class="pin-btn${isPinned ? ' on' : ''}" onclick="togglePin('${item.id}')" title="${isPinned ? 'Remover prioridade' : 'Fixar como prioridade'}" style="margin-left:auto">📌</button>`;
        return `<div class="gcard" style="${isPinned ? 'border-color:var(--accent);background:rgba(232,168,62,.04)' : ''}">
      ${isPinned ? '<div style="font-size:.62rem;color:var(--accent);font-weight:600;margin-bottom:.2rem">📌 Prioridade</div>' : ''}
      <div class="gthumb" data-poster-id="${item.id}" data-poster-type="${item.type}" data-fallback="${tI[item.type]}" style="position:relative">${thumbInner}<div class="gyr">${item.year || ''}</div><div id="rat-grid-${item.id}" class="grid-ratings"></div></div>
      <div class="gtitle">${item.title}</div>
      ${item.type !== 'movie' && item.totalEps > 0 ? `<div class="progress-bar"><div class="progress-fill ${fc}" style="width:${item.progress}%"></div></div>` : ''}
      <div class="gfoot"><span class="badge ${tC[item.type]}">${tL[item.type]}</span>${item.alStatus ? alStatusBadge(item) : ''}${item.newSeason ? '<span class="badge bn">Nova</span>' : ''}${item.type !== 'movie' ? `<span class="geps">${item.remainingEps} rest.</span>` : ''}${pinBtn}</div>
    </div>`;
      }).join('') + '</div>';
    }

    export async function fetchOMDbRatings(item) {
      if (!S.omdbKey || S.omdbKey === 'demo') return null;
      let imdbId = item._imdbId;
      if (!imdbId && item.src !== 'anilist') return null; // Can't easily match without IMDb ID
      
      let cacheKey = imdbId || ('al_' + item.id);
      if (ratingsCache[cacheKey]) return ratingsCache[cacheKey];
      
      try {
        let url;
        if (imdbId) {
          url = `https://www.omdbapi.com/?i=${imdbId}&apikey=${S.omdbKey}`;
        } else {
          // Fallback to title/year search for AniList items if no IMDb ID
          url = `https://www.omdbapi.com/?t=${encodeURIComponent(item.title)}&y=${item.year}&apikey=${S.omdbKey}`;
        }
        let res = await fetch(url);
        let data = await res.json();
        if (data.Response === "True") {
          let rt = data.Ratings?.find(r => r.Source === "Rotten Tomatoes")?.Value || null;
          let rData = {
            imdb: data.imdbRating && data.imdbRating !== "N/A" ? data.imdbRating : null,
            rt: rt,
            mc: data.Metascore && data.Metascore !== "N/A" ? data.Metascore : null
          };
          ratingsCache[cacheKey] = rData;
          saveRatingsCache();
          return rData;
        } else {
          // Cache null to avoid retrying failed lookups
          ratingsCache[cacheKey] = { failed: true };
          saveRatingsCache();
        }
      } catch (e) {
        console.error("OMDb API error", e);
      }
      return null;
    }

    export function getRatingsHTML(item, rData) {
      let h = '';
      if (item.alScore) {
        h += `<div class="rating-badge rb-al" title="AniList Score">★ ${item.alScore}%</div>`;
      }
      if (rData && !rData.failed) {
        if (rData.imdb) h += `<div class="rating-badge rb-imdb" title="IMDb">IMDb ${rData.imdb}</div>`;
        if (rData.rt) {
          let num = parseInt(rData.rt);
          let cls = num >= 60 ? 'fresh' : 'rotten';
          h += `<div class="rating-badge rb-rt ${cls}" title="Rotten Tomatoes">🍅 ${rData.rt}</div>`;
        }
        if (rData.mc) {
          let num = parseInt(rData.mc);
          let cls = num >= 61 ? 'positive' : num >= 40 ? 'mixed' : 'negative';
          h += `<div class="rating-badge rb-mc ${cls}" title="Metacritic">M ${rData.mc}</div>`;
        }
      }
      return h;
    }

    export async function lazyLoadRatings(items) {
      // Pre-fill AniList badges right away
      for (let item of items) {
        if (item.alScore) {
           let html = getRatingsHTML(item, null);
           let rGrid = document.getElementById(`rat-grid-${item.id}`);
           if (rGrid) rGrid.innerHTML = html;
           let rList = document.getElementById(`rat-list-${item.id}`);
           if (rList) rList.innerHTML = `<div class="rating-group">${html}</div>`;
        }
      }
      
      if (!S.omdbKey || S.omdbKey === 'demo') return;
      
      for (let item of items) {
        if (!item.title) continue;
        let rData = await fetchOMDbRatings(item);
        if (rData || item.alScore) {
          let html = getRatingsHTML(item, rData);
          if (!html) continue;
          let rGrid = document.getElementById(`rat-grid-${item.id}`);
          if (rGrid) rGrid.innerHTML = html;
          let rList = document.getElementById(`rat-list-${item.id}`);
          if (rList) rList.innerHTML = `<div class="rating-group">${html}</div>`;
        }
      }
    }

    // ══════════════════════════════════════════
    // RENDER — HISTORY
    // ══════════════════════════════════════════
    export function renderHistory() {
      const c = document.getElementById('history-container');
      const q = document.getElementById('inp-hist').value.toLowerCase().trim();
      const tf = document.getElementById('sel-hist-type').value;
      let items = [...S.historyRaw];
      if (q) items = items.filter(i => (i.title || i.showTitle || '').toLowerCase().includes(q) || (i.epTitle || '').toLowerCase().includes(q));
      if (tf !== 'all') items = items.filter(i => i.type === tf);
      document.getElementById('lbl-hist-count').textContent = items.length;
      document.getElementById('tc-history').textContent = S.historyRaw.length;
      if (!items.length) { c.innerHTML = `<div class="state-box"><span class="stico">🕐</span>Nenhum item.</div>`; return; }
      const grouped = new Map();
      for (const item of items) { const d = item.watchedAt ? new Date(item.watchedAt).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) : 'Sem data'; if (!grouped.has(d)) grouped.set(d, []); grouped.get(d).push(item); }
      let html = '';
      for (const [date, gr] of grouped) {
        const rows = gr.map(item => {
          const t = item.watchedAt ? new Date(item.watchedAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : '';
          if (item.type === 'movie') return `<div class="hrow"><div class="hico">🎬</div><div class="hinfo"><div class="htitle"><span class="htt">${item.title}</span><span class="badge bm">Filme</span>${item.year ? `<span style="font-size:.68rem;color:var(--t4)">${item.year}</span>` : ''}</div></div><div class="htime">${t}</div></div>`;
          return `<div class="hrow"><div class="hico">📺</div><div class="hinfo"><div class="htitle"><span class="htt">${item.showTitle}</span><span class="badge bs" style="font-size:.58rem">S${String(item.season).padStart(2, '0')}E${String(item.ep).padStart(2, '0')}</span></div>${item.epTitle ? `<div class="hmeta"><span>${item.epTitle}</span></div>` : ''}</div><div class="htime">${t}</div></div>`;
        }).join('');
        html += `<div class="hgroup"><div class="hghead">${date}</div><div class="hrows">${rows}</div></div>`;
      }
      c.innerHTML = html;
    }

    // ══════════════════════════════════════════
    // RENDER — REVISITED
    // ══════════════════════════════════════════
    export function renderRevisited() {
      const c = document.getElementById('revisited-container'), d = S.revisitedData;
      const tC = { movie: 'bm', show: 'bs', anime: 'ba' }, tL = { movie: 'Filme', show: 'Série', anime: 'Anime' };
      if (!d || (!d.movies?.length && !d.shows?.length && !d.epShows?.length)) { c.innerHTML = `<div class="state-box"><span class="stico">🔁</span>Nenhum item revisitado.<br><span style="font-size:.72rem;color:var(--t4);margin-top:.3rem;display:block">Certifique-se de que o Histórico Trakt está selecionado.</span></div>`; return; }
      const pc = p => p >= 5 ? 'pl' : p >= 3 ? 'pm' : 'ps', pr = p => p >= 5 ? '❤️ clássico pessoal' : p >= 3 ? '😍 adorou' : p >= 2 ? '🤔 reviu' : '';
      let tot = (d.movies?.length || 0) + (d.shows?.length || 0) + (d.epShows?.length || 0); document.getElementById('tc-revisited').textContent = tot;
      let html = '';
      if (d.movies?.length) html += `<div class="rsect"><div class="rshead">🎬 Filmes revisitados <span style="font-size:.72rem;font-weight:400;color:var(--t3)">${d.movies.length}</span></div><div class="rrows">` + d.movies.map(item => `<div class="rrow"><div class="rinfo"><div class="rtit"><span>${item.title}</span><span class="badge ${tC[item.type]}">${tL[item.type]}</span><span style="font-size:.7rem;color:var(--t3)">${item.year || '—'}</span></div><div class="rmeta2"><span>${pr(item.plays)}</span></div></div><span class="ppill ${pc(item.plays)}">${item.plays}×</span></div>`).join('') + '</div></div>';
      if (d.shows?.length) html += `<div class="rsect"><div class="rshead">📺 Séries com plays extras</div><div class="rrows">` + d.shows.map(item => `<div class="rrow"><div class="rinfo"><div class="rtit"><span>${item.title}</span><span class="badge ${tC[item.type]}">${tL[item.type]}</span></div><div class="rmeta2"><span>plays extras no histórico</span></div></div><span class="ppill pm">${item.plays} plays</span></div>`).join('') + '</div></div>';
      if (d.epShows?.length) html += `<div class="rsect"><div class="rshead">📍 Episódios revisitados <span style="font-size:.72rem;font-weight:400;color:var(--t3)">${d.epShows.length} séries</span></div><div class="rrows">` + d.epShows.map(item => { const eps = [...item.episodes].sort((a, b) => b.count - a.count); const chips = eps.map(ep => `<span class="echip ${ep.count >= 3 ? 'hot' : ''}" title="${ep.title}">S${String(ep.s).padStart(2, '0')}E${String(ep.ep).padStart(2, '0')}${ep.title ? ' — ' + (ep.title.length > 22 ? ep.title.slice(0, 22) + '…' : ep.title) : ''} <strong>${ep.count}×</strong></span>`).join(''); return `<div class="rrow" style="align-items:flex-start"><div class="rinfo"><div class="rtit"><span>${item.title}</span><span class="badge ${tC[item.type]}">${tL[item.type]}</span></div><div class="rmeta2"><span>${eps.length} ep${eps.length !== 1 ? 's' : ''} revisitado${eps.length !== 1 ? 's' : ''}</span></div><div class="echips">${chips}</div></div><span class="ppill ${pc(item.plays)}" style="margin-top:.1rem">até ${item.plays}×</span></div>`; }).join('') + '</div></div>';
      c.innerHTML = html;
    }

    // ══════════════════════════════════════════
    export function switchTab(tab) {
      S.currentTab = tab;
      ['fila', 'agora', 'franchise', 'books', 'games', 'youtube', 'history', 'revisited'].forEach(t => {
        const tabEl = document.getElementById('tab-' + t);
        const paneEl = document.getElementById('pane-' + t);
        if (tabEl) tabEl.classList.toggle('on', t === tab);
        if (paneEl) paneEl.style.display = t === tab ? 'block' : 'none';
      });
      if (tab === 'agora') renderAgora();
      if (tab === 'franchise') renderFranchises();
      if (tab === 'books') renderBooks();
      if (tab === 'games') renderGames();
      if (tab === 'youtube') renderYT();
      if (tab === 'history') renderHistory();
      if (tab === 'revisited') renderRevisited();
    }
    export function updateTabCounts() {
      document.getElementById('tc-history').textContent = S.historyRaw.length;
      document.getElementById('tc-franchise').textContent = S.franchises.length;
      document.getElementById('tc-books').textContent = S.books.length;
      document.getElementById('tc-games').textContent = S.games.length;
      document.getElementById('tc-youtube').textContent = S.ytQueue.length;
      const d = S.revisitedData; document.getElementById('tc-revisited').textContent = d ? ((d.movies?.length || 0) + (d.shows?.length || 0) + (d.epShows?.length || 0)) : 0;
    }
    export function setView(v) { S.view = v; document.getElementById('vbtn-list').classList.toggle('on', v === 'list'); document.getElementById('vbtn-grid').classList.toggle('on', v === 'grid'); render(); }
    export function updateStats() {
      const a = S.allItems;
      document.getElementById('s-total').textContent = a.length;
      document.getElementById('s-movies').textContent = a.filter(i => i.type === 'movie').length;
      document.getElementById('s-shows').textContent = a.filter(i => i.type === 'show').length;
      document.getElementById('s-animes').textContent = a.filter(i => i.type === 'anime').length;
      const e = a.reduce((s, i) => s + i.remainingEps, 0);
      document.getElementById('s-eps').textContent = e > 999 ? (e / 1000).toFixed(1) + 'k' : e;

      // Calcular e renderizar tempo gasto
      const timeInfo = calculateTotalTimeSpent();
      const timeEl = document.getElementById('s-time');
      if (timeEl) {
        const days = Math.floor(timeInfo.total / 1440);
        const hours = Math.floor((timeInfo.total % 1440) / 60);
        if (days > 0) {
          timeEl.textContent = `${days}d ${hours}h`;
        } else {
          timeEl.textContent = `${hours}h`;
        }
      }
    }
    export function setSyncing(on, msg = '') { const dot = document.getElementById('sdot'), lbl = document.getElementById('slbl'); if (on) { dot.className = 'sdot busy'; lbl.textContent = msg; } else { dot.className = 'sdot live'; lbl.textContent = S.lastRefresh ? 'sync ' + S.lastRefresh.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : 'pronto'; } }
    export function setAutoRefresh(m) { S.autoRefreshMin = parseInt(m) || 0; clearInterval(S.autoRefreshTimer); if (S.autoRefreshMin > 0 && S.traktUser !== 'demo') S.autoRefreshTimer = setInterval(() => loadData(), S.autoRefreshMin * 60 * 1000); document.getElementById('sdot').className = S.autoRefreshMin > 0 && S.traktUser !== 'demo' ? 'sdot live' : 'sdot'; }
    export function showContainerMsg(msg) { document.getElementById('media-container').innerHTML = `<div class="state-box" style="color:var(--red)"><span class="stico">⚠️</span>${msg}</div>`; }
    export function showErr(msg) { const el = document.getElementById('err-login'); if (el) { el.style.display = 'block'; el.textContent = msg; } }
    export function refreshData() {
      if (S.traktUser === 'demo') { demoRebuild(); return; }
      loadLists();
    }

    // ══════════════════════════════════════════
    const SKB = 'filadetelabk_v1';
    export function saveBooksStore() { try { localStorage.setItem(SKB + '_' + (S.traktUser || S.alUser), JSON.stringify(S.books)); } catch (e) { } }
    export function loadBooksStore() { try { const d = JSON.parse(localStorage.getItem(SKB + '_' + (S.traktUser || S.alUser)) || '[]'); S.books = Array.isArray(d) ? d : []; } catch (e) { S.books = []; } }

    let _bkId = null;
    export function openBookEditor(id) {
      _bkId = id; const bk = id ? S.books.find(b => b.id == id) : null;
      document.getElementById('bk-modal-title').textContent = bk ? 'Editar Livro' : 'Adicionar Livro';
      document.getElementById('bk-title').value = bk ? bk.title : '';
      document.getElementById('bk-author').value = bk ? bk.author : '';
      document.getElementById('bk-pages').value = bk ? bk.pages : '';
      document.getElementById('bk-page-cur').value = bk ? bk.pageCur : 0;
      document.getElementById('bk-year').value = bk ? bk.year : '';
      document.getElementById('bk-status').value = bk ? bk.status : 'want';
      document.getElementById('bk-ctx').value = bk ? bk.ctx : 'sleep';
      document.getElementById('bk-genre').value = bk ? bk.genre : '';
      document.getElementById('bk-del-btn').style.display = bk ? 'inline-flex' : 'none';
      document.getElementById('bk-modal').style.display = 'flex';
    }
    export function closeBkModal() { document.getElementById('bk-modal').style.display = 'none'; }
    export function saveBook() {
      const title = document.getElementById('bk-title').value.trim();
      if (!title) { alert('Informe o título.'); return; }
      const bk = {
        id: _bkId || Date.now(), title,
        author: document.getElementById('bk-author').value.trim(),
        pages: parseInt(document.getElementById('bk-pages').value) || 0,
        pageCur: parseInt(document.getElementById('bk-page-cur').value) || 0,
        year: parseInt(document.getElementById('bk-year').value) || 0,
        status: document.getElementById('bk-status').value,
        ctx: document.getElementById('bk-ctx').value,
        genre: document.getElementById('bk-genre').value.trim(),
        addedAt: _bkId ? (S.books.find(b => b.id == _bkId)?.addedAt || Date.now()) : Date.now()
      };
      if (_bkId) { const i = S.books.findIndex(b => b.id == _bkId); if (i >= 0) S.books[i] = bk; }
      else S.books.push(bk);
      saveBooksStore(); closeBkModal(); renderBooks(); updateTabCounts();
    }
    export function deleteBook() { if (!_bkId || !confirm('Excluir livro?')) return; S.books = S.books.filter(b => b.id != _bkId); saveBooksStore(); closeBkModal(); renderBooks(); updateTabCounts(); }

    export function renderBooks() {
      const c = document.getElementById('books-container');
      const q = document.getElementById('inp-bk-search').value.toLowerCase().trim();
      const sf = document.getElementById('sel-bk-status').value;
      let items = [...S.books];
      if (q) items = items.filter(b => b.title.toLowerCase().includes(q) || (b.author || '').toLowerCase().includes(q));
      if (sf !== 'all') items = items.filter(b => b.status === sf);
      document.getElementById('lbl-bk-count').textContent = items.length + ' livros';
      document.getElementById('tc-books').textContent = S.books.length;
      if (!items.length) { c.innerHTML = `<div class="state-box"><span class="stico">📚</span>${q || sf !== 'all' ? 'Nenhum livro encontrado.' : 'Nenhum livro ainda.<br><span style="font-size:.72rem;color:var(--t4);margin-top:.3rem;display:block">Adicione ou importe CSV do StoryGraph.</span>'}</div>`; return; }

      const statusLabel = { reading: 'Lendo', want: 'Quero ler', paused: 'Pausado', done: 'Lido' };
      const statusClass = { reading: 'bks-reading', want: 'bks-want', paused: 'bks-paused', done: 'bks-done' };
      const ctxLabel = { sleep: '🌙 Antes de dormir', any: '⏰ Qualquer hora', weekend: '🗓 Fim de semana' };

      c.innerHTML = '<div class="bk-list">' + items.map((bk, i) => {
        const pct = bk.pages > 0 ? Math.round((bk.pageCur / bk.pages) * 100) : 0;
        const progLabel = bk.pages > 0 ? `${bk.pageCur}/${bk.pages} págs (${pct}%)` : '—';
        const almostDone = bk.pages > 0 && bk.pageCur > 0 && (bk.pages - bk.pageCur) <= 30;
        const fc = almostDone ? 'fg' : bk.status === 'done' ? 'fd' : 'fa';
        const cachedUrl = getCachedPoster('bk_' + bk.id);
        const thumbInner = cachedUrl
          ? `<img class="poster loaded" src="${cachedUrl}" alt="" style="width:100%;height:100%;object-fit:cover;border-radius:4px" onerror="this.style.display='none'">`
          : '📚';
        return `<div class="bk-row">
      <div class="rank">${i + 1}</div>
      <div class="poster-wrap" style="width:36px;height:52px;border-radius:4px" data-bk-id="${bk.id}">${thumbInner}</div>
      <div>
        <div class="bk-title">${bk.title}</div>
        <div class="bk-meta">
          ${bk.author ? `<span>${bk.author}</span><span class="rsep">·</span>` : ''}
          ${bk.year ? `<span>${bk.year}</span>` : ''}
          ${bk.genre ? `<span class="rsep">·</span><span>${bk.genre}</span>` : ''}
          <span class="bk-ctx">${ctxLabel[bk.ctx] || bk.ctx}</span>
        </div>
      </div>
      <div>
        <div class="bk-prog-lbl">${progLabel}</div>
        ${bk.pages > 0 ? `<div class="progress-bar"><div class="progress-fill ${fc}" style="width:${pct}%"></div></div>` : ''}
      </div>
      <div style="display:flex;align-items:center;justify-content:flex-end;gap:.35rem">
        <span class="bk-status ${statusClass[bk.status]}">${statusLabel[bk.status]}</span>
        <button class="btn btn-xs btn-ghost" onclick="openBookEditor(${bk.id})" style="padding:.15rem .35rem">✏️</button>
      </div>
    </div>`;
      }).join('') + '</div>';
      // Lazy load book covers from OpenLibrary
      setTimeout(() => lazyLoadBookCovers(items), 150);
    }

    export async function lazyLoadBookCovers(books) {
      const BATCH = 3;
      const toFetch = books.filter(bk => !getCachedPoster('bk_' + bk.id));
      for (let i = 0; i < toFetch.length; i += BATCH) {
        const batch = toFetch.slice(i, i + BATCH);
        await Promise.all(batch.map(async bk => {
          const url = await fetchBookCover(bk);
          if (!url) return;
          const el = document.querySelector(`[data-bk-id="${bk.id}"]`);
          if (el) { el.innerHTML = ''; const img = document.createElement('img'); img.className = 'poster loaded'; img.src = url; img.style.cssText = 'width:100%;height:100%;object-fit:cover;border-radius:4px'; img.onerror = () => { el.innerHTML = '📚'; }; el.appendChild(img); }
        }));
        await sleep(400); // respect OpenLibrary rate limit
      }
    }
    export function importStoryGraphCSV(input) {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        const text = e.target.result;
        const lines = text.split('\n').filter(l => l.trim());
        if (!lines.length) { alert('CSV vazio.'); return; }
        // StoryGraph CSV headers: Title,Authors,Read Status,Star Rating,Review,Date Added,Dates Read,Edition,ISBN/UID,Tags,Formats
        // Also handles Goodreads CSV
        const header = lines[0].toLowerCase();
        let imported = 0;
        for (let i = 1; i < lines.length; i++) {
          const cols = parseCSVLine(lines[i]);
          if (!cols.length) continue;
          let title = '', author = '', pages = 0, status = 'want', year = 0;
          if (header.includes('read status')) {
            // StoryGraph format
            title = cols[0]?.trim() || '';
            author = cols[1]?.trim() || '';
            const st = (cols[2] || '').toLowerCase().trim();
            status = st === 'read' ? 'done' : st === 'currently reading' ? 'reading' : st === 'did not finish' ? 'dropped' : 'want';
            year = parseInt(cols[7]) || 0;
          } else if (header.includes('bookshelves')) {
            // Goodreads format
            title = cols[1]?.trim() || '';
            author = cols[2]?.trim() || '';
            pages = parseInt(cols[11]) || 0;
            const sh = (cols[18] || '').toLowerCase();
            status = sh.includes('read') && !sh.includes('to-read') ? 'done' : sh.includes('currently') ? 'reading' : 'want';
            year = parseInt(cols[13]) || 0;
          } else {
            // Generic: Title, Author, Status, Pages
            title = cols[0]?.trim() || ''; author = cols[1]?.trim() || '';
            const st = (cols[2] || '').toLowerCase();
            status = st.includes('read') && !st.includes('want') ? 'done' : st.includes('current') ? 'reading' : 'want';
            pages = parseInt(cols[3]) || 0;
          }
          if (!title) continue;
          if (S.books.find(b => b.title.toLowerCase() === title.toLowerCase())) continue;
          S.books.push({ id: Date.now() + i, title, author, pages, pageCur: 0, year, status, ctx: 'sleep', genre: '', addedAt: Date.now() });
          imported++;
        }
        saveBooksStore(); renderBooks(); updateTabCounts();
        alert(`${imported} livro${imported !== 1 ? 's' : ''} importado${imported !== 1 ? 's' : ''}!`);
        input.value = '';
      };
      reader.readAsText(file);
    }

    export function parseCSVLine(line) {
      const result = []; let cur = '', inQ = false;
      for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"') { if (inQ && line[i + 1] === '"') { cur += '"'; i++; } else inQ = !inQ; }
        else if (ch === ',' && !inQ) { result.push(cur); cur = ''; }
        else cur += ch;
      }
      result.push(cur); return result;
    }

    // Demo books
    export function addDemoBooks() {
      S.books = [
        { id: 1, title: 'O Estrangeiro', author: 'Albert Camus', pages: 159, pageCur: 0, year: 1942, status: 'want', ctx: 'sleep', genre: 'Filosofia', addedAt: Date.now() },
        { id: 2, title: 'Sapiens', author: 'Yuval Noah Harari', pages: 443, pageCur: 87, year: 2011, status: 'reading', ctx: 'sleep', genre: 'Não-ficção', addedAt: Date.now() - 86400000 },
        { id: 3, title: 'O Nome do Vento', author: 'Patrick Rothfuss', pages: 662, pageCur: 0, year: 2007, status: 'want', ctx: 'any', genre: 'Fantasia', addedAt: Date.now() - 172800000 },
        { id: 4, title: 'Crime e Castigo', author: 'Dostoiévski', pages: 551, pageCur: 0, year: 1866, status: 'want', ctx: 'sleep', genre: 'Ficção clássica', addedAt: Date.now() - 259200000 },
        { id: 5, title: 'When Breath Becomes Air', author: 'Paul Kalanithi', pages: 228, pageCur: 228, year: 2016, status: 'done', ctx: 'sleep', genre: 'Biografia', addedAt: Date.now() - 604800000 },
      ];
    }

    // ══════════════════════════════════════════
    const SKG = 'filadetelagem_v1';
    export function saveGamesStore() { try { localStorage.setItem(SKG + '_' + (S.traktUser || S.alUser), JSON.stringify(S.games)); } catch (e) { } }
    export function loadGamesStore() { try { const d = JSON.parse(localStorage.getItem(SKG + '_' + (S.traktUser || S.alUser)) || '[]'); S.games = Array.isArray(d) ? d : []; } catch (e) { S.games = []; } }

    let _gmId = null;
    export function openGameEditor(id) {
      _gmId = id; const gm = id ? S.games.find(g => g.id == id) : null;
      document.getElementById('gm-modal-title').textContent = gm ? 'Editar Jogo' : 'Adicionar Jogo';
      document.getElementById('gm-title').value = gm ? gm.title : '';
      document.getElementById('gm-platform').value = gm ? gm.platform : '';
      document.getElementById('gm-hours').value = gm ? gm.hours : '';
      document.getElementById('gm-status').value = gm ? gm.status : 'backlog';
      document.getElementById('gm-year').value = gm ? gm.year : '';
      document.getElementById('gm-ctx').value = gm ? gm.ctx : 'weekend';
      document.getElementById('gm-notes').value = gm ? gm.notes : '';
      document.getElementById('gm-del-btn').style.display = gm ? 'inline-flex' : 'none';
      document.getElementById('gm-modal').style.display = 'flex';
    }
    export function closeGmModal() { document.getElementById('gm-modal').style.display = 'none'; }
    export function saveGame() {
      const title = document.getElementById('gm-title').value.trim();
      if (!title) { alert('Informe o título.'); return; }
      const gm = {
        id: _gmId || Date.now(), title,
        platform: document.getElementById('gm-platform').value.trim(),
        hours: document.getElementById('gm-hours').value.trim(),
        status: document.getElementById('gm-status').value,
        year: parseInt(document.getElementById('gm-year').value) || 0,
        ctx: document.getElementById('gm-ctx').value,
        notes: document.getElementById('gm-notes').value.trim(),
        addedAt: _gmId ? (S.games.find(g => g.id == _gmId)?.addedAt || Date.now()) : Date.now()
      };
      if (_gmId) { const i = S.games.findIndex(g => g.id == _gmId); if (i >= 0) S.games[i] = gm; }
      else S.games.push(gm);
      saveGamesStore(); closeGmModal(); renderGames(); updateTabCounts();
    }
    export function deleteGame() { if (!_gmId || !confirm('Excluir jogo?')) return; S.games = S.games.filter(g => g.id != _gmId); saveGamesStore(); closeGmModal(); renderGames(); updateTabCounts(); }

    export function renderGames() {
      const c = document.getElementById('games-container');
      const q = document.getElementById('inp-gm-search').value.toLowerCase().trim();
      const sf = document.getElementById('sel-gm-status').value;
      const cf = document.getElementById('sel-gm-ctx').value;
      let items = [...S.games];
      if (q) items = items.filter(g => g.title.toLowerCase().includes(q));
      if (sf !== 'all') items = items.filter(g => g.status === sf);
      if (cf !== 'all') items = items.filter(g => g.ctx === cf);
      document.getElementById('lbl-gm-count').textContent = items.length + ' jogos';
      document.getElementById('tc-games').textContent = S.games.length;
      if (!items.length) { c.innerHTML = `<div class="state-box"><span class="stico">🎮</span>${q || sf !== 'all' || cf !== 'all' ? 'Nenhum jogo encontrado.' : 'Nenhum jogo ainda.'}</div>`; return; }

      const statusLabel = { playing: 'Jogando', backlog: 'Backlog', done: 'Zerado', dropped: 'Abandonado' };
      const statusClass = { playing: 'gms-playing', backlog: 'gms-backlog', done: 'gms-done', dropped: 'gms-dropped' };
      const ctxLabel = { sleep: '🌙 Antes de dormir', any: '⏰ Qualquer hora', weekend: '🗓 Fim de semana' };

      c.innerHTML = '<div class="gm-list">' + items.map((gm, i) => {
        const color = gameAvatarColor(gm.title);
        const letter = gm.title.charAt(0).toUpperCase();
        return `<div class="gm-row">
    <div class="rank">${i + 1}</div>
    <div class="poster-wrap" style="width:36px;height:52px;border-radius:4px">
      <div class="letter-avatar" style="background:${color}">${letter}</div>
    </div>
    <div>
      <div class="gm-title">${gm.title}</div>
      <div class="gm-meta">
        ${gm.platform ? `<span class="gm-plat">${gm.platform}</span>` : ''}
        ${gm.hours ? `<span>${gm.hours}</span>` : ''}
        ${gm.year ? `<span>${gm.year}</span>` : ''}
        ${gm.notes ? `<span style="color:var(--t4);font-size:.68rem">${gm.notes.length > 40 ? gm.notes.slice(0, 40) + '…' : gm.notes}</span>` : ''}
        <span class="gm-ctx">${ctxLabel[gm.ctx] || gm.ctx}</span>
      </div>
    </div>
    <div style="display:flex;align-items:center;justify-content:flex-end;gap:.35rem">
      <span class="gm-status ${statusClass[gm.status]}">${statusLabel[gm.status]}</span>
      <button class="btn btn-xs btn-ghost" onclick="openGameEditor(${gm.id})" style="padding:.15rem .35rem">✏️</button>
    </div>
  </div>`;
      }).join('') + '</div>';
    }

    // Demo games
    export function addDemoGames() {
      S.games = [
        { id: 1, title: 'God of War', platform: 'PS4', hours: '20h', status: 'playing', year: 2018, ctx: 'weekend', notes: 'Continuação saga nórdica', addedAt: Date.now() },
        { id: 2, title: 'God of War: Ragnarök', platform: 'PS4', hours: '35h', status: 'backlog', year: 2022, ctx: 'weekend', notes: '', addedAt: Date.now() - 86400000 },
        { id: 3, title: 'Hades', platform: 'PC', hours: '50h', status: 'backlog', year: 2020, ctx: 'any', notes: 'Roguelike, bom em sessões curtas', addedAt: Date.now() - 172800000 },
        { id: 4, title: 'Call of Duty Mobile', platform: 'Mobile', hours: '∞', status: 'playing', year: 2019, ctx: 'any', notes: 'Daily — partidas rápidas', addedAt: Date.now() - 259200000 },
        { id: 5, title: 'Pokémon GO', platform: 'Mobile', hours: '∞', status: 'playing', year: 2016, ctx: 'any', notes: 'Daily', addedAt: Date.now() - 345600000 },
        { id: 6, title: 'Hollow Knight', platform: 'PC', hours: '40h', status: 'backlog', year: 2017, ctx: 'weekend', notes: '', addedAt: Date.now() - 432000000 },
      ];
    }

    // ══════════════════════════════════════════
    export function renderAgora() {
      const c = document.getElementById('agora-container');
      const contexts = [
        { id: 'sleep', icon: '🌙', label: 'Antes de dormir', time: '22h–00h', cls: 'ctx-sleep' },
        { id: 'weekend', icon: '🗓', label: 'Fim de semana', time: 'Sex–Dom', cls: 'ctx-weekend' },
        { id: 'any', icon: '⏰', label: 'Qualquer hora', time: 'sempre', cls: 'ctx-any' },
      ];

      c.innerHTML = contexts.map(ctx => {
        const items = getContextItems(ctx.id);
        const rows = items.length ? items.map(item => renderCtxItem(item)).join('') :
          `<div class="ctx-empty">Nenhum item neste contexto</div>`;
        return `<div class="ctx-col ${ctx.cls}">
      <div class="ctx-head"><span class="ctx-ico">${ctx.icon}</span><span class="ctx-lbl">${ctx.label}</span><span class="ctx-time">${ctx.time}</span></div>
      <div style="padding:.4rem .25rem">${rows}</div>
    </div>`;
      }).join('');
    }

    export function getContextItems(ctx) {
      const items = [];

      // ── LIVROS: qualquer contexto configurado pelo usuário ──
      const bk = S.books.filter(b => b.ctx === ctx && b.status !== 'done' && b.status !== 'dropped');
      bk.sort((a, b) => { if (a.status === 'reading' && b.status !== 'reading') return -1; if (b.status === 'reading') return 1; return 0; });
      if (bk.length > 0) items.push({
        cat: 'book', catLabel: 'Livro', icon: '📚', item: bk[0],
        title: bk[0].title, sub: bk[0].author || (bk[0].pages ? `${bk[0].pageCur}/${bk[0].pages} págs` : ''),
        status: bk[0].status, statusLabel: { reading: 'Lendo', want: 'Quero ler', paused: 'Pausado' }[bk[0].status] || bk[0].status,
        statusColor: bk[0].status === 'reading' ? 'var(--green)' : 'var(--accent)'
      });

      // ── JOGOS: só fim de semana ──
      if (ctx === 'weekend') {
        const gm = S.games.filter(g => g.status !== 'done' && g.status !== 'dropped');
        gm.sort((a, b) => { if (a.status === 'playing' && b.status !== 'playing') return -1; if (b.status === 'playing') return 1; return 0; });
        if (gm.length > 0) items.push({
          cat: 'game', catLabel: 'Jogo', icon: '🎮', item: gm[0],
          title: gm[0].title, sub: gm[0].platform + (gm[0].hours ? ' · ' + gm[0].hours : ''),
          status: gm[0].status, statusLabel: { playing: 'Jogando', backlog: 'Backlog' }[gm[0].status] || gm[0].status,
          statusColor: gm[0].status === 'playing' ? 'var(--green)' : 'var(--accent)'
        });
      }

      // ── MÍDIA ──
      // 🌙 Antes de dormir → só animes em andamento (episódios curtos)
      // 🗓 Fim de semana   → filmes, séries e animes (todos) + jogos (acima)
      // ⏰ Qualquer hora   → só animes em andamento ou planejados
      const media = S.allItems.filter(i => {
        if (i.progress === 100 || i.alStatus === 'COMPLETED') return false;
        if (ctx === 'sleep') {
          // Só animes em andamento — leve, curto
          return i.type === 'anime' && (i.inProgress || i.alStatus === 'CURRENT');
        }
        if (ctx === 'weekend') {
          // Filmes e séries SÓ aqui — mais pesados, precisam de tempo
          return i.type === 'movie' || i.type === 'show' ||
            (i.type === 'anime' && (i.inProgress || i.alStatus === 'CURRENT'));
        }
        if (ctx === 'any') {
          // Só animes leves (em andamento ou planejados)
          return i.type === 'anime' && (i.inProgress || i.alStatus === 'CURRENT' || i.alStatus === 'PLANNING');
        }
        return false;
      });
      media.sort((a, b) => {
        const ap = (a.inProgress || a.alStatus === 'CURRENT') ? 0 : 1;
        const bp = (b.inProgress || b.alStatus === 'CURRENT') ? 0 : 1;
        if (ap !== bp) return ap - bp;
        return a.remainingEps - b.remainingEps;
      });
      const typeIcon = { movie: '🎬', show: '📺', anime: '⛩' };
      const typeLabel = { movie: 'Filme', show: 'Série', anime: 'Anime' };
      // Fim de semana mostra até 3 (filme + série + anime), outros só 1
      media.slice(0, ctx === 'weekend' ? 3 : 1).forEach(m => {
        const sub = m.type !== 'movie' && m.totalEps > 0 ? `${m.watchedEps}/${m.totalEps} ep` : m.year || '';
        items.push({
          cat: 'media', catLabel: typeLabel[m.type], icon: typeIcon[m.type], item: m,
          title: m.title, sub, status: m.inProgress ? 'inprogress' : 'notstarted',
          statusLabel: m.inProgress ? 'Em andamento' : m.alStatus === 'PLANNING' ? 'Planejado' : 'Fila',
          statusColor: m.inProgress ? 'var(--green)' : 'var(--accent)'
        });
      });

      return items;
    }

    export function renderCtxItem(ci) {
      const catColors = { book: 'var(--purple)', game: 'var(--green)', media: 'var(--accent)' };
      return `<div class="ctx-item">
    <div class="ctx-item-ico">${ci.icon}</div>
    <div class="ctx-item-info">
      <div class="ctx-item-title">${ci.title}</div>
      <div class="ctx-item-sub">
        <span class="ctx-item-cat" style="background:${catColors[ci.cat]}22;color:${catColors[ci.cat]}">${ci.catLabel}</span>
        ${ci.sub ? `<span>${ci.sub}</span>` : ''}
        <span style="color:${ci.statusColor};font-size:.62rem;font-weight:600">${ci.statusLabel}</span>
      </div>
    </div>
  </div>`;
    }

    // ══════════════════════════════════════════
    // Patch S to include books/games (called after S is defined)
    Object.assign(S, { books: [], games: [], ytQueue: [] });

    const _origProceed = proceedToApp;
    proceedToApp = function () {
      _origProceed();
    };
    const _origLoadFr = loadFranchises;
    loadFranchises = function () {
      _origLoadFr();
      loadBooksStore();
      loadGamesStore();
      loadYTStore();
      loadPins();
      updateTabCounts();
    };
    const _origDemoRebuild = demoRebuild;
    demoRebuild = function () {
      _origDemoRebuild();
      if (!S.books.length) addDemoBooks();
      if (!S.games.length) addDemoGames();
      if (!S.ytQueue.length) addDemoYT();
      updateTabCounts();
    };

    // ══════════════════════════════════════════

    // Returns cached poster URL or null
    export function getCachedPoster(key) { return S.posterCache[key] || null; }

    // Fetch and cache poster for a media item (movies/shows via TMDB, anime via AniList already set)
    export async function fetchTMDBPoster(item) {
      if (!S.tmdbKey || S.traktUser === 'demo') return null;
      const key = 'tmdb_' + item.id;
      if (S.posterCache[key]) return S.posterCache[key];
      try {
        // First get TMDB id from Trakt extended info
        const type = item.type === 'movie' ? 'movies' : 'shows';
        const ext = await traktGet(`/${type}/${item.slug || item.id}?extended=full`).catch(() => null);
        const tmdbId = ext?.ids?.tmdb;
        if (!tmdbId) return null;
        // Fetch from TMDB
        const tmdbType = item.type === 'movie' ? 'movie' : 'tv';
        const r = await fetch(`https://api.themoviedb.org/3/${tmdbType}/${tmdbId}?api_key=${S.tmdbKey}&language=pt-BR`);
        if (!r.ok) return null;
        const d = await r.json();
        const path = d.poster_path;
        if (!path) return null;
        const url = `https://image.tmdb.org/t/p/w200${path}`;
        S.posterCache[key] = url;
        savePosterCache();
        return url;
      } catch (e) { return null; }
    }

    // OpenLibrary cover for books (free, no key)
    export async function fetchBookCover(book) {
      if (!book.title) return null;
      const key = 'bk_' + book.id;
      if (S.posterCache[key]) return S.posterCache[key];
      try {
        const q = encodeURIComponent(book.title + (book.author ? ' ' + book.author : ''));
        // Use OpenLibrary search to get OLID then cover
        const r = await fetch(`https://openlibrary.org/search.json?q=${q}&limit=1&fields=cover_i,isbn`);
        if (!r.ok) return null;
        const d = await r.json();
        const doc = d.docs?.[0];
        let url = null;
        if (doc?.cover_i) {
          url = `https://covers.openlibrary.org/b/id/${doc.cover_i}-M.jpg`;
        } else if (doc?.isbn?.[0]) {
          url = `https://covers.openlibrary.org/b/isbn/${doc.isbn[0]}-M.jpg`;
        }
        if (url) { S.posterCache[key] = url; savePosterCache(); }
        return url;
      } catch (e) { return null; }
    }

    // Generate letter avatar color for games
    export function gameAvatarColor(title) {
      let h = 0; for (const c of title) h = (h * 31 + c.charCodeAt(0)) % 360;
      return `hsl(${h},45%,45%)`;
    }

    // Lazy poster loader — after render, fetch missing posters and inject into DOM
    export function lazyLoadPosters(items, selector = '[data-poster-id]') {
      if (!S.tmdbKey && S.traktUser !== 'demo') return; // skip if no TMDB key
      setTimeout(async () => {
        const els = document.querySelectorAll(selector);
        const BATCH = 3;
        const queue = [...els].filter(el => el.dataset.posterId && !el.querySelector('img.poster'));
        for (let i = 0; i < queue.length; i += BATCH) {
          const batch = queue.slice(i, i + BATCH);
          await Promise.all(batch.map(async el => {
            const id = el.dataset.posterId;
            const type = el.dataset.posterType;
            const item = S.allItems.find(it => String(it.id) === id);
            if (!item || item.src === 'anilist') return; // AniList posters already set
            const cached = getCachedPoster('tmdb_' + item.id);
            const url = cached || (await fetchTMDBPoster(item));
            if (url) injectPoster(el, url);
          }));
        }
      }, 100);
    }

    export function injectPoster(el, url) {
      // Clear existing emoji content
      el.innerHTML = '';
      const img = document.createElement('img');
      img.className = 'poster';
      img.src = url;
      img.alt = '';
      img.onload = () => img.classList.add('loaded');
      img.onerror = () => { el.innerHTML = el.dataset.fallback || '🎬'; };
      el.appendChild(img);
    }

    // ══════════════════════════════════════════
    const SKYT = 'filadetelayout_v1';
    export function saveYTStore() { try { localStorage.setItem(SKYT + '_' + (S.traktUser || S.alUser), JSON.stringify(S.ytQueue)); } catch (e) { } }
    export function loadYTStore() { try { const d = JSON.parse(localStorage.getItem(SKYT + '_' + (S.traktUser || S.alUser)) || '[]'); S.ytQueue = Array.isArray(d) ? d : []; } catch (e) { S.ytQueue = []; } }

    // Extrai video ID do YouTube de vários formatos de URL
    export function ytVideoId(url) {
      const m = url.match(/(?:v=|youtu\.be\/|embed\/|shorts\/)([a-zA-Z0-9_-]{11})/);
      return m ? m[1] : null;
    }
    export function ytPlaylistId(url) {
      const m = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
      return m ? m[1] : null;
    }
    export function ytChannelHandle(url) {
      const m = url.match(/youtube\.com\/@([^/?&]+)/);
      return m ? m[1] : null;
    }

    export function ytParseUrl(url) {
      if (!url) return;
      const vid = ytVideoId(url);
      const pl = ytPlaylistId(url);
      const ch = ytChannelHandle(url);
      // Auto-detect category
      const catEl = document.getElementById('yt-cat');
      if (vid && !pl) { catEl.value = 'video'; }
      else if (pl) { catEl.value = 'series'; }
      else if (ch) { catEl.value = 'channel'; }
      // Auto-fill thumbnail URL (usamos oEmbed para pegar título)
      if (vid) {
        fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${vid}&format=json`)
          .then(r => r.json())
          .then(d => {
            const titleEl = document.getElementById('yt-title');
            const chEl = document.getElementById('yt-channel');
            if (titleEl && !titleEl.value) titleEl.value = d.title || '';
            if (chEl && !chEl.value) chEl.value = d.author_name || '';
          }).catch(() => { });
      }
    }

    let _ytId = null;
    export function openYTEditor(id) {
      _ytId = id; const yt = id ? S.ytQueue.find(y => y.id == id) : null;
      document.getElementById('yt-modal-title').textContent = yt ? 'Editar item' : 'Adicionar à Fila do YouTube';
      document.getElementById('yt-url').value = yt ? yt.url : '';
      document.getElementById('yt-title').value = yt ? yt.title : '';
      document.getElementById('yt-cat').value = yt ? yt.cat : 'video';
      document.getElementById('yt-status').value = yt ? yt.status : 'watch';
      document.getElementById('yt-duration').value = yt ? yt.duration : '';
      document.getElementById('yt-channel').value = yt ? yt.channel : '';
      document.getElementById('yt-notes').value = yt ? yt.notes : '';
      document.getElementById('yt-del-btn').style.display = yt ? 'inline-flex' : 'none';
      document.getElementById('yt-modal').style.display = 'flex';
    }
    export function closeYTModal() { document.getElementById('yt-modal').style.display = 'none'; }
    export function saveYT() {
      const url = document.getElementById('yt-url').value.trim();
      const title = document.getElementById('yt-title').value.trim();
      if (!title) { alert('Informe o título.'); return; }
      const yt = {
        id: _ytId || Date.now(), url, title,
        cat: document.getElementById('yt-cat').value,
        status: document.getElementById('yt-status').value,
        duration: document.getElementById('yt-duration').value.trim(),
        channel: document.getElementById('yt-channel').value.trim(),
        notes: document.getElementById('yt-notes').value.trim(),
        videoId: ytVideoId(url) || null,
        addedAt: _ytId ? (S.ytQueue.find(y => y.id == _ytId)?.addedAt || Date.now()) : Date.now()
      };
      if (_ytId) { const i = S.ytQueue.findIndex(y => y.id == _ytId); if (i >= 0) S.ytQueue[i] = yt; }
      else S.ytQueue.push(yt);
      saveYTStore(); closeYTModal(); renderYT(); updateTabCounts();
    }
    export function deleteYT() { if (!_ytId || !confirm('Remover da fila?')) return; S.ytQueue = S.ytQueue.filter(y => y.id != _ytId); saveYTStore(); closeYTModal(); renderYT(); updateTabCounts(); }

    export function renderYT() {
      const c = document.getElementById('yt-container');
      const q = document.getElementById('inp-yt-search').value.toLowerCase().trim();
      const cf = document.getElementById('sel-yt-cat').value;
      const sf = document.getElementById('sel-yt-status').value;
      let items = [...S.ytQueue];
      if (q) items = items.filter(y => y.title.toLowerCase().includes(q) || (y.channel || '').toLowerCase().includes(q) || (y.notes || '').toLowerCase().includes(q));
      if (cf !== 'all') items = items.filter(y => y.cat === cf);
      if (sf !== 'all') items = items.filter(y => y.status === sf);
      // Sort: watching first, then watch, then done
      items.sort((a, b) => { const o = { watching: 0, watch: 1, done: 2 }; return (o[a.status] || 1) - (o[b.status] || 1); });
      document.getElementById('lbl-yt-count').textContent = items.length + ' itens';
      document.getElementById('tc-youtube').textContent = S.ytQueue.length;
      if (!items.length) { c.innerHTML = `<div class="state-box"><span class="stico">▶️</span>${q || cf !== 'all' || sf !== 'all' ? 'Nenhum item encontrado.' : 'Nenhum vídeo na fila.<br><span style="font-size:.72rem;color:var(--t4);margin-top:.3rem;display:block">Adicione links de vídeos, playlists ou canais do YouTube.</span>'}</div>`; return; }

      const catClass = { video: 'ytc-video', series: 'ytc-series', channel: 'ytc-channel' };
      const catLabel = { video: '📹 Vídeo', series: '📋 Playlist', channel: '📺 Canal' };
      const stClass = { watch: 'yts-watch', watching: 'yts-watching', done: 'yts-done' };
      const stLabel = { watch: 'Assistir', watching: 'Assistindo', done: 'Assistido' };

      c.innerHTML = '<div class="yt-list">' + items.map((yt, i) => {
        const thumb = yt.videoId
          ? `<img src="https://img.youtube.com/vi/${yt.videoId}/mqdefault.jpg" alt="" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='▶️'">`
          : `<span style="font-size:1.1rem">${yt.cat === 'channel' ? '📺' : yt.cat === 'series' ? '📋' : '▶️'}</span>`;
        const openLink = yt.url ? `<a href="${yt.url}" target="_blank" class="btn btn-xs btn-secondary" style="padding:.2rem .45rem" title="Abrir no YouTube">↗</a>` : '';
        return `<div class="yt-row">
      <div class="rank">${i + 1}</div>
      <div class="yt-thumb">${thumb}</div>
      <div class="yt-info">
        <div class="yt-title">${yt.title}</div>
        <div class="yt-meta">
          <span class="yt-cat ${catClass[yt.cat] || 'ytc-video'}">${catLabel[yt.cat] || 'Vídeo'}</span>
          ${yt.channel ? `<span>· ${yt.channel}</span>` : ''}
          ${yt.duration ? `<span>· ${yt.duration}</span>` : ''}
          ${yt.notes ? `<span style="color:var(--t4)">· ${yt.notes.length > 40 ? yt.notes.slice(0, 40) + '…' : yt.notes}</span>` : ''}
        </div>
      </div>
      <div style="display:flex;align-items:center;gap:.3rem">
        <span class="yt-status ${stClass[yt.status]}">${stLabel[yt.status]}</span>
        ${openLink}
        <button class="btn btn-xs btn-ghost" onclick="openYTEditor(${yt.id})" style="padding:.2rem .35rem">✏️</button>
      </div>
    </div>`;
      }).join('') + '</div>';
    }

    // Demo YouTube queue
    export function addDemoYT() {
      S.ytQueue = [
        { id: 1, url: 'https://youtube.com/watch?v=dQw4w9WgXcQ', title: 'Como seu cérebro aprende — Kurzgesagt', cat: 'video', status: 'watch', duration: '12min', channel: 'Kurzgesagt', notes: '', videoId: 'dQw4w9WgXcQ', addedAt: Date.now() },
        { id: 2, url: 'https://youtube.com/playlist?list=PLbpi6ZahtOH6Ar_3GPy3workUBRiKFqT', title: 'História da Filosofia Ocidental', cat: 'series', status: 'watching', duration: '40 vídeos', channel: 'Philosophize This!', notes: 'Ótimo para antes de dormir', videoId: null, addedAt: Date.now() - 86400000 },
        { id: 3, url: 'https://youtube.com/@veritasium', title: 'Veritasium', cat: 'channel', status: 'watch', duration: '', channel: 'Veritasium', notes: 'Ciência e engenharia', videoId: null, addedAt: Date.now() - 172800000 },
        { id: 4, url: 'https://youtube.com/watch?v=aircAruvnKk', title: 'But what is a neural network?', cat: 'video', status: 'done', duration: '19min', channel: '3Blue1Brown', notes: '', videoId: 'aircAruvnKk', addedAt: Date.now() - 604800000 },
      ];
    }
    export function openSettings() {
      const isConnected = !!S.traktToken;
      const statusEl = document.getElementById('cfg-trakt-status');
      if (statusEl) {
        statusEl.textContent = isConnected ? `✓ @${S.traktUser}` : 'não conectado';
        statusEl.style.color = isConnected ? 'var(--green)' : 'var(--red)';
      }
      const traktInfo = document.getElementById('cfg-trakt-info');
      if (traktInfo) {
        traktInfo.textContent = isConnected 
          ? 'Conta conectada via OAuth. Para desconectar ou trocar de conta, use o botão "Sair" no topo do app.' 
          : 'Conta não conectada. Para conectar ao Trakt, clique em "Sair" no topo do app e faça a conexão na tela de login.';
      }
      document.getElementById('cfg-tmdb-key').value = S.tmdbKey || '';
      document.getElementById('cfg-omdb-key').value = S.omdbKey || '';
      document.getElementById('cfg-tmdb-msg').style.display = 'none';
      document.getElementById('backup-msg').style.display = 'none';
      syncALSettingsUI();
      document.getElementById('settings-modal').style.display = 'flex';
    }
    export function closeSettings() {
      document.getElementById('settings-modal').style.display = 'none';
    }

    export function syncALSettingsUI() {
      const connected = !!(S.alToken && S.alUser);
      document.getElementById('cfg-al-connect-ui').style.display = connected ? 'none' : 'block';
      document.getElementById('cfg-al-connected-info').style.display = connected ? 'block' : 'none';
      document.getElementById('cfg-al-status-lbl').textContent =
        connected ? '✓ conectado' : 'não conectado';
      if (connected) {
        document.getElementById('cfg-al-user').textContent = S.alUser;
        // Fill status grid from available lists
        const statuses = ['CURRENT', 'PLANNING', 'COMPLETED', 'PAUSED', 'DROPPED'];
        const labels = { 'CURRENT': 'Assistindo', 'PLANNING': 'Planejado', 'COMPLETED': 'Completo', 'PAUSED': 'Pausado', 'DROPPED': 'Abandonado' };
        const counts = {};
        S.availableLists.filter(l => l.src === 'anilist').forEach(l => {
          counts[l.alStatus] = (l.count || 0);
        });
        document.getElementById('cfg-al-status-grid').innerHTML =
          statuses.filter(s => counts[s] > 0).map(s =>
            `<div class="al-status-item has">${labels[s]}<br/><strong>${counts[s]}</strong></div>`
          ).join('');
      }
    }

    export async function cfgConnectAL() {
      const cid = document.getElementById('cfg-al-cid').value.trim();
      if (!cid) { alert('Cole o Client ID do AniList no campo acima.'); return; }
      S.alClientId = cid;
      saveSess(); // salva antes do redirect
      openALPopup();
    }

    export async function cfgReloadAL() {
      if (!S.alToken) { return; }
      await loadLists();
      syncALSettingsUI();
    }

    export function cfgDisconnectAL() {
      if (!confirm('Desconectar AniList? As listas de animes serão removidas da fila.')) return;
      S.alToken = ''; S.alUser = ''; S.alUserId = 0;
      saveSess();
      // Remove AL lists from available
      S.availableLists = S.availableLists.filter(l => l.src !== 'anilist');
      S.selectedLists = new Set([...S.selectedLists].filter(id => !id.startsWith('__al__')));
      renderListPicker();
      document.getElementById('pill-al').style.display = 'none';
      syncALSettingsUI();
      // Reload data without AniList
      loadData();
    }

    export function cfgSaveTMDB() {
      const key = document.getElementById('cfg-tmdb-key').value.trim();
      S.tmdbKey = key;
      saveSess();
      const msg = document.getElementById('cfg-tmdb-msg');
      msg.style.display = 'block';
      if (key) {
        msg.style.color = 'var(--green)';
        msg.textContent = '✓ Key salva! Capas serão carregadas na próxima renderização.';
        // Clear cache so new posters are fetched
        S.posterCache = {}; savePosterCache();
        setTimeout(() => render(), 500);
      } else {
        msg.style.color = 'var(--t3)';
        msg.textContent = 'Key removida. Capas voltam ao modo ícone.';
        render();
      }
    }

    export function cfgClearPosters() {
      if (!confirm('Limpar cache de capas? Serão baixadas novamente.')) return;
      S.posterCache = {}; savePosterCache();
      const msg = document.getElementById('cfg-tmdb-msg');
      msg.style.display = 'block'; msg.style.color = 'var(--t3)';
      msg.textContent = 'Cache limpo. Capas recarregadas na próxima visualização.';
      render();
    }

    // ══════════════════════════════════════════
    // INIT
    // ══════════════════════════════════════════
    // ══════════════════════════════════════════
    const shState = { type: 'all', states: new Set(), decades: new Set() };

    export function openShuffle() {
      document.getElementById('shuffle-result').style.display = 'none';
      document.getElementById('shuffle-filters').style.display = 'block';
      updateShufflePool();
      document.getElementById('shuffle-modal').style.display = 'flex';
    }
    export function closeShuffleModal() { document.getElementById('shuffle-modal').style.display = 'none'; }

    export function shType(t) {
      shState.type = t;
      ['all', 'movie', 'show', 'anime'].forEach(id => {
        document.getElementById('sh-' + id).classList.toggle('on', id === t);
      });
      updateShufflePool();
    }

    export function shToggleState(st) {
      if (shState.states.has(st)) shState.states.delete(st);
      else shState.states.add(st);
      document.getElementById('sh-' + st).classList.toggle('on', shState.states.has(st));
      updateShufflePool();
    }

    export function shToggleDecade(d) {
      if (shState.decades.has(d)) shState.decades.delete(d);
      else shState.decades.add(d);
      document.getElementById('sh-' + d).classList.toggle('on', shState.decades.has(d));
      updateShufflePool();
    }

    export function getShufflePool() {
      // Começa com os itens já filtrados na fila atual
      let pool = [...S.filtered];

      // Aplica filtro de tipo do sorteio
      if (shState.type !== 'all') pool = pool.filter(i => i.type === shState.type);

      // Aplica filtros de estado do sorteio
      if (shState.states.size > 0) {
        pool = pool.filter(i => {
          for (const st of shState.states) {
            if (st === 'notstarted' && i.watchedEps === 0 && !i.alPlanning && !i.alPaused) return true;
            if (st === 'inprogress' && i.inProgress) return true;
            if (st === 'planning' && (i.alPlanning || i.alStatus === 'PLANNING')) return true;
          }
          return false;
        });
      }

      // Aplica filtro de décadas do sorteio
      if (shState.decades.size > 0) {
        pool = pool.filter(i => {
          for (const d of shState.decades) {
            if (d === '2020s' && i.year >= 2020) return true;
            if (d === '2010s' && i.year >= 2010 && i.year < 2020) return true;
            if (d === '2000s' && i.year >= 2000 && i.year < 2010) return true;
            if (d === '1990s' && i.year >= 1990 && i.year < 2000) return true;
            if (d === 'pre1990' && i.year > 0 && i.year < 1990) return true;
          }
          return false;
        });
      }

      return pool;
    }

    export function updateShufflePool() {
      const pool = getShufflePool();
      const el = document.getElementById('shuffle-pool-info');
      if (el) el.textContent = pool.length > 0
        ? `${pool.length} item${pool.length !== 1 ? 's' : ''} disponível${pool.length !== 1 ? 'is' : ''} para sortear`
        : 'Nenhum item com esses filtros';
    }

    export function doShuffle() {
      const pool = getShufflePool();
      if (!pool.length) {
        alert('Nenhum item disponível com os filtros selecionados.'); return;
      }

      // Escolhe aleatoriamente
      const item = pool[Math.floor(Math.random() * pool.length)];

      // Esconde filtros, mostra resultado
      document.getElementById('shuffle-filters').style.display = 'none';
      document.getElementById('shuffle-result').style.display = 'block';

      // Preenche resultado
      document.getElementById('shuffle-title').textContent = item.title;

      const tL = { movie: 'Filme', show: 'Série', anime: 'Anime' };
      const tC = { movie: 'bm', show: 'bs', anime: 'ba' };
      const alSt = item.alStatus ? `· <span class="al-status als-${item.alStatus.toLowerCase()}">${{ CURRENT: 'Assistindo', PLANNING: 'Planejado', PAUSED: 'Pausado', DROPPED: 'Abandonado', COMPLETED: 'Completo' }[item.alStatus] || item.alStatus}</span>` : '';
      const epInfo = item.type !== 'movie' && item.totalEps > 0 ? `· ${item.watchedEps}/${item.totalEps} ep` : '';
      document.getElementById('shuffle-meta').innerHTML =
        `<span class="badge ${tC[item.type]}">${tL[item.type]}</span>
     <span>${item.year || '—'}</span>
     ${epInfo ? `<span>${epInfo}</span>` : ''}
     ${item.inProgress ? '<span class="badge bp">▶ Em andamento</span>' : ''}
     ${alSt}`;

      // Thumb
      const thumb = document.getElementById('shuffle-thumb');
      const tI = { movie: '🎬', show: '📺', anime: '⛩' };
      const cachedUrl = getCachedPoster('tmdb_' + item.id) || (item.src === 'anilist' ? item.poster : null);
      if (cachedUrl) {
        thumb.innerHTML = `<img src="${cachedUrl}" style="width:100%;height:100%;object-fit:cover" onerror="this.parentElement.innerHTML='${tI[item.type] || '🎬'}'">`;
      } else {
        thumb.textContent = tI[item.type] || '🎬';
      }
    }

    // ══════════════════════════════════════════

    export function exportBackup() {
      const user = S.traktUser || S.alUser || 'user';
      const now = new Date().toISOString().split('T')[0];
      const rows = [];

      // Header
      rows.push(['tipo', 'id', 'titulo', 'autor_canal', 'status', 'progresso', 'total', 'ano', 'contexto', 'genero_plataforma', 'notas', 'url', 'adicionado_em'].join(','));

      // Livros
      for (const b of S.books) {
        rows.push([
          'livro', b.id, csvEsc(b.title), csvEsc(b.author || ''), b.status,
          b.pageCur || 0, b.pages || 0, b.year || '', b.ctx,
          csvEsc(b.genre || ''), csvEsc(b.notes || ''), '',
          new Date(b.addedAt || Date.now()).toISOString()
        ].join(','));
      }

      // Jogos
      for (const g of S.games) {
        rows.push([
          'jogo', g.id, csvEsc(g.title), csvEsc(g.platform || ''), g.status,
          '', '', g.year || '', g.ctx,
          csvEsc(g.hours || ''), csvEsc(g.notes || ''), '',
          new Date(g.addedAt || Date.now()).toISOString()
        ].join(','));
      }

      // YouTube
      for (const y of S.ytQueue) {
        rows.push([
          'youtube', y.id, csvEsc(y.title), csvEsc(y.channel || ''), y.status,
          '', '', '', y.cat,
          csvEsc(y.duration || ''), csvEsc(y.notes || ''), csvEsc(y.url || ''),
          new Date(y.addedAt || Date.now()).toISOString()
        ].join(','));
      }

      // Franquias
      for (const f of S.franchises) {
        for (const item of f.items) {
          rows.push([
            'franquia', f.id, csvEsc(item.title), csvEsc(f.name), '',
            '', '', item.year || '', '', '', '', '', ''
          ].join(','));
        }
      }

      const csv = rows.join('\n');
      const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = `fila-de-tela-backup-${user}-${now}.csv`;
      document.body.appendChild(a); a.click();
      document.body.removeChild(a); URL.revokeObjectURL(url);

      showBackupMsg(`✓ Exportado: ${S.books.length} livros, ${S.games.length} jogos, ${S.ytQueue.length} vídeos, ${S.franchises.length} franquias`, 'var(--green)');
    }

    export function csvEsc(v) {
      const s = String(v || '');
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s.replace(/"/g, '""')}"` : s;
    }

    export function importBackup(input) {
      const file = input.files[0]; if (!file) return;
      const reader = new FileReader();
      reader.onload = e => {
        try {
          const lines = e.target.result.replace(/^\uFEFF/, '').split('\n').filter(l => l.trim());
          if (lines.length < 2) { showBackupMsg('Arquivo vazio ou inválido', 'var(--red)'); return; }
          // Skip header
          let books = 0, games = 0, yt = 0, fr = 0, frMap = new Map();
          for (let i = 1; i < lines.length; i++) {
            const c = parseCSVLine(lines[i]);
            if (c.length < 2) continue;
            const [tipo, id, titulo, autorCanal, status, prog, total, ano, ctx, genrePlat, notas, url, addedAt] = c;
            const aid = parseInt(id) || Date.now() + i;
            const addTs = addedAt ? new Date(addedAt).getTime() : Date.now();

            if (tipo === 'livro') {
              if (S.books.find(b => b.id == aid)) continue;
              S.books.push({
                id: aid, title: titulo, author: autorCanal, status: status || 'want',
                pageCur: parseInt(prog) || 0, pages: parseInt(total) || 0, year: parseInt(ano) || 0,
                ctx: ctx || 'sleep', genre: genrePlat, notes: notas, addedAt: addTs
              });
              books++;
            } else if (tipo === 'jogo') {
              if (S.games.find(g => g.id == aid)) continue;
              S.games.push({
                id: aid, title: titulo, platform: autorCanal, status: status || 'backlog',
                hours: genrePlat, year: parseInt(ano) || 0, ctx: ctx || 'weekend', notes: notas, addedAt: addTs
              });
              games++;
            } else if (tipo === 'youtube') {
              if (S.ytQueue.find(y => y.id == aid)) continue;
              const vid = ytVideoId(url || '');
              S.ytQueue.push({
                id: aid, title: titulo, channel: autorCanal, status: status || 'watch',
                cat: ctx || 'video', duration: genrePlat, notes: notas, url, videoId: vid, addedAt: addTs
              });
              yt++;
            } else if (tipo === 'franquia') {
              const fid = parseInt(id);
              if (!frMap.has(fid)) frMap.set(fid, { id: fid, name: autorCanal, items: [] });
              frMap.get(fid).items.push({ traktId: Date.now() + i, title: titulo, year: parseInt(ano) || 0, type: 'movie' });
              fr++;
            }
          }
          // Merge franquias
          for (const [, f] of frMap) {
            if (!S.franchises.find(x => x.name === f.name)) S.franchises.push(f);
          }

          saveBooksStore(); saveGamesStore(); saveYTStore(); saveFranchises();
          updateTabCounts(); render();
          showBackupMsg(`✓ Importado: ${books} livros, ${games} jogos, ${yt} vídeos, ${Math.round(fr / 2)} franquias`, 'var(--green)');
        } catch (err) {
          showBackupMsg('Erro ao importar: ' + err.message, 'var(--red)');
        }
        input.value = '';
      };
      reader.readAsText(file, 'UTF-8');
    }

    export function showBackupMsg(msg, color) {
      const el = document.getElementById('backup-msg');
      if (!el) return;
      el.style.display = 'block';
      el.style.background = color === 'var(--green)' ? 'var(--gbg)' : 'var(--rbg)';
      el.style.border = `1px solid ${color === 'var(--green)' ? 'var(--gbd)' : 'var(--rbd)'}`;
      el.style.color = color;
      el.textContent = msg;
      setTimeout(() => { if (el) el.style.display = 'none'; }, 5000);
    }

    document.addEventListener('click', e => { if (!e.target.closest('.acwrap')) document.getElementById('fr-ac').style.display = 'none'; });

    (function () {
      // Primeiro verifica se é retorno do OAuth do AniList
      if (window.location.hash.includes('access_token')) {
        checkALCallback();
        return;
      }
      // Caso normal: restaura sessão salva
      if (loadSess()) {
        document.getElementById('card-main').style.display = 'none';
        document.getElementById('card-saved').style.display = 'flex';
        document.getElementById('saved-msg').textContent = 'Entrando como @' + (S.traktUser || S.alUser) + '…';
        setTimeout(() => proceedToApp(), 300);
      } else {
        // Pre-fill inputs on login screen if they exist in S
        if (S.tmdbKey) document.getElementById('inp-tmdb').value = S.tmdbKey;
        if (S.traktCid) document.getElementById('inp-cid').value = S.traktCid;
        if (S.alClientId) document.getElementById('inp-al-cid').value = S.alClientId;
      }
    })();

    // ══════════════════════════════════════════
    export function toggleLoginHelp(el) {
      el.classList.toggle('open');
      const content = el.nextElementSibling;
      content.classList.toggle('open');
    }

    // Atualiza o link dinâmico da autorização com o Client ID digitado
    export function updateALAuthLink(val) {
      const cid = val.trim() || '44001';
      const el = document.getElementById('al-manual-auth-link');
      if (el) {
        el.href = `https://anilist.co/api/v2/oauth/authorize?client_id=${cid}&response_type=token`;
        el.textContent = `Abrir link de autorização (com ID ${cid})`;
      }
    }

    export function parseGameHours(hoursStr) {
      if (!hoursStr) return 0;
      const matches = String(hoursStr).match(/([\d.,]+)\s*h?/i);
      if (matches) {
        return parseFloat(matches[1].replace(',', '.')) || 0;
      }
      return 0;
    }

    export function parseYTDuration(durStr) {
      if (!durStr) return 0;
      durStr = String(durStr).toLowerCase().trim();
      let mins = 0;
      const hMatch = durStr.match(/(\d+)\s*h/);
      const mMatch = durStr.match(/(\d+)\s*(m|min)/);
      if (hMatch) mins += parseInt(hMatch[1]) * 60;
      if (mMatch) {
        mins += parseInt(mMatch[1]);
      } else if (!hMatch) {
        const num = parseInt(durStr);
        if (!isNaN(num)) mins += num;
      }
      return mins;
    }

    export function calculateTotalTimeSpent() {
      const a = S.allItems;
      let moviesMin = 0;
      let showsMin = 0;
      let animesMin = 0;
      let gamesMin = 0;
      let booksMin = 0;
      let youtubeMin = 0;

      // 1. Mídia assistida (Trakt e AniList) - com deduplicação por título
      const mediaMap = new Map();
      for (const item of a) {
        let mins = 0;
        if (item.type === 'movie') {
          if (item.progress === 100 || item.watchedEps > 0 || item.alStatus === 'COMPLETED') mins = 120;
        } else if (item.type === 'anime') {
          mins = (item.watchedEps || 0) * 24;
        } else if (item.type === 'show') {
          mins = (item.watchedEps || 0) * 45;
        }

        if (mins > 0) {
          const tKey = item.title.toLowerCase().trim();
          const exist = mediaMap.get(tKey);
          if (!exist || mins > exist.mins) {
            mediaMap.set(tKey, { type: item.type, mins });
          }
        }
      }

      for (const val of mediaMap.values()) {
        if (val.type === 'movie') moviesMin += val.mins;
        else if (val.type === 'anime') animesMin += val.mins;
        else if (val.type === 'show') showsMin += val.mins;
      }

      // 2. Jogos (Jogando ou Zerado)
      const gamesList = S.games || [];
      for (const g of gamesList) {
        if (g.status === 'playing' || g.status === 'done') {
          gamesMin += Math.round(parseGameHours(g.hours) * 60);
        }
      }

      // 3. Livros (Lendo ou Lido)
      const booksList = S.books || [];
      for (const b of booksList) {
        if (b.status === 'reading' || b.status === 'paused') {
          booksMin += Math.round((b.pageCur || 0) * 1.5);
        } else if (b.status === 'done') {
          booksMin += Math.round((b.pages || 300) * 1.5);
        }
      }

      // 4. YouTube (Assistido ou Assistindo)
      const ytList = S.ytQueue || [];
      for (const y of ytList) {
        if (y.status === 'done' || y.status === 'watching') {
          youtubeMin += parseYTDuration(y.duration);
        }
      }

      // 5. Adicionar o tempo avulso cronometrado
      const customMin = S.customTimeMinutes || 0;

      const total = moviesMin + showsMin + animesMin + gamesMin + booksMin + youtubeMin + customMin;

      return {
        movies: moviesMin,
        shows: showsMin,
        animes: animesMin,
        games: gamesMin,
        books: booksMin,
        youtube: youtubeMin,
        custom: customMin,
        total: total
      };
    }

    export function openTimeDetails() {
      const info = calculateTotalTimeSpent();

      const formatTime = (mins) => {
        const h = Math.floor(mins / 60);
        const m = mins % 60;
        if (h > 0) return `${h}h ${m}m`;
        return `${m}min`;
      };

      const formatTotalTime = (mins) => {
        const d = Math.floor(mins / 1440);
        const h = Math.floor((mins % 1440) / 60);
        const m = mins % 60;
        let parts = [];
        if (d > 0) parts.push(`${d}d`);
        if (h > 0) parts.push(`${h}h`);
        parts.push(`${m}m`);
        return parts.join(' ');
      };

      document.getElementById('td-movies').textContent = formatTime(info.movies);
      document.getElementById('td-shows').textContent = formatTime(info.shows);
      document.getElementById('td-animes').textContent = formatTime(info.animes);
      document.getElementById('td-games').textContent = `${Math.round(info.games / 60)}h`;
      const readPages = (S.books || []).reduce((sum, b) => sum + (b.status === 'done' ? (b.pages || 300) : (b.pageCur || 0)), 0);
      document.getElementById('td-books').textContent = `${formatTime(info.books)} (${readPages} pgs)`;
      document.getElementById('td-youtube').textContent = formatTime(info.youtube);

      let totalLabel = formatTotalTime(info.total);
      if (info.custom > 0) {
        totalLabel += ` (inclui ${formatTime(info.custom)} de untracked)`;
      }
      document.getElementById('td-total').textContent = totalLabel;

      document.getElementById('time-details-modal').style.display = 'flex';
    }

    export function closeTimeDetails() {
      document.getElementById('time-details-modal').style.display = 'none';
    }


    // ══════════════════════════════════════════
    // EXTREME END
    // ══════════════════════════════════════════
// Expose for inline HTML events
window.ytPlaylistId = ytPlaylistId;
window.renderAgora = renderAgora;
window.setAutoRefresh = setAutoRefresh;
window.loginTraktManual = loginTraktManual;
window.startTraktFlow = startTraktFlow;
window.sleep = sleep;
window.savePosterCache = savePosterCache;
window.cancelDevice = cancelDevice;
window.loadPins = loadPins;
window.closeFrModal = closeFrModal;
window.calculateTotalTimeSpent = calculateTotalTimeSpent;
window.toggleType = toggleType;
window.saveFranchises = saveFranchises;
window.openGameEditor = openGameEditor;
window.clearSess = clearSess;
window.exportBackup = exportBackup;
window.loadYTStore = loadYTStore;
window.shType = shType;
window.deleteYT = deleteYT;
window.traktGet = traktGet;
window.proceedToApp = proceedToApp;
window.showBackupMsg = showBackupMsg;
window.renderYT = renderYT;
window.injectPoster = injectPoster;
window.openYTEditor = openYTEditor;
window.loadRatingsCache = loadRatingsCache;
window.saveGame = saveGame;
window.getShufflePool = getShufflePool;
window.parseYTDuration = parseYTDuration;
window.renderGames = renderGames;
window.shToggleState = shToggleState;
window.cfgConnectAL = cfgConnectAL;
window.toggleList = toggleList;
window.cfgClearPosters = cfgClearPosters;
window.loadData = loadData;
window.getRatingsHTML = getRatingsHTML;
window.importStoryGraphCSV = importStoryGraphCSV;
window.loadFranchises = loadFranchises;
window.buildWatchedMovie = buildWatchedMovie;
window.cfgSaveOMDb = cfgSaveOMDb;
window.renderCtxItem = renderCtxItem;
window.updateShufflePool = updateShufflePool;
window.closeSettings = closeSettings;
window.applyFilters = applyFilters;
window.cfgClearRatings = cfgClearRatings;
window.lazyLoadBookCovers = lazyLoadBookCovers;
window.closeGmModal = closeGmModal;
window.setView = setView;
window.closeYTModal = closeYTModal;
window.renderHistory = renderHistory;
window.openSettings = openSettings;
window.ytParseUrl = ytParseUrl;
window.fetchShowsProgress = fetchShowsProgress;
window.toggleFrGrp = toggleFrGrp;
window.savePins = savePins;
window.switchTab = switchTab;
window.frAddSel = frAddSel;
window.parseCSVLine = parseCSVLine;
window.cfgSaveTMDB = cfgSaveTMDB;
window.applyPreset = applyPreset;
window.autoDetect = autoDetect;
window.loadGamesStore = loadGamesStore;
window.addDemoBooks = addDemoBooks;
window.alQuery = alQuery;
window.getContextItems = getContextItems;
window.loadLists = loadLists;
window.selectAllLists = selectAllLists;
window.render = render;
window.addDemoYT = addDemoYT;
window.getCachedPoster = getCachedPoster;
window.renderFranchises = renderFranchises;
window.saveGamesStore = saveGamesStore;
window.applyFrPromo = applyFrPromo;
window.showContainerMsg = showContainerMsg;
window.saveYTStore = saveYTStore;
window.togglePin = togglePin;
window.resetFilters = resetFilters;
window.frDS = frDS;
window.startAniListFlow = startAniListFlow;
window.buildALItem = buildALItem;
window.saveBooksStore = saveBooksStore;
window.updateStats = updateStats;
window.fetchHistory = fetchHistory;
window.showErr = showErr;
window.saveRatingsCache = saveRatingsCache;
window.saveFr = saveFr;
window.closeBkModal = closeBkModal;
window.loadBooksStore = loadBooksStore;
window.deleteGame = deleteGame;
window.getFrNextIds = getFrNextIds;
window.closeTimeDetails = closeTimeDetails;
window.loadDemo = loadDemo;
window.frRm = frRm;
window.lazyLoadRatings = lazyLoadRatings;
window.openALPopup = openALPopup;
window.lazyLoadPosters = lazyLoadPosters;
window.cfgDisconnectAL = cfgDisconnectAL;
window.gameAvatarColor = gameAvatarColor;
window.loadPosterCache = loadPosterCache;
window.openTimeDetails = openTimeDetails;
window.doShuffle = doShuffle;
window.frAC = frAC;
window.demoRebuild = demoRebuild;
window.parseGameHours = parseGameHours;
window.deleteBook = deleteBook;
window.refreshData = refreshData;
window.doLogout = doLogout;
window.sf = sf;
window.ytChannelHandle = ytChannelHandle;
window.updateALAuthLink = updateALAuthLink;
window.buildDemoHistory = buildDemoHistory;
window.saveBook = saveBook;
window.openFrEditor = openFrEditor;
window.checkALCallback = checkALCallback;
window.fetchOMDbRatings = fetchOMDbRatings;
window.resolveTraktUser = resolveTraktUser;
window.updateTabCounts = updateTabCounts;
window.renderList = renderList;
window.addDemoGames = addDemoGames;
window.setSyncing = setSyncing;
window.fetchBookCover = fetchBookCover;
window.renderBooks = renderBooks;
window.startAniListFlowFromLogin = startAniListFlowFromLogin;
window.deselectAllLists = deselectAllLists;
window.cfgReloadAL = cfgReloadAL;
window.renderListPicker = renderListPicker;
window.openBookEditor = openBookEditor;
window.loginALManual = loginALManual;
window.fetchALLists = fetchALLists;
window.buildDemoRevisited = buildDemoRevisited;
window.toggleDecade = toggleDecade;
window.syncALSettingsUI = syncALSettingsUI;
window.openShuffle = openShuffle;
window.renderGrid = renderGrid;
window.csvEsc = csvEsc;
window.renderFrList = renderFrList;
window.buildTraktShow = buildTraktShow;
window.ytVideoId = ytVideoId;
window.resolveALUser = resolveALUser;
window.toggleLoginHelp = toggleLoginHelp;
window.deleteFr = deleteFr;
window.setSort = setSort;
window.toggleState = toggleState;
window.closeShuffleModal = closeShuffleModal;
window.loadSess = loadSess;
window.fetchTMDBPoster = fetchTMDBPoster;
window.updateFBar = updateFBar;
window.buildTraktMovie = buildTraktMovie;
window.getFrInfo = getFrInfo;
window.alStatusBadge = alStatusBadge;
window.saveSess = saveSess;
window.fetchListItems = fetchListItems;
window.frSel = frSel;
window.clearPHL = clearPHL;
window.importBackup = importBackup;
window.saveYT = saveYT;
window.renderRevisited = renderRevisited;
window.shToggleDecade = shToggleDecade;
window.buildWatchedShow = buildWatchedShow;

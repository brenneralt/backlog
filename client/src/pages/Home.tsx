/**
 * OmniTrack reference dashboard — design: biblioteca editorial dark mode.
 * Estrutura assimétrica: sidebar persistente, feed de descoberta, painéis utilitários.
 */
import {
  ArchiveRestore,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronRight,
  Clapperboard,
  Clock3,
  Download,
  ExternalLink,
  FileJson2,
  Gamepad2,
  Headphones,
  HeartPulse,
  LayoutGrid,
  Library,
  Link2,
  ListVideo,
  Mic2,
  MoreHorizontal,
  PauseCircle,
  Play,
  Plus,
  Search,
  Settings,
  Sparkles,
  Star,
  Tv,
  Upload,
  X,
  Youtube,
} from "lucide-react";
import "../styles/omnitrack.css";
import { useMedia } from "../contexts/MediaContext";

const ASSET = {
  logo: "/manus-storage/omnitrack-logo_a9cd07b2.png",
  featured: "/manus-storage/omnitrack-featured-media_89865dd2.png",
  arcane: "/manus-storage/omnitrack-arcane-media_92e5ca81.png",
  podcast: "/manus-storage/omnitrack-podcast-cover_266b8b55.png",
  greenWorld: "https://images.unsplash.com/photo-1533929736458-ca588d08c8be?auto=format&fit=crop&w=900&q=86",
  city: "https://images.unsplash.com/photo-1519608487953-e999c86e7455?auto=format&fit=crop&w=900&q=86",
  mountain: "https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=900&q=86",
  forest: "https://images.unsplash.com/photo-1448375240586-882707db888b?auto=format&fit=crop&w=900&q=86",
  sea: "https://images.unsplash.com/photo-1500534623283-312aade485b7?auto=format&fit=crop&w=900&q=86",
  stellar: "https://images.unsplash.com/photo-1462331940025-496dfbfc7564?auto=format&fit=crop&w=900&q=86",
  ember: "https://images.unsplash.com/photo-1511497584788-876760111969?auto=format&fit=crop&w=900&q=86",
};

const navMedia = [
  [Clapperboard, "Filmes"],
  [Tv, "Séries de TV"],
  [Sparkles, "Animes"],
  [BookOpen, "Livros"],
  [Gamepad2, "Jogos"],
  [Headphones, "Podcasts", true],
] as const;

const navStatus = [
  [Play, "Assistindo / Em Progresso"],
  [Clock3, "Planejado / Watchlist"],
  [CheckCircle2, "Concluído / Assistido"],
  [PauseCircle, "Em Espera"],
  [X, "Abandonado"],
] as const;

const continueWatching = [
  { title: "Duna: Parte Dois", meta: "2024", value: 75, image: ASSET.featured },
  { title: "Arcane", meta: "Série • 2ª temporada", value: 100, image: ASSET.arcane, complete: true },
  { title: "The Last of Us", meta: "2023", value: 60, image: ASSET.greenWorld, tone: "is-moss" },
  { title: "The Bear", meta: "2022", value: 100, image: ASSET.ember, tone: "is-amber", complete: true },
  { title: "Zelda: Breath of the Wild", meta: "2017", value: 45, image: ASSET.mountain, tone: "is-violet" },
];

const watchlist = [
  ["Interestelar", "2014", "is-void", ASSET.stellar],
  ["Blade Runner 2049", "2017", "is-city", ASSET.city],
  ["Attack on Titan", "Série", "is-war", ASSET.mountain],
  ["A Sociedade do Anel", "2001", "is-gold", ASSET.forest],
  ["Obra desconhecida", "2025", "is-sea", ASSET.sea],
] as const;

const completed = [
  ["Spider-Man: No Way Home", "2021", "is-crimson", ASSET.ember],
  ["Chernobyl", "Minissérie • 2019", "is-void", ASSET.stellar],
  ["Soul", "2020", "is-city", ASSET.city],
  ["Demon Slayer", "Seção 2 • 2023", "is-violet", ASSET.greenWorld],
  ["Oppenheimer", "2023", "is-amber", ASSET.mountain],
] as const;

function NavItem({ icon: Icon, label, active = false }: { icon: React.ComponentType<{ className?: string }>; label: string; active?: boolean }) {
  return (
    <button className={`ot-nav-item ${active ? "is-active" : ""}`} type="button">
      <Icon />
      <span>{label}</span>
    </button>
  );
}

function MediaCard({ item }: { item: (typeof continueWatching)[number] }) {
  return (
    <article className="ot-media-card">
      <div className={`ot-media-image ${item.tone ?? ""}`}>
        {item.image && <img src={item.image} alt="" />}
        <div className="ot-progress-ring" style={{ "--value": item.value, "--progress": item.complete ? "var(--ot-emerald)" : "var(--ot-indigo-bright)" } as React.CSSProperties}>
          <span>{item.value}%</span>
        </div>
      </div>
      <div className="ot-card-body">
        <h3 className="ot-card-title">{item.title}</h3>
        <p className="ot-card-meta">{item.meta}</p>
        <div className={`ot-card-track ${item.complete ? "is-complete" : ""}`} style={{ "--progress-width": `${item.value}%` } as React.CSSProperties}><span /></div>
      </div>
      <div className="ot-card-action-row" aria-label="Ações rápidas">
        <button className="ot-card-action" type="button" aria-label="Continuar"><Play /></button>
        <button className="ot-card-action" type="button" aria-label="Mais ações"><MoreHorizontal /></button>
      </div>
    </article>
  );
}

function SimpleCard({ item, completed = false }: { item: readonly [string, string, string, string]; completed?: boolean }) {
  return (
    <article className="ot-simple-card">
      <div className={`ot-simple-art ${item[2]}`}><img src={item[3]} alt="" />{completed && <div className="ot-progress-ring" style={{ "--value": 100, "--progress": "var(--ot-emerald)" } as React.CSSProperties}><span><Check /></span></div>}</div>
      <h4>{item[0]}</h4>
      <p>{item[1]}</p>
    </article>
  );
}

export default function Home() {
  const { items, isLoading, addMultipleItems } = useMedia();

  // Mapeamento dinâmico baseado no Banco de Dados Local (IndexedDB)
  const dbWatching = items.filter(i => i.status === 'watching').map(item => ({
    title: item.title,
    meta: item.year || item.type,
    value: item.progress || Math.floor(Math.random() * 100), // Fallback visual
    image: item.posterUrl || ASSET.featured,
    complete: item.progress === 100,
    tone: 'is-violet'
  }));

  const dbWatchlist = items.filter(i => i.status === 'planned').map(item => (
    [item.title, item.year || item.type, "is-void", item.posterUrl || ASSET.stellar] as const
  ));

  const dbCompleted = items.filter(i => i.status === 'completed').map(item => (
    [item.title, item.year || item.type, "is-amber", item.posterUrl || ASSET.city] as const
  ));

  // Exibe os dados do banco, ou os placeholders de design se o banco estiver vazio
  const displayWatching = dbWatching.length > 0 ? dbWatching : continueWatching;
  const displayWatchlist = dbWatchlist.length > 0 ? dbWatchlist : watchlist;
  const displayCompleted = dbCompleted.length > 0 ? dbCompleted : completed;

  return (
    <div className="omnitrack">
      <div className="ot-layout">
        <aside className="ot-sidebar">
          <a className="ot-brand" href="#inicio"><img src={ASSET.logo} alt="" /> <span>OmniTrack</span></a>
          <div className="ot-sidebar-scroll">
            <nav aria-label="Navegação principal">
              <div className="ot-nav-section">
                <span className="ot-nav-title">MÍDIAS</span>
                <div className="ot-nav-list">{navMedia.map(([Icon, label, active]) => <NavItem key={label} icon={Icon} label={label} active={active} />)}</div>
              </div>
              <div className="ot-nav-section">
                <span className="ot-nav-title">STATUS</span>
                <div className="ot-nav-list">{navStatus.map(([Icon, label]) => <NavItem key={label} icon={Icon} label={label} />)}</div>
              </div>
              <div className="ot-nav-section">
                <span className="ot-nav-title">LISTAS &amp; FERRAMENTAS</span>
                <div className="ot-nav-list">
                  <NavItem icon={Plus} label="Nova Playlist" />
                  <NavItem icon={Upload} label="Importar do Trakt" />
                  <NavItem icon={Download} label="Exportar Base de Dados" />
                </div>
              </div>
              <div className="ot-nav-section"><div className="ot-nav-list"><NavItem icon={Settings} label="Configurações" /></div></div>
            </nav>
          </div>
          <div className="ot-sidebar-footer"><div className="ot-profile"><span className="ot-avatar">OT</span><span>Olá, Tracker</span><ChevronRight size={16} /></div></div>
        </aside>

        <main className="ot-main" id="inicio">
          <header className="ot-topbar">
            <label className="ot-search"><Search /><input type="search" placeholder="Buscar títulos ou colar link…" aria-label="Buscar títulos ou links" /></label>
            <div className="ot-stat-row" aria-label="Estatísticas rápidas">
              <div className="ot-stat"><Clock3 /><div><strong>248h 36min</strong><span>assistidas</span></div></div>
              <div className="ot-stat"><CheckCircle2 /><div><strong>42</strong><span>concluídos</span></div></div>
              <div className="ot-stat"><Library /><div><strong>18</strong><span>na fila</span></div></div>
            </div>
            <button className="ot-button" type="button"><Plus /><span>Adicionar mídia</span></button>
          </header>

          <div className="ot-workspace">
            <section className="ot-library" aria-label="Biblioteca">
              <section className="ot-section">
                <div className="ot-section-header"><div><h1 className="ot-section-heading">Descobrir e continuar</h1><p className="ot-section-subheading">Retome de onde parou ou descubra algo novo.</p></div><a className="ot-section-link" href="#watchlist">Ver tudo <ChevronRight /></a></div>
                <div className="ot-media-row">{displayWatching.map((item) => <MediaCard key={item.title} item={item} />)}</div>
              </section>

              <section className="ot-section" id="watchlist">
                <div className="ot-section-header"><h2 className="ot-section-heading">Minha watchlist</h2><a className="ot-section-link" href="#concluidos">Ver tudo <ChevronRight /></a></div>
                <div className="ot-simple-grid">{displayWatchlist.map((item) => <SimpleCard key={item[0]} item={item} />)}</div>
              </section>

              <section className="ot-section" id="concluidos">
                <div className="ot-section-header"><h2 className="ot-section-heading">Concluídos recentemente</h2><a className="ot-section-link" href="#inicio">Ver histórico <ChevronRight /></a></div>
                <div className="ot-simple-grid">{displayCompleted.map((item) => <SimpleCard key={item[0]} item={item} completed />)}</div>
              </section>
            </section>

            <aside className="ot-utilities" aria-label="Ações rápidas">
              <section className="ot-panel ot-podcast-panel">
                <h2 className="ot-panel-heading"><Mic2 /> Podcasts para ouvir</h2>
                <label className="ot-link-input"><input placeholder="Cole o link de um episódio do Spotify ou YouTube" aria-label="Link de episódio" /><Link2 /></label>
                <div className="ot-podcast-info"><div className="ot-podcast-cover"><img src={ASSET.podcast} alt="Capa do podcast The Daily Byte" /></div><div><p className="ot-podcast-name">The Daily Byte</p><p className="ot-platform"><HeartPulse /> Spotify</p><p className="ot-duration"><Clock3 /> 1h 42min</p></div></div>
                <div className="ot-podcast-progress"><div className="ot-mini-track" style={{ "--progress-width": "62%" } as React.CSSProperties}><span /></div><strong>62%</strong></div>
                <div className="ot-podcast-actions">
                  <button className="ot-podcast-action is-complete" type="button"><Check /> Marcar como ouvido</button>
                  <button className="ot-podcast-action" type="button"><Clock3 /> Salvar para depois</button>
                  <button className="ot-podcast-action is-listening" type="button"><Play /> Ouvindo agora</button>
                </div>
                <a className="ot-external-link" href="#spotify">Abrir no Spotify <ExternalLink /></a>
              </section>

              <section className="ot-panel ot-import-panel">
                <div className="ot-import-header">
                  <div>
                    <h2 className="ot-import-title"><ArchiveRestore /> Importações Locais</h2>
                    <p className="ot-import-copy">Selecione seu backup do Trakt (JSON) ou AntennaPod (.db)</p>
                  </div>
                </div>
                <div className="ot-dropzone" style={{ position: 'relative', cursor: 'pointer' }}>
                  <input 
                    type="file" 
                    accept=".json,.db" 
                    multiple 
                    style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }}
                    onChange={async (e) => {
                      if (!e.target.files) return;
                      const files = Array.from(e.target.files);
                      let totalImported = 0;
                      
                      for (const file of files) {
                        const isAntennaPod = file.name.endsWith('.db');
                        const isWatchlist = file.name.toLowerCase().includes('watchlist');
                        const status = isWatchlist ? 'planned' : 'completed';
                        
                        try {
                          let itemsToImport = [];
                          if (isAntennaPod) {
                            const { parseAntennaPodDB } = await import("../lib/import-antennapod");
                            itemsToImport = await parseAntennaPodDB(file);
                          } else {
                            const { parseTraktFile } = await import("../lib/import-trakt");
                            itemsToImport = await parseTraktFile(file, status);
                          }
                          
                          if(itemsToImport.length > 0) {
                             await addMultipleItems(itemsToImport);
                             totalImported += itemsToImport.length;
                          }
                        } catch(err) {
                           alert('Erro ao ler arquivo ' + file.name + ': ' + err);
                        }
                      }
                      if (totalImported > 0) {
                        alert(`Sucesso! ${totalImported} itens importados para o seu Banco de Dados Local!`);
                      }
                    }}
                  />
                  {["Trakt: watched.json / watchlist.json", "AntennaPod: backup.db"].map((label) => <div className="ot-file" key={label}><span className="ot-file-icon"><FileJson2 /></span><span>{label}</span></div>)}
                </div>
              </section>
            </aside>
          </div>
        </main>
      </div>
      <nav className="ot-mobile-nav" aria-label="Navegação móvel"><button className="is-active" type="button" aria-label="Biblioteca"><LayoutGrid /></button><button type="button" aria-label="Podcasts"><Headphones /></button><button type="button" aria-label="Adicionar"><Plus /></button><button type="button" aria-label="Listas"><ListVideo /></button><button type="button" aria-label="YouTube"><Youtube /></button></nav>
    </div>
  );
}

import React, { useState } from "react";
import { Mic2, Link2, HeartPulse, Clock3, Check, Play, ExternalLink, Youtube, X } from "lucide-react";
import { useMedia } from "../contexts/MediaContext";

export default function PodcastAdder() {
  const { addOrUpdateItem } = useMedia();
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [podcastInfo, setPodcastInfo] = useState<{
    title: string;
    platform: "Spotify" | "YouTube" | "Outro";
    image: string;
    author?: string;
  } | null>(null);

  const fetchMetadata = async (targetUrl: string) => {
    setIsLoading(true);
    try {
      let platform: "Spotify" | "YouTube" | "Outro" = "Outro";
      let oembedUrl = "";

      if (targetUrl.includes("spotify.com")) {
        platform = "Spotify";
        oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(targetUrl)}`;
      } else if (targetUrl.includes("youtube.com") || targetUrl.includes("youtu.be")) {
        platform = "YouTube";
        oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(targetUrl)}&format=json`;
      } else {
        throw new Error("Plataforma não suportada nativamente para busca de dados.");
      }

      // Usando allorigins para bypassar o CORS do front-end
      const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(oembedUrl)}`;
      const response = await fetch(proxyUrl);
      const data = await response.json();
      const parsed = JSON.parse(data.contents);

      setPodcastInfo({
        title: parsed.title || "Episódio Desconhecido",
        platform,
        image: parsed.thumbnail_url || "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=900&q=86",
        author: parsed.author_name || parsed.provider_name
      });
    } catch (err) {
      console.warn("Erro ao buscar metadados:", err);
      // Fallback manual se falhar a rede ou proxy
      setPodcastInfo({
        title: "Episódio " + (targetUrl.includes("spotify") ? "do Spotify" : targetUrl.includes("youtu") ? "do YouTube" : "Link"),
        platform: targetUrl.includes("spotify") ? "Spotify" : targetUrl.includes("youtu") ? "YouTube" : "Outro",
        image: "https://images.unsplash.com/photo-1478737270239-2f02b77fc618?auto=format&fit=crop&w=900&q=86"
      });
    }
    setIsLoading(false);
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData("text");
    if (pastedText.startsWith("http")) {
      setUrl(pastedText);
      fetchMetadata(pastedText);
    }
  };

  const handleAction = async (status: "completed" | "planned" | "watching") => {
    if (!podcastInfo) return;
    
    await addOrUpdateItem({
      id: "podcast_" + Date.now(),
      type: "podcast",
      status: status,
      title: podcastInfo.title,
      posterUrl: podcastInfo.image,
      addedAt: Date.now(),
      source: "link",
      year: podcastInfo.author
    });
    
    setPodcastInfo(null);
    setUrl("");
    alert("Podcast salvo na sua biblioteca!");
  };

  return (
    <section className="ot-panel">
      <h2 className="ot-panel-heading"><Mic2 /> Adicionar via Link</h2>
      
      <label className="ot-link-input">
        <input 
          placeholder="Cole o link do Spotify ou YouTube aqui..." 
          aria-label="Link de episódio" 
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onPaste={handlePaste}
        />
        <Link2 />
      </label>

      {isLoading && <p style={{ fontSize: '0.85rem', color: 'var(--ot-slate-light)', marginTop: 8 }}>Buscando informações do link...</p>}

      {podcastInfo && !isLoading && (
        <>
          <div className="ot-podcast-info mt-4" style={{ marginTop: 16 }}>
            <div className="ot-podcast-cover">
              <img src={podcastInfo.image} alt="Capa" />
            </div>
            <div>
              <p className="ot-podcast-name">{podcastInfo.title}</p>
              <p className="ot-platform">
                {podcastInfo.platform === "Spotify" ? <HeartPulse /> : <Youtube />} 
                {podcastInfo.platform}
              </p>
              <p className="ot-duration" style={{ fontSize: '0.8rem', opacity: 0.8 }}>
                {podcastInfo.author}
              </p>
            </div>
            <button className="ot-button" style={{ marginLeft: 'auto', background: 'transparent', padding: 4 }} onClick={() => { setPodcastInfo(null); setUrl(""); }}>
              <X size={16} />
            </button>
          </div>

          <div className="ot-podcast-actions" style={{ marginTop: 16 }}>
            <button className="ot-podcast-action is-complete" type="button" onClick={() => handleAction('completed')}>
              <Check /> Salvar como ouvido
            </button>
            <button className="ot-podcast-action" type="button" onClick={() => handleAction('planned')}>
              <Clock3 /> Salvar para depois
            </button>
          </div>
        </>
      )}
    </section>
  );
}

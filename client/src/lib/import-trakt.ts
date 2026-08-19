import { MediaItem, MediaStatus, MediaType } from "./db";

// Tipos básicos que costumam vir nos exports JSON do Trakt
interface TraktItem {
  type?: string;
  movie?: { title: string; year?: number; ids?: { trakt?: number; tmdb?: number; imdb?: string } };
  show?: { title: string; year?: number; ids?: { trakt?: number; tmdb?: number; imdb?: string } };
  episode?: { season: number; number: number; title: string };
  plays?: number;
  last_watched_at?: string;
  listed_at?: string;
}

export async function parseTraktFile(file: File, targetStatus: MediaStatus): Promise<MediaItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        const data: TraktItem[] = JSON.parse(content);
        
        const mediaItems: MediaItem[] = [];
        
        // Muitos backups vêm em array. Se for objeto com chaves, tentamos extrair os arrays.
        const itemsToProcess = Array.isArray(data) ? data : (data as any).movies || (data as any).shows || [];

        itemsToProcess.forEach((item: TraktItem) => {
          const isMovie = item.type === 'movie' || item.movie !== undefined;
          const isShow = item.type === 'show' || item.type === 'episode' || item.show !== undefined;
          
          const media = item.movie || item.show;
          if (!media) return;

          const id = media.ids?.trakt?.toString() || media.ids?.tmdb?.toString() || media.ids?.imdb || String(Math.random());
          
          mediaItems.push({
            id: `trakt_${id}`,
            type: isMovie ? 'movie' : 'show',
            status: targetStatus,
            title: media.title,
            year: media.year ? media.year.toString() : undefined,
            addedAt: item.last_watched_at ? new Date(item.last_watched_at).getTime() : 
                     item.listed_at ? new Date(item.listed_at).getTime() : Date.now(),
            source: 'trakt',
            progress: targetStatus === 'completed' ? 100 : 0
          });
        });
        
        resolve(mediaItems);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}

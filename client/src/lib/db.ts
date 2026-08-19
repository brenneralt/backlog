export type MediaType = 'movie' | 'show' | 'anime' | 'book' | 'game' | 'podcast';
export type MediaStatus = 'watching' | 'planned' | 'completed' | 'on_hold' | 'dropped';

export interface MediaItem {
  id: string; // ID único (do Trakt, AniList ou gerado)
  type: MediaType;
  status: MediaStatus;
  title: string;
  year?: string;
  posterUrl?: string;
  progress?: number; // progresso atual (ex: epi 5)
  total?: number; // total (ex: 12 episódios)
  duration?: string; // ex: "1h 45m" (útil para podcasts)
  rating?: number; // nota do usuário
  addedAt: number; // timestamp
  source?: string; // origem, ex: 'trakt', 'antennapod', 'manual'
}

const DB_NAME = 'OmniTrackDB';
const DB_VERSION = 1;
const STORE_MEDIA = 'media_items';

// Abre ou cria o banco de dados IndexedDB
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_MEDIA)) {
        db.createObjectStore(STORE_MEDIA, { keyPath: 'id' });
      }
    };
  });
}

// Carrega todos os itens da biblioteca
export async function getAllMedia(): Promise<MediaItem[]> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readonly');
    const store = tx.objectStore(STORE_MEDIA);
    const request = store.getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// Salva um ou mais itens (cria ou atualiza)
export async function saveMedia(items: MediaItem[]): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    const store = tx.objectStore(STORE_MEDIA);
    items.forEach(item => store.put(item));
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Remove um item da biblioteca
export async function deleteMedia(id: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_MEDIA, 'readwrite');
    const store = tx.objectStore(STORE_MEDIA);
    store.delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

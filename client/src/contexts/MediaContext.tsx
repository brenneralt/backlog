import React, { createContext, useContext, useState, useEffect } from 'react';
import { getAllMedia, saveMedia, deleteMedia, MediaItem, MediaStatus, MediaType } from '../lib/db';

export type { MediaItem, MediaStatus, MediaType };

interface MediaContextType {
  items: MediaItem[];
  isLoading: boolean;
  addOrUpdateItem: (item: MediaItem) => Promise<void>;
  addMultipleItems: (items: MediaItem[]) => Promise<void>;
  removeItem: (id: string) => Promise<void>;
}

const MediaContext = createContext<MediaContextType | undefined>(undefined);

export function MediaProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getAllMedia().then(data => {
      setItems(data);
      setIsLoading(false);
    }).catch(err => {
      console.error("Erro ao carregar do IndexedDB:", err);
      setIsLoading(false);
    });
  }, []);

  const addOrUpdateItem = async (item: MediaItem) => {
    await saveMedia([item]);
    setItems(prev => {
      const idx = prev.findIndex(i => i.id === item.id);
      if (idx >= 0) {
        const newItems = [...prev];
        newItems[idx] = item;
        return newItems;
      }
      return [...prev, item];
    });
  };

  const addMultipleItems = async (newItems: MediaItem[]) => {
    await saveMedia(newItems);
    setItems(prev => {
      const map = new Map(prev.map(i => [i.id, i]));
      newItems.forEach(item => map.set(item.id, item));
      return Array.from(map.values());
    });
  };

  const removeItem = async (id: string) => {
    await deleteMedia(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  return (
    <MediaContext.Provider value={{ items, isLoading, addOrUpdateItem, addMultipleItems, removeItem }}>
      {children}
    </MediaContext.Provider>
  );
}

export function useMedia() {
  const context = useContext(MediaContext);
  if (!context) throw new Error("useMedia deve ser usado dentro de um MediaProvider");
  return context;
}

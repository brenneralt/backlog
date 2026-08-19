import initSqlJs from 'sql.js';
import { MediaItem } from './db';

export async function parseAntennaPodDB(file: File): Promise<MediaItem[]> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const uInt8Array = new Uint8Array(e.target?.result as ArrayBuffer);
        const SQL = await initSqlJs({
          // Puxa o arquivo WASM diretamente do CDN para rodar o SQLite no navegador
          locateFile: file => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/sql-wasm.wasm`
        });
        
        const db = new SQL.Database(uInt8Array);
        
        // Query para extrair os episódios ouvidos (has_been_played = 1) ou em progresso (position > 0)
        const query = `
          SELECT 
            f.title as podcast_title, 
            f.image_url as poster_url, 
            i.title as episode_title, 
            m.duration, 
            m.position, 
            m.has_been_played 
          FROM FeedItems i
          JOIN Feeds f ON i.feed = f.id
          JOIN FeedMedia m ON i.id = m.feeditem
          WHERE m.has_been_played = 1 OR m.position > 0
        `;
        
        let results;
        try {
          results = db.exec(query);
        } catch (err) {
          return reject("O arquivo não parece ser um banco de dados válido do AntennaPod.");
        }

        if (results.length === 0) {
          db.close();
          return resolve([]);
        }

        const columns = results[0].columns;
        const values = results[0].values;
        
        const mediaItems: MediaItem[] = values.map(row => {
          // Transforma a linha do banco em um objeto
          const rowData = columns.reduce((acc, col, index) => {
            acc[col] = row[index];
            return acc;
          }, {} as any);
          
          const isCompleted = rowData.has_been_played === 1;
          const progressPercent = rowData.duration > 0 ? Math.floor((rowData.position / rowData.duration) * 100) : 0;
          
          return {
            id: `antennapod_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: 'podcast',
            status: isCompleted ? 'completed' : 'watching',
            title: `${rowData.podcast_title} - ${rowData.episode_title}`,
            posterUrl: rowData.poster_url,
            progress: isCompleted ? 100 : progressPercent,
            addedAt: Date.now(),
            source: 'antennapod'
          };
        });
        
        db.close();
        resolve(mediaItems);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsArrayBuffer(file);
  });
}

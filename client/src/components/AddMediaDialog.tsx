import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useMedia, MediaType } from "../contexts/MediaContext";

export default function AddMediaDialog({ children }: { children: React.ReactNode }) {
  const { addOrUpdateItem } = useMedia();
  const [open, setOpen] = useState(false);
  
  const [title, setTitle] = useState("");
  const [type, setType] = useState<MediaType>("movie");
  const [status, setStatus] = useState<"planned" | "watching" | "completed">("planned");
  const [year, setYear] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    await addOrUpdateItem({
      id: "manual_" + Date.now(),
      type,
      status,
      title: title.trim(),
      year: year.trim() || undefined,
      addedAt: Date.now(),
      source: "manual",
      posterUrl: "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=300&q=86" // fallback
    });

    setOpen(false);
    setTitle("");
    setYear("");
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-900 text-slate-100 border-slate-800">
        <DialogHeader>
          <DialogTitle>Adicionar Mídia Manualmente</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 mt-4">
          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Título</label>
            <input 
              required
              type="text" 
              value={title}
              onChange={e => setTitle(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              placeholder="Ex: O Senhor dos Anéis"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Tipo</label>
              <select 
                value={type} 
                onChange={e => setType(e.target.value as MediaType)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
              >
                <option value="movie">Filme</option>
                <option value="show">Série</option>
                <option value="anime">Anime</option>
                <option value="book">Livro</option>
                <option value="game">Jogo</option>
                <option value="podcast">Podcast</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Ano / Info</label>
              <input 
                type="text" 
                value={year}
                onChange={e => setYear(e.target.value)}
                className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
                placeholder="Ex: 2023"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-400 mb-1">Status</label>
            <select 
              value={status} 
              onChange={e => setStatus(e.target.value as any)}
              className="w-full bg-slate-800 border border-slate-700 rounded-md px-3 py-2 text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value="planned">Quero assistir / Salvo</option>
              <option value="watching">Assistindo agora</option>
              <option value="completed">Concluído</option>
            </select>
          </div>

          <div className="pt-4">
            <Button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white">
              Salvar na Biblioteca
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Dices, Play } from "lucide-react";
import { useMedia } from "../contexts/MediaContext";

export default function RouletteDialog({ children }: { children: React.ReactNode }) {
  const { items } = useMedia();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<any>(null);
  const [isSpinning, setIsSpinning] = useState(false);

  const spin = () => {
    setIsSpinning(true);
    setSelected(null);
    const plannedItems = items.filter(i => i.status === 'planned');
    
    if (plannedItems.length === 0) {
      setTimeout(() => {
        setIsSpinning(false);
      }, 500);
      return;
    }

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * plannedItems.length);
      setSelected(plannedItems[randomIndex]);
      setIsSpinning(false);
    }, 1500); // 1.5s suspense
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (newOpen) {
      setSelected(null);
      setIsSpinning(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md bg-slate-900 text-slate-100 border-slate-800">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2"><Dices className="text-indigo-400" /> Roleta do Backlog</DialogTitle>
          <DialogDescription className="text-slate-400">
            Não sabe o que assistir ou jogar? Deixe a sorte escolher por você a partir da sua fila!
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center py-8 min-h-[200px]">
          {isSpinning ? (
            <div className="animate-spin text-indigo-500 mb-4">
              <Dices size={48} />
            </div>
          ) : selected ? (
            <div className="text-center animate-in zoom-in duration-300">
              <div className="mb-4 w-32 h-48 mx-auto rounded-md overflow-hidden border-2 border-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.5)]">
                <img src={selected.posterUrl || "https://images.unsplash.com/photo-1536440136628-849c177e76a1?auto=format&fit=crop&w=300&q=86"} alt="Capa" className="w-full h-full object-cover" />
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{selected.title}</h3>
              <p className="text-slate-400 text-sm mb-4">{selected.type.toUpperCase()} • {selected.year}</p>
            </div>
          ) : (
             <div className="text-slate-500 flex flex-col items-center">
               <Dices size={48} className="mb-4 opacity-50" />
               <p>{items.filter(i => i.status === 'planned').length === 0 ? "Sua fila (Watchlist) está vazia!" : "Clique no botão para rodar."}</p>
             </div>
          )}
        </div>

        <div className="flex justify-center mt-4">
          <Button 
            onClick={spin} 
            disabled={isSpinning || items.filter(i => i.status === 'planned').length === 0}
            className="bg-indigo-600 hover:bg-indigo-700 text-white w-full"
          >
            {isSpinning ? "Sorteando..." : selected ? "Rodar novamente" : "Rodar a Roleta!"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

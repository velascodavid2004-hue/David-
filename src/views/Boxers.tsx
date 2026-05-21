import React, { useState, useEffect } from 'react';
import { Users, Plus, Search, X, User, Award, Dumbbell, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection, createDocument, deleteDocumentData } from '../lib/firestore';
import { Boxer, Gym, WeightClass } from '../types';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';

const WEIGHT_CLASSES: WeightClass[] = [
  'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Wélter', 'Medio', 'Semipesado', 'Pesado'
];

export default function Boxers() {
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newBoxer, setNewBoxer] = useState({
    name: '',
    weightClass: 'Ligero' as WeightClass,
    gymId: '',
    cornerColor: 'Rojo',
  });

  useEffect(() => {
    const unsubB = subscribeToCollection<Boxer>('boxers', (data) => {
      setBoxers(data);
      setLoading(false);
    });
    const unsubG = subscribeToCollection<Gym>('gyms', setGyms);
    return () => { unsubB(); unsubG(); };
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const boxerData: Omit<Boxer, 'id'> = {
      ...newBoxer,
      cornerColor: newBoxer.cornerColor || 'Rojo',
      wins: 0,
      losses: 0,
      draws: 0,
      rankingPoints: 1000,
      userId: auth.currentUser.uid,
    };

    await createDocument('boxers', boxerData);
    setIsModalOpen(false);
    setNewBoxer({ name: '', weightClass: 'Ligero', gymId: '' });
  };

  const handleDelete = async (e: React.MouseEvent, boxerId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (confirmDeleteId !== boxerId) {
      setConfirmDeleteId(boxerId);
      return;
    }

    setDeletingId(boxerId);
    setError(null);

    try {
      await deleteDocumentData('boxers', boxerId);
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error("Error deleting boxer:", error);
      setError(`Error: ${error.message}`);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredBoxers = boxers.filter(b => 
    b.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl text-xs font-bold font-mono overflow-auto max-h-40">
          <p>{error}</p>
        </div>
      )}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold text-white tracking-tight flex items-center gap-3">
            <Users className="text-blue-500 w-8 h-8" />
            Boxeadores
          </h1>
          <p className="text-zinc-500">Ranking y perfiles de boxeadores amateur.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-600/20"
        >
          <Plus className="w-5 h-5" />
          Registrar Boxeador
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar boxeadores por nombre..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-zinc-900/40 border border-zinc-800 rounded-2xl animate-pulse" />
          ))
        ) : filteredBoxers.sort((a,b) => b.rankingPoints - a.rankingPoints).map((boxer, index) => (
          <motion.div 
            key={boxer.id} 
            layout
            className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6 hover:border-blue-500/50 transition-all group relative overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-4">
              <span className="text-4xl font-black text-white/5 italic">#{index + 1}</span>
            </div>

            <div className="flex items-center gap-4">
              <div className="bg-blue-500/10 p-4 rounded-2xl group-hover:bg-blue-500/20 transition-colors">
                <User className="text-blue-500 w-6 h-6" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-white">{boxer.name}</h3>
                <div className="flex items-center gap-2">
                  <p className="text-zinc-500 text-xs uppercase tracking-widest font-medium">{boxer.weightClass}</p>
                  {boxer.cornerColor && (
                    <span className="flex items-center gap-1">
                      <span className="w-2 h-2 rounded-full" style={{ backgroundColor: 
                        boxer.cornerColor.toLowerCase() === 'rojo' ? '#ef4444' : 
                        boxer.cornerColor.toLowerCase() === 'azul' ? '#3b82f6' : 
                        boxer.cornerColor.toLowerCase() === 'blanco' ? '#ffffff' : 
                        boxer.cornerColor.toLowerCase() === 'negro' ? '#18181b' : 
                        boxer.cornerColor.toLowerCase() === 'verde' ? '#22c55e' : 
                        boxer.cornerColor.toLowerCase() === 'amarillo' ? '#eab308' : '#71717a' }} />
                      <span className="text-[10px] text-zinc-500 font-bold uppercase">{boxer.cornerColor}</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="bg-zinc-800/50 p-3 rounded-xl">
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Ranking</p>
                <p className="text-white font-bold text-lg">{boxer.rankingPoints} <span className="text-xs font-normal text-zinc-500">pts</span></p>
              </div>
              <div className="bg-zinc-800/50 p-3 rounded-xl">
                <p className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">Record</p>
                <p className="text-white font-bold text-lg">{boxer.wins}W - {boxer.losses}L</p>
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-zinc-500 text-xs">
              <div className="flex items-center gap-1.5">
                <Dumbbell className="w-3 h-3" />
                {gyms.find(g => g.id === boxer.gymId)?.name || 'Independiente'}
              </div>
              <Award className="w-4 h-4 text-yellow-500/50" />
            </div>

            {auth.currentUser && (
              <div className="absolute top-2 right-2 flex gap-1">
                {confirmDeleteId === boxer.id && (
                  <button 
                    onClick={() => setConfirmDeleteId(null)}
                    className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-all z-10"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button
                  onClick={(e) => handleDelete(e, boxer.id)}
                  disabled={deletingId === boxer.id}
                  className={cn(
                    "p-2 rounded-lg transition-all z-10",
                    confirmDeleteId === boxer.id 
                      ? "bg-red-600 text-white animate-pulse" 
                      : "bg-red-600/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white"
                  )}
                  title={confirmDeleteId === boxer.id ? "Confirmar eliminación" : "Eliminar boxeador"}
                >
                  {deletingId === boxer.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
          </motion.div>
        ))}
        {filteredBoxers.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
            No se encontraron boxeadores.
          </div>
        )}
      </div>

      {/* Create Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">Registrar Boxeador</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Nombre Completo</label>
                  <input 
                    required
                    type="text" 
                    value={newBoxer.name}
                    onChange={(e) => setNewBoxer({...newBoxer, name: e.target.value})}
                    placeholder="Ej: Juan Pérez"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Categoría de Peso</label>
                    <select 
                      value={newBoxer.weightClass}
                      onChange={(e) => setNewBoxer({...newBoxer, weightClass: e.target.value as WeightClass})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      {WEIGHT_CLASSES.map(wc => (
                        <option key={wc} value={wc}>{wc}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Color de Trusa/Esquina</label>
                    <select 
                      value={newBoxer.cornerColor}
                      onChange={(e) => setNewBoxer({...newBoxer, cornerColor: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                    >
                      <option value="Rojo">Rojo</option>
                      <option value="Azul">Azul</option>
                      <option value="Blanco">Blanco</option>
                      <option value="Negro">Negro</option>
                      <option value="Verde">Verde</option>
                      <option value="Amarillo">Amarillo</option>
                    </select>
                    <p className="text-[10px] text-zinc-600 italic">Ayuda a la IA a identificarlo en el video.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Gimnasio</label>
                  <select 
                    value={newBoxer.gymId}
                    onChange={(e) => setNewBoxer({...newBoxer, gymId: e.target.value})}
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-500/50"
                  >
                    <option value="">Independiente</option>
                    {gyms.map(gym => (
                      <option key={gym.id} value={gym.id}>{gym.name}</option>
                    ))}
                  </select>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-600/20 mt-4"
                >
                  Registrar Boxeador
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

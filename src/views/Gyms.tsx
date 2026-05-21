import React, { useState, useEffect } from 'react';
import { Dumbbell, Plus, MapPin, Search, X, Building2, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection, createDocument, deleteDocumentData } from '../lib/firestore';
import { Gym } from '../types';
import { auth } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function Gyms() {
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newGym, setNewGym] = useState({
    name: '',
    location: '',
  });

  useEffect(() => {
    const unsub = subscribeToCollection<Gym>('gyms', (data) => {
      setGyms(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const gymData: Omit<Gym, 'id'> = {
      ...newGym,
      ownerId: auth.currentUser.uid,
      createdAt: new Date().toISOString(),
    };

    await createDocument('gyms', gymData);
    setIsModalOpen(false);
    setNewGym({ name: '', location: '' });
  };

  const handleDelete = async (e: React.MouseEvent, gymId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirmDeleteId !== gymId) {
      setConfirmDeleteId(gymId);
      return;
    }

    setDeletingId(gymId);
    setError(null);
    try {
      await deleteDocumentData('gyms', gymId);
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error("Error deleting gym:", error);
      setError(`Error: ${error.message}`);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredGyms = gyms.filter(g => 
    g.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    g.location.toLowerCase().includes(searchTerm.toLowerCase())
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
            <Dumbbell className="text-emerald-500 w-8 h-8" />
            Gimnasios
          </h1>
          <p className="text-zinc-500">Gimnasios y clubes de boxeo afiliados.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-600/20"
        >
          <Plus className="w-5 h-5" />
          Registrar Gimnasio
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar gimnasios por nombre o ubicación..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-64 bg-zinc-900/40 border border-zinc-800 rounded-2xl animate-pulse" />
          ))
        ) : filteredGyms.map(gym => (
          <motion.div 
            key={gym.id} 
            layout
            className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-6 space-y-6 hover:border-emerald-500/50 transition-all group"
          >
            <div className="flex items-start justify-between">
              <div className="bg-emerald-500/10 p-4 rounded-2xl group-hover:bg-emerald-500/20 transition-colors">
                <Building2 className="text-emerald-500 w-8 h-8" />
              </div>
              <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest">Est. {new Date(gym.createdAt).getFullYear()}</span>
                {auth.currentUser && (
                  <div className="flex gap-1 justify-end">
                    {confirmDeleteId === gym.id && (
                      <button 
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                        className="p-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-all z-10"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={(e) => handleDelete(e, gym.id)}
                      disabled={deletingId === gym.id}
                      className={cn(
                        "p-2 rounded-lg transition-all z-10",
                        confirmDeleteId === gym.id 
                          ? "bg-red-600 text-white animate-pulse" 
                          : "bg-red-600/10 text-red-500 opacity-0 group-hover:opacity-100 hover:bg-red-600 hover:text-white"
                      )}
                      title={confirmDeleteId === gym.id ? "Confirmar eliminación" : "Eliminar gimnasio"}
                    >
                      {deletingId === gym.id ? (
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-xl font-bold text-white">{gym.name}</h3>
              <div className="flex items-center gap-2 text-zinc-500 text-sm">
                <MapPin className="w-4 h-4" />
                {gym.location}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-800 flex items-center justify-between text-zinc-500 text-xs">
              <span>Gimnasio Afiliado</span>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                Activo
              </div>
            </div>
          </motion.div>
        ))}
        {filteredGyms.length === 0 && (
          <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
            No se encontraron gimnasios.
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
                <h2 className="text-2xl font-bold text-white">Registrar Gimnasio</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Nombre del Gimnasio</label>
                  <input 
                    required
                    type="text" 
                    value={newGym.name}
                    onChange={(e) => setNewGym({...newGym, name: e.target.value})}
                    placeholder="Ej: Boxing Club Central"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Ubicación / Ciudad</label>
                  <input 
                    required
                    type="text" 
                    value={newGym.location}
                    onChange={(e) => setNewGym({...newGym, location: e.target.value})}
                    placeholder="Ej: Madrid, España"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                  />
                </div>

                <button 
                  type="submit"
                  className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-emerald-600/20 mt-4"
                >
                  Registrar Gimnasio
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

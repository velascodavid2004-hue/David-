import React, { useState, useEffect } from 'react';
import { Trophy, Plus, Search, Calendar, Users, ChevronRight, X, Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { subscribeToCollection, createDocument, deleteDocumentData, getCollection } from '../lib/firestore';
import { Tournament, WeightClass, Match } from '../types';
import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';
import { where } from 'firebase/firestore';
import { cn } from '../lib/utils';

const WEIGHT_CLASSES: WeightClass[] = [
  'Mosca', 'Gallo', 'Pluma', 'Ligero', 'Wélter', 'Medio', 'Semipesado', 'Pesado'
];

export default function Tournaments() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [newTournament, setNewTournament] = useState({
    name: '',
    weightClass: 'Ligero' as WeightClass,
    startDate: new Date().toISOString().split('T')[0],
  });

  useEffect(() => {
    const unsub = subscribeToCollection<Tournament>('tournaments', (data) => {
      setTournaments(data);
      setLoading(false);
    });
    return unsub;
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;

    const tournamentData: Omit<Tournament, 'id'> = {
      ...newTournament,
      status: 'open',
      organizerId: auth.currentUser.uid,
      participants: [],
      startDate: new Date(newTournament.startDate).toISOString(),
    };

    await createDocument('tournaments', tournamentData);
    setIsModalOpen(false);
    setNewTournament({
      name: '',
      weightClass: 'Ligero',
      startDate: new Date().toISOString().split('T')[0],
    });
  };

  const handleDelete = async (e: React.MouseEvent, tournamentId: string) => {
    e.preventDefault();
    e.stopPropagation();

    if (confirmDeleteId !== tournamentId) {
      setConfirmDeleteId(tournamentId);
      return;
    }

    setDeletingId(tournamentId);
    setError(null);

    try {
      // Intento borrar los matches asociados, pero si falla (ej. por falta de índice), continúo con el torneo
      try {
        const matchesData = await getCollection<Match>('matches', where('tournamentId', '==', tournamentId));
        for (const match of matchesData) {
          await deleteDocumentData('matches', match.id);
        }
      } catch (matchError) {
        console.warn("No se pudieron borrar todos los matches automáticamente:", matchError);
      }

      // Borrar el torneo
      await deleteDocumentData('tournaments', tournamentId);
      setConfirmDeleteId(null);
    } catch (error: any) {
      console.error("Error deleting tournament:", error);
      setError(`Error: ${error.message}`);
      setConfirmDeleteId(null);
    } finally {
      setDeletingId(null);
    }
  };

  const filteredTournaments = tournaments.filter(t => 
    t.name.toLowerCase().includes(searchTerm.toLowerCase())
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
            <Trophy className="text-red-500 w-8 h-8" />
            Torneos
          </h1>
          <p className="text-zinc-500">Gestiona y participa en las ligas de boxeo.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-600/20"
        >
          <Plus className="w-5 h-5" />
          Crear Torneo
        </button>
      </header>

      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-zinc-500 w-5 h-5" />
        <input 
          type="text" 
          placeholder="Buscar torneos..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full bg-zinc-900/50 border border-zinc-800 rounded-2xl py-4 pl-12 pr-6 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50 transition-all"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-80 bg-zinc-900/40 border border-zinc-800 rounded-3xl animate-pulse" />
          ))
        ) : filteredTournaments.length > 0 ? filteredTournaments.map(tournament => (
          <div key={tournament.id} className="relative group">
            <Link 
              to={`/tournaments/${tournament.id}`}
              className="block bg-zinc-900/40 border border-zinc-800 rounded-3xl overflow-hidden hover:border-red-600/50 transition-all duration-300 h-full"
            >
              <div className="h-40 bg-zinc-950 p-6 flex flex-col justify-end relative overflow-hidden">
                {/* Decorative background for different statuses */}
                <div className={cn(
                  "absolute inset-0 opacity-20",
                  tournament.status === 'completed' ? "bg-emerald-600" : 
                  tournament.status === 'active' ? "bg-red-600" : "bg-blue-600"
                )} />
                
                <div className="relative z-10 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
                      <Trophy className={cn(
                        "w-6 h-6",
                        tournament.status === 'completed' ? "text-emerald-400" : 
                        tournament.status === 'active' ? "text-red-400" : "text-blue-400"
                      )} />
                    </div>
                    <span className={cn(
                      "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border",
                      tournament.status === 'active' ? 'bg-red-500/10 text-red-500 border-red-500/20' : 
                      tournament.status === 'open' ? 'bg-blue-500/10 text-blue-500 border-blue-500/20' : 
                      tournament.status === 'completed' ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20' : 
                      'bg-zinc-800 text-zinc-500 border-zinc-700'
                    )}>
                      {tournament.status === 'open' ? 'Inscripciones Abiertas' : 
                       tournament.status === 'active' ? 'En Curso' : 
                       tournament.status === 'completed' ? 'Finalizado' : tournament.status}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-xl font-black text-white leading-tight uppercase italic">{tournament.name}</h3>
                    <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-tighter">{tournament.weightClass}</p>
                  </div>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Fecha</p>
                    <div className="flex items-center gap-2 text-zinc-400 font-bold text-xs uppercase">
                      <Calendar className="w-3.5 h-3.5 text-zinc-600" />
                      {new Date(tournament.startDate).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-[8px] font-black text-zinc-600 uppercase tracking-widest">Participantes</p>
                    <div className="flex items-center gap-2 text-zinc-400 font-bold text-xs uppercase">
                      <Users className="w-3.5 h-3.5 text-zinc-600" />
                      {tournament.participants?.length || 0} Boxeadores
                    </div>
                  </div>
                </div>

                <div className="pt-6 border-t border-zinc-800/50 flex items-center justify-between">
                  <span className="text-[10px] font-black text-red-600 uppercase tracking-[0.2em] group-hover:translate-x-1 transition-transform">Ver Detalles</span>
                  <ChevronRight className="w-4 h-4 text-zinc-800 group-hover:text-red-600 transition-all" />
                </div>
              </div>
            </Link>

            {/* Quick Actions */}
            {auth.currentUser && (
              <div className="absolute top-4 right-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-all scale-95 group-hover:scale-100">
                {confirmDeleteId === tournament.id && (
                  <button 
                    onClick={(e) => { e.stopPropagation(); setConfirmDeleteId(null); }}
                    className="p-3 bg-zinc-800 text-white rounded-2xl shadow-xl hover:bg-zinc-700 transition-all border border-zinc-700"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
                <button 
                  onClick={(e) => handleDelete(e, tournament.id)}
                  disabled={deletingId === tournament.id}
                  className={cn(
                    "p-3 rounded-2xl shadow-xl transition-all border",
                    confirmDeleteId === tournament.id 
                      ? "bg-red-600 text-white border-red-400 animate-pulse" 
                      : "bg-red-600 text-white shadow-red-600/20 hover:bg-red-500 border-red-400/20"
                  )}
                  title={confirmDeleteId === tournament.id ? "Confirmar eliminación" : "Eliminar Torneo Definitivamente"}
                >
                  {deletingId === tournament.id ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>
            )}
            
            {tournament.status === 'completed' && auth.currentUser?.uid === tournament.organizerId && (
               <div className="absolute bottom-4 left-6 right-6 pointer-events-none">
                  <div className="bg-emerald-500 text-[8px] font-black text-black uppercase tracking-[0.2em] py-1 px-4 rounded-full text-center shadow-lg shadow-emerald-500/20 translate-y-10 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-500">
                    Torneo Concluido • Listo para Limpieza
                  </div>
               </div>
            )}
          </div>
        )) : (
          <div className="col-span-full py-20 bg-zinc-900/20 border-2 border-dashed border-zinc-800 rounded-[3rem] flex flex-col items-center justify-center gap-6">
            <div className="w-16 h-16 bg-zinc-800 rounded-3xl flex items-center justify-center">
              <Trophy className="w-8 h-8 text-zinc-700" />
            </div>
            <div className="text-center space-y-2">
              <h3 className="text-xl font-black text-white uppercase italic">Sin Torneos</h3>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-tight">No se encontraron torneos que coincidan con tu búsqueda.</p>
            </div>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-2xl transition-all uppercase text-[10px] tracking-widest"
            >
              Crear mi primer torneo
            </button>
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
                <h2 className="text-2xl font-bold text-white">Nuevo Torneo</h2>
                <button onClick={() => setIsModalOpen(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-zinc-400">Nombre del Torneo</label>
                  <input 
                    required
                    type="text" 
                    value={newTournament.name}
                    onChange={(e) => setNewTournament({...newTournament, name: e.target.value})}
                    placeholder="Ej: Copa Guantes de Oro"
                    className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Categoría de Peso</label>
                    <select 
                      value={newTournament.weightClass}
                      onChange={(e) => setNewTournament({...newTournament, weightClass: e.target.value as WeightClass})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    >
                      {WEIGHT_CLASSES.map(wc => (
                        <option key={wc} value={wc}>{wc}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-zinc-400">Fecha de Inicio</label>
                    <input 
                      required
                      type="date" 
                      value={newTournament.startDate}
                      onChange={(e) => setNewTournament({...newTournament, startDate: e.target.value})}
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-3 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-600/20 mt-4"
                >
                  Crear Torneo
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

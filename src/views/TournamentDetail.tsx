import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { 
  Trophy, 
  Users, 
  Calendar, 
  ChevronLeft, 
  Play, 
  CheckCircle2, 
  Clock,
  UserPlus,
  X,
  Award,
  Video,
  Upload,
  FileVideo,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  subscribeToDocument, 
  subscribeToCollection, 
  updateDocumentData, 
  createDocument,
  getCollection,
  deleteDocumentData
} from '../lib/firestore';
import { Tournament, Match, Boxer, WeightClass, Gym } from '../types';
import { generateInitialBracket, getRoundName } from '../lib/bracketUtils';
import { auth } from '../lib/firebase';
import { where } from 'firebase/firestore';
import { predictWinner } from '../services/aiService';
import { Brain, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

export default function TournamentDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [availableBoxers, setAvailableBoxers] = useState<Boxer[]>([]);
  const [isRegistering, setIsRegistering] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gyms, setGyms] = useState<Gym[]>([]);
  const [newBoxerName, setNewBoxerName] = useState('');
  const [selectedGymId, setSelectedGymId] = useState('');
  const [newBoxerColor, setNewBoxerColor] = useState('Rojo');
  const [aiReasoning, setAiReasoning] = useState<{ [matchId: string]: string }>({});
  const [isAiLoading, setIsAiLoading] = useState<{ [matchId: string]: boolean }>({});
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [matchVideos, setMatchVideos] = useState<{ [matchId: string]: { r1?: string; r2?: string; r3?: string } }>({});
  const [selectedMatchId, setSelectedMatchId] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    const unsubT = subscribeToDocument<Tournament>('tournaments', id, setTournament);
    const unsubM = subscribeToCollection<Match>('matches', (data) => {
      const matchData = data.filter(m => m.tournamentId === id);
      setMatches(matchData);
      
      // Update local video state from match documents if they have stored data
      const vids: { [matchId: string]: { r1?: string; r2?: string; r3?: string } } = {};
      matchData.forEach(m => {
        if (m.roundVideos) vids[m.id] = m.roundVideos;
      });
      setMatchVideos(prev => ({ ...prev, ...vids }));
    }, where('tournamentId', '==', id));
    const unsubB = subscribeToCollection<Boxer>('boxers', setBoxers);
    const unsubG = subscribeToCollection<Gym>('gyms', setGyms);
    return () => { unsubT(); unsubM(); unsubB(); unsubG(); };
  }, [id]);

  useEffect(() => {
    if (tournament && tournament.participants) {
      const filtered = boxers.filter(b => 
        b.weightClass === tournament.weightClass && 
        !tournament.participants.includes(b.id)
      );
      setAvailableBoxers(filtered);
    }
  }, [tournament, boxers]);

  const handleRegisterBoxer = async (boxerId: string) => {
    if (!tournament || !id) return;
    const participants = tournament.participants || [];
    const newParticipants = [...participants, boxerId];
    await updateDocumentData('tournaments', id, { participants: newParticipants });
  };

  const handleDirectRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tournament || !id || !newBoxerName) return;

    const boxerData: Omit<Boxer, 'id'> = {
      name: newBoxerName,
      gymId: selectedGymId,
      weightClass: tournament.weightClass,
      cornerColor: newBoxerColor,
      wins: 0,
      losses: 0,
      draws: 0,
      rankingPoints: 1000,
    };

    const newBoxerId = await createDocument('boxers', boxerData);
    if (newBoxerId) {
      await handleRegisterBoxer(newBoxerId);
      setNewBoxerName('');
      setSelectedGymId('');
    }
  };

  const handleStartTournament = async () => {
    if (!auth.currentUser) {
      setError("Debes iniciar sesión para realizar esta acción.");
      return;
    }

    if (!tournament || !id) {
      setError("No se pudo cargar la información del torneo.");
      return;
    }

    const participants = tournament.participants || [];
    if (participants.length < 2) {
      setError(`Se necesitan al menos 2 participantes. Actualmente hay ${participants.length}.`);
      return;
    }

    if (tournament.status !== 'open') {
      setError(`El torneo no se puede iniciar porque su estado es: ${tournament.status}`);
      return;
    }

    if (tournament.organizerId !== auth.currentUser.uid) {
      setError("Solo el organizador puede iniciar el torneo.");
      return;
    }
    
    setIsStarting(true);
    setError(null);

    try {
      // 1. Check if matches already exist
      const existingMatches = await getCollection<Match>('matches', where('tournamentId', '==', id));
      if (existingMatches.length > 0) {
        await updateDocumentData('tournaments', id, { status: 'active' });
        setIsStarting(false);
        return;
      }

      // 2. Generate bracket
      const initialMatches = generateInitialBracket(participants, id);
      if (!initialMatches || initialMatches.length === 0) {
        throw new Error("La generación de llaves devolvió un resultado vacío.");
      }
      
      // 3. Create matches sequentially to avoid overwhelming the connection
      for (let i = 0; i < initialMatches.length; i++) {
        const matchData = initialMatches[i];
        const matchToCreate = {
          ...matchData,
          status: matchData.status || 'scheduled',
          scheduledDate: matchData.scheduledDate || new Date().toISOString(),
        };
        
        const matchId = await createDocument('matches', matchToCreate);
        if (!matchId) {
          throw new Error(`Error al crear el enfrentamiento número ${i + 1}.`);
        }
      }

      // 4. Update tournament status
      await updateDocumentData('tournaments', id, { status: 'active' });
      
    } catch (err: any) {
      console.error("Error starting tournament:", err);
      let errorMessage = "Error al iniciar:";
      
      try {
        // Handle our custom Firestore error format
        const parsedError = JSON.parse(err.message);
        errorMessage += ` ${parsedError.error || 'Error desconocido de base de datos'}`;
        if (parsedError.path) errorMessage += ` (Ruta: ${parsedError.path})`;
      } catch (e) {
        // Handle standard error objects
        errorMessage += ` ${err.message || 'Error inesperado'}`;
      }
      
      setError(errorMessage);
    } finally {
      setIsStarting(false);
    }
  };

  const handleDelete = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!id || !tournament) return;
    
    if (!deleteConfirm) {
      setDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    setError(null);

    try {
      // Eliminar todos los combates asociados (si falla el fetch, seguimos adelante)
      try {
        const associatedMatches = await getCollection<Match>('matches', 
          where('tournamentId', '==', id)
        );
        for (const match of associatedMatches) {
          await deleteDocumentData('matches', match.id);
        }
      } catch (matchError: any) {
        console.warn('No se pudieron obtener o borrar todos los encuentros asociados:', matchError);
      }

      // Eliminar el torneo
      await deleteDocumentData('tournaments', id);
      
      // Redirigir a la lista de torneos
      navigate('/tournaments');
    } catch (error: any) {
      console.error('Error deleting tournament:', error);
      let msg = "Error al eliminar el torneo.";
      if (error.message) {
        msg = `ERROR CRÍTICO: ${error.message}`;
      }
      setError(msg);
      setDeleteConfirm(false);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleSetWinner = async (match: Match, winnerId: string) => {
    if (!id) return;

    // Update current match
    await updateDocumentData('matches', match.id, { 
      winnerId, 
      status: 'completed' 
    });

    // If it's the final, complete the tournament
    if (match.round === 1) {
      await updateDocumentData('tournaments', id, { status: 'completed' });
      // Award points to winner
      const winner = boxers.find(b => b.id === winnerId);
      if (winner) {
        await updateDocumentData('boxers', winnerId, { 
          rankingPoints: (winner.rankingPoints || 0) + 100,
          wins: (winner.wins || 0) + 1
        });
      }
      return;
    }

    // Find or create next round match
    const currentRound = Number(match.round);
    const nextRound = currentRound / 2;
    const nextMatchIndex = Math.floor(match.matchIndex / 2);
    
    const existingNextMatch = matches.find(m => 
      m.round === nextRound && m.matchIndex === nextMatchIndex
    );

    if (existingNextMatch) {
      const updateData: Partial<Match> = {};
      if (match.matchIndex % 2 === 0) {
        updateData.boxer1Id = winnerId;
      } else {
        updateData.boxer2Id = winnerId;
      }
      await updateDocumentData('matches', existingNextMatch.id, updateData);
    } else {
      const newMatch: Omit<Match, 'id'> = {
        tournamentId: id,
        boxer1Id: match.matchIndex % 2 === 0 ? winnerId : 'TBD',
        boxer2Id: match.matchIndex % 2 !== 0 ? winnerId : 'TBD',
        round: nextRound,
        matchIndex: nextMatchIndex,
        status: 'scheduled',
        scheduledDate: new Date().toISOString(),
      };
      await createDocument('matches', newMatch);
    }
  };

  const handleAiDecision = async (match: Match) => {
    const b1 = boxers.find(b => b.id === match.boxer1Id);
    const b2 = boxers.find(b => b.id === match.boxer2Id);

    if (!b1 || !b2 || match.boxer1Id === 'BYE' || match.boxer2Id === 'BYE' || match.boxer1Id === 'TBD' || match.boxer2Id === 'TBD') {
      setError("No se puede realizar un análisis de IA para este combate.");
      return;
    }

    setIsAiLoading(prev => ({ ...prev, [match.id]: true }));
    try {
      const videos = matchVideos[match.id] || {};
      const result = await predictWinner(b1, b2, videos);
      setAiReasoning(prev => ({ ...prev, [match.id]: result.reasoning }));
      
      // Save videos and decision to DB
      await updateDocumentData('matches', match.id, {
        roundVideos: videos
      });

      // Automatically set winner after AI decision
      await handleSetWinner(match, result.winnerId);
    } catch (err) {
      console.error("AI Decision error:", err);
      setError("Error al obtener la decisión de la IA.");
    } finally {
      setIsAiLoading(prev => ({ ...prev, [match.id]: false }));
    }
  };

  const handleVideoUpload = (matchId: string, file: File, roundKey: 'r1' | 'r2' | 'r3') => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setMatchVideos(prev => ({
        ...prev,
        [matchId]: {
          ...(prev[matchId] || {}),
          [roundKey]: base64
        }
      }));
    };
    reader.readAsDataURL(file);
  };

  if (error && !tournament) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
        <div className="bg-red-500/10 p-6 rounded-3xl border border-red-500/20">
          <X className="w-12 h-12 text-red-500" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-bold text-white">Error al cargar torneo</h2>
          <p className="text-zinc-500 max-w-md">{error}</p>
        </div>
        <Link to="/tournaments" className="text-red-500 font-bold hover:underline">Volver a Torneos</Link>
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="min-h-[50vh] flex items-center justify-center">
        <motion.div 
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full"
        />
      </div>
    );
  }

  const rounds = Array.from(new Set(matches.map(m => m.round))).sort((a, b) => (b as number) - (a as number)) as number[];

  return (
    <div className="space-y-10">
      <header className="space-y-6">
        <Link to="/tournaments" className="text-zinc-500 hover:text-white flex items-center gap-1 text-sm transition-colors">
          <ChevronLeft className="w-4 h-4" />
          Volver a Torneos
        </Link>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                tournament.status === 'active' ? 'bg-red-500/20 text-red-500' : 
                tournament.status === 'open' ? 'bg-blue-500/20 text-blue-500' : 
                tournament.status === 'completed' ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-500'
              }`}>
                {tournament.status}
              </span>
              <span className="text-zinc-600">•</span>
              <span className="text-zinc-500 text-sm font-medium uppercase tracking-widest">{tournament.weightClass}</span>
            </div>
            <h1 className="text-4xl font-bold text-white tracking-tight">{tournament.name}</h1>
            <div className="flex items-center gap-6 text-zinc-400 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4" />
                {new Date(tournament.startDate).toLocaleDateString()}
              </div>
              <div className="flex items-center gap-2">
                <Users className="w-4 h-4" />
                {(tournament.participants || []).length} Participantes
              </div>
            </div>
          </div>

          {auth.currentUser && (
            <div className="flex flex-col items-end gap-3">
              <div className="flex gap-3">
                {tournament.status === 'open' && tournament.organizerId === auth.currentUser.uid && (
                  <>
                    <button 
                      onClick={() => setIsRegistering(true)}
                      className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all"
                    >
                      <UserPlus className="w-5 h-5" />
                      Inscribir Boxeador
                    </button>
                    <button 
                      onClick={handleStartTournament}
                      disabled={isStarting || (tournament.participants?.length || 0) < 2}
                      className="bg-red-600 hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold py-3 px-6 rounded-xl flex items-center gap-2 transition-all shadow-lg shadow-red-600/20"
                    >
                      {isStarting ? (
                        <motion.div 
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-white border-t-transparent rounded-full"
                        />
                      ) : (
                        <Play className="w-5 h-5" />
                      )}
                      {isStarting ? 'Iniciando...' : 'Iniciar Torneo'}
                    </button>
                  </>
                )}
                <button 
                  onClick={(e) => handleDelete(e)}
                  disabled={isDeleting}
                  className={cn(
                    "font-bold py-3 px-4 rounded-xl flex items-center gap-2 transition-all border",
                    deleteConfirm 
                      ? "bg-red-600 text-white border-red-500 animate-pulse" 
                      : "bg-zinc-800 hover:bg-red-600/20 hover:text-red-500 text-zinc-400 border-zinc-700 hover:border-red-600/50"
                  )}
                  title={deleteConfirm ? "Click de nuevo para confirmar" : "Eliminar Torneo"}
                >
                  {isDeleting ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} className="w-5 h-5 border-2 border-white border-t-transparent rounded-full" />
                  ) : (
                    <Trash2 className="w-5 h-5" />
                  )}
                  {deleteConfirm && <span className="text-xs uppercase tracking-widest">¿Confirmar?</span>}
                </button>
                {deleteConfirm && !isDeleting && (
                  <button 
                    onClick={() => setDeleteConfirm(false)}
                    className="p-3 text-zinc-500 hover:text-white"
                  >
                    <X className="w-5 h-5" />
                  </button>
                )}
              </div>
              {error && (
                <p className="text-red-500 text-xs font-medium bg-red-500/10 px-3 py-1 rounded-lg">
                  {error}
                </p>
              )}
            </div>
          )}
        </div>
      </header>

      {tournament.status === 'open' ? (
        <section className="space-y-6">
          <h2 className="text-2xl font-bold text-white">Participantes Inscritos</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {(tournament.participants || []).map(boxerId => {
              const boxer = boxers.find(b => b.id === boxerId);
              return (
                <div key={boxerId} className="bg-zinc-900/50 border border-zinc-800 p-4 rounded-2xl flex items-center gap-4">
                  <div className="w-12 h-12 bg-zinc-800 rounded-xl flex items-center justify-center">
                    <Users className="text-zinc-500 w-6 h-6" />
                  </div>
                  <div>
                    <h4 className="font-bold text-white">{boxer?.name || 'Cargando...'}</h4>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest">{boxer?.weightClass}</p>
                  </div>
                </div>
              );
            })}
            {(tournament.participants || []).length === 0 && (
              <div className="col-span-full py-20 text-center border-2 border-dashed border-zinc-800 rounded-3xl text-zinc-600">
                No hay boxeadores inscritos todavía.
              </div>
            )}
          </div>
        </section>
      ) : (
        <section className="space-y-12 overflow-x-auto pb-10 scrollbar-hide">
          <div className="flex gap-16 min-w-max px-4">
            {rounds.length > 0 ? rounds.map((round, roundIndex) => (
              <div key={round} className="w-80 flex flex-col">
                <div className="mb-10 relative">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {round === 1 && <Trophy className="w-3 h-3 text-yellow-500" />}
                    <h3 className="text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] text-center">
                      {getRoundName(round)}
                    </h3>
                  </div>
                  <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 w-8 h-1 bg-red-600 rounded-full shadow-[0_0_10px_rgba(220,38,38,0.5)]" />
                </div>
                
                <div className="flex-1 flex flex-col justify-around gap-8">
                  {matches.filter(m => m.round === round).sort((a, b) => a.matchIndex - b.matchIndex).map((match, matchIdx) => {
                    const b1 = boxers.find(b => b.id === match.boxer1Id);
                    const b2 = boxers.find(b => b.id === match.boxer2Id);
                    const g1 = gyms.find(g => g.id === b1?.gymId);
                    const g2 = gyms.find(g => g.id === b2?.gymId);
                    
                    return (
                      <motion.div 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: roundIndex * 0.1 + matchIdx * 0.05 }}
                        key={match.id} 
                        className="relative group"
                      >
                        {/* Connecting Lines */}
                        {roundIndex < rounds.length - 1 && (
                          <div className="absolute -right-16 top-1/2 -translate-y-1/2 w-16 h-[2px] bg-zinc-800 group-hover:bg-red-600/50 transition-colors" />
                        )}

                        <button 
                          onClick={() => setSelectedMatchId(match.id)}
                          className="w-full text-left bg-zinc-900/80 backdrop-blur-md border border-zinc-800 rounded-2xl overflow-hidden shadow-2xl hover:border-red-600/50 hover:bg-zinc-900 transition-all duration-300 group/card"
                        >
                          {/* Match Header */}
                          <div className="px-4 py-2 bg-zinc-950/80 border-b border-zinc-800 flex justify-between items-center group-hover/card:bg-red-950/20 transition-colors">
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-zinc-500 uppercase tracking-widest ">Combate {match.matchIndex + 1}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {matchVideos[match.id] && <Video className="w-2.5 h-2.5 text-red-500 animate-pulse" />}
                              <span className={cn(
                                "text-[8px] font-black uppercase px-2 py-0.5 rounded-md tracking-tighter",
                                match.status === 'completed' ? "bg-emerald-500/10 text-emerald-500" : "bg-zinc-800 text-zinc-500"
                              )}>
                                {match.status}
                              </span>
                            </div>
                          </div>

                          {/* Participants List */}
                          <div className="divide-y divide-zinc-800/50">
                            {[
                              { id: match.boxer1Id, boxer: b1, gym: g1 },
                              { id: match.boxer2Id, boxer: b2, gym: g2 }
                            ].map((p, i) => (
                              <div key={i} className={cn(
                                "p-4 flex items-center justify-between",
                                match.winnerId === p.id ? "bg-emerald-500/5" : ""
                              )}>
                                <div className="flex items-center gap-3">
                                  <div className={cn(
                                    "w-1.5 h-1.5 rounded-full",
                                    match.winnerId === p.id ? "bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]" : "bg-zinc-800"
                                  )} />
                                  <div className="flex flex-col">
                                    <span className={cn(
                                      "font-bold text-sm tracking-tight",
                                      match.winnerId === p.id ? "text-white" : "text-zinc-500",
                                      p.id === 'BYE' && "italic opacity-30"
                                    )}>
                                      {p.boxer?.name || (p.id === 'BYE' ? 'BYE' : p.id === 'TBD' ? 'TBD' : '—')}
                                    </span>
                                    {p.gym && <span className="text-[9px] text-zinc-600 font-bold uppercase tracking-tighter">{p.gym.name}</span>}
                                  </div>
                                </div>
                                {match.winnerId === p.id && <Award className="w-3.5 h-3.5 text-yellow-500" />}
                              </div>
                            ))}
                          </div>

                          {/* Quick AI Indicator */}
                          {match.status === 'scheduled' && match.boxer1Id !== 'TBD' && match.boxer2Id !== 'TBD' && (
                            <div className="px-4 py-2 bg-zinc-950/50 border-t border-zinc-800/50 flex items-center justify-center gap-2 group-hover/card:bg-red-600/5 transition-colors">
                              <Sparkles className="w-2.5 h-2.5 text-zinc-600 group-hover/card:text-red-500 transition-colors" />
                              <span className="text-[8px] font-black text-zinc-600 uppercase tracking-widest group-hover/card:text-zinc-400 transition-colors">Abrir Match Center</span>
                            </div>
                          )}
                        </button>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )) : (
              <div className="w-full text-center py-20 text-zinc-600">
                Generando llaves...
              </div>
            )}
          </div>
        </section>
      )}

      {/* Match Center Modal */}
      <AnimatePresence>
        {selectedMatchId && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedMatchId(null)}
              className="absolute inset-0 bg-black/90 backdrop-blur-md"
            />
            {(() => {
              const match = matches.find(m => m.id === selectedMatchId);
              if (!match) return null;
              
              const b1 = boxers.find(b => b.id === match.boxer1Id);
              const b2 = boxers.find(b => b.id === match.boxer2Id);
              const g1 = gyms.find(g => g.id === b1?.gymId);
              const g2 = gyms.find(g => g.id === b2?.gymId);
              
              return (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95, y: 20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95, y: 20 }}
                  className="relative bg-zinc-900 border border-zinc-800 w-full max-w-2xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col max-h-[90vh]"
                >
                  {/* Modal Header */}
                  <div className="px-8 py-6 bg-zinc-950/50 border-b border-zinc-800 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-red-600/10 rounded-2xl flex items-center justify-center border border-red-500/20">
                        <Brain className="w-5 h-5 text-red-500" />
                      </div>
                      <div>
                        <h2 className="text-xl font-bold text-white tracking-tight">Match Center</h2>
                        <p className="text-[10px] text-zinc-500 font-black uppercase tracking-[0.2em]">{getRoundName(match.round)} • Combate {match.matchIndex + 1}</p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedMatchId(null)}
                      className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded-xl transition-all"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 space-y-12">
                    {/* Versus Section */}
                    <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-8 relative">
                      {/* Boxer 1 */}
                      <div className={cn(
                        "text-right space-y-4 p-6 rounded-[2rem] transition-all",
                        match.winnerId === match.boxer1Id ? "bg-red-600/10 border border-red-500/20" : "bg-zinc-800/10 border border-zinc-800"
                      )}>
                        <div className="space-y-1">
                          <h3 className="text-xl font-black text-white uppercase tracking-tight">{b1?.name || 'TBD'}</h3>
                          <div className="flex items-center justify-end gap-2 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                            {b1?.cornerColor && (
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 
                                  b1.cornerColor.toLowerCase() === 'rojo' ? '#ef4444' : 
                                  b1.cornerColor.toLowerCase() === 'azul' ? '#3b82f6' : 
                                  b1.cornerColor.toLowerCase() === 'blanco' ? '#ffffff' : 
                                  b1.cornerColor.toLowerCase() === 'negro' ? '#18181b' : 
                                  b1.cornerColor.toLowerCase() === 'verde' ? '#22c55e' : 
                                  b1.cornerColor.toLowerCase() === 'amarillo' ? '#eab308' : '#71717a' }} />
                                {b1.cornerColor}
                              </span>
                            )}
                            <span>•</span>
                            <span>{g1?.name || 'Independiente'}</span>
                          </div>
                        </div>
                        <div className="flex justify-end gap-2">
                          <div className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Ranking</span>
                            <p className="text-sm font-black text-white">{b1?.rankingPoints || 0}</p>
                          </div>
                        </div>
                      </div>

                      <div className="relative z-10 w-12 h-12 bg-red-600 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(220,38,38,0.4)]">
                        <span className="text-white font-black text-sm italic">VS</span>
                        {/* Decorative pulses */}
                        <div className="absolute inset-0 bg-red-600 rounded-full animate-ping opacity-20" />
                      </div>

                      {/* Boxer 2 */}
                      <div className={cn(
                        "text-left space-y-4 p-6 rounded-[2rem] transition-all",
                        match.winnerId === match.boxer2Id ? "bg-red-600/10 border border-red-500/20" : "bg-zinc-800/10 border border-zinc-800"
                      )}>
                        <div className="space-y-1">
                          <h3 className="text-xl font-black text-white uppercase tracking-tight">{b2?.name || 'TBD'}</h3>
                          <div className="flex items-center justify-start gap-2 text-[10px] text-zinc-500 font-black uppercase tracking-widest">
                            {b2?.cornerColor && (
                              <span className="flex items-center gap-1">
                                <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: 
                                  b2.cornerColor.toLowerCase() === 'rojo' ? '#ef4444' : 
                                  b2.cornerColor.toLowerCase() === 'azul' ? '#3b82f6' : 
                                  b2.cornerColor.toLowerCase() === 'blanco' ? '#ffffff' : 
                                  b2.cornerColor.toLowerCase() === 'negro' ? '#18181b' : 
                                  b2.cornerColor.toLowerCase() === 'verde' ? '#22c55e' : 
                                  b2.cornerColor.toLowerCase() === 'amarillo' ? '#eab308' : '#71717a' }} />
                                {b2.cornerColor}
                              </span>
                            )}
                            <span>•</span>
                            <span>{g2?.name || 'Independiente'}</span>
                          </div>
                        </div>
                        <div className="flex justify-start gap-2">
                          <div className="bg-zinc-900 border border-zinc-800 px-3 py-1 rounded-lg">
                            <span className="text-[10px] font-bold text-zinc-500 uppercase">Ranking</span>
                            <p className="text-sm font-black text-white">{b2?.rankingPoints || 0}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* AI Analyst Section */}
                    {match.status === 'scheduled' && match.boxer1Id !== 'TBD' && match.boxer2Id !== 'TBD' && (
                      <div className="space-y-6">
                        <div className="flex items-center gap-3">
                          <Sparkles className="w-5 h-5 text-red-500" />
                          <h4 className="text-sm font-black text-zinc-400 uppercase tracking-[0.2em] italic">Análisis de los 3 Rounds</h4>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-start">
                          {/* 3 Rounds Slots */}
                          <div className="space-y-4">
                            <div className="text-[10px] font-black text-zinc-500 uppercase ml-1 flex justify-between">
                              <span>Videos por Asalto</span>
                              <span className="text-zinc-600">3 ASALTOS OBLIGATORIOS</span>
                            </div>
                            
                            <div className="grid grid-cols-3 gap-3">
                              {(['r1', 'r2', 'r3'] as const).map((rKey, idx) => (
                                <div key={rKey} className="relative group/round">
                                  <input 
                                    type="file" 
                                    accept="video/*" 
                                    onChange={(e) => {
                                      const file = e.target.files?.[0];
                                      if (file) handleVideoUpload(match.id, file, rKey);
                                    }}
                                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                                  />
                                  <div className={cn(
                                    "aspect-square rounded-2xl border-2 transition-all flex flex-col items-center justify-center gap-1",
                                    matchVideos[match.id]?.[rKey] 
                                      ? "bg-emerald-500/10 border-emerald-500/50" 
                                      : "bg-zinc-950/20 border-zinc-800 border-dashed hover:border-red-500/50"
                                  )}>
                                    {matchVideos[match.id]?.[rKey] ? (
                                      <>
                                        <Sparkles className="w-4 h-4 text-emerald-500" />
                                        <span className="text-[9px] font-black text-emerald-500 uppercase">R{idx+1} OK</span>
                                      </>
                                    ) : (
                                      <>
                                        <Video className="w-4 h-4 text-zinc-700" />
                                        <span className="text-[9px] font-black text-zinc-700 uppercase">Round {idx+1}</span>
                                      </>
                                    )}
                                  </div>
                                  {matchVideos[match.id]?.[rKey] && (
                                    <button 
                                      onClick={() => setMatchVideos(prev => {
                                        const next = { ...prev };
                                        const vids = { ...next[match.id] };
                                        delete vids[rKey];
                                        next[match.id] = vids;
                                        return next;
                                      })}
                                      className="absolute -top-1 -right-1 bg-zinc-900 text-zinc-400 p-1 rounded-full border border-zinc-800 opacity-0 group-hover/round:opacity-100 z-20 transition-opacity"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              ))}
                            </div>
                            <p className="text-[10px] text-zinc-600 italic px-1 leading-tight">
                              Sube cada round por separado o al menos uno para permitir el análisis. La IA evaluará el desempeño round por round.
                            </p>
                          </div>

                          {/* Analysis Control */}
                          <div className="h-full flex flex-col justify-between gap-6">
                            <div className="bg-zinc-950/40 border border-zinc-800/50 p-6 rounded-[2rem] space-y-4">
                              <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                                El analista IA evaluará la técnica, agresividad y contundencia mostrada en los asaltos cargados para decidir el ganador.
                              </p>
                              
                              <button
                                onClick={() => handleAiDecision(match)}
                                disabled={isAiLoading[match.id] || (!matchVideos[match.id]?.r1 && !matchVideos[match.id]?.r2 && !matchVideos[match.id]?.r3)}
                                className={cn(
                                  "w-full py-4 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-xl font-black text-xs uppercase tracking-widest",
                                  (matchVideos[match.id]?.r1 || matchVideos[match.id]?.r2 || matchVideos[match.id]?.r3)
                                    ? "bg-red-600 hover:bg-red-500 text-white shadow-red-600/20 active:scale-95" 
                                    : "bg-zinc-800 text-zinc-600 cursor-not-allowed"
                                )}
                              >
                                {isAiLoading[match.id] ? (
                                  <motion.div 
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                                    className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                                  />
                                ) : (
                                  <Sparkles className="w-4 h-4" />
                                )}
                                {isAiLoading[match.id] ? 'Analizando rounds...' : 'Generar Scorecard IA'}
                              </button>
                            </div>

                            <div className="flex gap-4">
                              <button 
                                onClick={() => handleSetWinner(match, match.boxer1Id)}
                                className="flex-1 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-red-500 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all border border-red-500/10"
                              >
                                {b1?.name} Gana
                              </button>
                              <button 
                                onClick={() => handleSetWinner(match, match.boxer2Id)}
                                className="flex-1 py-3 bg-zinc-800/50 hover:bg-zinc-800 text-red-500 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all border border-red-500/10"
                              >
                                {b2?.name} Gana
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Winner/Result Section */}
                    {match.status === 'completed' && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.9, y: 30 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        className="relative"
                      >
                        {/* Decorative Background Glow */}
                        <div className="absolute inset-x-0 -top-10 -bottom-10 bg-emerald-500/10 blur-[100px] rounded-full" />
                        
                        <div className="relative bg-emerald-500/5 border border-emerald-500/20 p-12 rounded-[3rem] flex flex-col items-center gap-6 text-center overflow-hidden">
                          {/* Animated Border */}
                          <div className="absolute inset-0 border-2 border-emerald-500/30 rounded-[3rem] animate-pulse" />
                          
                          <motion.div 
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", damping: 10, stiffness: 100, delay: 0.2 }}
                            className="w-24 h-24 bg-emerald-500 rounded-full flex items-center justify-center mb-2 shadow-[0_0_50px_rgba(16,185,129,0.5)]"
                          >
                            <Trophy className="w-12 h-12 text-white" />
                          </motion.div>
                          
                          <div className="space-y-2">
                            <h4 className="text-[10px] font-black text-emerald-500 uppercase tracking-[0.5em] mb-4">Veredicto Final</h4>
                            <h2 className="text-5xl font-black text-zinc-50 uppercase italic tracking-tighter leading-none">
                              {match.winnerId === match.boxer1Id ? b1?.name : b2?.name}
                            </h2>
                            <p className="text-emerald-500/70 font-black text-xl uppercase italic tracking-widest mt-2">Ganador por Decisión</p>
                          </div>

                          {aiReasoning[match.id] && (
                            <div className="mt-8 pt-8 border-t border-emerald-500/20 w-full">
                              <div className="flex items-center justify-center gap-2 mb-4">
                                <Sparkles className="w-4 h-4 text-emerald-500" />
                                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-widest">Scorecard de la IA</span>
                              </div>
                              <div className="text-zinc-400 font-medium text-sm leading-relaxed max-w-md mx-auto whitespace-pre-line bg-zinc-950/20 p-6 rounded-2xl">
                                {aiReasoning[match.id]}
                              </div>
                            </div>
                          )}

                          {/* Confetti-like bits */}
                          <div className="absolute top-10 left-10 w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                          <div className="absolute bottom-10 right-10 w-2 h-2 bg-emerald-500 rounded-full animate-ping [animation-delay:0.5s]" />
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              );
            })()}
          </div>
        )}
      </AnimatePresence>

      {/* Register Modal */}
      <AnimatePresence>
        {isRegistering && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsRegistering(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-zinc-900 border border-zinc-800 w-full max-w-lg rounded-3xl p-8 shadow-2xl flex flex-col max-h-[80vh]"
            >
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">Inscribir Boxeador</h2>
                <button onClick={() => setIsRegistering(false)} className="text-zinc-500 hover:text-white transition-colors">
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="space-y-6 mb-8 pb-8 border-b border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest">Registro Directo</h3>
                <form onSubmit={handleDirectRegister} className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-zinc-500">Nombre del Boxeador</label>
                    <input 
                      type="text" 
                      value={newBoxerName}
                      onChange={(e) => setNewBoxerName(e.target.value)}
                      placeholder="Nombre completo"
                      className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">Gimnasio</label>
                      <select 
                        value={selectedGymId}
                        onChange={(e) => setSelectedGymId(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      >
                        <option value="">Independiente</option>
                        {gyms.map(gym => (
                          <option key={gym.id} value={gym.id}>{gym.name}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-zinc-500">Color/Esquina</label>
                      <select 
                        value={newBoxerColor}
                        onChange={(e) => setNewBoxerColor(e.target.value)}
                        className="w-full bg-zinc-800 border border-zinc-700 rounded-xl py-2 px-4 text-white focus:outline-none focus:ring-2 focus:ring-red-500/50"
                      >
                        <option value="Rojo">Rojo</option>
                        <option value="Azul">Azul</option>
                        <option value="Blanco">Blanco</option>
                        <option value="Negro">Negro</option>
                        <option value="Verde">Verde</option>
                        <option value="Amarillo">Amarillo</option>
                      </select>
                    </div>
                  </div>
                  <button 
                    type="submit"
                    disabled={!newBoxerName}
                    className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold py-2 rounded-xl transition-all"
                  >
                    Crear e Inscribir
                  </button>
                </form>
              </div>

              <h3 className="text-sm font-bold text-zinc-500 uppercase tracking-widest mb-4">Seleccionar Existente</h3>
              <div className="overflow-y-auto space-y-4 pr-2">
                {availableBoxers.length > 0 ? availableBoxers.map(boxer => (
                  <div key={boxer.id} className="bg-zinc-800 border border-zinc-700 p-4 rounded-2xl flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-white">{boxer.name}</h4>
                      <p className="text-zinc-500 text-xs uppercase tracking-widest">{boxer.weightClass}</p>
                    </div>
                    <button 
                      onClick={() => handleRegisterBoxer(boxer.id)}
                      className="bg-red-600 hover:bg-red-700 text-white p-2 rounded-xl transition-all"
                    >
                      <UserPlus className="w-5 h-5" />
                    </button>
                  </div>
                )) : (
                  <div className="text-center py-10 text-zinc-500">
                    No hay boxeadores disponibles en esta categoría ({tournament.weightClass}).
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

import React, { useState, useEffect } from 'react';
import { Trophy, Users, Dumbbell, Award, ChevronRight, TrendingUp, UserPlus, Play, Brain, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';
import { subscribeToCollection } from '../lib/firestore';
import { Tournament, Boxer, Gym } from '../types';
import { Link } from 'react-router-dom';
import { auth } from '../lib/firebase';

const StatCard = ({ title, value, icon: Icon, color }: { title: string, value: number, icon: any, color: string }) => (
  <motion.div 
    whileHover={{ y: -5 }}
    className="bg-zinc-900/50 border border-zinc-800 p-6 rounded-2xl space-y-4"
  >
    <div className="flex items-center justify-between">
      <div className={`p-3 rounded-xl ${color} bg-opacity-10`}>
        <Icon className={`w-6 h-6 ${color.replace('bg-', 'text-')}`} />
      </div>
      <TrendingUp className="text-zinc-700 w-5 h-5" />
    </div>
    <div>
      <p className="text-zinc-500 text-sm font-medium">{title}</p>
      <h3 className="text-3xl font-bold text-white mt-1">{value}</h3>
    </div>
  </motion.div>
);

export default function Dashboard() {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [boxers, setBoxers] = useState<Boxer[]>([]);
  const [gyms, setGyms] = useState<Gym[]>([]);

  useEffect(() => {
    const unsubT = subscribeToCollection<Tournament>('tournaments', setTournaments);
    const unsubB = subscribeToCollection<Boxer>('boxers', setBoxers);
    const unsubG = subscribeToCollection<Gym>('gyms', setGyms);
    return () => { unsubT(); unsubB(); unsubG(); };
  }, []);

  const activeTournaments = tournaments.filter(t => t.status === 'active');
  const topBoxers = [...boxers].sort((a, b) => b.rankingPoints - a.rankingPoints).slice(0, 5);

  return (
    <div className="space-y-10">
      <header className="space-y-2">
        <h1 className="text-4xl font-bold tracking-tight text-white">Dashboard</h1>
        <p className="text-zinc-500">Bienvenido a BoxLeague. Aquí tienes un resumen de la actividad actual.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Torneos Activos" value={activeTournaments.length} icon={Trophy} color="bg-red-500" />
        <StatCard title="Boxeadores Registrados" value={boxers.length} icon={Users} color="bg-blue-500" />
      <StatCard title="Gimnasios Afiliados" value={gyms.length} icon={Dumbbell} color="bg-emerald-500" />
      </div>

      {/* Finished Tournaments Cleanup Prompt */}
      {tournaments.filter(t => t.status === 'completed' && t.organizerId === auth.currentUser?.uid).length > 0 && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-emerald-500/5 border border-emerald-500/20 rounded-[2rem] p-6 flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-2xl flex items-center justify-center">
              <CheckCircle2 className="w-6 h-6 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-white font-black uppercase italic text-sm">Torneos Finalizados</h3>
              <p className="text-zinc-500 text-xs font-bold uppercase tracking-tight">Tienes torneos concluidos. Puedes eliminarlos para mantener tu espacio limpio.</p>
            </div>
          </div>
          <Link 
            to="/tournaments"
            className="px-6 py-3 bg-zinc-900 border border-zinc-800 hover:border-emerald-500/50 text-emerald-500 font-black text-[10px] uppercase tracking-widest rounded-xl transition-all"
          >
            Gestionar Finalizados
          </Link>
        </motion.div>
      )}

      {/* Guide Section */}
      <section className="bg-gradient-to-br from-zinc-900 to-black border border-zinc-800 rounded-[2.5rem] p-4 p-md-10 overflow-hidden relative group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/10 blur-[100px] -mr-32 -mt-32 rounded-full group-hover:bg-red-600/20 transition-all duration-1000" />
        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12">
          {[
            { step: "01", title: "Crea Torneos", desc: "Define nombre, fecha y categoría de peso.", icon: Trophy },
            { step: "02", title: "Inscribe Boxeadores", desc: "Registra participantes desde el perfil del torneo.", icon: UserPlus },
            { step: "03", title: "Inicia el Bracketing", desc: "Genera automáticamente las llaves de eliminación sencilla.", icon: Play },
            { step: "04", title: "Analiza el Combate", desc: "Sube el video y deja que la IA determine al ganador.", icon: Brain }
          ].map((item, i) => (
            <div key={i} className="space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-3xl font-black text-red-600/30 font-mono">{item.step}</span>
                <item.icon className="w-4 h-4 text-zinc-500" />
              </div>
              <div className="space-y-1">
                <h4 className="text-sm font-black text-white uppercase tracking-tight">{item.title}</h4>
                <p className="text-xs text-zinc-500 leading-relaxed font-bold">{item.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        {/* Active Tournaments */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Trophy className="text-red-500 w-5 h-5" />
              Torneos Recientes
            </h2>
            <Link to="/tournaments" className="text-red-500 text-sm hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="space-y-4">
            {tournaments.slice(0, 3).map(tournament => (
              <Link 
                key={tournament.id} 
                to={`/tournaments/${tournament.id}`}
                className="block bg-zinc-900/30 border border-zinc-800 p-4 rounded-xl hover:bg-zinc-900/50 transition-colors"
              >
                <div className="flex justify-between items-center">
                  <div>
                    <h4 className="font-bold text-white">{tournament.name}</h4>
                    <p className="text-zinc-500 text-sm">{tournament.weightClass} • {new Date(tournament.startDate).toLocaleDateString()}</p>
                  </div>
                  <span className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                    tournament.status === 'active' ? 'bg-red-500/20 text-red-500' : 
                    tournament.status === 'open' ? 'bg-blue-500/20 text-blue-500' : 'bg-zinc-800 text-zinc-500'
                  }`}>
                    {tournament.status}
                  </span>
                </div>
              </Link>
            ))}
            {tournaments.length === 0 && (
              <div className="text-center py-10 border border-dashed border-zinc-800 rounded-2xl text-zinc-600">
                No hay torneos registrados aún.
              </div>
            )}
          </div>
        </section>

        {/* Top Rankings */}
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-white flex items-center gap-2">
              <Award className="text-yellow-500 w-5 h-5" />
              Ranking Global
            </h2>
            <Link to="/boxers" className="text-yellow-500 text-sm hover:underline flex items-center gap-1">
              Ver todos <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="bg-zinc-900/30 border border-zinc-800 rounded-2xl overflow-hidden">
            {topBoxers.map((boxer, index) => (
              <div 
                key={boxer.id} 
                className="flex items-center justify-between p-4 border-b border-zinc-800 last:border-0"
              >
                <div className="flex items-center gap-4">
                  <span className="text-zinc-600 font-mono w-4">{index + 1}</span>
                  <div>
                    <h4 className="font-bold text-white">{boxer.name}</h4>
                    <p className="text-zinc-500 text-xs uppercase tracking-widest">{boxer.weightClass}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-white font-bold">{boxer.rankingPoints} pts</p>
                  <p className="text-zinc-500 text-xs">{boxer.wins}W - {boxer.losses}L</p>
                </div>
              </div>
            ))}
            {topBoxers.length === 0 && (
              <div className="text-center py-10 text-zinc-600">
                No hay boxeadores registrados aún.
              </div>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

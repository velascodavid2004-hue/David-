import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation } from 'react-router-dom';
import { 
  onAuthStateChanged, 
  signInAnonymously,
  signInWithPopup,
  GoogleAuthProvider,
  signOut, 
  User 
} from 'firebase/auth';
import { auth } from './lib/firebase';
import { 
  Trophy, 
  Users, 
  Dumbbell, 
  LayoutDashboard, 
  LogOut, 
  Plus, 
  ChevronRight,
  Shield,
  Calendar,
  Award
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { cn } from './lib/utils';

// Views (to be implemented)
import Dashboard from './views/Dashboard';
import Tournaments from './views/Tournaments';
import TournamentDetail from './views/TournamentDetail';
import Gyms from './views/Gyms';
import Boxers from './views/Boxers';


const Navbar = ({ user }: { user: User | null }) => {
  const location = useLocation();
  const isActive = (path: string) => location.pathname === path;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/tournaments', label: 'Torneos', icon: Trophy },
    { path: '/gyms', label: 'Gimnasios', icon: Dumbbell },
    { path: '/boxers', label: 'Boxeadores', icon: Users },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-zinc-950 border-t border-zinc-800 md:relative md:border-t-0 md:border-r md:w-64 md:h-screen p-4 flex md:flex-col justify-between z-50">
      <div className="flex md:flex-col w-full justify-around md:justify-start gap-2">
        <div className="hidden md:flex items-center gap-2 mb-8 px-2">
          <div className="w-8 h-8 bg-red-600 rounded-lg flex items-center justify-center">
            <Shield className="text-white w-5 h-5" />
          </div>
          <span className="font-bold text-xl tracking-tight text-white">BoxLeague</span>
        </div>

        {navItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200",
              isActive(item.path) 
                ? "bg-red-600/10 text-red-500 font-medium" 
                : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900"
            )}
          >
            <item.icon className="w-5 h-5" />
            <span className="hidden md:block">{item.label}</span>
          </Link>
        ))}
      </div>

      {user && (
        <button
          onClick={() => signOut(auth)}
          className="hidden md:flex items-center gap-3 px-4 py-3 rounded-xl text-zinc-500 hover:text-red-500 hover:bg-red-500/10 transition-all duration-200 mt-auto"
        >
          <LogOut className="w-5 h-5" />
          <span>Cerrar Sesión</span>
        </button>
      )}
    </nav>
  );
};

const AuthGate = ({ children, user, loading }: { children: React.ReactNode, user: User | null, loading: boolean }) => {
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const handleGoogleLogin = async () => {
    setAuthError(null);
    setAuthLoading(true);
    const provider = new GoogleAuthProvider();
    try {
      await signInWithPopup(auth, provider);
    } catch (err: any) {
      console.error("Google login error:", err);
      if (err.code === 'auth/operation-not-allowed') {
        setAuthError("ERROR: El inicio de sesión con Google no está habilitado. Habilítalo en: Authentication > Sign-in method > Añadir nuevo proveedor > Google.");
      } else if (err.code === 'auth/admin-restricted-operation') {
        setAuthError("ERROR: Operación restringida. Asegúrate de que Google Auth esté configurado correctamente en tu Consola de Firebase.");
      } else {
        setAuthError(`Error con Google: ${err.message}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (authLoading) return;
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInAnonymously(auth);
    } catch (err: any) {
      console.error("Auth error:", err);
      if (err.code === 'auth/operation-not-allowed' || err.code === 'auth/admin-restricted-operation') {
        setAuthError("Pasos: 1. Ve a Firebase Console. 2. Authentication > Sign-in method. 3. Activa 'Anónimo'.");
      } else {
        setAuthError(`Error: ${err.message}`);
      }
    } finally {
      setAuthLoading(false);
    }
  };

  if (loading || (authLoading && !authError && !user)) return (
    <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
      <div className="w-12 h-12 border-4 border-red-600 border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user) return (
    <div className="min-h-screen bg-zinc-950 flex flex-col items-center justify-center p-6 text-zinc-100">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="max-w-md w-full space-y-8"
      >
        <div className="text-center space-y-6">
          <div className="flex justify-center">
            <div className="w-20 h-20 bg-red-600 rounded-3xl flex items-center justify-center shadow-[0_0_50px_rgba(220,38,38,0.3)] rotate-3">
              <Trophy className="text-white w-12 h-12" />
            </div>
          </div>
          <div className="space-y-2">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase">Boxing AI</h1>
            <p className="text-zinc-500 font-bold uppercase tracking-[0.3em] text-[10px]">Tournament Engine</p>
          </div>
        </div>

        <div className="bg-zinc-900 border border-zinc-800 p-8 rounded-[2.5rem] space-y-8 shadow-2xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-600 via-zinc-800 to-red-600" />
          
          <div className="space-y-2 text-center">
            <h2 className="text-2xl font-black text-white uppercase italic tracking-tight">Bienvenido</h2>
            <p className="text-zinc-500 text-xs font-bold uppercase tracking-widest">Gestión de torneos</p>
          </div>

          {authError && (
            <div className="bg-red-500/10 border border-red-500/20 text-red-500 text-xs p-5 rounded-2xl font-bold leading-relaxed">
              <p>{authError}</p>
            </div>
          )}

          <div className="space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={authLoading}
              className="w-full bg-white hover:bg-zinc-100 text-black font-black py-5 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-200 active:scale-95"
            >
              {authLoading ? (
                 <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin" />
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 48 48">
                    <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
                    <path fill="#4285F4" d="M46.5 24c0-1.63-.15-3.2-.43-4.73H24v9h12.75c-.55 2.85-2.17 5.27-4.59 6.89l7.11 5.51C43.42 36.5 46.5 30.76 46.5 24z"/>
                    <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.11-5.51c-1.97 1.32-4.49 2.1-8.78 2.1-6.26 0-11.57-4.22-13.46-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
                    <path fill="#FBBC05" d="M10.54 28.88C10.06 27.42 9.78 25.86 9.78 24c0-1.86.28-3.42.76-4.88l-7.98-6.19C1.04 15.93 0 19.82 0 24s1.04 8.07 2.56 11.07l7.98-6.19z"/>
                  </svg>
                  <span className="uppercase tracking-[0.2em] text-xs">Continuar con Google</span>
                </>
              )}
            </button>

            <div className="relative py-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-zinc-800"></div>
              </div>
              <div className="relative flex justify-center text-[10px] uppercase">
                <span className="bg-zinc-900 px-4 text-zinc-500 font-black tracking-widest">O TAMBIÉN</span>
              </div>
            </div>

            <button
              onClick={handleGuestLogin}
              disabled={authLoading}
              className="w-full bg-zinc-800 hover:bg-zinc-700 text-white font-black py-4 rounded-[1.5rem] flex items-center justify-center gap-3 transition-all duration-200 active:scale-95 border border-zinc-700"
            >
              {authLoading ? (
                 <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <span className="uppercase tracking-[0.2em] text-[10px]">Acceso Invitado (Modo Lectura)</span>
              )}
            </button>
          </div>
          
          <p className="text-[9px] text-zinc-600 text-center uppercase tracking-[0.2em] font-black leading-relaxed">
            * Asegúrate de habilitar los métodos de inicio de sesión en tu Consola de Firebase.
          </p>
        </div>
      </motion.div>
    </div>
  );

  return <>{children}</>;
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Safety timeout to prevent white screen if Firebase hangs
    const timeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    return () => {
      unsubscribe();
      clearTimeout(timeout);
    };
  }, []);

  return (
    <Router>
      <AuthGate user={user} loading={loading}>
        <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col md:flex-row">
          <Navbar user={user} />
          <main className="flex-1 pb-24 md:pb-0 overflow-y-auto">
            <div className="max-w-6xl mx-auto p-6 md:p-10">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/tournaments" element={<Tournaments />} />
                <Route path="/tournaments/:id" element={<TournamentDetail />} />
                <Route path="/gyms" element={<Gyms />} />
                <Route path="/boxers" element={<Boxers />} />
                <Route path="*" element={<Navigate to="/" />} />
              </Routes>
            </div>
          </main>
        </div>
      </AuthGate>
    </Router>
  );
}

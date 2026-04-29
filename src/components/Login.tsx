import { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth } from '../lib/firebase';
import { LogIn } from 'lucide-react';
import { motion } from 'motion/react';

export default function Login() {
  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  const handleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithPopup(auth, new GoogleAuthProvider());
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/unauthorized-domain') {
        setError('Este domínio não está autorizado no Firebase. Adicione-o nas configurações do console Firebase.');
      } else if (err.code === 'auth/popup-closed-by-user') {
        setError('O login foi cancelado.');
      } else {
        setError('Erro ao autenticar: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-950 p-6">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center"
      >
        <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg shadow-blue-900/20">
          <LogIn className="text-white w-8 h-8" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2 font-sans tracking-tight">Gabinete Digital</h1>
        <p className="text-slate-400 mb-8 font-sans">Sistema de Controle de Atendimentos</p>
        
        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs text-left">
            {error}
          </div>
        )}
        
        <button
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-white text-slate-950 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-colors disabled:opacity-50"
        >
          <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
          {loading ? 'Entrando...' : 'Entrar com Google'}
        </button>
        
        <p className="mt-8 text-xs text-slate-500 uppercase tracking-widest font-mono">
          Acesso restrito ao gabinete
        </p>
      </motion.div>
    </div>
  );
}

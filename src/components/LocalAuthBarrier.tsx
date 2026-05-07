
import React, { useState, useEffect } from 'react';
import { ShieldCheck, Fingerprint, Lock, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { authenticateBiometrics, isBiometricSupported } from '../lib/webauthn';
import { useAuth } from '../hooks/useAuth';

interface LocalAuthBarrierProps {
  children: React.ReactNode;
}

export default function LocalAuthBarrier({ children }: LocalAuthBarrierProps) {
  const { profile } = useAuth();
  const [isLocked, setIsLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [supported, setSupported] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const isSupported = await isBiometricSupported();
      setSupported(isSupported);
      
      const isEnabled = localStorage.getItem('biometric_enabled') === 'true';
      const isRegistered = localStorage.getItem('biometric_registered') === 'true';
      
      if (isEnabled && isRegistered) {
        setIsLocked(true);
        // Tenta autenticar automaticamente ao carregar
        handleAuthenticate();
      }
    };
    
    if (profile) {
       checkSupport();
    }
  }, [profile]);

  const handleAuthenticate = async () => {
    setLoading(true);
    setError(null);
    try {
      const success = await authenticateBiometrics();
      if (success) {
        setIsLocked(false);
      } else {
        setError("Não foi possível autenticar.");
      }
    } catch (err: any) {
      console.error("Auth error:", err);
      // Se o usuário cancelar ou o dispositivo falhar
      if (err.name === 'NotAllowedError') {
        setError("Autenticação cancelada ou não autorizada.");
      } else {
        setError("Erro ao acessar biometria do dispositivo.");
      }
    } finally {
      setLoading(false);
    }
  };

  if (!isLocked) return <>{children}</>;

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950 flex items-center justify-center p-6">
      <motion.div 
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center space-y-8"
      >
        <div className="flex justify-center">
           <div className="w-20 h-20 bg-blue-600/10 text-blue-500 rounded-3xl flex items-center justify-center border border-blue-500/20 shadow-inner">
              <ShieldCheck size={40} />
           </div>
        </div>

        <div className="space-y-2">
           <h1 className="text-2xl font-bold text-white">Gabinete Digital</h1>
           <p className="text-slate-500 text-sm font-medium uppercase tracking-widest">Acesso Protegido</p>
        </div>

        <div className="bg-slate-800/50 p-6 rounded-2xl border border-slate-700/50">
           <p className="text-slate-300 text-sm leading-relaxed mb-6">
             Este dispositivo está configurado para exigir autenticação local (Biometria ou PIN) antes de acessar dados parlamentares.
           </p>
           
           <button
             onClick={handleAuthenticate}
             disabled={loading}
             className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-blue-900/20 disabled:opacity-50"
           >
             {loading ? (
               <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
             ) : (
               <>
                 <Fingerprint size={20} />
                 Desbloquear com Biometria
               </>
             )}
           </button>
        </div>

        {error && (
           <div className="flex items-center gap-2 text-red-400 text-xs justify-center bg-red-400/5 py-2 rounded-lg border border-red-400/10">
              <ShieldAlert size={14} />
              {error}
           </div>
        )}

        <div className="pt-4">
           <p className="text-[10px] text-slate-600 uppercase font-black tracking-tighter">
             Segurança Padrão iOS / Android
           </p>
        </div>
      </motion.div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { LogIn, User } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, onSnapshot } from 'firebase/firestore';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState('Gabinete Digital');
  const [vereadorPhoto, setVereadorPhoto] = useState<string | null>(null);
  const [perfilLink, setPerfilLink] = useState('https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
  const [lgpdText, setLgpdText] = useState('Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
  const [lgpdAccepted, setLgpdAccepted] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAppName(data.app_name || 'Gabinete Digital');
        setVereadorPhoto(data.vereador_photo || null);
        setPerfilLink(data.perfil_link || 'https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
        setLgpdText(data.lgpd_text || 'Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
      }
    });
    return () => unsub();
  }, []);

  const handleLogin = async () => {
    if (!lgpdAccepted) {
      setError('Você precisa aceitar os termos da LGPD para continuar.');
      return;
    }
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
        className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-2xl text-center"
      >
        <div className="mb-8 flex justify-center">
          {vereadorPhoto ? (
            <div className="relative">
              <div className="w-24 h-24 rounded-3xl overflow-hidden border-4 border-slate-800 shadow-xl">
                <img src={vereadorPhoto} alt="Vereador" className="w-full h-full object-cover" />
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg">
                <LogIn className="text-white w-4 h-4" />
              </div>
            </div>
          ) : (
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center shadow-lg shadow-blue-900/20">
              <LogIn className="text-white w-10 h-10" />
            </div>
          )}
        </div>
        <h1 className="text-3xl font-bold text-white mb-2 font-sans tracking-tight leading-tight">{appName}</h1>
        <p className="text-slate-500 mb-6 font-sans text-sm font-medium tracking-wide uppercase">Sistema de Controle Parlamentar</p>
        
        <div className="mb-8 flex justify-center">
          <a 
            href={perfilLink} 
            target="_blank" 
            rel="noopener noreferrer"
            className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase tracking-widest bg-blue-500/5 px-4 py-2 rounded-full border border-blue-500/10 transition-all"
          >
            Ver Perfil Oficial na Câmara
          </a>
        </div>
        
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

        <div className="mt-6 flex items-start gap-3 p-4 bg-slate-800/40 rounded-2xl border border-slate-700/50 text-left">
           <input 
             type="checkbox" 
             checked={lgpdAccepted}
             onChange={(e) => setLgpdAccepted(e.target.checked)}
             className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
           />
           <p className="text-[10px] text-slate-400 leading-relaxed">
             {lgpdText}
           </p>
        </div>
        
        <p className="mt-6 text-xs text-slate-500 uppercase tracking-widest font-mono">
          Acesso restrito ao gabinete
        </p>
      </motion.div>
    </div>
  );
}

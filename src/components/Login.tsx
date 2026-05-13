import { useState, useEffect } from 'react';
import { signInWithPopup, GoogleAuthProvider, signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth, db } from '../lib/firebase';
import { LogIn, User, Mail, Lock, ChevronLeft, Key } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, onSnapshot, collection, query, where, getDocs, getDoc } from 'firebase/firestore';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [appName, setAppName] = useState('Gabinete Digital');
  const [vereadorPhoto, setVereadorPhoto] = useState<string | null>(null);
  const [perfilLink, setPerfilLink] = useState('https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
  const [lgpdText, setLgpdText] = useState('Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
  const [lgpdAccepted, setLgpdAccepted] = useState(false);
  const [showTraditional, setShowTraditional] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'app_settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAppName(data.app_name || 'Gabinete Digital');
        setVereadorPhoto(data.vereador_photo || null);
        setPerfilLink(data.perfil_link || 'https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
        setLgpdText(data.lgpd_text || 'Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
      }
    }, (error) => {
      console.error("Error listening to global settings in Login:", error);
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

  const handleTraditionalLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lgpdAccepted) {
      setError('Você precisa aceitar os termos da LGPD para continuar.');
      return;
    }
    if (!identifier || !password) {
      setError('Preencha todos os campos.');
      return;
    }
    
    setLoading(true);
    setError(null);
    try {
      let email = identifier;
      // If it looks like a username (no @), try to find it in Firestore
      if (!identifier.includes('@')) {
        const docRef = doc(db, 'users', identifier);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          email = docSnap.data().email;
        } else {
          // Fallback to query if doc ID isn't the username
          const q = query(collection(db, 'users'), where('username', '==', identifier));
          const snap = await getDocs(q);
          if (!snap.empty) {
            email = snap.docs[0].data().email;
          } else {
            throw new Error('Usuário não encontrado.');
          }
        }
      }

      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Traditional login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('Email/Usuário ou senha incorretos.');
      } else if (err.message === 'Usuário não encontrado.') {
        setError('Nome de usuário não encontrado.');
      } else {
        setError('Erro ao autenticar: ' + (err.message || 'Erro desconhecido.'));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!identifier) {
      setError('Informe seu email ou usuário para recuperar a senha.');
      return;
    }

    setLoading(true);
    setError(null);
    try {
      let email = identifier;
      // Resolve email if username is provided
      if (!identifier.includes('@')) {
        const docRef = doc(db, 'users', identifier);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          email = docSnap.data().email;
        } else {
          const q = query(collection(db, 'users'), where('username', '==', identifier));
          const snap = await getDocs(q);
          if (!snap.empty) {
            email = snap.docs[0].data().email;
          } else {
            throw new Error('Usuário não encontrado.');
          }
        }
      }

      await sendPasswordResetEmail(auth, email);
      setResetEmailSent(true);
    } catch (err: any) {
      console.error('Reset password error:', err);
      if (err.code === 'auth/user-not-found') {
        setError('Nenhum usuário encontrado com este email.');
      } else {
        setError('Erro ao enviar email de recuperação: ' + (err.message || 'Erro desconhecido.'));
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
        
        {resetEmailSent ? (
          <div className="space-y-6">
            <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
              <Key className="text-emerald-500" size={32} />
            </div>
            <div className="space-y-2">
              <h3 className="text-emerald-400 font-bold">Email enviado!</h3>
              <p className="text-slate-400 text-sm">
                Instruções para recuperação de senha foram enviadas para o email associado a <strong>{identifier}</strong>.
              </p>
            </div>
            <button
              onClick={() => {
                setResetEmailSent(false);
                setShowForgotPassword(false);
                setError(null);
              }}
              className="w-full bg-slate-800 text-slate-300 font-medium py-3 px-4 rounded-xl hover:bg-slate-700 transition-colors"
            >
              Voltar ao Login
            </button>
          </div>
        ) : showForgotPassword ? (
          <form onSubmit={handleResetPassword} className="space-y-6 text-left">
             <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Recuperar Senha</h2>
              <p className="text-slate-500 text-xs">
                Informe seu email ou nome de usuário. Enviaremos um link para definir uma nova senha.
              </p>
            </div>

            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Email ou Usuário</label>
              <div className="relative">
                <input 
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 pl-10 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  placeholder="Seu nome de usuário ou email"
                  required
                />
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50"
            >
              {loading ? 'Enviando...' : 'Enviar Email de Recuperação'}
            </button>

            <button
              type="button"
              onClick={() => {
                setShowForgotPassword(false);
                setError(null);
              }}
              className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
            >
              <ChevronLeft size={14} />
              Cancelar e voltar
            </button>
          </form>
        ) : !showTraditional ? (
          <div className="space-y-4">
            <button
              onClick={handleLogin}
              disabled={loading}
              className="w-full bg-white text-slate-950 font-semibold py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-200 transition-colors disabled:opacity-50"
            >
              <img src="https://www.google.com/favicon.ico" alt="Google" className="w-5 h-5" />
              {loading ? 'Entrando...' : 'Entrar com Google'}
            </button>
            <button
              onClick={() => setShowTraditional(true)}
              className="w-full bg-slate-800 text-slate-300 font-medium py-3 px-4 rounded-xl flex items-center justify-center gap-3 hover:bg-slate-700 transition-colors"
            >
              <User size={18} />
              Entrar com Usuário ou Email
            </button>
          </div>
        ) : (
          <form onSubmit={handleTraditionalLogin} className="space-y-4 text-left">
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Email ou Usuário</label>
              <div className="relative">
                <input 
                  type="text"
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 pl-10 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  placeholder="Seu nome de usuário ou email"
                />
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>
            
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest">Senha</label>
                <button 
                  type="button"
                  onClick={() => {
                    setShowForgotPassword(true);
                    setError(null);
                  }}
                  className="text-[10px] font-bold text-blue-500 hover:text-blue-400 uppercase tracking-tighter"
                >
                  Esqueci minha senha
                </button>
              </div>
              <div className="relative">
                <input 
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 pl-10 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  placeholder="Sua senha"
                />
                <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-xl hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-900/20"
            >
              {loading ? 'Autenticando...' : 'Acessar Painel'}
            </button>

            <button
              type="button"
              onClick={() => setShowTraditional(false)}
              className="w-full flex items-center justify-center gap-2 text-xs text-slate-500 hover:text-slate-300 transition-colors py-2"
            >
              <ChevronLeft size={14} />
              Voltar para login social
            </button>
          </form>
        )}

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

import React, { useState } from 'react';
import { Key, Save, AlertCircle, CheckCircle2, Eye, EyeOff } from 'lucide-react';
import { updatePassword } from 'firebase/auth';
import { doc, updateDoc } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { logAction } from '../lib/audit';

export default function ForcePasswordChange() {
  const { user, profile } = useAuth();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    if (newPassword.length < 6) {
      setError('A nova senha deve ter pelo menos 6 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas não coincidem.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // 1. Atualizar no Firebase Auth
      await updatePassword(user, newPassword);

      // 2. Marcar como alterado no Firestore
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, { 
        requirePasswordChange: false,
        updated_at: new Date()
      });

      // 3. Log Audit
      await logAction('Senha Temporária Alterada', 'users', user.uid, { 
        next: { mensagem: 'O usuário alterou sua senha temporária no primeiro acesso.' } 
      });

      setSuccess(true);
      
      // Reload page to refresh profile state after a short delay
      setTimeout(() => {
        window.location.reload();
      }, 2000);

    } catch (err: any) {
      console.error('Erro ao atualizar senha:', err);
      if (err.code === 'auth/requires-recent-login') {
        setError('Sessão expirada. Por favor, saia e entre novamente para alterar sua senha.');
      } else {
        setError('Erro ao atualizar senha: ' + err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-slate-950 p-4">
      <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-[2rem] p-8 shadow-2xl">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-500/20">
            <Key className="text-blue-500" size={32} />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Alteração Obrigatória</h2>
          <p className="text-slate-400 text-sm">
            Um administrador definiu uma senha temporária para você. Por segurança, você deve alterá-la agora.
          </p>
        </div>

        {success ? (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6 text-center space-y-4">
            <div className="w-12 h-12 bg-emerald-500/20 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle2 className="text-emerald-500" size={24} />
            </div>
            <p className="text-emerald-400 font-bold">Senha atualizada com sucesso!</p>
            <p className="text-xs text-slate-500">Recarregando o sistema...</p>
          </div>
        ) : (
          <form onSubmit={handleUpdatePassword} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 flex items-start gap-3 text-red-400 text-sm">
                <AlertCircle className="shrink-0" size={18} />
                <p>{error}</p>
              </div>
            )}

            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Nova Senha</label>
                <div className="relative">
                  <input 
                    type={showPass ? "text" : "password"}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Mínimo 6 caracteres"
                    required
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                  >
                    {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Confirmar Senha</label>
                <input 
                  type={showPass ? "text" : "password"}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  placeholder="Repita a nova senha"
                  required
                />
              </div>
            </div>

            <button 
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
            >
              {loading ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  <Save size={20} />
                  Alterar e Acessar
                </>
              )}
            </button>
            <button 
              type="button"
              onClick={() => auth.signOut()}
              className="w-full text-slate-500 hover:text-white text-xs font-bold transition-colors"
            >
              Sair da Conta
            </button>
          </form>
        )}
      </div>
    </div>
  );
}

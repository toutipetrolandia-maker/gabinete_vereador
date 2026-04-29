import React, { useEffect, useState } from 'react';
import { 
  History, 
  Search, 
  Filter,
  User,
  Activity,
  Calendar,
  Database,
  Plus,
  Trash2,
  Edit2,
  UserPlus,
  X,
  Settings as SettingsIcon
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, addDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { logAction } from '../lib/audit';

export default function Settings() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'users' | 'general'>('audit');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', role: 'atendente', ativo: true });
  const [appName, setAppName] = useState('Gabinete Digital');
  const [savingSettings, setSavingSettings] = useState(false);

  useEffect(() => {
    if (!profile) return;

    let unsubLogs = () => {};
    let unsubUsers = () => {};

    if (profile.role === 'admin' || profile.role === 'vereador') {
      const qLogs = query(collection(db, 'logs'), orderBy('criado_em', 'desc'), limit(50));
      unsubLogs = onSnapshot(qLogs, (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (error) => {
        console.error("Error listening to logs:", error);
      });
    }

    if (profile.role === 'admin') {
      const qUsers = query(collection(db, 'users'), orderBy('nome', 'asc'));
      unsubUsers = onSnapshot(qUsers, (snap) => {
        setUsersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      }, (error) => {
        console.error("Error listening to users:", error);
      });
    }

    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'global'), (snap) => {
      if (snap.exists()) {
        setAppName(snap.data().app_name || 'Gabinete Digital');
      }
    }, (error) => {
      console.error("Error listening to settings:", error);
    });

    return () => {
      unsubLogs();
      unsubUsers();
      unsubSettings();
    };
  }, [profile]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== 'admin') return;
    setSavingSettings(true);
    try {
      await updateDoc(doc(db, 'app_settings', 'global'), {
        app_name: appName,
        updated_at: serverTimestamp(),
      });
      await logAction('Atualizar Configurações', 'app_settings', 'global', { next: { app_name: appName } });
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      // If doc doesn't exist, create it (should use setDoc but let's try to handle it simply)
      console.error("Erro ao salvar configurações:", error);
      // Fallback for first time
      try {
        const { setDoc } = await import('firebase/firestore');
        await setDoc(doc(db, 'app_settings', 'global'), {
          app_name: appName,
          updated_at: serverTimestamp(),
        });
      } catch (err2) {
        console.error("Erro fatal ao salvar:", err2);
      }
    } finally {
      setSavingSettings(false);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (profile?.role !== 'admin') return;
    try {
      const userRef = doc(db, 'users', userId);
      const userToUpdate = usersList.find(u => u.id === userId);
      await updateDoc(userRef, { role: newRole });
      await logAction('Atualizar Perfil', 'users', userId, { 
        previous: { role: userToUpdate?.role }, 
        next: { role: newRole } 
      });
    } catch (error) {
      console.error("Erro ao atualizar papel:", error);
    }
  };

  const handleToggleAtivo = async (userId: string, currentStatus: boolean) => {
    if (profile?.role !== 'admin') return;
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { ativo: !currentStatus });
      await logAction('Alterar Status', 'users', userId, { 
        previous: { ativo: currentStatus }, 
        next: { ativo: !currentStatus } 
      });
    } catch (error) {
      console.error("Erro ao alternar status:", error);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUser.nome || !newUser.email) return alert("Preencha todos os campos.");
    try {
      await addDoc(collection(db, 'users'), {
        ...newUser,
        criado_em: serverTimestamp(),
      });
      await logAction('Criar', 'users', 'novo', { next: newUser });
      setShowUserModal(false);
      setNewUser({ nome: '', email: '', role: 'atendente', ativo: true });
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
    }
  };

  const handleDeleteUser = async (id: string, nome: string) => {
    if (id === auth.currentUser?.uid) return alert("Você não pode excluir a si mesmo.");
    if (!window.confirm(`Tem certeza que deseja excluir permanentemente o usuário ${nome}?`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', id));
      await logAction('Excluir', 'users', id, { previous: { nome } });
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
    }
  };

  const filteredLogs = logs.filter(log => 
    log.usuario_nome?.toLowerCase().includes(search.toLowerCase()) ||
    log.acao?.toLowerCase().includes(search.toLowerCase()) ||
    log.colecao?.toLowerCase().includes(search.toLowerCase())
  );

  const [search, setSearch] = useState('');

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Configurações</h1>
        <p className="text-slate-400">Gerencie as preferências do sistema, usuários e visualize a trilha de auditoria.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar Mini Nav */}
        <div className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible pb-2 lg:pb-0 gap-2 scrollbar-none lg:w-64 shrink-0">
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveSubTab('general')}
              className={cn(
                "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
                activeSubTab === 'general' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
              )}
            >
              <SettingsIcon size={18} />
              Configurações
            </button>
          )}
          <button 
            onClick={() => setActiveSubTab('audit')}
            className={cn(
              "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
              activeSubTab === 'audit' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
            )}
          >
            <History size={18} />
            Auditoria
          </button>
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveSubTab('users')}
              className={cn(
                "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
                activeSubTab === 'users' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
              )}
            >
              <User size={18} />
              Usuários
            </button>
          )}
        </div>

        <div className="flex-1 space-y-6 min-w-0">
          {activeSubTab === 'general' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8"
            >
              <div>
                <h2 className="text-2xl font-bold text-white mb-1">Configurações Gerais</h2>
                <p className="text-slate-400">Personalize a identidade do seu gabinete no sistema.</p>
              </div>

              <form onSubmit={handleUpdateSettings} className="space-y-6 max-w-xl">
                <div className="space-y-2">
                  <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Nome do Gabinete / Vereador</label>
                  <input 
                    type="text" 
                    value={appName}
                    onChange={e => setAppName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="Ex: Gabinete do Vereador João"
                  />
                  <p className="text-[10px] text-slate-500 px-1 italic">Este nome aparecerá na barra lateral e no cabeçalho do sistema.</p>
                </div>

                <button 
                  type="submit"
                  disabled={savingSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>

              <div className="pt-8 border-t border-slate-800">
                 <div className="flex items-center gap-3 text-amber-400 mb-4 font-bold uppercase text-xs tracking-widest">
                    <Activity size={16} />
                    Informações do Sistema
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                       <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Versão</span>
                       <span className="text-white font-mono">1.0.4-stable</span>
                    </div>
                    <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                       <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Ambiente</span>
                       <span className="text-emerald-400 font-mono">Produção</span>
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : activeSubTab === 'audit' ? (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="text-blue-500" size={20} />
                    Logs de Atividade
                  </h2>
                  <p className="text-sm text-slate-500">Histórico detalhado de todas as operações realizadas no sistema.</p>
                </div>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="Filtrar logs..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="bg-slate-800 border border-slate-700 rounded-xl py-2 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600/50"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                      <th className="px-6 py-4 font-bold">Usuário</th>
                      <th className="px-6 py-4 font-bold">Ação</th>
                      <th className="px-6 py-4 font-bold">Coleção</th>
                      <th className="px-6 py-4 font-bold">Data/Hora</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {loading ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-500">Buscando logs...</td>
                      </tr>
                    ) : filteredLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-20 text-center text-slate-500">Nenhum log encontrado.</td>
                      </tr>
                    ) : filteredLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400">
                              {log.usuario_nome?.[0]}
                            </div>
                            <span className="text-sm font-medium text-slate-300">{log.usuario_nome}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`text-[11px] font-bold py-1 px-2 rounded font-mono ${
                            log.acao === 'Criar' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            log.acao === 'Atualizar' ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            'bg-red-500/10 text-red-400 border border-red-500/20'
                          }`}>
                            {log.acao}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-xs text-slate-400 font-mono">{log.colecao}</span>
                          <div className="text-[10px] text-slate-600">ID: {log.documento_id?.slice(-6)}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2 text-xs text-slate-500">
                            <Calendar size={12} />
                            {log.criado_em?.toDate ? format(log.criado_em.toDate(), "dd/MM HH:mm:ss", { locale: ptBR }) : '...'}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : activeSubTab === 'users' ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white mb-1">Controle de Acessos</h2>
                  <p className="text-sm text-slate-500">Gerencie quem pode acessar o sistema e quais são suas atribuições.</p>
                </div>
                <button 
                  onClick={() => setShowUserModal(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center gap-2 text-sm font-bold transition-all shadow-lg shadow-blue-900/20"
                >
                  <UserPlus size={18} />
                  Novo Usuário
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                      <th className="px-6 py-4 font-bold">Usuário</th>
                      <th className="px-6 py-4 font-bold">Papel (Role)</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {usersList.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            <span className="text-sm font-bold text-white">{u.nome}</span>
                            <span className="text-xs text-slate-500">{u.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            disabled={profile?.role !== 'admin' || u.id === auth.currentUser?.uid}
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg text-xs p-2 text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="admin">Administrador</option>
                            <option value="atendente">Atendente</option>
                            <option value="vereador">Vereador</option>
                            <option value="consulta">Apenas Consulta</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full uppercase",
                            u.ativo ? "bg-emerald-500/10 text-emerald-400" : "bg-red-500/10 text-red-400"
                          )}>
                            {u.ativo ? 'Ativo' : 'Inativo'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              disabled={profile?.role !== 'admin' || u.id === auth.currentUser?.uid}
                              onClick={() => handleToggleAtivo(u.id, !!u.ativo)}
                              className={cn(
                                "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                                u.ativo ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10" : "text-emerald-400 hover:bg-emerald-500/10"
                              )}
                            >
                              {u.ativo ? 'Desativar' : 'Ativar'}
                            </button>
                            {u.id !== auth.currentUser?.uid && (
                              <button 
                                onClick={() => handleDeleteUser(u.id, u.nome)}
                                className="p-2 text-slate-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                                title="Excluir Permanentemente"
                              >
                                <Trash2 size={16} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Add User Modal */}
              <AnimatePresence>
                {showUserModal && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      onClick={() => setShowUserModal(false)}
                      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]" 
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95 }} 
                      animate={{ opacity: 1, scale: 1 }} 
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl z-[101] shadow-2xl overflow-hidden"
                    >
                      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white">Novo Usuário</h3>
                        <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400">
                          <X size={20} />
                        </button>
                      </div>
                      <form onSubmit={handleCreateUser} className="p-6 space-y-4">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Nome Completo</label>
                          <input 
                            required
                            type="text" 
                            value={newUser.nome}
                            onChange={e => setNewUser({...newUser, nome: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="Ex: João Silva"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">E-mail (Google Account)</label>
                          <input 
                            required
                            type="email" 
                            value={newUser.email}
                            onChange={e => setNewUser({...newUser, email: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none"
                            placeholder="usuario@gmail.com"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold uppercase text-slate-500">Papel de Acesso</label>
                          <select 
                            value={newUser.role}
                            onChange={e => setNewUser({...newUser, role: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 outline-none appearance-none"
                          >
                            <option value="admin">Administrador</option>
                            <option value="atendente">Atendente</option>
                            <option value="vereador">Vereador</option>
                            <option value="consulta">Apenas Consulta</option>
                          </select>
                        </div>
                        <button 
                          type="submit"
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl mt-4 shadow-lg shadow-blue-900/20 transition-all"
                        >
                          Cadastrar Usuário
                        </button>
                      </form>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 space-y-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Database className="text-blue-500" size={20} />
                Configurações de Domínio de Autenticação
              </h2>
              <p className="text-slate-400 text-sm">
                Se você está tentando acessar o sistema através de um domínio novo (como o Vercel), você precisa autorizá-lo no Firebase Console.
              </p>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <p className="text-xs font-mono text-emerald-400">1. Vá para o Console Firebase → Authentication → Settings → Authorized Domains</p>
                <p className="text-xs font-mono text-emerald-400">2. Adicione o domínio: <span className="text-white bg-slate-800 px-1 rounded">{window.location.hostname}</span></p>
              </div>
              <p className="text-xs text-slate-500 italic">
                Sem este passo, o login com Google resultará em erro de "Domínio não autorizado".
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

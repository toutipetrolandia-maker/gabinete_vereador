import { useEffect, useState } from 'react';
import { 
  History, 
  Search, 
  Filter,
  User,
  Activity,
  Calendar,
  Database
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { logAction } from '../lib/audit';

export default function Settings() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'users'>('audit');
  const [usersList, setUsersList] = useState<any[]>([]);

  useEffect(() => {
    const qLogs = query(collection(db, 'logs'), orderBy('criado_em', 'desc'), limit(50));
    const unsubLogs = onSnapshot(qLogs, (snap) => {
      setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    const qUsers = query(collection(db, 'users'), orderBy('nome', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snap) => {
      setUsersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    return () => {
      unsubLogs();
      unsubUsers();
    };
  }, []);

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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Mini Nav */}
        <div className="space-y-2">
          <button 
            onClick={() => setActiveSubTab('audit')}
            className={cn(
              "w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
              activeSubTab === 'audit' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
            )}
          >
            <History size={18} />
            Trilha de Auditoria
          </button>
          {profile?.role === 'admin' && (
            <button 
              onClick={() => setActiveSubTab('users')}
              className={cn(
                "w-full text-left px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
                activeSubTab === 'users' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
              )}
            >
              <User size={18} />
              Gestão de Usuários
            </button>
          )}
          <button className="w-full text-left px-4 py-3 text-slate-400 hover:bg-slate-900 rounded-xl transition-all flex items-center gap-3">
            <Database size={18} />
            Backup e Dados
          </button>
        </div>

        <div className="lg:col-span-3 space-y-6">
          {activeSubTab === 'audit' ? (
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
              <div className="p-6 border-b border-slate-800">
                <h2 className="text-xl font-bold text-white mb-1">Controle de Acessos</h2>
                <p className="text-sm text-slate-500">Gerencie quem pode acessar o sistema e quais são suas atribuições.</p>
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
                      <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
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
                          <button 
                            disabled={profile?.role !== 'admin' || u.id === auth.currentUser?.uid}
                            onClick={() => handleToggleAtivo(u.id, !!u.ativo)}
                            className={cn(
                              "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                              u.ativo ? "text-red-400 hover:bg-red-500/10" : "text-emerald-400 hover:bg-emerald-500/10"
                            )}
                          >
                            {u.ativo ? 'Desativar' : 'Ativar'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
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

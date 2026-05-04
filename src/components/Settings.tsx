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
  Settings as SettingsIcon,
  Link as LinkIcon,
  BookOpen,
  ShieldCheck,
  CheckCircle2,
  Download,
  Save
} from 'lucide-react';
import { collection, query, orderBy, limit, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
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
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'users' | 'general' | 'super' | 'manual' | 'backup'>('audit');
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', role: 'atendente', ativo: false });
  const [appName, setAppName] = useState('Gabinete Digital');
  const [vereadorPhoto, setVereadorPhoto] = useState<string | null>(null);
  const [perfilLink, setPerfilLink] = useState('https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
  const [savingSettings, setSavingSettings] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [systemLocked, setSystemLocked] = useState(false);
  const [billingStatus, setBillingStatus] = useState<'regular' | 'pending' | 'suspended'>('regular');
  const [lgpdText, setLgpdText] = useState('Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const isSuperAdmin = profile?.email === 'cleciotecnologia@gmail.com';

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
        const data = snap.data();
        setAppName(data.app_name || 'Gabinete Digital');
        setVereadorPhoto(data.vereador_photo || null);
        setPerfilLink(data.perfil_link || 'https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
        setSystemLocked(!!data.system_locked);
        setBillingStatus(data.billing_status || 'regular');
        setLgpdText(data.lgpd_text || 'Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
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
      const data: any = {
        app_name: appName,
        vereador_photo: vereadorPhoto,
        perfil_link: perfilLink,
        lgpd_text: lgpdText,
        updated_at: serverTimestamp(),
      };
      
      if (isSuperAdmin) {
        data.system_locked = systemLocked;
        data.billing_status = billingStatus;
      }

      await setDoc(doc(db, 'app_settings', 'global'), data, { merge: true });
      await logAction('Atualizar Configurações', 'app_settings', 'global', { next: data });
      alert("Configurações salvas com sucesso!");
    } catch (error) {
      console.error("Erro ao salvar configurações:", error);
      alert("Erro ao salvar configurações. Verifique o console.");
    } finally {
      setSavingSettings(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 800000) { // ~800KB limit for base64 storage
      alert("A imagem é muito grande. Escolha uma imagem menor que 800KB.");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setVereadorPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateRole = async (userId: string, newRole: string) => {
    if (profile?.role !== 'admin' && !isSuperAdmin) return;
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
    if (profile?.role !== 'admin' && !isSuperAdmin) return;
    try {
      const userRef = doc(db, 'users', userId);
      const userToUpdate = usersList.find(u => u.id === userId);
      const actionLabel = currentStatus ? 'Desligamento (Desativação)' : 'Ativação de Usuário';
      
      await updateDoc(userRef, { ativo: !currentStatus });
      await logAction(actionLabel, 'users', userId, { 
        previous: { ativo: currentStatus, nome: userToUpdate?.nome }, 
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
      await logAction('Criar Usuário', 'users', 'novo', { next: newUser });
      setShowUserModal(false);
      setNewUser({ nome: '', email: '', role: 'atendente', ativo: true });
    } catch (err) {
      console.error("Erro ao criar usuário:", err);
    }
  };

  const handleDeleteUser = async (id: string, nome: string) => {
    if (id === auth.currentUser?.uid) return alert("Você não pode excluir a si mesmo.");
    if (!window.confirm(`ATENÇÃO: Você está prestes a EXCLUIR PERMANENTEMENTE o usuário ${nome}.\n\nEsta ação será registrada na auditoria como Desligamento Definitivo. Deseja continuar?`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', id));
      await logAction('Desligamento (Exclusão)', 'users', id, { 
        previous: { nome, status: 'Removido Permanentemente' } 
      });
    } catch (err) {
      console.error("Erro ao excluir usuário:", err);
    }
  };

  const handleBackup = async () => {
    if (!profile || profile.role !== 'admin') return;
    setBackingUp(true);
    try {
      const collections = [
        'atendimentos',
        'atendimentos_medicos',
        'demandas_parlamentares',
        'sugestoes',
        'malotes',
        'agenda_vereador',
        'users',
        'app_settings',
        'logs'
      ];

      const backupData: any = {
        version: '1.0',
        timestamp: new Date().toISOString(),
        author: profile.nome,
        data: {}
      };

      for (const col of collections) {
        const snap = await getDocs(collection(db, col));
        backupData.data[col] = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
      }

      const blob = new Blob([JSON.stringify(backupData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `backup_gabinete_digital_${format(new Date(), 'dd_MM_yyyy_HHmm')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      await logAction('Realizar Backup', 'sistema', 'backup', { 
        next: { timestamp: backupData.timestamp, exported_by: profile.nome } 
      });
    } catch (error) {
      console.error("Erro ao realizar backup:", error);
      alert("Erro ao realizar backup. Tente novamente.");
    } finally {
      setBackingUp(false);
    }
  };

  const [search, setSearch] = useState('');
  const filteredLogs = logs.filter(log => 
    log.usuario_nome?.toLowerCase().includes(search.toLowerCase()) ||
    log.acao?.toLowerCase().includes(search.toLowerCase()) ||
    log.colecao?.toLowerCase().includes(search.toLowerCase())
  );

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
          {isSuperAdmin && (
            <button 
              onClick={() => setActiveSubTab('super')}
              className={cn(
                "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
                activeSubTab === 'super' ? "bg-amber-600 text-white shadow-lg shadow-amber-900/20" : "text-slate-400 hover:bg-slate-900"
              )}
            >
              <Activity size={18} />
              Super Admin
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
          {(profile?.role === 'admin' || isSuperAdmin) && (
            <button 
              onClick={() => setActiveSubTab('users')}
              className={cn(
                "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
                activeSubTab === 'users' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
              )}
            >
              <User size={18} />
              Usuários / Assessores
            </button>
          )}

          <button 
            onClick={() => setActiveSubTab('backup')}
            className={cn(
              "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
              activeSubTab === 'backup' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-slate-400 hover:bg-slate-900"
            )}
          >
            <Save size={18} />
            Cópia de Segurança
          </button>

          <button 
            onClick={() => setActiveSubTab('manual')}
            className={cn(
              "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
              activeSubTab === 'manual' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
            )}
          >
            <BookOpen size={18} />
            Manual do Sistema
          </button>
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
                <div className="space-y-4">
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

                  <div className="space-y-4 pt-2">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Foto do Vereador</label>
                    <div className="flex items-center gap-6">
                      <div className="relative group">
                        <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center">
                          {vereadorPhoto ? (
                            <img src={vereadorPhoto} alt="Vereador" className="w-full h-full object-cover" />
                          ) : (
                            <User className="text-slate-600" size={32} />
                          )}
                        </div>
                        {vereadorPhoto && (
                          <button 
                            type="button"
                            onClick={() => setVereadorPhoto(null)}
                            className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <X size={14} />
                          </button>
                        )}
                      </div>
                      <div className="flex-1">
                        <label className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-3 rounded-xl cursor-pointer transition-all border border-slate-700">
                          Escolher Foto
                          <input 
                            type="file" 
                            accept="image/*"
                            onChange={handleFileChange}
                            className="hidden" 
                          />
                        </label>
                        <p className="text-[10px] text-slate-500 mt-2">Formatos aceitos: JPG, PNG. Tamanho máx: 800KB.</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Link do Perfil Oficial</label>
                    <div className="relative">
                      <input 
                        type="url" 
                        value={perfilLink}
                        onChange={e => setPerfilLink(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 pl-12 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        placeholder="https://www.cmpa.ba.gov.br/vereador/..."
                      />
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                        <LinkIcon size={18} />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 px-1 italic text-blue-400">
                      Link da Câmara Municipal ou Rede Social oficial.
                    </p>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={savingSettings}
                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-blue-900/20 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed w-full md:w-auto justify-center"
                >
                  {savingSettings ? 'Salvando...' : 'Salvar Alterações'}
                </button>
              </form>

              <div className="pt-8 border-t border-slate-800 space-y-4">
                 <div className="flex items-center gap-3 text-blue-400 font-bold uppercase text-xs tracking-widest">
                    <Database size={16} />
                    Configurações LGPD
                 </div>
                 <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-slate-500">Texto Base de Consentimento (LGPD)</label>
                    <textarea 
                      value={lgpdText}
                      onChange={e => setLgpdText(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-4 text-sm text-slate-300 min-h-[100px] outline-none focus:ring-1 focus:ring-blue-500"
                    />
                 </div>
              </div>

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
          ) : activeSubTab === 'super' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              <div className="bg-slate-900 border border-amber-500/20 rounded-3xl p-8 shadow-xl">
                 <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-2">
                    <Activity className="text-amber-500" size={24} />
                    Painel de Controle Super Admin
                 </h2>
                 <p className="text-slate-400 mb-8 border-b border-slate-800 pb-4">
                    Ferramentas exclusivas para manutenção do sistema e faturamento.
                 </p>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <div className="space-y-6">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Status do Sistema</h3>
                       <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex items-center justify-between">
                          <div>
                             <span className="block font-bold text-white mb-1">Trava de Segurança</span>
                             <p className="text-xs text-slate-500">Bloqueia instantaneamente o acesso para todos os usuários.</p>
                          </div>
                          <button 
                            onClick={() => setSystemLocked(!systemLocked)}
                            className={cn(
                              "w-14 h-8 rounded-full p-1 transition-all",
                              systemLocked ? "bg-red-600" : "bg-slate-700"
                            )}
                          >
                             <div className={cn(
                               "w-6 h-6 bg-white rounded-full transition-all shadow-md",
                               systemLocked ? "translate-x-6" : "translate-x-0"
                             )} />
                          </button>
                       </div>
                    </div>

                    <div className="space-y-6">
                       <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Gestão de Cobrança</h3>
                       <div className="space-y-4">
                          <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800">
                             <label className="text-[10px] font-bold uppercase text-slate-500 block mb-3">Status Financeiro</label>
                             <div className="grid grid-cols-3 gap-2">
                                {['regular', 'pending', 'suspended'].map((status) => (
                                  <button
                                    key={status}
                                    onClick={() => setBillingStatus(status as any)}
                                    className={cn(
                                      "py-2 px-3 rounded-lg text-[10px] font-bold uppercase transition-all border",
                                      billingStatus === status 
                                        ? "bg-amber-600 border-amber-500 text-white shadow-lg" 
                                        : "bg-slate-900 border-slate-800 text-slate-500 hover:border-slate-700"
                                    )}
                                  >
                                    {status === 'regular' ? 'Regular' : status === 'pending' ? 'Pendente' : 'Suspenso'}
                                  </button>
                                ))}
                             </div>
                             {billingStatus !== 'regular' && (
                               <p className="mt-4 p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-300">
                                  {billingStatus === 'pending' 
                                    ? "O cliente verá um aviso de 'Fatura Pendente' na Dashboard."
                                    : "O sistema será bloqueado e exibirá tela de suspensão por falta de pagamento."}
                               </p>
                             )}
                          </div>
                       </div>
                    </div>
                 </div>

                 <div className="mt-8 pt-6 border-t border-slate-800 flex justify-end">
                    <button 
                      onClick={handleUpdateSettings}
                      className="bg-amber-600 hover:bg-amber-700 text-white px-8 py-4 rounded-xl font-bold flex items-center gap-2 shadow-lg transition-all"
                    >
                       Aplicar Configurações de Super Admin
                    </button>
                 </div>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 mb-6">
                 <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <UserPlus className="text-emerald-500" size={20} />
                    Aprovações Pendentes
                 </h3>
                 <div className="space-y-3">
                    {usersList.filter(u => !u.ativo).length === 0 ? (
                      <p className="text-sm text-slate-500 italic">Nenhum usuário aguardando aprovação.</p>
                    ) : (
                      usersList.filter(u => !u.ativo).map(user => (
                        <div key={user.id} className="bg-slate-950 p-4 rounded-2xl border border-slate-800 flex items-center justify-between">
                           <div>
                              <span className="block font-bold text-white">{user.nome}</span>
                              <span className="text-xs text-slate-500">{user.email}</span>
                           </div>
                           <button 
                             onClick={() => handleToggleAtivo(user.id, false)}
                             className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-4 py-2 rounded-xl transition-all shadow-lg shadow-emerald-900/20"
                           >
                             Aprovar Acesso
                           </button>
                        </div>
                      ))
                    )}
                 </div>
              </div>
              
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                 <h3 className="text-lg font-bold text-white mb-4">Métricas de Faturamento Brutal</h3>
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                       <span className="text-[10px] uppercase text-slate-500 font-bold block">Usuários Ativos</span>
                       <span className="text-2xl font-bold text-white">{usersList.filter(u => u.ativo).length}</span>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                       <span className="text-[10px] uppercase text-slate-500 font-bold block">Logs Totais</span>
                       <span className="text-2xl font-bold text-white">{logs.length}</span>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                       <span className="text-[10px] uppercase text-slate-500 font-bold block">Valor Estimado</span>
                       <span className="text-2xl font-bold text-emerald-400">R$ 599,00</span>
                    </div>
                    <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                       <span className="text-[10px] uppercase text-slate-500 font-bold block">Próximo Venc.</span>
                       <span className="text-2xl font-bold text-white">10/05</span>
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

              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                <table className="w-full text-left min-w-[800px]">
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
                      <tr 
                        key={log.id} 
                        onClick={() => {
                          setSelectedLog(log);
                          setShowLogModal(true);
                        }}
                        className="hover:bg-slate-800/30 border-b border-slate-800 last:border-0 transition-colors cursor-pointer group"
                      >
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
                            log.acao?.includes('Criar') ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                            log.acao?.includes('Atualizar') ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20' :
                            log.acao?.includes('Desligamento') ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                            'bg-slate-500/10 text-slate-400 border border-slate-500/20'
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

              {/* Log Detail Modal */}
              <AnimatePresence>
                {showLogModal && selectedLog && (
                  <>
                    <motion.div 
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      onClick={() => setShowLogModal(false)}
                      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]" 
                    />
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                      animate={{ opacity: 1, scale: 1, y: 0 }} 
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="fixed inset-x-2 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-2xl bg-slate-900 border border-slate-800 rounded-3xl z-[101] shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
                    >
                      <div className="p-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                        <div>
                          <h3 className="text-xl font-bold text-white">Detalhes do Log</h3>
                          <p className="text-xs text-slate-500 font-mono mt-1">ID: {selectedLog.id}</p>
                        </div>
                        <button onClick={() => setShowLogModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 font-bold">
                          <X size={20} />
                        </button>
                      </div>
                      
                      <div className="p-6 overflow-y-auto space-y-6 scrollbar-thin scrollbar-thumb-slate-800">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Executor</span>
                            <span className="text-sm font-medium text-white">{selectedLog.usuario_nome}</span>
                          </div>
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Ação</span>
                            <span className={cn(
                              "text-xs font-bold font-mono",
                              selectedLog.acao?.includes('Criar') ? 'text-emerald-400' :
                              selectedLog.acao?.includes('Atualizar') ? 'text-blue-400' : 
                              selectedLog.acao?.includes('Desligamento') ? 'text-red-400' : 'text-slate-400'
                            )}>{selectedLog.acao}</span>
                          </div>
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Coleção</span>
                            <span className="text-xs text-white font-mono">{selectedLog.colecao}</span>
                          </div>
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                            <span className="block text-[10px] text-slate-500 uppercase font-bold mb-1">Data/Hora</span>
                            <span className="text-xs text-white">
                              {selectedLog.criado_em?.toDate ? format(selectedLog.criado_em.toDate(), "dd/MM/yyyy HH:mm:ss", { locale: ptBR }) : '...'}
                            </span>
                          </div>
                        </div>

                        {selectedLog.dados && (
                          <div className="space-y-4">
                            <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
                              {selectedLog.acao === 'Atualizar' ? 'Diferença de Dados' : 'Dados do Registro'}
                            </h4>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Previous Data / Before */}
                              {(selectedLog.dados.previous || selectedLog.acao === 'Excluir') && (
                                <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-red-400 uppercase">Anterior / Removido</span>
                                  <div className="bg-slate-950 border border-red-500/10 p-4 rounded-2xl text-[11px] font-mono whitespace-pre-wrap overflow-x-auto text-slate-400 max-h-[300px]">
                                    {JSON.stringify(selectedLog.dados.previous || selectedLog.dados, null, 2)}
                                  </div>
                                </div>
                              )}
                              
                              {/* Next Data / After */}
                              {(selectedLog.dados.next || selectedLog.acao === 'Criar') && (
                                <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-emerald-400 uppercase">Novo / Atual</span>
                                  <div className="bg-slate-950 border border-emerald-500/10 p-4 rounded-2xl text-[11px] font-mono whitespace-pre-wrap overflow-x-auto text-slate-200 max-h-[300px]">
                                    {JSON.stringify(selectedLog.dados.next || selectedLog.dados, null, 2)}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Single Data View (if not previous/next split properly) */}
                            {!selectedLog.dados.previous && !selectedLog.dados.next && selectedLog.acao !== 'Excluir' && selectedLog.acao !== 'Criar' && (
                               <div className="space-y-2">
                                  <span className="text-[10px] font-bold text-blue-400 uppercase">Conteúdo do Payload</span>
                                  <div className="bg-slate-950 border border-blue-500/10 p-4 rounded-2xl text-[11px] font-mono whitespace-pre-wrap overflow-x-auto text-slate-300 max-h-[400px]">
                                    {JSON.stringify(selectedLog.dados, null, 2)}
                                  </div>
                               </div>
                            )}
                          </div>
                        )}
                        
                        <div className="bg-blue-500/5 border border-blue-500/10 p-4 rounded-2xl">
                          <p className="text-[11px] text-slate-400 text-center italic">
                            Informação registrada de forma imutável pelo sistema de Auditoria.
                          </p>
                        </div>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
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

              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                <table className="w-full text-left min-w-[900px]">
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
                          <div className="flex items-center gap-3">
                            <div className="relative">
                              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-xs font-bold text-slate-400">
                                {u.nome?.[0] || 'U'}
                              </div>
                              <div className={cn(
                                "absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 border-slate-900",
                                u.status === 'online' ? "bg-emerald-500" : "bg-slate-600"
                              )} />
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold text-white">{u.nome}</span>
                              <span className="text-xs text-slate-500">{u.email}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            disabled={(!isSuperAdmin && profile?.role !== 'admin') || u.id === auth.currentUser?.uid}
                            value={u.role}
                            onChange={(e) => handleUpdateRole(u.id, e.target.value)}
                            className="bg-slate-800 border border-slate-700 rounded-lg text-xs p-2 text-slate-200 outline-none focus:ring-1 focus:ring-blue-500"
                          >
                            <option value="admin">Administrador</option>
                            <option value="atendente">Assessor Parlamentar</option>
                            <option value="vereador">Vereador</option>
                            <option value="consulta">Apenas Consulta</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <span className={cn(
                            "text-[10px] font-bold px-2 py-1 rounded-full uppercase",
                            u.ativo ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-500 animate-pulse border border-amber-500/20"
                          )}>
                            {u.ativo ? 'Ativo' : 'Pendente'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button 
                              disabled={(!isSuperAdmin && profile?.role !== 'admin') || u.id === auth.currentUser?.uid}
                              onClick={() => handleToggleAtivo(u.id, !!u.ativo)}
                              className={cn(
                                "text-xs font-bold px-3 py-1.5 rounded-lg transition-all",
                                u.ativo ? "text-slate-400 hover:text-red-400 hover:bg-red-500/10" : "bg-emerald-600 text-white hover:bg-emerald-700 shadow-lg shadow-emerald-900/20"
                              )}
                            >
                              {u.ativo ? 'Desativar' : 'Aprovar Usuário'}
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
                      initial={{ opacity: 0, scale: 0.95, y: 20 }} 
                      animate={{ opacity: 1, scale: 1, y: 0 }} 
                      exit={{ opacity: 0, scale: 0.95, y: 20 }}
                      className="fixed inset-x-2 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-slate-900 border border-slate-800 rounded-3xl z-[101] shadow-2xl overflow-hidden flex flex-col"
                    >
                      <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                        <h3 className="text-xl font-bold text-white">Novo Usuário</h3>
                        <button onClick={() => setShowUserModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400 font-bold">
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
                            <option value="atendente">Assessor Parlamentar</option>
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
          ) : activeSubTab === 'backup' ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-6"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8 border-b border-slate-800 pb-8">
                    <div>
                       <h2 className="text-2xl font-bold text-white flex items-center gap-3 mb-2">
                          <Database className="text-emerald-500" size={24} />
                          Cópia de Segurança (Backup)
                       </h2>
                       <p className="text-slate-400 max-w-lg">
                          Exporte todos os dados cadastrados no sistema (atendimentos, demandas, agenda e auditoria) para um arquivo JSON seguro.
                       </p>
                    </div>
                    <button 
                      onClick={handleBackup}
                      disabled={backingUp || profile?.role !== 'admin'}
                      className="bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed text-white px-8 py-4 rounded-2xl font-bold flex items-center gap-3 shadow-lg shadow-emerald-900/20 transition-all shrink-0"
                    >
                      {backingUp ? (
                         <>
                            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Processando...
                         </>
                      ) : (
                         <>
                            <Download size={20} />
                            Gerar Backup Agora
                         </>
                      )}
                    </button>
                 </div>

                 <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                    <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                       <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-400">
                          <ShieldCheck size={20} />
                       </div>
                       <h3 className="font-bold text-white text-sm">Segurança</h3>
                       <p className="text-xs text-slate-500 leading-relaxed">
                          O arquivo gerado contém dados sensíveis. Mantenha-o em local seguro e não compartilhe com terceiros.
                       </p>
                    </div>

                    <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                       <div className="w-10 h-10 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-400">
                          <History size={20} />
                       </div>
                       <h3 className="font-bold text-white text-sm">Frequência</h3>
                       <p className="text-xs text-slate-500 leading-relaxed">
                          Recomendamos a realização de backups semanais para garantir que você tenha sempre uma cópia atualizada dos dados.
                       </p>
                    </div>

                    <div className="p-6 bg-slate-950 rounded-2xl border border-slate-800 space-y-4">
                       <div className="w-10 h-10 rounded-full bg-amber-500/10 flex items-center justify-center text-amber-400">
                          <Activity size={20} />
                       </div>
                       <h3 className="font-bold text-white text-sm">Formato</h3>
                       <p className="text-xs text-slate-500 leading-relaxed">
                          Os dados são exportados em formato JSON, compatível com planilhas e outros sistemas de banco de dados.
                       </p>
                    </div>
                 </div>

                 <div className="mt-8 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                    <div className="flex gap-3">
                       <div className="p-2 bg-blue-500/10 rounded-lg text-blue-400 h-fit">
                          <SettingsIcon size={16} />
                       </div>
                       <div>
                          <h4 className="text-xs font-bold text-blue-300 uppercase mb-1">Backup Automático</h4>
                          <p className="text-[10px] text-blue-300/60 leading-relaxed">
                             O sistema realiza espelhamentos diários em servidores redundantes da Clécio Tecnologia via Google Cloud, porém a cópia de segurança manual é uma camada extra de proteção sob controle do Gabinete.
                          </p>
                       </div>
                    </div>
                 </div>
              </div>
            </motion.div>
          ) : activeSubTab === 'manual' ? (
            <motion.div 
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              className="space-y-8"
            >
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl">
                 <h2 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
                    <BookOpen className="text-blue-500" size={24} />
                    Manual do Sistema
                 </h2>
                 <p className="text-slate-400 mb-8 border-b border-slate-800 pb-6">
                    Guia rápido de utilização e definição de perfis de acesso para o Gabinete Digital.
                 </p>

                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    <section className="space-y-4">
                       <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <ShieldCheck className="text-emerald-500" size={20} />
                          Perfis de Acesso
                       </h3>
                       <div className="space-y-4">
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                             <span className="text-xs font-black uppercase text-emerald-500 tracking-widest block mb-1">Administrador</span>
                             <p className="text-xs text-slate-400 leading-relaxed">
                                Acesso total ao sistema. Pode gerenciar usuários, visualizar auditoria, alterar configurações do gabinete e excluir registros sensíveis.
                             </p>
                          </div>
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                             <span className="text-xs font-black uppercase text-blue-500 tracking-widest block mb-1">Assessor Parlamentar</span>
                             <p className="text-xs text-slate-400 leading-relaxed">
                                Perfil operacional. Realiza cadastros de atendimentos, demandas, malotes e gerencia a agenda. Não possui acesso às configurações críticas ou auditoria.
                             </p>
                          </div>
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                             <span className="text-xs font-black uppercase text-amber-500 tracking-widest block mb-1">Vereador</span>
                             <p className="text-xs text-slate-400 leading-relaxed">
                                Acesso analítico e estratégico. Pode visualizar todos os relatórios, auditoria e agenda, mas tem restrições em alterações de configurações de sistema.
                             </p>
                          </div>
                          <div className="bg-slate-950 p-4 rounded-2xl border border-slate-800">
                             <span className="text-xs font-black uppercase text-slate-500 tracking-widest block mb-1">Apenas Consulta</span>
                             <p className="text-xs text-slate-400 leading-relaxed">
                                Acesso restrito apenas para visualização de dados. Não pode criar, editar ou excluir nenhuma informação no sistema.
                             </p>
                          </div>
                       </div>
                    </section>

                    <section className="space-y-6">
                       <h3 className="text-lg font-bold text-white flex items-center gap-2">
                          <CheckCircle2 className="text-blue-500" size={20} />
                          Instruções de Uso
                       </h3>
                       <div className="space-y-6">
                          <div>
                             <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">1. Cadastro de Cidadãos</h4>
                             <p className="text-xs text-slate-500 leading-relaxed px-2 border-l border-slate-800">
                                Sempre solicite o CPF. O sistema faz o cruzamento automático com o histórico médico para fornecer insights aos assessores no momento do atendimento.
                             </p>
                          </div>
                          <div>
                             <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">2. Gestão de Demandas</h4>
                             <p className="text-xs text-slate-500 leading-relaxed px-2 border-l border-slate-800">
                                Utilize o status 'Concluído' apenas quando o ofício ou solicitação tiver um retorno definitivo do órgão responsável.
                             </p>
                          </div>
                          <div>
                             <h4 className="text-xs font-bold text-slate-300 uppercase mb-2">3. Segurança e LGPD</h4>
                             <p className="text-xs text-slate-500 leading-relaxed px-2 border-l border-slate-800">
                                No cadastro de atendimentos, certifique-se de marcar o consentimento de dados. O sistema registra quem acessou e quem alterou cada documento (Auditoria).
                             </p>
                          </div>
                          <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl">
                             <h4 className="text-xs font-bold text-blue-400 uppercase mb-1">Suporte Técnico</h4>
                             <p className="text-[10px] text-blue-300/70 italic">
                                Para problemas técnicos ou solicitações de novas funcionalidades, entre em contato com o suporte da Clécio Tecnologia.
                             </p>
                          </div>
                       </div>
                    </section>
                 </div>
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

import React, { useEffect, useState } from 'react';
import { 
  History, 
  Search, 
  Filter,
  User,
  Activity,
  Calendar,
  Clock,
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
  Save,
  Fingerprint,
  ShieldAlert,
  MessageSquare
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
  const [activeSubTab, setActiveSubTab] = useState<'audit' | 'users' | 'general' | 'super' | 'manual' | 'backup' | 'security'>('audit');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('biometric_enabled') === 'true');
  const [biometricLoading, setBiometricLoading] = useState(false);

  useEffect(() => {
    const checkSupport = async () => {
      const { isBiometricSupported } = await import('../lib/webauthn');
      const supported = await isBiometricSupported();
      setBiometricSupported(supported);
    };
    checkSupport();
  }, []);

  const handleToggleBiometrics = async () => {
    if (!biometricSupported) return;
    
    setBiometricLoading(true);
    try {
      const { registerBiometrics } = await import('../lib/webauthn');
      
      if (!biometricEnabled) {
        // Ativando: precisa registrar
        const success = await registerBiometrics(auth.currentUser?.uid || 'user', auth.currentUser?.email || 'user@example.com');
        if (success) {
          localStorage.setItem('biometric_enabled', 'true');
          setBiometricEnabled(true);
          alert("Segurança biométrica ativada com sucesso neste dispositivo!");
        }
      } else {
        // Desativando
        localStorage.removeItem('biometric_enabled');
        localStorage.removeItem('biometric_registered');
        setBiometricEnabled(false);
        alert("Segurança biométrica desativada.");
      }
    } catch (err: any) {
      console.error("Erro ao configurar biometria:", err);
      if (err.name !== 'NotAllowedError') {
        alert("Erro ao configurar biometria. Certifique-se que seu dispositivo possui bloqueio de tela ativo.");
      }
    } finally {
      setBiometricLoading(false);
    }
  };
  const [usersList, setUsersList] = useState<any[]>([]);
  const [showUserModal, setShowUserModal] = useState(false);
  const [newUser, setNewUser] = useState({ nome: '', email: '', role: 'assessor', ativo: false });
  const [appName, setAppName] = useState('Gabinete Digital');
  const [vereadorPhoto, setVereadorPhoto] = useState<string | null>(null);
  const [perfilLink, setPerfilLink] = useState('https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
  const [savingSettings, setSavingSettings] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [systemLocked, setSystemLocked] = useState(false);
  const [billingStatus, setBillingStatus] = useState<'regular' | 'pending' | 'suspended'>('regular');
  const [lgpdText, setLgpdText] = useState('Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
  const [atendimentoInicio, setAtendimentoInicio] = useState('08:00');
  const [atendimentoFim, setAtendimentoFim] = useState('13:00');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);

  const isSuperAdmin = profile?.email === 'cleciotecnologia@gmail.com';

  useEffect(() => {
    if (!profile) return;

    let unsubLogs = () => {};
    let unsubUsers = () => {};

    if (profile.role === 'admin' || profile.role === 'vereador' || isSuperAdmin) {
      const qLogs = query(collection(db, 'logs'), orderBy('criado_em', 'desc'), limit(50));
      unsubLogs = onSnapshot(qLogs, (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (error) => {
        console.error("Error listening to logs:", error);
      });
    }

    if (profile.role === 'admin' || profile.role === 'vereador' || profile.role === 'assessor' || isSuperAdmin) {
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
        setAtendimentoInicio(data.atendimento_inicio || '08:00');
        setAtendimentoFim(data.atendimento_fim || '13:00');
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
    if (profile?.role !== 'admin' && profile?.role !== 'vereador') return;
    setSavingSettings(true);
    try {
      const data: any = {
        app_name: appName,
        vereador_photo: vereadorPhoto,
        perfil_link: perfilLink,
        lgpd_text: lgpdText,
        atendimento_inicio: atendimentoInicio,
        atendimento_fim: atendimentoFim,
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
    if (profile?.role !== 'admin' && profile?.role !== 'vereador' && !isSuperAdmin) return;
    try {
      const userRef = doc(db, 'users', userId);
      const userToUpdate = usersList.find(u => u.id === userId);
      const actionLabel = currentStatus ? 'Desligamento (Desativação)' : 'Aprovação de Acesso (Ativação)';
      
      await updateDoc(userRef, { ativo: !currentStatus });
      await logAction(actionLabel, 'users', userId, { 
        previous: { ativo: currentStatus, nome: userToUpdate?.nome, email: userToUpdate?.email }, 
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
      setNewUser({ nome: '', email: '', role: 'assessor', ativo: true });
      alert("Usuário cadastrado com sucesso! Ele já pode acessar o sistema via Google Login.");
    } catch (err: any) {
      console.error("Erro ao criar usuário:", err);
      alert("Erro ao criar usuário: " + (err.message || String(err)));
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
      alert("Usuário removido com sucesso.");
    } catch (err: any) {
      console.error("Erro ao excluir usuário:", err);
      alert("Erro ao excluir usuário: " + (err.message || String(err)));
    }
  };

  const handleBackup = async () => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'vereador')) return;
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
        author: profile.nome || profile.email,
        data: {}
      };

      for (const col of collections) {
        try {
          const snap = await getDocs(collection(db, col));
          backupData.data[col] = snap.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          }));
        } catch (colError) {
          console.error(`Erro ao buscar coleção ${col}:`, colError);
          backupData.data[col] = { error: "Não foi possível exportar esta coleção", details: String(colError) };
        }
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
        next: { timestamp: backupData.timestamp, exported_by: profile.nome || profile.email } 
      });
      alert("Cópia de segurança realizada com sucesso!");
    } catch (error) {
      console.error("Erro ao realizar backup:", error);
      alert("Erro ao realizar backup: " + (error instanceof Error ? error.message : String(error)));
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
          {(profile?.role === 'admin' || profile?.role === 'vereador') && (
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
          {(profile?.role === 'admin' || profile?.role === 'vereador' || isSuperAdmin) && (
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
          )}
          {(profile?.role === 'admin' || profile?.role === 'vereador' || profile?.role === 'assessor' || isSuperAdmin) && (
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

          {(profile?.role === 'admin' || profile?.role === 'vereador' || isSuperAdmin) && (
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
          )}

          <button 
            onClick={() => setActiveSubTab('security')}
            className={cn(
              "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
              activeSubTab === 'security' ? "bg-purple-600 text-white shadow-lg shadow-purple-900/20" : "text-slate-400 hover:bg-slate-900"
            )}
          >
            <ShieldCheck size={18} />
            Privacidade e Mobile
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

                  <div className="pt-4 space-y-4 border-t border-slate-800/50">
                    <div className="flex items-center gap-3 text-blue-400 font-bold uppercase text-xs tracking-widest">
                      <Clock size={16} />
                      Horário de Atendimento
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Início</label>
                        <input 
                          type="time" 
                          value={atendimentoInicio}
                          onChange={e => setAtendimentoInicio(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Fim</label>
                        <input 
                          type="time" 
                          value={atendimentoFim}
                          onChange={e => setAtendimentoFim(e.target.value)}
                          className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all"
                        />
                      </div>
                    </div>
                    <p className="text-[10px] text-slate-500 px-1 italic">Este intervalo define o horário padrão de funcionamento do gabinete.</p>
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
            </motion.div>
          ) : activeSubTab === 'super' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-6"
            >
              {/* ... Super admin content ... */}
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
                          <span className={cn(
                            "text-[11px] font-bold py-1 px-2 rounded font-mono border",
                            log.acao?.includes('Criar') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            log.acao?.includes('Atualizar') ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' :
                            log.acao?.includes('Adiar') ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                            log.acao?.includes('Excluir') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            log.acao?.includes('Desligamento') ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                            log.acao?.includes('Aprovação') ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                            log.acao?.includes('Sessão') ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' :
                            log.acao === 'Primeiro Acesso' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' :
                            'bg-slate-500/10 text-slate-400 border-slate-500/20'
                          )}>
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
                      key="log-backdrop"
                      initial={{ opacity: 0 }} 
                      animate={{ opacity: 1 }} 
                      exit={{ opacity: 0 }} 
                      onClick={() => setShowLogModal(false)}
                      className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]" 
                    />
                    <motion.div 
                      key="log-modal"
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
                              selectedLog.acao?.includes('Adiar') ? 'text-amber-400' : 
                              selectedLog.acao?.includes('Excluir') ? 'text-red-400' :
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

                        <div className="space-y-6">
                          <h4 className="text-xs font-bold uppercase text-slate-500 tracking-widest flex items-center gap-2">
                             Detalhamento de Dados
                          </h4>
                          
                          <div className="grid grid-cols-1 gap-6">
                            {/* Comparison View */}
                            {selectedLog.dados_anteriores && selectedLog.dados_novos ? (
                              <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4 text-[10px] uppercase font-black tracking-widest px-4">
                                   <div className="text-red-400">Estado Anterior</div>
                                   <div className="text-emerald-400">Estado Atualizado</div>
                                </div>
                                <div className="bg-slate-950 border border-slate-800 rounded-2xl divide-y divide-slate-900 overflow-hidden">
                                  {Object.keys({ ...selectedLog.dados_anteriores, ...selectedLog.dados_novos }).map(key => {
                                    const prev = selectedLog.dados_anteriores[key];
                                    const next = selectedLog.dados_novos[key];
                                    const isChanged = JSON.stringify(prev) !== JSON.stringify(next);
                                    
                                    if (key === 'updated_at' || key === 'id' || key === 'criado_em') return null;

                                    return (
                                      <div key={key} className={cn(
                                        "grid grid-cols-2 gap-4 p-4",
                                        isChanged ? "bg-blue-500/[0.02]" : "opacity-50"
                                      )}>
                                        <div className="space-y-1">
                                          <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">{key.replace(/_/g, ' ')}</div>
                                          <div className="text-xs text-slate-400 break-all">
                                            {prev ? String(prev) : <span className="text-slate-800 italic">vazio</span>}
                                          </div>
                                        </div>
                                        <div className="space-y-1">
                                          <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">{key.replace(/_/g, ' ')}</div>
                                          <div className={cn(
                                            "text-xs break-all",
                                            isChanged ? "text-emerald-400 font-bold" : "text-slate-400"
                                          )}>
                                            {next ? String(next) : <span className="text-slate-800 italic">vazio</span>}
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : (
                              <div className="bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden">
                                {selectedLog.dados_anteriores || selectedLog.dados_novos ? (
                                  Object.entries(selectedLog.dados_anteriores || selectedLog.dados_novos).map(([key, val]) => (
                                    <div key={key} className="p-4 border-b border-slate-900 last:border-0 hover:bg-slate-900/50 transition-colors">
                                      <div className="text-[10px] font-bold text-slate-600 uppercase mb-1">{key.replace(/_/g, ' ')}</div>
                                      <div className={cn(
                                        "text-xs break-all",
                                        selectedLog.acao?.includes('Criar') ? "text-emerald-400 font-medium" : 
                                        selectedLog.acao?.includes('Excluir') ? "text-red-400" : "text-slate-300"
                                      )}>
                                        {val ? String(val) : <span className="text-slate-800 italic">nulo/vazio</span>}
                                      </div>
                                    </div>
                                  ))
                                ) : (
                                  <div className="p-10 text-center text-slate-600 italic text-xs">
                                    Nenhum detalhe adicional disponível para este registro meta-data.
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        
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
                {(profile?.role === 'admin' || isSuperAdmin) && (
                  <button 
                    onClick={() => setShowUserModal(true)}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
                  >
                    <UserPlus size={18} />
                    Novo Usuário
                  </button>
                )}
              </div>

              <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
                <table className="w-full text-left min-w-[800px]">
                  <thead>
                    <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500">
                      <th className="px-6 py-4 font-bold">Nome / Email</th>
                      <th className="px-6 py-4 font-bold">Papel</th>
                      <th className="px-6 py-4 font-bold">Status</th>
                      <th className="px-6 py-4 font-bold">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {usersList
                      .filter(user => {
                        if (profile?.role === 'assessor') {
                          return user.role === 'admin' || user.role === 'vereador';
                        }
                        return true;
                      })
                      .map((user) => (
                      <tr key={user.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <span className="block text-sm font-medium text-white">{user.nome}</span>
                            <span className="text-xs text-slate-500">{user.email}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <select 
                            value={user.role}
                            onChange={(e) => handleUpdateRole(user.id, e.target.value)}
                            disabled={profile?.role !== 'admin' && !isSuperAdmin}
                            className="bg-slate-800 border border-slate-700 rounded-lg text-xs p-1 text-slate-300 outline-none focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
                          >
                            <option value="assessor">Assessor</option>
                            <option value="vereador">Vereador</option>
                            <option value="admin">Administrador</option>
                            <option value="secretaria_parlamentar">Secretaria Parlamentar</option>
                            <option value="consulta">Apenas Consulta</option>
                          </select>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => handleToggleAtivo(user.id, user.ativo)}
                            disabled={profile?.role !== 'admin' && !isSuperAdmin}
                            className={cn(
                              "text-[10px] font-bold uppercase px-2 py-1 rounded flex items-center gap-1 transition-all",
                              user.ativo ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-red-500/10 text-red-400 border border-red-500/20"
                            )}
                          >
                            <ShieldCheck size={12} />
                            {user.ativo ? 'Ativo' : 'Inativo'}
                          </button>
                        </td>
                        <td className="px-6 py-4">
                          {(profile?.role === 'admin' || isSuperAdmin) && (
                            <button 
                              onClick={() => handleDeleteUser(user.id, user.nome)}
                              className="p-2 text-slate-500 hover:text-red-400 transition-colors"
                              title="Remover permanentemente"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </motion.div>
          ) : activeSubTab === 'backup' ? (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-6"
            >
              <div className="flex items-center gap-4 mb-2">
                <div className="w-16 h-16 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20 shadow-inner">
                  <Database size={32} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">Cópia de Segurança (Backup)</h2>
                  <p className="text-slate-400 text-sm">Exporte todos os dados críticos do sistema para um arquivo seguro.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4">
                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500">Exportar Dados</h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Ao realizar o backup, o sistema compilará todos os registros de atendimentos, demandas, usuários e logs em um único arquivo JSON. Recomendamos realizar esta operação mensalmente para segurança extrema.
                  </p>
                  <button 
                    onClick={handleBackup}
                    disabled={backingUp}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-6 rounded-xl shadow-lg shadow-emerald-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {backingUp ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Processando...
                      </>
                    ) : (
                      <>
                        <Download size={20} />
                        Gerar Arquivo (.json)
                      </>
                    )}
                  </button>
                </div>

                <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4 flex flex-col justify-center text-center">
                   <div className="mx-auto w-12 h-12 bg-blue-500/10 rounded-full flex items-center justify-center mb-2">
                      <ShieldCheck className="text-blue-500" size={24} />
                   </div>
                   <h3 className="text-sm font-bold text-slate-300">Integridade de Dados</h3>
                   <p className="text-[11px] text-slate-500">
                     A exportação inclui todas as coleções do banco de dados, permitindo a restauração completa em caso de auditoria externa ou necessidade técnica.
                   </p>
                </div>
              </div>
            </motion.div>
          ) : activeSubTab === 'security' ? (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8"
            >
               <div>
                  <h2 className="text-2xl font-bold text-white mb-1">Privacidade e Mobile</h2>
                  <p className="text-slate-400">Gerencie a segurança local e o comportamento do sistema em dispositivos móveis.</p>
               </div>

               <div className="space-y-6 max-w-xl">
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6">
                     <div className="flex items-start justify-between gap-4">
                        <div className="space-y-1">
                           <div className="flex items-center gap-2">
                              <Fingerprint className="text-purple-400" size={20} />
                              <h3 className="font-bold text-slate-200">Acesso por Biometria / PIN</h3>
                           </div>
                           <p className="text-xs text-slate-500 leading-relaxed">
                              Utiliza o bloqueio padrão do seu celular (iOS ou Android) para proteger o acesso aos dados do gabinete. Recomendado se você costuma deixar o app logado.
                           </p>
                        </div>
                        <button 
                           onClick={handleToggleBiometrics}
                           disabled={biometricLoading || !biometricSupported}
                           className={cn(
                              "relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none disabled:opacity-30",
                              biometricEnabled ? "bg-purple-600" : "bg-slate-700"
                           )}
                        >
                           <span className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              biometricEnabled ? "translate-x-6" : "translate-x-1"
                           )} />
                        </button>
                     </div>

                     {!biometricSupported && (
                        <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex items-center gap-3">
                           <ShieldAlert className="text-amber-500 shrink-0" size={18} />
                           <p className="text-[10px] text-amber-500 font-medium">
                              Seu navegador ou dispositivo não suporta o padrão WebAuthn necessário para biometria nativa. Tente usar o Chrome ou Safari atualizados.
                           </p>
                        </div>
                     )}

                     {biometricEnabled && (
                        <div className="bg-emerald-500/5 border border-emerald-500/10 p-4 rounded-xl">
                           <p className="text-[10px] text-emerald-400 font-bold uppercase tracking-widest text-center">
                              Dispositivo Protegido
                           </p>
                        </div>
                     )}
                  </div>

                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-4">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-slate-500">Dicas de Segurança Mobile</h3>
                     <ul className="space-y-2">
                        <li className="flex items-start gap-2 text-[11px] text-slate-400">
                           <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                           Nunca compartilhe sua conta do Google usada para este sistema.
                        </li>
                        <li className="flex items-start gap-2 text-[11px] text-slate-400">
                           <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                           A biometria é configurada individualmente para cada aparelho.
                        </li>
                        <li className="flex items-start gap-2 text-[11px] text-slate-400">
                           <div className="w-1 h-1 rounded-full bg-blue-500 mt-1.5 shrink-0" />
                           Caso perca o celular, desative o acesso na lista de usuários.
                        </li>
                     </ul>
                  </div>
               </div>
            </motion.div>
          ) : (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-10 font-sans shadow-xl text-slate-300 leading-relaxed space-y-6"
            >
              <h2 className="text-3xl font-bold text-white mb-2">Manual do Usuário</h2>
              <p className="italic text-blue-400 text-sm">Gabinete Digital v1.0.4 - Otimizado para Eficiência Parlamentar</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-6 text-sm">
                <section className="space-y-4">
                  <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">1</div>
                    Atendimentos
                  </h3>
                  <p>Registre todos os pedidos e visitas. Utilize o campo "Zona Rural" para marcar localizações exatas quando o cidadão for do campo. O status "Pendente" ajuda a equipe a não esquecer nenhum retorno.</p>
                </section>
                
                <section className="space-y-4">
                  <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">2</div>
                    Demandas
                  </h3>
                  <p>Acompanhe pedidos de ofícios e solicitações de melhorias públicas. Cada demanda pode ser vinculada a um local e prioridade, facilitando a pressão política nos órgãos competentes.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">3</div>
                    Segurança e Auditoria
                  </h3>
                  <p>O sistema registra cada ação (Criação, Edição, Exclusão). Admins podem ver quem mudou o quê e quando, garantindo que nenhum dado suma sem explicação.</p>
                </section>

                <section className="space-y-4">
                  <h3 className="text-white font-bold flex items-center gap-2 text-lg">
                    <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center text-blue-400">4</div>
                    Agenda
                  </h3>
                  <p>Gerencie os compromissos do Vereador. Você pode Adiar (para o dia seguinte), Remarcar (editar detalhes) ou Excluir eventos diretamente da visualização semanal.</p>
                </section>

                <section className="col-span-full pt-6 border-t border-slate-800 space-y-4">
                  <h3 className="text-emerald-400 font-bold flex items-center gap-3 text-xl">
                    <MessageSquare size={24} />
                    Suporte Técnico
                  </h3>
                  <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
                     <div className="space-y-2">
                        <p className="text-slate-300">Precisa de ajuda ou encontrou algum problema?</p>
                        <p className="text-xs text-slate-500">Estamos disponíveis para suporte técnico e atualizações do sistema.</p>
                     </div>
                     <a 
                       href="https://wa.me/5575988017239" 
                       target="_blank" 
                       rel="noopener noreferrer"
                       className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 px-8 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all flex items-center gap-3 w-full md:w-auto justify-center"
                     >
                        <MessageSquare size={20} />
                        Suporte no WhatsApp
                     </a>
                  </div>
                </section>
              </div>
            </motion.div>
          )}
        </div>
      </div>

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
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-md bg-slate-900 border border-slate-800 rounded-3xl p-8 z-[101] shadow-2xl"
            >
              <h3 className="text-xl font-bold text-white mb-6">Criar Acesso ao Sistema</h3>
              <form onSubmit={handleCreateUser} className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Nome Completo</label>
                  <input 
                    type="text" 
                    required
                    value={newUser.nome}
                    onChange={e => setNewUser({...newUser, nome: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Email Principal</label>
                  <input 
                    type="email" 
                    required
                    value={newUser.email}
                    onChange={e => setNewUser({...newUser, email: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Papel</label>
                    <select 
                      value={newUser.role}
                      onChange={e => setNewUser({...newUser, role: e.target.value as any})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-blue-500 transition-all text-sm"
                    >
                      <option value="assessor">Assessor</option>
                      <option value="vereador">Vereador</option>
                      <option value="admin">Administrador</option>
                      <option value="secretaria_parlamentar">Secretaria Parlamentar</option>
                      <option value="consulta">Apenas Consulta</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Status Ativo</label>
                    <div className="flex items-center gap-3 h-[46px]">
                       <button 
                         type="button"
                         onClick={() => setNewUser({...newUser, ativo: !newUser.ativo})}
                         className={cn(
                           "flex-1 h-full rounded-xl flex items-center justify-center font-bold text-xs uppercase transition-all",
                           newUser.ativo ? "bg-emerald-600/20 text-emerald-400 border border-emerald-500/20" : "bg-slate-800 text-slate-500 border border-slate-700"
                         )}
                       >
                         {newUser.ativo ? 'Confirmar' : 'Ativar'}
                       </button>
                    </div>
                  </div>
                </div>
                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setShowUserModal(false)}
                    className="flex-1 py-4 text-sm font-bold text-slate-500 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all"
                  >
                    Criar Usuário
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

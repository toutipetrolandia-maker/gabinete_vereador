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
  MessageSquare,
  ExternalLink,
  Globe
} from 'lucide-react';
import { collection, query, where, orderBy, limit, onSnapshot, doc, updateDoc, addDoc, setDoc, deleteDoc, serverTimestamp, getDocs } from 'firebase/firestore';
import { 
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
  sendPasswordResetEmail 
} from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { logAction } from '../lib/audit';
import UserManagement from './UserManagement';

export default function Settings() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState<'profile' | 'audit' | 'users' | 'general' | 'manual' | 'backup' | 'security'>('profile');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [biometricEnabled, setBiometricEnabled] = useState(localStorage.getItem('biometric_enabled') === 'true');
  const [biometricLoading, setBiometricLoading] = useState(false);

  // Password Change State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [passwordSuccess, setPasswordSuccess] = useState(false);

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
  const [appName, setAppName] = useState('Gabinete Digital');
  const [customDomain, setCustomDomain] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [vereadorPhoto, setVereadorPhoto] = useState<string | null>(null);
  const [cabinetLogo, setCabinetLogo] = useState<string | null>(null);
  const [perfilLink, setPerfilLink] = useState('');
  const [perfilLabel, setPerfilLabel] = useState('Câmara Municipal');
  const [savingSettings, setSavingSettings] = useState(false);
  const [userPhoto, setUserPhoto] = useState<string | null>(profile?.photo_url || null);
  const [userNome, setUserNome] = useState(profile?.nome || '');
  const [savingProfile, setSavingProfile] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [systemLocked, setSystemLocked] = useState(false);
  const [billingStatus, setBillingStatus] = useState<'regular' | 'pending' | 'suspended'>('regular');
  const [lgpdText, setLgpdText] = useState('Ao utilizar este sistema, você concorda com a coleta e processamento de dados pessoais de acordo com a LGPD para fins de gestão parlamentar.');
  const [atendimentoInicio, setAtendimentoInicio] = useState('08:00');
  const [atendimentoFim, setAtendimentoFim] = useState('13:00');
  const [biography, setBiography] = useState('');
  const [selectedLog, setSelectedLog] = useState<any | null>(null);
  const [showLogModal, setShowLogModal] = useState(false);
  const [cabinetsList, setCabinetsList] = useState<any[]>([]);
  const [allUsersList, setAllUsersList] = useState<any[]>([]);

  const isSuperAdmin = profile?.email === 'cleciotecnologia@gmail.com' || profile?.email === 'toutipetrolandia@gmail.com';

  useEffect(() => {
    if (!profile?.cabinetId) return;

    let unsubLogs = () => {};
    let unsubAllCabinets = () => {};
    let unsubAllUsers = () => {};

    if (isSuperAdmin) {
       const qCabinets = query(collection(db, 'cabinets'));
       unsubAllCabinets = onSnapshot(qCabinets, (snap) => {
         setCabinetsList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
       });

       const qAllUsers = query(collection(db, 'users'));
       unsubAllUsers = onSnapshot(qAllUsers, (snap) => {
         setAllUsersList(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
       });
    }

    if (profile.role === 'admin' || profile.role === 'vereador' || profile.role === 'secretaria_parlamentar' || isSuperAdmin) {
      const qLogs = query(
        collection(db, 'logs'), 
        where('cabinetId', '==', profile.cabinetId),
        orderBy('criado_em', 'desc'), 
        limit(50)
      );
      unsubLogs = onSnapshot(qLogs, (snap) => {
        setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        setLoading(false);
      }, (error) => {
        console.error("Error listening to logs:", error);
      });
    }

    const unsubSettings = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAppName(data.app_name || data.name || 'Gabinete Digital');
        setCustomDomain(data.custom_domain || '');
        setSubdomain(data.subdomain || '');
        setVereadorPhoto(data.vereador_photo || null);
        setCabinetLogo(data.cabinet_logo || data.vereador_photo || null);
        setPerfilLink(data.perfil_link || '');
        setPerfilLabel(data.perfil_label || 'Câmara Municipal');
        setBiography(data.biography || '');
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
      unsubSettings();
      unsubAllCabinets();
      unsubAllUsers();
    };
  }, [profile]);

  const handleUpdateSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    if (profile?.role !== 'admin' && profile?.role !== 'vereador' && profile?.role !== 'secretaria_parlamentar') return;
    setSavingSettings(true);
    try {
      const data: any = {
        app_name: appName,
        custom_domain: customDomain,
        subdomain: subdomain,
        vereador_photo: vereadorPhoto,
        cabinet_logo: cabinetLogo,
        perfil_link: perfilLink,
        perfil_label: perfilLabel,
        lgpd_text: lgpdText,
        atendimento_inicio: atendimentoInicio,
        atendimento_fim: atendimentoFim,
        biography: biography,
        updated_at: serverTimestamp(),
      };
      
      if (isSuperAdmin) {
        data.system_locked = systemLocked;
        data.billing_status = billingStatus;
      }

      await setDoc(doc(db, 'cabinets', profile.cabinetId), data, { merge: true });
      await logAction('Atualizar Configurações', 'cabinets', profile.cabinetId, { next: data });
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

  const handleCabinetLogoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800000) {
      alert("A imagem é muito grande. Escolha uma imagem menor que 800KB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setCabinetLogo(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUserPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 800000) {
      alert("A imagem é muito grande. Escolha uma imagem menor que 800KB.");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setUserPhoto(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    setSavingProfile(true);
    try {
      const data = {
        nome: userNome,
        photo_url: userPhoto,
        updated_at: serverTimestamp()
      };
      await updateDoc(doc(db, 'users', auth.currentUser.uid), data);
      await logAction('Atualizar Perfil', 'users', auth.currentUser.uid, { next: data });
      alert("Perfil atualizado com sucesso!");
    } catch (error) {
      console.error("Erro ao atualizar perfil:", error);
      alert("Erro ao atualizar perfil.");
    } finally {
      setSavingProfile(false);
    }
  };

  const handleBackup = async () => {
    if (!profile || (profile.role !== 'admin' && profile.role !== 'vereador' && profile.role !== 'secretaria_parlamentar')) return;
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

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setPasswordError("As senhas não coincidem.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordError("A nova senha deve ter pelo menos 6 caracteres.");
      return;
    }

    setPasswordLoading(true);
    setPasswordError(null);
    setPasswordSuccess(false);

    try {
      const user = auth.currentUser;
      if (!user || !user.email) throw new Error("Usuário não autenticado.");

      // Reautenticação é necessária para trocar a senha
      const credential = EmailAuthProvider.credential(user.email, currentPassword);
      await reauthenticateWithCredential(user, credential);
      
      // Atualizar senha
      await updatePassword(user, newPassword);
      
      await logAction('Alterar Senha', 'users', user.uid, { next: { status: 'sucesso' } });
      
      setPasswordSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      alert("Senha alterada com sucesso!");
    } catch (err: any) {
      console.error("Erro ao alterar senha:", err);
      if (err.code === 'auth/wrong-password') {
        setPasswordError("A senha atual está incorreta.");
      } else {
        setPasswordError("Erro ao alterar senha: " + (err.message || String(err)));
      }
    } finally {
      setPasswordLoading(false);
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
          <button 
            onClick={() => setActiveSubTab('profile')}
            className={cn(
              "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
              activeSubTab === 'profile' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
            )}
          >
            <User size={18} />
            Meu Perfil
          </button>
          
          {(profile?.role === 'admin' || profile?.role === 'vereador' || profile?.role === 'secretaria_parlamentar') && (
            <button 
              onClick={() => setActiveSubTab('general')}
              className={cn(
                "whitespace-nowrap px-4 py-3 rounded-xl font-medium flex items-center gap-3 transition-all",
                activeSubTab === 'general' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-900"
              )}
            >
              <SettingsIcon size={18} />
              Gabinete
            </button>
          )}
          {(profile?.role === 'admin' || profile?.role === 'vereador' || profile?.role === 'secretaria_parlamentar' || isSuperAdmin) && (
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

          {(profile?.role === 'admin' || profile?.role === 'vereador' || isSuperAdmin || profile?.role === 'secretaria_parlamentar') && (
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
          {activeSubTab === 'profile' ? (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8"
            >
               <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-400 border border-blue-500/20 overflow-hidden">
                     {userPhoto ? (
                       <img src={userPhoto} alt="Perfil" className="w-full h-full object-cover" />
                     ) : (
                       <User size={32} />
                     )}
                  </div>
                  <div>
                     <h2 className="text-2xl font-bold text-white mb-1">Meu Perfil</h2>
                     <p className="text-slate-400 text-sm">{profile?.nome} ({profile?.email})</p>
                  </div>
               </div>

               <div className="max-w-xl space-y-8">
                  {/* Profile Edit Form */}
                  <form onSubmit={handleUpdateProfile} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6">
                     <div className="flex items-center gap-3 mb-2">
                        <User className="text-blue-500" size={20} />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">Informações Básicas</h3>
                     </div>

                     <div className="flex flex-col md:flex-row gap-6">
                        <div className="relative group">
                           <div className="w-24 h-24 rounded-2xl bg-slate-900 border-2 border-dashed border-slate-800 overflow-hidden flex items-center justify-center">
                              {userPhoto ? (
                                <img src={userPhoto} alt="Perfil" className="w-full h-full object-cover" />
                              ) : (
                                <User className="text-slate-700" size={32} />
                              )}
                           </div>
                           <label className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer text-[10px] text-white font-bold uppercase text-center p-2 rounded-2xl">
                              Alterar Foto
                              <input type="file" accept="image/*" onChange={handleUserPhotoChange} className="hidden" />
                           </label>
                        </div>

                        <div className="flex-1 space-y-4">
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Nome Completo</label>
                              <input 
                                 type="text" 
                                 required
                                 value={userNome}
                                 onChange={e => setUserNome(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                                 placeholder="Seu nome"
                              />
                           </div>
                           <button 
                              type="submit"
                              disabled={savingProfile}
                              className="bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold py-2 px-4 rounded-lg shadow-lg shadow-blue-900/20 transition-all disabled:opacity-50"
                           >
                              {savingProfile ? 'Salvando...' : 'Salvar Dados do Perfil'}
                           </button>
                        </div>
                     </div>
                  </form>

                  {/* Password Change Form */}
                  <form onSubmit={handleChangePassword} className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-6">
                     <div className="flex items-center gap-3 mb-2">
                        <Fingerprint className="text-blue-500" size={20} />
                        <h3 className="text-sm font-bold uppercase tracking-widest text-slate-200">Alterar Minha Senha</h3>
                     </div>

                     <div className="space-y-4">
                        <div className="space-y-2">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Senha Atual</label>
                           <input 
                              type="password" 
                              required
                              value={currentPassword}
                              onChange={e => setCurrentPassword(e.target.value)}
                              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-mono"
                              placeholder="••••••••"
                           />
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Nova Senha</label>
                              <input 
                                 type="password" 
                                 required
                                 value={newPassword}
                                 onChange={e => setNewPassword(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-mono"
                                 placeholder="Min. 6 caracteres"
                              />
                           </div>
                           <div className="space-y-2">
                              <label className="text-[10px] font-bold uppercase text-slate-500 tracking-widest px-1">Confirmar Senha</label>
                              <input 
                                 type="password" 
                                 required
                                 value={confirmPassword}
                                 onChange={e => setConfirmPassword(e.target.value)}
                                 className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-mono"
                                 placeholder="Repita a nova senha"
                              />
                           </div>
                        </div>
                     </div>

                     {passwordError && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-xs">
                           <ShieldAlert size={14} />
                           {passwordError}
                        </div>
                     )}

                     {passwordSuccess && (
                        <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-500 text-xs">
                           <CheckCircle2 size={14} />
                           Sua senha foi alterada com sucesso!
                        </div>
                     )}

                     <button 
                        type="submit"
                        disabled={passwordLoading}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                     >
                        {passwordLoading ? (
                           <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                           <>
                              <Save size={18} />
                              Confirmar Nova Senha
                           </>
                        )}
                     </button>
                   </form>


                  {/* Device Info */}
                  <div className="p-6 bg-slate-950/50 rounded-2xl border border-slate-800/50">
                     <h3 className="text-xs font-bold uppercase tracking-widest text-slate-600 mb-4 flex items-center gap-2">
                        <Database size={14} />
                        Assinatura de Segurança
                     </h3>
                     <div className="space-y-2">
                        <div className="flex justify-between text-[11px]">
                           <span className="text-slate-500">Último Acesso:</span>
                           <span className="text-slate-300">{format(new Date(), "dd 'de' MMMM, HH:mm", { locale: ptBR })}</span>
                        </div>
                        <div className="flex justify-between text-[11px]">
                           <span className="text-slate-500">Gabinete ID:</span>
                           <span className="text-slate-300 font-mono">{profile?.cabinetId}</span>
                        </div>
                     </div>
                  </div>
               </div>
            </motion.div>
          ) : activeSubTab === 'general' ? (
            <motion.div 
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-6"
            >
              {/* Cabinet Identity Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 shadow-xl space-y-8">
                 <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b border-slate-800 pb-8">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">Identidade do Gabinete</h2>
                      <p className="text-slate-400">Personalize o nome, foto e endereços exclusivos do seu gabinete.</p>
                    </div>
                    
                    <div className="flex flex-col gap-3 min-w-[280px]">
                      <div className="p-4 bg-blue-600/5 border border-blue-500/10 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                           <h4 className="text-[10px] font-black uppercase text-blue-400 flex items-center gap-2">
                             <LinkIcon size={12} /> Link de Acesso Direto
                           </h4>
                           <button 
                             onClick={() => {
                               navigator.clipboard.writeText(`${window.location.origin}${window.location.pathname}?cabinetId=${profile?.cabinetId}`);
                               alert("Link de acesso copiado!");
                             }}
                             className="text-blue-400 hover:text-white transition-colors"
                             title="Copiar Link"
                           >
                             <Save size={12} />
                           </button>
                        </div>
                        <div className="text-[10px] font-mono text-slate-500 truncate mb-1">
                           {window.location.host}{window.location.pathname}?cabinetId={profile?.cabinetId}
                        </div>
                        <p className="text-[9px] text-slate-600 leading-tight">
                           Compartilhe este link com sua assessoria para acesso imediato a este gabinete.
                        </p>
                      </div>
                    </div>
                 </div>

                 <form onSubmit={handleUpdateSettings} className="grid grid-cols-1 lg:grid-cols-2 gap-12">
                   <div className="space-y-6">
                     <div className="space-y-4 pt-2">
                        <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Logo do Gabinete</label>
                        <div className="flex items-center gap-6">
                          <div className="relative group">
                            <div className="w-24 h-24 rounded-2xl bg-slate-800 border-2 border-dashed border-slate-700 overflow-hidden flex items-center justify-center">
                              {cabinetLogo ? (
                                <img src={cabinetLogo} alt="Logo Cabinet" className="w-full h-full object-contain p-2" />
                              ) : (
                                <Globe className="text-slate-600" size={32} />
                              )}
                            </div>
                            {cabinetLogo && (
                              <button 
                                type="button"
                                onClick={() => setCabinetLogo(null)}
                                className="absolute -top-2 -right-2 bg-red-500 text-white p-1 rounded-full shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <X size={14} />
                              </button>
                            )}
                          </div>
                          <div className="flex-1">
                            <label className="inline-block bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold px-4 py-3 rounded-xl cursor-pointer transition-all border border-slate-700">
                              Upload da Logo
                              <input 
                                type="file" 
                                accept="image/*"
                                onChange={handleCabinetLogoChange}
                                className="hidden" 
                              />
                            </label>
                            <p className="text-[10px] text-slate-500 mt-2 italic">Aparecerá no topo da barra lateral.</p>
                          </div>
                        </div>
                     </div>

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

                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                       <div className="space-y-2">
                         <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Página Web (Subdomínio)</label>
                         <div className="relative">
                            <input 
                              type="text" 
                              value={subdomain}
                              onChange={e => setSubdomain(e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-'))}
                              className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm font-mono"
                              placeholder="ex: silva"
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-bold text-slate-500 pointer-events-none">
                               .gabinetedigital.app
                            </div>
                         </div>
                       </div>
                       <div className="space-y-2">
                         <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Domínio Próprio</label>
                         <input 
                           type="text" 
                           value={customDomain}
                           onChange={e => setCustomDomain(e.target.value.toLowerCase())}
                           className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                           placeholder="Ex: gabinete.seunome.com.br"
                         />
                       </div>
                     </div>
                   </div>

                   <div className="space-y-6">
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Título do Link Externo</label>
                      <input 
                        type="text" 
                        value={perfilLabel}
                        onChange={e => setPerfilLabel(e.target.value)}
                        className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                        placeholder="Ex: Câmara Municipal"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">URL do Link Externo</label>
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
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 px-1 italic text-blue-400">
                    Link da Câmara Municipal ou Rede Social oficial que aparecerá na barra lateral.
                  </p>

                  <div className="space-y-2 pt-2">
                    <label className="text-xs font-bold uppercase text-slate-500 tracking-widest px-1">Biografia / Perfil do Vereador</label>
                    <textarea 
                      value={biography}
                      onChange={e => setBiography(e.target.value)}
                      className="w-full bg-slate-800 border border-slate-700 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm min-h-[120px] resize-none"
                      placeholder="Conte um pouco sobre sua trajetória, principais bandeiras e projetos..."
                    />
                    <p className="text-[10px] text-slate-500 px-1 italic">Este texto será exibido na página pública do seu gabinete.</p>
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
            </div>

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
            <UserManagement />
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
      </AnimatePresence>
    </div>
  );
}

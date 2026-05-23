import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  Filter, 
  MoreVertical, 
  Shield, 
  UserCheck, 
  UserX, 
  Mail, 
  Trash2, 
  Edit,
  Key,
  X,
  Plus,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Clock
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  doc, 
  updateDoc, 
  setDoc, 
  deleteDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { sendPasswordResetEmail } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { logAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/firestoreErrorHandler';
import { createNewUserWithPassword } from '../lib/adminAuth';

interface User {
  id: string;
  nome: string;
  email: string;
  username?: string;
  role: string;
  ativo: boolean;
  cabinetId: string;
  criado_em?: any;
  requirePasswordChange?: boolean;
  permissions?: {
    modules?: Record<string, boolean>;
    actions?: {
      create?: boolean;
      edit?: boolean;
      delete?: boolean;
    };
  };
}

export default function UserManagement() {
  const { profile, isSuperAdmin } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    nome: '',
    email: '',
    username: '',
    role: 'assessor',
    ativo: false,
    password: '', // New field for temporary password
    data_nascimento: '', // Date of birth
  });

  const checkIfBirthdayToday = (dateStr?: string) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return false;
    const m = parseInt(parts[1], 10);
    const d = parseInt(parts[2], 10);
    const today = new Date();
    return m === (today.getMonth() + 1) && d === today.getDate();
  };

  const SYSTEM_MODULES = [
    { id: 'dashboard', label: 'Dashboard / Resumo' },
    { id: 'agenda', label: 'Agenda de Compromissos' },
    { id: 'cidadaos', label: 'Cidadão CRM (Cadastros)' },
    { id: 'atendimentos', label: 'Atendimentos Geral' },
    { id: 'medico', label: 'Atendimentos Médicos' },
    { id: 'auxilio', label: 'Auxílio Social' },
    { id: 'indicacoes', label: 'Indicações de Cargo' },
    { id: 'malotes', label: 'Malotes & Ofícios' },
    { id: 'demandas', label: 'Demandas Parlamentares' },
    { id: 'sugestoes', label: 'Sugestões & Ouvidoria' },
    { id: 'relatorios', label: 'Gerador de Relatórios' },
    { id: 'training', label: 'Manual do Sistema' },
    { id: 'whatsapp', label: 'Automação WhatsApp' },
    { id: 'history', label: 'Logs & Auditoria (Histórico)' },
    { id: 'config', label: 'Configurações Globais' },
    { id: 'users', label: 'Gerenciamento de Usuários' },
  ];

  const SYSTEM_ACTIONS = [
    { id: 'create', label: 'Cadastrar / Criar registros' },
    { id: 'edit', label: 'Editar / Atualizar registros' },
    { id: 'delete', label: 'Excluir / Deletar registros' },
  ];

  const getDefaultsForRole = (role: string) => {
    const isConsulta = role === 'consulta';
    const isVereadorOrSuper = role === 'vereador' || role === 'superadmin' || role === 'suporte_ti';
    const IsAdminOrSec = role === 'admin' || role === 'secretaria_parlamentar';
    
    return {
      modules: {
        dashboard: true,
        agenda: true,
        cidadaos: true,
        atendimentos: true,
        medico: true,
        auxilio: true,
        indicacoes: isVereadorOrSuper,
        malotes: true,
        demandas: true,
        sugestoes: true,
        relatorios: true,
        training: true,
        whatsapp: true,
        history: IsAdminOrSec || isVereadorOrSuper,
        config: IsAdminOrSec || isVereadorOrSuper,
        users: IsAdminOrSec || isVereadorOrSuper,
      },
      actions: {
        create: !isConsulta,
        edit: !isConsulta,
        delete: IsAdminOrSec || isVereadorOrSuper,
      }
    };
  };

  const [customPermissions, setCustomPermissions] = useState<{
    modules: Record<string, boolean>;
    actions: {
      create: boolean;
      edit: boolean;
      delete: boolean;
    };
  }>({
    modules: getDefaultsForRole('assessor').modules,
    actions: getDefaultsForRole('assessor').actions
  });

  const canManage = profile?.role === 'admin' || profile?.role === 'vereador' || profile?.role === 'secretaria_parlamentar' || profile?.role === 'suporte_ti' || isSuperAdmin;

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'users'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('nome', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const usersData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as User[];
      
      setUsers(usersData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching users:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.cabinetId, canManage]);

  const handleResetForm = () => {
    setFormData({
      nome: '',
      email: '',
      username: '',
      role: 'assessor',
      ativo: false,
      password: '',
      data_nascimento: '',
    });
    setCustomPermissions({
      modules: getDefaultsForRole('assessor').modules,
      actions: getDefaultsForRole('assessor').actions
    });
    setSelectedUser(null);
    setShowPassword(false);
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.cabinetId) return;
    
    if (formData.password && formData.password.length < 6) {
      alert("A senha temporária deve ter pelo menos 6 caracteres.");
      return;
    }

    setSubmitting(true);

    try {
      let uid = '';
      
      // If a password was provided, create the Auth user now
      if (formData.password) {
        try {
          uid = await createNewUserWithPassword(formData.email, formData.password);
        } catch (authError: any) {
          if (authError.code === 'auth/email-already-in-use') {
             // If user already exists in auth, we'll try to find them by email in Firestore later anyway
             // But for now, let's just warn or proceed if we want to link
             alert("Este e-mail já está em uso no sistema de autenticação.");
             setSubmitting(false);
             return;
          }
          throw authError;
        }
      }

      // Use generated UID or email prefix as fallback
      const docId = uid || formData.username || formData.email.split('@')[0].replace(/[^a-zA-Z0-9]/g, '_');
      const userRef = doc(db, 'users', docId);

      const { password, ...firestoreData } = formData;
      const userData = {
        ...firestoreData,
        email: formData.email.toLowerCase().trim(),
        cabinetId: profile.cabinetId,
        criado_em: serverTimestamp(),
        requirePasswordChange: !!formData.password, // Force change if admin set a temp password
        permissions: customPermissions
      };

      await setDoc(userRef, userData);
      await logAction('Criar Usuário', 'users', docId, { 
        next: { ...userData, hasInitialPassword: !!formData.password },
        cabinetId: profile.cabinetId
      });
      
      setShowAddModal(false);
      handleResetForm();
      alert("Usuário criado com sucesso!");
    } catch (error: any) {
      console.error("Error creating user:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert("Erro ao criar usuário: " + (errorMsg.includes("permission") ? "Permissão negada no Firestore." : errorMsg));
      handleFirestoreError(error, OperationType.WRITE, 'users');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      const userRef = doc(db, 'users', selectedUser.id);
      const updates = {
        nome: formData.nome,
        role: formData.role,
        ativo: formData.ativo,
        username: formData.username,
        data_nascimento: formData.data_nascimento,
        permissions: customPermissions
      };

      await updateDoc(userRef, updates);
      await logAction('Atualizar Usuário', 'users', selectedUser.id, { 
        previous: selectedUser,
        next: updates,
        cabinetId: profile.cabinetId
      });

      setShowEditModal(false);
      handleResetForm();
      alert("Usuário atualizado com sucesso!");
    } catch (error: any) {
      console.error("Error updating user:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert("Erro ao atualizar usuário: " + (errorMsg.includes("permission") ? "Permissão negada no Firestore." : errorMsg));
      handleFirestoreError(error, OperationType.UPDATE, `users/${selectedUser.id}`);
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const userRef = doc(db, 'users', user.id);
      await updateDoc(userRef, { ativo: !user.ativo });
      await logAction(user.ativo ? 'Desativar Usuário' : 'Ativar Usuário', 'users', user.id, {
        previous: { ativo: user.ativo },
        next: { ativo: !user.ativo },
        cabinetId: profile.cabinetId
      });
    } catch (error: any) {
      console.error("Error toggling status:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert("Erro ao alterar status do usuário: " + (errorMsg.includes("permission") ? "Permissão negada no Firestore." : errorMsg));
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.id}`);
    }
  };

  const handleResetPassword = async (email: string) => {
    if (!window.confirm(`Enviar e-mail de redefinição de senha para ${email}?`)) return;
    try {
      await sendPasswordResetEmail(auth, email);
      alert("E-mail de redefinição enviado!");
    } catch (error: any) {
      alert("Erro ao enviar e-mail: " + error.message);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (user.id === auth.currentUser?.uid) return alert("Você não pode remover a si mesmo.");
    if (!window.confirm(`Tem certeza que deseja remover permanentemente ${user.nome}? Esta ação não pode ser desfeita.`)) return;

    try {
      await deleteDoc(doc(db, 'users', user.id));
      await logAction('Excluir Usuário', 'users', user.id, { previous: user, cabinetId: profile.cabinetId });
      alert("Usuário removido.");
    } catch (error: any) {
      console.error("Error deleting user:", error);
      const errorMsg = error instanceof Error ? error.message : String(error);
      alert("Erro ao excluir usuário: " + (errorMsg.includes("permission") ? "Permissão negada." : errorMsg));
      handleFirestoreError(error, OperationType.DELETE, `users/${user.id}`);
    }
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.nome.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         u.email.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = roleFilter === 'all' || u.role === roleFilter;
    return matchesSearch && matchesRole;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Shield className="text-blue-500" size={24} />
            Gestão de Equipe
          </h2>
          <p className="text-slate-400 text-sm">Administre os usuários e permissões do seu gabinete.</p>
        </div>
        {canManage && (
          <button 
            onClick={() => {
              handleResetForm();
              setShowAddModal(true);
            }}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-bold transition-all shadow-lg shadow-blue-900/20"
          >
            <UserPlus size={18} />
            Adicionar Membro
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome ou email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <select 
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-10 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all appearance-none cursor-pointer"
          >
            <option value="all">Todos os Cargos</option>
            <option value="admin">Administrador</option>
            <option value="vereador">Vereador</option>
            <option value="assessor">Assessor</option>
            <option value="secretaria_parlamentar">Secretária Parlamentar</option>
            <option value="suporte_ti">Suporte TI</option>
            <option value="consulta">Apenas Consulta</option>
          </select>
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-950/50 border-b border-slate-800">
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Colaborador</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Cargo / Role</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest">Status</th>
                <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-widest text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">Carregando usuários...</td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-10 text-center text-slate-500">Nenhum colaborador encontrado.</td>
                </tr>
              ) : filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                        user.ativo ? "bg-blue-600/10 text-blue-400" : "bg-slate-800 text-slate-600"
                      )}>
                        {user.nome.charAt(0)}
                      </div>
                      <div>
                        <span className="block font-bold text-slate-200">
                          {user.nome}
                          {checkIfBirthdayToday((user as any).data_nascimento) && (
                            <span className="inline-flex items-center gap-1 text-[9px] bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded-full ml-1.5 font-bold animate-pulse">
                              🎂 Hoje! 🎉
                            </span>
                          )}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="block text-xs text-slate-500">{user.email}</span>
                          {user.requirePasswordChange && (
                            <span className="text-[9px] bg-amber-500/10 text-amber-500 border border-amber-500/20 px-1.5 py-0.5 rounded uppercase font-bold" title="Senha temporária - troca obrigatória">
                              Senha Temp.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider",
                      user.role === 'admin' ? "bg-purple-500/10 text-purple-400 border border-purple-500/20" :
                      user.role === 'vereador' ? "bg-amber-500/10 text-amber-400 border border-amber-500/20" :
                      user.role === 'assessor' ? "bg-blue-500/10 text-blue-400 border border-blue-500/20" :
                      user.role === 'secretaria_parlamentar' ? "bg-pink-500/10 text-pink-400 border border-pink-500/20" :
                      user.role === 'suporte_ti' ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20" :
                      "bg-slate-500/10 text-slate-400 border border-slate-500/20"
                    )}>
                      <Shield size={10} />
                      {user.role === 'secretaria_parlamentar' ? 'SEC. PARLAMENTAR' : user.role === 'suporte_ti' ? 'SUPORTE TI' : user.role.replace('_', ' ')}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <button 
                      onClick={() => canManage && handleToggleStatus(user)}
                      disabled={!canManage}
                      className={cn(
                        "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider transition-all",
                        user.ativo ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-500 border border-amber-500/20 animate-pulse",
                        canManage && "hover:bg-opacity-20 pointer-events-auto cursor-pointer"
                      )}
                      title={canManage ? "Clique para alterar o status de aprovação" : ""}
                    >
                      {user.ativo ? <UserCheck size={10} /> : <Clock size={10} />}
                      {user.ativo ? 'Aprovado / Ativo' : 'Aguardando Aprovação'}
                    </button>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canManage && (
                        <>
                          <button 
                            onClick={() => {
                              setSelectedUser(user);
                              setFormData({
                                nome: user.nome,
                                email: user.email,
                                username: user.username || '',
                                role: user.role,
                                ativo: user.ativo,
                                password: '',
                                data_nascimento: (user as any).data_nascimento || '',
                              });
                              const defaultPerms = getDefaultsForRole(user.role);
                              setCustomPermissions({
                                modules: {
                                  ...defaultPerms.modules,
                                  ...(user.permissions?.modules || {})
                                },
                                actions: {
                                  ...defaultPerms.actions,
                                  ...(user.permissions?.actions || {})
                                }
                              });
                              setShowEditModal(true);
                            }}
                            className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-lg transition-all"
                            title="Editar Dados"
                          >
                            <Edit size={16} />
                          </button>
                          <button 
                            onClick={() => handleResetPassword(user.email)}
                            className="p-2 bg-blue-500/5 hover:bg-blue-500/10 text-blue-400 rounded-lg transition-all border border-blue-500/10"
                            title="Redefinir Senha (E-mail)"
                          >
                            <Key size={16} />
                            <span className="sr-only">Redefinir Senha</span>
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(user)}
                            className="p-2 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg transition-all"
                            title="Excluir Usuário"
                          >
                            <Trash2 size={16} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {(showAddModal || showEditModal) && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setShowAddModal(false);
                setShowEditModal(false);
              }}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-x-4 max-h-[85vh] top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-lg bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 z-[101] shadow-2xl flex flex-col overflow-hidden"
            >
              <div className="flex items-center justify-between mb-6 shrink-0">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {showAddModal ? 'Adicionar Novo Membro' : 'Editar Colaborador'}
                  </h3>
                  <p className="text-slate-400 text-xs mt-1">
                    {showAddModal ? 'Configure as credenciais de acesso' : `Editando perfil de ${formData.nome}`}
                  </p>
                </div>
                <button 
                  onClick={() => {
                    setShowAddModal(false);
                    setShowEditModal(false);
                  }}
                  className="p-2 hover:bg-slate-800 rounded-xl text-slate-500 hover:text-white transition-all"
                >
                  <X size={20} />
                </button>
              </div>

              <form 
                onSubmit={showAddModal ? handleCreateUser : handleUpdateUser} 
                className="flex-1 flex flex-col overflow-hidden text-left"
              >
                {/* Scrollable Form Fields Content */}
                <div className="flex-1 overflow-y-auto space-y-5 pr-2 -mr-2 text-left">
                  <div className="space-y-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input 
                      type="text" 
                      required
                      value={formData.nome}
                      onChange={e => setFormData({ ...formData, nome: e.target.value })}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
                      placeholder="Ex: João da Silva"
                    />
                  </div>

                   <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Email</label>
                      <input 
                        type="email" 
                        required
                        disabled={showEditModal}
                        value={formData.email}
                        onChange={e => setFormData({ ...formData, email: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all disabled:opacity-50"
                        placeholder="email@gabinete.com"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Nome de Usuário</label>
                      <input 
                        type="text" 
                        value={formData.username}
                        onChange={e => setFormData({ ...formData, username: e.target.value.toLowerCase().replace(/\s/g, '.') })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
                        placeholder="Ex: joao.silva"
                      />
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Data de Nascimento</label>
                      <input 
                        type="date" 
                        value={formData.data_nascimento}
                        onChange={e => setFormData({ ...formData, data_nascimento: e.target.value })}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  {showAddModal && (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between px-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Senha Temporária (Opcional)</label>
                        <button 
                          type="button"
                          onClick={() => {
                            const charset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%";
                            let retVal = "";
                            for (let i = 0, n = charset.length; i < 10; ++i) {
                                retVal += charset.charAt(Math.floor(Math.random() * n));
                            }
                            setFormData({ ...formData, password: retVal });
                            setShowPassword(true);
                          }}
                          className="text-[10px] font-bold text-blue-500 hover:text-blue-400 flex items-center gap-1 transition-colors"
                        >
                          <Plus size={10} />
                          Gerar Senha
                        </button>
                      </div>
                      <div className="relative">
                        <input 
                          type={showPassword ? "text" : "password"}
                          value={formData.password}
                          onChange={e => setFormData({ ...formData, password: e.target.value })}
                          className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 pr-12 text-white placeholder-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
                          placeholder="Deixe vazio para login via Google"
                        />
                        <button 
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                        >
                          {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-500 px-1 italic">
                        Se definida, o usuário terá que mudar a senha no primeiro acesso.
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Cargo / Permissão</label>
                      <select 
                        value={formData.role}
                        onChange={e => {
                          const newRole = e.target.value;
                          setFormData({ ...formData, role: newRole });
                          setCustomPermissions(getDefaultsForRole(newRole));
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all appearance-none cursor-pointer"
                      >
                        <option value="assessor">Assessor</option>
                        <option value="admin">Administrador</option>
                        <option value="vereador">Vereador</option>
                        <option value="secretaria_parlamentar">Secretária Parlamentar</option>
                        <option value="suporte_ti">Suporte TI</option>
                        <option value="consulta">Apenas Consulta</option>
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest ml-1">Status da Conta</label>
                      <div className="flex h-[58px] bg-slate-950 border border-slate-800 rounded-2xl p-1">
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, ativo: true })}
                          className={cn(
                            "flex-1 rounded-xl text-xs font-bold transition-all",
                            formData.ativo ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/20" : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          Ativo
                        </button>
                        <button 
                          type="button"
                          onClick={() => setFormData({ ...formData, ativo: false })}
                          className={cn(
                            "flex-1 rounded-xl text-xs font-bold transition-all",
                            !formData.ativo ? "bg-red-600 text-white shadow-lg shadow-red-900/20" : "text-slate-500 hover:text-slate-300"
                          )}
                        >
                          Inativo
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Custom Permissions Panel */}
                  <div className="bg-slate-950/50 rounded-2xl p-4 border border-slate-800 space-y-4 max-h-[300px] overflow-y-auto text-left col-span-2">
                      <div className="flex items-center justify-between">
                        <div>
                          <h4 className="text-xs font-bold text-slate-300 uppercase tracking-wider">Permissões de Acesso</h4>
                          <p className="text-[10px] text-slate-500">Defina o que este usuário pode ver ou fazer</p>
                        </div>
                        {!canManage && (
                          <span className="text-[9px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-medium">Apenas Leitura</span>
                        )}
                      </div>

                      {!canManage && (
                        <p className="text-[10px] text-amber-500 bg-amber-500/10 border border-amber-500/10 rounded-xl p-2 font-medium">
                          Apenas administradores, o vereador ou a secretaria parlamentar podem modificar permissões específicas de usuários.
                        </p>
                      )}

                      {/* Modules Permissions */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-800/50 pb-1">Visualizar Páginas (Menu Lateral)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {SYSTEM_MODULES.map((m) => {
                            const isChecked = customPermissions.modules?.[m.id] !== false;
                            return (
                              <label key={m.id} className={cn(
                                "flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all",
                                isChecked 
                                  ? "bg-blue-600/10 border-blue-500/20 text-slate-200 font-medium" 
                                  : "bg-slate-950/20 border-slate-900 text-slate-500 hover:text-slate-400",
                                !canManage && "cursor-not-allowed opacity-75"
                              )}>
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={!canManage}
                                  onChange={(e) => {
                                    setCustomPermissions({
                                      ...customPermissions,
                                      modules: {
                                        ...customPermissions.modules,
                                        [m.id]: e.target.checked
                                      }
                                    });
                                  }}
                                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span>{m.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>

                      {/* Actions Permissions */}
                      <div className="space-y-2">
                        <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block border-b border-slate-800/50 pb-1">Permissões de Escrita (Ações)</span>
                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                          {SYSTEM_ACTIONS.map((act) => {
                            const isChecked = customPermissions.actions?.[act.id as 'create'|'edit'|'delete'] !== false;
                            return (
                              <label key={act.id} className={cn(
                                "flex items-center gap-2 p-2 rounded-xl border text-xs cursor-pointer transition-all",
                                isChecked 
                                  ? "bg-blue-600/10 border-blue-500/20 text-slate-200 font-medium" 
                                  : "bg-slate-950/20 border-slate-900 text-slate-500 hover:text-slate-400",
                                !canManage && "cursor-not-allowed opacity-75"
                              )}>
                                <input 
                                  type="checkbox"
                                  checked={isChecked}
                                  disabled={!canManage}
                                  onChange={(e) => {
                                    setCustomPermissions({
                                      ...customPermissions,
                                      actions: {
                                        ...customPermissions.actions,
                                        [act.id]: e.target.checked
                                      }
                                    });
                                  }}
                                  className="rounded bg-slate-900 border-slate-700 text-blue-600 focus:ring-0 focus:ring-offset-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <span>{act.id === 'create' ? 'Cadastrar' : act.id === 'edit' ? 'Editar' : 'Excluir'}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </div>
                  </div>

                {/* Sticky/Fixed buttons container at the bottom */}
                <div className="pt-4 border-t border-slate-800 mt-4 shrink-0 bg-slate-900">
                  <button 
                    type="submit"
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/40 transition-all flex items-center justify-center gap-3 disabled:opacity-50"
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                    ) : (
                      showAddModal ? <><Plus size={20} /> Criar Usuário</> : <><CheckCircle2 size={20} /> Salvar Alterações</>
                    )}
                  </button>
                  {showAddModal && (
                    <div className="mt-4 flex items-center gap-2 text-[10px] text-slate-500 bg-slate-950/50 p-3 rounded-xl border border-slate-800">
                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                      O colaborador receberá um e-mail automático para configurar sua senha no primeiro acesso caso utilize o Login do Google.
                    </div>
                  )}
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

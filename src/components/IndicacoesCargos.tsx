import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  User, 
  Phone, 
  Calendar,
  Info,
  Save,
  Building2,
  Briefcase,
  FileText,
  AlertCircle
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatProperName } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function IndicacoesCargos() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  const initialForm = {
    indicado_nome: '',
    indicado_cpf: '',
    indicado_telefone: '',
    cargo_pretendido: '',
    orgao_destino: '',
    status: 'Pendente',
    data_indicacao: format(new Date(), 'yyyy-MM-dd'),
    data_nomeacao: '',
    qualificacao: '',
    observacoes: ''
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'indicacoes_cargos'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching indications:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.cabinetId) return;

    try {
      const payload = {
        ...formData,
        indicado_nome: formatProperName(formData.indicado_nome),
        cabinetId: profile.cabinetId,
        usuario_id: profile.id,
        usuario_nome: profile.nome,
        updated_at: serverTimestamp()
      };

      if (editingId) {
        const existingDoc = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'indicacoes_cargos', editingId), payload);
        await logAction('Atualizar Indicação', 'indicacoes_cargos', editingId, { 
          previous: existingDoc, 
          next: formData,
          cabinetId: profile.cabinetId 
        });
      } else {
        const docRef = await addDoc(collection(db, 'indicacoes_cargos'), {
          ...payload,
          created_at: serverTimestamp()
        });
        await logAction('Criar Indicação', 'indicacoes_cargos', docRef.id, { 
          next: formData,
          cabinetId: profile.cabinetId 
        });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'indicacoes_cargos');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro permanentemente?")) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'indicacoes_cargos', id));
      await logAction('Excluir Indicação', 'indicacoes_cargos', id, { 
        previous: existing,
        cabinetId: profile?.cabinetId 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `indicacoes_cargos/${id}`);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Em Análise': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Nomeado': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Rejeitado': return 'bg-red-500/10 text-red-500 border-red-500/20';
      case 'Exonerado': return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.indicado_nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.indicado_cpf?.includes(searchQuery) ||
                         item.cargo_pretendido.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  return (
    <div className="space-y-6 lg:p-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="text-purple-500" size={32} />
            Indicações de Cargos
          </h1>
          <p className="text-slate-400 mt-1">Gestão de indicações políticas e cargos de confiança.</p>
        </div>

        <button 
          onClick={() => {
            setEditingId(null);
            setFormData(initialForm);
            setShowModal(true);
          }}
          className="bg-purple-600 hover:bg-purple-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg shadow-purple-900/20 transition-all active:scale-95"
        >
          <Plus size={20} />
          Nova Indicação
        </button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome, CPF ou cargo..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-purple-600/50 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-600/50 transition-all font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em Análise">Em Análise</option>
            <option value="Nomeado">Nomeado</option>
            <option value="Rejeitado">Rejeitado</option>
            <option value="Exonerado">Exonerado</option>
          </select>
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-slate-900 rounded-3xl border border-slate-800 animate-pulse" />
            ))
          ) : filteredData.length === 0 ? (
            <div className="col-span-full py-20 text-center space-y-4">
               <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                  <Briefcase size={40} />
               </div>
               <p className="text-slate-500 font-medium">Nenhuma indicação encontrada.</p>
            </div>
          ) : filteredData.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-purple-500/30 transition-all group relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 shrink-0">
                    <User size={20} className="text-purple-500" />
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg truncate max-w-[150px]">{item.indicado_nome}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                       {item.cargo_pretendido}
                    </div>
                  </div>
                </div>
                <div className={cn(
                  "px-3 py-1 rounded-full text-[10px] font-black uppercase border",
                  getStatusColor(item.status)
                )}>
                  {item.status}
                </div>
              </div>

              <div className="space-y-3 py-4 border-y border-slate-800/50 mb-4">
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Building2 size={14} className="text-slate-600" />
                  <span className="truncate">{item.orgao_destino || 'Não informado'}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Calendar size={14} className="text-slate-600" />
                  <span>Indicação: {item.data_indicacao ? format(new Date(item.data_indicacao + 'T00:00:00'), 'dd/MM/yyyy') : '---'}</span>
                </div>
                {item.status === 'Nomeado' && item.data_nomeacao && (
                  <div className="flex items-center gap-3 text-sm text-emerald-500/80 font-medium">
                    <CheckCircle2 size={14} />
                    <span>Nomeado em: {format(new Date(item.data_nomeacao + 'T00:00:00'), 'dd/MM/yyyy')}</span>
                  </div>
                )}
                {item.indicado_telefone && (
                  <div className="flex items-center gap-3 text-sm text-slate-400">
                    <Phone size={14} className="text-slate-600" />
                    <span>{item.indicado_telefone}</span>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => {
                      setEditingId(item.id);
                      setFormData(item);
                      setShowModal(true);
                    }}
                    className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all hover:bg-slate-700"
                    title="Editar"
                  >
                    <Edit size={16} />
                  </button>
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 transition-all hover:bg-red-500/10"
                    title="Excluir"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-purple-600/10 rounded-2xl flex items-center justify-center text-purple-500 border border-purple-500/20">
                    <Briefcase size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {editingId ? 'Editar Indicação' : 'Nova Indicação de Cargo'}
                    </h2>
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mt-0.5">Nomeação de Confiança</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome do Indicado</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        required
                        value={formData.indicado_nome}
                        onChange={e => setFormData({...formData, indicado_nome: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-600/50 outline-none transition-all"
                        placeholder="Nome completo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">WhatsApp / Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        value={formData.indicado_telefone}
                        onChange={e => setFormData({...formData, indicado_telefone: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-600/50 outline-none transition-all"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Cargo Pretendido</label>
                    <div className="relative">
                      <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        required
                        value={formData.cargo_pretendido}
                        onChange={e => setFormData({...formData, cargo_pretendido: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-600/50 outline-none transition-all"
                        placeholder="Ex: Assessor de Gabinete"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Órgão / Secretaria Destino</label>
                    <div className="relative">
                      <Building2 className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        value={formData.orgao_destino}
                        onChange={e => setFormData({...formData, orgao_destino: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-purple-600/50 outline-none transition-all"
                        placeholder="Ex: Secretaria de Saúde"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Status da Indicação</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-purple-600/50 outline-none transition-all font-bold"
                    >
                      <option value="Pendente">🟡 Pendente</option>
                      <option value="Em Análise">🔵 Em Análise</option>
                      <option value="Nomeado">🟢 Nomeado</option>
                      <option value="Rejeitado">🔴 Rejeitado</option>
                      <option value="Exonerado">⚪ Exonerado</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Data da Indicação</label>
                    <input 
                      type="date"
                      value={formData.data_indicacao}
                      onChange={e => setFormData({...formData, data_indicacao: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-purple-600/50 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Qualificações / Currículo</label>
                  <textarea 
                    value={formData.qualificacao}
                    onChange={e => setFormData({...formData, qualificacao: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-purple-600/50 outline-none transition-all resize-none h-24 text-sm"
                    placeholder="Resumo das qualificações acadêmicas e profissionais..."
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Observações Adicionais</label>
                  <textarea 
                    value={formData.observacoes}
                    onChange={e => setFormData({...formData, observacoes: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-purple-600/50 outline-none transition-all resize-none h-20 text-sm"
                    placeholder="Notas internas sobre a indicação..."
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] px-6 py-4 rounded-2xl bg-purple-600 hover:bg-purple-700 text-white font-bold shadow-xl shadow-purple-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingId ? 'Salvar Alterações' : 'Registrar Indicação'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

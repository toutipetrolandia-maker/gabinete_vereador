import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Truck, 
  User, 
  Phone, 
  Calendar,
  MoreVertical,
  ChevronRight,
  Info,
  Smartphone,
  Save,
  ShoppingBag,
  Stethoscope,
  Baby
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
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { getWhatsAppLink, formatWhatsAppMessage, WhatsAppConfig } from '../lib/whatsapp';

export default function SocialAssistance() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);

  const initialForm = {
    beneficiado_nome: '',
    beneficiado_telefone: '',
    beneficiado_cpf: '',
    tipo_beneficio: 'Cesta Básica',
    quantidade: 1,
    status: 'Pendente',
    data_entrega_prevista: '',
    observacoes: '',
    entregue_por_nome: ''
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'auxilio_social'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching social assistance:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  useEffect(() => {
    if (!profile?.cabinetId) return;
    const unsub = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        setWaConfig(snap.data().whatsapp_config);
      }
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.cabinetId) return;

    try {
      const payload = {
        ...formData,
        cabinetId: profile.cabinetId,
        usuario_id: profile.id,
        usuario_nome: profile.nome,
        updated_at: serverTimestamp()
      };

      if (editingId) {
        const existingDoc = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'auxilio_social', editingId), payload);
        await logAction('Atualizar Auxílio', 'auxilio_social', editingId, { 
          previous: existingDoc, 
          next: formData,
          cabinetId: profile.cabinetId 
        });
      } else {
        const docRef = await addDoc(collection(db, 'auxilio_social'), {
          ...payload,
          created_at: serverTimestamp()
        });
        await logAction('Criar Auxílio', 'auxilio_social', docRef.id, { 
          next: formData,
          cabinetId: profile.cabinetId 
        });
      }
      setShowModal(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'auxilio_social');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const existing = data.find(i => i.id === id);
      const updates: any = { 
        status: newStatus, 
        updated_at: serverTimestamp() 
      };
      
      if (newStatus === 'Entregue') {
        updates.data_entrega_realizada = serverTimestamp();
        updates.entregue_por_nome = profile?.nome || '';
      }

      await updateDoc(doc(db, 'auxilio_social', id), updates);
      await logAction('Status Auxílio', 'auxilio_social', id, { 
        previous: { status: existing?.status }, 
        next: updates,
        cabinetId: profile?.cabinetId 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `auxilio_social/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro permanentemente?")) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'auxilio_social', id));
      await logAction('Excluir Auxílio', 'auxilio_social', id, { 
        previous: existing,
        cabinetId: profile?.cabinetId 
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `auxilio_social/${id}`);
    }
  };

  const sendWAMessage = (item: any) => {
    if (!item.beneficiado_telefone) return;
    const trigger = item.status === 'Entregue' ? 'status_update' : 'welcome';
    const template = waConfig?.templates?.find(t => t.trigger === trigger);
    
    const defaultContent = trigger === 'welcome' 
      ? 'Olá {{nome}}, seu pedido de {{titulo}} foi registrado e está {{status}}.'
      : 'Olá {{nome}}, informamos que seu benefício ({{titulo}}) foi registrado como: {{status}}.';

    const content = template?.content || defaultContent;
    
    const message = formatWhatsAppMessage(content, {
      nome: item.beneficiado_nome,
      status: item.status,
      id: item.id.slice(-6),
      titulo: item.tipo_beneficio
    });

    window.open(getWhatsAppLink(item.beneficiado_telefone, message), '_blank');
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Em Rota': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Entregue': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Cancelado': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getBenefitIcon = (type: string) => {
    switch (type) {
      case 'Cesta Básica': return <ShoppingBag size={18} className="text-amber-500" />;
      case 'Remédio': return <Stethoscope size={18} className="text-emerald-500" />;
      case 'Fralda': return <Baby size={18} className="text-blue-500" />;
      default: return <Package size={18} className="text-slate-500" />;
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.beneficiado_nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.beneficiado_cpf?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.tipo_beneficio === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6 lg:p-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Package className="text-amber-500" size={32} />
            Auxílio Social
          </h1>
          <p className="text-slate-400 mt-1">Gestão de cestas básicas, remédios e outros benefícios.</p>
        </div>

        <button 
          onClick={() => {
            setEditingId(null);
            setFormData(initialForm);
            setShowModal(true);
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
        >
          <Plus size={20} />
          Novo Auxílio
        </button>
      </header>

      {/* Filters */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="relative md:col-span-2">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text"
            placeholder="Buscar por nome ou CPF do beneficiado..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
          />
        </div>
        <div className="relative">
          <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
          >
            <option value="all">Todos os Status</option>
            <option value="Pendente">Pendente</option>
            <option value="Em Rota">Em Rota</option>
            <option value="Entregue">Entregue</option>
            <option value="Cancelado">Cancelado</option>
          </select>
        </div>
        <div className="relative">
          <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <select 
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
          >
            <option value="all">Todos os Tipos</option>
            <option value="Cesta Básica">Cesta Básica</option>
            <option value="Remédio">Remédio</option>
            <option value="Fralda">Fralda</option>
            <option value="Outro">Outro</option>
          </select>
        </div>
      </div>

      {/* Grid of Benefits */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <AnimatePresence>
          {loading ? (
            Array(6).fill(0).map((_, i) => (
              <div key={i} className="h-64 bg-slate-900 rounded-3xl border border-slate-800 animate-pulse" />
            ))
          ) : filteredData.length === 0 ? (
            <div className="col-span-full py-20 text-center space-y-4">
               <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                  <Package size={40} />
               </div>
               <p className="text-slate-500 font-medium">Nenhum auxílio encontrado para os filtros selecionados.</p>
            </div>
          ) : filteredData.map((item) => (
            <motion.div
              layout
              key={item.id}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-blue-500/30 transition-all group relative"
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 shrink-0">
                    {getBenefitIcon(item.tipo_beneficio)}
                  </div>
                  <div>
                    <h3 className="font-bold text-white text-lg truncate max-w-[150px]">{item.beneficiado_nome}</h3>
                    <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                       {item.tipo_beneficio} • {item.quantidade}x
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
                  <Smartphone size={14} className="text-slate-600" />
                  <span>{item.beneficiado_telefone || 'Sem contato'}</span>
                  {item.beneficiado_telefone && (
                    <button 
                      onClick={() => sendWAMessage(item)}
                      className="ml-auto text-emerald-500 hover:text-emerald-400 transition-colors"
                      title="Notificar via WhatsApp"
                    >
                      <Smartphone size={14} />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-3 text-sm text-slate-400">
                  <Calendar size={14} className="text-slate-600" />
                  <span>Previsto: {item.data_entrega_prevista ? format(new Date(item.data_entrega_prevista + 'T00:00:00'), 'dd/MM/yyyy') : 'Não definida'}</span>
                </div>
                {item.entregue_por_nome && (
                  <div className="flex items-center gap-3 text-sm text-emerald-500/80 font-medium">
                    <CheckCircle2 size={14} />
                    <span>Entregue por: {item.entregue_por_nome}</span>
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

                <div className="flex items-center gap-1 dropdown-container">
                   {item.status !== 'Entregue' && (
                     <button 
                       onClick={() => handleStatusChange(item.id, 'Entregue')}
                       className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all"
                     >
                       Confirmar Entrega
                     </button>
                   )}
                   {item.status === 'Pendente' && (
                     <button 
                       onClick={() => handleStatusChange(item.id, 'Em Rota')}
                       className="p-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                       title="Marcar em Rota"
                     >
                       <Truck size={16} />
                     </button>
                   )}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Benefits Modal */}
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
                  <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white">
                      {editingId ? 'Editar Auxílio' : 'Novo Pedido de Auxílio'}
                    </h2>
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mt-0.5">Gestão de Benefícios Sociais</p>
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
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome do Beneficiado</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        required
                        value={formData.beneficiado_nome}
                        onChange={e => setFormData({...formData, beneficiado_nome: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                        placeholder="Nome completo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">WhatsApp / Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        value={formData.beneficiado_telefone}
                        onChange={e => setFormData({...formData, beneficiado_telefone: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Tipo de Benefício</label>
                    <select 
                      value={formData.tipo_beneficio}
                      onChange={e => setFormData({...formData, tipo_beneficio: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                    >
                      <option value="Cesta Básica">Cesta Básica</option>
                      <option value="Remédio">Remédio</option>
                      <option value="Fralda">Fralda</option>
                      <option value="Kit Higiene">Kit Higiene</option>
                      <option value="Material Escolar">Material Escolar</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Quantidade</label>
                    <input 
                      type="number"
                      min="1"
                      value={formData.quantidade}
                      onChange={e => setFormData({...formData, quantidade: parseInt(e.target.value)})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Data Prevista de Entrega</label>
                    <input 
                      type="date"
                      value={formData.data_entrega_prevista}
                      onChange={e => setFormData({...formData, data_entrega_prevista: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Status Inicial</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-600/50 outline-none transition-all font-bold"
                    >
                      <option value="Pendente">🟡 Pendente</option>
                      <option value="Em Rota">🔵 Em Rota</option>
                      <option value="Entregue">🟢 Entregue</option>
                      <option value="Cancelado">🔴 Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Observações / Detalhes</label>
                  <textarea 
                    value={formData.observacoes}
                    onChange={e => setFormData({...formData, observacoes: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all resize-none h-24"
                    placeholder="Detalhe os remédios, tamanhos de fralda ou observações da entrega..."
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
                    className="flex-[2] px-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingId ? 'Salvar Alterações' : 'Gravar Registro'}
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

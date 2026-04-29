import React, { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  X,
  Edit2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';

export default function Atendimentos() {
  const { profile, user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const initialForm = {
    nome_completo: '',
    cpf: '',
    telefone: '',
    email: '',
    tipo_atendimento: 'Geral',
    status: 'Novo',
    prioridade: 'Média',
    descricao: '',
  };

  // Masks
  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  // Form State
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const q = query(collection(db, 'atendimentos'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to atendimentos:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'atendimentos', editingId), {
          ...formData,
          updated_at: serverTimestamp(),
        });
        await logAction('Atualizar', 'atendimentos', editingId, { previous: existing, next: formData });
      } else {
        const docRef = await addDoc(collection(db, 'atendimentos'), {
          ...formData,
          atendente_id: user?.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        await logAction('Criar', 'atendimentos', docRef.id, { next: formData });
      }
      
      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const existing = data.find(i => i.id === id);
      await updateDoc(doc(db, 'atendimentos', id), {
        status: newStatus,
        updated_at: serverTimestamp()
      });
      await logAction('Atualizar', 'atendimentos', id, { previous: { status: existing?.status }, next: { status: newStatus } });
    } catch (err) {
      console.error(err);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nome_completo: item.nome_completo || '',
      cpf: item.cpf || '',
      telefone: item.telefone || '',
      email: item.email || '',
      tipo_atendimento: item.tipo_atendimento || 'Geral',
      status: item.status || 'Novo',
      prioridade: item.prioridade || 'Média',
      descricao: item.descricao || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este atendimento?')) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'atendimentos', id));
      await logAction('Excluir', 'atendimentos', id, { previous: existing });
    } catch (err) {
      console.error(err);
    }
  };

  const filteredData = data.filter(item => 
    item.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
    item.cpf?.includes(search) ||
    item.descricao?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white">Atendimentos</h1>
          <p className="text-slate-400 text-sm">Gerencie os atendimentos gerais do gabinete.</p>
        </div>
        {profile?.role !== 'consulta' && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
          >
            <Plus size={20} />
            Novo Atendimento
          </button>
        )}
      </div>

      {/* Filters/Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
          <input 
            type="text" 
            placeholder="Buscar por nome, CPF ou descrição..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
          />
        </div>
        <button className="bg-slate-900 border border-slate-800 px-4 py-2 rounded-xl flex items-center gap-2 text-slate-400 hover:text-white transition-all">
          <Filter size={18} />
          Filtros
        </button>
      </div>

      {/* Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-medium">Paciente / Cidadão</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Status / Prioridade</th>
                <th className="px-6 py-4 font-medium">Data</th>
                <th className="px-6 py-4 font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {loading ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">Carregando...</td>
                </tr>
              ) : filteredData.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-10 text-center text-slate-500">Nenhum registro encontrado.</td>
                </tr>
              ) : filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-200">{item.nome_completo}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-slate-500">{item.cpf}</span>
                        <span className="text-[10px] text-slate-600">•</span>
                        <span className="text-[10px] text-slate-500">{item.telefone}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-300">
                      {item.tipo_atendimento}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col gap-1.5">
                      <div className="flex items-center gap-1.5">
                        <div className={cn(
                          "w-1.5 h-1.5 rounded-full",
                          item.status === 'Concluído' ? "bg-emerald-400" :
                          item.status === 'Novo' ? "bg-blue-400" :
                          "bg-amber-400"
                        )} />
                        <span className={cn(
                          "text-xs font-medium",
                          item.status === 'Concluído' ? "text-emerald-400" :
                          item.status === 'Novo' ? "text-blue-400" :
                          "text-amber-400"
                        )}>{item.status}</span>
                      </div>
                      <span className={cn(
                        "text-[10px] uppercase font-bold tracking-tight",
                        item.prioridade === 'Alta' ? "text-red-400" :
                        item.prioridade === 'Média' ? "text-amber-400" :
                        "text-slate-500"
                      )}>{item.prioridade}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs text-slate-400">
                    {item.created_at?.toDate ? format(item.created_at.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '...'}
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       {profile?.role !== 'consulta' && (
                         <>
                           <button 
                             onClick={() => updateStatus(item.id, 'Concluído')}
                             className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 transition-all opacity-0 group-hover:opacity-100"
                             title="Concluir"
                           >
                             <CheckCircle2 size={16} />
                           </button>
                           <button 
                             onClick={() => handleEdit(item)}
                             className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100"
                             title="Editar"
                           >
                             <Edit2 size={16} />
                           </button>
                           {profile?.role === 'admin' && (
                             <button 
                               onClick={() => handleDelete(item.id)}
                               className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                               title="Excluir"
                             >
                               <Trash2 size={16} />
                             </button>
                           )}
                         </>
                       )}
                       <button className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-all">
                         <MoreHorizontal size={16} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-10 bottom-10 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-[70] overflow-hidden flex flex-col"
            >
              <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight">{editingId ? 'Editar Atendimento' : 'Novo Atendimento'}</h2>
                  <p className="text-slate-500 text-sm font-sans">Preencha as informações para registro.</p>
                </div>
                <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Nome Completo</label>
                    <input 
                      required
                      type="text" 
                      value={formData.nome_completo}
                      onChange={e => setFormData({...formData, nome_completo: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Ex: João da Silva"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">CPF</label>
                    <input 
                      type="text" 
                      value={formData.cpf}
                      onChange={e => setFormData({...formData, cpf: maskCPF(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="000.000.000-00"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Telefone</label>
                    <input 
                      type="tel" 
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: maskPhone(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">E-mail</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Tipo de Atendimento</label>
                    <select 
                      value={formData.tipo_atendimento}
                      onChange={e => setFormData({...formData, tipo_atendimento: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option>Geral</option>
                      <option>Médico</option>
                      <option>Demanda</option>
                      <option>Sugestão</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Status</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option>Novo</option>
                      <option>Em andamento</option>
                      <option>Concluído</option>
                      <option>Encaminhado</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Prioridade</label>
                    <select 
                      value={formData.prioridade}
                      onChange={e => setFormData({...formData, prioridade: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option>Baixa</option>
                      <option>Média</option>
                      <option>Alta</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Descrição / Demanda</label>
                  <textarea 
                    rows={4}
                    value={formData.descricao}
                    onChange={e => setFormData({...formData, descricao: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    placeholder="Descreva detalhadamente o que foi solicitado..."
                  />
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={closeModal}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all"
                  >
                    {editingId ? 'Salvar Alterações' : 'Salvar Registro'}
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

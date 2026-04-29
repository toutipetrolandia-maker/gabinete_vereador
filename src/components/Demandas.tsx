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
  FileText, 
  X,
  Send,
  Flag,
  Clock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';

export default function Demandas() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initialForm = {
    assunto: '',
    orgao_responsavel: '',
    prioridade: 'Média',
    status: 'Pendente',
    descricao: ''
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const q = query(collection(db, 'demandas_parlamentares'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to demandas:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'demandas_parlamentares', editingId), {
          ...formData,
          updated_at: serverTimestamp()
        });
        await logAction('Atualizar', 'demandas_parlamentares', editingId, { previous: existing, next: formData });
      } else {
        const docRef = await addDoc(collection(db, 'demandas_parlamentares'), {
          ...formData,
          created_at: serverTimestamp(),
        });
        await logAction('Criar', 'demandas_parlamentares', docRef.id, { next: formData });
      }
      closeModal();
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
      assunto: item.assunto || '',
      orgao_responsavel: item.orgao_responsavel || '',
      prioridade: item.prioridade || 'Média',
      status: item.status || 'Pendente',
      descricao: item.descricao || ''
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir esta demanda?')) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'demandas_parlamentares', id));
      await logAction('Excluir', 'demandas_parlamentares', id, { previous: existing });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
             <FileText className="text-purple-500" />
             Demandas Parlamentares
          </h1>
          <p className="text-slate-400 text-sm">Ofícios, requerimentos e indicações.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20"
        >
          <Plus size={20} />
          Nova Demanda
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500">Carregando demandas...</div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center text-slate-600">Nenhuma demanda encontrada.</div>
        ) : data.map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col md:flex-row md:items-center gap-6"
          >
             <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                   <h3 className="font-bold text-slate-100">{item.assunto}</h3>
                   <span className={cn(
                     "text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold",
                     item.prioridade === 'Alta' ? "border-red-500/50 text-red-500 bg-red-500/5" : "border-slate-700 text-slate-500"
                   )}>{item.prioridade}</span>
                </div>
                <p className="text-sm text-slate-400 mb-4">{item.descricao}</p>
                <div className="flex flex-wrap gap-4 text-xs">
                   <div className="flex items-center gap-1.5 text-slate-500">
                      <Send size={14} className="text-purple-400" />
                      <span>Órgão: <strong className="text-slate-300">{item.orgao_responsavel}</strong></span>
                   </div>
                   <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock size={14} className="text-blue-400" />
                      <span>Status: <strong className="text-slate-300">{item.status}</strong></span>
                   </div>
                </div>
             </div>
             <div className="flex items-center gap-2 shrink-0">
                {profile?.role !== 'consulta' && (
                  <button 
                    onClick={() => handleEdit(item)}
                    className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 rounded-lg transition-all"
                  >
                    Editar
                  </button>
                )}
                {profile?.role === 'admin' && (
                  <button 
                    onClick={() => handleDelete(item.id)}
                    className="text-xs font-bold text-red-400 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all"
                  >
                    Excluir
                  </button>
                )}
                <button className="text-xs font-bold text-white px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/20">
                  Gerar Ofício
                </button>
             </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-slate-950/90 z-[60]" />
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }} className="fixed inset-x-4 top-10 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] bg-slate-900 border border-slate-800 rounded-3xl z-[70] shadow-2xl flex flex-col max-h-[80vh]">
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                  <h2 className="text-xl font-bold">{editingId ? 'Editar Demanda' : 'Encaminhar Demanda'}</h2>
                  <button onClick={closeModal}><X /></button>
               </div>
               <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Assunto / Título</label>
                     <input required value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Órgão Destino</label>
                        <input value={formData.orgao_responsavel} onChange={e => setFormData({...formData, orgao_responsavel: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" placeholder="Ex: Sec. de Obras" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Prioridade</label>
                        <select value={formData.prioridade} onChange={e => setFormData({...formData, prioridade: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none">
                           <option>Baixa</option>
                           <option>Média</option>
                           <option>Alta</option>
                        </select>
                     </div>
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Status</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none">
                          <option>Pendente</option>
                          <option>Encaminhado</option>
                          <option>Concluído</option>
                      </select>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold text-slate-500 uppercase">Descrição Detalhada</label>
                     <textarea rows={4} value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none resize-none" />
                  </div>
                  <button type="submit" className="w-full bg-purple-600 hover:bg-purple-700 py-3 rounded-xl font-bold text-white shadow-xl shadow-purple-900/20">
                      {editingId ? 'Salvar Alterações' : 'Protocolar Demanda'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

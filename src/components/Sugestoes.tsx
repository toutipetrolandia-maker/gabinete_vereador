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
import { 
  Plus, 
  Search, 
  Package,
  X,
  Truck,
  ArrowRight,
  FileText,
  Edit2,
  Trash2,
  MessageSquare,
  MessageCircle,
  Clock,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { logAction } from '../lib/audit';
import { useAuth } from '../hooks/useAuth';

export default function Sugestoes() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initialForm = {
    nome_completo: '',
    telefone: '',
    email: '',
    sugestao: '',
    status: 'Nova'
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    const q = query(collection(db, 'sugestoes'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to sugestoes:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'sugestoes', editingId), {
          ...formData,
          updated_at: serverTimestamp()
        });
        await logAction('Atualizar', 'sugestoes', editingId, { previous: existing, next: formData });
      } else {
        const docRef = await addDoc(collection(db, 'sugestoes'), {
          ...formData,
          created_at: serverTimestamp(),
        });
        await logAction('Criar', 'sugestoes', docRef.id, { next: formData });
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
      nome_completo: item.nome_completo || '',
      telefone: item.telefone || '',
      email: item.email || '',
      sugestao: item.sugestao || '',
      status: item.status || 'Nova'
    });
    setShowModal(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Excluir esta sugestão?')) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'sugestoes', id));
      await logAction('Excluir', 'sugestoes', id, { previous: existing });
    } catch (err) {
      console.error(err);
    }
  };

  const updateStatus = async (e: React.MouseEvent, id: string, newStatus: string) => {
    e.stopPropagation();
    try {
      const existing = data.find(i => i.id === id);
      await updateDoc(doc(db, 'sugestoes', id), {
        status: newStatus,
        updated_at: serverTimestamp()
      });
      await logAction('Atualizar', 'sugestoes', id, { previous: { status: existing?.status }, next: { status: newStatus } });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
             <MessageSquare className="text-blue-500 shrink-0" />
             Sugestões
          </h1>
          <p className="text-slate-400 text-sm">Ouvidoria e feedback dos cidadãos.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 w-full sm:w-auto"
        >
          <Plus size={20} />
          <span className="font-semibold text-sm">Registrar Sugestão</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-500">Carregando sugestões...</div>
        ) : data.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-600">Nenhuma sugestão registrada.</div>
        ) : data.map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => profile?.role !== 'consulta' && handleEdit(item)}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-blue-500/30 transition-all"
          >
             <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                {profile?.role === 'admin' && (
                  <button 
                    onClick={(e) => handleDelete(e, item.id)}
                    className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
                <span className={cn(
                  "text-[9px] font-bold tracking-widest px-2 py-1 rounded bg-slate-800 text-slate-400 uppercase",
                  item.status === 'Analisada' && "text-emerald-400 bg-emerald-400/5 border border-emerald-500/20"
                )}>
                  {item.status}
                </span>
             </div>
             
             <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 bg-blue-600/10 rounded-full flex items-center justify-center text-blue-500 font-bold">
                   {item.nome_completo?.[0]}
                </div>
                <div>
                   <h3 className="font-bold text-slate-100">{item.nome_completo}</h3>
                   <span className="text-[10px] text-slate-500 font-mono italic">{item.telefone}</span>
                </div>
             </div>

             <div className="bg-slate-950/50 p-4 rounded-2xl mb-4 border border-slate-800">
                <p className="text-sm text-slate-300 leading-relaxed italic">"{item.sugestao}"</p>
             </div>

             <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-tight">
                <div className="flex items-center gap-1">
                   <Clock size={12} />
                   {item.created_at?.toDate ? format(item.created_at.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '...'}
                </div>
                {profile?.role !== 'consulta' && item.status === 'Nova' && (
                  <button 
                    onClick={(e) => updateStatus(e, item.id, 'Analisada')}
                    className="text-blue-400 font-bold hover:underline"
                  >
                    Marcar como Analisada
                  </button>
                )}
             </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-slate-950/95 z-[60] backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] bg-slate-900 border border-slate-800 rounded-3xl z-[70] p-8 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-display font-bold">{editingId ? 'Editar Sugestão' : 'Ouvidoria Pública'}</h2>
                  <button onClick={closeModal} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><X size={18} /></button>
               </div>
               <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-4">
                     <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input required value={formData.nome_completo} onChange={e => setFormData({...formData, nome_completo: e.target.value})} className="w-full pl-10 bg-slate-800 border-none rounded-xl py-4 focus:ring-2 focus:ring-blue-500/30" placeholder="Nome do Cidadão" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <input value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500/30" placeholder="Telefone" />
                        <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500/30" placeholder="E-mail" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none appearance-none">
                            <option>Nova</option>
                            <option>Analisada</option>
                            <option>Arquivada</option>
                        </select>
                     </div>
                     <textarea required rows={4} value={formData.sugestao} onChange={e => setFormData({...formData, sugestao: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="Qual a sugestão ou reclamação?" />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                     <MessageCircle size={18} />
                     {editingId ? 'Salvar Alterações' : 'Registrar Mensagem'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

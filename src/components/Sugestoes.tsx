import React, { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where,
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
import { cn, formatProperName } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { logAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { useAuth } from '../hooks/useAuth';

export default function Sugestoes() {
  const { profile, user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [cabinetUsers, setCabinetUsers] = useState<any[]>([]);

  const initialForm = {
    nome_completo: '',
    telefone: '',
    email: '',
    endereco: '',
    bairro: '',
    sugestao: '',
    status: 'Nova',
    lembrete: '',
    lgpd_consent: false,
    assessor_id: '',
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!profile?.cabinetId) return;
    const q = query(
      collection(db, 'users'), 
      where('cabinetId', '==', profile.cabinetId),
      where('ativo', '==', true)
    );
    const unsub = onSnapshot(q, (snap) => {
      const uList = snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      setCabinetUsers(uList);
    }, (error) => {
      console.error("Error fetching cabinet users in sugestoes:", error);
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  const getAssessorName = (assessorId: string) => {
    const userObj = cabinetUsers.find(u => u.id === assessorId);
    return userObj ? userObj.nome : 'Não atribuído';
  };

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'sugestoes'), 
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'sugestoes');
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile?.cabinetId]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lgpd_consent) {
      alert("É necessário o consentimento da LGPD para registrar a sugestão.");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...formData,
        nome_completo: formatProperName(formData.nome_completo)
      };

      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'sugestoes', editingId), {
          ...payload,
          cabinetId: profile?.cabinetId,
          usuario_id: user?.uid,
          updated_at: serverTimestamp()
        });
        await logAction('Atualizar', 'sugestoes', editingId, { previous: existing, next: payload });
      } else {
        const docRef = await addDoc(collection(db, 'sugestoes'), {
          ...payload,
          cabinetId: profile?.cabinetId,
          usuario_id: user?.uid,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp(),
        });
        await logAction('Criar', 'sugestoes', docRef.id, { next: payload });
      }
      closeModal();
    } catch (err) {
      console.error("Submit error:", err);
      alert("Erro ao salvar sugestão. Tente novamente.");
      handleFirestoreError(err, OperationType.WRITE, 'sugestoes');
    } finally {
      setSubmitting(false);
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
      endereco: item.endereco || '',
      bairro: item.bairro || '',
      sugestao: item.sugestao || '',
      status: item.status || 'Nova',
      lembrete: item.lembrete || '',
      lgpd_consent: item.lgpd_consent || false,
      assessor_id: item.assessor_id || '',
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
      handleFirestoreError(err, OperationType.DELETE, `sugestoes/${id}`);
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
      handleFirestoreError(err, OperationType.UPDATE, `sugestoes/${id}`);
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
      item.sugestao?.toLowerCase().includes(search.toLowerCase());
    
    const matchesPhone = !searchPhone || item.telefone?.replace(/\D/g, '').includes(searchPhone.replace(/\D/g, ''));
    
    return matchesSearch && matchesPhone;
  });

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

      {/* Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -track-y-1/2 mt-0 text-slate-500" size={18} style={{ transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Buscar por nome ou sugestão..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 md:py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-sm md:text-base text-white"
          />
        </div>
        <div className="relative flex-1 max-w-xs">
          <MessageCircle className="absolute left-3 top-1/2 -track-y-1/2 mt-0 text-slate-500" size={18} style={{ transform: 'translateY(-50%)' }} />
          <input 
            type="text" 
            placeholder="Buscar por Telefone..."
            value={searchPhone}
            onChange={(e) => setSearchPhone(e.target.value)}
            className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 md:py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-sm md:text-base text-white"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-500">Carregando sugestões...</div>
        ) : filteredData.length === 0 ? (
          <div className="col-span-full py-20 text-center text-slate-600">Nenhuma sugestão encontrada.</div>
        ) : filteredData.map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => profile?.role !== 'consulta' && handleEdit(item)}
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden cursor-pointer hover:border-blue-500/30 transition-all"
          >
             <div className="absolute top-0 right-0 p-4 flex items-center gap-2">
                {(profile?.role === 'admin' || profile?.role === 'secretaria_parlamentar') && (
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
                   <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-slate-500">
                      <span className="text-[10px] font-mono italic">{item.telefone}</span>
                      {item.telefone && (
                        <a 
                          href={`https://wa.me/55${item.telefone.replace(/\D/g, '')}`} 
                          target="_blank" 
                          rel="noreferrer"
                          className="text-emerald-500 hover:text-emerald-400 transition-colors"
                          title="Ver no WhatsApp"
                        >
                          <MessageCircle size={12} />
                        </a>
                      )}
                      {(item.endereco || item.bairro) && (
                        <span className="text-[9px] text-slate-500 font-medium">
                          • {item.endereco}{item.endereco && item.bairro ? ', ' : ''}{item.bairro}
                        </span>
                      )}
                   </div>
                </div>
             </div>

             <div className="bg-slate-950/50 p-4 rounded-2xl mb-4 border border-slate-800">
                <p className="text-sm text-slate-300 leading-relaxed italic">"{item.sugestao}"</p>
                {item.lembrete && (
                   <div className="mt-2 flex items-center gap-2 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded-lg border border-blue-500/20 w-fit">
                     <Clock size={10} />
                     <span>Lembrete: {format(new Date(item.lembrete + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                   </div>
                )}
             </div>

             <div className="flex items-center justify-between text-[10px] text-slate-500 uppercase tracking-tight">
                <div className="flex flex-wrap items-center gap-3">
                   <div className="flex items-center gap-1">
                      <Clock size={12} />
                      {item.created_at?.toDate ? format(item.created_at.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '...'}
                   </div>
                   {/* Interactive Assessor quick assign for Secretaria / Vereador / Admin */}
                   {profile?.role === 'admin' || profile?.role === 'vereador' || profile?.role === 'secretaria_parlamentar' ? (
                     <span className="inline-flex items-center gap-1 bg-slate-800 text-blue-300 border border-slate-700/50 px-2 py-0.5 rounded font-medium" onClick={(e) => e.stopPropagation()}>
                       <span className="text-slate-400 font-bold mr-1">Assessor:</span>
                       <select 
                         value={item.assessor_id || ''}
                         onChange={async (e) => {
                           const newAssessorId = e.target.value;
                           try {
                             await updateDoc(doc(db, 'sugestoes', item.id), {
                               assessor_id: newAssessorId,
                               updated_at: serverTimestamp()
                             });
                             await logAction('Atualizar', 'sugestoes', item.id, { 
                               previous: { assessor_id: item.assessor_id || '' }, 
                               next: { assessor_id: newAssessorId } 
                             });
                           } catch (err) {
                             console.error("Erro ao atribuir assessor para sugestão:", err);
                             alert("Erro ao atribuir assessor.");
                           }
                         }}
                         className="bg-transparent border-none text-blue-300 focus:outline-none focus:ring-0 cursor-pointer pr-1 py-0 scrollbar-none font-bold text-[10px] uppercase"
                       >
                         <option value="" className="bg-slate-900 text-slate-300">Não Atribuído</option>
                         {cabinetUsers.map(u => (
                           <option key={u.id} value={u.id} className="bg-slate-900 text-slate-300">{u.nome}</option>
                         ))}
                       </select>
                     </span>
                   ) : (
                     item.assessor_id && (
                       <span className="inline-flex items-center gap-1 bg-slate-800/80 text-blue-300 border border-slate-700/50 px-2 py-0.5 rounded font-medium">
                         <span className="text-slate-500 font-bold">Assessor:</span> {getAssessorName(item.assessor_id)}
                       </span>
                     )
                   )}
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
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="fixed inset-x-2 top-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] md:h-auto md:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl z-[70] shadow-2xl flex flex-col overflow-hidden"
            >
               <div className="flex justify-between items-center px-6 py-4 md:px-8 md:py-6 border-b border-slate-800 bg-slate-900">
                  <h2 className="text-xl md:text-2xl font-display font-bold">{editingId ? 'Editar Sugestão' : 'Ouvidoria Pública'}</h2>
                  <button onClick={closeModal} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><X size={18} /></button>
               </div>
               <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                  <div className="space-y-4">
                     <div className="relative group">
                        <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-blue-500 transition-colors" size={18} />
                        <input required value={formData.nome_completo} onChange={e => setFormData({...formData, nome_completo: e.target.value})} className="w-full pl-10 bg-slate-800 border-none rounded-xl py-4 focus:ring-2 focus:ring-blue-500/30" placeholder="Nome do Cidadão" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <input value={formData.telefone} onChange={e => setFormData({...formData, telefone: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500/30" placeholder="Telefone" />
                        <input value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500/30" placeholder="E-mail" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <input value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500/30" placeholder="Endereço" />
                        <input value={formData.bairro} onChange={e => setFormData({...formData, bairro: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500/30" placeholder="Bairro" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Status</label>
                        <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none appearance-none">
                            <option>Nova</option>
                            <option>Analisada</option>
                            <option>Arquivada</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Lembrete para Acompanhamento</label>
                        <input type="date" value={formData.lembrete} onChange={e => setFormData({...formData, lembrete: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl py-4 px-4 focus:ring-2 focus:ring-blue-500/30 [color-scheme:dark]" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Assessor Responsável</label>
                        <select 
                          value={formData.assessor_id || ''} 
                          onChange={e => setFormData({...formData, assessor_id: e.target.value})} 
                          className="w-full bg-slate-800 rounded-xl p-3 border-none appearance-none cursor-pointer text-slate-200 focus:ring-2 focus:ring-blue-500/30"
                        >
                            <option value="">Selecione um assessor...</option>
                            {cabinetUsers.map(u => (
                              <option key={u.id} value={u.id}>{u.nome}</option>
                            ))}
                        </select>
                     </div>
                     <textarea required rows={4} value={formData.sugestao} onChange={e => setFormData({...formData, sugestao: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="Qual a sugestão ou reclamação?" />
                  </div>

                  <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                     <input 
                       required
                       type="checkbox" 
                       checked={formData.lgpd_consent}
                       onChange={(e) => setFormData({...formData, lgpd_consent: e.target.checked})}
                       className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                     />
                     <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                        O cidadão declara estar ciente e concorda com a coleta e processamento de seus dados pessoais para fins de ouvidoria parlamentar, conforme a <strong>LGPD</strong>.
                     </p>
                  </div>

                  <button 
                    type="submit" 
                    disabled={submitting}
                    className={cn(
                      "w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20",
                      submitting && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <MessageCircle size={18} />
                        {editingId ? 'Salvar Alterações' : 'Registrar Mensagem'}
                      </>
                    )}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

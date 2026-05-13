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
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  FileText, 
  X,
  Send,
  Flag,
  Clock,
  Paperclip,
  Download,
  Trash2,
  Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';

export default function Demandas() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initialForm = {
    protocolo: '',
    assunto: '',
    orgao_responsavel: '',
    prioridade: 'Média',
    status: 'Pendente',
    descricao: '',
    attachments: [] as { name: string, url: string, type: string }[]
  };

  const [formData, setFormData] = useState(initialForm);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'demandas_parlamentares'), 
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to demandas:", error);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [profile?.cabinetId]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'demandas_parlamentares', editingId), {
          ...formData,
          cabinetId: profile?.cabinetId,
          usuario_id: profile?.role === 'admin' ? existing?.usuario_id : profile?.nome || 'Assessor', // Just for consistency
          updated_at: serverTimestamp()
        });
        await logAction('Atualizar', 'demandas_parlamentares', editingId, { previous: existing, next: formData });
      } else {
        const docRef = await addDoc(collection(db, 'demandas_parlamentares'), {
          ...formData,
          cabinetId: profile?.cabinetId,
          usuario_id: profile?.nome || 'Assessor',
          created_at: serverTimestamp(),
        });
        await logAction('Criar', 'demandas_parlamentares', docRef.id, { next: formData });
      }
      closeModal();
    } catch (err) {
      console.error("Submit error:", err);
      alert("Erro ao salvar demanda. Tente novamente.");
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
      protocolo: item.protocolo || '',
      assunto: item.assunto || '',
      orgao_responsavel: item.orgao_responsavel || '',
      prioridade: item.prioridade || 'Média',
      status: item.status || 'Pendente',
      descricao: item.descricao || '',
      attachments: item.attachments || []
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
             <FileText className="text-purple-500 shrink-0" />
             Demandas Parlamentares
          </h1>
          <p className="text-slate-400 text-sm">Ofícios, requerimentos e indicações.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 w-full sm:w-auto"
        >
          <Plus size={20} />
          <span className="font-semibold text-sm">Nova Demanda</span>
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
                   {item.protocolo && (
                     <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-lg font-bold shrink-0 shadow-sm shadow-purple-900/10">
                       <span className="text-[8px] opacity-50 mr-1 font-black uppercase">id</span>
                       {item.protocolo}
                     </span>
                   )}
                   <h3 className="font-bold text-slate-100">{item.assunto}</h3>
                   <span className={cn(
                     "text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold",
                     item.prioridade === 'Alta' ? "border-red-500/50 text-red-500 bg-red-500/5" : "border-slate-700 text-slate-500"
                   )}>{item.prioridade}</span>
                </div>
                <p className="text-sm text-slate-400 mb-4">{item.descricao}</p>
                
                {item.attachments && item.attachments.length > 0 && (
                   <div className="flex flex-wrap gap-2 mb-4">
                      {item.attachments.map((file: any, idx: number) => (
                         <a 
                           key={idx}
                           href={file.url}
                           target="_blank"
                           rel="noopener noreferrer"
                           className="flex items-center gap-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-[10px] text-slate-300 hover:bg-slate-750 transition-colors"
                         >
                            <Paperclip size={12} className="text-purple-400" />
                            <span className="truncate max-w-[150px]">{file.name}</span>
                            <Download size={12} className="text-slate-500" />
                         </a>
                      ))}
                   </div>
                )}

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
                {(profile?.role === 'admin' || profile?.role === 'secretaria_parlamentar') && (
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
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="fixed inset-x-2 top-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] md:h-auto md:max-h-[95vh] bg-slate-900 border border-slate-800 rounded-3xl z-[70] shadow-2xl flex flex-col overflow-hidden"
            >
               <div className="p-6 border-b border-slate-800 flex justify-between items-center bg-slate-900">
                  <h2 className="text-lg md:text-xl font-bold">{editingId ? 'Editar Demanda' : 'Encaminhar Demanda'}</h2>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg transition-colors">
                    <X size={20} className="text-slate-400" />
                  </button>
               </div>
               <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                  <div className="grid grid-cols-3 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Nº Protocolo</label>
                        <input value={formData.protocolo} onChange={e => setFormData({...formData, protocolo: e.target.value.toUpperCase()})} className="w-full bg-slate-800 rounded-xl p-3 border-none font-mono text-sm" placeholder="2024/001" />
                     </div>
                     <div className="space-y-1 col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Assunto / Título</label>
                        <input required value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" />
                     </div>
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

                  <div className="space-y-3 pt-2">
                     <label className="text-[10px] font-bold text-slate-500 uppercase flex items-center gap-2">
                       <Paperclip size={12} />
                       Anexos e Documentos
                     </label>
                     
                     <div className="grid grid-cols-1 gap-2">
                        {formData.attachments.map((file, idx) => (
                           <div key={idx} className="flex items-center justify-between bg-slate-800/50 p-3 rounded-xl border border-slate-700/50">
                              <div className="flex items-center gap-3 overflow-hidden">
                                 <div className="w-8 h-8 rounded-lg bg-slate-700 flex items-center justify-center shrink-0">
                                    <FileText size={16} className="text-purple-400" />
                                 </div>
                                 <span className="text-xs text-slate-300 truncate">{file.name}</span>
                              </div>
                              <button 
                                type="button"
                                onClick={() => setFormData({ ...formData, attachments: formData.attachments.filter((_, i) => i !== idx) })}
                                className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                              >
                                 <Trash2 size={16} />
                               </button>
                           </div>
                        ))}
                     </div>

                     <div className="relative group">
                        <input 
                          type="file" 
                          multiple
                          onChange={async (e) => {
                             const files = e.target.files;
                             if (!files || files.length === 0) return;
                             
                             setUploading(true);
                             const newAttachments = [...formData.attachments];
                             
                             for (let i = 0; i < files.length; i++) {
                                const file = files[i];
                                const storageRef = ref(storage, `demandas/${Date.now()}_${file.name}`);
                                try {
                                   await uploadBytes(storageRef, file);
                                   const url = await getDownloadURL(storageRef);
                                   newAttachments.push({
                                      name: file.name,
                                      url: url,
                                      type: file.type
                                   });
                                } catch (err) {
                                   console.error("Upload error:", err);
                                }
                             }
                             
                             setFormData({ ...formData, attachments: newAttachments });
                             setUploading(false);
                          }}
                          className="absolute inset-0 opacity-0 cursor-pointer z-10"
                          disabled={uploading}
                        />
                        <div className={cn(
                          "bg-slate-800/30 border-2 border-dashed border-slate-700 rounded-2xl p-6 text-center transition-all group-hover:border-purple-500/50",
                          uploading && "opacity-50"
                        )}>
                           {uploading ? (
                              <div className="flex flex-col items-center gap-2">
                                 <Loader2 className="animate-spin text-purple-500" size={24} />
                                 <span className="text-xs text-slate-400 font-bold uppercase tracking-widest">Enviando arquivos...</span>
                              </div>
                           ) : (
                              <div className="flex flex-col items-center gap-2">
                                 <Plus className="text-slate-500 group-hover:text-purple-500 transition-colors" size={24} />
                                 <span className="text-xs text-slate-400 font-bold uppercase tracking-widest group-hover:text-slate-200 transition-colors">Anexar Documento</span>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>

                  <button 
                    type="submit" 
                    disabled={submitting || uploading} 
                    className={cn(
                      "w-full bg-purple-600 hover:bg-purple-700 py-4 rounded-xl font-bold text-white shadow-xl shadow-purple-900/20 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2",
                      (submitting || uploading) && "opacity-70"
                    )}
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : editingId ? 'Salvar Alterações' : 'Protocolar Demanda'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

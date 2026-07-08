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
  Loader2,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatProperName } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';
import { toast } from 'sonner';
import { showSuccessNotification } from '../lib/notifications';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { getWhatsAppLink, formatWhatsAppMessage, WhatsAppConfig, sendWhatsAppNotification } from '../lib/whatsapp';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../lib/firebase';
import ReactMarkdown from 'react-markdown';
import { generateExecutiveDemandSummary } from '../services/aiService';

export default function Demandas() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initialForm = {
    protocolo: '',
    assunto: '',
    solicitante_nome: '',
    solicitante_telefone: '',
    orgao_responsavel: '',
    prioridade: 'Média',
    status: 'Pendente',
    descricao: '',
    assessor_id: '',
    assessor_nome: '',
    attachments: [] as { name: string, url: string, type: string }[]
  };

  const [aiSummaries, setAiSummaries] = useState<Record<string, string>>({});
  const [loadingSummaryId, setLoadingSummaryId] = useState<string | null>(null);
  const [expandedSummaries, setExpandedSummaries] = useState<Record<string, boolean>>({});

  const [formData, setFormData] = useState(initialForm);
  const [assessors, setAssessors] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);
  const [filterMine, setFilterMine] = useState(false);

  useEffect(() => {
    if (!profile?.cabinetId) return;
    
    // Fetch assessors for assignment (only for admin/secretaria)
    const canAssign = profile.role === 'admin' || profile.role === 'secretaria_parlamentar';
    if (canAssign) {
      const q = query(
        collection(db, 'users'), 
        where('cabinetId', '==', profile.cabinetId),
        where('ativo', '==', true)
      );
      const unsub = onSnapshot(q, (snap) => {
        setAssessors(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      });
      return () => unsub();
    }
  }, [profile?.cabinetId, profile?.role]);

  useEffect(() => {
    if (!profile?.cabinetId) return;
    const unsub = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        setWaConfig(snap.data().whatsapp_config);
      }
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  const sendWAMessage = async (item: any, trigger: 'welcome' | 'status_update') => {
    const phone = item.solicitante_telefone || item.telefone;
    if (!phone) return;
    
    const template = waConfig?.templates?.find(t => t.trigger === trigger);
    const content = template?.content || (trigger === 'welcome' ? 'Olá {{nome}}, recebemos sua demanda.' : 'Olá {{nome}}, sua demanda foi atualizada para {{status}}.');
    
    const message = formatWhatsAppMessage(content, {
      nome: item.solicitante_nome || 'Cidadão',
      status: item.status,
      id: item.protocolo || item.id,
      titulo: item.assunto
    });

    const toastId = toast.loading('Enviando mensagem de WhatsApp...');
    try {
      const res = await sendWhatsAppNotification(waConfig, phone, message);
      if (res.type === 'api') {
        toast.success('Mensagem enviada com sucesso via API!', { id: toastId });
      } else {
        if (res.error) {
          toast.warning(`API indisponível: ${res.error}. Abrindo WhatsApp manual...`, { id: toastId, duration: 4000 });
        } else {
          toast.success('Pronto! Abrindo link do WhatsApp...', { id: toastId });
        }
      }
    } catch (e: any) {
      toast.error('Erro ao processar envio de WhatsApp.', { id: toastId });
    }
  };

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
      const payload = {
        ...formData,
        solicitante_nome: formatProperName(formData.solicitante_nome)
      };

      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'demandas_parlamentares', editingId), {
          ...payload,
          cabinetId: profile?.cabinetId,
          usuario_id: existing?.usuario_id || profile?.id || 'system',
          updated_at: serverTimestamp()
        });
        await logAction('Atualizar', 'demandas_parlamentares', editingId, { previous: existing, next: payload });
        showSuccessNotification("Demanda Atualizada!", `A demanda de ${payload.solicitante_nome} foi atualizada com sucesso.`, "demanda");

        // Automatic status update trigger
        if (existing && existing.status !== payload.status) {
          const statusTemplate = waConfig?.templates?.find(t => t.trigger === 'status_update');
          const phone = payload.solicitante_telefone;
          if (statusTemplate?.enabledAuto && phone) {
            const tempItem = {
              solicitante_nome: payload.solicitante_nome,
              solicitante_telefone: phone,
              assunto: payload.assunto || 'Demanda',
              status: payload.status
            };
            setTimeout(() => {
              sendWAMessage(tempItem, 'status_update');
            }, 600);
          }
        }
      } else {
        const docRef = await addDoc(collection(db, 'demandas_parlamentares'), {
          ...payload,
          cabinetId: profile?.cabinetId,
          usuario_id: profile?.id || 'system',
          created_at: serverTimestamp(),
        });
        await logAction('Criar', 'demandas_parlamentares', docRef.id, { next: payload });
        showSuccessNotification("Demanda Registrada!", `A demanda de ${payload.solicitante_nome} foi cadastrada com sucesso.`, "demanda");

        // Automatic welcome trigger
        const welcomeTemplate = waConfig?.templates?.find(t => t.trigger === 'welcome');
        const phone = payload.solicitante_telefone;
        if (welcomeTemplate?.enabledAuto && phone) {
          const tempItem = {
            solicitante_nome: payload.solicitante_nome,
            solicitante_telefone: phone,
            assunto: payload.assunto || 'Demanda',
            status: payload.status || 'Pendente'
          };
          setTimeout(() => {
            sendWAMessage(tempItem, 'welcome');
          }, 600);
        }
      }
      closeModal();
    } catch (err: any) {
      console.error("Submit error:", err);
      toast.error("Erro ao salvar demanda. Tente novamente.");
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
      solicitante_nome: item.solicitante_nome || '',
      solicitante_telefone: item.solicitante_telefone || '',
      orgao_responsavel: item.orgao_responsavel || '',
      prioridade: item.prioridade || 'Média',
      status: item.status || 'Pendente',
      descricao: item.descricao || '',
      assessor_id: item.assessor_id || '',
      assessor_nome: item.assessor_nome || '',
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
      toast.success("Demanda excluída com sucesso!");
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir demanda.");
    }
  };

  const handleGenerateSummary = async (item: any) => {
    if (loadingSummaryId) return;
    setLoadingSummaryId(item.id);
    try {
      const summary = await generateExecutiveDemandSummary(
        item.assunto || 'Sem assunto',
        item.descricao || 'Nenhuma descrição detalhada',
        item.orgao_responsavel || 'Órgão não especificado',
        item.prioridade || 'Média',
        item.status || 'Pendente',
        item.solicitante_nome || 'Não identificado'
      );
      setAiSummaries(prev => ({ ...prev, [item.id]: summary }));
      setExpandedSummaries(prev => ({ ...prev, [item.id]: true }));
      await logAction('Análise IA', 'demandas_parlamentares', item.id, { next: { action: 'Resumo executivo gerado via Gemini' } });
      toast.success("Análise de IA concluída com sucesso!");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Erro ao conectar-se ao Gemini. Verifique a chave de API.");
    } finally {
      setLoadingSummaryId(null);
    }
  };

  const toggleSummary = (id: string) => {
    setExpandedSummaries(prev => ({ ...prev, [id]: !prev[id] }));
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
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterMine(!filterMine)}
            className={cn(
              "px-4 py-2 rounded-xl text-xs font-bold transition-all border",
              filterMine 
                ? "bg-purple-600 border-purple-500 text-white shadow-lg shadow-purple-900/40" 
                : "bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200"
            )}
          >
            {filterMine ? "Ver Todas" : "Minhas Demandas"}
          </button>
          <button 
            onClick={() => setShowModal(true)}
            className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-purple-900/20 w-full sm:w-auto"
          >
            <Plus size={20} />
            <span className="font-semibold text-sm">Nova Demanda</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          <div className="py-20 text-center text-slate-500">Carregando demandas...</div>
        ) : data.length === 0 ? (
          <div className="py-20 text-center text-slate-600">Nenhuma demanda encontrada.</div>
        ) : data
          .filter(item => !filterMine || item.assessor_id === profile?.id)
          .map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, scale: 0.99 }}
            animate={{ opacity: 1, scale: 1 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex flex-col gap-5 hover:border-slate-750 transition-colors"
          >
             {/* Upper row: Main info + Action Buttons */}
             <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                <div className="flex-1 space-y-3">
                   <div className="flex flex-wrap items-center gap-3">
                      {item.protocolo && (
                        <span className="text-[10px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 rounded-lg font-bold shrink-0 shadow-sm shadow-purple-900/10">
                          <span className="text-[8px] opacity-50 mr-1 font-black uppercase">id</span>
                          {item.protocolo}
                        </span>
                      )}
                      <h3 className="font-bold text-slate-100 text-base">{item.assunto}</h3>
                      <span className={cn(
                        "text-[10px] px-2 py-0.5 rounded-full border uppercase font-bold",
                        item.prioridade === 'Alta' ? "border-red-500/50 text-red-500 bg-red-500/5" : "border-slate-700 text-slate-500"
                      )}>{item.prioridade}</span>
                   </div>
                   <p className="text-sm text-slate-400 leading-relaxed font-normal">{item.descricao}</p>
                   
                   {item.attachments && item.attachments.length > 0 && (
                      <div className="flex flex-wrap gap-2 pt-1">
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

                   <div className="flex flex-wrap gap-x-5 gap-y-2 text-xs pt-1">
                      <div className="flex items-center gap-1.5 text-slate-500">
                         <Send size={14} className="text-purple-400" />
                         <span>Órgão: <strong className="text-slate-300 font-semibold">{item.orgao_responsavel}</strong></span>
                      </div>
                      <div className="flex items-center gap-1.5 text-slate-500">
                         <Clock size={14} className="text-blue-400" />
                         <span>Status: <strong className="text-slate-300 font-semibold">{item.status}</strong></span>
                      </div>
                      {item.assessor_nome && (
                        <div className="flex items-center gap-1.5 text-slate-500">
                           <div className="w-4 h-4 rounded-full bg-purple-500/20 flex items-center justify-center">
                             <span className="text-[8px] font-bold text-purple-400">{item.assessor_nome.substring(0, 1)}</span>
                           </div>
                           <span>Atribuído a: <strong className="text-purple-400 font-semibold">{item.assessor_nome}</strong></span>
                        </div>
                      )}
                      {item.solicitante_telefone && (
                        <button 
                          type="button"
                          onClick={() => sendWAMessage(item, 'status_update')}
                          className="flex items-center gap-1.5 text-emerald-500 hover:text-emerald-400 font-bold transition-all"
                        >
                           <MessageSquare size={14} />
                           <span>Notificar WhatsApp</span>
                        </button>
                      )}
                   </div>
                </div>

                {/* Card CTA Buttons */}
                <div className="flex flex-wrap lg:grid lg:grid-cols-1 xl:flex items-center gap-2 shrink-0 lg:self-start">
                   {/* GEMINI AI SUMMARY ENGINE BUTTON */}
                   <button 
                     type="button"
                     onClick={() => aiSummaries[item.id] ? toggleSummary(item.id) : handleGenerateSummary(item)}
                     disabled={loadingSummaryId !== null && loadingSummaryId !== item.id}
                     className={cn(
                       "text-xs font-bold px-3 py-1.5 rounded-lg border transition-all cursor-pointer flex items-center gap-1.5",
                       aiSummaries[item.id]
                         ? "bg-purple-950/20 border-purple-500/30 text-purple-300 hover:text-white"
                         : loadingSummaryId === item.id
                           ? "bg-slate-850 border-slate-800 text-slate-500"
                           : "bg-gradient-to-r from-purple-500/10 to-indigo-500/10 hover:from-purple-500/20 hover:to-indigo-500/20 border-purple-500/20 text-purple-400 hover:text-purple-300"
                     )}
                   >
                     {loadingSummaryId === item.id ? (
                       <>
                         <Loader2 className="animate-spin text-purple-500" size={13} />
                         <span>Processando...</span>
                       </>
                     ) : aiSummaries[item.id] ? (
                       <>
                         <Sparkles className="text-purple-400" size={13} />
                         <span>{expandedSummaries[item.id] ? 'Ocultar Análise' : 'Análise da IA'}</span>
                       </>
                     ) : (
                       <>
                         <Sparkles className="text-purple-500" size={13} />
                         <span>Resumir com IA</span>
                       </>
                     )}
                   </button>

                   {profile?.role !== 'consulta' && (
                     <button 
                       type="button"
                       onClick={() => handleEdit(item)}
                       className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 bg-slate-800 rounded-lg transition-all cursor-pointer border border-transparent hover:border-slate-700"
                     >
                       Editar
                     </button>
                   )}
                   {(profile?.role === 'admin' || profile?.role === 'secretaria_parlamentar') && (
                     <button 
                       type="button"
                       onClick={() => handleDelete(item.id)}
                       className="text-xs font-bold text-red-500/80 hover:bg-red-500/10 px-3 py-1.5 rounded-lg transition-all cursor-pointer border border-transparent hover:border-red-500/10"
                     >
                       Excluir
                     </button>
                   )}
                   <button 
                     type="button"
                     className="text-xs font-bold text-white px-3 py-1.5 bg-purple-600/20 text-purple-400 rounded-lg border border-purple-500/20 hover:bg-purple-600/30 hover:text-white transition-all cursor-pointer"
                   >
                     Gerar Ofício
                   </button>
                </div>
             </div>

             {/* Expanded AI Summary View */}
             {aiSummaries[item.id] && expandedSummaries[item.id] && (
               <motion.div
                 initial={{ opacity: 0, height: 0 }}
                 animate={{ opacity: 1, height: 'auto' }}
                 exit={{ opacity: 0, height: 0 }}
                 className="overflow-hidden border-t border-slate-800/85 pt-5 mt-1 space-y-3"
               >
                 <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <Sparkles className="text-purple-400 scale-90" size={16} />
                       <h4 className="text-xs font-black uppercase tracking-widest text-purple-400">
                          Resumo Executivo da Demanda (Gemini AI)
                       </h4>
                    </div>
                    <span className="text-[9px] bg-purple-500/15 border border-purple-500/30 text-purple-300 font-mono font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">
                       Inteligência Ativa
                    </span>
                 </div>
                 
                 <div className="bg-slate-950 p-5 rounded-2xl border border-slate-850/80 max-h-96 overflow-y-auto leading-relaxed select-text" id={`ai-summary-${item.id}`}>
                    <div className="markdown-body text-xs text-slate-300 space-y-3">
                       <ReactMarkdown>{aiSummaries[item.id]}</ReactMarkdown>
                    </div>
                 </div>
               </motion.div>
             )}
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
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Nº Protocolo</label>
                        <input value={formData.protocolo} onChange={e => setFormData({...formData, protocolo: e.target.value.toUpperCase()})} className="w-full bg-slate-800 rounded-xl p-3 border-none font-mono text-sm" placeholder="2024/001" />
                     </div>
                     <div className="space-y-1 md:col-span-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Assunto / Título</label>
                        <input required value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" />
                     </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Solicitante (Nome)</label>
                        <input value={formData.solicitante_nome} onChange={e => setFormData({...formData, solicitante_nome: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" placeholder="Nome do Cidadão" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Solicitante (WhatsApp)</label>
                        <input value={formData.solicitante_telefone} onChange={e => setFormData({...formData, solicitante_telefone: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" placeholder="(00) 00000-0000" />
                      </div>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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

                  {(profile?.role === 'admin' || profile?.role === 'secretaria_parlamentar') && (
                    <div className="space-y-1">
                       <label className="text-[10px] font-bold text-slate-500 uppercase">Atribuir Assessor</label>
                       <select 
                         value={formData.assessor_id} 
                         onChange={e => {
                           const selected = assessors.find(a => a.id === e.target.value);
                           setFormData({
                             ...formData, 
                             assessor_id: e.target.value,
                             assessor_nome: selected ? selected.nome : ''
                           });
                         }} 
                         className="w-full bg-slate-800 rounded-xl p-3 border-none"
                       >
                          <option value="">Não atribuído</option>
                          {assessors.map(assessor => (
                            <option key={assessor.id} value={assessor.id}>{assessor.nome} ({assessor.role})</option>
                          ))}
                       </select>
                    </div>
                  )}
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

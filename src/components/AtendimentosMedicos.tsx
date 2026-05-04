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
  deleteDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Search, 
  Stethoscope,
  X,
  ClipboardList,
  Edit2,
  Trash2,
  Clock,
  MessageCircle,
  History,
  User,
  ExternalLink
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

export default function AtendimentosMedicos() {
  const { profile, user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isMobile, setIsMobile] = useState(false);

  // States for cross-data
  const [citizenHistory, setCitizenHistory] = useState<any[]>([]);
  const [searchingCitizen, setSearchingCitizen] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const initialForm = {
    nome_completo: '',
    cpf: '',
    telefone: '',
    endereco: '',
    bairro: '',
    zona_rural: false,
    unidade_saude: '',
    especialidade: '',
    cartao_sus: '',
    descricao_problema: '',
    necessita_exame: false,
    lembrete_exame: '',
    status: 'Novo',
    prioridade: 'Média'
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

  const [formData, setFormData] = useState(initialForm);

  // Function to search general assistance data by CPF
  const searchCitizenData = async (cpf: string) => {
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length < 11) return;
    
    setSearchingCitizen(true);
    try {
      // Find in general assistances
      const q = query(
        collection(db, 'atendimentos'), 
        where('cpf', '==', cleanCPF), 
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      
      if (!querySnapshot.empty) {
        const latestInfo = querySnapshot.docs[0].data();
        const history = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        setCitizenHistory(history);
        
        // Auto-fill if it's a new entry and name is empty
        if (!editingId && !formData.nome_completo) {
          setFormData(prev => ({
            ...prev,
            nome_completo: latestInfo.nome_completo || '',
            telefone: latestInfo.telefone || '',
            endereco: latestInfo.endereco || '',
            bairro: latestInfo.bairro || '',
            zona_rural: latestInfo.zona_rural !== undefined ? latestInfo.zona_rural : prev.zona_rural
          }));
        }
      } else {
        setCitizenHistory([]);
      }
    } catch (error) {
      console.error("Error searching citizen data:", error);
    } finally {
      setSearchingCitizen(false);
    }
  };

  useEffect(() => {
    const q = query(collection(db, 'atendimentos_medicos'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'atendimentos_medicos');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'atendimentos_medicos', editingId), {
          ...formData,
          updated_at: serverTimestamp()
        });
        await logAction('Atualizar', 'atendimentos_medicos', editingId, { previous: existing, next: formData });
      } else {
        const docRef = await addDoc(collection(db, 'atendimentos_medicos'), {
          ...formData,
          tipo_atendimento: 'Médico',
          created_at: serverTimestamp(),
        });
        await logAction('Criar', 'atendimentos_medicos', docRef.id, { next: formData });
      }
      closeModal();
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'atendimentos_medicos');
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(initialForm);
    setCitizenHistory([]);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nome_completo: item.nome_completo || '',
      cpf: item.cpf || '',
      telefone: item.telefone || '',
      endereco: item.endereco || '',
      bairro: item.bairro || '',
      zona_rural: !!item.zona_rural,
      unidade_saude: item.unidade_saude || '',
      especialidade: item.especialidade || '',
      cartao_sus: item.cartao_sus || '',
      descricao_problema: item.descricao_problema || '',
      necessita_exame: !!item.necessita_exame,
      lembrete_exame: item.lembrete_exame || '',
      status: item.status || 'Novo',
      prioridade: item.prioridade || 'Média'
    });
    if (item.cpf) searchCitizenData(item.cpf);
    setShowModal(true);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm('Excluir este registro médico?')) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'atendimentos_medicos', id));
      await logAction('Excluir', 'atendimentos_medicos', id, { previous: existing });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `atendimentos_medicos/${id}`);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
             <Stethoscope className="text-emerald-500 shrink-0" size={isMobile ? 24 : 32} />
             Atendimentos Médicos
          </h1>
          <p className="text-slate-400 text-sm">Controle de encaminhamentos e saúde.</p>
        </div>
        {profile?.role !== 'consulta' && (
          <button 
            onClick={() => setShowModal(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20 w-full sm:w-auto"
          >
            <Plus size={20} />
            <span className="font-semibold text-sm">Novo Registro</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {loading ? (
          <div className="col-span-full py-20 text-center text-slate-500">Buscando registros...</div>
        ) : data.length === 0 ? (
          <div className="col-span-full py-20 text-center flex flex-col items-center gap-4 text-slate-500">
            <ClipboardList size={40} className="text-slate-800" />
            <p>Nenhum atendimento médico registrado.</p>
          </div>
        ) : data.map((item) => (
          <motion.div 
            key={item.id}
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={() => profile?.role !== 'consulta' && handleEdit(item)}
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-emerald-500" size={20} />
              </div>
              <div className="flex items-center gap-2">
                 {profile?.role === 'admin' && (
                   <button 
                     onClick={(e) => handleDelete(e, item.id)}
                     className="p-1.5 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                   >
                     <Trash2 size={14} />
                   </button>
                 )}
                 <span className={cn(
                  "text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border",
                  item.prioridade === 'Alta' ? "border-red-500/50 text-red-400" : "border-slate-700 text-slate-500"
                )}>
                  {item.prioridade}
                </span>
              </div>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-1">{item.nome_completo}</h3>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 mb-2">
              <p className="text-xs text-blue-400 font-medium uppercase tracking-tighter">{item.especialidade} • {item.unidade_saude}</p>
              {item.telefone && (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-slate-500">{item.telefone}</span>
                  <a 
                    href={`https://wa.me/55${item.telefone.replace(/\D/g, '')}`} 
                    target="_blank" 
                    rel="noreferrer"
                    className="text-emerald-500 hover:text-emerald-400 transition-colors"
                  >
                    <MessageCircle size={12} />
                  </a>
                </div>
              )}
              {item.cartao_sus && (
                <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">SUS: {item.cartao_sus}</span>
              )}
            </div>
            
            <div className="space-y-3 mb-6">
               <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                 {item.descricao_problema}
               </p>
               {item.lembrete_exame && (
                  <div className="flex items-center gap-2 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-lg border border-emerald-500/20 w-fit">
                    <Clock size={10} />
                    <span>Lembrete: Exame em {format(new Date(item.lembrete_exame + 'T12:00:00'), 'dd/MM/yyyy')}</span>
                  </div>
               )}
            </div>

            <div className="flex items-center justify-between pt-4 border-t border-slate-800">
              <span className="text-[10px] text-slate-500 font-mono">
                {item.created_at?.toDate ? format(item.created_at.toDate(), 'dd MMM, HH:mm', { locale: ptBR }) : '...'}
              </span>
              <span className="text-xs font-semibold text-emerald-400 group-hover:underline">Ver detalhes</span>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60]" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="fixed inset-x-2 top-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[900px] md:h-auto md:max-h-[95vh] bg-slate-900 border border-slate-800 rounded-[2rem] z-[70] flex flex-col shadow-2xl overflow-hidden"
            >
               <div className="flex flex-col md:flex-row h-full overflow-hidden">
                 {/* Left: Form */}
                 <div className="flex-1 overflow-y-auto p-6 md:p-8 border-r border-slate-800">
                    <div className="flex items-center justify-between mb-8">
                       <h2 className="text-xl font-bold">{editingId ? 'Editar Registro Médico' : 'Novo Registro de Saúde'}</h2>
                       <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg md:hidden"><X size={20} /></button>
                    </div>
                    
                    <form onSubmit={handleSubmit} className="space-y-6">
                       <div className="space-y-4">
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Nome do Paciente</label>
                             <input required value={formData.nome_completo} onChange={e => setFormData({...formData, nome_completo: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" />
                          </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">CPF (Busca Automática)</label>
                           <div className="relative">
                             <input 
                               value={formData.cpf} 
                               onChange={e => {
                                 const val = maskCPF(e.target.value);
                                 setFormData({...formData, cpf: val});
                                 if (val.replace(/\D/g, '').length === 11) searchCitizenData(val);
                               }} 
                               className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50 pr-10" 
                               placeholder="000.000.000-00" 
                             />
                             {searchingCitizen && (
                               <div className="absolute right-3 top-1/2 -track-y-1/2 mt-0.5">
                                 <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                               </div>
                             )}
                           </div>
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Telefone</label>
                           <input value={formData.telefone} onChange={e => setFormData({...formData, telefone: maskPhone(e.target.value)})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" placeholder="(00) 00000-0000" />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Endereço</label>
                        <input value={formData.endereco} onChange={e => setFormData({...formData, endereco: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" placeholder="Rua, Número, etc." />
                     </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Bairro</label>
                           <input value={formData.bairro} onChange={e => setFormData({...formData, bairro: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" placeholder="Nome do bairro" />
                        </div>
                        <div className="space-y-1 flex items-center gap-3 pt-4">
                           <input type="checkbox" id="zona_rural_med" checked={formData.zona_rural} onChange={e => setFormData({...formData, zona_rural: e.target.checked})} className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500" />
                           <label htmlFor="zona_rural_med" className="text-xs font-bold uppercase text-slate-500 tracking-wider cursor-pointer">Zona Rural</label>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Unidade de Saúde</label>
                           <input value={formData.unidade_saude} onChange={e => setFormData({...formData, unidade_saude: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Cartão SUS</label>
                           <input value={formData.cartao_sus} onChange={e => setFormData({...formData, cartao_sus: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" placeholder="000 0000 0000 0000" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Especialidade</label>
                           <input value={formData.especialidade} onChange={e => setFormData({...formData, especialidade: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Prioridade</label>
                            <select value={formData.prioridade} onChange={e => setFormData({...formData, prioridade: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50 appearance-none">
                                <option>Baixa</option>
                                <option>Média</option>
                                <option>Alta</option>
                            </select>
                        </div>
                        <div className="space-y-1 col-span-2">
                            <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Status</label>
                            <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50 appearance-none">
                                <option>Novo</option>
                                <option>Em andamento</option>
                                <option>Concluído</option>
                            </select>
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Relato do Problema</label>
                        <textarea rows={4} value={formData.descricao_problema} onChange={e => setFormData({...formData, descricao_problema: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50 resize-none" />
                     </div>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                           <input type="checkbox" id="necessita_exame" checked={formData.necessita_exame} onChange={e => setFormData({...formData, necessita_exame: e.target.checked})} className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500" />
                           <label htmlFor="necessita_exame" className="text-sm font-medium text-slate-300">Necessita de Exames?</label>
                        </div>
                        {formData.necessita_exame && (
                          <div className="space-y-1">
                             <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Data do Lembrete (Exame)</label>
                             <input type="date" value={formData.lembrete_exame} onChange={e => setFormData({...formData, lembrete_exame: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50 [color-scheme:dark]" />
                          </div>
                        )}
                     </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">
                      {editingId ? 'Salvar Alterações' : 'Registrar Atendimento Médico'}
                  </button>
               </form>
            </div>

            {/* Right: History Sidebar */}
            <div className="hidden md:flex w-80 bg-slate-950/50 flex-col overflow-hidden">
               <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                     <History size={14} className="text-blue-500" />
                     Histórico Geral
                  </h3>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg hidden md:block"><X size={20} /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-4 shadow-inner">
                 {citizenHistory.length > 0 ? (
                   citizenHistory.map((h) => (
                     <div key={h.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl group hover:border-blue-500/30 transition-all">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[9px] font-bold text-slate-500 uppercase">
                           {h.created_at?.toDate ? format(h.created_at.toDate(), 'dd/MM/yyyy') : '...'}
                         </span>
                         <span className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 text-[8px] font-black uppercase tracking-tighter">
                           {h.tipo_atendimento}
                         </span>
                       </div>
                       <p className="text-xs text-slate-300 font-medium line-clamp-3 leading-relaxed mb-2 italic">"{h.descricao}"</p>
                       <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/50">
                          <div className="flex items-center gap-1">
                             <User size={10} className="text-slate-600" />
                             <span className="text-[9px] text-slate-600 font-bold">{h.usuario_nome?.split(' ')[0]}</span>
                          </div>
                          <span className={cn(
                            "px-1.5 py-0.5 rounded text-[8px] font-bold uppercase",
                            h.status === 'Concluído' ? "bg-emerald-500/10 text-emerald-400" : "bg-amber-500/10 text-amber-400"
                          )}>
                            {h.status}
                          </span>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-4">
                      <ClipboardList size={32} className="text-slate-700 mb-4" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed">
                        Insira o CPF para consultar o histórico geral deste cidadão
                      </p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </motion.div>
      </>
        )}
      </AnimatePresence>
    </div>
  );
}

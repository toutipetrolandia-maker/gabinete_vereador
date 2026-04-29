import { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Search, 
  Stethoscope,
  X,
  ClipboardList
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';

export default function AtendimentosMedicos() {
  const { user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    nome_completo: '',
    unidade_saude: '',
    especialidade: '',
    descricao_problema: '',
    necessita_exame: false,
    status: 'Novo',
    prioridade: 'Média'
  });

  useEffect(() => {
    const q = query(collection(db, 'atendimentos_medicos'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'atendimentos_medicos'), {
        ...formData,
        tipo_atendimento: 'Médico',
        created_at: serverTimestamp(),
      });
      
      await logAction('Criar', 'atendimentos_medicos', docRef.id, { next: formData });
      
      setShowModal(false);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
             <Stethoscope className="text-emerald-500" />
             Atendimentos Médicos
          </h1>
          <p className="text-slate-400 text-sm">Controle de encaminhamentos e saúde.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-900/20"
        >
          <Plus size={20} />
          Nova Demanda de Saúde
        </button>
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
            className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-emerald-500/50 transition-all cursor-pointer group"
          >
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-lg flex items-center justify-center">
                <Stethoscope className="text-emerald-500" size={20} />
              </div>
              <span className={cn(
                "text-[10px] uppercase font-bold tracking-widest px-2 py-0.5 rounded border",
                item.prioridade === 'Alta' ? "border-red-500/50 text-red-400" : "border-slate-700 text-slate-500"
              )}>
                {item.prioridade}
              </span>
            </div>
            <h3 className="text-lg font-bold text-slate-100 mb-1">{item.nome_completo}</h3>
            <p className="text-xs text-blue-400 font-medium mb-4 uppercase tracking-tighter">{item.especialidade} • {item.unidade_saude}</p>
            
            <div className="space-y-3 mb-6">
               <p className="text-sm text-slate-400 line-clamp-2 leading-relaxed">
                 {item.descricao_problema}
               </p>
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
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-x-4 top-10 bottom-10 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[600px] bg-slate-900 border border-slate-800 rounded-3xl z-[70] flex flex-col shadow-2xl overflow-hidden">
               <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between bg-slate-900">
                  <h2 className="text-xl font-bold">Registro de Saúde</h2>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-800 rounded-lg"><X size={20} /></button>
               </div>
               <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-8 space-y-6">
                  <div className="space-y-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Nome do Paciente</label>
                        <input required value={formData.nome_completo} onChange={e => setFormData({...formData, nome_completo: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" />
                     </div>
                     <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Unidade de Saúde</label>
                           <input value={formData.unidade_saude} onChange={e => setFormData({...formData, unidade_saude: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" />
                        </div>
                        <div className="space-y-1">
                           <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Especialidade</label>
                           <input value={formData.especialidade} onChange={e => setFormData({...formData, especialidade: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50" />
                        </div>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500 tracking-wider">Relato do Problema</label>
                        <textarea rows={4} value={formData.descricao_problema} onChange={e => setFormData({...formData, descricao_problema: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-emerald-500/50 resize-none" />
                     </div>
                     <div className="flex items-center gap-3 bg-slate-800/50 p-4 rounded-xl border border-slate-800">
                        <input type="checkbox" checked={formData.necessita_exame} onChange={e => setFormData({...formData, necessita_exame: e.target.checked})} className="w-5 h-5 rounded border-slate-700 bg-slate-900 text-emerald-600 focus:ring-emerald-500" />
                        <label className="text-sm font-medium text-slate-300">Necessita de Exames Complementares?</label>
                     </div>
                  </div>
                  <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-700 py-4 rounded-xl font-bold transition-all shadow-lg shadow-emerald-900/20">Registrar Atendimento Médico</button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

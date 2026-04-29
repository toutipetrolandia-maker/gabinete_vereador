import { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Search, 
  Package,
  X,
  Truck,
  ArrowRight
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';

export default function Malotes() {
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    protocolo: '',
    destinatario: '',
    secretaria: 'Saúde',
    tipo_documento: 'Ofício',
    assunto: '',
    status: 'Enviado'
  });

  useEffect(() => {
    const q = query(collection(db, 'malotes'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const docRef = await addDoc(collection(db, 'malotes'), {
        ...formData,
        created_at: serverTimestamp(),
      });
      
      await logAction('Criar', 'malotes', docRef.id, { next: formData });
      
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
             <Package className="text-amber-500" />
             Controle de Malotes
          </h1>
          <p className="text-slate-400 text-sm">Protocolos de envio para secretarias.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/20"
        >
          <Plus size={20} />
          Gerar Novo Protocolo
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Truck className="text-slate-500" size={20} />
              <h2 className="font-semibold text-slate-200">Rastreamento de Documentos</h2>
           </div>
        </div>
        <div className="space-y-1 p-2">
           {loading ? (
             <div className="py-10 text-center text-slate-500">Buscando dados...</div>
           ) : data.length === 0 ? (
             <div className="py-10 text-center text-slate-600">Nenhum malote registrado.</div>
           ) : data.map((item) => (
             <motion.div 
               key={item.id}
               className="p-4 rounded-xl hover:bg-slate-800/50 transition-all group border border-transparent hover:border-slate-700 flex flex-col md:flex-row md:items-center gap-4"
             >
                <div className="w-12 h-12 bg-slate-800 rounded-xl flex items-center justify-center font-mono text-xs text-amber-500">
                  {item.protocolo || '#000'}
                </div>
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-100">{item.assunto}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 font-bold uppercase">{item.tipo_documento}</span>
                   </div>
                   <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Origem: Gabinete</span>
                      <ArrowRight size={10} />
                      <span className="text-slate-300">{item.destinatario} - {item.secretaria}</span>
                   </div>
                </div>
                <div className="flex items-center gap-4">
                   <div className="text-right flex flex-col">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{item.status}</span>
                      <span className="text-[10px] text-slate-500">
                        {item.created_at?.toDate ? format(item.created_at.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '...'}
                      </span>
                   </div>
                   <button className="p-2 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white transition-all">
                      <FileText size={18} />
                   </button>
                </div>
             </motion.div>
           ))}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60]" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-x-4 top-10 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] bg-slate-900 border border-slate-800 rounded-3xl z-[70] flex flex-col shadow-2xl overflow-hidden">
               <div className="px-8 py-6 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-xl font-bold">Novo Protocolo de Envio</h2>
                  <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-800 rounded-lg"><X size={20} /></button>
               </div>
               <form onSubmit={handleSubmit} className="p-8 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Nº Protocolo</label>
                        <input value={formData.protocolo} onChange={e => setFormData({...formData, protocolo: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" placeholder="Ex: 2024/001" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Tipo Documento</label>
                        <select value={formData.tipo_documento} onChange={e => setFormData({...formData, tipo_documento: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none appearance-none">
                           <option>Ofício</option>
                           <option>Memorando</option>
                           <option>Requerimento</option>
                        </select>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500">Destinatário (Órgão / Pessoa)</label>
                     <input value={formData.destinatario} onChange={e => setFormData({...formData, destinatario: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500">Assunto</label>
                     <input value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" />
                  </div>
                  <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 py-3 mt-4 rounded-xl font-bold text-white shadow-lg shadow-amber-900/20 transition-all">Emitir Protocolo</button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

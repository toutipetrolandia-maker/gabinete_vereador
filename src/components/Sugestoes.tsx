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
import { 
  MessageSquare, 
  Plus, 
  X,
  MessageCircle,
  Clock,
  User
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Sugestoes() {
  const [data, setData] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);

  const [formData, setFormData] = useState({
    nome_completo: '',
    telefone: '',
    email: '',
    sugestao: '',
    status: 'Nova'
  });

  useEffect(() => {
    const q = query(collection(db, 'sugestoes'), orderBy('created_at', 'desc'));
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await addDoc(collection(db, 'sugestoes'), {
        ...formData,
        created_at: serverTimestamp(),
      });
      setShowModal(false);
      setFormData({ nome_completo: '', telefone: '', email: '', sugestao: '', status: 'Nova' });
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
             <MessageSquare className="text-blue-500" />
             Sugestões da População
          </h1>
          <p className="text-slate-400 text-sm">Ouvidoria e feedback dos cidadãos.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20"
        >
          <Plus size={20} />
          Registrar Sugestão
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
            className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl relative overflow-hidden"
          >
             <div className="absolute top-0 right-0 p-4">
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
                <button className="text-blue-400 font-bold hover:underline">Marcar como Analisada</button>
             </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="fixed inset-0 bg-slate-950/95 z-[60] backdrop-blur-md" />
            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="fixed inset-x-4 top-[15%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] bg-slate-900 border border-slate-800 rounded-3xl z-[70] p-8 shadow-2xl">
               <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-display font-bold">Ouvidoria Pública</h2>
                  <button onClick={() => setShowModal(false)} className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 transition-colors"><X size={18} /></button>
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
                     <textarea required rows={4} value={formData.sugestao} onChange={e => setFormData({...formData, sugestao: e.target.value})} className="w-full bg-slate-800 border-none rounded-xl p-4 focus:ring-2 focus:ring-blue-500/30 resize-none" placeholder="Qual a sugestão ou reclamação?" />
                  </div>
                  <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 py-4 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-blue-900/20">
                     <MessageCircle size={18} />
                     Registrar Mensagem
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

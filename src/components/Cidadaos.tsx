import React, { useEffect, useState } from 'react';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  orderBy,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Users, 
  Search, 
  Filter, 
  User, 
  Phone, 
  MapPin, 
  Calendar, 
  History, 
  ExternalLink,
  ChevronRight,
  TrendingUp,
  Activity,
  Heart,
  Package,
  FileText
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface CitizenRecord {
  id: string;
  nome_completo: string;
  cpf: string;
  telefone?: string;
  bairro?: string;
  endereco?: string;
  created_at: any;
  type: 'Geral' | 'Médico' | 'Auxílio' | 'Demanda';
  data: any;
}

export default function Cidadaos() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [citizens, setCitizens] = useState<Record<string, CitizenRecord[]>>({});
  const [search, setSearch] = useState('');
  const [selectedCPF, setSelectedCPF] = useState<string | null>(null);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    setLoading(true);

    const collections = [
      { name: 'atendimentos', type: 'Geral' as const },
      { name: 'atendimentos_medicos', type: 'Médico' as const },
      { name: 'auxilio_social', type: 'Auxílio' as const },
      { name: 'demandas_parlamentares', type: 'Demanda' as const }
    ];

    const unsubscribes = collections.map(coll => {
      const q = query(
        collection(db, coll.name),
        where('cabinetId', '==', profile.cabinetId)
      );

      return onSnapshot(q, (snap) => {
        const docs = snap.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
          type: coll.type,
          data: doc.data()
        })) as any[];

        setCitizens(prev => {
          const fresh = { ...prev };
          
          // Clear current collection entries from state to avoid duplicates during updates
          Object.keys(fresh).forEach(cpf => {
            fresh[cpf] = fresh[cpf].filter(rec => rec.type !== coll.type);
          });

          docs.forEach(doc => {
            const cpf = doc.cpf || doc.indicado_cpf || doc.beneficiado_cpf || 'SEM-CPF';
            if (!fresh[cpf]) fresh[cpf] = [];
            fresh[cpf].push(doc);
          });

          // Cleanup empty CPFs
          Object.keys(fresh).forEach(cpf => {
            if (fresh[cpf].length === 0) delete fresh[cpf];
          });

          return fresh;
        });
        setLoading(false);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [profile?.cabinetId]);

  const uniqueCitizens = Object.entries(citizens)
    .map(([cpf, records]) => {
      // Get the latest record for primary info
      const latest = [...records].sort((a, b) => {
        const dateA = a.created_at?.toDate?.() || new Date(0);
        const dateB = b.created_at?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      })[0];

      return {
        cpf,
        nome: latest.nome_completo || (latest as any).beneficiado_nome || (latest as any).solicitante_nome || 'Nome não identificado',
        telefone: latest.telefone || (latest as any).whatsapp || (latest as any).beneficiado_telefone || '-',
        bairro: latest.bairro || '-',
        count: records.length,
        types: Array.from(new Set(records.map(r => r.type))),
        records: records.sort((a, b) => {
          const dateA = a.created_at?.toDate?.() || new Date(0);
          const dateB = b.created_at?.toDate?.() || new Date(0);
          return dateB.getTime() - dateA.getTime();
        })
      };
    })
    .filter(c => 
      c.nome.toLowerCase().includes(search.toLowerCase()) || 
      c.cpf.includes(search)
    )
    .sort((a, b) => b.count - a.count);

  const selectedCitizen = selectedCPF ? uniqueCitizens.find(c => c.cpf === selectedCPF) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Users className="text-blue-500" />
            CRM de Cidadãos
          </h1>
          <p className="text-slate-400 text-sm">Dados unificados e histórico completo por CPF.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* List View */}
        <div className={cn(
          "lg:col-span-4 space-y-4",
          selectedCPF ? "hidden lg:block" : "block"
        )}>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou CPF..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all shadow-xl"
            />
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl max-h-[70vh] overflow-y-auto scrollbar-thin scrollbar-thumb-slate-800">
            {loading ? (
              <div className="p-10 text-center text-slate-500">Carregando base unificada...</div>
            ) : uniqueCitizens.length === 0 ? (
              <div className="p-10 text-center text-slate-500">Nenhum cidadão encontrado.</div>
            ) : (
              <div className="divide-y divide-slate-800">
                {uniqueCitizens.map((citizen) => (
                  <button
                    key={citizen.cpf}
                    onClick={() => setSelectedCPF(citizen.cpf)}
                    className={cn(
                      "w-full p-4 flex items-center justify-between hover:bg-slate-800/50 transition-all text-left group",
                      selectedCPF === citizen.cpf ? "bg-blue-600/10 border-l-4 border-l-blue-500" : "border-l-4 border-l-transparent"
                    )}
                  >
                    <div className="flex flex-col gap-1 min-w-0">
                      <span className="text-sm font-bold text-slate-200 truncate">{citizen.nome}</span>
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] text-slate-500 font-mono tracking-tighter">{citizen.cpf}</span>
                        <span className="text-[10px] text-slate-700">•</span>
                        <span className={cn(
                          "text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase",
                          citizen.count > 2 ? "bg-amber-500/10 text-amber-500" : "bg-slate-800 text-slate-500"
                        )}>
                          {citizen.count} {citizen.count === 1 ? 'Interação' : 'Interações'}
                        </span>
                      </div>
                      <div className="flex gap-1 mt-1">
                        {citizen.types.map(t => (
                          <div key={t} className="p-1 rounded bg-slate-800 text-slate-400" title={t}>
                            {t === 'Geral' && <Activity size={10} />}
                            {t === 'Médico' && <Heart size={10} />}
                            {t === 'Auxílio' && <Package size={10} />}
                            {t === 'Demanda' && <FileText size={10} />}
                          </div>
                        ))}
                      </div>
                    </div>
                    <ChevronRight size={16} className={cn(
                      "transition-all",
                      selectedCPF === citizen.cpf ? "text-blue-500 translate-x-1" : "text-slate-700 group-hover:text-slate-400"
                    )} />
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Detail View */}
        <div className="lg:col-span-8">
          <AnimatePresence mode="wait">
            {!selectedCitizen ? (
              <motion.div 
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="h-[60vh] flex flex-col items-center justify-center bg-slate-900/50 border border-dashed border-slate-800 rounded-3xl p-12 text-center"
              >
                <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center text-slate-600 mb-4 shadow-inner">
                  <User size={32} />
                </div>
                <h3 className="text-xl font-bold text-slate-200">Selecione um Cidadão</h3>
                <p className="text-slate-500 max-w-xs mt-2">Clique em um nome na lista ao lado para ver o histórico cruzado e o perfil completo.</p>
              </motion.div>
            ) : (
              <motion.div 
                key={selectedCitizen.cpf}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="space-y-6"
              >
                {/* Header Card */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-blue-600/5 rounded-full -mr-16 -mt-16 blur-2xl" />
                   <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
                      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl font-bold shadow-xl shadow-blue-900/20 shrink-0">
                         {selectedCitizen.nome[0]}
                      </div>
                      <div className="flex-1 space-y-1">
                         <div className="flex flex-col md:flex-row md:items-center gap-2">
                           <h2 className="text-2xl font-bold text-white tracking-tight">{selectedCitizen.nome}</h2>
                           <span className="px-3 py-1 bg-slate-800 border border-slate-700 rounded-full text-[10px] font-mono text-slate-400 font-bold">
                             {selectedCitizen.cpf}
                           </span>
                         </div>
                         <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div className="flex items-center gap-3 text-slate-400">
                               <Phone size={16} className="text-blue-500" />
                               <span className="text-sm font-medium">{selectedCitizen.telefone}</span>
                            </div>
                            <div className="flex items-center gap-3 text-slate-400">
                               <MapPin size={16} className="text-blue-500" />
                               <span className="text-sm font-medium">{selectedCitizen.bairro}</span>
                            </div>
                         </div>
                      </div>
                      <button 
                        onClick={() => setSelectedCPF(null)}
                        className="lg:hidden p-2 bg-slate-800 rounded-xl"
                      >
                         Voltar
                      </button>
                   </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center">
                    <TrendingUp size={20} className="text-emerald-500 mx-auto mb-2" />
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Total</span>
                    <span className="text-xl font-bold text-white">{selectedCitizen.count}</span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center">
                    <History size={20} className="text-blue-500 mx-auto mb-2" />
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Primeiro</span>
                    <span className="text-xs font-bold text-white">
                      {format(selectedCitizen.records[selectedCitizen.records.length - 1].created_at?.toDate(), "MM/yyyy")}
                    </span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center">
                    <Activity size={20} className="text-purple-500 mx-auto mb-2" />
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Frequência</span>
                    <span className="text-xs font-bold text-white">
                      {selectedCitizen.count > 3 ? 'Alta' : 'Normal'}
                    </span>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-4 rounded-2xl text-center">
                    <Calendar size={20} className="text-amber-500 mx-auto mb-2" />
                    <span className="text-[10px] uppercase font-bold text-slate-500 block">Último</span>
                    <span className="text-xs font-bold text-white">
                      {format(selectedCitizen.records[0].created_at?.toDate(), "dd/MM/yy")}
                    </span>
                  </div>
                </div>

                {/* Timeline */}
                <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 md:p-8 shadow-xl">
                  <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-8 flex items-center gap-2">
                    <History size={16} /> Jornada do Cidadão (Timeline)
                  </h3>

                  <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gradient-to-b before:from-blue-600/50 before:via-slate-800 before:to-transparent">
                    {selectedCitizen.records.map((record, idx) => (
                      <div key={record.id} className="relative flex items-start gap-8 group">
                         <div className={cn(
                           "mt-1.5 w-10 h-10 rounded-full flex items-center justify-center shrink-0 z-10 transition-transform group-hover:scale-110",
                           record.type === 'Geral' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" :
                           record.type === 'Médico' ? "bg-emerald-600 text-white shadow-lg shadow-emerald-900/40" :
                           record.type === 'Auxílio' ? "bg-amber-600 text-white shadow-lg shadow-amber-900/40" :
                           "bg-indigo-600 text-white shadow-lg shadow-indigo-900/40"
                         )}>
                            {record.type === 'Geral' && <Activity size={18} />}
                            {record.type === 'Médico' && <Heart size={18} />}
                            {record.type === 'Auxílio' && <Package size={18} />}
                            {record.type === 'Demanda' && <FileText size={18} />}
                         </div>
                         <div className="flex-1 bg-slate-950/50 border border-slate-800/50 rounded-2xl p-5 hover:bg-slate-800/20 transition-all">
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-3">
                               <div className="flex items-center gap-2">
                                  <span className="text-xs font-black uppercase tracking-wider text-slate-500">{record.type}</span>
                                  <span className="text-slate-700">•</span>
                                  <span className="text-slate-200 font-bold">{record.data.tipo_atendimento || record.data.especialidade || record.data.tipo_beneficio || record.data.assunto}</span>
                               </div>
                               <span className="text-[10px] font-mono text-slate-500 bg-slate-900 px-2 py-1 rounded-lg">
                                  {format(record.created_at?.toDate(), "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                               </span>
                            </div>
                            <p className="text-sm text-slate-400 leading-relaxed italic">
                               "{record.data.descricao || record.data.descricao_problema || record.data.observacoes || 'Sem descrição detalhada.'}"
                            </p>
                            <div className="mt-4 pt-4 border-t border-slate-800/50 flex flex-wrap gap-4 items-center justify-between">
                               <div className="flex gap-2">
                                  <span className={cn(
                                    "text-[10px] px-2 py-0.5 rounded-md font-bold uppercase",
                                    record.data.status === 'Concluído' ? "bg-emerald-500/10 text-emerald-500" : "bg-blue-500/10 text-blue-500"
                                  )}>
                                    {record.data.status}
                                  </span>
                                  <span className="text-[10px] px-2 py-0.5 bg-slate-900 text-slate-500 rounded-md font-bold">
                                    ASSESSOR: {record.data.usuario_nome?.split(' ')[0] || 'Gabinete'}
                                  </span>
                               </div>
                               <button className="text-blue-400 hover:text-blue-300 flex items-center gap-1.5 text-xs font-bold transition-colors">
                                 Ver Detalhes <ExternalLink size={12} />
                               </button>
                            </div>
                         </div>
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

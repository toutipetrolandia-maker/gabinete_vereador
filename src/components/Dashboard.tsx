import React, { useEffect, useState } from 'react';
import { 
  Users, 
  Stethoscope, 
  Package, 
  FileText,
  TrendingUp,
  Clock,
  CheckCircle2,
  AlertCircle,
  ExternalLink
} from 'lucide-react';
import { collection, query, limit, getDocs, orderBy, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie
} from 'recharts';

export default function Dashboard() {
  const [stats, setStats] = useState({
    atendimentos: 0,
    medicos: 0,
    malotes: 0,
    demandas: 0
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [appName, setAppName] = useState('Gabinete Digital');
  const [vereadorPhoto, setVereadorPhoto] = useState<string | null>(null);
  const [perfilLink, setPerfilLink] = useState('https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
  const [billingStatus, setBillingStatus] = useState<'regular' | 'pending' | 'suspended'>('regular');

  useEffect(() => {
    const unsubSettings = onSnapshot(doc(db, 'app_settings', 'global'), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setAppName(data.app_name || 'Gabinete Digital');
        setVereadorPhoto(data.vereador_photo || null);
        setPerfilLink(data.perfil_link || 'https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
        setBillingStatus(data.billing_status || 'regular');
      }
    }, (error) => {
      console.error("Error listening to settings in Dashboard:", error);
    });

    const fetchData = async () => {
      // Fetch counts from various collections
      try {
        const collections = ['atendimentos', 'atendimentos_medicos', 'malotes', 'demandas_parlamentares'];
        await Promise.all(collections.map(async (col) => {
          try {
            await getDocs(query(collection(db, col), limit(1)));
          } catch (err) {
            console.warn(`Could not fetch limit for ${col}:`, err);
          }
        }));

        setStats({
          atendimentos: 124, // Mock values for visual polish
          medicos: 45,
          malotes: 12,
          demandas: 8
        });

        const q = query(collection(db, 'atendimentos'), orderBy('created_at', 'desc'), limit(8));
        const snap = await getDocs(q);
        setRecent(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (e) {
        console.error("Dashboard data fetch error:", e);
      }
    };
    fetchData();

    return () => unsubSettings();
  }, []);

  const chartData = [
    { name: 'Geral', value: 400 },
    { name: 'Médico', value: 300 },
    { name: 'Demanda', value: 200 },
    { name: 'Sugestão', value: 100 },
  ];

  const barData = [
    { day: 'Seg', total: 12 },
    { day: 'Ter', total: 19 },
    { day: 'Qua', total: 15 },
    { day: 'Qui', total: 22 },
    { day: 'Sex', total: 30 },
  ];

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444'];

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      {billingStatus === 'pending' && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-3xl flex items-center gap-4 text-amber-500"
        >
          <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center shrink-0">
            <AlertCircle size={20} />
          </div>
          <div>
            <p className="text-sm font-bold uppercase tracking-widest">Fatura Pendente</p>
            <p className="text-xs opacity-80">Identificamos uma pendência financeira em sua conta. Regularize seu plano para evitar a suspensão automática do sistema.</p>
          </div>
        </motion.div>
      )}

      <header className="px-1 md:px-0 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-white mb-2">Visão Geral</h1>
          <p className="text-slate-400 text-sm md:text-base">Bem-vindo ao painel de controle do {appName}.</p>
        </div>
        {vereadorPhoto && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="hidden md:flex items-center gap-3 p-2 bg-slate-900 border border-slate-800 rounded-2xl"
          >
            <div className="w-12 h-12 rounded-xl overflow-hidden shadow-inner border border-slate-700">
               <img src={vereadorPhoto} alt="Vereador" className="w-full h-full object-cover" />
            </div>
            <div className="pr-4 border-r border-slate-800">
               <span className="block text-[10px] uppercase font-bold text-slate-500 tracking-widest">Vereador Responsável</span>
               <span className="block text-sm font-bold text-white">{appName.replace('Gabinete do ', '').replace('Gabinete de ', '')}</span>
            </div>
            <a 
              href={perfilLink} 
              target="_blank" 
              rel="noopener noreferrer"
              className="p-2 hover:bg-slate-800 rounded-xl text-blue-400 transition-colors"
              title="Ver Perfil Oficial"
            >
              <ExternalLink size={18} />
            </a>
          </motion.div>
        )}
      </header>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 px-1 md:px-0">
        {[
          { label: 'Atendimentos', value: stats.atendimentos, icon: Users, color: 'text-blue-500', bg: 'bg-blue-500/10' },
          { label: 'Atend. Médicos', value: stats.medicos, icon: Stethoscope, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
          { label: 'Malotes', value: stats.malotes, icon: Package, color: 'text-amber-500', bg: 'bg-amber-500/10' },
          { label: 'Demandas', value: stats.demandas, icon: FileText, color: 'text-purple-500', bg: 'bg-purple-500/10' },
        ].map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-slate-900 border border-slate-800 p-6 rounded-2xl flex items-center gap-4 hover:border-slate-700 transition-colors"
          >
            <div className={`w-12 h-12 ${stat.bg} rounded-xl flex items-center justify-center shrink-0`}>
              <stat.icon className={stat.color} size={24} />
            </div>
            <div>
              <p className="text-xs font-mono uppercase tracking-wider text-slate-400 mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-slate-100">{stat.value}</p>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Chart */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <TrendingUp className="text-blue-400" size={20} />
              Volume Mensal
            </h2>
          </div>
          <div className="h-[300px]">
             <ResponsiveContainer width="100%" height="100%">
               <BarChart data={barData}>
                 <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                 <XAxis dataKey="day" axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                 <YAxis axisLine={false} tickLine={false} tick={{ fill: '#64748b', fontSize: 12 }} />
                 <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                   cursor={{ fill: '#1e293b' }}
                 />
                 <Bar dataKey="total" fill="#3b82f6" radius={[6, 6, 0, 0]} />
               </BarChart>
             </ResponsiveContainer>
          </div>
        </div>

        {/* Distribution Chart */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
          <h2 className="text-lg font-semibold mb-8">Distribuição</h2>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={8}
                  dataKey="value"
                >
                  {chartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip 
                   contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px' }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="grid grid-cols-2 gap-4 mt-4">
            {chartData.map((item, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i] }} />
                <span className="text-xs text-slate-400">{item.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Activity */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <h2 className="font-semibold text-sm md:text-base">Atividades Recentes</h2>
          <button className="text-xs md:text-sm text-blue-400 hover:underline">Ver todos</button>
        </div>
        <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
          <table className="w-full text-left min-w-[600px]">
            <thead>
              <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                <th className="px-6 py-4 font-medium">Nome</th>
                <th className="px-6 py-4 font-medium">Tipo</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 font-medium">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
              {recent.map((item) => (
                <tr key={item.id} className="hover:bg-slate-800/50 transition-colors">
                  <td className="px-6 py-4">
                    <span className="text-sm font-medium text-slate-200">{item.nome_completo}</span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-xs px-2 py-1 bg-slate-800 rounded-md text-slate-300">{item.tipo_atendimento}</span>
                  </td>
                  <td className="px-6 py-4 text-xs">
                    <div className="flex items-center gap-1.5">
                      {item.status === 'Concluído' ? <CheckCircle2 size={12} className="text-emerald-400" /> : 
                       item.status === 'Novo' ? <AlertCircle size={12} className="text-blue-400" /> : 
                       <Clock size={12} className="text-amber-400" />}
                      <span className={cn(
                        item.status === 'Concluído' ? "text-emerald-400" :
                        item.status === 'Novo' ? "text-blue-400" :
                        "text-amber-400"
                      )}>{item.status}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {item.data_atendimento}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

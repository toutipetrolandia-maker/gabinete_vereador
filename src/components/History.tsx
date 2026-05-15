import React, { useState, useEffect, useMemo } from 'react';
import { 
  History as HistoryIcon,
  Search,
  Filter,
  Calendar,
  User,
  ArrowRight,
  Database,
  Trash2,
  Edit,
  Plus,
  RefreshCw,
  TrendingUp,
  Award,
  Clock,
  ChevronRight
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  limit,
  onSnapshot,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { format, startOfMonth, endOfMonth, isWithinInterval, subDays, eachDayOfInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  Cell
} from 'recharts';

interface Log {
  id: string;
  usuario_id: string;
  usuario_nome: string;
  acao: string;
  colecao: string;
  documento_id: string;
  dados_anteriores: any;
  dados_novos: any;
  criado_em: any;
}

export default function History() {
  const { profile } = useAuth();
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(true);
  const [userFilter, setUserFilter] = useState('all');
  const [collectionFilter, setCollectionFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [view, setView] = useState<'audit' | 'productivity'>('productivity');

  useEffect(() => {
    if (!profile?.cabinetId) return;
    
    const q = query(
      collection(db, 'logs'),
      where('cabinet_id', '==', profile.cabinetId),
      orderBy('criado_em', 'desc'),
      limit(500)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Log[];
      
      setLogs(logsData);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.cabinetId]);

  const getActionIcon = (action: string) => {
    const a = action.toLowerCase();
    if (a.includes('criar') || a.includes('novo')) return <Plus className="text-emerald-500" size={14} />;
    if (a.includes('atualizar') || a.includes('editar') || a.includes('alterar')) return <Edit className="text-blue-500" size={14} />;
    if (a.includes('excluir') || a.includes('remover')) return <Trash2 className="text-red-500" size={14} />;
    return <RefreshCw className="text-slate-500" size={14} />;
  };

  const filteredLogs = logs.filter(log => {
    const matchesUser = userFilter === 'all' || log.usuario_id === userFilter;
    const matchesCollection = collectionFilter === 'all' || log.colecao === collectionFilter;
    const matchesSearch = log.acao.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         log.usuario_nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         log.colecao.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesUser && matchesCollection && matchesSearch;
  });

  // Unique users and collections
  const uniqueUsers = useMemo(() => {
    const usersMap = new Map();
    logs.forEach(l => {
      if (!usersMap.has(l.usuario_id)) {
        usersMap.set(l.usuario_id, { id: l.usuario_id, nome: l.usuario_nome });
      }
    });
    return Array.from(usersMap.values());
  }, [logs]);

  const uniqueCollections = useMemo(() => Array.from(new Set(logs.map(l => l.colecao))), [logs]);

  // Performance Data
  const stats = useMemo(() => {
    const monthStart = startOfMonth(new Date());
    const monthEnd = endOfMonth(new Date());
    
    // Monthly stats
    const monthlyLogs = logs.filter(l => {
      if (!l.criado_em) return false;
      const date = l.criado_em.toDate();
      return isWithinInterval(date, { start: monthStart, end: monthEnd });
    });

    // Ranking
    const ranking = uniqueUsers.map(u => {
      const allActions = logs.filter(l => l.usuario_id === u.id);
      const monthlyActions = monthlyLogs.filter(l => l.usuario_id === u.id);
      const createCount = monthlyActions.filter(l => l.acao.toLowerCase().includes('criar')).length;
      
      return {
        ...u,
        total: allActions.length,
        monthly: monthlyActions.length,
        creates: createCount
      };
    }).sort((a, b) => b.monthly - a.monthly);

    // Productivity over time (Last 7 days)
    const last7Days = eachDayOfInterval({
      start: subDays(new Date(), 6),
      end: new Date()
    }).map(day => {
      const dayStr = format(day, 'dd/MM');
      const count = logs.filter(l => {
        if (!l.criado_em) return false;
        return format(l.criado_em.toDate(), 'dd/MM') === dayStr;
      }).length;
      return { name: dayStr, total: count };
    });

    return { ranking, last7Days, monthlyTotal: monthlyLogs.length };
  }, [logs, uniqueUsers]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899'];

  return (
    <div className="space-y-6 lg:p-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-white flex items-center gap-3">
            <TrendingUp className="text-blue-500" size={32} />
            Desempenho & Auditoria
          </h2>
          <p className="text-slate-400 mt-1">Análise de produtividade do gabinete e rastreamento de ações.</p>
        </div>
        
        <div className="flex p-1 bg-slate-900 border border-slate-800 rounded-2xl">
          <button
            onClick={() => setView('productivity')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              view === 'productivity' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:text-white"
            )}
          >
            <Award size={18} />
            Produtividade
          </button>
          <button
            onClick={() => setView('audit')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-sm font-bold transition-all flex items-center gap-2",
              view === 'audit' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:text-white"
            )}
          >
            <HistoryIcon size={18} />
            Auditoria
          </button>
        </div>
      </header>

      {view === 'productivity' ? (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          {/* Main Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-6 opacity-10 group-hover:opacity-20 transition-opacity">
                   <TrendingUp size={80} className="text-blue-500" />
                </div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-[0.2em] block mb-2">Produção Mensal</span>
                <div className="flex items-baseline gap-4">
                   <span className="text-5xl font-black text-white">{stats.monthlyTotal}</span>
                   <span className="text-emerald-500 text-xs font-bold flex items-center gap-1">
                      <TrendingUp size={12} />
                      Ações no mês
                   </span>
                </div>
                <div className="mt-6 h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                   <div className="h-full bg-gradient-to-r from-blue-600 to-indigo-600 w-3/4 rounded-full" />
                </div>
             </div>

             <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl md:col-span-2">
                <div className="flex items-center justify-between mb-6">
                   <div>
                      <h3 className="font-bold text-white">Evolução de Atividade</h3>
                      <p className="text-xs text-slate-500">Volume de ações nos últimos 7 dias</p>
                   </div>
                </div>
                <div className="h-40 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={stats.last7Days}>
                        <defs>
                          <linearGradient id="colorTotal" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="name" 
                          stroke="#64748b" 
                          fontSize={10} 
                          tickLine={false} 
                          axisLine={false} 
                        />
                        <Tooltip 
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                          itemStyle={{ color: '#fff' }}
                        />
                        <Area 
                          type="monotone" 
                          dataKey="total" 
                          stroke="#3b82f6" 
                          strokeWidth={3}
                          fillOpacity={1} 
                          fill="url(#colorTotal)" 
                        />
                      </AreaChart>
                   </ResponsiveContainer>
                </div>
             </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
             {/* Ranking Table */}
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                <div className="flex items-center justify-between mb-8">
                   <h3 className="text-xl font-bold text-white flex items-center gap-3">
                      <Award size={24} className="text-amber-500" />
                      Ranking de Produtividade
                   </h3>
                </div>

                <div className="space-y-6">
                   {stats.ranking.map((user, index) => (
                     <div key={user.id} className="flex items-center gap-4 group">
                        <div className={cn(
                          "w-10 h-10 rounded-xl flex items-center justify-center font-black transition-all",
                          index === 0 ? "bg-amber-500 text-slate-950 scale-110 shadow-lg shadow-amber-500/20" : 
                          index === 1 ? "bg-slate-300 text-slate-950 shadow-lg shadow-slate-300/10" :
                          index === 2 ? "bg-amber-800 text-white" : "bg-slate-800 text-slate-500"
                        )}>
                           {index + 1}
                        </div>
                        <div className="flex-1">
                           <div className="flex items-center justify-between mb-1">
                              <span className="font-bold text-white text-sm">{user.nome}</span>
                              <span className="text-xs font-black text-slate-400">{user.monthly} ações</span>
                           </div>
                           <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-blue-500 transition-all duration-1000" 
                                style={{ width: `${(user.monthly / (stats.ranking[0]?.monthly || 1)) * 100}%` }}
                              />
                           </div>
                        </div>
                     </div>
                   ))}
                </div>
                
                {stats.ranking.length > 0 && (
                  <div className="mt-8 p-4 bg-blue-600/5 border border-blue-500/10 rounded-2xl flex items-center gap-4">
                     <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg shadow-blue-900/20">
                        <User size={24} />
                     </div>
                     <div>
                        <p className="text-[10px] uppercase font-black text-blue-500 tracking-wider">Destaque do Mês</p>
                        <p className="font-bold text-white">{stats.ranking[0].nome}</p>
                     </div>
                  </div>
                )}
             </div>

             {/* Distribution Chart */}
             <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8">
                <h3 className="text-xl font-bold text-white mb-8">Participação por Usuário</h3>
                <div className="h-64 w-full">
                   <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={stats.ranking.slice(0, 5)}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                        <XAxis 
                          dataKey="nome" 
                          stroke="#64748b" 
                          fontSize={9} 
                          tickLine={false} 
                          axisLine={false}
                          tickFormatter={(val) => val.split(' ')[0]} 
                        />
                        <YAxis stroke="#64748b" fontSize={10} tickLine={false} axisLine={false} />
                        <Tooltip 
                          cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                          contentStyle={{ backgroundColor: '#0f172a', border: 'none', borderRadius: '12px', fontSize: '10px' }}
                        />
                        <Bar dataKey="monthly" radius={[6, 6, 0, 0]} barSize={24}>
                          {stats.ranking.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                          ))}
                        </Bar>
                      </BarChart>
                   </ResponsiveContainer>
                </div>
                <div className="grid grid-cols-2 gap-4 mt-6">
                   <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">Média Diária</span>
                      <span className="text-xl font-black text-white">{(stats.monthlyTotal / 30).toFixed(1)}</span>
                   </div>
                   <div className="p-4 bg-slate-950 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block mb-1">Cadastros</span>
                      <span className="text-xl font-black text-emerald-500">
                        {stats.ranking.reduce((acc, curr) => acc + curr.creates, 0)}
                      </span>
                   </div>
                </div>
             </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text"
                placeholder="Pesquisar em ações, usuários ou coleções..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
              />
            </div>
            <div className="relative">
              <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <select 
                value={userFilter}
                onChange={(e) => setUserFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
              >
                <option value="all">Todos os Usuários</option>
                {uniqueUsers.map(u => (
                  <option key={u.id} value={u.id}>{u.nome}</option>
                ))}
              </select>
            </div>
            <div className="relative">
              <Database className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <select 
                value={collectionFilter}
                onChange={(e) => setCollectionFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
              >
                <option value="all">Todas as Coleções</option>
                {uniqueCollections.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead>
                  <tr className="bg-slate-950/50 border-b border-slate-800">
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Data / Hora</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Usuário</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Ação</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Módulo</th>
                    <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">Detalhes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800">
                  {loading ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">
                        <div className="flex flex-col items-center gap-3">
                           <RefreshCw className="animate-spin text-blue-500" size={24} />
                           <span>Carregando trilha...</span>
                        </div>
                      </td>
                    </tr>
                  ) : filteredLogs.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Nenhum registro de atividade encontrado.</td>
                    </tr>
                  ) : filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-800/30 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="text-xs font-bold text-slate-300">
                            {log.criado_em?.toDate ? format(log.criado_em.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '---'}
                          </span>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {log.criado_em?.toDate ? format(log.criado_em.toDate(), 'HH:mm:ss', { locale: ptBR }) : '--:--:--'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-blue-600/10 text-blue-500 flex items-center justify-center text-[10px] font-bold border border-blue-500/20">
                            {log.usuario_nome[0]}
                          </div>
                          <span className="text-xs font-medium text-slate-300">{log.usuario_nome}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-slate-800 rounded-lg flex items-center justify-center border border-slate-700">
                            {getActionIcon(log.acao)}
                          </div>
                          <span className="text-xs font-bold text-slate-200">{log.acao}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-[10px] bg-slate-800 text-slate-400 px-2 py-1 rounded font-mono uppercase">
                          {log.colecao}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="max-w-[200px] truncate text-[10px] text-slate-500 italic">
                          ID: {log.documento_id}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

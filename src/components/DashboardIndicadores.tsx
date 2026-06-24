import React, { useEffect, useState } from 'react';
import { 
  BarChart, 
  Bar, 
  LineChart, 
  Line, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  Legend,
  ComposedChart,
  Area
} from 'recharts';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  onSnapshot 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  TrendingUp, 
  Users, 
  FileText, 
  Filter, 
  Calendar, 
  Percent, 
  Activity, 
  ChevronDown,
  RefreshCw,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface MonthlyData {
  sortKey: string; // YYYY-MM
  monthName: string; // MMM/YY
  atendimentosCount: number;
  demandasCount: number;
}

export default function DashboardIndicadores() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [demandas, setDemandas] = useState<any[]>([]);

  // Filters State
  const [selectedTypeFilter, setSelectedTypeFilter] = useState<string>('Todos');
  const [selectedPriorityFilter, setSelectedPriorityFilter] = useState<string>('Todos');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('Todos');
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('Todos');

  // Chart view toggle ('combined', 'split')
  const [chartMode, setChartMode] = useState<'combined' | 'split'>('combined');

  // Fetch data
  useEffect(() => {
    if (!profile?.cabinetId) return;
    setLoading(true);

    // Query both collections
    const qAtendimentos = query(collection(db, 'atendimentos'), where('cabinetId', '==', profile.cabinetId));
    const qAtendimentosMedicos = query(collection(db, 'atendimentos_medicos'), where('cabinetId', '==', profile.cabinetId));
    const qDemandas = query(collection(db, 'demandas_parlamentares'), where('cabinetId', '==', profile.cabinetId));

    const unsubAtendimentos = onSnapshot(qAtendimentos, (snap1) => {
      onSnapshot(qAtendimentosMedicos, (snap2) => {
        const list1 = snap1.docs.map(doc => ({ id: doc.id, ...doc.data(), source: 'geral' }));
        const list2 = snap2.docs.map(doc => ({ id: doc.id, ...doc.data(), tipo_atendimento: 'Médico', source: 'medico' }));
        setAtendimentos([...list1, ...list2]);
      });
    }, (err) => console.error("Error loading atendimentos indicators:", err));

    const unsubDemandas = onSnapshot(qDemandas, (snap) => {
      setDemandas(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error loading demandas indicators:", err);
      setLoading(false);
    });

    return () => {
      unsubAtendimentos();
      unsubDemandas();
    };
  }, [profile?.cabinetId]);

  // Extract unique filters from loaded data
  const uniqueTypes = ['Todos', ...Array.from(new Set(
    atendimentos.map(item => item.tipo_atendimento).filter(Boolean)
  ))];

  const uniquePriorities = ['Todos', 'Baixa', 'Média', 'Alta'];
  const uniqueStatuses = ['Todos', 'Pendente', 'Em andamento', 'Concluído', 'Encaminhado', 'Novo'];

  // Extract unique years from created_at
  const getYears = () => {
    const years = new Set<string>();
    atendimentos.forEach(item => {
      const date = item.created_at?.toDate ? item.created_at.toDate() : null;
      if (date) years.add(date.getFullYear().toString());
    });
    demandas.forEach(item => {
      const date = item.created_at?.toDate ? item.created_at.toDate() : null;
      if (date) years.add(date.getFullYear().toString());
    });
    return ['Todos', ...Array.from(years).sort((a, b) => b.localeCompare(a))];
  };

  const uniqueYears = getYears();

  // Filter Atendimentos and Demandas
  const filteredAtendimentos = atendimentos.filter(item => {
    const date = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!date) return false;

    const matchType = selectedTypeFilter === 'Todos' || item.tipo_atendimento === selectedTypeFilter;
    const matchStatus = selectedStatusFilter === 'Todos' || item.status === selectedStatusFilter;
    const matchYear = selectedYearFilter === 'Todos' || date.getFullYear().toString() === selectedYearFilter;

    return matchType && matchStatus && matchYear;
  });

  const filteredDemandas = demandas.filter(item => {
    const date = item.created_at?.toDate ? item.created_at.toDate() : null;
    if (!date) return false;

    // Demandas don't have tipo_atendimento but we can filter them by priority, status and year
    const matchPriority = selectedPriorityFilter === 'Todos' || item.prioridade === selectedPriorityFilter;
    const matchStatus = selectedStatusFilter === 'Todos' || item.status === selectedStatusFilter;
    const matchYear = selectedYearFilter === 'Todos' || date.getFullYear().toString() === selectedYearFilter;

    // If a type filter is active, since demandas do not have a tipo_atendimento directly, we can check if the type is "Médico"
    // and exclude demands, or keep it inclusive if they select "Todos". Wait, to allow filtering by "tipo de solicitação",
    // let's assume "tipo de solicitação" can refer to `tipo_atendimento` of Atendimentos. We should explain this beautifully in the UI!
    const matchType = selectedTypeFilter === 'Todos';

    return matchPriority && matchStatus && matchYear && matchType;
  });

  // Aggregate monthly volumes
  const getMonthlyChartData = () => {
    const monthlyMap: Record<string, { atendimentos: number, demandas: number }> = {};
    const monthsShort = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];

    // Initialize map with a default set of months if filtering the last 12 months, or build dynamically
    const now = new Date();
    // Build last 12 months
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const sortKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthlyMap[sortKey] = { atendimentos: 0, demandas: 0 };
    }

    // Populate Atendimentos
    filteredAtendimentos.forEach(item => {
      const date = item.created_at?.toDate ? item.created_at.toDate() : null;
      if (date) {
        const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[sortKey]) {
          monthlyMap[sortKey] = { atendimentos: 0, demandas: 0 };
        }
        monthlyMap[sortKey].atendimentos++;
      }
    });

    // Populate Demandas
    filteredDemandas.forEach(item => {
      const date = item.created_at?.toDate ? item.created_at.toDate() : null;
      if (date) {
        const sortKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        if (!monthlyMap[sortKey]) {
          monthlyMap[sortKey] = { atendimentos: 0, demandas: 0 };
        }
        monthlyMap[sortKey].demandas++;
      }
    });

    // Convert map to sorted array
    const chartData = Object.entries(monthlyMap).map(([sortKey, counts]) => {
      const [year, month] = sortKey.split('-');
      const monthIndex = parseInt(month, 10) - 1;
      const monthName = `${monthsShort[monthIndex]}/${year.slice(-2)}`;
      return {
        sortKey,
        monthName,
        Atendimentos: counts.atendimentos,
        Demandas: counts.demandas,
      };
    }).sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    return chartData;
  };

  const chartData = getMonthlyChartData();

  // Metrics
  const totalAtendimentos = filteredAtendimentos.length;
  const totalDemandas = filteredDemandas.length;
  const activeMonthsCount = chartData.filter(d => d.Atendimentos > 0 || d.Demandas > 0).length || 12;

  const avgAtendimentos = (totalAtendimentos / activeMonthsCount).toFixed(1);
  const avgDemandas = (totalDemandas / activeMonthsCount).toFixed(1);

  // Completion rates
  const completedAtendimentos = filteredAtendimentos.filter(i => i.status === 'Concluído').length;
  const completedDemandas = filteredDemandas.filter(i => i.status === 'Concluído').length;
  
  const completionRateAtendimentos = totalAtendimentos > 0 
    ? Math.round((completedAtendimentos / totalAtendimentos) * 100) 
    : 0;
  const completionRateDemandas = totalDemandas > 0 
    ? Math.round((completedDemandas / totalDemandas) * 100) 
    : 0;

  const resetFilters = () => {
    setSelectedTypeFilter('Todos');
    setSelectedPriorityFilter('Todos');
    setSelectedStatusFilter('Todos');
    setSelectedYearFilter('Todos');
  };

  if (loading) {
    return (
      <div className="h-96 flex flex-col items-center justify-center space-y-4">
        <div className="w-10 h-10 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-400 text-sm font-mono italic">Processando indicadores estatísticos...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 md:space-y-8">
      {/* Header Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl md:text-2xl font-black text-white flex items-center gap-2.5">
            <TrendingUp className="text-blue-500" size={24} />
            Painel de Indicadores de Gestão
          </h2>
          <p className="text-slate-400 text-xs md:text-sm font-sans">
            Acompanhe o volume mensal de atendimentos ao cidadão e demandas parlamentares.
          </p>
        </div>

        {/* Chart view toggler */}
        <div className="flex items-center bg-slate-900 border border-slate-800 p-1.5 rounded-2xl shrink-0 self-start">
          <button 
            onClick={() => setChartMode('combined')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              chartMode === 'combined' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/10" 
                : "text-slate-400 hover:text-white"
            )}
          >
            Gráfico Composto
          </button>
          <button 
            onClick={() => setChartMode('split')}
            className={cn(
              "px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer",
              chartMode === 'split' 
                ? "bg-blue-600 text-white shadow-md shadow-blue-900/10" 
                : "text-slate-400 hover:text-white"
            )}
          >
            Gráficos Separados
          </button>
        </div>
      </div>

      {/* Control Filter Bar */}
      <div className="bg-slate-900 border border-slate-800/80 p-5 rounded-3xl space-y-4 shadow-xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400 uppercase tracking-widest">
            <Filter size={14} className="text-blue-500" />
            Filtros do Painel
          </div>
          {(selectedTypeFilter !== 'Todos' || selectedPriorityFilter !== 'Todos' || selectedStatusFilter !== 'Todos' || selectedYearFilter !== 'Todos') && (
            <button 
              onClick={resetFilters}
              className="text-xs text-red-400 hover:text-red-300 font-bold flex items-center gap-1 cursor-pointer transition-colors"
            >
              <RefreshCw size={12} className="animate-spin" style={{ animationDuration: '4s' }} />
              Limpar Filtros
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Filter 1: Tipo Atendimento */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo de Atendimento</label>
            <div className="relative">
              <select 
                value={selectedTypeFilter} 
                onChange={(e) => setSelectedTypeFilter(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer"
              >
                {uniqueTypes.map(t => (
                  <option key={t} value={t}>{t === 'Todos' ? 'Todos os Atendimentos' : t}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Filter 2: Prioridade Demanda */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Prioridade da Demanda</label>
            <div className="relative">
              <select 
                value={selectedPriorityFilter} 
                onChange={(e) => setSelectedPriorityFilter(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer"
                disabled={selectedTypeFilter !== 'Todos'}
              >
                {uniquePriorities.map(p => (
                  <option key={p} value={p}>{p === 'Todos' ? 'Todas as Prioridades' : `Prioridade: ${p}`}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
            </div>
            {selectedTypeFilter !== 'Todos' && (
              <p className="text-[9px] text-slate-500 italic mt-0.5">Desativado (filtro de Atendimento ativo)</p>
            )}
          </div>

          {/* Filter 3: Status */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Status Global</label>
            <div className="relative">
              <select 
                value={selectedStatusFilter} 
                onChange={(e) => setSelectedStatusFilter(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer"
              >
                {uniqueStatuses.map(s => (
                  <option key={s} value={s}>{s === 'Todos' ? 'Todos os Status' : `Status: ${s}`}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>

          {/* Filter 4: Ano */}
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Ano de Referência</label>
            <div className="relative">
              <select 
                value={selectedYearFilter} 
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="w-full bg-slate-950 text-slate-200 border border-slate-800 rounded-xl p-3 text-xs focus:ring-2 focus:ring-blue-500/50 outline-none appearance-none cursor-pointer"
              >
                {uniqueYears.map(y => (
                  <option key={y} value={y}>{y === 'Todos' ? 'Todos os Anos' : `Ano: ${y}`}</option>
                ))}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-3.5 text-slate-500 pointer-events-none" />
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col hover:border-slate-700 transition-all shadow-md"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-400 flex items-center justify-center">
              <Users size={16} />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Atendimentos</span>
          </div>
          <p className="text-2xl font-black text-slate-100 mt-1">{totalAtendimentos}</p>
          <span className="text-[10px] text-slate-500 mt-2 font-mono">Média mensal de {avgAtendimentos}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col hover:border-slate-700 transition-all shadow-md"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-pink-500/10 text-pink-400 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Demandas</span>
          </div>
          <p className="text-2xl font-black text-slate-100 mt-1">{totalDemandas}</p>
          <span className="text-[10px] text-slate-500 mt-2 font-mono">Média mensal de {avgDemandas}</span>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col hover:border-slate-700 transition-all shadow-md"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 size={16} />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Atend. Concluídos</span>
          </div>
          <p className="text-2xl font-black text-slate-100 mt-1">{completedAtendimentos}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-emerald-500 h-1.5 rounded-full" style={{ width: `${completionRateAtendimentos}%` }} />
            </div>
            <span className="text-[10px] font-mono text-emerald-400 font-bold shrink-0">{completionRateAtendimentos}%</span>
          </div>
        </motion.div>

        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="bg-slate-900 border border-slate-800/80 p-5 rounded-2xl flex flex-col hover:border-slate-700 transition-all shadow-md"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-400 flex items-center justify-center">
              <Activity size={16} />
            </div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">Dem. Concluídas</span>
          </div>
          <p className="text-2xl font-black text-slate-100 mt-1">{completedDemandas}</p>
          <div className="flex items-center gap-1.5 mt-2">
            <div className="w-full bg-slate-800 rounded-full h-1.5">
              <div className="bg-purple-500 h-1.5 rounded-full" style={{ width: `${completionRateDemandas}%` }} />
            </div>
            <span className="text-[10px] font-mono text-purple-400 font-bold shrink-0">{completionRateDemandas}%</span>
          </div>
        </motion.div>
      </div>

      {/* Main Chart Area */}
      <div className="space-y-6">
        {chartMode === 'combined' ? (
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Activity className="text-blue-500" size={18} />
                  Análise Temporal Unificada
                </h3>
                <p className="text-xs text-slate-500">Comparativo mensal entre volume de atendimentos gerais e demandas protocoladas.</p>
              </div>
              <div className="flex items-center gap-4 text-xs font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-3 rounded bg-blue-500" />
                  <span className="text-slate-400">Atendimentos (Barras)</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3 h-1 bg-pink-500 rounded" />
                  <span className="text-slate-400">Demandas (Linha)</span>
                </div>
              </div>
            </div>

            <div className="h-[380px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                  <XAxis 
                    dataKey="monthName" 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                  />
                  <YAxis 
                    axisLine={false} 
                    tickLine={false} 
                    tick={{ fill: '#94a3b8', fontSize: 11 }} 
                  />
                  <Tooltip 
                    contentStyle={{ 
                      backgroundColor: '#090d16', 
                      borderColor: '#1e293b', 
                      borderRadius: '16px',
                      color: '#f8fafc',
                      fontSize: '12px',
                      padding: '12px'
                    }}
                    cursor={{ fill: '#1e293b', opacity: 0.15 }}
                  />
                  <Legend 
                    verticalAlign="bottom" 
                    height={36} 
                    iconType="circle"
                    formatter={(value) => <span className="text-xs text-slate-400 font-medium">{value}</span>}
                  />
                  <Bar 
                    name="Atendimentos ao Cidadão" 
                    dataKey="Atendimentos" 
                    fill="#3b82f6" 
                    radius={[6, 6, 0, 0]} 
                    maxBarSize={45} 
                  />
                  <Line 
                    name="Demandas Parlamentares" 
                    type="monotone" 
                    dataKey="Demandas" 
                    stroke="#ec4899" 
                    strokeWidth={3} 
                    dot={{ fill: '#ec4899', r: 4, strokeWidth: 1, stroke: '#fff' }}
                    activeDot={{ r: 6, strokeWidth: 0 }}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Split Chart 1: Atendimentos (Bars) */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
              <div className="mb-6">
                <h3 className="text-base font-bold text-white">Fluxo Mensal de Atendimentos</h3>
                <p className="text-xs text-slate-500">Volumetria de atendimentos diretos ao cidadão por período.</p>
              </div>

              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="monthName" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#090d16', 
                        borderColor: '#1e293b', 
                        borderRadius: '16px',
                        fontSize: '12px'
                      }}
                    />
                    <Bar 
                      name="Atendimentos" 
                      dataKey="Atendimentos" 
                      fill="#3b82f6" 
                      radius={[4, 4, 0, 0]} 
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Split Chart 2: Demandas (Lines) */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
              <div className="mb-6">
                <h3 className="text-base font-bold text-white">Evolução de Demandas Parlamentares</h3>
                <p className="text-xs text-slate-500">Tendência temporal de novos protocolos e providências oficiais.</p>
              </div>

              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis 
                      dataKey="monthName" 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    />
                    <YAxis 
                      axisLine={false} 
                      tickLine={false} 
                      tick={{ fill: '#94a3b8', fontSize: 11 }} 
                    />
                    <Tooltip 
                      contentStyle={{ 
                        backgroundColor: '#090d16', 
                        borderColor: '#1e293b', 
                        borderRadius: '16px',
                        fontSize: '12px'
                      }}
                    />
                    <Line 
                      name="Demandas" 
                      type="monotone" 
                      dataKey="Demandas" 
                      stroke="#ec4899" 
                      strokeWidth={3} 
                      dot={{ fill: '#ec4899', r: 4 }} 
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Data summary insight banner */}
        <div className="bg-slate-900/40 border border-slate-850 p-6 rounded-3xl flex flex-col md:flex-row items-center gap-4 justify-between">
          <div className="space-y-1 text-center md:text-left">
            <h4 className="text-sm font-bold text-white flex items-center gap-1.5 justify-center md:justify-start">
              <Clock size={16} className="text-blue-400" />
              Proporção de Atividades do Gabinete
            </h4>
            <p className="text-xs text-slate-400 max-w-xl">
              A proporção atual de registros é de {(totalAtendimentos / (totalAtendimentos + totalDemandas || 1) * 100).toFixed(0)}% Atendimentos diretos e {(totalDemandas / (totalAtendimentos + totalDemandas || 1) * 100).toFixed(0)}% Demandas regimentais/ofícios encaminhados.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="px-4 py-2 bg-slate-950 border border-slate-850 rounded-2xl">
              <span className="block text-[8px] font-mono font-bold uppercase text-slate-500 tracking-wider">Atend. Médicos (Participação)</span>
              <span className="text-sm font-black text-emerald-400">
                {filteredAtendimentos.filter(x => x.tipo_atendimento === 'Médico').length} registros
              </span>
            </div>
            <div className="px-4 py-2 bg-slate-950 border border-slate-850 rounded-2xl">
              <span className="block text-[8px] font-mono font-bold uppercase text-slate-500 tracking-wider">Demandas Altas</span>
              <span className="text-sm font-black text-pink-400">
                {filteredDemandas.filter(x => x.prioridade === 'Alta').length} protocolos
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

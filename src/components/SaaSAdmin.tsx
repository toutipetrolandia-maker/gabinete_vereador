import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  Plus, 
  Search, 
  Globe, 
  ShieldCheck, 
  Users, 
  Activity,
  CreditCard,
  Settings,
  ChevronRight,
  MoreVertical,
  ExternalLink,
  Loader2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { collection, query, orderBy, onSnapshot, doc, setDoc, serverTimestamp, addDoc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { format, startOfMonth, endOfMonth, isWithinInterval } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid } from 'recharts';

const PLAN_PRICES = {
  basic: 299,
  pro: 599,
  enterprise: 1200
};

export default function SaaSAdmin() {
  const { isSuperAdmin, switchCabinet } = useAuth();
  const [cabinets, setCabinets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCabinet, setNewCabinet] = useState({
    name: '',
    slug: '',
    vereador_nome: '',
    custom_domain: '',
    subdomain: '',
    plan: 'basic',
    status: 'active'
  });

  // Auto-generate slug and domains based on vereador_nome
  useEffect(() => {
    if (!newCabinet.vereador_nome) return;
    
    const sanitize = (text: string) => {
      return text
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '');
    };

    const sanitized = sanitize(newCabinet.vereador_nome);
    
    setNewCabinet(prev => ({
      ...prev,
      name: prev.name || `Gabinete ${prev.vereador_nome}`,
      slug: prev.slug || sanitized,
      subdomain: prev.subdomain || sanitized,
      custom_domain: prev.custom_domain || `gabinete-vereador.${sanitized}.vercel.app`
    }));
  }, [newCabinet.vereador_nome]);

  useEffect(() => {
    if (!isSuperAdmin) return;

    const q = query(collection(db, 'cabinets'), orderBy('created_at', 'desc'));
    const unsub = onSnapshot(q, (snap) => {
      setCabinets(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    });

    return () => unsub();
  }, [isSuperAdmin]);

  const handleAddCabinet = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const slug = newCabinet.slug.toLowerCase().replace(/[^a-z0-9]/g, '-');
      const cabinetRef = doc(db, 'cabinets', slug);
      
      await setDoc(cabinetRef, {
        ...newCabinet,
        slug,
        created_at: serverTimestamp(),
        updated_at: serverTimestamp()
      });

      setShowAddModal(false);
      setNewCabinet({ name: '', slug: '', vereador_nome: '', custom_domain: '', subdomain: '', plan: 'basic', status: 'active' });
    } catch (err) {
      console.error("Erro ao criar gabinete:", err);
      alert("Erro ao criar gabinete.");
    }
  };

  const handleEditCabinet = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCabinet) return;
    try {
      const cabinetRef = doc(db, 'cabinets', editingCabinet.id);
      await updateDoc(cabinetRef, {
        ...editingCabinet,
        updated_at: serverTimestamp()
      });
      setEditingCabinet(null);
    } catch (err) {
      console.error("Erro ao atualizar gabinete:", err);
      alert("Erro ao atualizar gabinete.");
    }
  };

  const handleDeleteCabinet = async (id: string) => {
    if (!window.confirm("CUIDADO: Isso excluirá permanentemente este gabinete e todos os seus dados. Tem certeza?")) return;
    try {
      await deleteDoc(doc(db, 'cabinets', id));
    } catch (err) {
      console.error("Erro ao excluir gabinete:", err);
      alert("Erro ao excluir gabinete.");
    }
  };

  if (!isSuperAdmin) {
    return (
      <div className="flex flex-col items-center justify-center h-[70vh] text-slate-500">
        <ShieldCheck size={64} className="mb-4 opacity-20" />
        <h2 className="text-xl font-bold">Acesso Restrito</h2>
        <p>Apenas o Super Administrador pode acessar esta página.</p>
      </div>
    );
  }

  const filteredCabinets = cabinets.filter(c => 
    c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.slug?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.vereador_nome?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const totalRevenue = cabinets
    .filter(c => c.status === 'active')
    .reduce((acc, curr) => acc + (PLAN_PRICES[curr.plan as keyof typeof PLAN_PRICES] || 0), 0);

  const planData = [
    { name: 'Básico', value: cabinets.filter(c => c.plan === 'basic').length, color: '#3b82f6' },
    { name: 'Profissional', value: cabinets.filter(c => c.plan === 'pro').length, color: '#8b5cf6' },
    { name: 'Premium', value: cabinets.filter(c => c.plan === 'enterprise').length, color: '#ec4899' },
  ];

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-white mb-2">Administração SaaS</h1>
          <p className="text-slate-400">Gerenciamento global de gabinetes, licenças e multitenancy.</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all shadow-lg shadow-blue-900/20"
        >
          <Plus size={20} />
          Novo Gabinete
        </button>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-blue-500/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
              <Building2 size={24} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Total Gabinetes</span>
              <div className="text-2xl font-black text-white">{cabinets.length}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Gabinete Ativos</span>
              <div className="text-2xl font-black text-white">{cabinets.filter(c => c.status === 'active').length}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
              <CreditCard size={24} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">MRR (Mensal)</span>
              <div className="text-2xl font-black text-white">R$ {totalRevenue.toLocaleString()}</div>
            </div>
          </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl shadow-xl">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 bg-purple-500/10 rounded-2xl flex items-center justify-center text-purple-500 border border-purple-500/20">
              <Activity size={24} />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-widest text-slate-500">Status Plataforma</span>
              <div className="text-2xl font-black text-emerald-400">ESTÁVEL</div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
          <div className="p-6 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-xl font-bold text-white">Ecossistema de Gabinetes</h2>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text" 
                placeholder="Buscar..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-sm font-medium"
              />
            </div>
          </div>

          <div className="overflow-x-auto min-h-[400px]">
            <table className="w-full text-left table-fixed border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                  <th className="px-6 py-5 w-[40%]">Gabinete / Identificação</th>
                  <th className="px-6 py-5 w-[15%]">Status</th>
                  <th className="px-6 py-5 w-[15%]">Plano</th>
                  <th className="px-6 py-5 w-[30%] text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {loading ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center">
                      <Loader2 className="animate-spin mx-auto text-blue-500 mb-2" size={32} />
                      <span className="text-slate-500 font-medium">Carregando ecossistema...</span>
                    </td>
                  </tr>
                ) : filteredCabinets.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-20 text-center text-slate-500 font-medium italic">
                      Nenhum gabinete cadastrado na plataforma.
                    </td>
                  </tr>
                ) : filteredCabinets.map((cabinet) => (
                  <tr key={cabinet.id} className="hover:bg-slate-800/20 transition-colors group">
                    <td className="px-6 py-6 overflow-hidden">
                      <div className="flex items-center gap-4">
                        <div className="flex-shrink-0 w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center text-xl font-bold text-slate-400 group-hover:text-blue-400 transition-colors border border-slate-700/50">
                          {cabinet.name?.[0]}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-bold text-white mb-0.5 truncate">{cabinet.name}</div>
                          <div className="text-[10px] text-slate-500 font-mono tracking-tighter flex flex-col gap-0.5">
                            <span className="truncate opacity-60">ID: {cabinet.id}</span>
                            <span className="truncate text-blue-500/70 font-bold">@{cabinet.slug}</span>
                            {(cabinet.custom_domain || cabinet.subdomain) && (
                              <div className="flex flex-col gap-0.5 mt-1 border-t border-slate-800 pt-1">
                                {cabinet.custom_domain && (
                                  <span className="truncate flex items-center gap-1">
                                    <Globe size={10} /> {cabinet.custom_domain}
                                  </span>
                                )}
                                {cabinet.subdomain && (
                                  <span className="truncate flex items-center gap-1">
                                    <ExternalLink size={10} /> {cabinet.subdomain}.gabinetedigital.app
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-6">
                      <span className={cn(
                        "text-[10px] font-black uppercase px-2.5 py-1.5 rounded-lg inline-flex items-center gap-1.5 border shadow-sm",
                        cabinet.status === 'active' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                        "bg-red-500/10 text-red-400 border-red-500/20"
                      )}>
                        <div className={cn("w-1.5 h-1.5 rounded-full", cabinet.status === 'active' ? "bg-emerald-500 animate-pulse" : "bg-red-500")} />
                        {cabinet.status === 'active' ? 'Ativo' : 'Suspenso'}
                      </span>
                    </td>
                    <td className="px-6 py-6">
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest bg-slate-800/80 border border-slate-700/50 px-2.5 py-1.5 rounded-lg">
                        {cabinet.plan}
                      </span>
                    </td>
                    <td className="px-6 py-6 text-right">
                      <div className="flex items-center justify-end gap-2">
                         <button 
                            onClick={() => setEditingCabinet(cabinet)}
                            className="h-10 px-4 bg-slate-800 hover:bg-slate-700 border border-slate-700/50 rounded-xl text-slate-300 hover:text-white transition-all flex items-center gap-2 text-[10px] font-black" title="Configurar Gabinete">
                            <Settings size={14} className="opacity-70" />
                            <span className="hidden sm:inline">EDITAR</span>
                         </button>
                         <button 
                            onClick={() => switchCabinet(cabinet.id)}
                            className="w-10 h-10 flex items-center justify-center bg-blue-600/10 hover:bg-blue-600 border border-blue-500/20 rounded-xl text-blue-400 hover:text-white transition-all" 
                            title="Acessar como Admin"
                          >
                            <ExternalLink size={16} />
                         </button>
                         <button 
                            onClick={() => handleDeleteCabinet(cabinet.id)}
                            className="w-10 h-10 flex items-center justify-center hover:bg-red-500/10 rounded-xl text-slate-500 hover:text-red-400 transition-all">
                            <MoreVertical size={18} />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
             <h3 className="text-lg font-bold text-white mb-6">Distribuição de Planos</h3>
             <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={planData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {planData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px' }}
                      itemStyle={{ color: '#fff' }}
                    />
                  </PieChart>
                </ResponsiveContainer>
             </div>
             <div className="space-y-4">
                {planData.map((p) => (
                  <div key={p.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <div className="w-2 h-2 rounded-full" style={{ backgroundColor: p.color }} />
                       <span className="text-xs text-slate-400 font-medium">{p.name}</span>
                    </div>
                    <span className="text-xs font-bold text-white">{p.value}</span>
                  </div>
                ))}
             </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-8 rounded-3xl shadow-xl">
              <h3 className="text-lg font-bold text-white mb-2">Relatório de Receita</h3>
              <p className="text-xs text-slate-500 mb-6 font-medium">Previsão baseada em planos ativos.</p>
              
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-2xl flex items-center justify-between mb-4">
                 <div>
                    <span className="block text-[10px] text-slate-500 font-black uppercase tracking-widest">MRR Atual</span>
                    <span className="text-xl font-black text-white">R$ {totalRevenue.toLocaleString()}</span>
                 </div>
                 <div className="text-emerald-500 flex items-center gap-1 font-bold text-xs">
                    +12% <Activity size={14} />
                 </div>
              </div>

              <div className="space-y-3">
                 <div className="flex items-center justify-between text-[11px] font-bold">
                    <span className="text-slate-500">Meta Mensal (R$ 50k)</span>
                    <span className="text-white">{(totalRevenue / 50000 * 100).toFixed(1)}%</span>
                 </div>
                 <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-blue-600 transition-all" 
                      style={{ width: `${Math.min(totalRevenue / 50000 * 100, 100)}%` }} 
                    />
                 </div>
              </div>
          </div>
        </div>
      </div>

      {/* Edit Cabinet Modal */}
      <AnimatePresence>
        {editingCabinet && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditingCabinet(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-8 z-[101] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">Editar Gabinete</h3>
                  <p className="text-slate-500 text-sm">Atualize as configurações do gabinete.</p>
                </div>
                <button onClick={() => setEditingCabinet(null)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 text-2xl">
                  &times;
                </button>
              </div>

              <form onSubmit={handleEditCabinet} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome do Gabinete</label>
                    <input 
                      type="text" 
                      required
                      value={editingCabinet.name}
                      onChange={e => setEditingCabinet({...editingCabinet, name: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Slug (Imutável)</label>
                    <input 
                      type="text" 
                      disabled
                      value={editingCabinet.slug}
                      className="w-full bg-slate-800 border border-slate-800 rounded-2xl p-4 text-slate-500 outline-none font-mono text-sm cursor-not-allowed opacity-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome Completo do Vereador</label>
                  <input 
                    type="text" 
                    required
                    value={editingCabinet.vereador_nome}
                    onChange={e => setEditingCabinet({...editingCabinet, vereador_nome: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Domínio Customizado</label>
                    <input 
                      type="text" 
                      value={editingCabinet.custom_domain || ''}
                      onChange={e => setEditingCabinet({...editingCabinet, custom_domain: e.target.value.toLowerCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Subdomínio</label>
                    <input 
                      type="text" 
                      value={editingCabinet.subdomain || ''}
                      onChange={e => setEditingCabinet({...editingCabinet, subdomain: e.target.value.toLowerCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Plano</label>
                    <select 
                      value={editingCabinet.plan}
                      onChange={e => setEditingCabinet({...editingCabinet, plan: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium appearance-none"
                    >
                      <option value="basic">Plano Básico (R$ 299)</option>
                      <option value="pro">Plano Profissional (R$ 599)</option>
                      <option value="enterprise">Plano Premium (R$ 1200)</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Status</label>
                    <select 
                      value={editingCabinet.status}
                      onChange={e => setEditingCabinet({...editingCabinet, status: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium appearance-none"
                    >
                      <option value="active">Ativo</option>
                      <option value="suspended">Suspenso</option>
                      <option value="trial">Período de Teste</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setEditingCabinet(null)}
                    className="flex-1 py-4 text-sm font-bold text-slate-500 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-900/20 transition-all"
                  >
                    Salvar Alterações
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Add Cabinet Modal */}
      <AnimatePresence>
        {showAddModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAddModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100]" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-4 top-1/2 -translate-y-1/2 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-full md:max-w-xl bg-slate-900 border border-slate-800 rounded-3xl p-8 z-[101] shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h3 className="text-2xl font-bold text-white mb-1">Cadastrar Gabinete</h3>
                  <p className="text-slate-500 text-sm">Crie uma nova instância individual para um Vereador.</p>
                </div>
                <button onClick={() => setShowAddModal(false)} className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 text-2xl">
                  &times;
                </button>
              </div>

              <form onSubmit={handleAddCabinet} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome do Gabinete</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: Gabinete Vereador Silva"
                      value={newCabinet.name}
                      onChange={e => setNewCabinet({...newCabinet, name: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Identificador Exclusivo (Slug)</label>
                    <input 
                      type="text" 
                      required
                      placeholder="Ex: camara-petrolandia"
                      value={newCabinet.slug}
                      onChange={e => setNewCabinet({...newCabinet, slug: e.target.value.toLowerCase().replace(/\s+/g, '-')})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-mono text-sm"
                    />
                    <p className="text-[9px] text-slate-600 px-1 font-medium">Este será o ID do banco de dados para este vereador.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome Completo do Vereador</label>
                  <input 
                    type="text" 
                    required
                    placeholder="Nome que aparecerá no sistema"
                    value={newCabinet.vereador_nome}
                    onChange={e => setNewCabinet({...newCabinet, vereador_nome: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
                  />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Domínio Customizado</label>
                    <input 
                      type="text" 
                      placeholder="Ex: vereadorsilva.com.br"
                      value={newCabinet.custom_domain}
                      onChange={e => setNewCabinet({...newCabinet, custom_domain: e.target.value.toLowerCase()})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Subdomínio (gabinetedigital.app)</label>
                    <input 
                      type="text" 
                      placeholder="Ex: silva"
                      value={newCabinet.subdomain}
                      onChange={e => setNewCabinet({...newCabinet, subdomain: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, '-')})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-mono text-sm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Plano de Assinatura</label>
                    <select 
                      value={newCabinet.plan}
                      onChange={e => setNewCabinet({...newCabinet, plan: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium appearance-none"
                    >
                      <option value="basic">Plano Básico (Grátis)</option>
                      <option value="pro">Plano Profissional</option>
                      <option value="enterprise">Plano Premium</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Status do Acesso</label>
                    <select 
                      value={newCabinet.status}
                      onChange={e => setNewCabinet({...newCabinet, status: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium appearance-none"
                    >
                      <option value="active">🟢 Ativo (Liberado)</option>
                      <option value="suspended">🔒 Suspenso (Bloqueado)</option>
                      <option value="trial">⏱️ Período de Teste</option>
                    </select>
                  </div>
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button" 
                    onClick={() => setShowAddModal(false)}
                    className="flex-1 py-4 text-sm font-bold text-slate-500 hover:text-white transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-2xl shadow-lg shadow-blue-900/20 transition-all"
                  >
                    Registrar Agora
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

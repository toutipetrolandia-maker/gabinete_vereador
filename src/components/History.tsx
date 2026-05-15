import React, { useState, useEffect } from 'react';
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
  RefreshCw
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

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

  useEffect(() => {
    if (!profile?.cabinetId) return;
    
    const q = query(
      collection(db, 'logs'),
      where('cabinet_id', '==', profile.cabinetId),
      orderBy('criado_em', 'desc'),
      limit(200)
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

  // Get unique users and collections for filters
  const uniqueUsers = Array.from(new Set(logs.map(l => JSON.stringify({id: l.usuario_id, nome: l.usuario_nome}))))
    .map(s => JSON.parse(s));
  const uniqueCollections = Array.from(new Set(logs.map(l => l.colecao)));

  // Calculate user productivity
  const productivity = uniqueUsers.map(u => {
    const count = logs.filter(l => l.usuario_id === u.id).length;
    return { ...u, count };
  }).sort((a, b) => b.count - a.count);

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <HistoryIcon className="text-blue-500" size={24} />
            Trilha de Auditoria
          </h2>
          <p className="text-slate-400 text-sm">Acompanhe todas as ações realizadas no sistema para controle de produção.</p>
        </div>
      </div>

      {/* Productivity Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {productivity.slice(0, 4).map(u => (
          <div key={u.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4">
             <div className="w-10 h-10 bg-blue-500/10 rounded-xl flex items-center justify-center text-blue-500 font-bold border border-blue-500/20">
                {u.nome[0]}
             </div>
             <div>
                <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Ações Recentes</span>
                <div className="flex items-center gap-2">
                   <span className="text-lg font-bold text-white">{u.count}</span>
                   <span className="text-xs text-slate-400 truncate max-w-[80px]">{u.nome}</span>
                </div>
             </div>
          </div>
        ))}
      </div>

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
                  <td colSpan={5} className="px-6 py-10 text-center text-slate-500">Carregando logs do sistema...</td>
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
  );
}

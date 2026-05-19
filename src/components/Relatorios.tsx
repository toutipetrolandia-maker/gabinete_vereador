import { useState, useEffect } from 'react';
import { 
  FileDown, 
  Table as TableIcon, 
  Filter, 
  BarChart, 
  Download,
  CheckCircle2,
  Calendar,
  MapPin,
  ExternalLink,
  Map as MapIcon
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';

export default function Relatorios() {
  const { profile } = useAuth();
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any[]>([]);
  const [cabinetData, setCabinetData] = useState<any>(null);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [filterType, setFilterType] = useState('atendimentos');
  const [status, setStatus] = useState('Todos');
  const [tipoAtendimento, setTipoAtendimento] = useState('Todos');
  const [bairro, setBairro] = useState('');
  const [zonaRural, setZonaRural] = useState<'Todos' | 'Sim' | 'Não'>('Todos');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  useEffect(() => {
    if (!profile?.cabinetId) return;
    const unsub = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) setCabinetData(snap.data());
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  // Load all data from selected collection to filter locally for live preview
  useEffect(() => {
    const fetchData = async () => {
      if (!profile?.cabinetId) return;
      setLoading(true);
      try {
        if (filterType === 'unificado') {
          const collections = ['atendimentos', 'atendimentos_medicos', 'demandas_parlamentares', 'auxilio_social'];
          const results = await Promise.all(collections.map(async (coll) => {
            const q = query(
              collection(db, coll), 
              where('cabinetId', '==', profile.cabinetId),
              orderBy('created_at', 'desc')
            );
            const snap = await getDocs(q);
            return snap.docs.map(doc => ({ 
              id: doc.id, 
              ...doc.data(),
              sourceCollection: coll,
              reportType: coll === 'atendimentos' ? 'Geral' :
                         coll === 'atendimentos_medicos' ? 'Médico' :
                         coll === 'demandas_parlamentares' ? 'Demanda' : 'Auxílio'
            }));
          }));
          setData((results.flat() as any[]).sort((a, b) => {
            const dateA = a.created_at?.toDate?.() || new Date(0);
            const dateB = b.created_at?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          }));
        } else {
          const q = query(
            collection(db, filterType), 
            where('cabinetId', '==', profile.cabinetId),
            orderBy('created_at', 'desc')
          );
          const snap = await getDocs(q);
          setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
        }
      } catch (err) {
        console.error("Error fetching report data:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [filterType, profile?.cabinetId]);

  // Apply filters locally
  useEffect(() => {
    let result = [...data];

    if (status !== 'Todos') {
      result = result.filter((item: any) => item.status === status);
    }

    if (filterType === 'atendimentos' && tipoAtendimento !== 'Todos') {
      result = result.filter((item: any) => item.tipo_atendimento === tipoAtendimento);
    }

    if (bairro.trim() !== '') {
      const search = bairro.toLowerCase();
      result = result.filter((item: any) => item.bairro?.toLowerCase().includes(search));
    }

    if (zonaRural !== 'Todos') {
      const isRural = zonaRural === 'Sim';
      result = result.filter((item: any) => item.zona_rural === isRural);
    }

    if (dateRange.start) {
      const start = new Date(dateRange.start + 'T00:00:00');
      result = result.filter((item: any) => {
        const createdAt = item.created_at?.toDate ? item.created_at.toDate() : null;
        return createdAt && createdAt >= start;
      });
    }

    if (dateRange.end) {
      const end = new Date(dateRange.end + 'T23:59:59');
      result = result.filter((item: any) => {
        const createdAt = item.created_at?.toDate ? item.created_at.toDate() : null;
        return createdAt && createdAt <= end;
      });
    }

    setFilteredData(result);
  }, [data, status, tipoAtendimento, bairro, zonaRural, dateRange]);

  const exportPDF = async () => {
    try {
      setLoading(true);
      const doc = new jsPDF();
      
      // Add Logo if available
      let startY = 20;
      const logoUrl = cabinetData?.cabinet_logo || cabinetData?.vereador_photo;
      if (logoUrl) {
        try {
          const imgProps = await new Promise<any>((resolve, reject) => {
             const img = new Image();
             img.crossOrigin = "Anonymous";
             img.onload = () => resolve(img);
             img.onerror = reject;
             img.src = logoUrl;
          });
          const logoWidth = 30;
          const logoHeight = (imgProps.height / imgProps.width) * logoWidth;
          doc.addImage(imgProps, 'PNG', 14, 10, logoWidth, logoHeight);
          startY = 15 + logoHeight;
        } catch (e) {
          console.error("Error adding logo to PDF:", e);
        }
      }

      doc.setFontSize(18);
      doc.setTextColor(30, 41, 59);
      doc.text(
        `Relatório: ${filterType === 'unificado' ? 'Base Unificada (Todos Atendimentos)' : filterType.charAt(0).toUpperCase() + filterType.slice(1).replace('_', ' ')}`, 
        logoUrl ? 14 : 14, 
        logoUrl ? startY + 10 : 20
      );
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gabinete: ${cabinetData?.app_name || cabinetData?.name || 'Gabinete Digital'}`, 14, logoUrl ? startY + 16 : 28);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, logoUrl ? startY + 21 : 33);

      const getTableConfig = () => {
        switch (filterType) {
          case 'unificado':
            return {
              head: [['Tipo', 'Cidadão/Assunto', 'Status', 'Data', 'Bairro']],
              body: filteredData.map((item: any) => [
                item.reportType || '-',
                item.nome_completo || item.beneficiado_nome || item.assunto || '-',
                item.status || '-',
                item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-',
                item.bairro || '-'
              ])
            };
          case 'demandas_parlamentares':
            return {
              head: [['Assunto', 'Órgão Resp.', 'Prioridade', 'Status', 'Data']],
              body: filteredData.map((item: any) => [
                item.assunto || '-',
                item.orgao_responsavel || '-',
                item.prioridade || '-',
                item.status || '-',
                item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-'
              ])
            };
          case 'atendimentos_medicos':
            return {
              head: [['Paciente', 'Especialidade', 'Status', 'Data', 'Profissional']],
              body: filteredData.map((item: any) => [
                item.nome_completo || '-',
                item.especialidade || '-',
                item.status || '-',
                item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-',
                item.usuario_nome?.split(' ')[0] || '-'
              ])
            };
          default:
            return {
              head: [['Nome/Assunto', 'Tipo/Prioridade', 'Data', 'Status', 'Localização']],
              body: filteredData.map((item: any) => [
                item.nome_completo || item.assunto || '-',
                item.tipo_atendimento || item.prioridade || '-',
                item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-',
                item.status || '-',
                item.latitude ? `Maps: ${item.latitude.toFixed(4)}, ${item.longitude?.toFixed(4)}` : (item.zona_rural ? 'Rural (Sem Pin)' : 'Urbano')
              ])
            };
        }
      };

      const config = getTableConfig();

      autoTable(doc, {
        startY: logoUrl ? startY + 28 : 40,
        head: config.head,
        body: config.body,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 8 }
      });

      doc.save(`relatorio_${filterType}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const exportBairroReport = async () => {
    try {
      setLoading(true);
      const doc = new jsPDF();
      const now = new Date();
      
      // Add Logo 
      let startY = 20;
      const logoUrl = cabinetData?.cabinet_logo || cabinetData?.vereador_photo;
      if (logoUrl) {
        try {
          const imgProps = await new Promise<any>((resolve, reject) => {
             const img = new Image();
             img.crossOrigin = "Anonymous";
             img.onload = () => resolve(img);
             img.onerror = reject;
             img.src = logoUrl;
          });
          const logoWidth = 30;
          const logoHeight = (imgProps.height / imgProps.width) * logoWidth;
          doc.addImage(imgProps, 'PNG', 14, 10, logoWidth, logoHeight);
          startY = 15 + logoHeight;
        } catch (e) {
          console.error("Error adding logo:", e);
        }
      }

      // Header
      doc.setFontSize(20);
      doc.setTextColor(30, 41, 59);
      doc.text('Relatório de Atendimentos por Bairro', 14, logoUrl ? startY + 8 : 20);
      
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gabinete: ${cabinetData?.app_name || cabinetData?.name || 'Gabinete Digital'}`, 14, logoUrl ? startY + 14 : 28);
      doc.text(`Período: ${dateRange.start ? format(new Date(dateRange.start + 'T00:00:00'), "dd/MM/yy") : 'Início'} até ${dateRange.end ? format(new Date(dateRange.end + 'T00:00:00'), "dd/MM/yy") : 'Hoje'}`, 14, logoUrl ? startY + 19 : 33);
      doc.text(`Gerado em: ${format(now, "dd/MM/yyyy HH:mm")}`, 14, logoUrl ? startY + 24 : 38);

      // Grouping logic
      const groupedData: Record<string, { count: number; items: any[] }> = {};
      
      filteredData.forEach(item => {
        const b = item.bairro || 'Não Informado';
        if (!groupedData[b]) {
          groupedData[b] = { count: 0, items: [] };
        }
        groupedData[b].count++;
        groupedData[b].items.push(item);
      });

      // Sort neighborhoods by count (descending)
      const sortedBairros = Object.entries(groupedData).sort((a, b) => b[1].count - a[1].count);

      let currentY = logoUrl ? startY + 35 : 45;

      // Overview Table
      doc.setFontSize(14);
      doc.setTextColor(59, 130, 246);
      doc.text('Resumo de Atendimentos', 14, currentY);
      
      autoTable(doc, {
        startY: currentY + 5,
        head: [['Bairro', 'Total de Atendimentos']],
        body: sortedBairros.map(([b, info]) => [b, info.count]),
        theme: 'striped',
        headStyles: { fillColor: [30, 41, 59] },
        margin: { bottom: 20 }
      });

      currentY = (doc as any).lastAutoTable.finalY + 15;

      // Detailed Sections for each Bairro
      sortedBairros.forEach(([b, info], index) => {
        if (currentY > 240) {
          doc.addPage();
          currentY = 20;
        }

        doc.setFontSize(12);
        doc.setTextColor(30, 41, 59);
        doc.setFont("helvetica", "bold");
        doc.text(`${index + 1}. Bairro: ${b} (${info.count} atendimentos)`, 14, currentY);
        doc.setFont("helvetica", "normal");
        
        // Filter high priority items for this bairro
        const highPriority = info.items.filter(item => 
          item.prioridade === 'Urgente' || item.prioridade === 'Alto' || item.prioridade === 'Alta'
        );

        if (highPriority.length > 0) {
          autoTable(doc, {
            startY: currentY + 5,
            head: [['Nome / Assunto', 'Prioridade', 'Status', 'Data']],
            body: highPriority.map(item => [
              item.nome_completo || item.assunto || '-',
              item.prioridade || '-',
              item.status || '-',
              item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-'
            ]),
            theme: 'grid',
            headStyles: { fillColor: [220, 38, 38] }, // Red header for priority
            styles: { fontSize: 8 },
            margin: { left: 20 }
          });
          currentY = (doc as any).lastAutoTable.finalY + 12;
        } else {
          doc.setFontSize(9);
          doc.setTextColor(150);
          doc.text('Nenhum atendimento de alta prioridade registrado neste bairro.', 20, currentY + 8);
          currentY += 18;
        }
      });

      doc.save(`atendimentos_por_bairro_${format(now, "yyyyMMdd")}.pdf`);
    } catch (err) {
      console.error("Error generating neighborhood report:", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-bold text-white mb-2 font-display">Relatórios de Atividade</h1>
        <p className="text-slate-400">Exporte e analise os dados gerados pelo gabinete.</p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Export Controls */}
        <div className="md:col-span-1 space-y-6">
           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2">
                 <Filter size={14} /> Filtro de Dados
              </h3>
              
              <div className="space-y-4">
                 <div>
                    <label className="text-xs font-medium text-slate-400 mb-2 block">Tipo de Coleção</label>
                    <select 
                      value={filterType} 
                      onChange={e => setFilterType(e.target.value)}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500/50"
                    >
                       <option value="unificado">Relatório Unificado (Todos)</option>
                       <option value="atendimentos">Atendimentos Gerais</option>
                       <option value="atendimentos_medicos">Atendimentos Médicos</option>
                       <option value="malotes">Malotes e Ofícios</option>
                       <option value="demandas_parlamentares">Demandas Parlamentares</option>
                       <option value="sugestoes">Sugestões Públicas</option>
                    </select>
                 </div>
                 
                 <div>
                    <label className="text-xs font-medium text-slate-400 mb-2 block">Status (Filtro)</label>
                    <select 
                      value={status} 
                      onChange={e => setStatus(e.target.value)}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500/50"
                    >
                       <option>Todos</option>
                       <option>Novo</option>
                       <option>Em andamento</option>
                       <option>Concluído</option>
                       <option>Encaminhado</option>
                       <option>Cancelado</option>
                    </select>
                 </div>

                 {filterType === 'atendimentos' && (
                   <div>
                     <label className="text-xs font-medium text-slate-400 mb-2 block">Tipo de Atendimento</label>
                     <select 
                       value={tipoAtendimento} 
                       onChange={e => setTipoAtendimento(e.target.value)}
                       className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500/50"
                     >
                        <option>Todos</option>
                        <option>Geral</option>
                        <option>Médico</option>
                        <option>Jurídico</option>
                        <option>Social</option>
                        <option>Outros</option>
                     </select>
                   </div>
                 )}

                 <div>
                    <label className="text-xs font-medium text-slate-400 mb-2 block">Bairro</label>
                    <input 
                      type="text"
                      value={bairro}
                      onChange={e => setBairro(e.target.value)}
                      placeholder="Filtrar por bairro..."
                      className="w-full bg-slate-800 border-none rounded-xl p-3 text-xs placeholder:text-slate-600 focus:ring-2 focus:ring-blue-500/50"
                    />
                 </div>

                 <div>
                    <label className="text-xs font-medium text-slate-400 mb-2 block">Zona Rural</label>
                    <div className="grid grid-cols-3 gap-2">
                       {['Todos', 'Sim', 'Não'].map((opt) => (
                         <button
                           key={opt}
                           type="button"
                           onClick={() => setZonaRural(opt as any)}
                           className={`py-2 rounded-lg text-[10px] font-bold uppercase transition-all ${
                             zonaRural === opt 
                               ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                               : "bg-slate-800 text-slate-500 hover:bg-slate-700"
                           }`}
                         >
                           {opt}
                         </button>
                       ))}
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-2">
                    <div>
                       <label className="text-xs font-medium text-slate-400 mb-2 block">Início</label>
                       <input 
                         type="date"
                         value={dateRange.start}
                         onChange={e => setDateRange({...dateRange, start: e.target.value})}
                         className="w-full bg-slate-800 border-none rounded-xl p-3 text-xs"
                       />
                    </div>
                    <div>
                       <label className="text-xs font-medium text-slate-400 mb-2 block">Fim</label>
                       <input 
                         type="date"
                         value={dateRange.end}
                         onChange={e => setDateRange({...dateRange, end: e.target.value})}
                         className="w-full bg-slate-800 border-none rounded-xl p-3 text-xs"
                       />
                    </div>
                 </div>

                 <button 
                   onClick={exportPDF}
                   disabled={loading}
                   className="w-full bg-white text-slate-950 hover:bg-slate-100 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-4"
                 >
                    {loading ? <div className="w-4 h-4 border-2 border-slate-950 border-t-transparent rounded-full animate-spin" /> : <FileDown size={18} />}
                    {loading ? 'Processando...' : 'Exportar para PDF'}
                 </button>

                 {filterType === 'atendimentos' && (
                   <button 
                     onClick={exportBairroReport}
                     disabled={loading || filteredData.length === 0}
                     className="w-full bg-indigo-600 hover:bg-indigo-700 text-white py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all disabled:opacity-50 mt-2 shadow-lg shadow-indigo-900/20"
                   >
                      <MapIcon size={18} />
                      Relatório por Bairro
                   </button>
                 )}
              </div>
           </div>

           <div className="bg-blue-600/10 border border-blue-500/10 rounded-3xl p-6">
              <h3 className="font-bold text-blue-400 mb-2">Dica de Exportação</h3>
              <p className="text-xs text-blue-300/70 leading-relaxed">
                 O sistema gera relatórios formatados em PDF prontos para impressão. Use o filtro de coleção para obter dados específicos de cada área.
              </p>
           </div>
        </div>

        {/* Preview / Stats */}
        <div className="md:col-span-2 space-y-6">
           <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                 <div className="flex items-center gap-3 mb-4">
                    <CheckCircle2 className="text-emerald-500" size={24} />
                    <span className="text-slate-400 font-medium">Registros Encontrados</span>
                 </div>
                 <p className="text-4xl font-bold">{loading ? '...' : filteredData.length}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                 <div className="flex items-center gap-3 mb-4">
                    <Calendar className="text-blue-500" size={24} />
                    <span className="text-slate-400 font-medium">Último Fechamento</span>
                 </div>
                 <p className="text-xl font-bold">Maio / 2026</p>
              </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl">
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                 <h3 className="font-bold text-white uppercase tracking-wider text-xs">Prévia dos Dados</h3>
                 <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-500 font-mono">
                   Limitado a 5 registros
                 </span>
              </div>
              <div className="overflow-x-auto">
                 <table className="w-full text-left">
                     <thead>
                        <tr className="text-[10px] uppercase text-slate-500 bg-slate-950/50">
                           {filterType === 'unificado' ? (
                             <>
                               <th className="px-6 py-3">Tipo</th>
                               <th className="px-6 py-3">Cidadão / Assunto</th>
                               <th className="px-6 py-3">Status</th>
                               <th className="px-6 py-3">Data</th>
                               <th className="px-6 py-3">Bairro</th>
                             </>
                           ) : filterType === 'atendimentos_medicos' ? (
                             <>
                               <th className="px-6 py-3">Paciente</th>
                               <th className="px-6 py-3">Especialidade</th>
                               <th className="px-6 py-3">Status</th>
                               <th className="px-6 py-3">Data</th>
                               <th className="px-6 py-3">Profissional</th>
                             </>
                           ) : (
                             <>
                               <th className="px-6 py-3">Nome / Assunto</th>
                               <th className="px-6 py-3">Status</th>
                               <th className="px-6 py-3">Bairro</th>
                               <th className="px-6 py-3 text-center">Loc.</th>
                               <th className="px-6 py-3">Data</th>
                             </>
                           )}
                        </tr>
                     </thead>
                    <tbody className="divide-y divide-slate-800">
                       {loading ? (
                         <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-600 text-sm italic">Carregando dados...</td></tr>
                       ) : filteredData.length === 0 ? (
                         <tr><td colSpan={5} className="px-6 py-10 text-center text-slate-600 text-sm italic">Nenhum registro para os filtros selecionados.</td></tr>
                       ) : filteredData.slice(0, 5).map((item, i) => (
                          <tr key={i} className="hover:bg-slate-800/20">
                             {filterType === 'unificado' ? (
                               <>
                                 <td className="px-6 py-4 text-[10px] font-bold text-blue-400 uppercase tracking-tighter">{item.reportType}</td>
                                 <td className="px-6 py-4 text-xs text-slate-300 font-medium truncate max-w-[200px]">{item.nome_completo || item.beneficiado_nome || item.assunto || '-'}</td>
                                 <td className="px-6 py-4">
                                    <span className={cn(
                                       "text-[10px] px-2 py-0.5 rounded-full border",
                                       item.status === 'Concluído' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                       item.status === 'Encaminhado' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                       item.status === 'Em andamento' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                       "bg-slate-800 text-slate-400 border-slate-700"
                                     )}>
                                       {item.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-[10px] text-slate-500 font-mono">
                                   {item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-'}
                                 </td>
                                 <td className="px-6 py-4 text-xs text-slate-500">{item.bairro || '-'}</td>
                               </>
                             ) : filterType === 'atendimentos_medicos' ? (
                               <>
                                 <td className="px-6 py-4 text-xs text-slate-300 font-medium">{item.nome_completo || '-'}</td>
                                 <td className="px-6 py-4 text-xs text-slate-400">{item.especialidade || '-'}</td>
                                 <td className="px-6 py-4">
                                    <span className={cn(
                                      "text-[10px] px-2 py-0.5 rounded-full border",
                                      item.status === 'Concluído' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                      item.status === 'Encaminhado' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                      item.status === 'Em andamento' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                      "bg-slate-800 text-slate-400 border-slate-700"
                                    )}>
                                       {item.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-[10px] text-slate-500 font-mono">
                                   {item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-'}
                                 </td>
                                 <td className="px-6 py-4 text-xs text-slate-400 font-medium">{item.usuario_nome?.split(' ')[0] || '-'}</td>
                               </>
                             ) : (
                               <>
                                 <td className="px-6 py-4 text-xs text-slate-300 font-medium">{item.nome_completo || item.assunto || '-'}</td>
                                 <td className="px-6 py-4">
                                    <span className={cn(
                                       "text-[10px] px-2 py-0.5 rounded-full border",
                                       item.status === 'Concluído' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : 
                                       item.status === 'Encaminhado' ? "bg-purple-500/10 text-purple-400 border-purple-500/20" :
                                       item.status === 'Em andamento' ? "bg-amber-500/10 text-amber-400 border-amber-500/20" :
                                       "bg-slate-800 text-slate-400 border-slate-700"
                                     )}>
                                       {item.status}
                                    </span>
                                 </td>
                                 <td className="px-6 py-4 text-xs text-slate-500">{item.bairro || '-'}</td>
                                 <td className="px-6 py-4 text-center">
                                    {item.latitude && item.longitude ? (
                                      <a 
                                        href={`https://www.google.com/maps?q=${item.latitude},${item.longitude}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="inline-flex p-1.5 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-all"
                                        title="Ver no Google Maps"
                                      >
                                        <MapPin size={14} />
                                      </a>
                                    ) : (
                                      <span className="text-[10px] text-slate-700 italic">-</span>
                                    )}
                                 </td>
                                 <td className="px-6 py-4 text-[10px] text-slate-500 font-mono">
                                   {item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-'}
                                 </td>
                               </>
                             )}
                          </tr>
                       ))}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

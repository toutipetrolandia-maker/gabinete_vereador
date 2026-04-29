import { useState } from 'react';
import { 
  FileDown, 
  Table as TableIcon, 
  Filter, 
  BarChart, 
  Download,
  CheckCircle2,
  Calendar
} from 'lucide-react';
import { collection, query, getDocs, orderBy, where } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function Relatorios() {
  const [loading, setLoading] = useState(false);
  const [filterType, setFilterType] = useState('atendimentos');
  const [status, setStatus] = useState('Todos');
  const [dateRange, setDateRange] = useState({ start: '', end: '' });

  const exportPDF = async () => {
    setLoading(true);
    try {
      let q = query(collection(db, filterType), orderBy('created_at', 'desc'));
      
      const snap = await getDocs(q);
      let data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Client side filtering for the demo/simplicity if needed
      if (status !== 'Todos') {
        data = data.filter((item: any) => item.status === status);
      }

      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.text(`Relatório de ${filterType.charAt(0).toUpperCase() + filterType.slice(1).replace('_', ' ')}`, 14, 20);
      doc.setFontSize(10);
      doc.setTextColor(100);
      doc.text(`Gerado em: ${format(new Date(), "dd/MM/yyyy HH:mm")}`, 14, 28);

      const tableData = data.map((item: any) => [
        item.nome_completo || item.assunto || '-',
        item.tipo_atendimento || item.status || '-',
        item.created_at?.toDate ? format(item.created_at.toDate(), "dd/MM/yy") : '-',
        item.status || '-'
      ]);

      autoTable(doc, {
        startY: 35,
        head: [['Nome/Assunto', 'Tipo/Prioridade', 'Data', 'Status']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [59, 130, 246] },
      });

      doc.save(`relatorio_${filterType}_${format(new Date(), "yyyyMMdd")}.pdf`);
    } catch (err) {
      console.error(err);
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
                       <option>Concluídos</option>
                       <option>Pendentes</option>
                       <option>Encaminhados</option>
                    </select>
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
                    <span className="text-slate-400 font-medium">Relatórios Gerados</span>
                 </div>
                 <p className="text-4xl font-bold">12</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl">
                 <div className="flex items-center gap-3 mb-4">
                    <Calendar className="text-blue-500" size={24} />
                    <span className="text-slate-400 font-medium">Último Fechamento</span>
                 </div>
                 <p className="text-xl font-bold">Abril / 2024</p>
              </div>
           </div>

           <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center">
                 <BarChart className="text-slate-600" size={32} />
              </div>
              <div>
                 <h3 className="text-lg font-bold">Geração Automática</h3>
                 <p className="text-sm text-slate-500 max-w-xs mx-auto">
                    Os relatórios são gerados dinamicamente com base nos dados reais do seu banco de dados no Firestore.
                 </p>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}

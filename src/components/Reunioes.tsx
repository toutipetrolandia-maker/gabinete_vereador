import React, { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  serverTimestamp, 
  updateDoc, 
  doc, 
  deleteDoc 
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Users, 
  Briefcase, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  Eye, 
  FileText, 
  Sparkles, 
  Trash2, 
  FileDown, 
  ArrowRight,
  TrendingUp,
  SlidersHorizontal,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  HelpCircle,
  UserCheck,
  Building2,
  ListOrdered
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '../lib/utils';
import { logAction } from '../lib/audit';
import { generateMayorProposalSuggestions } from '../services/aiService';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface Advisor {
  id: string;
  nome: string;
  role: string;
}

interface Proposal {
  id: string;
  titulo: string;
  descricao_solucao: string;
  justificativa: string;
  tipo: string;
  status: 'Em Elaboração' | 'Pronta para Encontro' | 'Apresentada ao Prefeito' | 'Em Execução' | 'Resolvida' | 'Recusada';
  prioridade: 'Baixa' | 'Média' | 'Alta';
  oficio_numero?: string;
  data_apresentacao?: string;
  feedback_prefeito?: string;
  custo_estimado?: 'Baixo' | 'Médio' | 'Alto';
  reuniao_id?: string;
  usuario_nome?: string;
  ai_suggestions?: string;
  created_at?: any;
}

interface Meeting {
  id: string;
  titulo: string;
  data_hora: string;
  tipo: 'Alinhamento Geral' | 'Planejamento Estratégico' | 'Demandas do Prefeito' | 'Urgente';
  resumo_pauta: string;
  assessores_ids: string[];
  propostas_ids: string[];
  usuario_nome?: string;
  created_at?: any;
}

export default function Reunioes() {
  const { profile, user } = useAuth();
  const [activeSubTab, setActiveSubTab] = useState<'reunioes' | 'propostas' | 'kit'>('reunioes');
  
  // Lists
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [proposals, setProposals] = useState<Proposal[]>([]);
  const [advisors, setAdvisors] = useState<Advisor[]>([]);
  
  // Modals & Forms
  const [showMeetingModal, setShowMeetingModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [aiResult, setAiResult] = useState<string | null>(null);
  
  // Selection/Detail views
  const [selectedProposal, setSelectedProposal] = useState<Proposal | null>(null);
  const [expandedMeetingId, setExpandedMeetingId] = useState<string | null>(null);

  // Filters
  const [proposalStatusFilter, setProposalStatusFilter] = useState<string>('todos');
  const [proposalCategoryFilter, setProposalCategoryFilter] = useState<string>('todos');

  // Forms States
  const [meetingForm, setMeetingForm] = useState({
    id: '',
    titulo: '',
    data_hora: '',
    tipo: 'Alinhamento Geral' as 'Alinhamento Geral' | 'Planejamento Estratégico' | 'Demandas do Prefeito' | 'Urgente',
    resumo_pauta: '',
    assessores_ids: [] as string[],
    propostas_ids: [] as string[]
  });

  const [proposalForm, setProposalForm] = useState({
    id: '',
    titulo: '',
    descricao_solucao: '',
    justificativa: '',
    tipo: 'Infraestrutura',
    status: 'Em Elaboração' as 'Em Elaboração' | 'Pronta para Encontro' | 'Apresentada ao Prefeito' | 'Em Execução' | 'Resolvida' | 'Recusada',
    prioridade: 'Média' as 'Baixa' | 'Média' | 'Alta',
    oficio_numero: '',
    data_apresentacao: '',
    feedback_prefeito: '',
    custo_estimado: 'Médio' as 'Baixo' | 'Médio' | 'Alto',
    reuniao_id: '',
    ai_suggestions: ''
  });

  const proposalCategories = [
    "Saúde",
    "Infraestrutura",
    "Saneamento",
    "Educação",
    "Segurança",
    "Transporte / Trânsito",
    "Parques / Esportes",
    "Assistência Social",
    "Outros"
  ];

  const proposalStatuses = [
    { value: 'Em Elaboração', label: 'Em Elaboração', color: 'bg-slate-800 text-slate-300 border-slate-700' },
    { value: 'Pronta para Encontro', label: 'Pronta p/ Encontro', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' },
    { value: 'Apresentada ao Prefeito', label: 'Apresentada', color: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
    { value: 'Em Execução', label: 'Em Execução', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
    { value: 'Resolvida', label: 'Resolvida (Sucesso)', color: 'bg-purple-500/10 text-purple-400 border-purple-500/20' },
    { value: 'Recusada', label: 'Arquivada/Recusada', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' }
  ];

  // Fetch registered users (Advisors)
  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'users'),
      where('cabinetId', '==', profile.cabinetId),
      where('ativo', '==', true)
    );

    const unsub = onSnapshot(q, (snap) => {
      setAdvisors(
        snap.docs.map((d) => ({
          id: d.id,
          nome: d.data().nome || 'Sem Nome',
          role: d.data().role || 'staff'
        }))
      );
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  // Fetch Meetings
  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'reunioes_assessores'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('data_hora', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setMeetings(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        } as Meeting))
      );
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  // Fetch Proposals for Mayor
  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'propostas_prefeito'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('titulo', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setProposals(
        snap.docs.map((d) => ({
          id: d.id,
          ...d.data()
        } as Proposal))
      );
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  // AI Suggestions Handler
  const handleGenerateAISuggestions = async () => {
    const title = proposalForm.titulo.trim();
    const cat = proposalForm.tipo;
    if (!title) {
      alert("Por favor, digite um título de proposta antes de solicitar sugestões da IA.");
      return;
    }

    setGeneratingAI(true);
    setAiResult(null);
    try {
      const cabinetName = "Gabinete Digital";
      const result = await generateMayorProposalSuggestions(
        title,
        cat,
        cabinetName,
        proposalForm.justificativa || "Sem observações adicionais."
      );
      setAiResult(result);
      setProposalForm(prev => ({ ...prev, ai_suggestions: result }));
    } catch (e: any) {
      console.error(e);
      alert(e.message || "Não foi possível conectar com o Gemini API.");
    } finally {
      setGeneratingAI(false);
    }
  };

  // Save/Update Meeting
  const handleSaveMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.cabinetId) return;

    const dataPayload = {
      titulo: meetingForm.titulo.trim(),
      data_hora: meetingForm.data_hora,
      tipo: meetingForm.tipo,
      resumo_pauta: meetingForm.resumo_pauta.trim(),
      assessores_ids: meetingForm.assessores_ids,
      propostas_ids: meetingForm.propostas_ids,
      cabinetId: profile.cabinetId,
      usuario_id: user?.uid || profile.id || '',
      usuario_nome: profile.nome || 'Advisor',
      updated_at: serverTimestamp()
    };

    try {
      if (meetingForm.id) {
        // Edit
        await updateDoc(doc(db, 'reunioes_assessores', meetingForm.id), dataPayload);
        await logAction('Atualizar', 'reunioes_assessores', meetingForm.id, {
          next: { titulo: dataPayload.titulo },
          cabinetId: profile.cabinetId
        });
      } else {
        // Create
        const docRef = await addDoc(collection(db, 'reunioes_assessores'), {
          ...dataPayload,
          created_at: serverTimestamp()
        });
        await logAction('Criar', 'reunioes_assessores', docRef.id, {
          next: { titulo: dataPayload.titulo },
          cabinetId: profile.cabinetId
        });
      }
      setShowMeetingModal(false);
      resetMeetingForm();
    } catch (err) {
      console.error(err);
      alert("Erro ao gravar reunião. Por favor, tente novamente.");
    }
  };

  // Reset Form Helper
  const resetMeetingForm = () => {
    setMeetingForm({
      id: '',
      titulo: '',
      data_hora: '',
      tipo: 'Alinhamento Geral',
      resumo_pauta: '',
      assessores_ids: [],
      propostas_ids: []
    });
  };

  const handleEditMeeting = (m: Meeting) => {
    setMeetingForm({
      id: m.id,
      titulo: m.titulo,
      data_hora: m.data_hora,
      tipo: m.tipo,
      resumo_pauta: m.resumo_pauta || '',
      assessores_ids: m.assessores_ids || [],
      propostas_ids: m.propostas_ids || []
    });
    setShowMeetingModal(true);
  };

  const handleDeleteMeeting = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente excluir a pauta da reunião "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'reunioes_assessores', id));
      await logAction('Deletar', 'reunioes_assessores', id, {
        previous: { titulo: name },
        cabinetId: profile?.cabinetId
      });
    } catch (e) {
      console.error(e);
      alert("Erro ao remover reunião.");
    }
  };

  // Save/Update Mayor Proposal
  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.cabinetId) return;

    const dataPayload = {
      titulo: proposalForm.titulo.trim(),
      descricao_solucao: proposalForm.descricao_solucao.trim(),
      justificativa: proposalForm.justificativa.trim(),
      tipo: proposalForm.tipo,
      status: proposalForm.status,
      prioridade: proposalForm.prioridade,
      oficio_numero: proposalForm.oficio_numero.trim() || '',
      data_apresentacao: proposalForm.data_apresentacao || '',
      feedback_prefeito: proposalForm.feedback_prefeito.trim() || '',
      custo_estimado: proposalForm.custo_estimado,
      reuniao_id: proposalForm.reuniao_id || '',
      ai_suggestions: proposalForm.ai_suggestions || '',
      cabinetId: profile.cabinetId,
      usuario_id: user?.uid || profile.id || '',
      usuario_nome: profile.nome || 'Advisor',
      updated_at: serverTimestamp()
    };

    try {
      if (proposalForm.id) {
        // Edit
        await updateDoc(doc(db, 'propostas_prefeito', proposalForm.id), dataPayload);
        await logAction('Atualizar', 'propostas_prefeito', proposalForm.id, {
          next: { titulo: dataPayload.titulo },
          cabinetId: profile.cabinetId
        });
      } else {
        // Create
        const docRef = await addDoc(collection(db, 'propostas_prefeito'), {
          ...dataPayload,
          created_at: serverTimestamp()
        });
        await logAction('Criar', 'propostas_prefeito', docRef.id, {
          next: { titulo: dataPayload.titulo },
          cabinetId: profile.cabinetId
        });
      }
      setShowProposalModal(false);
      resetProposalForm();
    } catch (err) {
      console.error(err);
      alert("Erro ao gravar proposta. Por favor, tente novamente.");
    }
  };

  const resetProposalForm = () => {
    setProposalForm({
      id: '',
      titulo: '',
      descricao_solucao: '',
      justificativa: '',
      tipo: 'Infraestrutura',
      status: 'Em Elaboração',
      prioridade: 'Média',
      oficio_numero: '',
      data_apresentacao: '',
      feedback_prefeito: '',
      custo_estimado: 'Médio',
      reuniao_id: '',
      ai_suggestions: ''
    });
    setAiResult(null);
  };

  const handleEditProposal = (p: Proposal) => {
    setProposalForm({
      id: p.id,
      titulo: p.titulo,
      descricao_solucao: p.descricao_solucao || '',
      justificativa: p.justificativa || '',
      tipo: p.tipo,
      status: p.status,
      prioridade: p.prioridade,
      oficio_numero: p.oficio_numero || '',
      data_apresentacao: p.data_apresentacao || '',
      feedback_prefeito: p.feedback_prefeito || '',
      custo_estimado: p.custo_estimado || 'Médio',
      reuniao_id: p.reuniao_id || '',
      ai_suggestions: p.ai_suggestions || ''
    });
    setAiResult(p.ai_suggestions || null);
    setShowProposalModal(true);
  };

  const handleDeleteProposal = async (id: string, name: string) => {
    if (!window.confirm(`Deseja realmente remover esta proposta para o prefeito: "${name}"?`)) return;
    try {
      await deleteDoc(doc(db, 'propostas_prefeito', id));
      await logAction('Deletar', 'propostas_prefeito', id, {
        previous: { titulo: name },
        cabinetId: profile?.cabinetId
      });
      if (selectedProposal?.id === id) {
        setSelectedProposal(null);
      }
    } catch (e) {
      console.error(e);
      alert("Erro ao remover proposta.");
    }
  };

  // Get Advisor Name helper
  const getAdvisorName = (id: string) => {
    const matched = advisors.find((a) => a.id === id);
    return matched ? matched.nome : 'Ex-Assessor';
  };

  // Get Meeting Name helper
  const getMeetingTitle = (id: string) => {
    const matched = meetings.find((m) => m.id === id);
    return matched ? matched.titulo : 'Sem Reunião';
  };

  // Filtered Proposals list
  const filteredProposals = proposals.filter((p) => {
    const statusMatch = proposalStatusFilter === 'todos' || p.status === proposalStatusFilter;
    const categoryMatch = proposalCategoryFilter === 'todos' || p.tipo === proposalCategoryFilter;
    return statusMatch && categoryMatch;
  });

  // Gathers proposals marked as "Ready to Present" or "Presented" for meeting compilation
  const readyProposals = proposals.filter(p => p.status === 'Pronta para Encontro' || p.status === 'Apresentada ao Prefeito');

  // Export Mayor Meeting Briefing Document (PDF)
  const exportMayorDossierPDF = async () => {
    if (readyProposals.length === 0) {
      alert("Nenhuma proposta com status 'Pronta para Encontro' ou 'Apresentada ao Prefeito' disponível para montar o dossiê.");
      return;
    }

    try {
      const docPdf = new jsPDF();
      const currentCabinetName = "Gabinete Digital";
      const nowFormatted = format(new Date(), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });

      // Page Title block
      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(22);
      docPdf.setTextColor(15, 23, 42); // slate-900
      docPdf.text("DOSSIÊ DE SOLUÇÕES MUNICIPAIS", 14, 25);

      docPdf.setFont("helvetica", "normal");
      docPdf.setFontSize(10);
      docPdf.setTextColor(100);
      docPdf.text(`Gabinete Parlamentar: ${currentCabinetName}`, 14, 32);
      docPdf.text(`Documento gerado em: ${nowFormatted}`, 14, 37);
      docPdf.text("Destinatário: Excelentíssimo Senhor Prefeito Municipal", 14, 42);

      // Line
      docPdf.setDrawColor(226, 232, 240);
      docPdf.line(14, 46, 196, 46);

      // Description
      docPdf.setFont("helvetica", "italic");
      docPdf.setFontSize(10);
      docPdf.setTextColor(70);
      docPdf.text(
        "Este dossiê compila as soluções e propostas de melhorias urbanas e sociais estruturadas pelo",
        14,
        54
      );
      docPdf.text(
        "Gabinete de Assessoria Coletiva do Vereador, identificadas através de atendimentos populares e",
        14,
        59
      );
      docPdf.text(
        "reuniões de alinhamento estratégico, prontas para apresentação e despacho executivo.",
        14,
        64
      );

      // Stat cards on first page
      docPdf.setFillColor(248, 250, 252); // slate-50
      docPdf.rect(14, 72, 55, 24, "F");
      docPdf.rect(74, 72, 55, 24, "F");
      docPdf.rect(134, 72, 62, 24, "F");

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(16);
      docPdf.setTextColor(2, 132, 199); // light blue
      docPdf.text(`${readyProposals.length}`, 20, 81);
      docPdf.setFontSize(8);
      docPdf.setTextColor(100);
      docPdf.text("Propostas no Dossiê", 20, 89);

      docPdf.setFontSize(16);
      docPdf.setTextColor(16, 185, 129); // green
      const completedCount = readyProposals.filter(p => p.status === 'Resolvida').length;
      docPdf.text(`${completedCount}`, 80, 81);
      docPdf.setFontSize(8);
      docPdf.setTextColor(100);
      docPdf.text("Soluções Executando", 80, 89);

      // Categories Summary
      docPdf.setFontSize(16);
      docPdf.setTextColor(245, 158, 11); // amber
      const uniqueCats = new Set(readyProposals.map(p => p.tipo)).size;
      docPdf.text(`${uniqueCats}`, 140, 81);
      docPdf.setFontSize(8);
      docPdf.setTextColor(100);
      docPdf.text("Áreas de Atuação", 140, 89);

      docPdf.setFont("helvetica", "bold");
      docPdf.setFontSize(14);
      docPdf.setTextColor(15, 23, 42);
      docPdf.text("ÍNDICE DA PAUTA DE SOLUÇÕES", 14, 110);

      const tableRows = readyProposals.map((p, index) => [
        `${index + 1}`,
        p.titulo,
        p.tipo,
        p.prioridade,
        p.custo_estimado || 'N/A',
        p.oficio_numero ? `Ofício: ${p.oficio_numero}` : 'Sem Ofício'
      ]);

      (docPdf as any).autoTable({
        startY: 116,
        head: [['Ref', 'Título da Solução', 'Área Temática', 'Prioridade', 'Custo Est.', 'Expediente']],
        body: tableRows,
        theme: 'striped',
        headStyles: { fillColor: [15, 23, 42], fontSize: 9 },
        bodyStyles: { fontSize: 8.5 },
        columnStyles: {
          0: { cellWidth: 10 },
          1: { cellWidth: 65 },
          2: { cellWidth: 35 },
          3: { cellWidth: 20 },
          4: { cellWidth: 20 },
          5: { cellWidth: 32 }
        }
      });

      // Generation of detailed pages for each proposal
      for (let i = 0; i < readyProposals.length; i++) {
        const p = readyProposals[i];
        docPdf.addPage();
        
        // Header detail page
        docPdf.setFillColor(15, 23, 42); // deep slate background
        docPdf.rect(0, 0, 210, 30, 'F');
        
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(13);
        docPdf.setTextColor(255, 255, 255);
        docPdf.text(` PROPOSTA DE SOLUÇÃO Nº ${i + 1}`, 14, 13);
        
        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9);
        docPdf.setTextColor(203, 213, 225);
        docPdf.text(`Área: ${p.tipo}  |  Prioridade: ${p.prioridade}  |  Custo Estimado: ${p.custo_estimado || 'Médio'}`, 14, 21);

        let curY = 42;

        // Title
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(14);
        docPdf.setTextColor(15, 23, 42);
        
        // Wrap title
        const wrappedTitle = docPdf.splitTextToSize(p.titulo, 180);
        docPdf.text(wrappedTitle, 14, curY);
        curY += (wrappedTitle.length * 6) + 6;

        // Justification
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.setTextColor(51, 65, 85);
        docPdf.text("1. JUSTIFICATIVA E DIAGNÓSTICO DO PROBLEMA", 14, curY);
        curY += 6;

        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9.5);
        docPdf.setTextColor(71, 85, 105);
        const wrappedJust = docPdf.splitTextToSize(p.justificativa || "Diagnóstico baseado em demandas apresentadas pela comunidade ao gabinete de assessoria.", 182);
        docPdf.text(wrappedJust, 14, curY);
        curY += (wrappedJust.length * 5) + 10;

        // Solution description
        docPdf.setFont("helvetica", "bold");
        docPdf.setFontSize(11);
        docPdf.setTextColor(51, 65, 85);
        docPdf.text("2. DESCRIÇÃO DA SOLUÇÃO SOLICITADA À PREFEITURA", 14, curY);
        curY += 6;

        docPdf.setFont("helvetica", "normal");
        docPdf.setFontSize(9.5);
        docPdf.setTextColor(71, 85, 105);
        const wrappedSol = docPdf.splitTextToSize(p.descricao_solucao, 182);
        docPdf.text(wrappedSol, 14, curY);
        curY += (wrappedSol.length * 5) + 10;

        // Offical number / submission notes
        if (p.oficio_numero || p.feedback_prefeito) {
          docPdf.setFont("helvetica", "bold");
          docPdf.setFontSize(11);
          docPdf.setTextColor(51, 65, 85);
          docPdf.text("3. EXPEDIENTE / RETORNO DA PREFEITURA", 14, curY);
          curY += 6;

          docPdf.setFont("helvetica", "normal");
          docPdf.setFontSize(9.5);
          docPdf.setTextColor(71, 85, 105);
          
          let textNotes = '';
          if (p.oficio_numero) textNotes += `Documento legislativo protocolado sob nº ${p.oficio_numero}.\n`;
          if (p.feedback_prefeito) textNotes += `Apontamentos / feedback da prefeitura: ${p.feedback_prefeito}`;
          
          const wrappedNotes = docPdf.splitTextToSize(textNotes || 'Sem registro de expediente até o momento.', 182);
          docPdf.text(wrappedNotes, 14, curY);
          curY += (wrappedNotes.length * 5) + 12;
        }

        // Signature footer area
        if (curY < 230) {
          docPdf.setDrawColor(241, 245, 249);
          docPdf.line(14, 245, 196, 245);
          
          docPdf.setFont("helvetica", "italic");
          docPdf.setFontSize(8.5);
          docPdf.setTextColor(148, 163, 184);
          docPdf.text(`Encaminhamento de gabinete feito por vereador de ${currentCabinetName}`, 14, 252);
        }
      }

      docPdf.save(`Dossie_Pautas_Prefeito_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      await logAction('Relatorio', 'propostas_prefeito', 'relatorio_prefeito', {
        next: { tipo: 'Dossiê Executivo Prefeito', propostas_count: readyProposals.length },
        cabinetId: profile?.cabinetId
      });
    } catch (error) {
      console.error(error);
      alert("Erro ao gerar PDF.");
    }
  };

  return (
    <div className="space-y-8" id="reunioes-solutions-root">
      {/* Visual Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center text-2xl font-black border border-blue-500/20 shrink-0">
            🤝
          </div>
          <div>
            <h1 className="text-3xl font-bold text-white tracking-tight font-display">
              Reuniões & Soluções (Prefeitura)
            </h1>
            <p className="text-slate-400 text-sm">
              Alinhamento com assessores, triagem de sugestões e elaboração de soluções para levar ao Prefeito.
            </p>
          </div>
        </div>
        
        {/* Navigation buttons inside header */}
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveSubTab('reunioes')}
            id="tab-btn-reunioes"
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer border",
              activeSubTab === 'reunioes'
                ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                : "bg-slate-800 hover:bg-slate-750 border-slate-700/50 text-slate-300 hover:text-white"
            )}
          >
            <Users size={14} /> Reuniões Assessores
          </button>
          <button
            onClick={() => setActiveSubTab('propostas')}
            id="tab-btn-propostas"
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer border",
              activeSubTab === 'propostas'
                ? "bg-blue-600 border-blue-500 text-white shadow-lg"
                : "bg-slate-800 hover:bg-slate-750 border-slate-700/50 text-slate-300 hover:text-white"
            )}
          >
            <Briefcase size={14} /> Soluções para Prefeito
          </button>
          <button
            onClick={() => setActiveSubTab('kit')}
            id="tab-btn-kit"
            className={cn(
              "px-4 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all inline-flex items-center gap-2 cursor-pointer border",
              activeSubTab === 'kit'
                ? "bg-emerald-600 border-emerald-500 text-white shadow-lg"
                : "bg-slate-800 hover:bg-slate-750 border-slate-700/50 text-slate-300 hover:text-white"
            )}
          >
            <Building2 size={14} /> 🏛️ Kit Audiência Prefeito
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="space-y-6">
        
        {/* TAB 1: REUNIOES AVALIATIVAS COM ASSESSORES */}
        {activeSubTab === 'reunioes' && (
          <div className="space-y-6" id="view-reunioes-assessores">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Atas e Alinhamentos</h2>
                <p className="text-xs text-slate-500">Pautas levantadas internamente com o corpo de assessores.</p>
              </div>
              
              <button
                onClick={() => {
                  resetMeetingForm();
                  setShowMeetingModal(true);
                }}
                id="btn-new-meeting"
                className="bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-5 py-3 font-bold text-xs tracking-wider uppercase inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer"
              >
                <Plus size={16} /> Agendar Nova Reunião
              </button>
            </div>

            {loading ? (
              <div className="text-center py-20">
                <Clock size={40} className="text-blue-500 animate-spin mx-auto mb-4" />
                <p className="text-slate-400">Carregando atas de discussões...</p>
              </div>
            ) : meetings.length === 0 ? (
              <div className="bg-slate-900/40 border border-slate-800/80 rounded-3xl p-12 text-center max-w-lg mx-auto space-y-4">
                <div className="w-16 h-16 bg-slate-800/60 rounded-full flex items-center justify-center mx-auto text-slate-500">
                  <Users size={30} />
                </div>
                <h3 className="text-white font-bold text-lg">Sem reuniões registradas</h3>
                <p className="text-slate-400 text-sm">
                  Comece a planejar suas pautas e direcionar as metas com seus assessores de gabinete municipal.
                </p>
                <button
                  onClick={() => setShowMeetingModal(true)}
                  className="px-4 py-2 text-xs font-bold text-blue-400 border border-blue-500/20 hover:border-blue-500/40 bg-blue-500/5 hover:bg-blue-500/10 rounded-xl transition-all cursor-pointer"
                >
                  Registar Primeira Reunião
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4" id="meetings-list">
                {meetings.map((m) => {
                  const isExpanded = expandedMeetingId === m.id;
                  const meetingDate = m.data_hora ? new Date(m.data_hora) : null;
                  
                  return (
                    <div 
                      key={m.id}
                      id={`meeting-card-${m.id}`}
                      className="bg-slate-900/60 border border-slate-800/80 rounded-3xl p-6 hover:border-slate-700/60 transition-all shadow-md relative overflow-hidden"
                    >
                      <div className="flex flex-wrap md:flex-nowrap items-start justify-between gap-4">
                        <div className="space-y-2">
                          <div className="flex flex-wrap items-center gap-2.5">
                            <span className={cn(
                              "text-[9px] uppercase tracking-wider font-bold px-2 py-0.5 rounded-full border",
                              m.tipo === 'Urgente' ? "bg-rose-500/10 text-rose-400 border-rose-500/20" :
                              m.tipo === 'Demandas do Prefeito' ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" :
                              m.tipo === 'Planejamento Estratégico' ? "bg-indigo-500/10 text-indigo-400 border-indigo-500/20" :
                              "bg-slate-800 text-slate-300 border-slate-700"
                            )}>
                              {m.tipo}
                            </span>
                            <span className="text-[10px] text-slate-500 font-mono flex items-center gap-1">
                              <Calendar size={11} />
                              {meetingDate ? format(meetingDate, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'Pendente'}
                            </span>
                          </div>
                          
                          <h3 className="text-lg font-bold text-white tracking-tight">{m.titulo}</h3>
                        </div>

                        {/* Action Tools */}
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => setExpandedMeetingId(isExpanded ? null : m.id)}
                            className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-2 rounded-lg transition-all cursor-pointer"
                            title="Expandir/Recolher Ata"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                          <button
                            onClick={() => handleEditMeeting(m)}
                            className="bg-slate-800 hover:bg-slate-700 text-blue-400 hover:text-blue-300 p-2 rounded-lg transition-all cursor-pointer"
                            title="Editar Atividades"
                          >
                            ⚖️ Editar
                          </button>
                          <button
                            onClick={() => handleDeleteMeeting(m.id, m.titulo)}
                            className="bg-slate-800 hover:bg-slate-700 text-rose-400 p-2 rounded-lg transition-all cursor-pointer"
                            title="Excluir"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>

                      {/* Brief info */}
                      <p className="text-slate-400 text-sm mt-3 line-clamp-2">
                        {m.resumo_pauta || 'Nenhum resumo adicionado.'}
                      </p>

                      {/* Attendence list badge */}
                      <div className="flex flex-wrap items-center gap-2 mt-4 text-xs text-slate-500">
                        <Users size={12} className="text-slate-400" />
                        <span className="font-semibold text-slate-400">Assessores presentes:</span>
                        {m.assessores_ids && m.assessores_ids.length > 0 ? (
                          m.assessores_ids.map(id => (
                            <span key={id} className="bg-slate-800/80 px-2 py-0.5 rounded text-[10px] text-slate-300">
                              {getAdvisorName(id)}
                            </span>
                          ))
                        ) : (
                          <span className="text-slate-600">Somente o vereador</span>
                        )}
                      </div>

                      {/* Expanded Ata Section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div 
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-6 pt-6 border-t border-slate-805/80 space-y-4 text-slate-300"
                          >
                            <div className="space-y-1">
                              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                <ListOrdered size={12} /> Resumo e Decisões
                              </h4>
                              <p className="text-sm bg-slate-950/40 p-4 rounded-2xl whitespace-pre-wrap leading-relaxed border border-slate-800/50">
                                {m.resumo_pauta || 'Sem atas detalhadas registradas.'}
                              </p>
                            </div>

                            {/* Linked Mayor Proposals */}
                            {m.propostas_ids && m.propostas_ids.length > 0 && (
                              <div className="space-y-2">
                                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                  🏛️ Soluções geradas para levar ao Prefeito:
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {m.propostas_ids.map(pid => {
                                    const linkedProp = proposals.find(pr => pr.id === pid);
                                    if (!linkedProp) return null;
                                    return (
                                      <div 
                                        key={pid}
                                        onClick={() => {
                                          setSelectedProposal(linkedProp);
                                          setActiveSubTab('propostas');
                                        }}
                                        className="bg-slate-900 border border-slate-800 hover:border-blue-500/30 p-3 rounded-2xl flex items-center justify-between cursor-pointer transition-all"
                                      >
                                        <div className="space-y-1">
                                          <p className="text-xs text-white font-semibold truncate leading-none">
                                            {linkedProp.titulo}
                                          </p>
                                          <p className="text-[10px] text-slate-500 font-medium">
                                            {linkedProp.tipo} • Est. Custo: <span className="font-semibold text-slate-400">{linkedProp.custo_estimado || 'Médio'}</span>
                                          </p>
                                        </div>
                                        <ArrowRight size={14} className="text-slate-500 shrink-0 ml-2" />
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            )}

                            <div className="text-[10px] text-slate-600 text-right">
                              Registrado por {m.usuario_nome}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PROPOSTAS E MELHORIAS PARA LEVAR AO PREFEITO */}
        {activeSubTab === 'propostas' && (
          <div className="space-y-6" id="view-propostas-prefeito">
            
            {/* Upper Action Bar */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-white">Banco de Soluções Municipais</h2>
                <p className="text-xs text-slate-500">
                  Melhorias estruturadas pelo gabinete para articular aprovações com o Prefeito.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  onClick={() => {
                    resetProposalForm();
                    setShowProposalModal(true);
                  }}
                  id="btn-new-proposal"
                  className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl px-5 py-3 font-bold text-xs tracking-wider uppercase inline-flex items-center gap-2 shadow-lg transition-all cursor-pointer"
                >
                  <Plus size={16} /> Cadastrar Solução
                </button>
              </div>
            </div>

            {/* Quick Filters */}
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-2xl p-4 flex flex-wrap gap-4 items-center">
              <div className="flex items-center gap-2 text-xs text-slate-400 font-bold uppercase shrink-0">
                <SlidersHorizontal size={14} /> Filtrar Pautas:
              </div>
              
              <div className="flex flex-wrap gap-3 flex-1">
                {/* Status Filter */}
                <select 
                  value={proposalStatusFilter}
                  onChange={(e) => setProposalStatusFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-300 font-bold rounded-xl px-3 py-2 focus:ring-1 focus:ring-blue-500/30 cursor-pointer"
                >
                  <option value="todos">Todos os Status</option>
                  {proposalStatuses.map(s => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>

                {/* Category Filter */}
                <select 
                  value={proposalCategoryFilter}
                  onChange={(e) => setProposalCategoryFilter(e.target.value)}
                  className="bg-slate-900 border border-slate-800 text-xs text-slate-300 font-bold rounded-xl px-3 py-2 focus:ring-1 focus:ring-blue-500/30 cursor-pointer"
                >
                  <option value="todos">Todas as Áreas</option>
                  {proposalCategories.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>

                {(proposalStatusFilter !== 'todos' || proposalCategoryFilter !== 'todos') && (
                  <button
                    onClick={() => {
                      setProposalStatusFilter('todos');
                      setProposalCategoryFilter('todos');
                    }}
                    className="text-xs text-rose-400 hover:text-rose-300 font-bold uppercase transition-all"
                  >
                    Linpar Filtros
                  </button>
                )}
              </div>
            </div>

            {/* Grid Layout of Proposals with detailed sidepanel */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              
              {/* Left Column: List of items */}
              <div className="lg:col-span-7 space-y-4">
                {filteredProposals.length === 0 ? (
                  <div className="bg-slate-900/20 border border-slate-800/60 rounded-3xl p-12 text-center space-y-4">
                    <div className="w-14 h-14 bg-slate-800/60 rounded-full flex items-center justify-center mx-auto text-slate-600">
                      <Briefcase size={24} />
                    </div>
                    <p className="text-slate-400 text-sm">Nenhuma proposta encontrada com os filtros selecionados.</p>
                  </div>
                ) : (
                  filteredProposals.map((p) => {
                    const isSelected = selectedProposal?.id === p.id;
                    const statusConfig = proposalStatuses.find(s => s.value === p.status);
                    
                    return (
                      <div
                        key={p.id}
                        id={`proposal-item-${p.id}`}
                        onClick={() => setSelectedProposal(p)}
                        className={cn(
                          "bg-slate-900/60 border rounded-3xl p-5 cursor-pointer text-left transition-all relative overflow-hidden",
                          isSelected
                            ? "border-blue-500 bg-slate-900 shadow-xl shadow-blue-500/5 ring-1 ring-blue-500/20"
                            : "border-slate-800/80 hover:border-slate-700/60 hover:bg-slate-900/40"
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700">
                                {p.tipo}
                              </span>
                              <span className={cn(
                                "text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border",
                                statusConfig ? statusConfig.color : "bg-slate-800 text-slate-300"
                              )}>
                                {p.status}
                              </span>
                              <span className={cn(
                                "text-[9px] font-bold py-0.5 px-1.5 rounded",
                                p.prioridade === 'Alta' ? 'text-rose-400 bg-rose-500/5' :
                                p.prioridade === 'Média' ? 'text-amber-400 bg-amber-500/5' :
                                'text-blue-400 bg-blue-500/5'
                              )}>
                                Prioridade {p.prioridade}
                              </span>
                            </div>

                            <h3 className="text-base font-bold text-white tracking-tight truncate">
                              {p.titulo}
                            </h3>
                            <p className="text-xs text-slate-400 line-clamp-1 leading-relaxed">
                              {p.descricao_solucao}
                            </p>
                          </div>

                          <ArrowRight 
                            size={16} 
                            className={cn(
                              "text-slate-600 transition-all shrink-0 self-center",
                              isSelected ? "text-blue-400 translate-x-1" : "group-hover:translate-x-1"
                            )} 
                          />
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Right Column: Deep Details Sidepanel */}
              <div className="lg:col-span-5">
                {selectedProposal ? (
                  <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-2xl space-y-6 sticky top-6">
                    <div className="flex items-start justify-between gap-3 border-b border-slate-800 pb-4">
                      <div>
                        <span className="text-[10px] text-blue-400 font-bold uppercase tracking-wider">
                          {selectedProposal.tipo}
                        </span>
                        <h3 className="text-xl font-bold text-white leading-tight mt-1">{selectedProposal.titulo}</h3>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          onClick={() => handleEditProposal(selectedProposal)}
                          className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs px-2.5 py-1.5 rounded-lg border border-slate-700 font-semibold cursor-pointer"
                        >
                          ⚖️ Editar
                        </button>
                        <button
                          onClick={() => handleDeleteProposal(selectedProposal.id, selectedProposal.titulo)}
                          className="bg-slate-800 hover:bg-slate-750 text-rose-400 hover:bg-rose-500/10 p-1.5 rounded-lg border border-slate-700 cursor-pointer"
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                    </div>

                    {/* Proposal Details Body */}
                    <div className="space-y-4 text-sm text-slate-300">
                      
                      <div className="grid grid-cols-2 gap-4 bg-slate-950/40 p-4 rounded-2xl border border-slate-850/50">
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Status Prefeito</p>
                          <p className="text-xs font-semibold text-white mt-0.5">{selectedProposal.status}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Custo Estimado</p>
                          <p className="text-xs font-semibold text-white mt-0.5">{selectedProposal.custo_estimado || 'Médio'}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Nº do Ofício</p>
                          <p className="text-xs font-semibold text-slate-200 mt-0.5">
                            {selectedProposal.oficio_numero ? `Ofício nº ${selectedProposal.oficio_numero}` : 'Não formalizado'}
                          </p>
                        </div>
                        <div>
                          <p className="text-[10px] font-bold uppercase text-slate-500">Data Apresentação</p>
                          <p className="text-xs font-semibold text-slate-200 mt-0.5">
                            {selectedProposal.data_apresentacao ? format(new Date(selectedProposal.data_apresentacao + 'T00:00:00'), 'dd/MM/yyyy') : 'Sem data registrada'}
                          </p>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Justificativa Social:</h4>
                        <p className="bg-slate-950/20 p-3 rounded-xl border border-slate-900 border-dashed text-xs text-slate-400 leading-relaxed max-h-32 overflow-y-auto">
                          {selectedProposal.justificativa || 'Nenhuma justificativa formal adicionada ainda.'}
                        </p>
                      </div>

                      <div className="space-y-1">
                        <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">Descrição dos Despachos Solicitados:</h4>
                        <p className="bg-slate-950/20 p-3 rounded-xl border border-slate-900 border-dashed text-xs text-slate-300 font-medium leading-relaxed max-h-40 overflow-y-auto">
                          {selectedProposal.descricao_solucao}
                        </p>
                      </div>

                      {/* Mayor response notes */}
                      {selectedProposal.feedback_prefeito && (
                        <div className="space-y-1 p-3 bg-blue-500/5 hover:bg-blue-500/10 border border-blue-500/20 text-blue-300 rounded-2xl transition-all">
                          <h4 className="text-xs font-bold uppercase tracking-wider flex items-center gap-1">
                            💬 Retorno do Prefeito / Prefeitura:
                          </h4>
                          <p className="text-xs leading-relaxed font-semibold">
                            {selectedProposal.feedback_prefeito}
                          </p>
                        </div>
                      )}

                      {/* AI recommendations Tab */}
                      {selectedProposal.ai_suggestions && (
                        <div className="space-y-2 p-4 bg-emerald-950/30 border border-emerald-500/20 rounded-2xl">
                          <h4 className="text-xs font-extrabold text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles size={13} /> Argumentação AI (Gemini) Ativa:
                          </h4>
                          <div className="text-[11px] text-emerald-200 bg-slate-950/50 p-3 rounded-xl border border-emerald-950 max-h-48 overflow-y-auto whitespace-pre-wrap font-mono select-all">
                            {selectedProposal.ai_suggestions}
                          </div>
                        </div>
                      )}

                      {selectedProposal.reuniao_id && (
                        <div className="text-[10px] text-slate-500 italic mt-2">
                          Originada na reunião: "{getMeetingTitle(selectedProposal.reuniao_id)}"
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-900/30 border border-slate-800/80 rounded-3xl p-12 text-center text-slate-500 pointer-events-none sticky top-6">
                    <HelpCircle size={32} className="mx-auto mb-3 text-slate-600" />
                    <p className="text-xs font-bold uppercase tracking-widest">Nenhuma Proposta Selecionada</p>
                    <p className="text-xs text-slate-500 mt-1">Selecione uma pauta à esquerda para detalhar justificativas, ofícios e retornos do prefeito municipal.</p>
                  </div>
                )}
              </div>

            </div>

          </div>
        )}

        {/* TAB 3: AUDIENCE MATRICES / mayor BRIEFING KIT */}
        {activeSubTab === 'kit' && (
          <div className="space-y-6" id="view-audiencia-prefeito">
            
            <div className="max-w-4xl mx-auto space-y-6">
              
              <div className="bg-slate-900 border border-slate-800/80 rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-xl font-bold">
                    🏛️
                  </div>
                  <div className="space-y-1">
                    <h3 className="text-lg font-bold text-white">Kit de Audiência Governamental</h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Gerencie as soluções maduras e prontas do gabinete para o encontro de articulação com o Prefeito.
                      As propostas consolidadas como <span className="text-emerald-400 font-semibold">Pronta para Encontro</span> serão anexadas ao dossiê oficial impresso.
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-800">
                  <div className="text-xs text-slate-400 font-semibold">
                    Total de Soluções Pré-Selecionadas: <span className="text-white font-extrabold">{readyProposals.length} propostas</span>
                  </div>
                  
                  <button
                    onClick={exportMayorDossierPDF}
                    disabled={readyProposals.length === 0}
                    id="btn-export-dossier"
                    className="px-5 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 hover:text-white border-none font-bold text-xs uppercase tracking-wider text-white shadow-lg transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-2"
                  >
                    <FileDown size={14} /> Exportar Dossiê Legislativo (PDF)
                  </button>
                </div>
              </div>

              {/* Ready Proposals Details Cards for Briefing Layout */}
              {readyProposals.length === 0 ? (
                <div className="bg-slate-900/20 border border-slate-800/60 rounded-3xl p-16 text-center space-y-4">
                  <div className="w-16 h-16 bg-slate-900/60 rounded-full flex items-center justify-center mx-auto text-slate-500">
                    🏛️
                  </div>
                  <h4 className="text-white font-bold text-base">Prontas para levar ao Prefeito?</h4>
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Nenhuma proposta no banco de soluções está selecionada no status de trâmite <strong>"Pronta para Encontro"</strong> ou <strong>"Apresentada ao Prefeito"</strong>.
                  </p>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Atualize a etapa de desenvolvimento de suas propostas de melhorias em "Soluções" para torná-las visíveis neste painel.
                  </p>
                </div>
              ) : (
                <div className="space-y-4" id="mayor-dossier-index">
                  <h3 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Painel Técnico de despacho presencial</h3>
                  
                  {readyProposals.map((p, index) => (
                    <div 
                      key={p.id}
                      className="bg-slate-900/60 border border-slate-800/80 rounded-2xl p-6 hover:border-slate-800/100 transition-all space-y-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1">
                          <span className="text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Pauta #{index + 1}
                          </span>
                          <h3 className="text-base font-bold text-white tracking-tight mt-1">{p.titulo}</h3>
                          <p className="text-xs text-slate-500 font-medium">Área Temática: <span className="text-slate-300 font-semibold">{p.tipo}</span>  |  Custo Estimado: <span className="text-slate-300 font-semibold">{p.custo_estimado || 'Intermediário'}</span></p>
                        </div>
                        
                        <div className="text-xs bg-slate-950 border border-slate-800 py-1.5 px-3 rounded-xl select-all font-mono">
                          {p.oficio_numero ? `Ofício: ${p.oficio_numero}` : `Expediente: Não registrado`}
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Justificativa Populacional:</span>
                          <p className="bg-slate-950/40 p-3 rounded-xl border border-slate-900 text-slate-400 leading-relaxed font-serif">
                            "{p.justificativa}"
                          </p>
                        </div>

                        <div className="space-y-1">
                          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block">Solução Projetada:</span>
                          <p className="bg-slate-950/40 p-3 rounded-xl border border-slate-900 text-slate-300 leading-relaxed font-semibold">
                            {p.descricao_solucao}
                          </p>
                        </div>
                      </div>

                      {/* AI reasoning ready list */}
                      {p.ai_suggestions && (
                        <div className="bg-slate-950/60 p-4 rounded-xl border border-emerald-500/10">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1">
                            <Sparkles size={11} /> Argumentação de Legislação e Impacto da IA:
                          </span>
                          <p className="text-[11px] text-emerald-300/80 leading-relaxed whitespace-pre-wrap font-mono mt-1 blur-[0.2px] hover:blur-none transition-all">
                            {p.ai_suggestions}
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

            </div>

          </div>
        )}

      </div>

      {/* MEETING MODAL (AGENDAR/EDITAR REUNIÃO) */}
      <AnimatePresence>
        {showMeetingModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800/85 rounded-3xl max-w-lg w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {meetingForm.id ? "Editar Registro de Reunião" : "Agendar/Registrar Reunião"}
                  </h3>
                  <p className="text-xs text-slate-400">Assembleias de pautas parlamentares do Gabinete.</p>
                </div>
                <button
                  onClick={() => setShowMeetingModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveMeeting} className="space-y-4 pt-4 text-xs text-slate-200">
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Título da Reunião</label>
                  <input
                    required
                    type="text"
                    value={meetingForm.titulo}
                    onChange={(e) => setMeetingForm({ ...meetingForm, titulo: e.target.value })}
                    placeholder="Ex: Alinhamento de Obras Públicas"
                    className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 text-white"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Data e Hora</label>
                    <input
                      required
                      type="datetime-local"
                      value={meetingForm.data_hora}
                      onChange={(e) => setMeetingForm({ ...meetingForm, data_hora: e.target.value })}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Tipo de Encontro</label>
                    <select
                      value={meetingForm.tipo}
                      onChange={(e) => setMeetingForm({ ...meetingForm, tipo: e.target.value as any })}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white cursor-pointer"
                    >
                      <option value="Alinhamento Geral">Alinhamento Geral</option>
                      <option value="Planejamento Estratégico">Planejamento Estratégico</option>
                      <option value="Demandas do Prefeito">Análise de Demandas p/ Prefeito</option>
                      <option value="Urgente">Urgente</option>
                    </select>
                  </div>
                </div>

                {/* Staff Attendees Checkboxes */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Assessores que Participaram:</label>
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 max-h-32 overflow-y-auto space-y-1.5">
                    {advisors.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic text-center p-2">Nenhum assessor ativo encontrado no sistema.</p>
                    ) : (
                      advisors.map(adv => {
                        const isChecked = meetingForm.assessores_ids.includes(adv.id);
                        return (
                          <label key={adv.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-300 hover:text-white select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setMeetingForm(prev => ({
                                    ...prev,
                                    assessores_ids: prev.assessores_ids.filter(id => id !== adv.id)
                                  }));
                                } else {
                                  setMeetingForm(prev => ({
                                    ...prev,
                                    assessores_ids: [...prev.assessores_ids, adv.id]
                                  }));
                                }
                              }}
                              className="accent-blue-500 rounded cursor-pointer"
                            />
                            {adv.nome} <span className="text-[9px] text-slate-500">({adv.role === 'vereador' ? 'Vereador' : 'Assessor'})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* Linked Proposals selection */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Soluções Discutidas / Associadas:</label>
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800/60 max-h-32 overflow-y-auto space-y-1.5">
                    {proposals.length === 0 ? (
                      <p className="text-[10px] text-slate-500 italic text-center p-2">Sem propostas para vincular. Crie-as na seção correspondente.</p>
                    ) : (
                      proposals.map(prop => {
                        const isChecked = meetingForm.propostas_ids.includes(prop.id);
                        return (
                          <label key={prop.id} className="flex items-center gap-2 cursor-pointer font-medium text-slate-300 hover:text-white select-none">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setMeetingForm(prev => ({
                                    ...prev,
                                    propostas_ids: prev.propostas_ids.filter(id => id !== prop.id)
                                  }));
                                } else {
                                  setMeetingForm(prev => ({
                                    ...prev,
                                    propostas_ids: [...prev.propostas_ids, prop.id]
                                  }));
                                }
                              }}
                              className="accent-blue-500 rounded cursor-pointer"
                            />
                            <span className="truncate max-w-[350px]">{prop.titulo} ({prop.tipo})</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Pauta da Discussão / Ata de Reunião</label>
                  <textarea
                    required
                    rows={4}
                    value={meetingForm.resumo_pauta}
                    onChange={(e) => setMeetingForm({ ...meetingForm, resumo_pauta: e.target.value })}
                    placeholder="Quais foram as decisões estratégicas definidas? Quais problemas do prefeito debateram?"
                    className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 text-white resize-none"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowMeetingModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 font-bold uppercase hover:text-white rounded-xl cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 font-bold uppercase tracking-wider text-white shadow-lg rounded-xl transition-all cursor-pointer"
                  >
                    Gravar Reunião
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* PROPOSAL MODAL (CADASTRAR/EDITAR PROPOSTA PARA O PREFEITO) */}
      <AnimatePresence>
        {showProposalModal && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-slate-900 border border-slate-800/85 rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto shadow-2xl p-6"
            >
              <div className="flex justify-between items-start border-b border-slate-800 pb-4">
                <div>
                  <h3 className="text-xl font-bold text-white">
                    {proposalForm.id ? "Editar Solução Executiva" : "Registrar Novo Projeto/Solução"}
                  </h3>
                  <p className="text-xs text-slate-400">Articule e estruture pautas formais de melhorias municipais.</p>
                </div>
                <button
                  onClick={() => setShowProposalModal(false)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white p-1 rounded-lg cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveProposal} className="space-y-4 pt-4 text-xs text-slate-200">
                
                {/* Title and Category */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Título da Solução/Proposta</label>
                    <input
                      required
                      type="text"
                      value={proposalForm.titulo}
                      onChange={(e) => setProposalForm({ ...proposalForm, titulo: e.target.value })}
                      placeholder="Ex: Calçamento e saneamento no Bairro X"
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 text-white"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Área Temática / Categoria</label>
                    <select
                      value={proposalForm.tipo}
                      onChange={(e) => setProposalForm({ ...proposalForm, tipo: e.target.value })}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white cursor-pointer"
                    >
                      {proposalCategories.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Justificativa (Original context / problem description) */}
                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      DIAGNÓSTICO DO PROBLEMA / JUSTIFICATIVA POPULAR
                    </label>
                    
                    {/* TRIGGER IA SUGGESTIONS */}
                    <button
                      type="button"
                      onClick={handleGenerateAISuggestions}
                      disabled={generatingAI || !proposalForm.titulo}
                      className="text-[10px] bg-gradient-to-r from-blue-600/30 to-emerald-600/30 border border-emerald-500/20 text-emerald-300 px-3 py-1.5 rounded-lg font-bold uppercase hover:bg-gradient-to-r hover:from-blue-600/50 hover:to-emerald-600/50 hover:text-white transition-all duration-300 flex items-center gap-1.5 cursor-pointer md:self-end disabled:opacity-40"
                    >
                      {generatingAI ? "⚙️ Processando..." : <><Sparkles size={11} /> Solicitar Sugestões de IA (Gemini)</>}
                    </button>
                  </div>
                  
                  <textarea
                    required
                    rows={2}
                    value={proposalForm.justificativa}
                    onChange={(e) => setProposalForm({ ...proposalForm, justificativa: e.target.value })}
                    placeholder="Qual a reclamação dos moradores? Onde fica o local e por que isso é crucial?"
                    className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white placeholder:text-slate-500 resize-none"
                  />
                </div>

                {/* AI Suggestions View block inside Modal Form */}
                {aiResult && (
                  <div className="border border-emerald-500/30 bg-emerald-950/20 p-4 rounded-2xl space-y-2">
                    <div className="flex justify-between items-center text-emerald-400 font-bold uppercase tracking-wider text-[10px]">
                      <span className="flex items-center gap-1"><Sparkles size={12} /> Proposta Estruturada via IA</span>
                      <button 
                        type="button" 
                        onClick={() => {
                          setProposalForm(prev => ({ 
                            ...prev, 
                            descricao_solucao: prev.descricao_solucao 
                              ? prev.descricao_solucao + "\n\n" + aiResult 
                              : aiResult 
                          }));
                          alert("Argumentação de IA incorporada ao campo 'Descrição'!");
                        }}
                        className="text-[9px] bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-200 border border-emerald-500/30 py-0.5 px-2 rounded-md tracking-normal font-bold transition-all cursor-pointer"
                      >
                        📥 Adotar Argumento IA na Descrição
                      </button>
                    </div>
                    <div className="bg-slate-950/70 p-3 rounded-xl text-[10px] max-h-36 overflow-y-auto text-slate-300 font-mono select-all whitespace-pre-wrap">
                      {aiResult}
                    </div>
                  </div>
                )}

                {/* Descrição Solução (Detailed requests for Mayor) */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">SOLUÇÃO E DESPACHO REQUERIDOS (O QUE PEDIR AO PREFEITO?)</label>
                  <textarea
                    required
                    rows={4}
                    value={proposalForm.descricao_solucao}
                    onChange={(e) => setProposalForm({ ...proposalForm, descricao_solucao: e.target.value })}
                    placeholder="Descreva detalhadamente a melhoria. Ex: Realização de pavimentação asfáltica de 1500 metros na rua principal e implantação de rede de drenagem de esgotos."
                    className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white placeholder:text-slate-500 resize-none"
                  />
                </div>

                {/* Status, Prioridade & Estimated Budget */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Etapa do Processo</label>
                    <select
                      value={proposalForm.status}
                      onChange={(e) => setProposalForm({ ...proposalForm, status: e.target.value as any })}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white cursor-pointer font-semibold"
                    >
                      {proposalStatuses.map(s => (
                        <option key={s.value} value={s.value}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Prioridade</label>
                    <select
                      value={proposalForm.prioridade}
                      onChange={(e) => setProposalForm({ ...proposalForm, prioridade: e.target.value as any })}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white cursor-pointer font-semibold"
                    >
                      <option value="Baixa">Baixa</option>
                      <option value="Média">Média</option>
                      <option value="Alta">Alta</option>
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Complexidade / Orçamento</label>
                    <select
                      value={proposalForm.custo_estimado}
                      onChange={(e) => setProposalForm({ ...proposalForm, custo_estimado: e.target.value as any })}
                      className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-1 focus:ring-blue-500 text-white cursor-pointer font-semibold"
                    >
                      <option value="Baixo">Baixo (Custo Baixo)</option>
                      <option value="Médio">Médio (Aprovação Intermediária)</option>
                      <option value="Alto">Alto (Grande Investimento)</option>
                    </select>
                  </div>
                </div>

                {/* Oficio legislative reference and feedback from government office */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-slate-810 pt-4 bg-slate-950/20 p-4 rounded-2xl border border-slate-800/40">
                  <div className="space-y-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Número do Expediente / Ofício</label>
                      <input
                        type="text"
                        value={proposalForm.oficio_numero}
                        onChange={(e) => setProposalForm({ ...proposalForm, oficio_numero: e.target.value })}
                        placeholder="Ex: Ofício 42/2026-GP"
                        className="w-full bg-slate-800 border-none rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 placeholder:text-slate-500 text-white"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Data Apresentação ao Prefeito</label>
                      <input
                        type="date"
                        value={proposalForm.data_apresentacao}
                        onChange={(e) => setProposalForm({ ...proposalForm, data_apresentacao: e.target.value })}
                        className="w-full bg-slate-800 border-none rounded-xl p-2.5 col-span-1 border-slate-800 text-white [color-scheme:dark]"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Considerações / Despacho do Prefeito</label>
                    <textarea
                      rows={4}
                      value={proposalForm.feedback_prefeito}
                      onChange={(e) => setProposalForm({ ...proposalForm, feedback_prefeito: e.target.value })}
                      placeholder="Registrar o que o Prefeito respondeu, prazos acordados, ou motivos de rejeições."
                      className="w-full bg-slate-800 border-none rounded-xl p-2.5 focus:ring-1 focus:ring-blue-500 text-white placeholder:text-slate-500 resize-none h-full min-h-[105px]"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-3 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setShowProposalModal(false)}
                    className="px-4 py-2 bg-slate-800 hover:bg-slate-750 text-slate-400 font-bold uppercase hover:text-white rounded-xl cursor-pointer"
                  >
                    Fechar
                  </button>
                  <button
                    type="submit"
                    className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-500 font-bold uppercase tracking-wider text-white shadow-lg rounded-xl transition-all cursor-pointer"
                  >
                    Gravar Solução
                  </button>
                </div>

              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

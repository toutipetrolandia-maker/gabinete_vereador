import React, { useState } from 'react';
import { 
  BookOpen, 
  PlayCircle, 
  FileText, 
  Users, 
  Stethoscope, 
  Package, 
  ShoppingBag, 
  MessageSquare,
  ChevronRight,
  Lightbulb,
  CheckCircle2,
  ExternalLink,
  HelpCircle,
  Video,
  Monitor,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export default function Training({ isEmbed = false }: { isEmbed?: boolean }) {
  const [activeCategory, setActiveCategory] = useState<'guides' | 'videos' | 'faq'>('guides');

  const modules = [
    {
      title: 'Atendimentos Gerais',
      icon: Users,
      color: 'text-blue-500',
      bg: 'bg-blue-500/10',
      description: 'Como registrar e gerenciar o fluxo de cidadãos no gabinete.',
      topics: [
        'Cadastro de novo cidadão',
        'Busca por CPF/Nome',
        'Histórico de pedidos',
        'Exportação de relatórios'
      ]
    },
    {
      title: 'Atendimento Médico',
      icon: Stethoscope,
      color: 'text-emerald-500',
      bg: 'bg-emerald-500/10',
      description: 'Gestão de encaminhamentos de saúde e exames.',
      topics: [
        'Solicitação de exames',
        'Controle de óculos/lentes',
        'Pesquisa de satisfação',
        'Encaminhamento via Malote'
      ]
    },
    {
      title: 'Malotes e Protocolos',
      icon: Package,
      color: 'text-amber-500',
      bg: 'bg-amber-500/10',
      description: 'Documentação e rastreio de envios para secretarias.',
      topics: [
        'Geração de protocolo impresso',
        'Anexar atendimentos médicos',
        'Status de entrega',
        'Organização por secretaria'
      ]
    },
    {
      title: 'Auxílio Social',
      icon: ShoppingBag,
      color: 'text-pink-500',
      bg: 'bg-pink-500/10',
      description: 'Distribuição de cestas básicas, remédios e fraldas.',
      topics: [
        'Registro de beneficiados',
        'Planejamento de rotas de entrega',
        'Notificação via WhatsApp',
        'Controle de estoque/quantidade'
      ]
    },
    {
      title: 'Demandas Parlamentares',
      icon: FileText,
      color: 'text-purple-500',
      bg: 'bg-purple-500/10',
      description: 'Acompanhe pedidos de ofícios e solicitações de melhorias públicas.',
      topics: [
        'Registro de demandas com localidade',
        'Vincular nível de prioridade',
        'Status de acompanhamento',
        'Pressão política organizada'
      ]
    },
    {
      title: 'Agenda do Vereador',
      icon: Clock,
      color: 'text-cyan-500',
      bg: 'bg-cyan-500/10',
      description: 'Gerencie compromissos do Vereador de forma semanal e integrada.',
      topics: [
        'Adiar compromissos para dia seguinte',
        'Remarcar e atualizar detalhes rápidos',
        'Controle de conflitos de horários',
        'Filtros por categoria de compromisso'
      ]
    },
    {
      title: 'Segurança e Auditoria',
      icon: ShieldCheck,
      color: 'text-indigo-500',
      bg: 'bg-indigo-500/10',
      description: 'Tenha rastreabilidade total de todas as ações executadas no sistema.',
      topics: [
        'Registro automático de logs (Criação/Edição/Exclusão)',
        'Identificação de autoria e horário do evento',
        'Visualização detalhada do estado anterior e novo do dado',
        'Integridade total contra exclusões não documentadas'
      ]
    }
  ];

  const faqs = [
    {
      question: 'Como faço para imprimir um protocolo de malote?',
      answer: 'Acesse o módulo "Malotes", localize o registro desejado e clique no ícone de impressora na lateral do card. Um PDF será gerado com todos os dados do envio.'
    },
    {
      question: 'Esqueci de anexar um atendimento médico ao malote, o que fazer?',
      answer: 'Vá em "Malotes", clique em editar no registro desejado e, na seção "Relacionar Atendimentos Médicos", selecione os pacientes que faltaram. Salve para atualizar.'
    },
    {
      question: 'Posso usar o sistema pelo celular?',
      answer: 'Sim! O Gabinete Digital é 100% responsivo. Você pode registrar atendimentos e tirar fotos de documentos diretamente do seu smartphone.'
    },
    {
      question: 'Como funciona o backup dos dados?',
      answer: 'O sistema utiliza o Google Firebase, com redundância global e criptografia. Seus dados são salvos em tempo real na nuvem.'
    }
  ];

  return (
    <div className={cn("space-y-8 pb-20", !isEmbed && "lg:p-4")}>
      {!isEmbed && (
        <header className="space-y-2">
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <BookOpen className="text-blue-500" size={32} />
            Manual do Sistema
          </h1>
          <p className="text-slate-400">Aprenda as principais funcionalidades e como operar o Gabinete Digital.</p>
        </header>
      )}

      {/* Categories Toggle */}
      <div className="flex bg-slate-900 p-1.5 rounded-2xl w-fit border border-slate-800">
        {[
          { id: 'guides', label: 'Manuais', icon: FileText },
          { id: 'videos', label: 'Vídeo Aulas', icon: Video },
          { id: 'faq', label: 'Dúvidas Frequentes', icon: HelpCircle }
        ].map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategory(cat.id as any)}
            className={cn(
              "flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-bold transition-all",
              activeCategory === cat.id 
                ? "bg-blue-600 text-white shadow-lg" 
                : "text-slate-400 hover:text-white hover:bg-slate-800"
            )}
          >
            <cat.icon size={16} />
            {cat.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeCategory === 'guides' && (
          <motion.div
            key="guides"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            {modules.map((module) => (
              <div key={module.title} className="bg-slate-900 border border-slate-800 rounded-[32px] p-8 hover:border-blue-500/30 transition-all group">
                <div className="flex items-start justify-between mb-6">
                  <div className={cn("p-4 rounded-2xl border", module.bg, module.color, "border-current/10")}>
                    <module.icon size={24} />
                  </div>
                  <button className="text-blue-500 hover:underline text-xs font-bold uppercase tracking-widest flex items-center gap-1">
                    Ler Guia Completo <ChevronRight size={14} />
                  </button>
                </div>
                
                <h3 className="text-xl font-bold text-white mb-2">{module.title}</h3>
                <p className="text-slate-400 text-sm mb-6 leading-relaxed">{module.description}</p>
                
                <div className="space-y-3">
                  {module.topics.map((topic) => (
                    <div key={topic} className="flex items-center gap-3 text-slate-300 text-sm">
                      <CheckCircle2 size={16} className="text-emerald-500 shrink-0" />
                      {topic}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </motion.div>
        )}

        {activeCategory === 'videos' && (
          <motion.div
            key="videos"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-6"
          >
            <div className="bg-blue-600/5 border border-blue-600/20 rounded-[32px] p-10 text-center space-y-4">
              <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto text-blue-500">
                <PlayCircle size={48} />
              </div>
              <h2 className="text-2xl font-bold text-white">Treinamento em Vídeo</h2>
              <p className="text-slate-400 max-w-lg mx-auto">
                Assista a demonstrações reais de cada fluxo do sistema para capacitar sua equipe em poucos minutos.
              </p>
              <div className="pt-4 flex flex-wrap justify-center gap-4">
                <button className="bg-white text-slate-950 font-bold px-8 py-3 rounded-2xl flex items-center gap-2 hover:bg-slate-200 transition-all">
                  <Monitor size={20} />
                  Acessar Playlist
                </button>
                <button className="bg-slate-900 text-white font-bold px-8 py-3 rounded-2xl flex items-center gap-2 border border-slate-800 hover:bg-slate-800 transition-all">
                  <ExternalLink size={20} />
                  Cursos ProGabinete
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                { label: 'Primeiros Passos', duration: '5:20' },
                { label: 'Gestão de Saúde', duration: '8:45' },
                { label: 'Segurança de Dados', duration: '4:10' }
              ].map((v) => (
                <div key={v.label} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl flex items-center gap-4 hover:bg-slate-800/50 transition-all cursor-pointer">
                  <div className="w-12 h-12 bg-slate-950 rounded-xl flex items-center justify-center text-slate-500">
                    <PlayCircle size={24} />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{v.label}</p>
                    <p className="text-[10px] text-slate-500 font-mono italic">{v.duration}</p>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {activeCategory === 'faq' && (
          <motion.div
            key="faq"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-4"
          >
            {faqs.map((f) => (
              <div key={f.question} className="bg-slate-900 border border-slate-800 rounded-2xl p-6 hover:border-slate-700 transition-all group">
                <div className="flex items-start gap-4">
                  <div className="mt-1 p-2 bg-slate-950 rounded-lg text-amber-500 shrink-0">
                    <Lightbulb size={18} />
                  </div>
                  <div>
                    <h4 className="font-bold text-white mb-2 leading-tight">{f.question}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{f.answer}</p>
                  </div>
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      <footer className="mt-12 p-8 bg-slate-900/50 border border-slate-800 rounded-[32px] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="w-12 h-12 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center">
             <MessageSquare size={24} />
          </div>
          <div>
            <h4 className="font-bold text-white">Precisa de Suporte Direto?</h4>
            <p className="text-slate-500 text-sm">Clécio Ferreira está disponível para tirar dúvidas em tempo real.</p>
          </div>
        </div>
        <button 
          onClick={() => window.open('https://wa.me/5575988017239', '_blank')}
          className="w-full md:w-auto px-10 py-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-2xl shadow-xl shadow-emerald-900/20 transition-all active:scale-95 cursor-pointer"
        >
          Falar com Clécio
        </button>
      </footer>
    </div>
  );
}

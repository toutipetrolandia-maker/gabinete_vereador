import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  Users, 
  Sparkles, 
  ChevronRight, 
  Command, 
  X, 
  FileText, 
  Briefcase, 
  Stethoscope, 
  ShoppingBag, 
  Package, 
  MessageSquare, 
  Handshake, 
  FileDown, 
  History, 
  Settings, 
  Clock, 
  Globe, 
  BarChart3 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../hooks/useAuth';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn, formatProperName } from '../lib/utils';

interface CommandBarProps {
  isOpen: boolean;
  onClose: () => void;
  setActiveTab: (tab: string) => void;
  activeTab: string;
}

interface CommandItem {
  id: string;
  label: string;
  category: 'modules' | 'citizens';
  icon: React.ElementType;
  shortcut?: string;
  onClick: () => void;
  subtitle?: string;
}

interface TempRecord {
  nome_completo?: string;
  beneficiado_nome?: string;
  solicitante_nome?: string;
  cpf?: string;
  indicado_cpf?: string;
  beneficiado_cpf?: string;
  telefone?: string;
  whatsapp?: string;
  beneficiado_telefone?: string;
  bairro?: string;
  created_at?: any;
}

export default function CommandBar({ isOpen, onClose, setActiveTab, activeTab }: CommandBarProps) {
  const { profile, hasModuleAccess } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [citizensList, setCitizensList] = useState<any[]>([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut listener to open command bar
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
          onClose();
        } else {
          // Open occurs remotely via layout, so we dispatch an event
          window.dispatchEvent(new CustomEvent('toggle-command-bar'));
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Focus input on open
  useEffect(() => {
    if (isOpen) {
      setSearchQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Fetch citizens real-time cache
  useEffect(() => {
    if (!isOpen || !profile?.cabinetId) return;

    const collections = [
      { name: 'atendimentos', type: 'Geral' },
      { name: 'atendimentos_medicos', type: 'Médico' },
      { name: 'auxilio_social', type: 'Auxílio' },
      { name: 'demandas_parlamentares', type: 'Demanda' }
    ];

    const tempRecords: Record<string, TempRecord[]> = {};
    
    const unsubscribes = collections.map(coll => {
      const q = query(
        collection(db, coll.name),
        where('cabinetId', '==', profile.cabinetId)
      );

      return onSnapshot(q, (snap) => {
        const docs = snap.docs.map(doc => doc.data() as TempRecord);
        
        // Clear old ones of this type
        Object.keys(tempRecords).forEach(cpf => {
          tempRecords[cpf] = tempRecords[cpf].filter((rec: any) => rec._source_coll !== coll.name);
        });

        docs.forEach(doc => {
          const cpf = doc.cpf || doc.indicado_cpf || doc.beneficiado_cpf || 'SEM-CPF';
          if (!tempRecords[cpf]) {
            tempRecords[cpf] = [];
          }
          tempRecords[cpf].push({
            ...doc,
            _source_coll: coll.name
          } as any);
        });

        // Group into unique citizens
        const unique = Object.entries(tempRecords).map(([cpf, records]) => {
          const latest = [...records].sort((a, b) => {
            const dateA = a.created_at?.toDate?.() || new Date(0);
            const dateB = b.created_at?.toDate?.() || new Date(0);
            return dateB.getTime() - dateA.getTime();
          })[0];

          return {
            cpf,
            nome: formatProperName(latest.nome_completo || latest.beneficiado_nome || latest.solicitante_nome || 'Nome não identificado'),
            telefone: latest.telefone || latest.whatsapp || latest.beneficiado_telefone || '-',
            bairro: latest.bairro || 'Sem Bairro'
          };
        }).filter(c => c.nome !== 'Nome não identificado' || c.cpf !== 'SEM-CPF');

        setCitizensList(unique);
      });
    });

    return () => unsubscribes.forEach(unsub => unsub());
  }, [isOpen, profile?.cabinetId]);

  // System navigation options (modules available to the user)
  const availableModules = [
    { id: 'dashboard', label: 'Dashboard / Painel Geral', icon: BarChart3, shortcut: 'D' },
    { id: 'saas', label: 'Admin SaaS', icon: Globe, shortcut: 'S' },
    { id: 'agenda', label: 'Agenda de Compromissos', icon: Clock, shortcut: 'A' },
    { id: 'cidadaos', label: 'Cidadãos CRM / Cadastros', icon: Users, shortcut: 'C' },
    { id: 'atendimentos', label: 'Atendimentos Parlamentares', icon: Briefcase, shortcut: 'T' },
    { id: 'medico', label: 'Atendimentos Médicos', icon: Stethoscope, shortcut: 'M' },
    { id: 'auxilio', label: 'Auxílio Social / Doações', icon: ShoppingBag, shortcut: 'X' },
    { id: 'indicacoes', label: 'Indicações de Cargos', icon: Briefcase, shortcut: 'I' },
    { id: 'malotes', label: 'Malotes / Documentos', icon: Package, shortcut: 'O' },
    { id: 'demandas', label: 'Demandas e Ofícios', icon: FileText, shortcut: 'P' },
    { id: 'sugestoes', label: 'Sugestões e Feedbacks', icon: MessageSquare, shortcut: 'G' },
    { id: 'reunioes', label: 'Reuniões & Soluções com Prefeito', icon: Handshake, shortcut: 'R' },
    { id: 'relatorios', label: 'Relatórios & Exportações', icon: FileDown, shortcut: 'L' },
    { id: 'whatsapp', label: 'Automação WhatsApp / Mensagens', icon: MessageSquare, shortcut: 'W' },
    { id: 'history', label: 'Histórico / Auditoria', icon: History, shortcut: 'H' },
    { id: 'config', label: 'Configurações do Sistema', icon: Settings, shortcut: 'F' },
  ].filter(mod => hasModuleAccess(mod.id));

  // Build command list based on search query
  const filteredItems: CommandItem[] = [];

  const queryClean = searchQuery.toLowerCase().trim();

  // 1. Filter modules
  availableModules.forEach(mod => {
    if (mod.label.toLowerCase().includes(queryClean) || mod.id.toLowerCase().includes(queryClean)) {
      filteredItems.push({
        id: mod.id,
        label: mod.label,
        category: 'modules',
        icon: mod.icon,
        shortcut: mod.shortcut,
        onClick: () => {
          setActiveTab(mod.id);
          onClose();
        }
      });
    }
  });

  // 2. Filter citizens
  if (queryClean.length > 0) {
    const isNumber = /^\d+$/.test(queryClean.replace(/\D/g, ''));
    citizensList.forEach(ctz => {
      const citizenMatch = isNumber 
        ? ctz.cpf.replace(/\D/g, '').includes(queryClean.replace(/\D/g, ''))
        : ctz.nome.toLowerCase().includes(queryClean);
      
      if (citizenMatch) {
        filteredItems.push({
          id: `citizen-${ctz.cpf}`,
          label: ctz.nome,
          subtitle: `CPF: ${ctz.cpf} • Bairro: ${ctz.bairro}`,
          category: 'citizens',
          icon: Users,
          onClick: () => {
            // Select citizen and navigate
            sessionStorage.setItem('selected-citizen-cpf', ctz.cpf);
            window.dispatchEvent(new CustomEvent('select-citizen-cpf-trigger', { detail: { cpf: ctz.cpf } }));
            setActiveTab('cidadaos');
            onClose();
          }
        });
      }
    });
  } else {
    // Show top 3 recent / cached citizens when empty
    citizensList.slice(0, 4).forEach(ctz => {
      filteredItems.push({
        id: `citizen-${ctz.cpf}`,
        label: ctz.nome,
        subtitle: `CPF: ${ctz.cpf} • Bairro: ${ctz.bairro}`,
        category: 'citizens',
        icon: Users,
        onClick: () => {
          sessionStorage.setItem('selected-citizen-cpf', ctz.cpf);
          window.dispatchEvent(new CustomEvent('select-citizen-cpf-trigger', { detail: { cpf: ctz.cpf } }));
          setActiveTab('cidadaos');
          onClose();
        }
      });
    });
  }

  // Adjust selected index bounds
  useEffect(() => {
    setSelectedIndex(0);
  }, [searchQuery]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev + 1) % Math.max(1, filteredItems.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev - 1 + filteredItems.length) % Math.max(1, filteredItems.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].onClick();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // Group items by category for visual display
  const modulesItems = filteredItems.filter(item => item.category === 'modules');
  const citizensItems = filteredItems.filter(item => item.category === 'citizens');

  // Let's create an ordered rendering list that maintains absolute index matching
  let absoluteCounter = 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center pt-24 px-4 overflow-y-auto">
          {/* Backdrop */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-md"
            id="cmd-bar-backdrop"
          />

          {/* Modal Card */}
          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: -8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: -8 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            ref={containerRef}
            className="relative bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col"
            id="cmd-bar-card"
          >
            {/* Header / Input */}
            <div className="flex items-center gap-4 px-6 py-4 border-b border-slate-800">
              <Search className="text-slate-400 shrink-0" size={22} />
              <input
                ref={inputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Pesquisar módulo ou cidadão (por nome ou CPF)..."
                className="bg-transparent border-none outline-none focus:outline-none focus:ring-0 text-slate-100 placeholder:text-slate-500 text-base w-full py-1"
                id="cmd-bar-input"
              />
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[10px] font-mono bg-slate-800 text-slate-400 border border-slate-700/50 px-2 py-0.5 rounded uppercase">esc</span>
                <button 
                  onClick={onClose}
                  className="p-1 hover:bg-slate-800 hover:text-white text-slate-400 rounded-lg transition-all cursor-pointer"
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="max-h-[440px] overflow-y-auto p-4 space-y-4" id="cmd-bar-results">
              {filteredItems.length === 0 && (
                <div className="py-12 text-center text-slate-500 space-y-2">
                  <Sparkles size={28} className="mx-auto text-slate-600 animate-pulse" />
                  <p className="text-sm font-medium">Nenhum resultado encontrado para "{searchQuery}"</p>
                  <p className="text-xs text-slate-600">Verifique a grafia ou tente buscar por outro termo.</p>
                </div>
              )}

              {/* Modules Group */}
              {modulesItems.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-blue-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Módulos do Sistema</span>
                    {searchQuery === '' && <span className="text-slate-500 lowercase font-normal tracking-normal text-[9px]">(pesquise ou use setas)</span>}
                  </div>
                  {modulesItems.map((item) => {
                    const currentIdx = absoluteCounter++;
                    const isActive = selectedIndex === currentIdx;
                    const Icon = item.icon;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onClick}
                        onMouseEnter={() => setSelectedIndex(currentIdx)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer",
                          isActive 
                            ? "bg-blue-600 text-white shadow-lg shadow-blue-950/40" 
                            : "hover:bg-slate-850 text-slate-300"
                        )}
                        id={`cmd-item-${item.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Icon size={18} className={cn("shrink-0", isActive ? "text-white" : "text-slate-400")} />
                          <span className="text-sm font-medium">{item.label}</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                          {item.shortcut && (
                            <span className={cn(
                              "text-[10px] font-mono px-1.5 py-0.5 rounded",
                              isActive ? "bg-blue-700 text-blue-200 border border-blue-500" : "bg-slate-800 text-slate-500 border border-slate-750"
                            )}>
                              {item.shortcut}
                            </span>
                          )}
                          <ChevronRight size={14} className={isActive ? "opacity-100" : "opacity-30"} />
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}

              {/* Citizens Group */}
              {citizensItems.length > 0 && (
                <div className="space-y-1">
                  <div className="px-3 py-1.5 text-[10px] font-bold text-emerald-400 uppercase tracking-widest flex items-center justify-between">
                    <span>Cidadãos Encontrados</span>
                    {searchQuery === '' && <span className="text-slate-500 lowercase font-medium tracking-normal text-[9px]">Sugeridos</span>}
                  </div>
                  {citizensItems.map((item) => {
                    const currentIdx = absoluteCounter++;
                    const isActive = selectedIndex === currentIdx;
                    return (
                      <button
                        key={item.id}
                        onClick={item.onClick}
                        onMouseEnter={() => setSelectedIndex(currentIdx)}
                        className={cn(
                          "w-full flex items-center justify-between px-3 py-2.5 rounded-2xl text-left transition-all cursor-pointer",
                          isActive 
                            ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/40" 
                            : "hover:bg-slate-850 text-slate-300"
                        )}
                        id={`cmd-item-${item.id}`}
                      >
                        <div className="flex items-center gap-3">
                          <Users size={18} className={cn("shrink-0", isActive ? "text-white" : "text-slate-400")} />
                          <div className="flex flex-col">
                            <span className="text-sm font-medium">{item.label}</span>
                            {item.subtitle && (
                              <span className={cn(
                                "text-[11px] font-mono",
                                isActive ? "text-emerald-100/80" : "text-slate-500"
                              )}>
                                {item.subtitle}
                              </span>
                            )}
                          </div>
                        </div>
                        <ChevronRight size={14} className={isActive ? "opacity-100" : "opacity-30"} />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Footer Status Bar */}
            <div className="px-6 py-2 bg-slate-950/50 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 font-medium">
              <div className="flex items-center gap-4">
                <span className="flex items-center gap-1">
                  <span className="p-0.5 bg-slate-800 border border-slate-700/50 rounded text-[9px] font-mono">↑↓</span> Navegar
                </span>
                <span className="flex items-center gap-1">
                  <span className="p-0.5 bg-slate-800 border border-slate-700/50 px-1 rounded text-[9px] font-mono">Enter</span> Selecionar
                </span>
                <span className="flex items-center gap-1">
                  <span className="p-0.5 bg-slate-800 border border-slate-700/50 px-1 rounded text-[9px] font-mono">Esc</span> Fechar
                </span>
              </div>
              <div className="hidden sm:flex items-center gap-1">
                <Command size={10} className="text-slate-500" />
                <span>Atalho Global:</span>
                <span className="bg-slate-800 border border-slate-700/50 text-slate-400 px-1 py-0.5 rounded font-mono text-[9px]">Ctrl + K</span>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

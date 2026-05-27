import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Sparkles, 
  X, 
  CheckCircle, 
  UploadCloud, 
  Users, 
  History, 
  ShieldCheck, 
  ArrowRight 
} from 'lucide-react';

interface SystemUpdatesPopupProps {
  userId: string;
}

export default function SystemUpdatesPopup({ userId }: SystemUpdatesPopupProps) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!userId) return;

    // Check last seen timestamp in localStorage for the specific logged-in user
    const storageKey = `gabinete_updates_last_seen_${userId}`;
    const lastSeen = localStorage.getItem(storageKey);
    const ONE_WEEK_MS = 7 * 24 * 60 * 60 * 1000;

    if (!lastSeen) {
      // First-ever login or storage cleared: show updates immediately
      setIsOpen(true);
    } else {
      const lastSeenTime = parseInt(lastSeen, 10);
      const currentTime = Date.now();
      
      if (currentTime - lastSeenTime > ONE_WEEK_MS) {
        setIsOpen(true);
      }
    }
  }, [userId]);

  const handleClose = () => {
    if (userId) {
      const storageKey = `gabinete_updates_last_seen_${userId}`;
      localStorage.setItem(storageKey, Date.now().toString());
    }
    setIsOpen(false);
  };

  const updates = [
    {
      id: 1,
      title: 'Cadastro & Anexo de Currículos',
      description: 'Agora é possível registrar qualificações detalhadas dos candidatos a cargos e fazer upload de arquivos de currículo nos formatos PDF ou imagem JPG (até 800KB). Visualize-os diretamente no painel de indicações de cargos e faça o download instantaneamente.',
      icon: UploadCloud,
      badge: 'Novo',
      iconBg: 'bg-purple-500/10 text-purple-400 border-purple-500/20'
    },
    {
      id: 2,
      title: 'Controle de Primeiro Acesso dos Assessores',
      description: 'Como Administrador ou Vereador, monitore em tempo real quais assessores ainda não efetuaram o primeiro acesso à plataforma. Envie alertas automáticos ou compartilhe o relatório completo de pendências via WhatsApp em um clique.',
      icon: Users,
      badge: 'Novo',
      iconBg: 'bg-amber-500/10 text-amber-500 border-amber-500/20'
    },
    {
      id: 3,
      title: 'Histórico Integrado do Cidadão',
      description: 'Nova barra lateral de histórico unificado. Agora, ao atender um cidadão, o sistema exibe automaticamente tanto os atendimentos do gabinete geral quanto os prontuários de assistência médica vinculados àquele CPF de maneira unificada.',
      icon: History,
      badge: 'Melhoria',
      iconBg: 'bg-blue-500/10 text-blue-400 border-blue-500/20'
    },
    {
      id: 4,
      title: 'Onboarding Confiável e Renovado',
      description: 'Os fluxos de alteração obrigatória de senha temporária e primeiro acesso seguro foram aprimorados, garantindo a integridade dos dados e das permissões de novos usuários do início ao fim.',
      icon: ShieldCheck,
      badge: 'Segurança',
      iconBg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop blur effect */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[150]"
          />

          {/* Dialog Container */}
          <div className="fixed inset-0 flex items-center justify-center p-4 z-[151] pointer-events-none">
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              transition={{ type: 'spring', duration: 0.5 }}
              className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-[32px] p-6 md:p-8 shadow-2xl flex flex-col overflow-hidden text-left pointer-events-auto max-h-[90vh] bg-gradient-to-b from-slate-900 to-slate-950"
            >
              {/* Header section with Sparkles & Close Button */}
              <div className="flex items-center justify-between shrink-0 mb-6 pb-4 border-b border-slate-800/85">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-blue-600/10 flex items-center justify-center border border-blue-500/20 text-blue-400">
                    <Sparkles size={24} className="animate-pulse" />
                  </div>
                  <div>
                    <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                      Gabinete Atualizado!
                    </h2>
                    <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest mt-0.5">
                      Confira as novidades da semana no sistema
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleClose}
                  className="p-2.5 bg-slate-950 hover:bg-slate-850 border border-slate-850 hover:border-slate-800 rounded-xl text-slate-500 hover:text-white transition-all cursor-pointer"
                  title="Fechar Novidades"
                >
                  <X size={18} />
                </button>
              </div>

              {/* Scrollable Updates Area */}
              <div className="flex-1 overflow-y-auto space-y-5 pr-1 py-1 custom-scrollbar">
                {updates.map((up) => {
                  const IconComponent = up.icon;
                  return (
                    <motion.div
                      key={up.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: up.id * 0.1 }}
                      className="group bg-slate-950/40 p-4 rounded-2xl border border-slate-800/70 hover:border-slate-700/65 transition-all flex flex-col sm:flex-row items-start gap-4"
                    >
                      {/* Left icon wrapper */}
                      <div className={`w-12 h-12 rounded-xl flex items-center justify-center border shrink-0 ${up.iconBg}`}>
                        <IconComponent size={20} />
                      </div>

                      {/* Content block */}
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-bold text-slate-200 text-sm">{up.title}</h4>
                          <span className={`text-[8px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border ${
                            up.badge === 'Novo' ? 'bg-purple-500/10 text-purple-400 border-purple-500/20' : 
                            up.badge === 'Segurança' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                            'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                            {up.badge}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 leading-relaxed font-normal">
                          {up.description}
                        </p>
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* Action Button underneath */}
              <div className="pt-6 border-t border-slate-800 mt-6 shrink-0 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <span className="text-[10px] text-slate-500 font-medium">
                  Este aviso será exibido novamente somente se houverem novas atualizações na próxima semana.
                </span>
                <button
                  type="button"
                  onClick={handleClose}
                  className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-xs uppercase tracking-wider py-4 px-6 rounded-2xl shadow-lg shadow-blue-900/30 transition-all flex items-center justify-center gap-2 cursor-pointer font-sans shrink-0 border border-blue-500/10"
                >
                  <span>Explorar Sistema</span>
                  <ArrowRight size={14} />
                </button>
              </div>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}

import React, { useState } from 'react';
import { 
  BarChart3, 
  Users, 
  Stethoscope, 
  Package, 
  FileText, 
  MessageSquare, 
  Settings,
  LogOut,
  ChevronRight,
  Menu,
  X,
  FileDown,
  Clock,
  ExternalLink,
  Wifi,
  WifiOff,
  CheckCircle2,
  Search,
  Globe,
  History,
  ShieldCheck,
  ShoppingBag,
  BookOpen,
  MessageCircle,
  Briefcase
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import NotificationCenter from './NotificationCenter';
import { AIAssistant } from './AIAssistant';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { profile, isOnline, isSuperAdmin: authIsSuper, isCabinetOverridden, switchCabinet, hasModuleAccess } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [appName, setAppName] = useState('Gabinete Digital');
  const [vereadorPhoto, setVereadorPhoto] = useState<string | null>(null);
  const [cabinetLogo, setCabinetLogo] = useState<string | null>(null);
  const [perfilLink, setPerfilLink] = useState('https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
  const [perfilLabel, setPerfilLabel] = useState('Câmara Municipal');
  const [systemLocked, setSystemLocked] = useState(false);
  const [billingStatus, setBillingStatus] = useState<'regular' | 'pending' | 'suspended'>('regular');
  const [isMobile, setIsMobile] = useState(false);
  const [showStatusToast, setShowStatusToast] = useState(false);

  const isSuperAdmin = authIsSuper;

  React.useEffect(() => {
    if (isOnline) {
      setShowStatusToast(true);
      const timer = setTimeout(() => setShowStatusToast(false), 5000);
      return () => clearTimeout(timer);
    }
  }, [isOnline]);

  React.useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
      if (window.innerWidth < 1024) setIsSidebarOpen(false);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  React.useEffect(() => {
    if (!profile?.cabinetId) return;

    const unsub = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
        if (snap.exists()) {
           const data = snap.data();
           setAppName(data.name || data.app_name || 'Gabinete Digital');
           setVereadorPhoto(data.vereador_photo || null);
           setCabinetLogo(data.cabinet_logo || null);
           setPerfilLink(data.perfil_link || 'https://www.cmpa.ba.gov.br/vereador/gilmarkson-campos');
           setPerfilLabel(data.perfil_label || 'Câmara Municipal');
           setSystemLocked(data.status === 'suspended');
           setBillingStatus(data.status === 'suspended' ? 'suspended' : 'regular');
        }
     }, (error) => {
        console.error("Error listening to settings in Layout:", error);
     });
     return () => unsub();
  }, [profile?.cabinetId]);

  const roleLabels: Record<string, string> = {
    superadmin: 'Super Admin',
    admin: 'Administrador',
    vereador: 'Vereador',
    secretaria_parlamentar: 'Assessora Parlamentar',
    assessor: 'Assessor',
    consulta: 'Consulta',
    suporte_ti: 'Suporte TI'
  };

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'saas', label: 'Admin SaaS', icon: Globe },
    { id: 'agenda', label: 'Agenda', icon: Clock },
    { id: 'cidadaos', label: 'Cidadãos CRM', icon: Users },
    { id: 'atendimentos', label: 'Atendimentos', icon: Briefcase },
    { id: 'medico', label: 'Atend. Médico', icon: Stethoscope },
    { id: 'auxilio', label: 'Auxílio Social', icon: ShoppingBag },
    { id: 'indicacoes', label: 'Indicações', icon: Briefcase },
    { id: 'malotes', label: 'Malotes', icon: Package },
    { id: 'demandas', label: 'Demandas', icon: FileText },
    { id: 'sugestoes', label: 'Sugestões', icon: MessageSquare },
    { id: 'relatorios', label: 'Relatórios', icon: FileDown },
    { id: 'whatsapp', label: 'Mensagens', icon: MessageSquare },
    { id: 'history', label: 'Logs / Auditoria', icon: History },
    { id: 'config', label: 'Configurações', icon: Settings },
  ].filter(item => {
    return hasModuleAccess(item.id);
  });

  const handleLogout = () => auth.signOut();

  if (profile && profile.ativo === false) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-100 p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-slate-900 p-8 rounded-3xl border border-slate-800 shadow-2xl max-w-md w-full space-y-6"
        >
          <div className="w-20 h-20 bg-amber-500/20 text-amber-500 rounded-full flex items-center justify-center mx-auto shadow-inner">
            <Clock size={40} />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-bold">Aguardando Aprovação</h1>
            <p className="text-slate-400">
              Seu cadastro foi realizado com sucesso! Para acessar o sistema, um administrador precisa aprovar sua conta.
            </p>
          </div>
          <button 
            onClick={handleLogout}
            className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-3 rounded-xl transition-all"
          >
            Sair e tentar mais tarde
          </button>
        </motion.div>
      </div>
    );
  }

  const isSystemSuspended = (systemLocked || billingStatus === 'suspended') && !isSuperAdmin;

  if (isSystemSuspended) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-slate-950 text-slate-100 p-6 text-center">
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="bg-slate-900 p-10 rounded-3xl border border-red-500/20 shadow-2xl max-w-lg w-full space-y-8"
        >
          <div className="w-24 h-24 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto shadow-lg border border-red-500/20">
            <X size={48} />
          </div>
          <div className="space-y-3">
            <h1 className="text-3xl font-black uppercase tracking-tight text-white">Sistema Suspenso</h1>
            <p className="text-slate-400 text-lg">
              {systemLocked 
                ? "O sistema encontra-se em manutenção programada ou foi bloqueado por segurança."
                : "O acesso ao sistema foi temporariamente suspenso devido a pendências administrativas ou financeiras."}
            </p>
          </div>
          <div className="pt-4 border-t border-slate-800">
            <p className="text-xs text-slate-500 italic mb-6">
              Para normalizar seu acesso, entre em contato com o suporte técnico no WhatsApp: <a href="https://wa.me/5575988017239" target="_blank" rel="noopener noreferrer" className="text-red-400 font-bold hover:underline">(75) 98801-7239</a>
            </p>
            <button 
              onClick={handleLogout}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-red-900/20"
            >
              Sair do Sistema
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-slate-950 text-slate-100 overflow-hidden relative">
      {/* Mobile Sidebar Toggle */}
      <button 
        className="lg:hidden fixed top-4 left-4 z-50 p-2 bg-slate-900 border border-slate-800 rounded-lg shadow-lg"
        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
      >
        {isSidebarOpen ? <X size={20} /> : <Menu size={20} />}
      </button>

      {/* Backdrop for Mobile */}
      <AnimatePresence>
        {isMobile && isSidebarOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-40 lg:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <motion.aside 
        initial={false}
        animate={{ 
          width: isMobile ? (isSidebarOpen ? 260 : 0) : (isSidebarOpen ? 260 : 80),
          x: isMobile ? (isSidebarOpen ? 0 : -260) : 0
        }}
        className={cn(
          "bg-slate-900 border-r border-slate-800 flex flex-col z-50 transition-all",
          isMobile ? "fixed inset-y-0 left-0" : "relative",
          !isSidebarOpen && !isMobile && "items-center"
        )}
      >
        <div className="h-20 flex items-center px-6 gap-3 overflow-hidden whitespace-nowrap border-b border-slate-800/50">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0 overflow-hidden">
            {cabinetLogo ? (
              <img src={cabinetLogo} alt={appName} className="w-full h-full object-contain p-1.5" />
            ) : vereadorPhoto ? (
              <img src={vereadorPhoto} alt={appName} className="w-full h-full object-cover" />
            ) : (
              <span className="font-bold text-xl">{appName[0]}</span>
            )}
          </div>
          {(isSidebarOpen || isMobile) && (
            <div className="flex flex-col">
              <span className="font-bold tracking-tight">{appName}</span>
              <span className="text-[10px] uppercase text-blue-400 font-mono tracking-wider">Sistema v1.0</span>
            </div>
          )}
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => {
                setActiveTab(item.id);
                if (isMobile) setIsSidebarOpen(false);
              }}
              className={cn(
                "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                activeTab === item.id 
                  ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                  : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
              )}
            >
              <item.icon size={20} className={cn("shrink-0", activeTab === item.id ? "text-white" : "group-hover:text-blue-400")} />
              {(isSidebarOpen || isMobile) && <span className="font-medium text-sm">{item.label}</span>}
              {(isSidebarOpen || isMobile) && activeTab === item.id && <ChevronRight size={14} className="ml-auto opacity-50" />}
            </button>
          ))}
          
          <a
            href={perfilLink}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              "w-full flex items-center gap-3 px-3 py-3 rounded-xl transition-all group mt-4 border border-dashed border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 text-slate-500 hover:text-blue-400"
            )}
          >
            <ExternalLink size={20} className="shrink-0" />
            {(isSidebarOpen || isMobile) && <span className="font-medium text-sm">{perfilLabel}</span>}
          </a>
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2 overflow-hidden">
            <div className="relative shrink-0">
              <div className="w-8 h-8 rounded-full bg-slate-700 uppercase flex items-center justify-center font-bold text-xs ring-2 ring-slate-800/50 overflow-hidden">
                {profile?.photo_url ? (
                  <img src={profile.photo_url} alt="Perfil" className="w-full h-full object-cover" />
                ) : (
                  profile?.nome?.[0] || 'U'
                )}
              </div>
              <div className={cn(
                "absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-slate-900 transition-colors",
                isOnline ? "bg-emerald-500" : "bg-red-500"
              )} />
            </div>
            {(isSidebarOpen || isMobile) && (
              <div className="flex flex-col overflow-hidden">
                <div className="flex items-center gap-1.5 overflow-hidden">
                  <span className="text-sm font-medium truncate">{profile?.nome || 'Usuário'}</span>
                  {isOnline ? <Wifi size={10} className="text-emerald-500" /> : <WifiOff size={10} className="text-red-500" />}
                </div>
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">
                  {profile?.role ? (roleLabels[profile.role] || profile.role) : 'Consulta'}
                </span>
              </div>
            )}
          </div>
          <button 
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 text-slate-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
          >
            <LogOut size={18} />
            {(isSidebarOpen || isMobile) && <span className="text-sm font-medium">Sair</span>}
          </button>
        </div>
      </motion.aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto relative p-4 md:p-6 lg:p-10 flex flex-col">
        {isCabinetOverridden && (
          <div className="mb-6 -mt-4 -mx-4 md:-mt-6 md:-mx-6 lg:-mt-10 lg:-mx-10 bg-amber-600 px-6 py-2 flex items-center justify-between shadow-lg z-30">
            <div className="flex items-center gap-2 text-white font-bold text-xs uppercase tracking-widest">
               <ShieldCheck size={16} />
               Modo Administrativo: Visualizando Gabinete "{appName}"
            </div>
            <button 
              onClick={() => {
                switchCabinet(null);
                setActiveTab('saas');
              }}
              className="bg-white text-amber-700 hover:bg-slate-100 px-4 py-1.5 rounded-lg font-black text-[10px] uppercase transition-all shadow-sm"
            >
              Sair do Gabinete
            </button>
          </div>
        )}
        
        {/* Header Bar */}
        <header className="flex items-center justify-between mb-8 pb-6 border-b border-slate-800/50">
           <div className="flex items-center gap-4 bg-slate-900 border border-slate-800 px-4 py-2 rounded-2xl w-full max-w-md group focus-within:border-blue-500/50 transition-all">
              <Search size={18} className="text-slate-500 group-focus-within:text-blue-500" />
              <input type="text" placeholder="Pesquisar no gabinete..." className="bg-transparent border-none focus:ring-0 text-sm text-slate-100 placeholder:text-slate-500 w-full" />
           </div>
           
           <div className="flex items-center gap-4">
              <div className="hidden md:flex flex-col items-end mr-2">
                 <span className="text-[10px] uppercase font-black tracking-widest text-blue-500 mb-0.5">Gabinete Digital</span>
                 <span className="text-xs font-bold text-slate-400">{format(new Date(), "dd 'de' MMMM", { locale: ptBR })}</span>
              </div>
              <NotificationCenter />
           </div>
        </header>

        <AnimatePresence>
          {showStatusToast && (
            <motion.div 
              initial={{ opacity: 0, y: -20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.95 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-emerald-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-emerald-900/30 font-bold text-sm"
            >
              <CheckCircle2 size={18} />
              Conectado ao Gabinete Digital
            </motion.div>
          )}
          {!isOnline && (
            <motion.div 
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex items-center gap-3 bg-red-600 text-white px-6 py-3 rounded-2xl shadow-2xl shadow-red-900/30 font-bold text-sm"
            >
              <WifiOff size={18} />
              Você está offline
            </motion.div>
          )}
        </AnimatePresence>

        <div className="max-w-7xl mx-auto h-full pt-12 lg:pt-0">
          {children}
        </div>
      </main>
      <AIAssistant />
    </div>
  );
}

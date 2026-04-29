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
  FileDown
} from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db, auth } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

interface LayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function Layout({ children, activeTab, setActiveTab }: LayoutProps) {
  const { profile } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [appName, setAppName] = useState('Gabinete Digital');
  const [isMobile, setIsMobile] = useState(false);

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
     const unsub = onSnapshot(doc(db, 'app_settings', 'global'), (snap) => {
        if (snap.exists()) {
           setAppName(snap.data().app_name || 'Gabinete Digital');
        }
     }, (error) => {
        console.error("Error listening to settings in Layout:", error);
     });
     return () => unsub();
  }, []);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: BarChart3 },
    { id: 'atendimentos', label: 'Atendimentos', icon: Users },
    { id: 'medico', label: 'Atend. Médico', icon: Stethoscope },
    { id: 'malotes', label: 'Malotes', icon: Package },
    { id: 'demandas', label: 'Demandas', icon: FileText },
    { id: 'sugestoes', label: 'Sugestões', icon: MessageSquare },
    { id: 'relatorios', label: 'Relatórios', icon: FileDown },
    { id: 'config', label: 'Configurações', icon: Settings },
  ];

  const handleLogout = () => auth.signOut();

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
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shrink-0">
            <span className="font-bold text-xl">G</span>
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
        </nav>

        <div className="p-4 border-t border-slate-800">
          <div className="flex items-center gap-3 mb-4 px-2 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-slate-700 shrink-0 uppercase flex items-center justify-center font-bold text-xs">
              {profile?.nome?.[0] || 'U'}
            </div>
            {(isSidebarOpen || isMobile) && (
              <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">{profile?.nome || 'Usuário'}</span>
                <span className="text-[10px] text-slate-500 uppercase tracking-tighter">{profile?.role || 'Consulta'}</span>
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
      <main className="flex-1 overflow-y-auto relative p-4 md:p-6 lg:p-10">
        <div className="max-w-7xl mx-auto h-full pt-12 lg:pt-0">
          {children}
        </div>
      </main>
    </div>
  );
}

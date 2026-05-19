import React, { useState, Component, ErrorInfo, ReactNode } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
import LocalAuthBarrier from './components/LocalAuthBarrier';
import Login from './components/Login';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Atendimentos from './components/Atendimentos';
import AtendimentosMedicos from './components/AtendimentosMedicos';
import Malotes from './components/Malotes';
import Settings from './components/Settings';
import Demandas from './components/Demandas';
import Sugestoes from './components/Sugestoes';
import Relatorios from './components/Relatorios';
import Agenda from './components/Agenda';
import SaaSAdmin from './components/SaaSAdmin';
import ForcePasswordChange from './components/ForcePasswordChange';
import History from './components/History';
import WhatsAppAutomation from './components/WhatsAppAutomation';
import SocialAssistance from './components/SocialAssistance';
import Training from './components/Training';
import IndicacoesCargos from './components/IndicacoesCargos';
import { AlertTriangle } from 'lucide-react';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-center">
          <div className="bg-slate-900 border border-red-500/20 p-10 rounded-[40px] max-w-lg w-full space-y-6 shadow-2xl">
            <div className="w-20 h-20 bg-red-500/10 text-red-500 rounded-3xl flex items-center justify-center mx-auto border border-red-500/20">
              <AlertTriangle size={40} />
            </div>
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Algo deu errado</h2>
            <p className="text-slate-400">Ocorreu um erro inesperado na renderização. Tente recarregar a página.</p>
            <div className="bg-slate-950 p-4 rounded-2xl text-left overflow-auto max-h-32 scrollbar-thin scrollbar-thumb-slate-800">
              <code className="text-[10px] text-red-400 font-mono italic">{this.state.error?.message}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full bg-slate-800 hover:bg-slate-700 text-white font-bold py-4 rounded-2xl transition-all"
            >
              Recarregar Sistema
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function AppContent() {
  const { user, profile, loading, isSuperAdmin } = useAuth();
  const [activeTab, setActiveTab] = useState('dashboard');

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-slate-950">
        <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Login />;
  }

  if (profile?.requirePasswordChange) {
    return <ForcePasswordChange />;
  }

  return (
    <ErrorBoundary>
      <LocalAuthBarrier>
        <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'saas' && isSuperAdmin && <SaaSAdmin />}
          {activeTab === 'agenda' && <Agenda />}
          {activeTab === 'atendimentos' && <Atendimentos />}
          {activeTab === 'medico' && <AtendimentosMedicos />}
          {activeTab === 'auxilio' && <SocialAssistance />}
          {activeTab === 'indicacoes' && <IndicacoesCargos />}
          {activeTab === 'malotes' && <Malotes />}
          {activeTab === 'demandas' && <Demandas />}
          {activeTab === 'sugestoes' && <Sugestoes />}
          {activeTab === 'relatorios' && <Relatorios />}
          {activeTab === 'training' && <Training />}
          {activeTab === 'whatsapp' && <WhatsAppAutomation />}
          {activeTab === 'history' && <History />}
          {activeTab === 'config' && <Settings />}
        </Layout>
      </LocalAuthBarrier>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

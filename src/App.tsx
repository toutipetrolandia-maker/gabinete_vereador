import { useState } from 'react';
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
    <LocalAuthBarrier>
      <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
        {activeTab === 'dashboard' && <Dashboard />}
        {activeTab === 'saas' && isSuperAdmin && <SaaSAdmin />}
        {activeTab === 'agenda' && <Agenda />}
        {activeTab === 'atendimentos' && <Atendimentos />}
        {activeTab === 'medico' && <AtendimentosMedicos />}
        {activeTab === 'malotes' && <Malotes />}
        {activeTab === 'demandas' && <Demandas />}
        {activeTab === 'sugestoes' && <Sugestoes />}
        {activeTab === 'relatorios' && <Relatorios />}
        {activeTab === 'whatsapp' && <WhatsAppAutomation />}
        {activeTab === 'history' && <History />}
        {activeTab === 'config' && <Settings />}
      </Layout>
    </LocalAuthBarrier>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

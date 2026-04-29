import { useState } from 'react';
import { AuthProvider, useAuth } from './hooks/useAuth';
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

function AppContent() {
  const { user, loading } = useAuth();
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

  return (
    <Layout activeTab={activeTab} setActiveTab={setActiveTab}>
      {activeTab === 'dashboard' && <Dashboard />}
      {activeTab === 'atendimentos' && <Atendimentos />}
      {activeTab === 'medico' && <AtendimentosMedicos />}
      {activeTab === 'malotes' && <Malotes />}
      {activeTab === 'demandas' && <Demandas />}
      {activeTab === 'sugestoes' && <Sugestoes />}
      {activeTab === 'relatorios' && <Relatorios />}
      {activeTab === 'config' && <Settings />}
    </Layout>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

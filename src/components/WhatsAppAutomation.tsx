import React, { useState, useEffect } from 'react';
import { 
  MessageSquare, 
  Send, 
  Settings as SettingsIcon, 
  Plus, 
  Trash2, 
  Save, 
  CheckCircle2,
  Info,
  Smartphone,
  Zap,
  Layout
} from 'lucide-react';
import { doc, onSnapshot, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { WhatsAppConfig, DEFAULT_TEMPLATES, WhatsAppTemplate } from '../lib/whatsapp';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { logAction } from '../lib/audit';
import { toast } from 'sonner';

export default function WhatsAppAutomation() {
  const { profile } = useAuth();
  const [config, setConfig] = useState<WhatsAppConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'templates' | 'config'>('templates');

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const unsub = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        const waConfig = data.whatsapp_config || {
          enabled: false,
          templates: DEFAULT_TEMPLATES,
          api_url: '',
          instance_id: '',
          token: ''
        };
        setConfig(waConfig);
      }
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  const handleSave = async (newConfig: WhatsAppConfig) => {
    if (!profile?.cabinetId) return;
    setSaving(true);
    try {
      await updateDoc(doc(db, 'cabinets', profile.cabinetId), {
        whatsapp_config: newConfig,
        updated_at: serverTimestamp()
      });
      await logAction('Atualizar WhatsApp', 'cabinets', profile.cabinetId, { next: newConfig });
      toast.success('Configurações de WhatsApp salvas com sucesso!');
    } catch (error) {
      console.error('Error saving WA config:', error);
      toast.error('Erro ao salvar as configurações.');
    } finally {
      setSaving(false);
    }
  };

  const updateTemplate = (id: string, content: string) => {
    if (!config) return;
    const newTemplates = config.templates.map(t => 
      t.id === id ? { ...t, content } : t
    );
    setConfig({ ...config, templates: newTemplates });
  };

  if (loading) return <div className="p-10 text-center text-slate-500">Carregando automação...</div>;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <MessageSquare className="text-emerald-500" size={32} />
            Mensagens Automáticas
          </h1>
          <p className="text-slate-400 mt-1">Configure modelos de mensagens e automações para o WhatsApp do gabinete.</p>
        </div>
        
        <div className="flex items-center gap-3">
          <button
            onClick={() => config && handleSave(config)}
            disabled={saving}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg shadow-emerald-900/20 transition-all disabled:opacity-50"
          >
            <Save size={18} />
            {saving ? 'Salvando...' : 'Salvar Alterações'}
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Control Panel */}
        <div className="lg:col-span-1 space-y-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6">
            <div className="space-y-4">
              <button
                onClick={() => setActiveTab('templates')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  activeTab === 'templates' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-800"
                )}
              >
                <Layout size={18} />
                Planos de Mensagem
              </button>
              <button
                onClick={() => setActiveTab('config')}
                className={cn(
                  "w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all font-medium",
                  activeTab === 'config' ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : "text-slate-400 hover:bg-slate-800"
                )}
              >
                <SettingsIcon size={18} />
                API de Conexão
              </button>
            </div>

            <div className="pt-6 border-t border-slate-800">
               <div className="flex items-center justify-between p-4 bg-slate-950 rounded-2xl border border-slate-800">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest">Status</span>
                     <span className={cn(
                       "text-xs font-bold",
                       config?.enabled ? "text-emerald-500" : "text-amber-500"
                     )}>
                        {config?.enabled ? "Ativado" : "Apenas Links"}
                     </span>
                  </div>
                  <button
                    onClick={() => config && setConfig({ ...config, enabled: !config.enabled })}
                    className={cn(
                      "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                      config?.enabled ? "bg-emerald-600" : "bg-slate-700"
                    )}
                  >
                    <span className={cn(
                      "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                      config?.enabled ? "translate-x-6" : "translate-x-1"
                    )} />
                  </button>
               </div>
            </div>
          </div>

          <div className="bg-blue-600/5 border border-blue-500/10 rounded-3xl p-6">
             <div className="flex items-center gap-3 text-blue-400 mb-3 font-bold text-sm">
                <Zap size={16} />
                Dica Rápida
             </div>
             <p className="text-[11px] text-slate-400 leading-relaxed">
                Use <code className="text-blue-300">{"{{nome}}"}</code> para inserir o nome do cidadão automaticamente nas mensagens. O sistema irá preencher os dados antes de enviar.
             </p>
          </div>
        </div>

        {/* Content Area */}
        <div className="lg:col-span-3">
          <AnimatePresence mode="wait">
            {activeTab === 'templates' ? (
              <motion.div
                key="templates"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="grid grid-cols-1 md:grid-cols-2 gap-6"
              >
                {config?.templates.map((template) => (
                  <div key={template.id} className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-sm hover:border-emerald-500/30 transition-all flex flex-col h-full">
                    <div className="flex items-center justify-between mb-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
                           <Send size={18} />
                        </div>
                        <div>
                          <h3 className="font-bold text-white">{template.name}</h3>
                          <span className="text-[10px] uppercase font-black text-slate-500 tracking-wider">Trigger: {template.trigger}</span>
                        </div>
                      </div>
                    </div>

                    <textarea
                      value={template.content}
                      onChange={(e) => updateTemplate(template.id, e.target.value)}
                      className="flex-1 w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-sm text-slate-300 focus:ring-1 focus:ring-emerald-500 outline-none transition-all resize-none min-h-[140px]"
                      placeholder="Escreva sua mensagem aqui..."
                    />

                    <div className="mt-4 flex flex-wrap gap-2">
                       <span className="px-2 py-1 bg-slate-800 rounded text-[9px] font-mono text-slate-500">{"{{nome}}"}</span>
                       <span className="px-2 py-1 bg-slate-800 rounded text-[9px] font-mono text-slate-500">{"{{id}}"}</span>
                       {template.trigger === 'status_update' && (
                         <span className="px-2 py-1 bg-slate-800 rounded text-[9px] font-mono text-slate-500">{"{{status}}"}</span>
                       )}
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div
                key="config"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-8"
              >
                <div className="space-y-4">
                  <h2 className="text-xl font-bold text-white flex items-center gap-3">
                    <Zap className="text-amber-500" size={24} />
                    Configuração de API
                  </h2>
                  <p className="text-slate-400 text-sm">
                    Para habilitar o envio automático silencioso, você precisa conectar uma instância do WhatsApp via API. Recomendamos a <strong>Evolution API</strong>. Se não configurado, o sistema usará links convencionais.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                   <div className="space-y-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">URL da API</label>
                         <input 
                           type="url"
                           value={config?.api_url || ''}
                           onChange={(e) => config && setConfig({ ...config, api_url: e.target.value })}
                           className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-300 focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm"
                           placeholder="https://sua-api.com"
                         />
                      </div>
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">ID da Instância</label>
                         <input 
                           type="text"
                           value={config?.instance_id || ''}
                           onChange={(e) => config && setConfig({ ...config, instance_id: e.target.value })}
                           className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-mono"
                           placeholder="Nome_da_Instancia"
                         />
                      </div>
                   </div>

                   <div className="space-y-4">
                      <div className="space-y-2">
                         <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Token de Autenticação (ApyKey)</label>
                         <input 
                           type="password"
                           value={config?.token || ''}
                           onChange={(e) => config && setConfig({ ...config, token: e.target.value })}
                           className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-white focus:ring-1 focus:ring-blue-500 outline-none transition-all text-sm font-mono"
                           placeholder="••••••••••••••••"
                         />
                      </div>
                      
                      <div className="bg-slate-950 p-6 rounded-2xl border border-slate-800 space-y-3">
                         <div className="flex items-center gap-2 text-emerald-500 font-bold text-xs uppercase">
                            <CheckCircle2 size={16} />
                            Vantagens da API
                         </div>
                         <ul className="space-y-2">
                            <li className="text-[10px] text-slate-500 flex items-center gap-2">
                               <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                               Envio imediato sem trocar de tela
                            </li>
                            <li className="text-[10px] text-slate-500 flex items-center gap-2">
                               <div className="w-1 h-1 bg-emerald-500 rounded-full" />
                               Relatório de mensagens enviadas
                            </li>
                         </ul>
                      </div>
                   </div>
                </div>

                <div className="p-6 bg-amber-500/5 border border-amber-500/10 rounded-2xl flex items-start gap-4">
                   <Info className="text-amber-500 shrink-0" size={20} />
                   <p className="text-xs text-amber-500 font-medium">
                      Nota: O envio via API requer serviços de terceiros. Se você deixar desativado, o sistema funcionará perfeitamente abrindo o WhatsApp Web/App com a mensagem escrita para você apenas clicar em enviar.
                   </p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}

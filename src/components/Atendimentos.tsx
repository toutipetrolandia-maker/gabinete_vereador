import React, { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Search, 
  Filter, 
  MoreHorizontal, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  X,
  Edit2,
  Trash2,
  Calendar as CalendarIcon,
  List as ListIcon,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Stethoscope,
  ExternalLink,
  History,
  User,
  MapPin,
  Send
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatProperName } from '../lib/utils';
import { MapContainer, TileLayer, Marker, useMapEvents } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icons in leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function LocationMarker({ position, setPosition }: { position: [number, number] | null, setPosition: (pos: [number, number]) => void }) {
  useMapEvents({
    click(e) {
      setPosition([e.latlng.lat, e.latlng.lng]);
    },
  });

  return position === null ? null : (
    <Marker position={position} />
  );
}

import { 
  format, 
  startOfMonth, 
  endOfMonth, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isSameMonth, 
  isSameDay, 
  addMonths, 
  subMonths,
  isToday
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { getWhatsAppLink, formatWhatsAppMessage, WhatsAppConfig } from '../lib/whatsapp';

export default function Atendimentos() {
  const { profile, user } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [atendimentos, setAtendimentos] = useState<any[]>([]);
  const [medicos, setMedicos] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [searchCPF, setSearchCPF] = useState('');
  const [searchPhone, setSearchPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<'list' | 'calendar'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTypeFilter, setActiveTypeFilter] = useState('Todos');
  const [protocolError, setProtocolError] = useState<string | null>(null);
  const [validatingProtocol, setValidatingProtocol] = useState(false);

  // States for cross-data
  const [medicalHistory, setMedicalHistory] = useState<any[]>([]);
  const [searchingMedical, setSearchingMedical] = useState(false);
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);

  useEffect(() => {
    if (!profile?.cabinetId) return;
    const unsub = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        setWaConfig(snap.data().whatsapp_config);
      }
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  const sendWAMessage = (item: any, trigger: 'welcome' | 'status_update') => {
    if (!item.telefone) return;
    const template = waConfig?.templates?.find(t => t.trigger === trigger);
    const content = template?.content || (trigger === 'welcome' ? 'Olá {{nome}}, recebemos seu contato.' : 'Olá {{nome}}, seu status foi atualizado para {{status}}.');
    
    const message = formatWhatsAppMessage(content, {
      nome: item.nome_completo,
      status: item.status,
      id: item.protocolo || item.id,
      titulo: item.tipo_atendimento
    });

    window.open(getWhatsAppLink(item.telefone, message), '_blank');
  };

  const initialForm = {
    nome_completo: '',
    cpf: '',
    telefone: '',
    email: '',
    endereco: '',
    bairro: '',
    zona_rural: false,
    tipo_atendimento: 'Geral',
    protocolo: '',
    status: 'Novo',
    prioridade: 'Média',
    descricao: '',
    lgpd_consent: false,
    latitude: null as number | null,
    longitude: null as number | null,
  };

  // Masks
  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, '')
      .replace(/(\d{2})(\d)/, '($1) $2')
      .replace(/(\d{5})(\d)/, '$1-$2')
      .replace(/(-\d{4})\d+?$/, '$1');
  };

  const normalizeCPF = (val: string) => val.replace(/\D/g, '');

  // Form State
  const [formData, setFormData] = useState(initialForm);

  const fetchMedicalHistory = async (cpf: string) => {
    const maskedCPF = maskCPF(cpf);
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length < 11 || !profile?.cabinetId) return;
    
    setSearchingMedical(true);
    try {
      // Search for both masked and potentially unmasked (standardizing on masked since that's what the UI saves)
      const q = query(
        collection(db, 'atendimentos_medicos'), 
        where('cabinetId', '==', profile?.cabinetId),
        where('cpf', '==', maskedCPF), 
        orderBy('created_at', 'desc')
      );
      const querySnapshot = await getDocs(q);
      setMedicalHistory(querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    } catch (error) {
      console.error("Error fetching medical history:", error);
    } finally {
      setSearchingMedical(false);
    }
  };

  const generateProtocol = () => {
    const year = new Date().getFullYear();
    const random = Math.floor(1000 + Math.random() * 9000);
    const prot = `PROT-${year}-${random}`;
    setFormData(prev => ({ ...prev, protocolo: prot }));
    setProtocolError(null);
  };

  const validateProtocolPattern = (prot: string) => {
    const pattern = /^PROT-\d{4}-\d{4}$/;
    return pattern.test(prot);
  };

  useEffect(() => {
    if (!profile?.cabinetId) return;

    setLoading(true);
    const q1 = query(
      collection(db, 'atendimentos'), 
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q1, (snap) => {
      setAtendimentos(snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        sourceCollection: 'atendimentos' 
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'atendimentos');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.cabinetId]);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q2 = query(
      collection(db, 'atendimentos_medicos'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );

    const unsubscribe = onSnapshot(q2, (snap) => {
      setMedicos(snap.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data(), 
        tipo_atendimento: 'Médico',
        sourceCollection: 'atendimentos_medicos' 
      })));
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'atendimentos_medicos');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile?.cabinetId]);

  useEffect(() => {
    const combined = [...atendimentos, ...medicos];
    combined.sort((a, b) => {
      const dateA = a.created_at?.toDate ? a.created_at.toDate() : a.created_at ? new Date(a.created_at) : new Date(0);
      const dateB = b.created_at?.toDate ? b.created_at.toDate() : b.created_at ? new Date(b.created_at) : new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
    setData(combined);
    setLoading(false);
  }, [atendimentos, medicos]);

  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.lgpd_consent) {
      alert("O cidadão deve consentir com a LGPD para realizar o cadastro.");
      return;
    }

    setSubmitting(true);
    try {
      if (formData.protocolo) {
        if (!validateProtocolPattern(formData.protocolo)) {
          setProtocolError("O protocolo deve seguir o padrão PROT-AAAA-NNNN (Ex: PROT-2024-0015)");
          setSubmitting(false);
          return;
        }

        setValidatingProtocol(true);
        try {
          const q = query(collection(db, 'atendimentos'), where('protocolo', '==', formData.protocolo));
          const snap = await getDocs(q);
          const exists = snap.docs.some(doc => doc.id !== editingId);
          if (exists) {
            setProtocolError("Este número de protocolo já está em uso. Por favor, utilize outro.");
            setValidatingProtocol(false);
            setSubmitting(false);
            return;
          }
        } catch (err) {
          console.error("Erro ao validar protocolo:", err);
        } finally {
          setValidatingProtocol(false);
        }
      }

      const payload = {
        ...formData,
        nome_completo: formatProperName(formData.nome_completo),
        cabinetId: profile?.cabinetId,
        usuario_id: user?.uid,
        assessor_id: user?.uid, // Send both for compatibility
        updated_at: serverTimestamp(),
      };

      if (editingId) {
        const existingDoc = data.find(i => i.id === editingId);
        const collectionName = existingDoc?.sourceCollection === 'atendimentos_medicos' ? 'atendimentos_medicos' : 'atendimentos';
        await updateDoc(doc(db, collectionName, editingId), payload);
        await logAction('Atualizar', collectionName, editingId, { previous: existingDoc, next: formData, cabinetId: profile.cabinetId });
      } else {
        const docRef = await addDoc(collection(db, 'atendimentos'), {
          ...payload,
          created_at: serverTimestamp(),
        });
        await logAction('Criar', 'atendimentos', docRef.id, { next: formData, cabinetId: profile.cabinetId });
      }
      
      closeModal();
    } catch (err: any) {
      console.error("Submit error:", err);
      
      let errorMsg = "Ocorreu um erro ao salvar o registro. Verifique sua conexão e tente novamente.";
      
      if (err?.message?.includes('permission-denied') || err?.code === 'permission-denied') {
        errorMsg = "Permissão negada. Verifique se seu perfil está ativo e se você tem permissão para realizar esta operação.";
      } else if (!navigator.onLine) {
        errorMsg = "Você parece estar offline. Verifique sua rede.";
      }

      alert(errorMsg);
      handleFirestoreError(err, OperationType.WRITE, 'atendimentos');
    } finally {
      setSubmitting(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const existing = data.find(i => i.id === id);
      const collectionName = existing?.sourceCollection === 'atendimentos_medicos' ? 'atendimentos_medicos' : 'atendimentos';
      await updateDoc(doc(db, collectionName, id), {
        status: newStatus,
        updated_at: serverTimestamp()
      });
      await logAction('Atualizar', collectionName, id, { previous: { status: existing?.status }, next: { status: newStatus }, cabinetId: profile.cabinetId });
    } catch (err) {
      const existing = data.find(i => i.id === id);
      const collectionName = existing?.sourceCollection === 'atendimentos_medicos' ? 'atendimentos_medicos' : 'atendimentos';
      handleFirestoreError(err, OperationType.UPDATE, `${collectionName}/${id}`);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(initialForm);
    setMedicalHistory([]);
    setProtocolError(null);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nome_completo: item.nome_completo || '',
      cpf: item.cpf || '',
      telefone: item.telefone || '',
      email: item.email || '',
      endereco: item.endereco || '',
      bairro: item.bairro || '',
      zona_rural: item.zona_rural || false,
      tipo_atendimento: item.tipo_atendimento || 'Geral',
      protocolo: item.protocolo || '',
      status: item.status || 'Novo',
      prioridade: item.prioridade || 'Média',
      descricao: item.descricao || '',
      lgpd_consent: item.lgpd_consent || false,
      latitude: item.latitude || null,
      longitude: item.longitude || null,
    });
    if (item.cpf) fetchMedicalHistory(item.cpf);
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Tem certeza que deseja excluir este atendimento?')) return;
    try {
      const existing = data.find(i => i.id === id);
      const collectionName = existing?.sourceCollection === 'atendimentos_medicos' ? 'atendimentos_medicos' : 'atendimentos';
      await deleteDoc(doc(db, collectionName, id));
      await logAction('Excluir', collectionName, id, { previous: existing, cabinetId: profile.cabinetId });
    } catch (err) {
      const existing = data.find(i => i.id === id);
      const collectionName = existing?.sourceCollection === 'atendimentos_medicos' ? 'atendimentos_medicos' : 'atendimentos';
      handleFirestoreError(err, OperationType.DELETE, `${collectionName}/${id}`);
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.nome_completo?.toLowerCase().includes(search.toLowerCase()) ||
      item.cpf?.includes(search) ||
      item.telefone?.includes(search) ||
      item.descricao?.toLowerCase().includes(search.toLowerCase());
    
    const matchesCPF = !searchCPF || normalizeCPF(item.cpf || '').includes(normalizeCPF(searchCPF));
    const matchesPhone = !searchPhone || item.telefone?.replace(/\D/g, '').includes(searchPhone.replace(/\D/g, ''));
    
    const matchesType = activeTypeFilter === 'Todos' || item.tipo_atendimento === activeTypeFilter;
    
    return matchesSearch && matchesCPF && matchesPhone && matchesType;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Atendimentos</h1>
          <p className="text-slate-400 text-sm">Gerencie os atendimentos gerais do gabinete.</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 shrink-0">
            <button 
              onClick={() => setViewMode('list')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'list' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
              title="Lista"
            >
              <ListIcon size={18} />
            </button>
            <button 
              onClick={() => setViewMode('calendar')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'calendar' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
              title="Calendário"
            >
              <CalendarIcon size={18} />
            </button>
          </div>
          {profile?.role !== 'consulta' && (
            <button 
              onClick={() => setShowModal(true)}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 w-full sm:w-auto"
            >
              <Plus size={20} />
              <span className="font-semibold hidden sm:inline">Novo Atendimento</span>
            </button>
          )}
        </div>
      </div>

      {/* Filters/Search Bar */}
      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap gap-2">
          {['Todos', 'Geral', 'Médico', 'Demanda', 'Sugestão'].map((type) => (
            <button
              key={type}
              onClick={() => setActiveTypeFilter(type)}
              className={cn(
                "px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all border",
                activeTypeFilter === type 
                  ? "bg-blue-600 border-blue-500 text-white shadow-lg shadow-blue-900/20" 
                  : "bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300 hover:border-slate-700"
              )}
            >
              {type}
            </button>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por nome ou descrição..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 md:py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-sm md:text-base"
            />
          </div>
          <div className="relative flex-1 max-w-xs">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por CPF..."
              value={searchCPF}
              onChange={(e) => setSearchCPF(maskCPF(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 md:py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-sm md:text-base font-mono"
            />
          </div>
          <div className="relative flex-1 max-w-xs">
            <MessageCircle className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
            <input 
              type="text" 
              placeholder="Buscar por Telefone..."
              value={searchPhone}
              onChange={(e) => setSearchPhone(maskPhone(e.target.value))}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl py-3 md:py-2 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all text-sm md:text-base"
            />
          </div>
          {viewMode === 'calendar' && (
            <div className="flex items-center gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2 py-1">
              <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                <ChevronLeft size={18} />
              </button>
              <span className="text-sm font-bold text-white uppercase min-w-[120px] text-center">
                {format(currentMonth, 'MMMM yyyy', { locale: ptBR })}
              </span>
              <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors">
                <ChevronRight size={18} />
              </button>
            </div>
          )}
          <button className="bg-slate-900 border border-slate-800 px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 text-slate-400 hover:text-white transition-all w-full sm:w-auto">
            <Filter size={18} />
            <span className="text-sm font-medium">Filtros Avançados</span>
          </button>
        </div>
      </div>

      {viewMode === 'list' ? (
        /* Table */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
          <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-slate-800">
            <table className="w-full text-left min-w-[800px]">
              <thead>
                <tr className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <th className="px-6 py-4 font-medium">Paciente / Cidadão</th>
                  <th className="px-6 py-4 font-medium">Tipo</th>
                  <th className="px-6 py-4 font-medium">Status / Prioridade</th>
                  <th className="px-6 py-4 font-medium">Data</th>
                  <th className="px-6 py-4 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800">
                {loading ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">Carregando...</td>
                  </tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-10 text-center text-slate-500">Nenhum registro encontrado.</td>
                  </tr>
                ) : filteredData.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-800/30 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex flex-col">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-slate-200">{item.nome_completo}</span>
                          {item.protocolo && (
                            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-blue-600/10 text-blue-400 border border-blue-500/20 rounded-lg font-mono text-[10px] font-bold shadow-sm shadow-blue-900/10">
                              <span className="text-[8px] opacity-50 uppercase tracking-widest font-black">prot</span>
                              {item.protocolo}
                            </span>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 mt-1">
                          <span className="text-[10px] text-slate-500">{item.cpf}</span>
                          <span className="text-[10px] text-slate-600">•</span>
                          <div className="flex items-center gap-1">
                            <span className="text-[10px] text-slate-500">{item.telefone}</span>
                            {item.telefone && (
                              <button 
                                onClick={() => sendWAMessage(item, 'welcome')}
                                className="text-emerald-500 hover:text-emerald-400 transition-colors"
                                title="Enviar Boas-vindas"
                              >
                                <MessageCircle size={10} />
                              </button>
                            )}
                          </div>
                          {(item.endereco || item.bairro) && (
                            <>
                              <span className="text-[10px] text-slate-600">•</span>
                              <span className="text-[10px] text-slate-500 font-medium italic truncate max-w-[200px]">
                                {item.endereco}{item.endereco && item.bairro ? ', ' : ''}{item.bairro}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-300">
                        {item.tipo_atendimento}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className={cn(
                            "w-1.5 h-1.5 rounded-full",
                            item.status === 'Concluído' || item.status === 'Finalizado' ? "bg-emerald-400" :
                            item.status === 'Novo' ? "bg-blue-400" :
                            item.status === 'Encaminhado' ? "bg-purple-400" :
                            "bg-amber-400"
                          )} />
                          <span className={cn(
                            "text-xs font-medium",
                            item.status === 'Concluído' || item.status === 'Finalizado' ? "text-emerald-400" :
                            item.status === 'Novo' ? "text-blue-400" :
                            item.status === 'Encaminhado' ? "text-purple-400" :
                            "text-amber-400"
                          )}>{item.status}</span>
                        </div>
                        <span className={cn(
                          "text-[10px] uppercase font-bold tracking-tight",
                          item.prioridade === 'Alta' ? "text-red-400" :
                          item.prioridade === 'Média' ? "text-amber-400" :
                          "text-slate-500"
                        )}>{item.prioridade}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">
                      {item.created_at?.toDate ? format(item.created_at.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) : '...'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         {profile?.role !== 'consulta' && (
                           <>
                             <button 
                               onClick={() => updateStatus(item.id, 'Finalizado')}
                               className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 transition-all opacity-0 group-hover:opacity-100"
                               title="Concluir"
                             >
                               <CheckCircle2 size={16} />
                             </button>
                             <button 
                               onClick={() => sendWAMessage(item, 'status_update')}
                               className="p-1.5 rounded-lg hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400 transition-all opacity-0 group-hover:opacity-100"
                               title="Notificar Status"
                             >
                               <Send size={16} />
                             </button>
                             <button 
                               onClick={() => handleEdit(item)}
                               className="p-1.5 rounded-lg hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 transition-all opacity-0 group-hover:opacity-100"
                               title="Editar"
                             >
                               <Edit2 size={16} />
                             </button>
                             {(profile?.role === 'admin' || profile?.role === 'secretaria_parlamentar') && (
                               <button 
                                 onClick={() => handleDelete(item.id)}
                                 className="p-1.5 rounded-lg hover:bg-red-500/10 text-slate-500 hover:text-red-400 transition-all opacity-0 group-hover:opacity-100"
                                 title="Excluir"
                               >
                                 <Trash2 size={16} />
                               </button>
                             )}
                           </>
                         )}
                         <button className="p-1.5 rounded-lg hover:bg-slate-700 text-slate-500 hover:text-white transition-all">
                           <MoreHorizontal size={16} />
                         </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* Calendar View */
        <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-xl flex flex-col">
          <div className="grid grid-cols-7 border-b border-slate-800 bg-slate-950/50">
            {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
              <div key={day} className="px-4 py-3 text-[10px] font-bold uppercase tracking-widest text-slate-500 text-center border-r border-slate-800 last:border-r-0">
                {day}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {(() => {
              const start = startOfWeek(startOfMonth(currentMonth));
              const end = endOfWeek(endOfMonth(currentMonth));
              const days = eachDayOfInterval({ start, end });
              
              return days.map((day, idx) => {
                const dayAppointments = filteredData.filter(item => {
                  const date = item.created_at?.toDate ? item.created_at.toDate() : null;
                  return date && isSameDay(date, day);
                });
                
                return (
                  <div 
                    key={day.toISOString()} 
                    className={cn(
                      "min-h-[140px] p-2 border-r border-b border-slate-800 relative transition-colors",
                      !isSameMonth(day, currentMonth) ? "bg-slate-950/30" : "bg-slate-900/50 hover:bg-slate-800/10",
                      (idx + 1) % 7 === 0 ? "border-r-0" : ""
                    )}
                  >
                    <div className="flex justify-between items-start mb-2">
                       <span className={cn(
                         "flex items-center justify-center w-7 h-7 text-xs font-bold rounded-full",
                         isToday(day) ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" : 
                         isSameMonth(day, currentMonth) ? "text-slate-300" : "text-slate-600"
                       )}>
                         {format(day, 'd')}
                       </span>
                       {dayAppointments.length > 0 && (
                         <span className="text-[10px] font-bold text-slate-500 bg-slate-800 px-1.5 py-0.5 rounded-md">
                           {dayAppointments.length}
                         </span>
                       )}
                    </div>
                    <div className="space-y-1 overflow-y-auto max-h-[100px] scrollbar-none">
                      {dayAppointments.slice(0, 3).map(item => (
                        <div 
                          key={item.id}
                          onClick={() => handleEdit(item)}
                          className={cn(
                            "group cursor-pointer px-2 py-1 rounded-md border text-[10px] font-medium transition-all hover:translate-x-1",
                            item.status === 'Concluído' || item.status === 'Finalizado' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20" :
                            item.status === 'Novo' ? "bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20" :
                            item.status === 'Encaminhado' ? "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500/20" :
                            "bg-amber-500/10 border-amber-500/20 text-amber-400 hover:bg-amber-500/20"
                          )}
                        >
                          <div className="truncate">{item.nome_completo}</div>
                        </div>
                      ))}
                      {dayAppointments.length > 3 && (
                        <div className="text-[9px] text-slate-500 text-center font-bold uppercase py-1">
                          + {dayAppointments.length - 3} mais
                        </div>
                      )}
                    </div>
                  </div>
                );
              });
            })()}
          </div>
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60]"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="fixed inset-x-2 top-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[900px] md:h-auto md:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl z-[70] overflow-hidden flex flex-col"
            >
               <div className="flex flex-col md:flex-row h-full overflow-hidden">
                 <div className="flex-1 overflow-y-auto p-6 md:p-8 space-y-6 border-r border-slate-800">
                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h2 className="text-lg md:text-xl font-bold text-white tracking-tight">{editingId ? 'Editar Atendimento' : 'Novo Atendimento'}</h2>
                        <p className="text-slate-500 text-xs md:text-sm font-sans">Preencha as informações para registro.</p>
                      </div>
                      <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg transition-colors md:hidden">
                        <X size={20} className="text-slate-400" />
                      </button>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-6">
                      {/* Mobile Medical History Alert */}
                      {medicalHistory.length > 0 && (
                        <div className="md:hidden bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-2xl flex items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                                 <Stethoscope size={16} className="text-emerald-400" />
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">Histórico Médico Encontrado</span>
                                 <span className="text-[10px] text-slate-400">{medicalHistory.length} registros anteriores vinculados</span>
                              </div>
                           </div>
                           <button 
                             type="button"
                             onClick={() => {
                               const el = document.getElementById('mobile-history-section');
                               el?.scrollIntoView({ behavior: 'smooth' });
                             }}
                             className="bg-emerald-600 text-white p-2 rounded-xl"
                           >
                             <History size={18} />
                           </button>
                        </div>
                      )}

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2 col-span-2">
                          <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center justify-between">
                            <span>Número do Protocolo</span>
                            {!editingId && (
                              <button 
                                type="button"
                                onClick={generateProtocol}
                                className="text-[10px] text-blue-400 hover:text-blue-300 font-bold uppercase transition-colors"
                              >
                                [ Gerar Automático ]
                              </button>
                            )}
                          </label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={formData.protocolo}
                              onChange={e => {
                                setFormData({...formData, protocolo: e.target.value.toUpperCase()});
                                if (protocolError) setProtocolError(null);
                              }}
                              className={cn(
                                "w-full bg-slate-800 border rounded-xl py-3 px-4 focus:outline-none transition-colors font-mono",
                                protocolError ? "border-red-500 focus:border-red-500" : "border-slate-700 focus:border-blue-500"
                              )}
                              placeholder="PROT-2024-0001"
                            />
                            {validatingProtocol && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                          {protocolError && (
                            <p className="text-[10px] text-red-400 font-medium mt-1 flex items-center gap-1">
                              <AlertCircle size={10} />
                              {protocolError}
                            </p>
                          )}
                        </div>
                        <div className="space-y-2 col-span-2 md:col-span-1">
                          <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Nome Completo</label>
                          <input 
                            required
                            type="text" 
                            value={formData.nome_completo}
                            onChange={e => setFormData({...formData, nome_completo: e.target.value})}
                            className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                            placeholder="Ex: João da Silva"
                          />
                        </div>
                        <div className="space-y-2 col-span-2 md:col-span-1">
                          <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">CPF</label>
                          <div className="relative">
                            <input 
                              type="text" 
                              value={formData.cpf}
                              onChange={e => {
                                const val = maskCPF(e.target.value);
                                setFormData({...formData, cpf: val});
                                if (val.replace(/\D/g, '').length === 11) {
                                  fetchMedicalHistory(val);
                                } else {
                                  setMedicalHistory([]);
                                }
                              }}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors pr-10"
                              placeholder="000.000.000-00"
                            />
                            {searchingMedical && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                        </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Telefone</label>
                    <input 
                      type="tel" 
                      value={formData.telefone}
                      onChange={e => setFormData({...formData, telefone: maskPhone(e.target.value)})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="(00) 00000-0000"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">E-mail</label>
                    <input 
                      type="email" 
                      value={formData.email}
                      onChange={e => setFormData({...formData, email: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="email@exemplo.com"
                    />
                  </div>
                  <div className="space-y-2 col-span-2 md:col-span-1">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Endereço</label>
                    <input 
                      type="text" 
                      value={formData.endereco}
                      onChange={e => setFormData({...formData, endereco: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Rua, Número, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Bairro</label>
                    <input 
                      type="text" 
                      value={formData.bairro}
                      onChange={e => setFormData({...formData, bairro: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors"
                      placeholder="Nome do bairro"
                    />
                  </div>
                  <div className="space-y-2 flex items-center gap-3 pt-6">
                    <input 
                      type="checkbox" 
                      id="zona_rural"
                      checked={formData.zona_rural}
                      onChange={(e) => setFormData({...formData, zona_rural: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="zona_rural" className="text-xs font-semibold uppercase text-slate-500 tracking-wider cursor-pointer">Zona Rural</label>
                  </div>

                  {formData.zona_rural && (
                    <div className="col-span-2 space-y-2">
                      <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider flex items-center gap-2">
                        <MapPin size={14} className="text-blue-500" />
                        Localização Geográfica (Zona Rural)
                      </label>
                      <div className="h-64 rounded-2xl overflow-hidden border border-slate-700 relative z-0">
                        <MapContainer 
                          center={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : [-8.7183, -38.2173]} 
                          zoom={13} 
                          style={{ height: '100%', width: '100%' }}
                        >
                          <TileLayer
                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                          />
                          <LocationMarker 
                            position={formData.latitude && formData.longitude ? [formData.latitude, formData.longitude] : null} 
                            setPosition={(pos) => setFormData({...formData, latitude: pos[0], longitude: pos[1]})} 
                          />
                        </MapContainer>
                      </div>
                      <p className="text-[10px] text-slate-500 italic">Clique no mapa para marcar a localização aproximada da residência ou pedido.</p>
                      {formData.latitude && (
                        <div className="flex gap-2">
                          <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">LAT: {formData.latitude.toFixed(6)}</span>
                          <span className="text-[10px] bg-slate-800 px-2 py-1 rounded text-slate-400 font-mono">LNG: {formData.longitude?.toFixed(6)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Tipo de Atendimento</label>
                    <select 
                      value={formData.tipo_atendimento}
                      onChange={e => setFormData({...formData, tipo_atendimento: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option>Geral</option>
                      <option>Médico</option>
                      <option>Demanda</option>
                      <option>Sugestão</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Status</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option>Novo</option>
                      <option>Em andamento</option>
                      <option>Concluído</option>
                      <option>Finalizado</option>
                      <option>Encaminhado</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Prioridade</label>
                    <select 
                      value={formData.prioridade}
                      onChange={e => setFormData({...formData, prioridade: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option>Baixa</option>
                      <option>Média</option>
                      <option>Alta</option>
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Descrição / Demanda</label>
                  <textarea 
                    rows={4}
                    value={formData.descricao}
                    onChange={e => setFormData({...formData, descricao: e.target.value})}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors resize-none"
                    placeholder="Descreva detalhadamente o que foi solicitado..."
                  />
                </div>

                <div className="flex items-start gap-3 p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                   <input 
                     required
                     type="checkbox" 
                     checked={formData.lgpd_consent}
                     onChange={(e) => setFormData({...formData, lgpd_consent: e.target.checked})}
                     className="mt-1 w-4 h-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500"
                   />
                   <p className="text-[10px] text-slate-400 leading-relaxed font-sans">
                      O cidadão declara estar ciente e concorda com a coleta e processamento de seus dados pessoais para fins de atendimento e gestão parlamentar, conforme as diretrizes da <strong>Lei Geral de Proteção de Dados (LGPD)</strong>.
                   </p>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={closeModal}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    disabled={submitting}
                    className={cn(
                      "flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 px-4 rounded-xl shadow-lg shadow-blue-900/20 transition-all flex items-center justify-center gap-2",
                      submitting && "opacity-70 cursor-not-allowed"
                    )}
                  >
                    {submitting ? (
                      <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : editingId ? 'Salvar Alterações' : 'Salvar Registro'}
                  </button>
                </div>
              </form>

              {/* Mobile: Dedicated section for Medical History at bottom */}
              {medicalHistory.length > 0 && (
                <div id="mobile-history-section" className="md:hidden mt-8 pt-6 border-t border-slate-800 space-y-4 pb-20">
                   <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                     <Stethoscope size={14} className="text-emerald-500" />
                     Histórico Médico Completo
                   </h3>
                  <div className="space-y-3">
                    {medicalHistory.map((h) => (
                      <div key={h.id} className="bg-slate-950 border border-slate-800 p-4 rounded-2xl">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold text-slate-500">
                            {h.created_at?.toDate ? format(h.created_at.toDate(), 'dd/MM/yyyy HH:mm') : '...'}
                          </span>
                          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1.5 py-0.5 rounded font-black uppercase">
                            {h.especialidade}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 italic mb-2">"{h.descricao_problema}"</p>
                        <div className="flex items-center justify-between text-[9px] text-slate-500">
                           <span className="flex items-center gap-1 font-bold">
                              <User size={10} />
                              Atendido por: {h.usuario_nome?.split(' ')[0]}
                           </span>
                           <span className="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-bold uppercase tracking-tight">
                              {h.status}
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Medical History Sidebar */}
            <div className="hidden md:flex w-80 bg-slate-950/50 flex-col overflow-hidden">
               <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                     <Stethoscope size={14} className="text-emerald-500" />
                     Histórico Médico
                  </h3>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg hidden md:block"><X size={20} className="text-slate-500" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-4 shadow-inner">
                 {medicalHistory.length > 0 ? (
                   medicalHistory.map((h) => (
                     <div key={h.id} className="bg-slate-900 border border-slate-800 p-4 rounded-2xl group hover:border-emerald-500/30 transition-all">
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[9px] font-bold text-slate-500 uppercase">
                           {h.created_at?.toDate ? format(h.created_at.toDate(), 'dd/MM/yyyy') : '...'}
                         </span>
                         <span className={cn(
                           "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter",
                           h.prioridade === 'Alta' ? "bg-red-500/10 text-red-400" : "bg-emerald-500/10 text-emerald-400"
                         )}>
                           {h.especialidade || 'Clínico'}
                         </span>
                       </div>
                       <p className="text-xs text-slate-300 font-medium line-clamp-3 leading-relaxed mb-2 italic">"{h.descricao_problema}"</p>
                       <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/50">
                          <div className="flex items-center gap-1">
                             <User size={10} className="text-slate-600" />
                             <span className="text-[9px] text-slate-600 font-bold">{h.usuario_nome?.split(' ')[0]}</span>
                          </div>
                          <button title="Ver atendimento médico" className="text-emerald-500 hover:text-emerald-400">
                             <ExternalLink size={12} />
                          </button>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-4">
                      <Stethoscope size={32} className="text-slate-700 mb-4" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-center">
                        Sem registros médicos vinculados a este CPF
                      </p>
                   </div>
                 )}
               </div>
            </div>
          </div>
        </motion.div>
      </>
    )}
  </AnimatePresence>
</div>
  );
}

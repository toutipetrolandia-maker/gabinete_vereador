import React, { useEffect, useState, useMemo } from 'react';
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
  Send,
  Map as MapIcon,
  Bell
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatProperName } from '../lib/utils';
import { MapContainer, TileLayer, Marker, Popup, CircleMarker, useMapEvents, useMap } from 'react-leaflet';
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

function ChangeMapView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
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
  const [viewMode, setViewMode] = useState<'list' | 'calendar' | 'map'>('list');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [activeTypeFilter, setActiveTypeFilter] = useState('Todos');
  const [protocolError, setProtocolError] = useState<string | null>(null);
  const [validatingProtocol, setValidatingProtocol] = useState(false);

  const [mapViewport, setMapViewport] = useState<{ center: [number, number]; zoom: number }>({
    center: [-8.7183, -38.2173],
    zoom: 13
  });

  const neighborhoodStats = useMemo(() => {
    const statsMap: { [key: string]: { name: string; general: number; medico: number; total: number; latSum: number; lngSum: number; coordCount: number } } = {};

    const predefinedNeighborhoodCoords: { [key: string]: [number, number] } = {
      'CENTRO': [-8.7183, -38.2173],
      'QUADRA 01': [-8.7170, -38.2120],
      'QUADRA 1': [-8.7170, -38.2120],
      'QUADRA 02': [-8.7198, -38.2135],
      'QUADRA 2': [-8.7198, -38.2135],
      'QUADRA 03': [-8.7210, -38.2155],
      'QUADRA 3': [-8.7210, -38.2155],
      'QUADRA 04': [-8.7150, -38.2190],
      'QUADRA 4': [-8.7150, -38.2190],
      'QUADRA 05': [-8.7130, -38.2210],
      'QUADRA 5': [-8.7130, -38.2210],
      'QUADRA 06': [-8.7142, -38.2250],
      'QUADRA 6': [-8.7142, -38.2250],
      'QUADRA 07': [-8.7115, -38.2230],
      'QUADRA 7': [-8.7115, -38.2230],
      'QUADRA 08': [-8.7090, -38.2180],
      'QUADRA 8': [-8.7090, -38.2180],
      'QUADRA 09': [-8.7120, -38.2150],
      'QUADRA 9': [-8.7120, -38.2150],
      'QUADRA 10': [-8.7230, -38.2090],
      'QUADRA 11': [-8.7240, -38.2100],
      'QUADRA 12': [-8.7250, -38.2110],
      'QUADRA 13': [-8.7260, -38.2120],
      'QUADRA 14': [-8.7270, -38.2130],
      'QUADRA 15': [-8.7280, -38.2140],
      'QUADRA 16': [-8.7290, -38.2150],
      'QUADRA 17': [-8.7200, -38.2200],
      'SÃO FRANCISCO': [-8.7215, -38.2250],
      'SAN FRANCISCO': [-8.7215, -38.2250],
      'VILA DE BARREIRAS': [-8.7350, -38.1950],
      'VILA DOS PESCADORES': [-8.7300, -38.2050],
      'NOME DO BAIRRO': [-8.7183, -38.2173],
      'NOVA PETROLÂNDIA': [-8.7100, -38.2050],
      'CAJUEIRO': [-8.7080, -38.2280],
      'NOSSA SENHORA DE FÁTIMA': [-8.7132, -38.2110],
      'FÁTIMA': [-8.7132, -38.2110],
      'COHAB': [-8.7050, -38.2150]
    };

    data.forEach(item => {
      const bRaw = item.bairro || '';
      const bNorm = bRaw.trim().toUpperCase();
      if (!bNorm) return;

      if (!statsMap[bNorm]) {
        statsMap[bNorm] = {
          name: formatProperName(bRaw),
          general: 0,
          medico: 0,
          total: 0,
          latSum: 0,
          lngSum: 0,
          coordCount: 0
        };
      }

      const isMed = item.sourceCollection === 'atendimentos_medicos' || item.tipo_atendimento === 'Médico';
      if (isMed) {
        statsMap[bNorm].medico += 1;
      } else {
        statsMap[bNorm].general += 1;
      }
      statsMap[bNorm].total += 1;

      if (item.latitude && item.longitude) {
        statsMap[bNorm].latSum += item.latitude;
        statsMap[bNorm].lngSum += item.longitude;
        statsMap[bNorm].coordCount += 1;
      }
    });

    const list = Object.keys(statsMap).map(key => {
      const info = statsMap[key];
      let coordinates: [number, number];

      if (info.coordCount > 0) {
        coordinates = [info.latSum / info.coordCount, info.lngSum / info.coordCount];
      } else {
        const match = predefinedNeighborhoodCoords[key];
        if (match) {
          coordinates = match;
        } else {
          let hash = 0;
          for (let i = 0; i < key.length; i++) {
            hash = key.charCodeAt(i) + ((hash << 5) - hash);
          }
          const latOffset = ((Math.abs(hash) % 1000) / 1000) * 0.012 - 0.006;
          const lngOffset = ((Math.abs(hash >> 3) % 1000) / 1000) * 0.012 - 0.006;
          coordinates = [-8.7183 + latOffset, -38.2173 + lngOffset];
        }
      }

      return {
        id: key,
        name: info.name,
        geral: info.general,
        medico: info.medico,
        total: info.total,
        coordinates
      };
    });

    return list.sort((a, b) => b.total - a.total);
  }, [data]);

  // States for cross-data
  const [medicalHistory, setMedicalHistory] = useState<any[]>([]);
  const [searchingMedical, setSearchingMedical] = useState(false);
  const [generalHistory, setGeneralHistory] = useState<any[]>([]);
  const [searchingGeneral, setSearchingGeneral] = useState(false);
  const [searchingCitizen, setSearchingCitizen] = useState(false);
  const [citizenFoundAlert, setCitizenFoundAlert] = useState<string | null>(null);
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);
  const [cabinetUsers, setCabinetUsers] = useState<any[]>([]);
  const [onlyMyAtendimentos, setOnlyMyAtendimentos] = useState(false);
  const [especialidades, setEspecialidades] = useState<{ id: string; nome: string }[]>([]);

  const todayBirthdays = useMemo(() => {
    const list: Array<{ id: string; nome: string; telefone: string; data_nascimento: string; tipo: 'Cidadão' | 'Colaborador' }> = [];
    const seenCpfs = new Set<string>();

    const isBirthdayToday = (dateStr?: string) => {
      if (!dateStr) return false;
      const parts = dateStr.split('-');
      if (parts.length !== 3) return false;
      const m = parseInt(parts[1], 10);
      const d = parseInt(parts[2], 10);
      const today = new Date();
      return m === (today.getMonth() + 1) && d === today.getDate();
    };

    // 1. Check citizens in combined data
    data.forEach(item => {
      const cpf = item.cpf || '';
      if (item.data_nascimento && isBirthdayToday(item.data_nascimento)) {
        const key = cpf || item.nome_completo;
        if (!seenCpfs.has(key)) {
          seenCpfs.add(key);
          list.push({
            id: item.id || key,
            nome: item.nome_completo,
            telefone: item.telefone || '',
            data_nascimento: item.data_nascimento,
            tipo: 'Cidadão'
          });
        }
      }
    });

    // 2. Check collaborators
    cabinetUsers.forEach(userItem => {
      if (userItem.data_nascimento && isBirthdayToday(userItem.data_nascimento)) {
        list.push({
          id: userItem.id,
          nome: userItem.nome,
          telefone: userItem.telefone || '',
          data_nascimento: userItem.data_nascimento,
          tipo: 'Colaborador'
        });
      }
    });

    return list;
  }, [data, cabinetUsers]);

  const listLembretes = useMemo(() => {
    const list: any[] = [];
    data.forEach(item => {
      if (item.sourceCollection === 'atendimentos_medicos' && item.lembrete_exame) {
        list.push({
          id: item.id,
          nome: item.nome_completo || 'Sem Nome',
          cpf: item.cpf || '',
          telefone: item.telefone || '',
          data: item.lembrete_exame,
          descricao: `Vencimento do Exame / Consulta médica`,
          atendimento: item
        });
      } else if (item.sourceCollection === 'atendimentos' && item.tem_lembrete && item.lembrete_data) {
        list.push({
          id: item.id,
          nome: item.nome_completo || 'Sem Nome',
          cpf: item.cpf || '',
          telefone: item.telefone || '',
          data: item.lembrete_data,
          descricao: item.lembrete_descricao || 'Lembrete de Vencimento',
          atendimento: item
        });
      }
    });

    list.sort((a, b) => new Date(a.data).getTime() - new Date(b.data).getTime());
    return list;
  }, [data]);

  const unifiedHistory = useMemo(() => {
    const list: any[] = [];
    
    generalHistory.forEach(item => {
      list.push({
        ...item,
        type: 'general',
        displayType: item.tipo_atendimento || 'Geral',
        title: item.tipo_atendimento || 'Atendimento Geral',
        description: item.descricao || '',
        date: item.created_at
      });
    });

    medicalHistory.forEach(item => {
      list.push({
        ...item,
        type: 'medical',
        displayType: item.especialidade ? `Médico - ${item.especialidade}` : 'Atendimento Médico',
        title: item.especialidade || 'Médico',
        description: item.descricao_problema || '',
        date: item.created_at
      });
    });

    return list.sort((a, b) => {
      const getMs = (ts: any) => {
        if (!ts) return 0;
        if (ts.toDate) return ts.toDate().getTime();
        if (ts.seconds) return ts.seconds * 1000;
        return new Date(ts).getTime();
      };
      return getMs(b.date) - getMs(a.date);
    });
  }, [generalHistory, medicalHistory]);

  const sendBirthdayWish = (item: any) => {
    if (!item.telefone) return;
    const template = waConfig?.templates?.find(t => t.trigger === 'birthday');
    let content = template?.content;
    if (!content) {
      if (item.tipo === 'Colaborador') {
        content = "Parabéns, *{{nome}}*! 🧑‍💼🎂 Nós do Gabinete temos muito orgulho em ter você em nossa equipe. Desejamos um feliz aniversário, com muita saúde, paz e realizações. Parabéns pelo seu dia! 🎉🎈";
      } else {
        content = "Olá *{{nome}}*! 🎉 Nós do Gabinete Gostaríamos de lhe desejar um feliz aniversário! Que seu novo ciclo seja repleto de realizações, saúde, sucesso e muita paz. Parabéns! 🎂🎈✨";
      }
    }
    const message = formatWhatsAppMessage(content, {
      ...item,
      nome: item.nome,
    });
    window.open(getWhatsAppLink(item.telefone, message), '_blank');
  };

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const qSpec = query(
      collection(db, "especialidades"),
      where("cabinetId", "==", profile.cabinetId),
      orderBy("nome", "asc"),
    );

    const unsubscribe = onSnapshot(qSpec, (snap) => {
      if (!snap.empty) {
        setEspecialidades(
          snap.docs.map((doc) => ({ id: doc.id, nome: doc.data().nome })),
        );
      } else {
        const defaultSpecs = [
          "Cardiologia",
          "Clínica Médica",
          "Dermatologia",
          "Endocrinologia",
          "Fisioterapia",
          "Gastroenterologia",
          "Geriatria",
          "Ginecologia e Obstetrícia",
          "Neurologia",
          "Odontologia",
          "Oftalmologia",
          "Ortopedia e Traumatologia",
          "Otorrinolaringologia",
          "Pediatria",
          "Pneumologia",
          "Psicologia",
          "Psiquiatria",
          "Urologia"
        ].map((nome, index) => ({ id: `default-${index}`, nome }));
        setEspecialidades(defaultSpecs);
      }
    });

    return () => unsubscribe();
  }, [profile?.cabinetId]);

  useEffect(() => {
    if (!profile?.cabinetId) return;
    const q = query(
      collection(db, 'users'),
      where('cabinetId', '==', profile.cabinetId)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const uList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setCabinetUsers(uList);
    }, (error) => {
      console.error("Error fetching cabinet users:", error);
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  const getAssessorName = (assessorId: string) => {
    const userObj = cabinetUsers.find(u => u.id === assessorId);
    return userObj ? userObj.nome : 'Não atribuído';
  };

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
    data_nascimento: '',
    endereco: '',
    bairro: '',
    zona_rural: false,
    tipo_atendimento: 'Geral',
    especialidade: '',
    protocolo: '',
    status: 'Novo',
    prioridade: 'Média',
    descricao: '',
    lgpd_consent: false,
    latitude: null as number | null,
    longitude: null as number | null,
    assessor_id: '',
    tem_lembrete: false,
    lembrete_data: '',
    lembrete_descricao: '',
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
      const q = query(
        collection(db, 'atendimentos_medicos'), 
        where('cabinetId', '==', profile?.cabinetId),
        where('cpf', '==', maskedCPF)
      );
      const querySnapshot = await getDocs(q);
      const docsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docsList.sort((a: any, b: any) => {
        const getMs = (ts: any) => {
          if (!ts) return 0;
          if (ts.toDate) return ts.toDate().getTime();
          if (ts.seconds) return ts.seconds * 1000;
          return new Date(ts).getTime();
        };
        return getMs(b.created_at) - getMs(a.created_at);
      });
      setMedicalHistory(docsList);
    } catch (error) {
      console.error("Error fetching medical history:", error);
    } finally {
      setSearchingMedical(false);
    }
  };

  const fetchGeneralHistory = async (cpf: string) => {
    const maskedCPF = maskCPF(cpf);
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length < 11 || !profile?.cabinetId) return;
    
    setSearchingGeneral(true);
    try {
      const q = query(
        collection(db, 'atendimentos'), 
        where('cabinetId', '==', profile?.cabinetId),
        where('cpf', '==', maskedCPF)
      );
      const querySnapshot = await getDocs(q);
      const docsList = querySnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      docsList.sort((a: any, b: any) => {
        const getMs = (ts: any) => {
          if (!ts) return 0;
          if (ts.toDate) return ts.toDate().getTime();
          if (ts.seconds) return ts.seconds * 1000;
          return new Date(ts).getTime();
        };
        return getMs(b.created_at) - getMs(a.created_at);
      });
      setGeneralHistory(docsList);
    } catch (error) {
      console.error("Error fetching general history:", error);
    } finally {
      setSearchingGeneral(false);
    }
  };

  const searchAndAutofillCitizen = async (cpf: string) => {
    const maskedCPF = maskCPF(cpf);
    const cleanCPF = cpf.replace(/\D/g, '');
    if (cleanCPF.length < 11 || !profile?.cabinetId) {
      setCitizenFoundAlert(null);
      return;
    }

    setSearchingCitizen(true);
    setCitizenFoundAlert(null);
    try {
      const qGen = query(
        collection(db, 'atendimentos'),
        where('cabinetId', '==', profile?.cabinetId),
        where('cpf', '==', maskedCPF),
        orderBy('created_at', 'desc')
      );

      const qMed = query(
        collection(db, 'atendimentos_medicos'),
        where('cabinetId', '==', profile?.cabinetId),
        where('cpf', '==', maskedCPF),
        orderBy('created_at', 'desc')
      );

      const [genSnap, medSnap] = await Promise.all([
        getDocs(qGen),
        getDocs(qMed)
      ]);

      let foundData: any = null;
      const hasGen = !genSnap.empty;
      const hasMed = !medSnap.empty;

      if (hasGen || hasMed) {
        const genData = hasGen ? genSnap.docs[0].data() : {};
        const medData = hasMed ? medSnap.docs[0].data() : {};
        foundData = {
          ...genData,
          ...medData,
          nome_completo: medData.nome_completo || genData.nome_completo || '',
          telefone: medData.telefone || genData.telefone || '',
          email: medData.email || genData.email || '',
          data_nascimento: medData.data_nascimento || genData.data_nascimento || '',
          endereco: medData.endereco || genData.endereco || '',
          bairro: medData.bairro || genData.bairro || '',
          zona_rural: medData.zona_rural !== undefined ? medData.zona_rural : (genData.zona_rural !== undefined ? genData.zona_rural : false)
        };

        setCitizenFoundAlert("💡 CPF já cadastrado! Os dados foram preenchidos de forma automática.");
        setFormData(prev => ({
          ...prev,
          nome_completo: prev.nome_completo || foundData.nome_completo || '',
          telefone: prev.telefone || foundData.telefone || '',
          email: prev.email || foundData.email || '',
          data_nascimento: prev.data_nascimento || foundData.data_nascimento || '',
          endereco: prev.endereco || foundData.endereco || '',
          bairro: prev.bairro || foundData.bairro || '',
          zona_rural: foundData.zona_rural !== undefined ? foundData.zona_rural : prev.zona_rural,
        }));
      } else {
        setCitizenFoundAlert("📝 CPF novo: o cidadão será cadastrado ao criar o atendimento.");
      }
    } catch (err) {
      console.error("Erro ao buscar dados do cidadão:", err);
    } finally {
      setSearchingCitizen(false);
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

  useEffect(() => {
    const handleNewAtendimento = () => {
      if (profile?.role !== 'consulta') {
        setEditingId(null);
        setFormData(initialForm);
        setMedicalHistory([]);
        setGeneralHistory([]);
        setProtocolError(null);
        setCitizenFoundAlert(null);
        setShowModal(true);
      }
    };
    window.addEventListener('new-atendimento-trigger', handleNewAtendimento);
    return () => {
      window.removeEventListener('new-atendimento-trigger', handleNewAtendimento);
    };
  }, [profile, initialForm]);

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
        assessor_id: formData.assessor_id || user?.uid || '',
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
    setGeneralHistory([]);
    setProtocolError(null);
    setCitizenFoundAlert(null);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      nome_completo: item.nome_completo || '',
      cpf: item.cpf || '',
      telefone: item.telefone || '',
      email: item.email || '',
      data_nascimento: item.data_nascimento || '',
      endereco: item.endereco || '',
      bairro: item.bairro || '',
      zona_rural: item.zona_rural || false,
      tipo_atendimento: item.tipo_atendimento || 'Geral',
      especialidade: item.especialidade || '',
      protocolo: item.protocolo || '',
      status: item.status || 'Novo',
      prioridade: item.prioridade || 'Média',
      descricao: item.descricao || '',
      lgpd_consent: item.lgpd_consent || false,
      latitude: item.latitude || null,
      longitude: item.longitude || null,
      assessor_id: item.assessor_id || '',
      tem_lembrete: item.tem_lembrete || false,
      lembrete_data: item.lembrete_data || '',
      lembrete_descricao: item.lembrete_descricao || '',
    });
    if (item.cpf) {
      fetchMedicalHistory(item.cpf);
      fetchGeneralHistory(item.cpf);
    }
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
    
    const matchesAssigned = !onlyMyAtendimentos || item.assessor_id === user?.uid || (!item.assessor_id && item.usuario_id === user?.uid);

    return matchesSearch && matchesCPF && matchesPhone && matchesType && matchesAssigned;
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Atendimentos</h1>
          <p className="text-slate-400 text-sm">Gerencie os atendimentos gerais do gabinete.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setOnlyMyAtendimentos(!onlyMyAtendimentos)}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold uppercase transition-all border shrink-0",
              onlyMyAtendimentos
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 font-bold"
                : "bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-300"
            )}
          >
            <User size={14} />
            <span>Meus Atendimentos</span>
          </button>
          
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
            <button 
              onClick={() => setViewMode('map')}
              className={cn(
                "p-2 rounded-lg transition-all",
                viewMode === 'map' ? "bg-slate-800 text-white shadow-sm" : "text-slate-500 hover:text-slate-300"
              )}
              title="Mapa de Bairros"
            >
              <MapIcon size={18} />
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

      {todayBirthdays.length > 0 && (
        <div className="bg-gradient-to-r from-purple-900/30 via-slate-900 to-pink-900/30 border border-purple-500/20 rounded-3xl p-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-8 text-6xl opacity-5 select-none pointer-events-none animate-pulse">🎂</div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-purple-500/15 text-purple-400 rounded-2xl flex items-center justify-center text-xl border border-purple-500/20 shrink-0">
                🎉
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base flex items-center gap-2">Aniversariantes de Hoje! <span className="animate-bounce">🎂</span></h3>
                <p className="text-slate-400 text-xs">Envie um parabéns para demonstrar carinho neste dia especial!</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mt-5">
            {todayBirthdays.map((b) => (
              <div key={b.id} className="bg-slate-950/40 border border-slate-800/80 rounded-2xl p-4 flex items-center justify-between gap-3 hover:border-purple-500/30 transition-all">
                <div className="overflow-hidden">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-slate-200 text-sm truncate max-w-[130px]" title={b.nome}>{b.nome}</span>
                    <span className={cn(
                      "text-[8px] font-black uppercase px-2 py-0.5 rounded-full border tracking-wide",
                      b.tipo === 'Colaborador' ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"
                    )}>
                      {b.tipo}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 mt-1 truncate">{b.telefone || 'Sem celular'}</p>
                </div>
                {b.telefone && (
                  <button
                    onClick={() => sendBirthdayWish(b)}
                    className="bg-emerald-600/95 hover:bg-emerald-600 text-white py-2 px-3 rounded-xl flex items-center gap-1 text-xs font-bold transition-all shrink-0 hover:scale-105 active:scale-95 cursor-pointer"
                    title="Mandar Cartão de Aniversário por WhatsApp"
                  >
                    <Send size={12} />
                    <span>Enviar</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {listLembretes.length > 0 && (
        <div className="bg-gradient-to-r from-amber-950/20 via-slate-900 to-amber-950/20 border border-amber-500/10 rounded-3xl p-6 relative overflow-hidden shadow-xl">
          <div className="absolute top-0 right-0 p-8 text-5xl opacity-[0.03] select-none pointer-events-none animate-pulse">⏰</div>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-amber-500/15 text-amber-500 rounded-2xl flex items-center justify-center text-xl border border-amber-500/20 shrink-0">
                <Bell size={20} className="animate-pulse text-amber-400" />
              </div>
              <div>
                <h3 className="font-extrabold text-white text-base">Controle de Lembretes do Gabinete ⏰</h3>
                <p className="text-slate-400 text-xs">Acompanhamento dos vencimentos de exames, consultas e retornos dos cidadãos.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {listLembretes.slice(0, 6).map((lembrete) => (
              <div key={lembrete.id + '-' + lembrete.data} className="bg-slate-950/40 border border-slate-800/80 hover:border-amber-500/30 rounded-2xl p-4 flex flex-col justify-between gap-3 transition-all">
                <div className="space-y-1">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-slate-200 text-sm truncate" title={lembrete.nome}>{lembrete.nome}</span>
                    <span className="text-[9px] text-amber-400 bg-amber-500/10 font-bold border border-amber-500/20 px-2 py-0.5 rounded-lg shrink-0">
                      {format(new Date(lembrete.data + "T12:00:00"), "dd/MM/yyyy")}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 font-medium line-clamp-1">{lembrete.descricao}</p>
                  {lembrete.cpf && <p className="text-[10px] text-slate-500 font-mono">CPF: {lembrete.cpf}</p>}
                </div>
                {lembrete.telefone && (
                  <button
                    onClick={() => {
                      const message = `Olá ${lembrete.nome.split(' ')[0]}, o Gabinete gostaria de lembrar sobre o vencimento de sua consulta/exame: "${lembrete.descricao}" agendada/vencendo em ${format(new Date(lembrete.data + "T12:00:00"), "dd/MM/yyyy")}.`;
                      window.open(`https://api.whatsapp.com/send?phone=55${lembrete.telefone.replace(/\D/g, '')}&text=${encodeURIComponent(message)}`, '_blank');
                    }}
                    className="w-full bg-slate-900 border border-slate-800 hover:border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 p-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <MessageCircle size={12} />
                    <span>Enviar Lembrete por WhatsApp</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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

      {viewMode === 'list' && (
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
                          <span className="text-sm font-medium text-slate-200">{formatProperName(item.nome_completo)}</span>
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
                          <span className="text-[10px] text-slate-600">•</span>
                          {profile?.role === 'admin' || profile?.role === 'vereador' || profile?.role === 'secretaria_parlamentar' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800 text-blue-300 border border-slate-700/50 px-1.5 py-0.5 rounded font-medium shadow-sm">
                              <span className="text-slate-500 font-bold">Assessor:</span>
                              <select 
                                value={item.assessor_id || item.usuario_id || ''}
                                onChange={async (e) => {
                                  const newAssessorId = e.target.value;
                                  const collectionName = item.sourceCollection === 'atendimentos_medicos' ? 'atendimentos_medicos' : 'atendimentos';
                                  try {
                                    await updateDoc(doc(db, collectionName, item.id), {
                                      assessor_id: newAssessorId,
                                      updated_at: serverTimestamp()
                                    });
                                    await logAction('Atualizar', collectionName, item.id, { 
                                      previous: { assessor_id: item.assessor_id || item.usuario_id || '' }, 
                                      next: { assessor_id: newAssessorId },
                                      cabinetId: profile.cabinetId
                                    });
                                  } catch (err) {
                                    console.error("Erro ao atribuir assessor:", err);
                                    alert("Erro ao atribuir assessor.");
                                  }
                                }}
                                className="bg-transparent border-none text-blue-300 focus:outline-none focus:ring-0 cursor-pointer pr-1 py-0 scrollbar-none font-bold text-[10px]"
                              >
                                <option value="" className="bg-slate-900 text-slate-300">Não Atribuído</option>
                                {cabinetUsers.map(u => (
                                  <option key={u.id} value={u.id} className="bg-slate-900 text-slate-300">{u.nome}</option>
                                ))}
                              </select>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] bg-slate-800/80 text-blue-300 border border-slate-700/50 px-1.5 py-0.5 rounded font-medium">
                              <span className="text-slate-500 font-bold">Assessor:</span> {getAssessorName(item.assessor_id || item.usuario_id)}
                            </span>
                          )}
                        </div>
                        {((item.sourceCollection === 'atendimentos' && item.tem_lembrete && item.lembrete_data) || 
                          (item.sourceCollection === 'atendimentos_medicos' && item.lembrete_exame)) && (
                          <div className="flex items-center gap-1.5 text-[9px] text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/15 w-fit mt-1.5 font-bold uppercase tracking-wider">
                            <Clock size={9} />
                            <span>
                              {item.sourceCollection === 'atendimentos_medicos' 
                                ? `Lembrete: Exame em ${format(new Date(item.lembrete_exame + "T12:00:00"), "dd/MM/yyyy")}` 
                                : `Lembrete: ${item.lembrete_descricao || 'Vencimento'} em ${format(new Date(item.lembrete_data + "T12:00:00"), "dd/MM/yyyy")}`}
                            </span>
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-1.5 items-start">
                        <span className="text-xs px-2 py-1 bg-slate-800 border border-slate-700 rounded-md text-slate-300">
                          {item.tipo_atendimento}
                        </span>
                        {item.tipo_atendimento === 'Médico' && (item.especialidade || item.sourceCollection === 'atendimentos_medicos') && (
                          <span className="text-[10px] px-1.5 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/10 rounded font-semibold uppercase tracking-tight">
                            {item.especialidade || 'Consulta'}
                          </span>
                        )}
                      </div>
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
      )}

      {viewMode === 'calendar' && (
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
                          <div className="truncate">{formatProperName(item.nome_completo)}</div>
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

      {viewMode === 'map' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fadeIn">
          {/* Card: Map Container */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h2 className="font-extrabold text-white text-base">Mapa de Densidade por Bairro</h2>
                <p className="text-slate-500 text-xs mt-0.5">Clique nos círculos para explorar atendimentos do bairro.</p>
              </div>
              <span className="text-[10px] bg-slate-800 border border-slate-700 font-bold px-2.5 py-1 rounded-lg text-slate-400">
                {neighborhoodStats.length} Bairros Atendidos
              </span>
            </div>

            <div className="h-[450px] rounded-2xl overflow-hidden border border-slate-800 relative z-0">
              <MapContainer 
                center={mapViewport.center} 
                zoom={mapViewport.zoom} 
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                />
                <ChangeMapView center={mapViewport.center} zoom={mapViewport.zoom} />
                
                {neighborhoodStats.map((nb) => {
                  const radius = 10 + Math.min(nb.total * 3, 30);
                  const isTop = nb === neighborhoodStats[0];
                  
                  return (
                    <CircleMarker
                      key={nb.id}
                      center={nb.coordinates}
                      radius={radius}
                      fillColor={isTop ? '#d946ef' : '#3b82f6'}
                      color={isTop ? '#f5d0fe' : '#93c5fd'}
                      weight={2}
                      opacity={0.8}
                      fillOpacity={0.65}
                    >
                      <Popup>
                        <div className="p-2 min-w-[200px] text-slate-100 bg-slate-950 rounded-xl font-sans">
                          <h4 className="font-extrabold text-[#38bdf8] text-sm mb-2 border-b border-slate-800 pb-1 uppercase tracking-wide">
                            {nb.name}
                          </h4>
                          <div className="space-y-1.5 text-xs">
                            <div className="flex justify-between items-center text-slate-400">
                              <span>📄 Geral:</span>
                              <span className="font-bold text-slate-200">{nb.geral}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-400">
                              <span>🩺 Médicos:</span>
                              <span className="font-bold text-emerald-400">{nb.medico}</span>
                            </div>
                            <div className="flex justify-between items-center text-slate-300 font-bold mt-1.5 border-t border-slate-800 pt-1.5">
                              <span>📊 Total:</span>
                              <span className="text-white text-sm">{nb.total}</span>
                            </div>
                          </div>
                          <button
                            onClick={() => {
                              setSearch(nb.name);
                              setViewMode('list');
                            }}
                            className="w-full mt-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-[10px] uppercase tracking-wider py-1.5 rounded-lg transition-all text-center flex items-center justify-center gap-1 cursor-pointer"
                          >
                            <Filter size={10} />
                            Filtrar Atendimentos
                          </button>
                        </div>
                      </Popup>
                    </CircleMarker>
                  );
                })}
              </MapContainer>
            </div>
            
            <div className="flex gap-4 justify-start items-center text-xs text-slate-400 pt-1">
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-blue-500/60 border border-blue-400" /> Bairro Comum</span>
              <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-magenta-500 bg-[#d946ef] border border-[#f5d0fe]" /> Líder de Atendimentos</span>
            </div>
          </div>

          {/* Card: Leaderboard & Stats */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl flex flex-col space-y-4">
            <h3 className="font-extrabold text-white text-base border-b border-slate-800 pb-3 flex items-center justify-between">
              <span>Bairros com Mais Atendimentos</span>
              <span className="text-[10px] text-blue-400 uppercase tracking-widest font-black">Ranking</span>
            </h3>
            
            <div className="overflow-y-auto max-h-[380px] space-y-3.5 scrollbar-thin scrollbar-thumb-slate-800 pr-1">
              {neighborhoodStats.length === 0 ? (
                <p className="text-center text-slate-500 text-xs py-10">Crie atendimentos com bairro para gerar estatísticas.</p>
              ) : (
                neighborhoodStats.map((nb, idx) => {
                  const maxTotal = neighborhoodStats[0]?.total || 1;
                  const ratio = (nb.total / maxTotal) * 100;
                  
                  return (
                    <div 
                      key={nb.id}
                      className="bg-slate-950/40 border border-slate-900 rounded-2xl p-3.5 hover:border-blue-500/20 transition-all flex flex-col space-y-2.5 group/card"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                          <span className={cn(
                            "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black shrink-0",
                            idx === 0 ? "bg-amber-500/20 text-amber-400 border border-amber-500/30 shadow-md shadow-amber-950/20 scale-105" :
                            idx === 1 ? "bg-slate-300/20 text-slate-300 border border-slate-500/20" :
                            idx === 2 ? "bg-amber-700/20 text-amber-500 border border-amber-800/20" :
                            "bg-slate-800/50 text-slate-500"
                          )}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-200 text-sm group-hover/card:text-blue-400 transition-colors uppercase tracking-tight">{nb.name}</span>
                        </div>
                        
                        <div className="flex items-center gap-1.5">
                          <button
                            onClick={() => {
                              setMapViewport({
                                center: nb.coordinates,
                                zoom: 15
                              });
                            }}
                            className="p-1 px-2 text-[10px] bg-slate-800 hover:bg-slate-700 border border-slate-705 rounded-lg text-slate-400 hover:text-white transition-all cursor-pointer flex items-center gap-1"
                            title="Focar no Mapa"
                          >
                            <MapPin size={10} />
                            Focar
                          </button>
                          <button
                            onClick={() => {
                              setSearch(nb.name);
                              setViewMode('list');
                            }}
                            className="p-1 px-2 text-[10px] bg-blue-600/10 hover:bg-blue-600/20 border border-blue-500/20 rounded-lg text-blue-400 hover:text-blue-300 transition-all cursor-pointer"
                            title="Ver Atendimentos"
                          >
                            Ver
                          </button>
                        </div>
                      </div>

                      {/* Split meter bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden flex">
                          <div 
                            style={{ width: `${(nb.geral / nb.total) * ratio}%` }}
                            className="bg-blue-500 h-full transition-all"
                            title={`Geral: ${nb.geral}`}
                          />
                          <div 
                            style={{ width: `${(nb.medico / nb.total) * ratio}%` }}
                            className="bg-emerald-500 h-full transition-all"
                            title={`Médico: ${nb.medico}`}
                          />
                        </div>
                        <div className="flex justify-between items-center text-[10px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
                            📄 {nb.geral} geral
                          </span>
                          <span className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            🩺 {nb.medico} médico
                          </span>
                          <span className="font-extrabold text-slate-400">Total: {nb.total}</span>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
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
                      {/* Mobile Citizen History Alert */}
                      {unifiedHistory.length > 0 && (
                        <div className="md:hidden bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-between gap-4">
                           <div className="flex items-center gap-3">
                              <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center animate-pulse">
                                 <History size={16} className="text-blue-400" />
                              </div>
                              <div className="flex flex-col">
                                 <span className="text-xs font-bold text-blue-400 uppercase tracking-wider">Histórico Encontrado</span>
                                 <span className="text-[10px] text-slate-400">{unifiedHistory.length} registros anteriores vinculados</span>
                              </div>
                           </div>
                           <button 
                             type="button"
                             onClick={() => {
                               const el = document.getElementById('mobile-history-section');
                               el?.scrollIntoView({ behavior: 'smooth' });
                             }}
                             className="bg-blue-600 text-white p-2 rounded-xl"
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
                                  fetchGeneralHistory(val);
                                  searchAndAutofillCitizen(val);
                                } else {
                                  setMedicalHistory([]);
                                  setGeneralHistory([]);
                                  setCitizenFoundAlert(null);
                                }
                              }}
                              className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors pr-10"
                              placeholder="000.000.000-00"
                            />
                            {(searchingMedical || searchingGeneral || searchingCitizen) && (
                              <div className="absolute right-3 top-1/2 -translate-y-1/2 mt-0.5">
                                <div className="w-4 h-4 border-2 border-emerald-500 border-t-transparent rounded-full animate-spin" />
                              </div>
                            )}
                          </div>
                          {citizenFoundAlert && (
                            <p className={cn(
                              "text-[10.5px] font-medium leading-tight mt-1 animate-pulse",
                              citizenFoundAlert.includes("já cadastrado") ? "text-emerald-400" : "text-blue-400"
                            )}>
                              {citizenFoundAlert}
                            </p>
                          )}
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
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Data de Nascimento</label>
                    <input 
                      type="date" 
                      value={formData.data_nascimento || ''}
                      onChange={e => setFormData({...formData, data_nascimento: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors [color-scheme:dark]"
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
                  {formData.tipo_atendimento === 'Médico' && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-2"
                    >
                      <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider text-emerald-500">Especialidade Médica (Sugestões)</label>
                      <select 
                        value={formData.especialidade || ''}
                        onChange={e => setFormData({...formData, especialidade: e.target.value})}
                        className="w-full bg-slate-800 border border-emerald-500/20 rounded-xl py-3 px-4 focus:outline-none focus:border-emerald-500 transition-colors appearance-none text-white"
                      >
                        <option value="">Selecione a especialidade...</option>
                        {especialidades.map(spec => (
                          <option key={spec.id} value={spec.nome}>{spec.nome}</option>
                        ))}
                      </select>
                    </motion.div>
                  )}
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
                  <div className="space-y-2">
                    <label className="text-xs font-semibold uppercase text-slate-500 tracking-wider">Assessor Responsável</label>
                    <select 
                      value={formData.assessor_id || ''}
                      onChange={e => setFormData({...formData, assessor_id: e.target.value})}
                      className="w-full bg-slate-800 border border-slate-700 rounded-xl py-3 px-4 focus:outline-none focus:border-blue-500 transition-colors appearance-none"
                    >
                      <option value="">Selecione um assessor...</option>
                      {cabinetUsers.map(u => (
                        <option key={u.id} value={u.id}>{u.nome}</option>
                      ))}
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

                {/* Reminder Setup Section */}
                <div className="p-4 bg-slate-900/55 border border-slate-800 rounded-2xl space-y-4">
                  <div className="flex items-center gap-3">
                    <input 
                      type="checkbox"
                      id="tem_lembrete"
                      checked={formData.tem_lembrete || false}
                      onChange={e => setFormData({...formData, tem_lembrete: e.target.checked})}
                      className="w-5 h-5 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <label htmlFor="tem_lembrete" className="text-sm font-bold text-slate-200 cursor-pointer flex items-center gap-1.5 select-none hover:text-white transition-colors">
                      <Bell size={15} className="text-amber-400" />
                      Agendar um Lembrete para o Cidadão (Vencimento de Consultas ou Exames)
                    </label>
                  </div>

                  {formData.tem_lembrete && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-3 pt-2"
                    >
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Data do Vencimento (Consulta ou Exame)</label>
                        <input 
                          type="date"
                          value={formData.lembrete_data || ''}
                          onChange={e => setFormData({...formData, lembrete_data: e.target.value})}
                          className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500/50 [color-scheme:dark] transition-all text-white text-xs font-medium"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider">Descrição / Motivo do Lembrete</label>
                        <input 
                          type="text"
                          value={formData.lembrete_descricao || ''}
                          onChange={e => setFormData({...formData, lembrete_descricao: e.target.value})}
                          placeholder="Ex: Entrega de exame laboratorial, vencimento da guia de consulta"
                          className="w-full bg-slate-800 border-none rounded-xl p-3 focus:ring-2 focus:ring-blue-500/50 transition-all text-white text-xs"
                        />
                      </div>
                    </motion.div>
                  )}
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

              {/* Mobile: Dedicated section for Unified History at bottom */}
              {unifiedHistory.length > 0 && (
                <div id="mobile-history-section" className="md:hidden mt-8 pt-6 border-t border-slate-800 space-y-4 pb-20">
                   <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                     <History size={14} className="text-blue-500" />
                     Histórico Completo do Cidadão
                   </h3>
                  <div className="space-y-3">
                    {unifiedHistory.map((h) => (
                      <div key={h.id} className={cn(
                        "border p-4 rounded-2xl bg-slate-950 transition-all",
                        h.type === 'medical' ? "border-slate-800/80 hover:border-emerald-500/30" : "border-slate-800/80 hover:border-blue-500/30"
                      )}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[9px] font-bold text-slate-500">
                            {h.created_at?.toDate ? format(h.created_at.toDate(), 'dd/MM/yyyy HH:mm') : h.created_at?.seconds ? format(new Date(h.created_at.seconds * 1000), 'dd/MM/yyyy HH:mm') : '...'}
                          </span>
                          <span className={cn(
                            "text-[8px] px-1.5 py-0.5 rounded font-black uppercase tracking-tighter border",
                            h.type === 'medical' 
                              ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                              : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                          )}>
                            {h.type === 'medical' ? `🩺 ${h.title}` : `📄 Geral - ${h.title}`}
                          </span>
                        </div>
                        <p className="text-xs text-slate-300 font-medium mb-2 leading-relaxed italic">"{h.description}"</p>
                        <div className="flex items-center justify-between text-[9px] text-slate-500 pt-2 border-t border-slate-900">
                           <span className="flex items-center gap-1 font-bold">
                              <User size={10} className="text-slate-600" />
                              <span className="text-slate-500">Atendido por:</span> {h.type === 'medical' ? h.usuario_nome?.split(' ')[0] : (h.usuario_nome || getAssessorName(h.assessor_id))?.split(' ')[0]}
                           </span>
                           <span className={cn(
                             "px-1.5 py-0.5 rounded font-bold uppercase tracking-tight text-[8px]",
                             h.status === 'Novo' && "bg-blue-500/10 text-blue-400",
                             h.status === 'Pendente' && "bg-yellow-500/10 text-yellow-500",
                             h.status === 'Concluído' && "bg-emerald-500/10 text-emerald-400",
                             !['Novo', 'Pendente', 'Concluído'].includes(h.status) && "bg-slate-800 text-slate-400"
                           )}>
                              {h.status || 'Status'}
                           </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Unified History Sidebar */}
            <div className="hidden md:flex w-80 bg-slate-950/50 flex-col overflow-hidden">
               <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                  <h3 className="text-xs font-black uppercase text-slate-500 tracking-widest flex items-center gap-2">
                     <History size={14} className="text-blue-500" />
                     Histórico
                  </h3>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg hidden md:block"><X size={20} className="text-slate-500" /></button>
               </div>
               <div className="flex-1 overflow-y-auto p-6 space-y-4 shadow-inner">
                 {unifiedHistory.length > 0 ? (
                   unifiedHistory.map((h) => (
                     <div key={h.id} className={cn(
                       "bg-slate-900 border p-4 rounded-2xl group transition-all",
                       h.type === 'medical' ? "border-slate-800/80 hover:border-emerald-500/30" : "border-slate-800/80 hover:border-blue-500/30"
                     )}>
                       <div className="flex items-center justify-between mb-2">
                         <span className="text-[9px] font-bold text-slate-500 uppercase">
                           {h.created_at?.toDate ? format(h.created_at.toDate(), 'dd/MM/yyyy') : h.created_at?.seconds ? format(new Date(h.created_at.seconds * 1000), 'dd/MM/yyyy') : '...'}
                         </span>
                         <span className={cn(
                           "px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-tighter border",
                           h.type === 'medical' 
                             ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" 
                             : "bg-blue-500/10 text-blue-400 border-blue-500/20"
                         )}>
                           {h.type === 'medical' ? `🩺 ${h.title}` : `📄 ${h.title}`}
                         </span>
                       </div>
                       <p className="text-xs text-slate-300 font-medium line-clamp-3 leading-relaxed mb-2 italic">"{h.description}"</p>
                       <div className="flex items-center justify-between mt-2 pt-2 border-t border-slate-800/50">
                          <div className="flex items-center gap-1">
                             <User size={10} className="text-slate-600" />
                             <span className="text-[9px] text-slate-600 font-bold">
                               {h.type === 'medical' ? h.usuario_nome?.split(' ')[0] : (h.usuario_nome || getAssessorName(h.assessor_id))?.split(' ')[0]}
                             </span>
                          </div>
                          <span className={cn(
                             "px-1.5 py-0.5 rounded font-bold uppercase tracking-tight text-[8px]",
                             h.status === 'Novo' && "bg-blue-500/10 text-blue-400",
                             h.status === 'Pendente' && "bg-yellow-500/10 text-yellow-500",
                             h.status === 'Concluído' && "bg-emerald-500/10 text-emerald-400",
                             !['Novo', 'Pendente', 'Concluído'].includes(h.status) && "bg-slate-800 text-slate-400"
                           )}>
                              {h.status || 'Status'}
                           </span>
                       </div>
                     </div>
                   ))
                 ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-30 px-4">
                      <History size={32} className="text-slate-700 mb-4" />
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest leading-relaxed text-center">
                        Sem registros vinculados a este CPF
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

import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  ChevronLeft, 
  ChevronRight, 
  Calendar as CalendarIcon,
  Clock,
  MapPin,
  MoreVertical,
  X,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  History,
  Download
} from 'lucide-react';
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
  isToday,
  parse
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where,
  orderBy, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { cn, formatProperName } from '../lib/utils';
import { logAction } from '../lib/audit';
import { handleFirestoreError, OperationType } from '../lib/error-handler';

function getEasterDate(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

export function getBrazilianHoliday(date: Date): string | null {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed
  const day = date.getDate();

  // Fixed holidays (month is 0-indexed)
  const fixedHolidays: { [key: string]: string } = {
    '0-1': 'Confraternização Universal (Ano Novo)',
    '3-21': 'Tiradentes',
    '4-1': 'Dia do Trabalhador',
    '8-7': 'Independência do Brasil',
    '9-12': 'Nossa Senhora Aparecida',
    '10-2': 'Finados',
    '10-15': 'Proclamação da República',
    '10-20': 'Consciência Negra',
    '11-25': 'Natal'
  };

  const key = `${month}-${day}`;
  if (fixedHolidays[key]) {
    return fixedHolidays[key];
  }

  // Easter calculation
  const easter = getEasterDate(year);

  // Carnaval: 47 days before Easter
  const carnival = new Date(easter);
  carnival.setDate(easter.getDate() - 47);

  // Carnaval Segunda: 48 days before Easter
  const carnivalMonday = new Date(easter);
  carnivalMonday.setDate(easter.getDate() - 48);

  // Quarta-feira de Cinzas: 46 days before Easter
  const ashWednesday = new Date(easter);
  ashWednesday.setDate(easter.getDate() - 46);

  // Sexta-feira Santa (Paixão de Cristo): 2 days before Easter
  const goodFriday = new Date(easter);
  goodFriday.setDate(easter.getDate() - 2);

  // Corpus Christi: 60 days after Easter
  const corpusChristi = new Date(easter);
  corpusChristi.setDate(easter.getDate() + 60);

  const isSameLocalDate = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  if (isSameLocalDate(date, carnival)) {
    return 'Carnaval';
  }
  if (isSameLocalDate(date, carnivalMonday)) {
    return 'Segunda-feira de Carnaval';
  }
  if (isSameLocalDate(date, ashWednesday)) {
    return 'Quarta-feira de Cinzas';
  }
  if (isSameLocalDate(date, goodFriday)) {
    return 'Sexta-Feira Santa / Paixão de Cristo';
  }
  if (isSameLocalDate(date, corpusChristi)) {
    return 'Corpus Christi';
  }

  return null;
}

export default function Agenda() {
  const { user, profile } = useAuth();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showExportDropdown, setShowExportDropdown] = useState(false);
  const [officeHours, setOfficeHours] = useState({ inicio: '08:00', fim: '13:00' });
  
  const initialForm = {
    titulo: '',
    tipo: 'Compromisso',
    data: format(new Date(), 'yyyy-MM-dd'),
    hora_inicio: officeHours.inicio,
    hora_fim: officeHours.fim,
    local: '',
    descricao: '',
    contato_nome: '',
    contato_telefone: '',
    lembrete_data: '',
    lembrete_hora: ''
  };
  
  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'agenda_vereador'), 
      where('cabinetId', '==', profile.cabinetId),
      orderBy('data', 'asc')
    );
    const unsub = onSnapshot(q, (snap) => {
      setEvents(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'agenda_vereador');
      setLoading(false);
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const unsubSettings = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        setOfficeHours({
          inicio: data.atendimento_inicio || '08:00',
          fim: data.atendimento_fim || '13:00'
        });
      }
    });
    return () => unsubSettings();
  }, [profile?.cabinetId]);

  useEffect(() => {
    if (!editingId) {
      setFormData(prev => ({
        ...prev,
        hora_inicio: officeHours.inicio,
        hora_fim: officeHours.fim
      }));
    }
  }, [officeHours, editingId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !profile) return;

    setSubmitting(true);
    setError(null);

    // Validate if selected date is a Brazilian national holiday
    try {
      const eventDate = parse(formData.data, 'yyyy-MM-dd', new Date());
      const holidayName = getBrazilianHoliday(eventDate);
      if (holidayName) {
        setError(`O Gabinete estará fechado neste dia devido ao Feriado Nacional: ${holidayName}. Negociação de compromissos bloqueada.`);
        setSubmitting(false);
        return;
      }
    } catch (parseErr) {
      console.error("Erro ao validar data de feriado:", parseErr);
    }

    try {
      const eventData = {
        ...formData,
        contato_nome: formatProperName(formData.contato_nome),
        cabinetId: profile.cabinetId,
        updated_at: serverTimestamp(),
        usuario_id: user.uid,
        usuario_nome: profile.nome
      };

      if (editingId) {
        await updateDoc(doc(db, 'agenda_vereador', editingId), eventData);
        await logAction('Atualizar', 'agenda_vereador', editingId, { next: eventData });
      } else {
        const docRef = await addDoc(collection(db, 'agenda_vereador'), {
          ...eventData,
          created_at: serverTimestamp()
        });
        await logAction('Criar', 'agenda_vereador', docRef.id, { next: eventData });
      }

      setShowModal(false);
      setEditingId(null);
      setFormData(initialForm);
    } catch (err: any) {
      console.error("Erro ao salvar compromisso:", err);
      setError(err.message || String(err));
      // No re-throw here so we can show the error in the UI
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (event: any) => {
    setFormData({
      titulo: event.titulo || '',
      tipo: event.tipo || 'Compromisso',
      data: event.data || '',
      hora_inicio: event.hora_inicio || '',
      hora_fim: event.hora_fim || '',
      local: event.local || '',
      descricao: event.descricao || '',
      contato_nome: event.contato_nome || '',
      contato_telefone: event.contato_telefone || '',
      lembrete_data: event.lembrete_data || '',
      lembrete_hora: event.lembrete_hora || ''
    });
    setEditingId(event.id);
    setShowModal(true);
  };

  const handleToggleComplete = async (event: any) => {
    try {
      const newStatus = event.status === 'realizado' ? 'pendente' : 'realizado';
      await updateDoc(doc(db, 'agenda_vereador', event.id), {
        status: newStatus,
        updated_at: serverTimestamp()
      });
      
      await logAction(
        newStatus === 'realizado' ? 'Concluir Compromisso' : 'Reabrir Compromisso', 
        'agenda_vereador', 
        event.id, 
        { 
          previous: { status: event.status || 'pendente' },
          next: { status: newStatus }
        }
      );
    } catch (err: any) {
      console.error("Erro ao alterar status:", err);
      alert("Erro ao alterar status: " + (err.message || String(err)));
    }
  };

  const handlePostpone = async (event: any) => {
    try {
      const currentDate = parse(event.data, 'yyyy-MM-dd', new Date());
      const nextDate = new Date(currentDate);
      nextDate.setDate(nextDate.getDate() + 1);

      // Skip national holidays during postponement
      while (getBrazilianHoliday(nextDate)) {
        nextDate.setDate(nextDate.getDate() + 1);
      }

      const nextDateStr = format(nextDate, 'yyyy-MM-dd');

      await updateDoc(doc(db, 'agenda_vereador', event.id), {
        data: nextDateStr,
        status: 'pendente', // Reset status when postponing
        updated_at: serverTimestamp()
      });
      await logAction('Adiar Compromisso', 'agenda_vereador', event.id, { 
        previous: { data: event.data, status: event.status || 'pendente' },
        next: { data: nextDateStr, status: 'pendente' }
      });
      alert(`Compromisso adiado para ${format(nextDate, 'dd/MM/yyyy')}`);
    } catch (err: any) {
      console.error("Erro ao adiar:", err);
      alert("Erro ao adiar compromisso: " + (err.message || String(err)));
    }
  };

  const handleDelete = async (id: string, titulo: string) => {
    if (confirm(`Deseja excluir o compromisso "${titulo}" permanentemente?`)) {
      try {
        await deleteDoc(doc(db, 'agenda_vereador', id));
        await logAction('Excluir Compromisso', 'agenda_vereador', id, { 
          previous: { titulo } 
        });
        alert(`Compromisso "${titulo}" excluído com sucesso.`);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `agenda_vereador/${id}`);
        alert("Erro ao excluir: " + (err.message || String(err)));
      }
    }
  };

  const exportToICS = (eventsToExport: any[], filename = 'agenda-compromissos.ics') => {
    if (eventsToExport.length === 0) {
      alert("Nenhum compromisso encontrado para exportação.");
      return;
    }

    const sanitizeText = (text: string) => {
      if (!text) return '';
      return text
        .replace(/\\/g, '\\\\')
        .replace(/,/g, '\\,')
        .replace(/;/g, '\\;')
        .replace(/\n/g, '\\n')
        .trim();
    };

    const pad = (num: number) => String(num).padStart(2, '0');

    let icsContent = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Gabinete Digital//Agenda//PT',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH'
    ];

    eventsToExport.forEach(event => {
      const datePart = (event.data || '').replace(/-/g, '');
      if (!datePart || datePart.length !== 8) return;

      const startPart = (event.hora_inicio || '08:00').replace(/:/g, '') + '00';
      const endPart = (event.hora_fim || '09:00').replace(/:/g, '') + '00';

      const dtStart = `${datePart}T${startPart}`;
      const dtEnd = `${datePart}T${endPart}`;

      const now = new Date();
      const dtStamp = `${now.getUTCFullYear()}${pad(now.getUTCMonth() + 1)}${pad(now.getUTCDate())}T${pad(now.getUTCHours())}${pad(now.getUTCMinutes())}${pad(now.getUTCSeconds())}Z`;

      const summary = sanitizeText(event.titulo || `Compromisso (${event.tipo || 'Geral'})`);
      
      let descriptionParts = [];
      if (event.descricao) {
        descriptionParts.push(event.descricao);
      }
      if (event.tipo) {
        descriptionParts.push(`Tipo: ${event.tipo}`);
      }
      if (event.contato_nome) {
        let contactStr = `Contato: ${event.contato_nome}`;
        if (event.contato_telefone) contactStr += ` (${event.contato_telefone})`;
        descriptionParts.push(contactStr);
      }
      if (event.status) {
        descriptionParts.push(`Status: ${event.status === 'realizado' ? 'Realizado' : 'Pendente'}`);
      }
      
      const description = sanitizeText(descriptionParts.join('\\n'));
      const location = sanitizeText(event.local || '');

      icsContent.push('BEGIN:VEVENT');
      icsContent.push(`UID:${event.id || Math.random().toString(36).substring(2)}@gabinete.digital`);
      icsContent.push(`DTSTAMP:${dtStamp}`);
      icsContent.push(`DTSTART:${dtStart}`);
      icsContent.push(`DTEND:${dtEnd}`);
      icsContent.push(`SUMMARY:${summary}`);
      if (description) {
        icsContent.push(`DESCRIPTION:${description}`);
      }
      if (location) {
        icsContent.push(`LOCATION:${location}`);
      }
      icsContent.push('END:VEVENT');
    });

    icsContent.push('END:VCALENDAR');

    const blob = new Blob([icsContent.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportSingleEvent = (event: any) => {
    const formattedTitle = (event.titulo || 'compromisso')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-');
    exportToICS([event], `compromisso-${formattedTitle}.ics`);
  };

  const handleExportVisibleMonth = () => {
    const monthEvents = events.filter(event => {
      try {
        const eventDate = parse(event.data, 'yyyy-MM-dd', new Date());
        return isSameMonth(eventDate, currentDate);
      } catch (e) {
        return false;
      }
    });
    
    const monthName = format(currentDate, 'MMMM-yyyy', { locale: ptBR })
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
      
    exportToICS(monthEvents, `agenda-${monthName}.ics`);
  };

  const handleExportAll = () => {
    exportToICS(events, 'agenda-completa.ics');
  };

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(currentDate)),
    end: endOfWeek(endOfMonth(currentDate))
  });

  const getEventsForDay = (day: Date) => {
    const dateStr = format(day, 'yyyy-MM-dd');
    return events.filter(e => e.data === dateStr).sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white">Agenda do Vereador</h1>
          <p className="text-slate-400 text-sm">Compromissos, sessões e atendimentos oficiais.</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto relative">
          <div className="relative">
            <button
              onClick={() => setShowExportDropdown(!showExportDropdown)}
              className="bg-slate-800 hover:bg-slate-700 text-slate-200 px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all border border-slate-700 hover:border-slate-600 font-semibold cursor-pointer"
              title="Exportar compromissos para arquivo .ics"
            >
              <Download size={18} />
              <span>Exportar Agenda</span>
            </button>
            
            {showExportDropdown && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowExportDropdown(false)} 
                />
                <div className="absolute right-0 mt-2 w-56 bg-slate-900 border border-slate-800 rounded-2xl shadow-xl z-20 py-2">
                  <div className="px-4 py-1.5 text-[10px] font-bold text-slate-500 uppercase tracking-widest border-b border-slate-800 mb-1">
                    Exportar como .ICS
                  </div>
                  <button
                    onClick={() => {
                      handleExportVisibleMonth();
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <CalendarIcon size={14} className="text-blue-500" />
                    Mês Atual ({format(currentDate, 'MM/yyyy')})
                  </button>
                  <button
                    onClick={() => {
                      handleExportAll();
                      setShowExportDropdown(false);
                    }}
                    className="w-full text-left px-4 py-2 text-xs text-slate-300 hover:bg-slate-800 hover:text-white font-medium transition-colors cursor-pointer flex items-center gap-2"
                  >
                    <Download size={14} className="text-emerald-500" />
                    Todos os Compromissos
                  </button>
                </div>
              </>
            )}
          </div>

          {profile?.role !== 'consulta' && (
            <button 
              onClick={() => {
                setFormData(initialForm);
                setEditingId(null);
                setShowModal(true);
              }}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-blue-900/20 flex-1 md:flex-none cursor-pointer"
            >
              <Plus size={20} />
              <span className="font-semibold">Agendar Compromisso</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl">
        {/* Calendar Header */}
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-xl font-bold text-white uppercase tracking-tight">
              {format(currentDate, 'MMMM yyyy', { locale: ptBR })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setCurrentDate(subMonths(currentDate, 1))}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              <ChevronLeft size={24} />
            </button>
            <button 
              onClick={() => setCurrentDate(new Date())}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-xs font-bold text-slate-300 transition-all"
            >
              HOJE
            </button>
            <button 
              onClick={() => setCurrentDate(addMonths(currentDate, 1))}
              className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-all"
            >
              <ChevronRight size={24} />
            </button>
          </div>
        </div>

        {/* Days Header */}
        <div className="grid grid-cols-7 bg-slate-950/50 border-b border-slate-800">
          {['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map(day => (
            <div key={day} className="py-3 text-[10px] uppercase font-black tracking-widest text-slate-500 text-center">
              {day}
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div className="grid grid-cols-7">
          {days.map((day, idx) => {
            const dayEvents = getEventsForDay(day);
            const isCurrentMonth = isSameMonth(day, currentDate);
            const holidayName = getBrazilianHoliday(day);
            
            return (
              <div 
                key={day.toString()} 
                onClick={() => {
                  if (profile?.role === 'consulta') return;
                  if (holidayName) {
                    alert(`Não é possível agendar compromissos neste dia. O Gabinete estará fechado devido ao feriado nacional: ${holidayName}.`);
                    return;
                  }
                  setFormData({
                    ...initialForm,
                    data: format(day, 'yyyy-MM-dd')
                  });
                  setEditingId(null);
                  setShowModal(true);
                }}
                className={cn(
                  "min-h-[160px] p-2 border-r border-b border-slate-800 relative group transition-colors",
                  !isCurrentMonth ? "bg-slate-950/30" : "bg-slate-900",
                  holidayName ? "bg-red-500/5 hover:bg-red-500/10 border-red-500/20" : profile?.role !== 'consulta' ? "cursor-pointer hover:bg-slate-850" : "",
                  (idx + 1) % 7 === 0 ? "border-r-0" : ""
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <span className={cn(
                    "w-8 h-8 flex items-center justify-center text-sm font-bold rounded-full transition-all",
                    isToday(day) ? "bg-blue-600 text-white shadow-lg shadow-blue-900/40" : 
                    isCurrentMonth ? "text-slate-300" : "text-slate-600"
                  )}>
                    {format(day, 'd')}
                  </span>
                  <div className="flex flex-col items-end gap-1">
                    {dayEvents.length > 0 && (
                      <span className="text-[10px] text-slate-500 font-mono font-bold">{dayEvents.length}</span>
                    )}
                  </div>
                </div>

                {holidayName && (
                  <div 
                    title={holidayName}
                    className="mb-2 flex items-center gap-1 bg-red-500/10 text-red-400 border border-red-500/15 rounded-lg px-2 py-1 text-[9px] font-black uppercase tracking-tight"
                  >
                    <AlertCircle size={10} className="shrink-0 text-red-400" />
                    <span className="truncate max-w-full">{holidayName}</span>
                  </div>
                )}

                <div className="space-y-1 overflow-y-auto max-h-[90px] scrollbar-none pb-2">
                  {dayEvents.map(event => (
                    <div 
                      key={event.id}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleEdit(event);
                      }}
                      className={cn(
                        "p-1.5 rounded-lg text-[10px] font-medium cursor-pointer border transition-all hover:scale-[1.02]",
                        event.status === 'realizado' ? "bg-slate-950/50 border-emerald-500/10 text-slate-500 opacity-60" :
                        event.tipo === 'Sessão' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                        event.tipo === 'Compromisso' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                        event.tipo === 'Gabinete' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                        "bg-slate-500/10 border-slate-500/20 text-slate-400"
                      )}
                    >
                      <div className="flex items-center justify-between mb-0.5">
                        <div className="flex items-center gap-1">
                          <Clock size={8} />
                          <span>{event.hora_inicio}</span>
                        </div>
                        {event.status === 'realizado' && (
                          <CheckCircle2 size={8} className="text-emerald-500" />
                        )}
                      </div>
                      <div className={cn(
                        "truncate font-bold uppercase tracking-tight",
                        event.status === 'realizado' && "line-through decoration-slate-600"
                      )}>{event.titulo}</div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-4">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <CalendarIcon className="text-blue-500" size={20} />
             Compromissos Recentes
           </h3>
           <div className="space-y-3">
              {events.slice(0, 5).map(event => (
                <div key={event.id} className={cn(
                  "bg-slate-900 border p-4 rounded-2xl flex items-center justify-between group transition-all",
                  event.status === 'realizado' 
                    ? "border-emerald-500/20 opacity-70" 
                    : "border-slate-800 hover:border-blue-500/30"
                )}>
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 border",
                      event.status === 'realizado' ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" :
                      event.tipo === 'Sessão' ? "bg-purple-500/10 border-purple-500/20 text-purple-400" :
                      event.tipo === 'Compromisso' ? "bg-blue-500/10 border-blue-500/20 text-blue-400" :
                      "bg-emerald-500/10 border-emerald-500/20 text-emerald-400"
                    )}>
                      <span className="text-[10px] font-black uppercase leading-none">{format(parse(event.data, 'yyyy-MM-dd', new Date()), 'MMM', { locale: ptBR })}</span>
                      <span className="text-lg font-bold leading-tight">{format(parse(event.data, 'yyyy-MM-dd', new Date()), 'dd')}</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className={cn(
                          "font-bold transition-all",
                          event.status === 'realizado' ? "text-slate-500 line-through decoration-slate-600" : "text-slate-200"
                        )}>{event.titulo}</h4>
                        {event.status === 'realizado' && (
                          <span className="flex items-center gap-1 text-[9px] font-black uppercase text-emerald-400 bg-emerald-500/5 px-2 py-0.5 rounded-full border border-emerald-500/10">
                            <CheckCircle2 size={10} />
                            Realizado
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-slate-500">
                        <div className="flex items-center gap-1.5">
                          <Clock size={12} />
                          {event.hora_inicio} - {event.hora_fim}
                        </div>
                        {event.local && (
                          <div className="flex items-center gap-1.5">
                            <MapPin size={12} />
                            {event.local}
                          </div>
                        )}
                        {event.contato_nome && (
                          <div className="flex items-center gap-1.5 text-blue-400">
                            <span className="font-bold">Contato:</span>
                            {event.contato_nome} {event.contato_telefone && `(${event.contato_telefone})`}
                          </div>
                        )}
                        {event.lembrete_data && (
                          <div className="flex items-center gap-1.5 text-amber-400">
                             <AlertCircle size={12} />
                             <span className="font-bold italic">Lembrete: {format(parse(event.lembrete_data, 'yyyy-MM-dd', new Date()), 'dd/MM')} {event.lembrete_hora && ` às ${event.lembrete_hora}`}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
                    <button 
                      onClick={() => handleExportSingleEvent(event)} 
                      title="Exportar compromisso (.ics)"
                      className="p-2 hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 rounded-lg flex flex-col items-center gap-0.5 cursor-pointer"
                    >
                      <Download size={16} />
                      <span className="text-[8px] font-black uppercase">Exportar</span>
                    </button>
                    {profile?.role !== 'consulta' && (
                      <>
                        <button 
                          onClick={() => handleToggleComplete(event)} 
                          title={event.status === 'realizado' ? "Marcar como pendente" : "Marcar como realizado"}
                          className={cn(
                            "p-2 rounded-lg flex flex-col items-center gap-0.5 transition-colors",
                            event.status === 'realizado'
                              ? "bg-emerald-500/10 text-emerald-400"
                              : "hover:bg-emerald-500/10 text-slate-500 hover:text-emerald-400"
                          )}
                        >
                          <CheckCircle2 size={16} />
                          <span className="text-[8px] font-black uppercase">{event.status === 'realizado' ? 'Concluir' : 'Cumprir'}</span>
                        </button>
                        <button 
                          onClick={() => handlePostpone(event)} 
                          title="Adiar para amanhã"
                          className="p-2 hover:bg-amber-500/10 text-slate-500 hover:text-amber-400 rounded-lg flex flex-col items-center gap-0.5"
                        >
                          <History size={16} />
                          <span className="text-[8px] font-black uppercase">Adiar</span>
                        </button>
                        <button 
                          onClick={() => handleEdit(event)} 
                          title="Remarcar / Editar"
                          className="p-2 hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 rounded-lg flex flex-col items-center gap-0.5"
                        >
                          <Edit2 size={16} />
                          <span className="text-[8px] font-black uppercase">Remarcar</span>
                        </button>
                        <button 
                          onClick={() => handleDelete(event.id, event.titulo)} 
                          title="Excluir"
                          className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg flex flex-col items-center gap-0.5"
                        >
                          <Trash2 size={16} />
                          <span className="text-[8px] font-black uppercase">Excluir</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {events.length === 0 && !loading && (
                <div className="p-12 text-center border-2 border-dashed border-slate-800 rounded-3xl">
                  <CalendarIcon size={40} className="mx-auto text-slate-700 mb-4" />
                  <p className="text-slate-500 font-medium">Nenhum compromisso agendado.</p>
                </div>
              )}
           </div>
        </div>

        <div className="space-y-4">
           <h3 className="text-lg font-bold text-white flex items-center gap-2">
             <Clock className="text-emerald-500" size={20} />
             Dias de Atendimento
           </h3>
           <div className="bg-slate-900 border border-slate-800 p-6 rounded-3xl space-y-6">
              <div>
                <span className="text-[10px] font-black uppercase text-slate-500 tracking-widest block mb-4">Gabinete Oficial</span>
                <div className="space-y-4">
                  {[
                    { day: 'Segunda-feira', hours: `${officeHours.inicio} - ${officeHours.fim}` },
                    { day: 'Terça-feira', hours: `${officeHours.inicio} - ${officeHours.fim}` },
                    { day: 'Quarta-feira', hours: `${officeHours.inicio} - ${officeHours.fim}` },
                    { day: 'Quinta-feira', hours: `${officeHours.inicio} - ${officeHours.fim}` },
                    { day: 'Sexta-feira', hours: `${officeHours.inicio} - ${officeHours.fim}` },
                  ].map((d, i) => (
                    <div key={i} className="flex justify-between items-center pb-3 border-b border-slate-800 last:border-0 last:pb-0">
                      <span className="text-sm text-slate-300 font-medium">{d.day}</span>
                      <span className="text-xs text-emerald-400 font-bold font-mono">{d.hours}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                <div className="flex gap-3">
                  <AlertCircle size={18} className="text-blue-400 shrink-0" />
                  <p className="text-xs text-slate-400 leading-relaxed">
                    Os atendimentos em bairros e zona rural são agendados semanalmente e publicados aqui.
                  </p>
                </div>
              </div>
           </div>
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowModal(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm" 
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-800 flex items-center justify-between">
                <h3 className="text-xl font-bold text-white">{editingId ? 'Editar Compromisso' : 'Agendar Compromisso'}</h3>
                <button onClick={() => setShowModal(false)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-400"><X size={24} /></button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">
                {error && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center gap-3 text-red-400 text-xs">
                    <AlertCircle size={18} />
                    <p>{error}</p>
                  </div>
                )}
                
                <fieldset disabled={profile?.role === 'consulta'} className="grid grid-cols-2 gap-4 border-none p-0 m-0">
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Título do Compromisso</label>
                    <input autoFocus required type="text" value={formData.titulo} onChange={e => setFormData({...formData, titulo: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white" placeholder="Ex: Sessão Plenária" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Tipo</label>
                    <select value={formData.tipo} onChange={e => setFormData({...formData, tipo: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white">
                      <option>Compromisso</option>
                      <option>Sessão</option>
                      <option>Gabinete</option>
                      <option>Viagem</option>
                      <option>Outro</option>
                    </select>
                  </div>
                   <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Data</label>
                    <input required type="date" value={formData.data} onChange={e => setFormData({...formData, data: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white [color-scheme:dark]" />
                    {formData.data && (() => {
                      try {
                        const parsedDate = parse(formData.data, 'yyyy-MM-dd', new Date());
                        const holiday = getBrazilianHoliday(parsedDate);
                        if (holiday) {
                          return (
                            <span className="text-[11px] text-red-400 font-bold block mt-1.5 flex items-center gap-1.5 animate-pulse">
                              <AlertCircle size={12} className="shrink-0 text-red-400" />
                              Feriado: {holiday} (Gabinete Fechado)
                            </span>
                          );
                        }
                      } catch (err) {}
                      return null;
                    })()}
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Hora Início</label>
                    <input required type="time" value={formData.hora_inicio} onChange={e => setFormData({...formData, hora_inicio: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white [color-scheme:dark]" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Hora Fim</label>
                    <input required type="time" value={formData.hora_fim} onChange={e => setFormData({...formData, hora_fim: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white [color-scheme:dark]" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Local</label>
                    <input type="text" value={formData.local} onChange={e => setFormData({...formData, local: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white" placeholder="Ex: Câmara Municipal" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Nome de Contato</label>
                    <input type="text" value={formData.contato_nome} onChange={e => setFormData({...formData, contato_nome: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white" placeholder="Pessoa de contato" />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Telefone de Contato</label>
                    <input type="text" value={formData.contato_telefone} onChange={e => setFormData({...formData, contato_telefone: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white" placeholder="(00) 00000-0000" />
                  </div>
                  <div className="col-span-2 grid grid-cols-2 gap-4 pt-4 border-t border-slate-800">
                    <div className="col-span-2">
                       <h4 className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-2 flex items-center gap-2">
                         <AlertCircle size={10} className="text-amber-500" />
                         Lembrete Automático
                       </h4>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Data do Lembrete</label>
                      <input type="date" value={formData.lembrete_data} onChange={e => setFormData({...formData, lembrete_data: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white [color-scheme:dark]" />
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-slate-500 uppercase">Hora do Lembrete</label>
                      <input type="time" value={formData.lembrete_hora} onChange={e => setFormData({...formData, lembrete_hora: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white [color-scheme:dark]" />
                    </div>
                  </div>
                  <div className="col-span-2 pt-4">
                    <label className="text-[10px] font-bold text-slate-500 uppercase">Descrição/Notas</label>
                    <textarea rows={3} value={formData.descricao} onChange={e => setFormData({...formData, descricao: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none mt-1 text-white resize-none" placeholder="Detalhes adicionais..." />
                  </div>
                </fieldset>

                {editingId && (
                  <button 
                    type="button"
                    onClick={() => {
                      const currentEvent = events.find(e => e.id === editingId);
                      if (currentEvent) {
                        handleExportSingleEvent(currentEvent);
                      }
                    }}
                    className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 py-3.5 rounded-xl font-bold shadow-md hover:border-slate-600 transition-all mt-4 flex items-center justify-center gap-2 cursor-pointer border border-slate-700"
                  >
                    <Download size={18} />
                    <span>Exportar Compromisso (.ics)</span>
                  </button>
                )}

                {profile?.role === 'consulta' ? (
                  <div className="bg-slate-950/40 p-3 rounded-xl border border-slate-800 text-center text-slate-500 text-xs italic font-mono mt-2">
                    Visualização da Agenda (Apenas Leitura)
                  </div>
                ) : (
                  <button 
                    type="submit" 
                    disabled={submitting}
                    className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed py-3.5 rounded-xl font-bold text-white shadow-xl shadow-blue-900/20 transition-all mt-4 flex items-center justify-center gap-3 cursor-pointer"
                  >
                    {submitting ? (
                      <>
                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Salvando...
                      </>
                    ) : (
                      editingId ? 'Salvar Alterações' : 'Confirmar Agendamento'
                    )}
                  </button>
                )}
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

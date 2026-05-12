import React, { useState, useEffect } from 'react';
import { 
  Bell, 
  X, 
  Calendar as CalendarIcon, 
  Stethoscope, 
  MessageSquare,
  Clock,
  ExternalLink
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  onSnapshot,
  orderBy,
  limit
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { format, isToday, parseISO, isAfter, startOfToday } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface NotificationItem {
  id: string;
  title: string;
  type: 'agenda' | 'medical' | 'suggestion';
  date: string;
  time?: string;
  description: string;
  userId?: string;
}

export default function NotificationCenter() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [hasNew, setHasNew] = useState(false);
  const [readIds, setReadIds] = useState<string[]>(() => {
    const saved = localStorage.getItem('read_notifications');
    return saved ? JSON.parse(saved) : [];
  });

  useEffect(() => {
    if (!profile) return;

    const todayStr = format(new Date(), 'yyyy-MM-dd');

    // 1. Fetch Today's Agenda (Events for today)
    const qAgenda = query(
      collection(db, 'agenda_vereador'),
      where('data', '==', todayStr)
    );

    // 1.1 Fetch Future Agenda Reminders
    const qAgendaReminders = query(
      collection(db, 'agenda_vereador'),
      where('lembrete_data', '>=', todayStr)
    );

    // 2. Fetch Medical Exam Reminders (from today onwards)
    const qMedical = query(
      collection(db, 'atendimentos_medicos'),
      where('lembrete_exame', '>=', todayStr)
    );

    // 3. Fetch Suggestion Reminders (from today onwards)
    const qSuggestions = query(
      collection(db, 'sugestoes'),
      where('lembrete', '>=', todayStr)
    );

    const unsubAgenda = onSnapshot(qAgenda, (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id,
        title: doc.data().titulo,
        type: 'agenda' as const,
        date: doc.data().data,
        time: doc.data().hora_inicio,
        description: doc.data().local || 'Sem local definido'
      }));
      updateNotifications(items, 'agenda');
    });

    const unsubAgendaReminders = onSnapshot(qAgendaReminders, (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id + '_rem',
        title: `Lembrete: ${doc.data().titulo}`,
        type: 'agenda' as const,
        date: doc.data().lembrete_data,
        time: doc.data().lembrete_hora,
        description: (doc.data().local ? `No ${doc.data().local}. ` : '') + (doc.data().descricao || '')
      }));
      updateNotifications(items, 'agenda_rem');
    });

    const unsubMedical = onSnapshot(qMedical, (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id,
        title: `Exame: ${doc.data().nome_completo}`,
        type: 'medical' as const,
        date: doc.data().lembrete_exame,
        description: doc.data().especialidade || 'Consulta Médica'
      }));
      updateNotifications(items, 'medical');
    });

    const unsubSuggestions = onSnapshot(qSuggestions, (snap) => {
      const items = snap.docs.map(doc => ({
        id: doc.id,
        title: `Retorno Sugestão: ${doc.data().nome_completo}`,
        type: 'suggestion' as const,
        date: doc.data().lembrete,
        description: doc.data().sugestao?.substring(0, 50) + '...'
      }));
      updateNotifications(items, 'suggestion');
    });

    let unsubLogs = () => {};
    if (profile.role === 'admin' || profile.role === 'vereador' || profile.role === 'secretaria_parlamentar' || profile.email === 'cleciotecnologia@gmail.com') {
      const qLogs = query(
        collection(db, 'logs'),
        where('acao', '==', 'Primeiro Acesso'),
        orderBy('criado_em', 'desc'),
        limit(5)
      );
      unsubLogs = onSnapshot(qLogs, (snap) => {
        const items = snap.docs.map(doc => {
          const data = doc.data();
          const date = data.criado_em?.toDate ? format(data.criado_em.toDate(), 'yyyy-MM-dd') : todayStr;
          const time = data.criado_em?.toDate ? format(data.criado_em.toDate(), 'HH:mm') : '';
          return {
            id: doc.id,
            title: `Novo Acesso: ${data.usuario_nome}`,
            type: 'suggestion' as const, // Reusing suggestion type for styling or could add 'log'
            date,
            time,
            description: `O usuário ${data.usuario_nome} realizou seu primeiro acesso ao sistema.`,
            userId: data.usuario_id
          };
        });
        updateNotifications(items, 'primeiro_acesso');
      });
    }

    return () => {
      unsubAgenda();
      unsubAgendaReminders();
      unsubMedical();
      unsubSuggestions();
      unsubLogs();
    };
  }, [profile]);

  const updateNotifications = (newItems: NotificationItem[], type: string) => {
    setNotifications(prev => {
      // Filter out only the exact type group being updated
      const otherTypes = prev.filter(n => {
        if (type === 'agenda') return n.type !== 'agenda' || n.title.startsWith('Lembrete:');
        if (type === 'agenda_rem') return n.type !== 'agenda' || !n.title.startsWith('Lembrete:');
        if (type === 'primeiro_acesso') return !n.title.startsWith('Novo Acesso:');
        return n.type !== type;
      });
      
      const filteredNew = newItems.filter(item => !readIds.includes(item.id));
      const combined = [...otherTypes.filter(item => !readIds.includes(item.id)), ...filteredNew].sort((a, b) => {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return (a.time || '').localeCompare(b.time || '');
      });
      
      const trulyNew = filteredNew.filter(n => !otherTypes.find(o => o.id === n.id));
      if (trulyNew.length > 0) setHasNew(true);
      return combined;
    });
  };

  const handleMarkAsRead = (id: string) => {
    const newReadIds = [...new Set([...readIds, id])];
    setReadIds(newReadIds);
    localStorage.setItem('read_notifications', JSON.stringify(newReadIds));
    setNotifications(prev => prev.filter(n => n.id !== id));
  };

  const handleMarkAllAsRead = () => {
    const allIds = notifications.map(n => n.id);
    const newReadIds = [...new Set([...readIds, ...allIds])];
    setReadIds(newReadIds);
    localStorage.setItem('read_notifications', JSON.stringify(newReadIds));
    setNotifications([]);
    setHasNew(false);
  };

  return (
    <div className="relative">
      <button 
        onClick={() => {
          setIsOpen(!isOpen);
          setHasNew(false);
        }}
        className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl text-slate-400 hover:text-white transition-all relative group"
      >
        <Bell size={20} className={cn(hasNew && "animate-bounce text-blue-400")} />
        {hasNew && (
          <span className="absolute top-2 right-2 w-2 h-2 bg-blue-500 rounded-full shadow-lg shadow-blue-500/50" />
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[110] bg-slate-950/20 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-3 w-[350px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl p-6 z-[120] flex flex-col max-h-[500px]"
            >
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h3 className="font-bold text-white uppercase tracking-wider text-xs">Lembretes e Agenda</h3>
                  <p className="text-[10px] text-slate-500 mt-0.5">Sincronizado em tempo real</p>
                </div>
                <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-slate-800 rounded-lg text-slate-500"><X size={16} /></button>
              </div>

              <div className="space-y-3 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-slate-800">
                {notifications.length === 0 ? (
                  <div className="py-12 text-center flex flex-col items-center gap-3">
                    <div className="w-12 h-12 bg-slate-800 rounded-2xl flex items-center justify-center">
                       <Clock className="text-slate-600" size={24} />
                    </div>
                    <p className="text-xs text-slate-500 italic">Nenhum lembrete para hoje ou próximos dias.</p>
                  </div>
                ) : notifications.map((notif) => (
                  <div key={notif.id} className="bg-slate-950/50 border border-slate-800 p-4 rounded-2xl group hover:border-blue-500/30 transition-all">
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-xl flex items-center justify-center shrink-0",
                        notif.type === 'agenda' ? "bg-purple-500/10 text-purple-400" :
                        notif.type === 'medical' ? "bg-emerald-500/10 text-emerald-400" :
                        "bg-blue-500/10 text-blue-400"
                      )}>
                        {notif.type === 'agenda' ? <CalendarIcon size={14} /> :
                         notif.type === 'medical' ? <Stethoscope size={14} /> :
                         <MessageSquare size={14} />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start">
                          <h4 className="text-xs font-bold text-slate-200 truncate">{notif.title}</h4>
                          <div className="flex items-center gap-2">
                             <span className={cn(
                                "text-[9px] font-black uppercase whitespace-nowrap",
                                isToday(new Date(notif.date + 'T12:00:00')) ? "text-blue-400" : "text-slate-500"
                             )}>
                                {isToday(new Date(notif.date + 'T12:00:00')) ? 'HOJE' : format(new Date(notif.date + 'T12:00:00'), 'dd/MM')}
                                {notif.time && ` • ${notif.time}`}
                             </span>
                             <button 
                               onClick={() => handleMarkAsRead(notif.id)}
                               className="opacity-0 group-hover:opacity-100 p-1 hover:bg-slate-800 rounded text-slate-500 hover:text-white transition-all"
                             >
                               <X size={12} />
                             </button>
                          </div>
                        </div>
                        <p className="text-[10px] text-slate-500 mt-1 truncate leading-relaxed">{notif.description}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-slate-800">
                <button 
                  onClick={handleMarkAllAsRead}
                  className="w-full py-2.5 text-[10px] font-black uppercase text-slate-500 hover:text-white transition-all tracking-widest text-center"
                >
                   Marcar todos como lidos
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

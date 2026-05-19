import React, { useEffect, useState } from 'react';
import { 
  collection, 
  addDoc, 
  query, 
  where,
  orderBy, 
  onSnapshot,
  serverTimestamp,
  updateDoc,
  doc,
  deleteDoc
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { 
  Plus, 
  Search, 
  Package,
  X,
  Truck,
  ArrowRight,
  FileText,
  Edit2,
  Trash2,
  Printer,
  Share2,
  Mail,
  MessageCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';

export default function Malotes() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [cabinetData, setCabinetData] = useState<any>(null);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const initialForm = {
    protocolo: '',
    numero_documento: '',
    destinatario: '',
    secretaria: 'Secretaria de Saúde',
    tipo_documento: 'Ofício',
    assunto: '',
    status: 'Enviado',
    linkedMedicalIds: [] as string[]
  };

  const [formData, setFormData] = useState(initialForm);
  const [medicalAppointments, setMedicalAppointments] = useState<any[]>([]);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    // Fetch medical appointments that are either not linked to a malote or already linked to THIS malote
    const medQuery = query(
      collection(db, 'atendimentos_medicos'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );

    const unsubscribeMed = onSnapshot(medQuery, (snap) => {
      setMedicalAppointments(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const q = query(
      collection(db, 'malotes'), 
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      console.error("Error listening to malotes:", error);
      setLoading(false);
    });

    const unsubCabinet = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        setCabinetData(snap.data());
      }
    });

    return () => {
      unsubscribe();
      unsubCabinet();
    };
  }, [profile?.cabinetId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      let maloteId = editingId;
      if (editingId) {
        const existing = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'malotes', editingId), {
          ...formData,
          cabinetId: profile?.cabinetId,
          updated_at: serverTimestamp()
        });
        await logAction('Atualizar', 'malotes', editingId, { previous: existing, next: formData });
      } else {
        const docRef = await addDoc(collection(db, 'malotes'), {
          ...formData,
          cabinetId: profile?.cabinetId,
          created_at: serverTimestamp(),
        });
        maloteId = docRef.id;
        await logAction('Criar', 'malotes', docRef.id, { next: formData });
      }

      // Update medical appointments status/pouch_id
      if (maloteId && formData.linkedMedicalIds.length > 0) {
        for (const medId of formData.linkedMedicalIds) {
          await updateDoc(doc(db, 'atendimentos_medicos', medId), {
            malote_id: maloteId,
            malote_protocolo: formData.protocolo,
            status: 'Encaminhado',
            updated_at: serverTimestamp()
          });
        }
      }

      closeModal();
    } catch (err) {
      console.error(err);
    }
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(initialForm);
  };

  const handleEdit = (item: any) => {
    setEditingId(item.id);
    setFormData({
      protocolo: item.protocolo || '',
      numero_documento: item.numero_documento || '',
      destinatario: item.destinatario || '',
      secretaria: item.secretaria || 'Secretaria de Saúde',
      tipo_documento: item.tipo_documento || 'Ofício',
      assunto: item.assunto || '',
      status: item.status || 'Enviado',
      linkedMedicalIds: item.linkedMedicalIds || []
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Excluir este malote?')) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'malotes', id));
      await logAction('Excluir', 'malotes', id, { previous: existing });
    } catch (err) {
      console.error(err);
    }
  };

  const handlePrint = (item: any) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Por favor, permita pop-ups para imprimir o protocolo.');
      return;
    }

    const dateStr = item.created_at?.toDate 
      ? format(item.created_at.toDate(), 'dd/MM/yyyy HH:mm', { locale: ptBR }) 
      : format(new Date(), 'dd/MM/yyyy HH:mm', { locale: ptBR });

    const relatedAppointments = medicalAppointments.filter(m => formData.linkedMedicalIds.includes(m.id));
    const appointmentsHtml = relatedAppointments.length > 0 
      ? `<div style="margin-top: 30px;">
          <h3 style="font-size: 14px; text-transform: uppercase; color: #1e293b; border-bottom: 2px solid #f1f5f9; padding-bottom: 8px; margin-bottom: 15px;">Listagem de Atendimentos Incluídos</h3>
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <thead>
              <tr style="background: #f8fafc; text-align: left;">
                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Paciente</th>
                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Especialidade</th>
                <th style="padding: 10px; border-bottom: 1px solid #e2e8f0;">Procedimento</th>
              </tr>
            </thead>
            <tbody>
              ${relatedAppointments.map(app => `
                <tr>
                  <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;"><strong>${app.nome_completo}</strong><br/><span style="font-size: 10px; color: #64748b;">CPF: ${app.cpf || '---'}</span></td>
                  <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${app.especialidade}</td>
                  <td style="padding: 10px; border-bottom: 1px solid #f1f5f9;">${app.descricao_problema || 'Encaminhamento'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>`
      : '';

    printWindow.document.write(`
      <html>
        <head>
          <title>Protocolo de Malote - ${item.protocolo || '#000'}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;700&family=JetBrains+Mono:wght@700&display=swap');
            body { font-family: 'Inter', sans-serif; padding: 50px; color: #1a1a1a; line-height: 1.6; }
            .header { text-align: center; border-bottom: 2px solid #eee; padding-bottom: 30px; margin-bottom: 40px; }
            .header h1 { margin: 0; font-size: 28px; letter-spacing: -0.02em; color: #111; }
            .header p { margin: 5px 0; color: #666; font-size: 14px; text-transform: uppercase; letter-spacing: 0.1em; }
            
            .protocol-section { text-align: center; margin-bottom: 50px; }
            .protocol-box { 
              display: inline-block;
              background: #f8fafc;
              border: 2px solid #e2e8f0;
              padding: 24px 40px; 
              border-radius: 20px;
            }
            .protocol-label { font-size: 11px; text-transform: uppercase; color: #64748b; font-weight: 800; letter-spacing: 0.1em; margin-bottom: 8px; }
            .protocol-number { font-size: 32px; font-weight: 800; font-family: 'JetBrains Mono', monospace; color: #d97706; }
            
            .details-grid { 
              display: grid; 
              grid-template-columns: 1fr 1fr; 
              gap: 30px; 
              background: #fff;
              border: 1px solid #f1f5f9;
              padding: 30px;
              border-radius: 20px;
              margin-bottom: 50px;
            }
            .field-group { border-bottom: 1px solid #f8fafc; padding-bottom: 12px; }
            .label { font-size: 10px; text-transform: uppercase; color: #94a3b8; font-weight: 800; margin-bottom: 4px; display: block; }
            .value { font-size: 15px; font-weight: 600; color: #334155; }
            
            .signature-area { display: grid; grid-template-columns: 1fr 1fr; gap: 60px; margin-top: 100px; }
            .signature-box { text-align: center; }
            .line { border-top: 2px solid #334155; margin-bottom: 15px; }
            .ref { font-size: 12px; font-weight: 700; color: #1e293b; }
            .sub { font-size: 11px; color: #64748b; margin-top: 2px; }
            
            .footer { 
              position: fixed;
              bottom: 40px;
              left: 50px;
              right: 50px;
              border-top: 1px solid #f1f5f9;
              padding-top: 20px;
              font-size: 10px; 
              color: #94a3b8; 
              text-align: center;
              font-style: italic;
            }
            
            @media print {
              body { padding: 0; }
              .header { margin-top: 20px; }
              button { display: none; }
            }
          </style>
        </head>
        <body>
          <div class="header">
            ${(cabinetData?.cabinet_logo || cabinetData?.vereador_photo)
              ? `<img src="${cabinetData.cabinet_logo || cabinetData.vereador_photo}" style="max-height: 80px; width: auto; margin-bottom: 15px; display: block; margin-left: auto; margin-right: auto;" />` 
              : ''}
            <h1>PROTOCOLO DE ENVIO</h1>
            <p>${cabinetData?.app_name || cabinetData?.name || 'Gabinete Parlamentar Municipal'}</p>
          </div>

          <div class="protocol-section">
            <div class="protocol-box">
              <div class="protocol-label">Identificador Único</div>
              <div class="protocol-number">${item.protocolo || '#000'}</div>
            </div>
          </div>

          <div class="details-grid">
            <div class="field-group">
               <span class="label">Nº do Documento</span>
               <div class="value">${item.numero_documento || '---'}</div>
            </div>
            <div class="field-group">
               <span class="label">Tipo de Documento</span>
               <div class="value">${item.tipo_documento}</div>
            </div>
            <div class="field-group">
               <span class="label">Assunto / Descritivo</span>
               <div class="value">${item.assunto}</div>
            </div>
            <div class="field-group">
               <span class="label">Secretaria / Órgão Destinatário</span>
               <div class="value">${item.secretaria}</div>
            </div>
            <div class="field-group">
               <span class="label">Pessoa de Contato</span>
               <div class="value">${item.destinatario}</div>
            </div>
            <div class="field-group">
               <span class="label">Data de Emissão</span>
               <div class="value">${dateStr}</div>
            </div>
          </div>

          ${appointmentsHtml}

          <div style="background: #fff9f0; padding: 20px; border-radius: 12px; border: 1px dashed #fcd34d; font-size: 13px; color: #92400e; margin-top: 30px;">
             <strong>Observação:</strong> Este documento serve como comprovante de entrega de malote entre o Gabinete e a Secretaria. Favor colher assinatura no ato da entrega física.
          </div>

          <div class="signature-area">
            <div class="signature-box">
              <div class="line"></div>
              <div class="ref text-uppercase">Gabinete Vereador</div>
              <div class="sub">Responsável pelo Envio</div>
            </div>
            <div class="signature-box">
              <div class="line"></div>
              <div class="ref uppercase text-uppercase">Recebedor</div>
              <div class="sub">Carimbo e Assinatura</div>
            </div>
          </div>

          <div class="footer">
            Gerado eletronicamente em ${format(new Date(), 'dd/MM/yyyy HH:mm:ss')} • Gabinete Virtual v2.0
          </div>
          
          <script>
            window.onload = function() {
              setTimeout(() => {
                window.print();
              }, 500);
            }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleWhatsApp = (item: any) => {
    const text = `*PROTOCOLO DE MALOTE - GABINETE*\n\n` +
      `*Protocolo:* ${item.protocolo || '#000'}\n` +
      `*Assunto:* ${item.assunto}\n` +
      `*Destino:* ${item.secretaria}\n` +
      `*A/C:* ${item.destinatario}\n` +
      `*Status:* ${item.status}\n\n` +
      `_Gerado via Gabinete Virtual_`;
    
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const handleEmail = (item: any) => {
    const subject = `Protocolo de Malote: ${item.protocolo || '#000'}`;
    const body = `Detalhes do Protocolo de Malote:\n\n` +
      `Protocolo: ${item.protocolo || '#000'}\n` +
      `Assunto: ${item.assunto}\n` +
      `Secretaria/Destino: ${item.secretaria}\n` +
      `Destinatário: ${item.destinatario}\n` +
      `Status: ${item.status}\n\n` +
      `Atenciosamente,\nGabinete Parlamentar`;
    
    const url = `mailto:?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.open(url, '_blank');
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white flex items-center gap-3">
             <Package className="text-amber-500 shrink-0" />
             Controle de Malotes
          </h1>
          <p className="text-slate-400 text-sm">Protocolos de envio para secretarias.</p>
        </div>
        <button 
          onClick={() => setShowModal(true)}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-3 md:py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-amber-900/20 w-full sm:w-auto"
        >
          <Plus size={20} />
          <span className="font-semibold text-sm">Novo Protocolo</span>
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-6 border-b border-slate-800 flex items-center justify-between">
           <div className="flex items-center gap-3">
              <Truck className="text-slate-500" size={20} />
              <h2 className="font-semibold text-slate-200">Rastreamento de Documentos</h2>
           </div>
        </div>
        <div className="space-y-1 p-2">
           {loading ? (
             <div className="py-10 text-center text-slate-500">Buscando dados...</div>
           ) : data.length === 0 ? (
             <div className="py-10 text-center text-slate-600">Nenhum malote registrado.</div>
           ) : data.map((item) => (
             <motion.div 
               key={item.id}
               className="p-4 rounded-xl hover:bg-slate-800/50 transition-all group border border-transparent hover:border-slate-700 flex flex-col md:flex-row md:items-center gap-4"
             >
                <div className="flex flex-col items-center justify-center px-4 py-2 bg-slate-900 border border-slate-700 rounded-2xl min-w-[100px] shadow-sm">
                   <span className="text-[8px] font-bold uppercase text-slate-500 tracking-widest mb-0.5">Protocolo</span>
                   <span className="font-mono text-[11px] text-amber-500 font-bold tracking-tight select-all">
                      {item.protocolo || '#000'}
                   </span>
                </div>
                <div className="flex-1">
                   <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm font-bold text-slate-100">{item.assunto}</span>
                      <span className="text-[10px] px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded border border-blue-500/20 font-bold uppercase">{item.tipo_documento}</span>
                      {item.numero_documento && (
                        <span className="text-[10px] px-1.5 py-0.5 bg-amber-500/10 text-amber-500 rounded border border-amber-500/20 font-mono font-bold tracking-tight">
                           Nº {item.numero_documento}
                        </span>
                      )}
                   </div>
                   <div className="flex items-center gap-2 text-xs text-slate-400">
                      <span>Origem: Gabinete</span>
                      <ArrowRight size={10} />
                      <span className="text-slate-300">{item.destinatario} - {item.secretaria}</span>
                   </div>
                </div>
                <div className="flex items-center gap-2">
                   <div className="text-right flex flex-col">
                      <span className="text-xs font-bold text-emerald-400 uppercase tracking-wider">{item.status}</span>
                      <span className="text-[10px] text-slate-500">
                        {item.created_at?.toDate ? format(item.created_at.toDate(), 'dd/MM/yyyy', { locale: ptBR }) : '...'}
                      </span>
                   </div>
                   <div className="flex items-center gap-1">
                      {profile?.role !== 'consulta' && (
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2 hover:bg-blue-500/10 text-slate-500 hover:text-blue-400 rounded-lg transition-all"
                        >
                           <Edit2 size={16} />
                        </button>
                      )}
                      {(profile?.role === 'admin' || profile?.role === 'secretaria_parlamentar') && (
                        <button 
                          onClick={() => handleDelete(item.id)}
                          className="p-2 hover:bg-red-500/10 text-slate-500 hover:text-red-400 rounded-lg transition-all"
                        >
                           <Trash2 size={16} />
                        </button>
                      )}
                      <button 
                        onClick={() => handlePrint(item)}
                        className="p-2 hover:bg-slate-700 rounded-lg text-slate-500 hover:text-white transition-all"
                        title="Imprimir Protocolo"
                      >
                         <Printer size={18} />
                      </button>
                      <button 
                        onClick={() => handleWhatsApp(item)}
                        className="p-2 hover:bg-emerald-500/10 rounded-lg text-slate-500 hover:text-emerald-500 transition-all"
                        title="Enviar via WhatsApp"
                      >
                         <MessageCircle size={18} />
                      </button>
                      <button 
                        onClick={() => handleEmail(item)}
                        className="p-2 hover:bg-blue-500/10 rounded-lg text-slate-500 hover:text-blue-500 transition-all"
                        title="Enviar via E-mail"
                      >
                         <Mail size={18} />
                      </button>
                   </div>
                </div>
             </motion.div>
           ))}
        </div>
      </div>

      <AnimatePresence>
        {showModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={closeModal} className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[60]" />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }} 
              animate={{ opacity: 1, scale: 1, y: 0 }} 
              exit={{ opacity: 0, scale: 0.95, y: 20 }} 
              className="fixed inset-x-2 top-4 bottom-4 md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[500px] md:h-auto md:max-h-[90vh] bg-slate-900 border border-slate-800 rounded-3xl z-[70] flex flex-col shadow-2xl overflow-hidden"
            >
               <div className="px-6 md:px-8 py-4 md:py-6 border-b border-slate-800 flex items-center justify-between">
                  <h2 className="text-lg md:text-xl font-bold">{editingId ? 'Editar Protocolo' : 'Novo Protocolo de Envio'}</h2>
                  <button onClick={closeModal} className="p-2 hover:bg-slate-800 rounded-lg"><X size={20} /></button>
               </div>
               <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Nº Malote / Protocolo</label>
                        <input value={formData.protocolo} onChange={e => setFormData({...formData, protocolo: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" placeholder="Ex: 2024/001" />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-bold uppercase text-slate-500">Tipo Documento</label>
                        <select value={formData.tipo_documento} onChange={e => setFormData({...formData, tipo_documento: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none appearance-none">
                           <option>Ofício</option>
                           <option>Requerimento</option>
                           <option>Indicação</option>
                           <option>Projeto de Lei</option>
                           <option>Memorando</option>
                           <option>Outros</option>
                        </select>
                     </div>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500">Nº do Documento (Ofício/Req/Ind)</label>
                     <input value={formData.numero_documento} onChange={e => setFormData({...formData, numero_documento: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" placeholder="Ex: 123/2024" />
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500">Secretaria / Órgão Destinatário</label>
                     <select 
                        value={formData.secretaria} 
                        onChange={e => setFormData({...formData, secretaria: e.target.value})} 
                        className="w-full bg-slate-800 rounded-xl p-3 border-none appearance-none"
                     >
                        <option>Secretaria de Saúde</option>
                        <option>Secretaria de Educação</option>
                        <option>Secretaria de Infraestrutura</option>
                        <option>Secretaria de Assistência Social</option>
                        <option>Secretaria de Administração</option>
                        <option>Secretaria de Finanças</option>
                        <option>Câmara Municipal</option>
                        <option>Prefeitura Municipal</option>
                        <option>Outros</option>
                     </select>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500">Destinatário (Órgão / Pessoa)</label>
                     <input value={formData.destinatario} onChange={e => setFormData({...formData, destinatario: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" />
                  </div>
                  <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-slate-500">Status</label>
                      <select value={formData.status} onChange={e => setFormData({...formData, status: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none appearance-none">
                          <option>Enviado</option>
                          <option>Pendente</option>
                          <option>Recebido</option>
                      </select>
                  </div>
                  <div className="space-y-1">
                     <label className="text-[10px] font-bold uppercase text-slate-500">Assunto</label>
                     <input value={formData.assunto} onChange={e => setFormData({...formData, assunto: e.target.value})} className="w-full bg-slate-800 rounded-xl p-3 border-none" />
                  </div>

                  {formData.secretaria === 'Secretaria de Saúde' && (
                    <div className="space-y-2 mt-4">
                      <label className="text-[10px] font-bold uppercase text-slate-500 flex items-center justify-between">
                         Relacionar Atendimentos Médicos
                         <span className="text-blue-400 normal-case font-normal">{formData.linkedMedicalIds.length} selecionados</span>
                      </label>
                      <div className="bg-slate-800/50 rounded-2xl border border-slate-700/50 max-h-[200px] overflow-y-auto">
                        {medicalAppointments.filter(m => !m.malote_id || formData.linkedMedicalIds.includes(m.id)).length === 0 ? (
                           <div className="p-4 text-center text-xs text-slate-500 italic">Nenhum atendimento pendente encontrado.</div>
                        ) : (
                          medicalAppointments
                            .filter(m => !m.malote_id || formData.linkedMedicalIds.includes(m.id))
                            .map((med) => (
                            <div 
                              key={med.id} 
                              onClick={() => {
                                const isSelected = formData.linkedMedicalIds.includes(med.id);
                                const newIds = isSelected 
                                  ? formData.linkedMedicalIds.filter(id => id !== med.id)
                                  : [...formData.linkedMedicalIds, med.id];
                                setFormData({...formData, linkedMedicalIds: newIds});
                              }}
                              className={cn(
                                "flex items-center gap-3 p-3 cursor-pointer border-b border-slate-700/30 last:border-0 hover:bg-slate-700/30 transition-colors",
                                formData.linkedMedicalIds.includes(med.id) && "bg-blue-500/10"
                              )}
                            >
                              <div className={cn(
                                "w-4 h-4 rounded border flex items-center justify-center shrink-0 transition-colors",
                                formData.linkedMedicalIds.includes(med.id) ? "bg-blue-500 border-blue-500" : "border-slate-600"
                              )}>
                                {formData.linkedMedicalIds.includes(med.id) && <Plus size={12} className="text-white rotate-45" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-bold text-slate-100 truncate">{med.nome_completo}</p>
                                <p className="text-[10px] text-slate-400 truncate">{med.especialidade} {med.descricao_problema && `• ${med.descricao_problema}`}</p>
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}

                  <button type="submit" className="w-full bg-amber-600 hover:bg-amber-700 py-3 mt-4 rounded-xl font-bold text-white shadow-lg shadow-amber-900/20 transition-all">
                      {editingId ? 'Salvar Alterações' : 'Emitir Protocolo'}
                  </button>
               </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

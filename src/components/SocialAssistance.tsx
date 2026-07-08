import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Search, 
  Filter, 
  Plus, 
  Trash2, 
  Edit, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  Truck, 
  User, 
  Phone, 
  Calendar,
  MoreVertical,
  ChevronRight,
  Info,
  Smartphone,
  Save,
  ShoppingBag,
  Stethoscope,
  Baby,
  Printer
} from 'lucide-react';
import { 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  increment,
  getDocs
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { useAuth } from '../hooks/useAuth';
import { motion, AnimatePresence } from 'motion/react';
import { cn, formatProperName } from '../lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logAction } from '../lib/audit';
import { toast } from 'sonner';
import { showSuccessNotification } from '../lib/notifications';
import { handleFirestoreError, OperationType } from '../lib/error-handler';
import { getWhatsAppLink, formatWhatsAppMessage, WhatsAppConfig, sendWhatsAppNotification } from '../lib/whatsapp';

export default function SocialAssistance() {
  const { profile } = useAuth();
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [waConfig, setWaConfig] = useState<WhatsAppConfig | null>(null);

  // States for CPF verification
  const [searchingCitizen, setSearchingCitizen] = useState(false);
  const [cpfError, setCpfError] = useState<string | null>(null);
  const [cpfValidated, setCpfValidated] = useState<boolean>(false);

  // Stock / Inventory Control States
  const [activeTab, setActiveTab] = useState<'auxilios' | 'estoque'>('auxilios');
  const [stockItems, setStockItems] = useState<any[]>([]);
  const [loadingStock, setLoadingStock] = useState(true);
  const [showStockModal, setShowStockModal] = useState(false);
  const [editingStockId, setEditingStockId] = useState<string | null>(null);

  const initialStockForm = {
    nome: '',
    tipo_beneficio: 'Cesta Básica',
    quantidade_atual: 0,
    quantidade_minima: 5,
    observacoes: ''
  };

  const [stockFormData, setStockFormData] = useState(initialStockForm);

  const initialForm = {
    beneficiado_nome: '',
    beneficiado_telefone: '',
    beneficiado_cpf: '',
    tipo_beneficio: 'Cesta Básica',
    quantidade: 1,
    status: 'Pendente',
    data_entrega_prevista: '',
    observacoes: '',
    entregue_por_nome: '',
    item_estoque_id: ''
  };

  const [formData, setFormData] = useState(initialForm);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'auxilio_social'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('created_at', 'desc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setData(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching social assistance:", err);
      setLoading(false);
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  useEffect(() => {
    if (!profile?.cabinetId) return;

    const q = query(
      collection(db, 'auxilio_estoque'),
      where('cabinetId', '==', profile.cabinetId),
      orderBy('nome', 'asc')
    );

    const unsub = onSnapshot(q, (snap) => {
      setStockItems(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoadingStock(false);
    }, (err) => {
      console.error("Error fetching inventory stock:", err);
      setLoadingStock(false);
    });

    return () => unsub();
  }, [profile?.cabinetId]);

  useEffect(() => {
    if (!profile?.cabinetId) return;
    const unsub = onSnapshot(doc(db, 'cabinets', profile.cabinetId), (snap) => {
      if (snap.exists()) {
        setWaConfig(snap.data().whatsapp_config);
      }
    });
    return () => unsub();
  }, [profile?.cabinetId]);

  const maskCPF = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d)/, "$1.$2")
      .replace(/(\d{3})(\d{1,2})/, "$1-$2")
      .replace(/(-\d{2})\d+?$/, "$1");
  };

  const maskPhone = (value: string) => {
    return value
      .replace(/\D/g, "")
      .replace(/(\d{2})(\d)/, "($1) $2")
      .replace(/(\d{5})(\d)/, "$1-$2")
      .replace(/(-\d{4})\d+?$/, "$1");
  };

  const searchCitizenData = async (cpf: string) => {
    const maskedCPF = maskCPF(cpf);
    const cleanCPF = cpf.replace(/\D/g, "");
    if (cleanCPF.length < 11 || !profile?.cabinetId) {
      setCpfError(null);
      setCpfValidated(false);
      return;
    }

    setSearchingCitizen(true);
    setCpfError(null);
    try {
      const qGen = query(
        collection(db, "atendimentos"),
        where("cabinetId", "==", profile?.cabinetId),
        where("cpf", "==", maskedCPF),
        orderBy("created_at", "desc"),
      );

      const genSnap = await getDocs(qGen);

      if (!genSnap.empty) {
        const foundData = genSnap.docs[0].data();
        setCpfValidated(true);
        setCpfError(null);

        // Auto-fill form data if creating new
        if (!editingId) {
          setFormData((prev) => ({
            ...prev,
            beneficiado_nome: prev.beneficiado_nome || foundData.nome_completo || "",
            beneficiado_telefone: prev.beneficiado_telefone || foundData.telefone || "",
          }));
        }
      } else {
        setCpfValidated(false);
        setCpfError("Este CPF não está cadastrado no módulo de Atendimentos. O cidadão deve ser cadastrado lá primeiro!");
      }
    } catch (error) {
      console.error("Error searching citizen data in social assistance:", error);
    } finally {
      setSearchingCitizen(false);
    }
  };

  const handlePrintReceipt = (item: any) => {
    const win = window.open("", "_blank");
    if (!win) return;

    // Get a nicely structured date string
    let deliveryDate = "---";
    if (item.data_entrega_realizada) {
      if (item.data_entrega_realizada.toDate) {
        deliveryDate = format(item.data_entrega_realizada.toDate(), 'dd/MM/yyyy HH:mm:ss');
      } else if (item.data_entrega_realizada instanceof Date) {
        deliveryDate = format(item.data_entrega_realizada, 'dd/MM/yyyy HH:mm:ss');
      } else {
        try {
          deliveryDate = format(new Date(item.data_entrega_realizada), 'dd/MM/yyyy HH:mm:ss');
        } catch (e) {
          deliveryDate = format(new Date(), 'dd/MM/yyyy HH:mm:ss');
        }
      }
    } else if (item.data_entrega_prevista) {
      try {
        deliveryDate = format(new Date(item.data_entrega_prevista + 'T12:00:00'), 'dd/MM/yyyy');
      } catch (e) {}
    } else {
      deliveryDate = format(new Date(), 'dd/MM/yyyy');
    }

    const html = `
      <html>
        <head>
          <title>Recibo de Entrega - Assistência Social</title>
          <style>
            @page { size: A4; margin: 0; }
            body { font-family: 'Inter', system-ui, -apple-system, sans-serif; padding: 50px; color: #1e293b; background: white; }
            .container { max-width: 800px; margin: 0 auto; border: 1px solid #e2e8f0; padding: 40px; border-radius: 8px; }
            .header { text-align: center; border-bottom: 2px solid #334155; padding-bottom: 20px; margin-bottom: 40px; }
            .header h1 { margin: 0; font-size: 20px; color: #0f172a; text-transform: uppercase; letter-spacing: 2px; }
            .header p { margin: 5px 0 0; color: #64748b; font-size: 12px; font-weight: 600; }
            .receipt-id { text-align: right; font-size: 10px; color: #94a3b8; margin-bottom: 20px; font-family: monospace; }
            .section { margin-bottom: 30px; }
            .section-title { font-size: 10px; font-weight: 800; color: #64748b; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid #f1f5f9; padding-bottom: 5px; margin-bottom: 15px; }
            .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 20px; }
            .field { margin-bottom: 10px; }
            .label { font-size: 9px; font-weight: 700; color: #94a3b8; text-transform: uppercase; margin-bottom: 2px; display: block; }
            .value { font-size: 14px; font-weight: 500; color: #1e293b; padding-bottom: 4px; border-bottom: 1px dashed #e2e8f0; min-height: 20px; display: block; }
            .declaration { margin-top: 40px; font-size: 13px; line-height: 1.6; color: #475569; text-align: justify; }
            .signature-area { margin-top: 80px; display: grid; grid-template-columns: 1fr 1fr; gap: 50px; }
            .signature-box { text-align: center; }
            .line { border-top: 1px solid #334155; margin-bottom: 8px; }
            .footer { margin-top: 60px; padding-top: 20px; border-top: 1px solid #f1f5f9; font-size: 9px; text-align: center; color: #94a3b8; }
            .btn-print { margin-top: 40px; text-align: center; }
            .btn-print button { background: #0f172a; color: white; border: none; padding: 12px 32px; border-radius: 6px; font-weight: 700; cursor: pointer; transition: all 0.2s; }
            .btn-print button:hover { background: #334155; }
            @media print { .no-print { display: none; } body { padding: 30px; } .container { border: none; } }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="receipt-id">REF: ${item.id ? item.id.substring(0, 8).toUpperCase() : 'NOVO_REGISTRO'}</div>
            <div class="header">
              <h1>Recibo de Entrega de Auxílio Social</h1>
              <p>Gabinete Parlamentar - Departamento de Assistência Social e Cidadania</p>
            </div>

            <div class="section">
              <div class="section-title">Dados do Beneficiário</div>
              <div class="field">
                <span class="label">Nome do Beneficiário</span>
                <span class="value">${item.beneficiado_nome}</span>
              </div>
              <div class="grid">
                <div class="field">
                  <span class="label">CPF</span>
                  <span class="value">${item.beneficiado_cpf || "---"}</span>
                </div>
                <div class="field">
                  <span class="label">Telefone</span>
                  <span class="value">${item.beneficiado_telefone || "---"}</span>
                </div>
              </div>
            </div>

            <div class="section">
              <div class="section-title">Dados do Benefício Recebido</div>
              <div class="grid">
                <div class="field">
                  <span class="label">Tipo de Benefício</span>
                  <span class="value">${item.tipo_beneficio}</span>
                </div>
                <div class="field">
                  <span class="label">Quantidade</span>
                  <span class="value">${item.quantidade} unidade(s)</span>
                </div>
                <div class="field">
                  <span class="label">Data de Entrega</span>
                  <span class="value">${deliveryDate}</span>
                </div>
                <div class="field">
                  <span class="label">Entregue por</span>
                  <span class="value">${item.entregue_por_nome || profile?.nome || "Representante do Gabinete"}</span>
                </div>
              </div>
              ${item.observacoes ? `
                <div class="field" style="margin-top: 15px;">
                  <span class="label">Observações</span>
                  <span class="value" style="border: none; background: #f8fafc; padding: 10px; border-radius: 6px; font-size: 12px; line-height: 1.4;">${item.observacoes}</span>
                </div>
              ` : ''}
            </div>

            <div class="declaration">
              Declaro para os devidos fins de prestação de contas que recebi nesta data o benefício social acima especificado, concedido através das ações integradas de assistência social do Gabinete Parlamentar, em perfeitas condições de uso e destinação, nada tendo a reclamar quanto ao atendimento e entrega efetuados.
            </div>

            <div class="signature-area">
              <div class="signature-box">
                <div class="line"></div>
                <span class="label">Responsável pela Entrega</span>
                <span style="font-size: 11px; font-weight: bold;">${item.entregue_por_nome || profile?.nome || "Representante do Gabinete"}</span>
              </div>
              <div class="signature-box">
                <div class="line"></div>
                <span class="label">Assinatura do Beneficiário</span>
                <span style="font-size: 11px; font-weight: bold;">${item.beneficiado_nome}</span>
              </div>
            </div>

            <div class="footer">
              Este recibo de entrega serve como comprovante para prestação de contas oficial e foi gerado em ${format(new Date(), "dd/MM/yyyy HH:mm:ss")} por ${profile?.nome || "Sistema"}.
            </div>
            
            <div class="btn-print no-print">
              <button onclick="window.print()">IMPRIMIR RECIBO</button>
            </div>
          </div>
        </body>
      </html>
    `;

    win.document.write(html);
    win.document.close();
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingId(null);
    setFormData(initialForm);
    setCpfError(null);
    setCpfValidated(false);
  };

  const adjustStockItemQty = async (stockItemId: string | undefined, change: number) => {
    if (!stockItemId) return;
    try {
      const stockRef = doc(db, 'auxilio_estoque', stockItemId);
      await updateDoc(stockRef, {
        quantidade_atual: increment(change),
        updated_at: serverTimestamp()
      });
    } catch (e) {
      console.error("Error adjusting stock item quantity:", e);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.cabinetId) return;

    if (!cpfValidated) {
      alert("É obrigatório registrar os dados do cidadão no módulo de Atendimentos primeiro! Digite um CPF válido e cadastrado.");
      return;
    }

    try {
      const payload = {
        ...formData,
        beneficiado_nome: formatProperName(formData.beneficiado_nome),
        cabinetId: profile.cabinetId,
        usuario_id: profile.id,
        usuario_nome: profile.nome,
        updated_at: serverTimestamp()
      };

      if (editingId) {
        const existingDoc = data.find(i => i.id === editingId);
        await updateDoc(doc(db, 'auxilio_social', editingId), payload);

        // Adjust stock based on changes!
        const oldStatus = existingDoc?.status || 'Pendente';
        const newStatus = formData.status;
        const oldQty = existingDoc?.quantidade || 0;
        const newQty = formData.quantidade;
        const oldStockId = existingDoc?.item_estoque_id || '';
        const newStockId = formData.item_estoque_id || '';

        if (oldStatus === 'Entregue' && newStatus === 'Entregue') {
          if (oldStockId === newStockId) {
            if (oldQty !== newQty) {
              await adjustStockItemQty(newStockId, oldQty - newQty);
            }
          } else {
            if (oldStockId) await adjustStockItemQty(oldStockId, oldQty);
            if (newStockId) await adjustStockItemQty(newStockId, -newQty);
          }
        } else if (oldStatus !== 'Entregue' && newStatus === 'Entregue') {
          if (newStockId) await adjustStockItemQty(newStockId, -newQty);
        } else if (oldStatus === 'Entregue' && newStatus !== 'Entregue') {
          if (oldStockId) await adjustStockItemQty(oldStockId, oldQty);
        }

        await logAction('Atualizar Auxílio', 'auxilio_social', editingId, { 
          previous: existingDoc, 
          next: formData,
          cabinetId: profile.cabinetId 
        });
        showSuccessNotification("Auxílio Social Atualizado!", `O auxílio de ${payload.beneficiado_nome} foi atualizado com sucesso.`, "auxilio");

        // Automatic status update trigger
        if (existingDoc && existingDoc.status !== payload.status) {
          const statusTemplate = waConfig?.templates?.find(t => t.trigger === 'status_update');
          if (statusTemplate?.enabledAuto && payload.beneficiado_telefone) {
            const tempItem = {
              beneficiado_nome: payload.beneficiado_nome,
              beneficiado_telefone: payload.beneficiado_telefone,
              tipo_beneficio: payload.tipo_beneficio || 'Auxílio Social',
              status: payload.status
            };
            setTimeout(() => {
              sendWAMessage(tempItem);
            }, 600);
          }
        }
      } else {
        const docRef = await addDoc(collection(db, 'auxilio_social'), {
          ...payload,
          created_at: serverTimestamp()
        });

        // If newly created as 'Entregue', adjust stock directly
        if (formData.status === 'Entregue' && formData.item_estoque_id) {
          await adjustStockItemQty(formData.item_estoque_id, -formData.quantidade);
        }

        await logAction('Criar Auxílio', 'auxilio_social', docRef.id, { 
          next: formData,
          cabinetId: profile.cabinetId 
        });
        showSuccessNotification("Auxílio Social Registrado!", `O auxílio de ${payload.beneficiado_nome} foi cadastrado com sucesso.`, "auxilio");

        // Automatic welcome trigger
        const welcomeTemplate = waConfig?.templates?.find(t => t.trigger === 'welcome');
        if (welcomeTemplate?.enabledAuto && payload.beneficiado_telefone) {
          const tempItem = {
            beneficiado_nome: payload.beneficiado_nome,
            beneficiado_telefone: payload.beneficiado_telefone,
            tipo_beneficio: payload.tipo_beneficio || 'Auxílio Social',
            status: payload.status || 'Pendente'
          };
          setTimeout(() => {
            sendWAMessage(tempItem);
          }, 600);
        }
      }
      const isEntregue = formData.status === 'Entregue';
      const createdId = editingId;
      handleCloseModal();

      if (isEntregue) {
        setTimeout(() => {
          if (confirm("Deseja gerar o recibo de entrega em PDF para prestação de contas?")) {
            handlePrintReceipt({
              id: createdId || 'NOVO_REGISTRO',
              ...formData,
              entregue_por_nome: profile?.nome || '',
              data_entrega_realizada: new Date()
            });
          }
        }, 300);
      }
    } catch (err: any) {
      toast.error("Erro ao salvar auxílio social.");
      handleFirestoreError(err, OperationType.WRITE, 'auxilio_social');
    }
  };

  const handleStatusChange = async (id: string, newStatus: string) => {
    try {
      const existing = data.find(i => i.id === id);
      const updates: any = { 
        status: newStatus, 
        updated_at: serverTimestamp() 
      };
      
      if (newStatus === 'Entregue') {
        updates.data_entrega_realizada = serverTimestamp();
        updates.entregue_por_nome = profile?.nome || '';
      }

      await updateDoc(doc(db, 'auxilio_social', id), updates);

      // Now run stock adjustment!
      if (newStatus === 'Entregue' && existing?.status !== 'Entregue' && existing?.item_estoque_id) {
         await adjustStockItemQty(existing.item_estoque_id, -existing.quantidade);
      } else if (newStatus !== 'Entregue' && existing?.status === 'Entregue' && existing?.item_estoque_id) {
         await adjustStockItemQty(existing.item_estoque_id, existing.quantidade);
      }

      await logAction('Status Auxílio', 'auxilio_social', id, { 
        previous: { status: existing?.status }, 
        next: updates,
        cabinetId: profile?.cabinetId 
      });

      toast.success(`Status de auxílio social atualizado para "${newStatus}"!`);

      // Automatic status update trigger
      const statusTemplate = waConfig?.templates?.find(t => t.trigger === 'status_update');
      if (statusTemplate?.enabledAuto && existing?.beneficiado_telefone) {
        const tempItem = {
          beneficiado_nome: existing.beneficiado_nome,
          beneficiado_telefone: existing.beneficiado_telefone,
          tipo_beneficio: existing.tipo_beneficio || 'Auxílio Social',
          status: newStatus
        };
        setTimeout(() => {
          sendWAMessage(tempItem);
        }, 600);
      }

      if (newStatus === 'Entregue' && existing) {
        setTimeout(() => {
          if (confirm("Deseja gerar o recibo de entrega em PDF para prestação de contas?")) {
            handlePrintReceipt({
              ...existing,
              status: 'Entregue',
              entregue_por_nome: profile?.nome || '',
              data_entrega_realizada: new Date()
            });
          }
        }, 300);
      }
    } catch (err) {
      toast.error("Erro ao atualizar status do auxílio.");
      handleFirestoreError(err, OperationType.UPDATE, `auxilio_social/${id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este registro permanentemente?")) return;
    try {
      const existing = data.find(i => i.id === id);
      await deleteDoc(doc(db, 'auxilio_social', id));

      // If deleted and was delivered, restore stock
      if (existing?.status === 'Entregue' && existing?.item_estoque_id) {
         await adjustStockItemQty(existing.item_estoque_id, existing.quantidade);
      }

      await logAction('Excluir Auxílio', 'auxilio_social', id, { 
        previous: existing,
        cabinetId: profile?.cabinetId 
      });
      toast.success("Auxílio social excluído com sucesso!");
    } catch (err) {
      toast.error("Erro ao excluir auxílio social.");
      handleFirestoreError(err, OperationType.DELETE, `auxilio_social/${id}`);
    }
  };

  const handleStockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile?.cabinetId) return;

    try {
      const payload = {
        ...stockFormData,
        quantidade_atual: Number(stockFormData.quantidade_atual),
        quantidade_minima: Number(stockFormData.quantidade_minima),
        cabinetId: profile.cabinetId,
        updated_at: serverTimestamp()
      };

      if (editingStockId) {
        await updateDoc(doc(db, 'auxilio_estoque', editingStockId), payload);
        await logAction('Atualizar Estoque', 'auxilio_estoque', editingStockId, {
          next: stockFormData,
          cabinetId: profile.cabinetId
        });
      } else {
        const docRef = await addDoc(collection(db, 'auxilio_estoque'), {
          ...payload,
          created_at: serverTimestamp()
        });
        await logAction('Adicionar Estoque', 'auxilio_estoque', docRef.id, {
          next: stockFormData,
          cabinetId: profile.cabinetId
        });
      }
      setShowStockModal(false);
      setEditingStockId(null);
      setStockFormData(initialStockForm);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'auxilio_estoque');
    }
  };

  const handleStockDelete = async (id: string) => {
    if (!confirm("Deseja excluir este item do estoque permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'auxilio_estoque', id));
      await logAction('Excluir Estoque', 'auxilio_estoque', id, {
        cabinetId: profile?.cabinetId
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `auxilio_estoque/${id}`);
    }
  };

  const populateDefaultStock = async () => {
    if (!profile?.cabinetId) return;
    setLoadingStock(true);
    const defaults = [
      { nome: 'Cesta Básica Completa', tipo_beneficio: 'Cesta Básica', quantidade_atual: 100, quantidade_minima: 10, observacoes: 'Contém arroz, feijão, óleo, açúcar, macarrão, café, farinha e sal.' },
      { nome: 'Cesta Básica Simples', tipo_beneficio: 'Cesta Básica', quantidade_atual: 50, quantidade_minima: 5, observacoes: 'Contém itens alimentícios essenciais compactos.' },
      { nome: 'Dipirona Sódica 500mg (Comprimido)', tipo_beneficio: 'Remédio', quantidade_atual: 500, quantidade_minima: 50, observacoes: 'Analgésico e antitérmico para atendimento social.' },
      { nome: 'Paracetamol 500mg', tipo_beneficio: 'Remédio', quantidade_atual: 300, quantidade_minima: 30, observacoes: 'Medicamento contra dores e febre sob demanda.' },
      { nome: 'Fralda Geriátrica G', tipo_beneficio: 'Fralda', quantidade_atual: 80, quantidade_minima: 10, observacoes: 'Fraldas para idosos ou enfermos assistidos.' },
      { nome: 'Fralda Infantil M', tipo_beneficio: 'Fralda', quantidade_atual: 150, quantidade_minima: 20, observacoes: 'Fralda descartável infantil em tamanho médio.' },
      { nome: 'Kit Higiene Pessoal', tipo_beneficio: 'Kit Higiene', quantidade_atual: 60, quantidade_minima: 10, observacoes: 'Contém sabonetes, escova de dente, creme dental e xampu.' },
      { nome: 'Kit Material Escolar', tipo_beneficio: 'Material Escolar', quantidade_atual: 40, quantidade_minima: 5, observacoes: 'Contém cadernos, lápis, borrachas, canetas e estojo.' }
    ];

    try {
      for (const item of defaults) {
        await addDoc(collection(db, 'auxilio_estoque'), {
          ...item,
          cabinetId: profile.cabinetId,
          created_at: serverTimestamp(),
          updated_at: serverTimestamp()
        });
      }
      await logAction('Gerar Estoque Inicial', 'auxilio_estoque', 'default_generation', {
        cabinetId: profile.cabinetId,
        next: { mensagem: 'Geração automática de estoque inicial com itens padrão.' }
      });
    } catch (err) {
      console.error("Error populating default stock:", err);
      handleFirestoreError(err, OperationType.WRITE, 'auxilio_estoque');
    } finally {
      setLoadingStock(false);
    }
  };

  const sendWAMessage = async (item: any) => {
    if (!item.beneficiado_telefone) return;
    const trigger = item.status === 'Entregue' ? 'status_update' : 'welcome';
    const template = waConfig?.templates?.find(t => t.trigger === trigger);
    
    const defaultContent = trigger === 'welcome' 
      ? 'Olá {{nome}}, seu pedido de {{titulo}} foi registrado e está {{status}}.'
      : 'Olá {{nome}}, informamos que seu benefício ({{titulo}}) foi registrado como: {{status}}.';

    const content = template?.content || defaultContent;
    
    const message = formatWhatsAppMessage(content, {
      nome: item.beneficiado_nome,
      status: item.status,
      id: item.id.slice(-6),
      titulo: item.tipo_beneficio
    });

    const toastId = toast.loading('Enviando mensagem de WhatsApp...');
    try {
      const res = await sendWhatsAppNotification(waConfig, item.beneficiado_telefone, message);
      if (res.type === 'api') {
        toast.success('Mensagem enviada com sucesso via API!', { id: toastId });
      } else {
        if (res.error) {
          toast.warning(`API indisponível: ${res.error}. Abrindo WhatsApp manual...`, { id: toastId, duration: 4000 });
        } else {
          toast.success('Pronto! Abrindo link do WhatsApp...', { id: toastId });
        }
      }
    } catch (e: any) {
      toast.error('Erro ao processar envio de WhatsApp.', { id: toastId });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Pendente': return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
      case 'Em Rota': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'Entregue': return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
      case 'Cancelado': return 'bg-red-500/10 text-red-500 border-red-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const getBenefitIcon = (type: string) => {
    switch (type) {
      case 'Cesta Básica': return <ShoppingBag size={18} className="text-amber-500" />;
      case 'Remédio': return <Stethoscope size={18} className="text-emerald-500" />;
      case 'Fralda': return <Baby size={18} className="text-blue-500" />;
      default: return <Package size={18} className="text-slate-500" />;
    }
  };

  const filteredData = data.filter(item => {
    const matchesSearch = item.beneficiado_nome.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         item.beneficiado_cpf?.includes(searchQuery);
    const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
    const matchesType = typeFilter === 'all' || item.tipo_beneficio === typeFilter;
    return matchesSearch && matchesStatus && matchesType;
  });

  return (
    <div className="space-y-6 lg:p-4">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3">
            <Package className="text-amber-500" size={32} />
            Auxílio Social
          </h1>
          <p className="text-slate-400 mt-1">Gestão de cestas básicas, remédios, fraldas e estoque de auxílios.</p>
        </div>

        <button 
          onClick={() => {
            if (activeTab === 'auxilios') {
              setEditingId(null);
              setFormData(initialForm);
              setCpfValidated(false);
              setCpfError(null);
              setShowModal(true);
            } else {
              setEditingStockId(null);
              setStockFormData(initialStockForm);
              setShowStockModal(true);
            }
          }}
          className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-6 rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-900/20 transition-all active:scale-95"
        >
          <Plus size={20} />
          {activeTab === 'auxilios' ? 'Novo Auxílio' : 'Novo Item no Estoque'}
        </button>
      </header>

      {/* Sub-tabs */}
      <div className="flex border-b border-slate-800">
        <button
          onClick={() => setActiveTab('auxilios')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-all",
            activeTab === 'auxilios' 
              ? "border-blue-500 text-white" 
              : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          Pedidos & Beneficiários
        </button>
        <button
          onClick={() => setActiveTab('estoque')}
          className={cn(
            "px-6 py-3 text-sm font-bold border-b-2 transition-all flex items-center gap-2",
            activeTab === 'estoque' 
              ? "border-blue-500 text-white" 
              : "border-transparent text-slate-500 hover:text-slate-300"
          )}
        >
          <Package size={16} />
          Controle de Estoque
        </button>
      </div>

      {activeTab === 'auxilios' ? (
        <>
          {/* Filters for Auxilios */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text"
                placeholder="Buscar por nome ou CPF do beneficiado..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <select 
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium! bg-none"
              >
                <option value="all">Todos os Status</option>
                <option value="Pendente">Pendente</option>
                <option value="Em Rota">Em Rota</option>
                <option value="Entregue">Entregue</option>
                <option value="Cancelado">Cancelado</option>
              </select>
            </div>
            <div className="relative">
              <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium! bg-none"
              >
                <option value="all">Todos os Tipos</option>
                <option value="Cesta Básica">Cesta Básica</option>
                <option value="Remédio">Remédio</option>
                <option value="Fralda">Fralda</option>
                <option value="Kit Higiene">Kit Higiene</option>
                <option value="Material Escolar">Material Escolar</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          {/* Grid of Benefits */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {loading ? (
                Array(6).fill(0).map((_, i) => (
                  <div key={i} className="h-64 bg-slate-900 rounded-3xl border border-slate-800 animate-pulse" />
                ))
              ) : filteredData.length === 0 ? (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                    <Package size={40} />
                  </div>
                  <p className="text-slate-500 font-medium">Nenhum auxílio encontrado para os filtros selecionados.</p>
                </div>
              ) : filteredData.map((item) => (
                <motion.div
                  layout
                  key={item.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-blue-500/30 transition-all group relative"
                >
                  <div className="flex items-start justify-between mb-4 font-sans">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 shrink-0">
                        {getBenefitIcon(item.tipo_beneficio)}
                      </div>
                      <div>
                        <h3 className="font-bold text-white text-lg truncate max-w-[150px]">{item.beneficiado_nome}</h3>
                        <div className="flex items-center gap-1.5 text-[10px] uppercase font-black tracking-widest text-slate-500">
                          {item.tipo_beneficio} • {item.quantidade}x
                        </div>
                      </div>
                    </div>
                    <div className={cn(
                      "px-3 py-1 rounded-full text-[10px] font-black uppercase border",
                      getStatusColor(item.status)
                    )}>
                      {item.status}
                    </div>
                  </div>

                  <div className="space-y-3 py-4 border-y border-slate-800/50 mb-4">
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <Smartphone size={14} className="text-slate-600" />
                      <span>{item.beneficiado_telefone || 'Sem contato'}</span>
                      {item.beneficiado_telefone && (
                        <button 
                          onClick={() => sendWAMessage(item)}
                          className="ml-auto text-emerald-500 hover:text-emerald-400 transition-colors"
                          title="Notificar via WhatsApp"
                        >
                          <Smartphone size={14} />
                        </button>
                      )}
                    </div>
                    {item.beneficiado_cpf && (
                      <div className="flex items-center gap-3 text-sm text-slate-400 font-mono">
                        <Info size={14} className="text-slate-600" />
                        <span>CPF: {item.beneficiado_cpf}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-3 text-sm text-slate-400">
                      <Calendar size={14} className="text-slate-600" />
                      <span>Previsto: {item.data_entrega_prevista ? format(new Date(item.data_entrega_prevista + 'T00:00:00'), 'dd/MM/yyyy') : 'Não definida'}</span>
                    </div>
                    {item.item_estoque_id && (
                      <div className="flex items-center gap-3 text-xs text-blue-400 bg-blue-500/5 py-1 px-2.5 rounded-lg border border-blue-500/10 w-fit">
                        <Package size={12} />
                        <span>Estoque vinculado</span>
                      </div>
                    )}
                    {item.entregue_por_nome && (
                      <div className="flex items-center gap-3 text-sm text-emerald-500/80 font-medium">
                        <CheckCircle2 size={14} />
                        <span>Entregue por: {item.entregue_por_nome}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => {
                          setEditingId(item.id);
                          setFormData(item);
                          setCpfValidated(false);
                          setCpfError(null);
                          if (item.beneficiado_cpf) {
                            searchCitizenData(item.beneficiado_cpf);
                          }
                          setShowModal(true);
                        }}
                        className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all hover:bg-slate-700"
                        title="Editar"
                      >
                        <Edit size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(item.id)}
                        className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 transition-all hover:bg-red-500/10"
                        title="Excluir"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>

                    <div className="flex items-center gap-1 dropdown-container">
                      {item.status === 'Entregue' && (
                        <button 
                          onClick={() => handlePrintReceipt(item)}
                          className="flex items-center gap-1.5 px-3.5 py-2 bg-slate-800 hover:bg-slate-700 text-emerald-400 hover:text-emerald-300 text-xs font-bold rounded-xl transition-all border border-emerald-500/10 shadow-sm"
                          title="Imprimir Recibo"
                        >
                          <Printer size={14} />
                          <span>Recibo</span>
                        </button>
                      )}
                      {item.status !== 'Entregue' && (
                        <button 
                          onClick={() => handleStatusChange(item.id, 'Entregue')}
                          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-xl transition-all"
                        >
                          Confirmar Entrega
                        </button>
                      )}
                      {item.status === 'Pendente' && (
                        <button 
                          onClick={() => handleStatusChange(item.id, 'Em Rota')}
                          className="p-2 bg-blue-600/10 text-blue-500 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                          title="Marcar em Rota"
                        >
                          <Truck size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </>
      ) : (
        <>
          {/* Stock Section */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative md:col-span-2">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input 
                type="text"
                placeholder="Buscar item no estoque..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white placeholder-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all"
              />
            </div>
            <div className="relative col-span-2">
              <ShoppingBag className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <select 
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white appearance-none cursor-pointer focus:outline-none focus:ring-2 focus:ring-blue-600/50 transition-all font-medium bg-none"
              >
                <option value="all">Todas as Categorias de Estoque</option>
                <option value="Cesta Básica">Cesta Básica</option>
                <option value="Remédio">Remédio</option>
                <option value="Fralda">Fralda</option>
                <option value="Kit Higiene">Kit Higiene</option>
                <option value="Material Escolar">Material Escolar</option>
                <option value="Outro">Outro</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <AnimatePresence>
              {loadingStock ? (
                Array(3).fill(0).map((_, i) => (
                  <div key={i} className="h-48 bg-slate-900 rounded-3xl border border-slate-800 animate-pulse" />
                ))
              ) : stockItems.length === 0 ? (
                <div className="col-span-full py-16 text-center space-y-6 max-w-md mx-auto bg-slate-950 p-8 rounded-[32px] border border-slate-900">
                  <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/20">
                    <Package size={32} />
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-bold text-white text-lg">Estoque Vazio</h3>
                    <p className="text-slate-400 text-sm leading-relaxed">
                      Não há nenhum item registrado para controle em seu gabinete ainda. Gostaria de cadastrar uma lista inicial dos itens mais comuns (Cestas Básicas, Higiene, Remédios, Fraldas) automaticamente?
                    </p>
                  </div>
                  <button
                    onClick={populateDefaultStock}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3.5 px-6 rounded-2xl transition-all shadow-md shadow-blue-900/10 active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Plus size={18} />
                    Cadastrar Itens Padrão no Estoque
                  </button>
                </div>
              ) : stockItems.filter(item => {
                const matchesSearch = item.nome.toLowerCase().includes(searchQuery.toLowerCase());
                const matchesType = typeFilter === 'all' || item.tipo_beneficio === typeFilter;
                return matchesSearch && matchesType;
              }).length === 0 ? (
                <div className="col-span-full py-20 text-center space-y-4">
                  <div className="w-20 h-20 bg-slate-900 rounded-full flex items-center justify-center mx-auto text-slate-700">
                    <Package size={40} />
                  </div>
                  <p className="text-slate-500 font-medium">Nenhum item em estoque corresponde aos filtros selecionados.</p>
                </div>
              ) : stockItems
                  .filter(item => {
                    const matchesSearch = item.nome.toLowerCase().includes(searchQuery.toLowerCase());
                    const matchesType = typeFilter === 'all' || item.tipo_beneficio === typeFilter;
                    return matchesSearch && matchesType;
                  })
                  .map((item) => {
                    const isLowStock = item.quantidade_atual <= (item.quantidade_minima || 5);
                    return (
                      <motion.div
                        layout
                        key={item.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-xl hover:border-amber-500/30 transition-all relative"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 shrink-0">
                              {getBenefitIcon(item.tipo_beneficio)}
                            </div>
                            <div>
                              <h3 className="font-bold text-white text-lg truncate max-w-[200px]">{item.nome}</h3>
                              <p className="text-[10px] uppercase font-black tracking-widest text-slate-500">{item.tipo_beneficio}</p>
                            </div>
                          </div>
                          <div className={cn(
                            "px-2.5 py-1 rounded-full text-[10px] font-black uppercase text-center border",
                            isLowStock 
                              ? "bg-red-500/10 text-red-400 border-red-500/20 animate-pulse" 
                              : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20"
                          )}>
                            {isLowStock ? "⚠️ Estoque Baixo" : "✓ Em estoque"}
                          </div>
                        </div>

                        <div className="py-2.5 border-y border-slate-800/50 mb-4 flex items-center justify-between">
                          <div>
                            <p className="text-[10px] uppercase font-bold text-slate-500">Saldo Atual</p>
                            <p className="text-3xl font-black font-mono text-white mt-0.5">{item.quantidade_atual} <span className="text-[10px] text-slate-500 uppercase font-bold font-sans">un.</span></p>
                          </div>
                          <div className="text-right">
                            <p className="text-[10px] uppercase font-bold text-slate-500">Mínimo Alerta</p>
                            <p className="text-sm font-bold font-mono text-slate-400 mt-1">{item.quantidade_minima || 5} un.</p>
                          </div>
                        </div>

                        {item.observacoes && (
                          <p className="text-xs text-slate-400 mb-4 italic line-clamp-1">"{item.observacoes}"</p>
                        )}

                        <div className="flex items-center justify-between pt-1">
                          <div className="flex items-center gap-2">
                            <button 
                              onClick={() => {
                                setEditingStockId(item.id);
                                setStockFormData(item);
                                setShowStockModal(true);
                              }}
                              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-all hover:bg-slate-700"
                              title="Editar"
                            >
                              <Edit size={16} />
                            </button>
                            <button 
                              onClick={() => handleStockDelete(item.id)}
                              className="p-2.5 rounded-xl bg-slate-800 text-slate-400 hover:text-red-400 transition-all hover:bg-red-500/10"
                              title="Excluir"
                            >
                              <Trash2 size={16} />
                            </button>
                          </div>

                          {/* Fast Quantity Adjustment Controls */}
                          <div className="flex items-center gap-1 bg-slate-950 px-2.5 py-1.5 rounded-xl border border-slate-800">
                            <button 
                              onClick={() => adjustStockItemQty(item.id, -1)} 
                              className="p-0.5 px-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 font-bold text-xs"
                              title="Remover 1"
                            >
                              -
                            </button>
                            <span className="text-[10px] font-bold text-slate-500 px-1 font-sans">Ajustar</span>
                            <button 
                              onClick={() => adjustStockItemQty(item.id, 1)} 
                              className="p-0.5 px-2 rounded-lg bg-slate-900 text-slate-400 hover:text-white hover:bg-slate-800 font-bold text-xs"
                              title="Adicionar 1"
                            >
                              +
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    );
                  })}
            </AnimatePresence>
          </div>
        </>
      )}

      {/* Benefits Modal */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-2xl overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600/10 rounded-2xl flex items-center justify-center text-blue-500 border border-blue-500/20">
                    <ShoppingBag size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white font-sans tracking-tight">
                      {editingId ? 'Editar Auxílio' : 'Novo Pedido de Auxílio'}
                    </h2>
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mt-0.5">Gestão de Benefícios Sociais</p>
                  </div>
                </div>
                <button 
                  onClick={handleCloseModal}
                  className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome do Beneficiado</label>
                    <div className="relative">
                      <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        required
                        value={formData.beneficiado_nome}
                        onChange={e => setFormData({...formData, beneficiado_nome: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                        placeholder="Nome completo"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">WhatsApp / Telefone</label>
                    <div className="relative">
                      <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        value={formData.beneficiado_telefone}
                        onChange={e => setFormData({...formData, beneficiado_telefone: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 pl-12 pr-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                        placeholder="(00) 00000-0000"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">CPF do Beneficiado</label>
                    <div className="relative">
                      <Info className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-600" size={18} />
                      <input 
                        value={formData.beneficiado_cpf || ''}
                        onChange={e => {
                          const val = maskCPF(e.target.value);
                          setFormData({...formData, beneficiado_cpf: val});
                          if (val.replace(/\D/g, "").length === 11) {
                            searchCitizenData(val);
                          } else {
                            setCpfValidated(false);
                            setCpfError(null);
                          }
                        }}
                        className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-12 pr-12 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                        placeholder="000.000.000-00"
                      />
                      {searchingCitizen && (
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-amber-500 border-t-transparent rounded-full animate-spin" />
                        </div>
                      )}
                    </div>
                    {cpfError && (
                      <p className="text-[11px] font-semibold text-rose-500 px-1 mt-1">
                        ⚠️ {cpfError}
                      </p>
                    )}
                    {cpfValidated && !cpfError && (formData.beneficiado_cpf || '').replace(/\D/g, "").length === 11 && (
                      <p className="text-[11px] font-semibold text-emerald-400 px-1 mt-1 flex items-center gap-1">
                        ✓ Cadastrado no módulo de Atendimentos
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Tipo de Benefício</label>
                    <select 
                      value={formData.tipo_beneficio}
                      onChange={e => setFormData({...formData, tipo_beneficio: e.target.value, item_estoque_id: ''})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-600/50 outline-none transition-all bg-none"
                    >
                      <option value="Cesta Básica">Cesta Básica</option>
                      <option value="Remédio">Remédio</option>
                      <option value="Fralda">Fralda</option>
                      <option value="Kit Higiene">Kit Higiene</option>
                      <option value="Material Escolar">Material Escolar</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  {/* Stock Match Selection Dropdown */}
                  <div className="space-y-2 col-span-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1 flex items-center justify-between">
                      <span>Vincular Item ao Estoque para Baixa</span>
                      <span className="text-[9px] text-blue-400 font-bold">Obrigatório para registrar baixa automática</span>
                    </label>
                    <select 
                      value={formData.item_estoque_id || ''}
                      onChange={e => setFormData({...formData, item_estoque_id: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-600/50 outline-none transition-all bg-none"
                    >
                      <option value="">-- Sem controle / Baixa de estoque manual --</option>
                      {stockItems
                        .filter(st => st.tipo_beneficio === formData.tipo_beneficio)
                        .map(st => (
                          <option key={st.id} value={st.id}>
                            {st.nome} (Saldo atual: {st.quantidade_atual} un.)
                          </option>
                        ))}
                    </select>
                    {stockItems.filter(st => st.tipo_beneficio === formData.tipo_beneficio).length === 0 && (
                      <p className="text-[10px] text-amber-500 font-semibold italic mt-1 px-1">
                        ⚠️ Nenhum item cadastrado no estoque para a categoria "{formData.tipo_beneficio}". Cadastre no menu "Controle de Estoque" para habilitar baixa automática.
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Quantidade</label>
                    <input 
                      type="number"
                      min="1"
                      value={formData.quantidade}
                      onChange={e => setFormData({...formData, quantidade: parseInt(e.target.value) || 1})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Data Prevista de Entrega</label>
                    <input 
                      type="date"
                      value={formData.data_entrega_prevista}
                      onChange={e => setFormData({...formData, data_entrega_prevista: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Status Inicial</label>
                    <select 
                      value={formData.status}
                      onChange={e => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-600/50 outline-none transition-all font-bold bg-none"
                    >
                      <option value="Pendente">Pendente</option>
                      <option value="Em Rota">Em Rota</option>
                      <option value="Entregue">Entregue</option>
                      <option value="Cancelado">Cancelado</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Observações / Detalhes</label>
                  <textarea 
                    value={formData.observacoes}
                    onChange={e => setFormData({...formData, observacoes: e.target.value})}
                    className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all resize-none h-24"
                    placeholder="Detalhe os remédios, tamanhos de fralda ou observações da entrega..."
                  />
                </div>

                <div className="pt-6 flex gap-4">
                  <button 
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 px-6 py-4 rounded-2xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] px-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingId ? 'Salvar Alterações' : 'Gravar Registro'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Stock Custom Modal */}
      <AnimatePresence>
        {showStockModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-slate-900 border border-slate-800 rounded-[32px] w-full max-w-lg overflow-hidden shadow-2xl"
            >
              <div className="p-8 border-b border-slate-800 flex items-center justify-between bg-slate-900/50">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-amber-500/10 rounded-2xl flex items-center justify-center text-amber-500 border border-amber-500/20">
                    <Package size={24} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white font-sans tracking-tight">
                      {editingStockId ? 'Editar Item no Estoque' : 'Novo Registro de Estoque'}
                    </h2>
                    <p className="text-slate-500 text-xs uppercase font-bold tracking-widest mt-0.5">Gestão de Inventário</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowStockModal(false)}
                  className="p-3 hover:bg-slate-800 rounded-2xl text-slate-500 hover:text-white transition-colors"
                >
                  <XCircle size={24} />
                </button>
              </div>

              <form onSubmit={handleStockSubmit} className="p-8 space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Nome do Item</label>
                    <input 
                      required
                      value={stockFormData.nome}
                      onChange={e => setStockFormData({...stockFormData, nome: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                      placeholder="Ex: Cesta Básica Tipo Premium, Fralda G huggies"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Categoria de Benefício</label>
                    <select 
                      value={stockFormData.tipo_beneficio}
                      onChange={e => setStockFormData({...stockFormData, tipo_beneficio: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white appearance-none cursor-pointer focus:ring-2 focus:ring-blue-600/50 outline-none transition-all bg-none"
                    >
                      <option value="Cesta Básica">Cesta Básica</option>
                      <option value="Remédio">Remédio</option>
                      <option value="Fralda">Fralda</option>
                      <option value="Kit Higiene">Kit Higiene</option>
                      <option value="Material Escolar">Material Escolar</option>
                      <option value="Outro">Outro</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Quantidade em Estoque</label>
                      <input 
                        required
                        type="number"
                        min="0"
                        value={stockFormData.quantidade_atual}
                        onChange={e => setStockFormData({...stockFormData, quantidade_atual: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Alerta de Limite Mínimo</label>
                      <input 
                        required
                        type="number"
                        min="0"
                        value={stockFormData.quantidade_minima}
                        onChange={e => setStockFormData({...stockFormData, quantidade_minima: parseInt(e.target.value) || 0})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl py-3 px-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase text-slate-500 tracking-widest px-1">Observações de Prateleira</label>
                    <textarea 
                      value={stockFormData.observacoes}
                      onChange={e => setStockFormData({...stockFormData, observacoes: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl p-4 text-white focus:ring-2 focus:ring-blue-600/50 outline-none transition-all resize-none h-20"
                      placeholder="Identificação ou lote do armário..."
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setShowStockModal(false)}
                    className="flex-1 px-6 py-4 rounded-2xl border border-slate-800 text-slate-400 font-bold hover:bg-slate-800 transition-all"
                  >
                    Descartar
                  </button>
                  <button 
                    type="submit"
                    className="flex-[2] px-6 py-4 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold shadow-xl shadow-blue-900/20 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <Save size={20} />
                    {editingStockId ? 'Salvar Alterações' : 'Cadastrar Estoque'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

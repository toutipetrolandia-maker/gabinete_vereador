import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  trigger: 'welcome' | 'status_update' | 'reminder' | 'manual' | 'birthday';
  enabledAuto?: boolean;
}

export interface WhatsAppConfig {
  instance_id?: string;
  token?: string;
  api_url?: string;
  api_type?: 'evolution' | 'zapi' | 'generic';
  enabled: boolean;
  templates: WhatsAppTemplate[];
}

export const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'welcome',
    name: 'Boas-vindas',
    trigger: 'welcome',
    content: 'Olá *{{nome}}*, o Gabinete Digital agradece seu contato! Registramos seu atendimento com sucesso. Em breve daremos um retorno.',
    enabledAuto: false
  },
  {
    id: 'status_update',
    name: 'Atualização de Demanda',
    trigger: 'status_update',
    content: 'Olá *{{nome}}*, informamos que sua demanda "*{{titulo}}*" foi atualizada para o status: *{{status}}*.',
    enabledAuto: false
  },
  {
    id: 'reminder',
    name: 'Lembrete de Agenda',
    trigger: 'reminder',
    content: 'Lembrete: Você tem um compromisso agendado com o Gabinete para o dia *{{data}}* às *{{hora}}*.',
    enabledAuto: false
  },
  {
    id: 'birthday',
    name: 'Parabéns / Aniversário',
    trigger: 'birthday',
    content: 'Olá *{{nome}}*! 🎉 Nós do Gabinete Gostaríamos de lhe desejar um feliz aniversário! Que seu novo ciclo seja repleto de realizações, saúde, sucesso e muita paz. Parabéns! 🎂🎈✨',
    enabledAuto: false
  }
];

export function formatWhatsAppMessage(template: string, variables: Record<string, string>): string {
  let message = template;
  for (const [key, value] of Object.entries(variables)) {
    message = message.replace(new RegExp(`{{${key}}}`, 'g'), value);
  }
  return message;
}

export function getWhatsAppLink(phone: string, message: string): string {
  const cleanPhone = phone.replace(/\D/g, '');
  const encodedMessage = encodeURIComponent(message);
  return `https://wa.me/${cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone}?text=${encodedMessage}`;
}

export function formatPhoneForAPI(phone: string): string {
  const clean = phone.replace(/\D/g, '');
  if (!clean) return '';
  if (clean.startsWith('55')) return clean;
  return '55' + clean;
}

export async function executeWhatsAppSend(config: WhatsAppConfig, phone: string, message: string): Promise<{ success: boolean; error?: string }> {
  if (!config.enabled) {
    return { success: false, error: 'Integração de WhatsApp desativada' };
  }
  
  const api_url = config.api_url?.trim();
  const token = config.token?.trim();
  const instance_id = config.instance_id?.trim();
  const api_type = config.api_type || 'evolution';

  if (!api_url) {
    return { success: false, error: 'URL da API não configurada' };
  }

  const cleanPhone = formatPhoneForAPI(phone);
  if (!cleanPhone) {
    return { success: false, error: 'Telefone inválido' };
  }

  try {
    let url = '';
    let headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    let body: any = {};

    if (api_type === 'evolution') {
      const baseUrl = api_url.replace(/\/$/, '');
      url = `${baseUrl}/message/sendText/${instance_id}`;
      headers['apikey'] = token || '';
      body = {
        number: cleanPhone,
        options: {
          delay: 1200,
          presence: 'composing'
        },
        textMessage: {
          text: message
        }
      };
    } else if (api_type === 'zapi') {
      const baseUrl = api_url.replace(/\/$/, '');
      url = `${baseUrl}/instances/${instance_id}/token/${token}/send-text`;
      headers['Client-Token'] = token || '';
      body = {
        phone: cleanPhone,
        message: message
      };
    } else {
      // Generic POST
      url = api_url;
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
        headers['x-api-key'] = token;
      }
      body = {
        phone: cleanPhone,
        message: message,
        instance_id: instance_id || ''
      };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errText = await response.text();
      return { success: false, error: `Erro na API (${response.status}): ${errText || response.statusText}` };
    }

    return { success: true };
  } catch (err: any) {
    console.error('Erro de rede ao enviar WhatsApp via API:', err);
    return { success: false, error: err.message || 'Erro de conexão/rede com a API' };
  }
}

export async function sendWhatsAppNotification(
  config: WhatsAppConfig | undefined,
  phone: string,
  message: string,
  cabinetId?: string,
  cpf?: string,
  nome?: string
): Promise<{ success: boolean; type: 'api' | 'link' | 'error'; error?: string }> {
  if (!phone) {
    return { success: false, type: 'error', error: 'Telefone não fornecido' };
  }

  // Save the message to Firestore if cabinetId and cpf are provided
  if (cabinetId && cpf) {
    try {
      await addDoc(collection(db, 'mensagens_whatsapp'), {
        cabinetId,
        cpf,
        nome: nome || '',
        telefone: phone,
        mensagem: message,
        created_at: serverTimestamp(),
        usuario_nome: 'Sistema'
      });
    } catch (e) {
      console.error('Erro ao salvar log de WhatsApp no Firestore:', e);
    }
  }

  if (config?.enabled && config.api_url) {
    const result = await executeWhatsAppSend(config, phone, message);
    if (result.success) {
      return { success: true, type: 'api' };
    } else {
      console.warn('Falha no envio via API, recorrendo a link manual:', result.error);
      const link = getWhatsAppLink(phone, message);
      window.open(link, '_blank');
      return { success: true, type: 'link', error: result.error };
    }
  }

  const link = getWhatsAppLink(phone, message);
  window.open(link, '_blank');
  return { success: true, type: 'link' };
}

export async function sendWhatsAppMessage(cabinetId: string, phone: string, message: string, cpf?: string, nome?: string) {
  try {
    const cabinetDoc = await getDoc(doc(db, 'cabinets', cabinetId));
    if (!cabinetDoc.exists()) return false;
    
    const config = cabinetDoc.data().whatsapp_config as WhatsAppConfig;
    const res = await sendWhatsAppNotification(config, phone, message, cabinetId, cpf, nome);
    return res.success;
  } catch (error) {
    console.error('Erro ao enviar mensagem de WhatsApp:', error);
    return false;
  }
}

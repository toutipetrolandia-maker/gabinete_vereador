import { doc, getDoc } from 'firebase/firestore';
import { db } from './firebase';

export interface WhatsAppTemplate {
  id: string;
  name: string;
  content: string;
  trigger: 'welcome' | 'status_update' | 'reminder' | 'manual' | 'birthday';
}

export interface WhatsAppConfig {
  instance_id?: string;
  token?: string;
  api_url?: string;
  enabled: boolean;
  templates: WhatsAppTemplate[];
}

export const DEFAULT_TEMPLATES: WhatsAppTemplate[] = [
  {
    id: 'welcome',
    name: 'Boas-vindas',
    trigger: 'welcome',
    content: 'Olá *{{nome}}*, o Gabinete Digital agradece seu contato! Registramos seu atendimento com sucesso. Em breve daremos um retorno.'
  },
  {
    id: 'status_update',
    name: 'Atualização de Demanda',
    trigger: 'status_update',
    content: 'Olá *{{nome}}*, informamos que sua demanda "*{{titulo}}*" foi atualizada para o status: *{{status}}*.'
  },
  {
    id: 'reminder',
    name: 'Lembrete de Agenda',
    trigger: 'reminder',
    content: 'Lembrete: Você tem um compromisso agendado com o Gabinete para o dia *{{data}}* às *{{hora}}*.'
  },
  {
    id: 'birthday',
    name: 'Parabéns / Aniversário',
    trigger: 'birthday',
    content: 'Olá *{{nome}}*! 🎉 Nós do Gabinete Gostaríamos de lhe desejar um feliz aniversário! Que seu novo ciclo seja repleto de realizações, saúde, sucesso e muita paz. Parabéns! 🎂🎈✨'
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

export async function sendWhatsAppMessage(cabinetId: string, phone: string, message: string) {
  try {
    const cabinetDoc = await getDoc(doc(db, 'cabinets', cabinetId));
    if (!cabinetDoc.exists()) return false;
    
    const config = cabinetDoc.data().whatsapp_config as WhatsAppConfig;
    
    if (config?.enabled && config.api_url && config.instance_id && config.token) {
      // Exemplo de integração com Evolution API ou similar
      // Aqui seria feito um fetch POST para a API configurada
      console.log('Enviando via API:', message);
      // await fetch(`${config.api_url}/message/sendText/${config.instance_id}`, { ... })
      return true;
    }
    
    // Fallback: Abre no navegador/app via link wa.me
    window.open(getWhatsAppLink(phone, message), '_blank');
    return true;
  } catch (error) {
    console.error('Erro ao enviar mensagem de WhatsApp:', error);
    return false;
  }
}

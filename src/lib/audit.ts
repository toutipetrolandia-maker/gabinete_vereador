import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db, auth } from './firebase';

export async function logAction(action: string, collectionName: string, docId: string, data?: { previous?: any; next?: any }) {
  try {
    const user = auth.currentUser;
    if (!user) return;

    await addDoc(collection(db, 'logs'), {
      usuario_id: user.uid,
      usuario_nome: user.displayName || user.email || 'Usuário',
      acao: action,
      colecao: collectionName,
      documento_id: docId,
      dados_anteriores: data?.previous || null,
      dados_novos: data?.next || null,
      criado_em: serverTimestamp(),
      ip: 'auto' // No firestore client-side, o IP não é facilmente acessível sem serviço externo
    });
  } catch (error) {
    console.error('Failed to log action:', error);
  }
}

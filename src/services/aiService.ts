import { GoogleGenAI } from "@google/genai";
import { collection, query, where, getDocs, limit, orderBy } from 'firebase/firestore';
import { db } from '../lib/firebase';

const apiKey = process.env.GEMINI_API_KEY;
let ai: GoogleGenAI | null = null;

try {
  if (apiKey) {
    ai = new GoogleGenAI({ apiKey });
  } else {
    console.warn("GEMINI_API_KEY não configurada. O assistente de IA estará desativado.");
  }
} catch (error) {
  console.error("Erro ao inicializar GoogleGenAI:", error);
}

const SYSTEM_INSTRUCTION = `
Você é o Assistente Virtual do Sistema de Gestão de Gabinete Parlamentar. 
Seu objetivo é ajudar os usuários (assessores, atendentes e o vereador) a entender como usar o sistema e realizar os procedimentos corretos.

CONHECIMENTO DO SISTEMA:
1. ATENDIMENTOS:
   - Registro de demandas gerais da população.
   - Status: Novo, Em andamento, Concluído, Encaminhado.
   - Busca Automática de Histórico: Ao inserir um CPF em um novo atendimento, o sistema busca automaticamente se o cidadão possui histórico em "Atendimentos Médicos" e exibe uma barra lateral com essas informações.

2. ATENDIMENTOS MÉDICOS:
   - Focado em saúde. Requer nome do paciente, especialidade e documentos.
   - Busca Automática de Histórico: Ao inserir um CPF, o sistema busca o histórico de "Atendimentos Gerais" do cidadão.
   - Recibo de Óculos: Para atendimentos de doação de óculos com status "Entregue", existe um botão para gerar e imprimir o recibo oficial de entrega.
   - Lembrete de Exame: Se marcado que o paciente "necessita exame", o sistema sugere a criação de um lembrete com data específica.

3. PROTOCOLOS DE SAÚDE:
   - Categorias: TFD (Tratamento Fora de Domicílio), Cirurgias, Exames e Consultas.

4. SUGESTÕES:
   - Ouvidoria e feedback dos cidadãos.
   - Campos: Nome completo, telefone, e-mail, sugestão (mensagem), status (Nova, Analisada, Arquivada) e lembrete.
   - Você pode buscar o status e detalhes de sugestões específicas usando ferramentas de busca.

5. RELATÓRIOS:
   - Exportação de arquivos PDF.
   - Relatórios por bairro, agudos e demandas de alta prioridade.

6. SUPORTE TÉCNICO:
   - WhatsApp do suporte: (75) 98801-7239.

DIRETRIZES DE RESPOSTA:
- Seja profissional, prestativo e conciso.
- Responda sempre em Português Brasileiro.
- Se o usuário perguntar sobre uma sugestão específica ou o status de algo, use a ferramenta de busca de sugestões se disponível.
- Para dúvidas técnicas além do uso do sistema, sugira entrar em contato com o suporte técnico.
`;

const tools = [
  {
    functionDeclarations: [
      {
        name: "search_suggestions",
        description: "Busca sugestões na base de dados por nome do cidadão ou traz as mais recentes se nenhum nome for fornecido.",
        parameters: {
          type: "object",
          properties: {
            nome: {
              type: "string",
              description: "Nome completo ou parte do nome do cidadão que registrou a sugestão."
            }
          }
        }
      }
    ]
  }
];

async function executeSearchSuggestions(cabinetId: string, nome?: string) {
  try {
    const suggestionsRef = collection(db, 'sugestoes');
    let q;
    
    if (nome) {
      q = query(
        suggestionsRef, 
        where('cabinetId', '==', cabinetId),
        where('nome_completo', '>=', nome),
        where('nome_completo', '<=', nome + '\uf8ff'),
        limit(5)
      );
    } else {
      q = query(
        suggestionsRef, 
        where('cabinetId', '==', cabinetId),
        orderBy('created_at', 'desc'), 
        limit(5)
      );
    }
    
    const querySnapshot = await getDocs(q);
    const results = querySnapshot.docs.map(doc => {
      const data = doc.data() as any;
      return {
        id: doc.id,
        nome_completo: data.nome_completo,
        status: data.status,
        sugestao: data.sugestao,
        data: data.created_at?.toDate()?.toLocaleDateString('pt-BR') || 'Desconhecida'
      };
    });
    
    return results.length > 0 ? results : "Nenhuma sugestão encontrada com esse nome.";
  } catch (error) {
    console.error("Erro ao buscar sugestões:", error);
    return "Erro ao acessar o banco de dados de sugestões.";
  }
}

export async function askAIAssistant(cabinetId: string, message: string, history: { role: 'user' | 'model', content: string }[] = []) {
  if (!ai || !apiKey) {
    throw new Error("Assistente de IA não configurado ou chave de API ausente.");
  }
  
  try {
    const contents = [
      ...history.map(h => ({
        role: h.role === 'user' ? 'user' : 'model',
        parts: [{ text: h.content }],
      })),
      { role: 'user', parts: [{ text: message }] }
    ];

    let result = await ai.models.generateContent({
      model: "gemini-1.5-flash",
      contents: contents as any,
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        tools: tools as any,
      }
    });

    const call = result.functionCalls?.[0];

    if (call) {
      const { name, args } = call;
      if (name === "search_suggestions") {
        const toolResult = await executeSearchSuggestions(cabinetId, args.nome as string);
        
        // Append the model's tool call and the tool's response to contents
        const nextContents = [
          ...contents,
          { role: 'model', parts: [{ functionCall: call }] },
          { 
            role: 'user', 
            parts: [{ 
              functionResponse: {
                name: "search_suggestions",
                response: { content: toolResult }
              }
            }] 
          }
        ];

        result = await ai.models.generateContent({
          model: "gemini-1.5-flash",
          contents: nextContents as any,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            tools: tools as any,
          }
        });
      }
    }

    return result.text;
  } catch (error) {
    console.error("Erro na assistência de IA:", error);
    throw new Error("Não foi possível processar sua pergunta agora.");
  }
}

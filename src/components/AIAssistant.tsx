import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Bot, Send, X, Minus, Maximize2, MessageSquare, Loader2, User } from 'lucide-react';
import { askAIAssistant } from '../services/aiService';
import { cn } from '../lib/utils';
import ReactMarkdown from 'react-markdown';

interface Message {
  role: 'user' | 'model';
  content: string;
}

export const AIAssistant: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const response = await askAIAssistant(userMessage, messages);
      setMessages(prev => [...prev, { role: 'model', content: response || 'Desculpe, não consegui processar isso.' }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'model', content: 'Erro ao conectar com o serviço de IA. Tente novamente mais tarde.' }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[60] flex flex-col items-end">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="mb-4 w-[350px] md:w-[400px] h-[500px] bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="bg-slate-950 p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                  <Bot className="text-blue-400" size={24} />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Assistente de Gabinete</h3>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">Online</span>
                  </div>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-2 hover:bg-slate-900 rounded-lg text-slate-500 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            {/* Chat Content */}
            <div 
              ref={scrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            >
              {messages.length === 0 && (
                <div className="text-center py-10 space-y-4">
                  <div className="w-16 h-16 rounded-full bg-blue-600/10 flex items-center justify-center mx-auto border border-blue-500/20">
                    <Bot className="text-blue-400" size={32} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-white font-medium">Como posso ajudar hoje?</p>
                    <p className="text-xs text-slate-500 px-10">Tire dúvidas sobre procedimentos, cadastros e relatórios do sistema.</p>
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center px-4">
                    {['Como cadastrar atendimento?', 'Relatório por bairro', 'Suporte técnico'].map(s => (
                      <button 
                        key={s}
                        onClick={() => { setInput(s); handleSend(); }}
                        className="text-[10px] bg-slate-800/50 border border-slate-700 hover:border-blue-500/50 hover:bg-blue-500/5 py-1.5 px-3 rounded-full text-slate-400 transition-all"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m, i) => (
                <div key={i} className={cn(
                  "flex gap-3",
                  m.role === 'user' ? "flex-row-reverse" : "flex-row"
                )}>
                  <div className={cn(
                    "w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 border",
                    m.role === 'user' ? "bg-slate-800 border-slate-700" : "bg-blue-600/20 border-blue-500/30"
                  )}>
                    {m.role === 'user' ? <User size={16} className="text-slate-400" /> : <Bot size={16} className="text-blue-400" />}
                  </div>
                  <div className={cn(
                    "max-w-[80%] rounded-2xl p-3 text-sm",
                    m.role === 'user' ? "bg-blue-600 text-white rounded-tr-none" : "bg-slate-800/50 text-slate-200 border border-slate-700/50 rounded-tl-none pr-4"
                  )}>
                    <div className="markdown-body">
                      <ReactMarkdown>{m.content}</ReactMarkdown>
                    </div>
                  </div>
                </div>
              ))}
              
              {isLoading && (
                <div className="flex gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-600/20 flex items-center justify-center border border-blue-500/30">
                    <Loader2 size={16} className="text-blue-400 animate-spin" />
                  </div>
                  <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl rounded-tl-none p-3 px-4 flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.3s]" />
                    <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce [animation-delay:-0.15s]" />
                    <span className="w-1.5 h-1.5 bg-blue-500/50 rounded-full animate-bounce" />
                  </div>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="p-4 bg-slate-950 border-t border-slate-800">
              <div className="relative">
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Sua dúvida sobre o sistema..."
                  className="w-full bg-slate-900 border border-slate-800 rounded-2xl py-3 pl-4 pr-12 text-sm text-white focus:outline-none focus:border-blue-500 transition-all"
                />
                <button
                  onClick={handleSend}
                  disabled={!input.trim() || isLoading}
                  className="absolute right-2 top-2 p-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl transition-all"
                >
                  <Send size={18} />
                </button>
              </div>
              <p className="text-[9px] text-slate-600 text-center mt-2 uppercase tracking-tighter">
                IA treinada com os procedimentos internos do gabinete
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-14 h-14 rounded-full flex items-center justify-center shadow-2xl transition-all relative overflow-hidden group",
          isOpen ? "bg-slate-800 text-white" : "bg-blue-600 text-white shadow-blue-600/20"
        )}
      >
        <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity" />
        {isOpen ? <X size={28} /> : <Bot size={28} />}
      </motion.button>
    </div>
  );
};

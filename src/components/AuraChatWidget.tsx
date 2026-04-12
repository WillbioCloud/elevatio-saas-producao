import React, { useEffect, useRef, useState } from 'react';
import { Icons } from './Icons';
import { useAuth } from '../contexts/AuthContext';
import { chatWithAura, ChatMessage } from '../services/ai';

export default function AuraChatWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    if (isOpen) scrollToBottom();
  }, [messages, isOpen]);

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!inputValue.trim() || isLoading) return;

    const userMsg = inputValue.trim();
    const currentHistory = [...messages];

    setMessages([...currentHistory, { role: 'user', text: userMsg }]);
    setInputValue('');
    setIsLoading(true);

    try {
      const response = await chatWithAura(
        userMsg,
        currentHistory,
        user?.name || user?.user_metadata?.name || 'Corretor'
      );
      setMessages((prev) => [...prev, { role: 'model', text: response }]);
    } catch (error: any) {
      setMessages((prev) => [...prev, { role: 'model', text: error.message }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end">
      {isOpen && (
        <div className="mb-4 flex h-[500px] w-[350px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_10px_40px_rgb(0,0,0,0.15)] animate-fade-in sm:w-[400px]">
          <div className="flex items-center justify-between bg-slate-900 px-4 py-3 text-white">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-500/20 text-brand-300">
                <Icons.Sparkles size={16} />
              </div>
              <div>
                <h3 className="text-sm font-bold">Aura</h3>
                <p className="text-[10px] text-slate-300">A sua Copiloto Imobiliária</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 transition-colors hover:text-white"
              aria-label="Fechar chat da Aura"
            >
              <Icons.X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto bg-slate-50 p-4">
            {messages.length === 0 && (
              <div className="flex h-full flex-col items-center justify-center text-center text-slate-400">
                <Icons.Sparkles size={32} className="mb-2 opacity-20" />
                <p className="text-sm font-medium">Como posso ajudar a fechar o seu próximo negócio hoje?</p>
              </div>
            )}

            <div className="flex flex-col gap-4">
              {messages.map((msg, idx) => {
                const lines = msg.text.split('\n');

                return (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm shadow-sm ${
                        msg.role === 'user'
                          ? 'rounded-tr-sm bg-slate-900 text-white'
                          : 'rounded-tl-sm border border-slate-100 bg-white text-slate-700'
                      }`}
                    >
                      {lines.map((line, lineIndex) => (
                        <React.Fragment key={lineIndex}>
                          {line}
                          {lineIndex !== lines.length - 1 && <br />}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                );
              })}

              {isLoading && (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-tl-sm border border-slate-100 bg-white px-4 py-3 shadow-sm">
                    <Icons.Loader2 size={16} className="animate-spin text-slate-400" />
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>
          </div>

          <form onSubmit={handleSendMessage} className="border-t border-slate-100 bg-white p-3">
            <div className="relative flex items-center">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                placeholder="Pergunte à Aura..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pl-4 pr-12 text-sm focus:border-brand-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-brand-500"
                disabled={isLoading}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 flex h-8 w-8 items-center justify-center rounded-lg bg-slate-900 text-white transition-colors hover:bg-slate-800 disabled:opacity-50"
                aria-label="Enviar mensagem para a Aura"
              >
                <Icons.Send size={14} />
              </button>
            </div>
          </form>
        </div>
      )}

      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="group flex h-14 w-14 items-center justify-center rounded-full bg-slate-900 text-white shadow-xl transition-all hover:scale-105 hover:bg-slate-800 focus:outline-none focus:ring-4 focus:ring-slate-900/20"
          aria-label="Abrir chat da Aura"
        >
          <Icons.Sparkles size={24} className="text-brand-400 transition-transform group-hover:rotate-12" />
        </button>
      )}
    </div>
  );
}

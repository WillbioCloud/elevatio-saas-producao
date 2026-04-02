import React, { useState } from 'react';
import { Icons } from './Icons';
import { useTenant } from '../contexts/TenantContext';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ContactModal({ isOpen, onClose }: ContactModalProps) {
  const { tenant } = useTenant();
  const [subject, setSubject] = useState('Quero anunciar meu imóvel');
  const [customMessage, setCustomMessage] = useState('');

  if (!isOpen) return null;

  const handleWhatsAppClick = () => {
    const phone = tenant?.whatsapp || tenant?.phone || '';
    const cleanPhone = phone.replace(/\D/g, '');

    let text = '';
    if (subject === 'Outra opção') {
      text = customMessage;
    } else {
      text = `Olá! ${subject}.`;
    }

    const url = `https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl animate-in fade-in zoom-in-95">
        <div className="flex justify-between items-center p-5 border-b border-slate-100 dark:border-slate-800">
          <h3 className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
            <Icons.MessageCircle className="text-green-500" /> Fale Conosco
          </h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors">
            <Icons.X size={20} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
              Como podemos ajudar?
            </label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none"
            >
              <option value="Quero anunciar meu imóvel">Quero anunciar meu imóvel</option>
              <option value="Outra opção">Outra opção</option>
            </select>
          </div>

          {subject === 'Outra opção' && (
            <div className="animate-in fade-in slide-in-from-top-2">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Sua mensagem
              </label>
              <textarea
                value={customMessage}
                onChange={(e) => setCustomMessage(e.target.value)}
                placeholder="Digite como podemos te ajudar..."
                rows={4}
                className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-green-500 outline-none resize-none"
              />
            </div>
          )}
        </div>

        <div className="p-5 bg-slate-50 dark:bg-slate-800/50 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-3 text-sm font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={handleWhatsAppClick}
            disabled={subject === 'Outra opção' && customMessage.trim() === ''}
            className="flex-1 py-3 text-sm font-bold text-white bg-green-500 hover:bg-green-600 rounded-xl transition-colors flex items-center justify-center gap-2 disabled:opacity-50 shadow-lg shadow-green-500/25"
          >
            <Icons.Send size={18} />
            Enviar no WhatsApp
          </button>
        </div>
      </div>
    </div>
  );
}

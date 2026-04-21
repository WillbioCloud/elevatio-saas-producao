import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { X, MessageCircle, Home } from 'lucide-react';

export default function ContactModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const { tenant } = useTenant();

  if (!isOpen) return null;

  const handleRedirect = (type: 'buy' | 'sell') => {
    // Extrai o número de telefone das configurações do site do tenant
    let targetPhone = '';
    try {
      const siteDataStr = tenant?.site_data;
      const siteData = typeof siteDataStr === 'string' ? JSON.parse(siteDataStr) : siteDataStr || {};
      targetPhone = (siteData?.contact?.phone || '').replace(/\D/g, '');
    } catch (err) {
      console.error(err);
    }

    const preMessage = type === 'buy' 
      ? 'Olá! Gostaria de falar com um especialista para encontrar um imóvel.'
      : 'Olá! Tenho interesse em anunciar minha propriedade com vocês.';

    const encodedMessage = encodeURIComponent(preMessage);
    
    const wpLink = targetPhone 
      ? `https://wa.me/55${targetPhone}?text=${encodedMessage}`
      : `https://wa.me/?text=${encodedMessage}`;

    window.open(wpLink, '_blank');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6">
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity" 
        onClick={onClose}
      />
      <div className="relative w-full max-w-sm bg-white rounded-3xl shadow-2xl overflow-hidden animate-fade-in">
        <div className="flex justify-between items-center px-6 py-5 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold tracking-tight text-slate-900">Como podemos ajudar?</h2>
          </div>
          <button 
            onClick={onClose} 
            className="p-2 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-full transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        <div className="p-6 space-y-3">
          <button 
            onClick={() => handleRedirect('buy')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-900 text-white flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <MessageCircle size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Falar com especialista</h3>
              <p className="text-xs text-slate-500 mt-0.5">Encontre seu novo lar</p>
            </div>
          </button>

          <button 
            onClick={() => handleRedirect('sell')}
            className="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-100 hover:border-slate-300 hover:bg-slate-50 transition-all text-left group"
          >
            <div className="w-10 h-10 rounded-full bg-slate-100 text-slate-900 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
              <Home size={18} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">Anunciar meu imóvel</h3>
              <p className="text-xs text-slate-500 mt-0.5">Venda ou alugue com segurança</p>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
}

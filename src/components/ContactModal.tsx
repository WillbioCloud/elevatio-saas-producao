import React, { useState } from 'react';
import { Icons } from './Icons';

interface ContactModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const ContactModal: React.FC<ContactModalProps> = ({ isOpen, onClose }) => {
  const [propertyType, setPropertyType] = useState('');
  const [neighborhood, setNeighborhood] = useState('');

  // TODO: Substituir pelo número real da imobiliária (apenas números, com código do país)
  const ADMIN_PHONE = '5511999999999';

  if (!isOpen) return null;

  const handleClose = () => {
    setPropertyType('');
    setNeighborhood('');
    onClose();
  };

  const handleSendWhatsApp = () => {
    const text = encodeURIComponent(
      `Olá! Tenho interesse em colocar meu imóvel à venda com a imobiliária. É um(a) *${propertyType}* localizado(a) no bairro *${neighborhood.trim()}*. Podemos conversar?`,
    );
    window.open(`https://wa.me/${ADMIN_PHONE}?text=${text}`, '_blank');
    handleClose();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm animate-fade-in">
      <div className="relative w-full max-w-md overflow-hidden rounded-3xl bg-white shadow-2xl">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 z-10 rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600"
        >
          <Icons.X size={20} />
        </button>

        <div className="p-8">
          <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
            <Icons.Home size={24} />
          </div>
          <h3 className="mb-2 text-2xl font-serif font-bold text-slate-800">Venda seu imóvel conosco</h3>
          <p className="mb-6 text-sm text-slate-500">
            Preencha os dados básicos abaixo para agilizarmos o seu atendimento com um captador.
          </p>

          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500 uppercase">Tipo de Imóvel *</label>
              <select
                value={propertyType}
                onChange={(e) => setPropertyType(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
              >
                <option value="">Selecione o tipo...</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Casa">Casa</option>
                <option value="Casa em Condomínio">Casa em Condomínio</option>
                <option value="Cobertura">Cobertura</option>
                <option value="Terreno/Lote">Terreno/Lote</option>
                <option value="Comercial">Comercial</option>
                <option value="Fazenda/Chácara">Fazenda/Chácara</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-bold text-slate-500 uppercase">Bairro do Imóvel *</label>
              <input
                type="text"
                value={neighborhood}
                onChange={(e) => setNeighborhood(e.target.value)}
                placeholder="Ex: Centro, Setor Bueno..."
                className="w-full rounded-xl border border-slate-200 px-4 py-3 text-slate-700 outline-none focus:ring-2 focus:ring-brand-500"
              />
            </div>

            <button
              onClick={handleSendWhatsApp}
              disabled={!propertyType || !neighborhood.trim()}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 py-4 font-bold text-white transition-colors hover:bg-emerald-700 disabled:bg-slate-200 disabled:text-slate-400"
            >
              <Icons.MessageCircle size={20} /> Avançar para o WhatsApp
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ContactModal;
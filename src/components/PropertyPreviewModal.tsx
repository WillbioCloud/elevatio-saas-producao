import React, { useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from './Icons';

type PreviewImage = string | File;

interface PropertyPreviewData {
  title: string;
  description: string;
  type: string;
  listing_type: 'sale' | 'rent';
  price: number;
  bedrooms: number;
  bathrooms: number;
  garage: number;
  area: number | '';
  built_area?: number | '';
  features: string[];
  neighborhood: string;
  city: string;
  state: string;
  images: PreviewImage[];
}

interface PropertyPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: PropertyPreviewData;
}

const getImageSrc = (image: PreviewImage) => {
  if (typeof image === 'string') return image;
  return URL.createObjectURL(image);
};

const currencyFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  maximumFractionDigits: 0,
});

const PropertyPreviewModal: React.FC<PropertyPreviewModalProps> = ({ isOpen, onClose, data }) => {
  
  // Prepara as imagens (URL ou Blob)
  const resolvedImages = useMemo(() => {
    if (!isOpen) return [] as string[];
    return data.images.map((image) => getImageSrc(image));
  }, [data.images, isOpen]);

  const isRent = data.listing_type === 'rent';

  // Bloqueia o scroll da página de trás quando o modal abre
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isOpen]);

  // Se não estiver aberto, não renderiza nada
  if (!isOpen) return null;

  // Renderiza via Portal direto no BODY para ignorar z-index do Sidebar
  return createPortal(
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
      
      {/* 1. Overlay Escuro (Fundo) */}
      <div 
        className="absolute inset-0 bg-slate-900/95 backdrop-blur-sm transition-opacity animate-fade-in" 
        onClick={onClose}
      />

      {/* 2. O Card do Modal (Conteúdo) */}
      <div className="relative w-full max-w-7xl h-full max-h-[90vh] bg-white rounded-3xl shadow-2xl overflow-hidden flex flex-col animate-scale-in border border-slate-200">
        
        {/* Header Fixo do Modal */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white z-20 shrink-0 shadow-sm">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 text-brand-600 font-bold bg-brand-50 px-3 py-1.5 rounded-full text-xs uppercase tracking-wider border border-brand-100">
              <Icons.Eye size={14} />
              Modo Visualização
            </span>
            <span className="text-slate-400 text-sm hidden sm:inline-block">
              É assim que o cliente verá o imóvel.
            </span>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={onClose}
              className="group flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-red-50 text-slate-600 hover:text-red-600 rounded-full transition-all font-semibold text-sm"
              title="Fechar (Esc)"
            >
              <span>Fechar</span>
              <Icons.X size={18} className="group-hover:rotate-90 transition-transform" />
            </button>
          </div>
        </div>

        {/* Área de Scroll (Conteúdo do Imóvel) */}
        <div className="flex-1 overflow-y-auto custom-scrollbar bg-slate-50">
           <div className="max-w-6xl mx-auto p-6 md:p-10">
              
              {/* Header do Imóvel */}
              <div className="mb-8">
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-4">
                  <div>
                    <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-900 leading-tight">
                      {data.title || 'Título do Imóvel'}
                    </h1>
                    <div className="flex items-center gap-2 text-slate-500 mt-2">
                      <Icons.MapPin size={18} className="text-brand-500" />
                      <span className="text-lg">
                        {data.neighborhood || 'Bairro'}, {data.city || 'Cidade'} - {data.state || 'UF'}
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <p className="text-sm uppercase font-bold tracking-widest text-slate-500 mb-1">
                      {isRent ? 'Aluguel' : 'Venda'}
                    </p>
                    <p className="text-3xl md:text-4xl font-serif font-bold text-brand-600">
                      {currencyFormatter.format(Number(data.price || 0))}
                      {isRent && <span className="text-lg text-slate-400 font-sans font-normal">/mês</span>}
                    </p>
                  </div>
                </div>

                {/* Tags Rápidas */}
                <div className="flex flex-wrap gap-3">
                  <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold flex items-center gap-2">
                    <Icons.Home size={14} /> {data.type}
                  </span>
                  <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold flex items-center gap-2">
                    <Icons.Maximize size={14} /> {data.area} m²
                  </span>
                  {data.built_area && (
                    <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold flex items-center gap-2">
                      <Icons.Home size={14} /> {data.built_area} m² Const.
                    </span>
                  )}
                  <span className="px-3 py-1 bg-slate-200 text-slate-700 rounded-lg text-sm font-semibold flex items-center gap-2">
                    <Icons.Bed size={14} /> {data.bedrooms} Quartos
                  </span>
                </div>
              </div>

              {/* Galeria Principal */}
              {resolvedImages.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-10 h-[500px]">
                  {/* Imagem Destaque (Grande) */}
                  <div className="md:col-span-2 md:row-span-2 h-full rounded-2xl overflow-hidden shadow-lg group relative">
                    <img 
                      src={resolvedImages[0]} 
                      alt="Destaque" 
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                  </div>

                  {/* Imagens Secundárias */}
                  {resolvedImages.slice(1, 5).map((img, idx) => (
                    <div key={idx} className="hidden md:block h-full rounded-2xl overflow-hidden shadow-sm relative group">
                      <img 
                        src={img} 
                        alt={`Foto ${idx + 2}`} 
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" 
                      />
                    </div>
                  ))}
                  
                  {/* Placeholder se tiver poucas fotos */}
                  {resolvedImages.length < 5 && Array.from({ length: 5 - resolvedImages.length }).map((_, idx) => (
                     <div key={`placeholder-${idx}`} className="hidden md:flex bg-slate-200 rounded-2xl items-center justify-center text-slate-400">
                        <Icons.Image size={32} />
                     </div>
                  ))}
                </div>
              ) : (
                <div className="w-full h-64 bg-slate-100 rounded-2xl flex flex-col items-center justify-center text-slate-400 mb-10 border-2 border-dashed border-slate-300">
                  <Icons.Image size={48} className="mb-2 opacity-50" />
                  <p>Sem imagens selecionadas</p>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-10">
                {/* Coluna Principal: Descrição e Features */}
                <div className="lg:col-span-2 space-y-8">
                  <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center gap-2">
                      <Icons.FileText className="text-brand-500" />
                      Sobre o imóvel
                    </h3>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line text-lg">
                      {data.description || 'Sem descrição informada.'}
                    </p>
                  </section>

                  <section className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
                    <h3 className="text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                      <Icons.List className="text-brand-500" />
                      Comodidades e Características
                    </h3>
                    
                    {data.features && data.features.length > 0 ? (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        {data.features.map((feature) => (
                          <div
                            key={feature}
                            className="flex items-center gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 hover:border-brand-200 hover:bg-brand-50 transition-colors group"
                          >
                            <div className="p-1.5 bg-white rounded-full text-emerald-500 shadow-sm group-hover:text-emerald-600">
                               <Icons.Check size={14} strokeWidth={3} />
                            </div>
                            <span className="font-medium text-sm">{feature}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-slate-500 italic">Nenhuma característica adicionada.</p>
                    )}
                  </section>
                </div>

                {/* Coluna Lateral: Resumo */}
                <div className="space-y-6">
                  <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-lg">
                    <h3 className="font-bold text-slate-800 mb-6">Resumo</h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-slate-500 flex items-center gap-2"><Icons.Bed size={16}/> Quartos</span>
                        <span className="font-bold text-slate-800">{data.bedrooms}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-slate-500 flex items-center gap-2"><Icons.Bath size={16}/> Banheiros</span>
                        <span className="font-bold text-slate-800">{data.bathrooms}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-slate-500 flex items-center gap-2"><Icons.Car size={16}/> Vagas</span>
                        <span className="font-bold text-slate-800">{data.garage}</span>
                      </div>
                      <div className="flex justify-between items-center py-3 border-b border-slate-50">
                        <span className="text-slate-500 flex items-center gap-2"><Icons.Maximize size={16}/> Área</span>
                        <span className="font-bold text-slate-800">{data.area} m²</span>
                      </div>
                      {data.built_area && (
                        <div className="flex justify-between items-center py-3 border-b border-slate-50">
                          <span className="text-slate-500 flex items-center gap-2"><Icons.Home size={16}/> Área Construída</span>
                          <span className="font-bold text-slate-800">{data.built_area} m²</span>
                        </div>
                      )}
                    </div>
                    
                    <button className="w-full mt-6 bg-brand-600 text-white font-bold py-3 rounded-xl shadow-lg shadow-brand-500/30 opacity-50 cursor-not-allowed flex items-center justify-center gap-2">
                      <Icons.MessageCircle size={18} />
                      Contato (Simulação)
                    </button>
                  </div>
                </div>
              </div>
           </div>
        </div>

        {/* Footer Fixo */}
        <div className="p-4 border-t border-slate-100 bg-white shrink-0 flex justify-between items-center z-20">
           <span className="text-xs text-slate-400 font-medium bg-slate-100 px-3 py-1 rounded-md">
             Visualizando rascunho em tempo real
           </span>
           <button 
             onClick={onClose} 
             className="px-8 py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-black transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0"
           >
             Voltar e Editar
           </button>
        </div>

      </div>
    </div>,
    document.body
  );
};

export default PropertyPreviewModal;
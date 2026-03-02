import React, { useState } from 'react'; // Importe o useState
import { Link } from 'react-router-dom';
import { Property } from '../types';
import { Icons } from './Icons';

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const isRent = property.listing_type === 'rent';
  const hasMultipleImages = property.images && property.images.length > 1;

  // Funções para navegar entre as fotos
  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault(); // Impede de abrir o link do imóvel
    setCurrentImageIndex((prev) => (prev + 1) % property.images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault(); // Impede de abrir o link do imóvel
    setCurrentImageIndex((prev) => (prev - 1 + property.images.length) % property.images.length);
  };

  return (
    <Link to={`/imoveis/${property.slug}`} className="group relative bg-white rounded-2xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 hover:z-50 transition-all duration-300 flex flex-col h-full">
      <div className="relative h-64 overflow-hidden isolate">
        {/* Imagem com Transição Suave */}
        <img 
          key={currentImageIndex}
          src={property.images[currentImageIndex] || 'https://placehold.co/600x400'} 
          alt={property.title} 
          className="w-full h-full object-cover transition-all duration-500 group-hover:scale-110"
        />
        
        {/* Setas de Navegação (Só aparecem se houver mais de uma foto) */}
        {hasMultipleImages && (
          <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={prevImage}
              className="p-1.5 rounded-full bg-white/80 text-brand-900 hover:bg-white shadow-lg transition-transform hover:scale-110"
            >
              <Icons.ChevronLeft size={20} />
            </button>
            <button 
              onClick={nextImage}
              className="p-1.5 rounded-full bg-white/80 text-brand-900 hover:bg-white shadow-lg transition-transform hover:scale-110"
            >
              <Icons.ChevronRight size={20} />
            </button>
          </div>
        )}

        {/* Indicador de Fotos (Pontinhos) */}
        {hasMultipleImages && (
          <div className="absolute bottom-4 right-4 flex gap-1.5 z-10">
            {property.images.slice(0, 5).map((_, idx) => (
              <div 
                key={idx}
                className={`h-1.5 w-1.5 rounded-full transition-all ${idx === currentImageIndex ? 'bg-white w-3' : 'bg-white/50'}`}
              />
            ))}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-60 group-hover:opacity-40 transition-opacity pointer-events-none" />
        
        {/* Tags Superiores */}
        <div className="absolute top-4 left-4 flex flex-wrap gap-2">
          {/* Tag de Tipo (Casa, Apto) */}
          <span className="bg-white/90 backdrop-blur-md text-brand-900 text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
            {property.type}
          </span>
          
          {/* NOVA Tag: Venda ou Aluguel */}
          <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shadow-sm backdrop-blur-md ${
            isRent 
              ? 'bg-indigo-600/90 text-white' // Cor para Aluguel
              : 'bg-emerald-600/90 text-white' // Cor para Venda
          }`}>
            {isRent ? 'Aluguel' : 'Venda'}
          </span>
        </div>
        
        {/* Preço */}
        <div className="absolute bottom-4 left-4 text-white">
          <p className="text-xl font-bold font-serif flex items-baseline gap-1">
            {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price)}
            {/* Adiciona o /mês se for aluguel */}
            {isRent && <span className="text-sm font-sans font-medium opacity-90">/mês</span>}
          </p>
        </div>
      </div>

      <div className="p-5 flex-1 flex flex-col">
        <div className="flex-1">
          <h3 className="font-bold text-lg text-slate-800 mb-2 line-clamp-1 group-hover:text-brand-600 transition-colors">
            {property.title}
          </h3>
          <p className="text-slate-500 text-sm flex items-center gap-1 mb-4">
            <Icons.MapPin size={14} className="text-brand-500 shrink-0" />
            <span className="truncate">{property.location.neighborhood}, {property.location.city}</span>
          </p>

          <div className="flex items-center gap-4 text-slate-600 text-xs font-bold border-t border-slate-100 pt-4 flex-wrap">
            <div className="flex items-center gap-1">
              <Icons.Bed size={16} className="text-slate-400" /> 
              {property.bedrooms || '-'} <span className="hidden sm:inline font-normal">Quartos</span>
            </div>
            <div className="flex items-center gap-1">
              <Icons.Car size={16} className="text-slate-400" /> 
              {property.garage || '-'} <span className="hidden sm:inline font-normal">Vagas</span>
            </div>
            {property.built_area ? (
              <div className="flex items-center gap-1" title="Área Construída">
                <Icons.Home size={16} className="text-slate-400" /> 
                {property.built_area} m² <span className="hidden sm:inline font-normal">Const.</span>
              </div>
            ) : (
              <div className="flex items-center gap-1" title="Área Total">
                <Icons.Maximize size={16} className="text-slate-400" /> 
                {property.area || '-'} m²
              </div>
            )}
          </div>
        </div>

        {/* --- RODAPÉ DO CORRETOR --- */}
        <div className="mt-4 pt-3 border-t border-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2">  
          </div>
          <Icons.ArrowRight size={18} className="text-gray-400" />
        </div>
      </div>
    </Link>
  );
};

export default PropertyCard;
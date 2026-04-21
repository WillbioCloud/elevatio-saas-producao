import React from 'react';
import { BedDouble, Car, Maximize2, MapPin } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PropertyCard({ property }: any) { 
  const displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price || 0);
  return (
    <Link to={`/imovel/${property.id}`} className="group relative bg-white overflow-hidden shadow-sm flex flex-col h-full rounded-2xl w-full transition-shadow hover:shadow-md cursor-pointer border border-slate-100">
      <div className="relative h-48 overflow-hidden isolate bg-slate-100">
        <img src={property.images?.[0] || 'https://placehold.co/600x400'} alt={property.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" />
      </div>
      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-bold text-base text-slate-800 line-clamp-1 mb-1">{property.title}</h3>
        <p className="text-xs text-slate-500 flex items-center gap-1.5 mb-4 line-clamp-1">
          <MapPin size={12} className="text-slate-400 shrink-0" />
          {property.location?.neighborhood || property.neighborhood || ''}, {property.location?.city || property.city || ''}
        </p>
        <div className="text-xl font-bold text-slate-900 mb-4 tracking-tight mt-auto">
          {displayPrice}
        </div>
        <div className="flex items-center gap-4 text-slate-600 text-[10px] font-bold uppercase tracking-widest border-t border-slate-100 pt-4 flex-wrap">
          <div className="flex items-center gap-1" title="Quartos">
            <BedDouble size={14} className="text-slate-400" /> {property.bedrooms || '-'}
          </div>
          <div className="flex items-center gap-1" title="Vagas">
            <Car size={14} className="text-slate-400" /> {property.garage || '-'}
          </div>
          <div className="flex items-center gap-1" title="Área Total">
            <Maximize2 size={14} className="text-slate-400" /> {property.area || '-'} m²
          </div>
        </div>
      </div>
    </Link>
  );
}

import React from 'react';
import { Link } from 'react-router-dom';

export interface LuxuryProperty {
  id: string;
  title: string;
  slug: string;
  price: number;
  condominium?: number | null;
  iptu?: number | null;
  type: string;
  listing_type: string;
  bedrooms: number;
  bathrooms: number;
  area: number;
  suites: number;
  garage: number;
  city: string;
  neighborhood: string;
  state: string;
  images: string[];
  featured?: boolean;
  status?: string;
}

interface LuxuryPropertyCardProps {
  property: LuxuryProperty;
  index?: number;
  variant?: 'default' | 'featured';
  viewMode?: 'grid' | 'list';
}

const formatTotalRentPrice = (property: LuxuryProperty) => {
  const normalized = String(property.listing_type || '').toLowerCase();
  const isRent =
    normalized === 'rent' ||
    normalized.includes('alug') ||
    normalized.includes('venda e aluguel');

  const totalPrice = isRent
    ? (property.price || 0) + (property.condominium || 0) + (property.iptu || 0)
    : property.price || 0;

  const formatted = totalPrice.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

  return isRent ? `${formatted}/mês` : formatted;
};

export default function LuxuryPropertyCard({
  property,
  index = 0,
  variant = 'default',
  viewMode = 'grid',
}: LuxuryPropertyCardProps) {
  const isList = viewMode === 'list';
  const normalizedListingType = String(property.listing_type || '').toLowerCase();
  const listingLabel =
    normalizedListingType === 'sale' || normalizedListingType === 'venda'
      ? 'Venda'
      : normalizedListingType === 'rent' || normalizedListingType === 'aluguel'
        ? 'Locação'
        : 'Venda/Locação';

  return (
    <>
      <style>{`
        .lx-card-${property.id} {
          animation: lx-card-in 0.55s ease ${index * 0.08}s both;
        }

        @keyframes lx-card-in {
          from {
            opacity: 0;
            transform: translateY(22px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>

      <Link
        to={`/imovel/${property.slug || property.id}`}
        className={`lx-card-${property.id} group cursor-pointer block h-full ${
          isList 
            ? 'flex flex-col md:flex-row gap-6 md:items-center bg-[#111] p-4 rounded-[2rem] border border-white/5 hover:border-white/10 transition-colors' 
            : 'flex flex-col bg-[#111] p-4 rounded-[2rem] border border-white/5 hover:border-white/10 transition-colors'
        }`}
      >
        {/* IMAGEM: Fica 4/3 no Grid. Na Lista, fica limitada a md:w-72 */}
        <div 
          className={`relative overflow-hidden bg-neutral-900 border border-white/5 flex-shrink-0 ${
            isList 
              ? 'w-full md:w-72 aspect-[4/3] rounded-[1.5rem]' 
              : 'w-full aspect-[4/3] rounded-[1.5rem] mb-6'
          }`}
        >
          {property.images?.[0] ? (
            <img
              src={property.images[0]}
              alt={property.title}
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-neutral-800">
              <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            </div>
          )}

          {/* Badge Venda/Aluguel */}
          <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-md border border-white/10 text-white text-xs px-4 py-2 rounded-full font-medium tracking-wide uppercase">
            {listingLabel}
          </div>
        </div>

        {/* CONTEÚDO */}
        <div className="flex flex-col flex-grow w-full">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-2 gap-2">
            <h3 className={`font-medium line-clamp-2 pr-4 min-h-[56px] ${isList ? 'text-2xl' : 'text-xl'}`}>
              {property.title}
            </h3>
            <div className={`font-light whitespace-nowrap text-white flex-shrink-0 ${isList ? 'text-2xl' : 'text-lg'}`}>
              {formatTotalRentPrice(property)}
            </div>
          </div>

          {/* Specs */}
          <div className={`space-y-2 text-sm text-neutral-400 mt-auto pt-4 ${isList ? 'mt-4' : 'border-t border-white/10'}`}>
            <div className="flex items-center gap-2 line-clamp-1">
              <svg className="w-4 h-4 flex-shrink-0 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z" /><circle cx="12" cy="10" r="3" /></svg>
              {property.neighborhood}, {property.city}
            </div>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 4v16"/><path d="M2 8h18a2 2 0 0 1 2 2v10"/><path d="M2 17h20"/><path d="M6 8v9"/></svg> {property.bedrooms}</span>
              <span className="flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 6 6.5 3.5a1.5 1.5 0 0 0-1-.5C4.683 3 4 3.683 4 4.5V17a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-5"/><line x1="10" x2="8" y1="5" y2="7"/><line x1="2" x2="22" y1="12" y2="12"/><line x1="7" x2="7" y1="19" y2="21"/><line x1="17" x2="17" y1="19" y2="21"/></svg> {property.bathrooms}</span>
              <span className="flex items-center gap-2"><svg className="w-4 h-4 flex-shrink-0 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M8 3H5a2 2 0 0 0-2 2v3"/><path d="M21 8V5a2 2 0 0 0-2-2h-3"/><path d="M3 16v3a2 2 0 0 0 2 2h3"/><path d="M16 21h3a2 2 0 0 0 2-2v-3"/></svg> {property.area} m²</span>
            </div>
          </div>
        </div>
      </Link>
    </>
  );
}

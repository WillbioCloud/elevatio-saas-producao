import React from 'react';
import { Link } from 'react-router-dom';
import { Bath, BedDouble, MapPin, Maximize2 } from 'lucide-react';

interface PropertyCardProps {
  property: any;
}

const parseImages = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [value];
    } catch {
      return [value];
    }
  }
  return [];
};

export default function PropertyCard({ property }: PropertyCardProps) {
  const images = parseImages(property.images);
  const listingType = property.listing_type || property.transaction_type;
  const isSale = String(listingType || '').toLowerCase() === 'sale' || String(listingType || '').toLowerCase() === 'venda';
  const city = property.location?.city || property.city || '';
  const state = property.location?.state || property.state || '';

  return (
    <Link
      to={`/imovel/${property.slug || property.id}`}
      className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
    >
      <div className="aspect-[4/3] relative overflow-hidden">
        <img
          src={images[0] || 'https://via.placeholder.com/600x400'}
          alt={property.title}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
        />
        <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-slate-900 shadow-sm">
          {isSale ? 'Venda' : 'Aluguel'}
        </div>
      </div>

      <div className="p-6">
        <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-1">{property.title}</h3>
        <p className="text-slate-500 text-sm mb-4 flex items-center gap-1">
          <MapPin size={16} /> {city}, {state}
        </p>
        <div className="flex items-center gap-4 text-slate-600 text-sm mb-6 pb-6 border-b border-slate-100">
          <span className="flex items-center gap-1"><BedDouble size={16} /> {property.bedrooms}</span>
          <span className="flex items-center gap-1"><Bath size={16} /> {property.bathrooms}</span>
          <span className="flex items-center gap-1"><Maximize2 size={16} /> {property.area}m²</span>
        </div>
        <div className="text-2xl font-bold text-brand-600">
          {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price || 0)}
        </div>
      </div>
    </Link>
  );
}

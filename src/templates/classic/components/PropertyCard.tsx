import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Property } from '../../../types';
import { useTenant } from '../../../contexts/TenantContext';
import { BedDouble, Car, Home as HomeIcon, Maximize2, ChevronLeft, ChevronRight, MapPin } from 'lucide-react';

interface PropertyCardProps {
  property: Property;
}

const PropertyCard: React.FC<PropertyCardProps> = ({ property }) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { tenant } = useTenant();
  const siteData = tenant?.site_data;
  const primaryColor = siteData?.primary_color || '#1e293b';
  const secondaryColor = siteData?.secondary_color || '#3b82f6';
  const isRent = property.listing_type === 'rent';

  let images: string[] = [];
  if (Array.isArray(property.images)) {
    images = property.images;
  } else if (typeof property.images === 'string') {
    try { 
      images = JSON.parse(property.images); 
    } catch { 
      images = [property.images]; 
    }
  }

  const hasMultipleImages = images.length > 1;

  const nextImage = (e: React.MouseEvent) => {
    e.preventDefault(); 
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  const linkTo = `/imoveis/${property.slug || property.id}`;
  const displayPrice = new Intl.NumberFormat('pt-BR', { 
    style: 'currency', 
    currency: 'BRL' 
  }).format(property.price || 0);

  return (
    <Link 
      to={linkTo} 
      className="group relative bg-white rounded-3xl overflow-hidden shadow-sm border border-slate-100 hover:shadow-xl hover:-translate-y-1 hover:z-50 transition-all duration-300 flex flex-col h-full"
    >
      <div className="relative h-64 overflow-hidden isolate">
        <img 
          key={currentImageIndex}
          src={images[currentImageIndex] || 'https://placehold.co/600x400?text=Sem+Foto'}
          alt={property.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />

        {hasMultipleImages && (
          <div className="absolute inset-0 flex items-center justify-between px-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-20">
            <button 
              onClick={prevImage} 
              className="p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-800 shadow-sm backdrop-blur-sm transition-all"
            >
              <ChevronLeft size={20} />
            </button>
            <button 
              onClick={nextImage} 
              className="p-1.5 rounded-full bg-white/80 hover:bg-white text-slate-800 shadow-sm backdrop-blur-sm transition-all"
            >
              <ChevronRight size={20} />
            </button>
          </div>
        )}

        {hasMultipleImages && (
          <div className="absolute bottom-3 left-0 right-0 flex justify-center gap-1.5 z-20">
            {images.map((_, idx) => (
              <div 
                key={idx} 
                className={`h-1.5 rounded-full transition-all duration-300 shadow-sm ${
                  idx === currentImageIndex ? 'w-4 bg-white' : 'w-1.5 bg-white/60'
                }`} 
              />
            ))}
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent z-10 pointer-events-none" />

        <div className="absolute top-4 left-4 z-20 flex flex-wrap gap-2">
          <span className="bg-white/95 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-bold shadow-sm uppercase text-slate-700 tracking-wider">
            {property.type || 'Imóvel'}
          </span>
          <span 
            className="px-3 py-1 rounded-full text-xs font-bold shadow-sm uppercase text-white tracking-wider" 
            style={{ backgroundColor: isRent ? secondaryColor : primaryColor }}
          >
            {isRent ? 'Aluguel' : 'Venda'}
          </span>
        </div>
      </div>

      <div className="p-5 flex flex-col flex-grow">
        <h3 className="font-bold text-lg text-slate-800 line-clamp-1 group-hover:text-brand-600 transition-colors mb-1">
          {property.title}
        </h3>

        <p className="text-sm text-slate-500 flex items-center gap-1.5 mb-4 line-clamp-1">
          <MapPin size={14} className="text-slate-400 shrink-0" />
          {property.location?.neighborhood || property.neighborhood || ''}, {property.location?.city || property.city || ''}
        </p>

        <div className="text-2xl font-black text-slate-900 mb-4 tracking-tight mt-auto">
          {displayPrice}
          {isRent && <span className="text-sm text-slate-500 font-medium tracking-normal ml-1">/mês</span>}
        </div>

        <div className="flex items-center gap-4 text-slate-600 text-xs font-bold border-t border-slate-100 pt-4 flex-wrap">
          <div className="flex items-center gap-1.5" title="Quartos">
            <BedDouble size={16} className="text-slate-400" /> 
            {property.bedrooms || '-'} 
            <span className="hidden sm:inline font-medium uppercase text-[10px] tracking-wider">Quartos</span>
          </div>
          <div className="flex items-center gap-1.5" title="Vagas">
            <Car size={16} className="text-slate-400" /> 
            {property.garage || '-'} 
            <span className="hidden sm:inline font-medium uppercase text-[10px] tracking-wider">Vagas</span>
          </div>
          {property.built_area ? (
            <div className="flex items-center gap-1.5" title="Área Construída">
              <HomeIcon size={16} className="text-slate-400" /> 
              {property.built_area} m² 
              <span className="hidden sm:inline font-medium uppercase text-[10px] tracking-wider">Const.</span>
            </div>
          ) : (
            <div className="flex items-center gap-1.5" title="Área Total">
              <Maximize2 size={16} className="text-slate-400" /> 
              {property.area || '-'} m²
            </div>
          )}
        </div>
      </div>
    </Link>
  );
};

export default PropertyCard;

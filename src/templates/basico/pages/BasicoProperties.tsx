import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, BedDouble, Bath, Maximize2 } from 'lucide-react';
import { useProperties } from '../../../hooks/useProperties';
import { useTenant } from '../../../contexts/TenantContext';

export default function BasicoProperties() {
  const { tenant } = useTenant();
  const { properties, loading } = useProperties();

  const activeProperties = properties.filter(p => p.status?.toLowerCase() === 'ativo' || p.status?.toLowerCase() === 'disponível' || !p.status);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-10 h-10 border-4 border-brand-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="pt-24 pb-20 bg-slate-50 min-h-screen">
      <div className="max-w-7xl mx-auto px-6">
        <div className="mb-12 text-center">
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">Nossos Imóveis</h1>
          <p className="text-lg text-slate-600 max-w-2xl mx-auto">
            Encontre o lugar perfeito para o seu próximo capítulo.
          </p>
        </div>

        {activeProperties.length === 0 ? (
          <p className="text-center text-slate-500 py-20">Nenhum imóvel disponível no momento.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {activeProperties.map(property => (
              <Link
                key={property.id}
                to={`/imovel/${property.slug || property.id}`}
                className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300"
              >
                <div className="aspect-[4/3] relative overflow-hidden">
                  <img
                    src={property.images?.[0] || 'https://via.placeholder.com/600x400'}
                    alt={property.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                  />
                  <div className="absolute top-4 right-4 bg-white/90 backdrop-blur-sm px-3 py-1 rounded-full text-sm font-bold text-slate-900 shadow-sm">
                    {property.transaction_type === 'venda' ? 'Venda' : 'Aluguel'}
                  </div>
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-1">{property.title}</h3>
                  <p className="text-slate-500 text-sm mb-4 flex items-center gap-1">
                    <MapPin size={16} /> {property.city}, {property.state}
                  </p>
                  <div className="flex items-center gap-4 text-slate-600 text-sm mb-6 pb-6 border-b border-slate-100">
                    <span className="flex items-center gap-1"><BedDouble size={16} /> {property.bedrooms}</span>
                    <span className="flex items-center gap-1"><Bath size={16} /> {property.bathrooms}</span>
                    <span className="flex items-center gap-1"><Maximize2 size={16} /> {property.area}m²</span>
                  </div>
                  <div className="text-2xl font-bold text-brand-600">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price)}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

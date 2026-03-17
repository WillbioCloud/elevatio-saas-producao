import React from 'react';
import { Link } from 'react-router-dom';
import { Bed, Bath, Car, Maximize, MapPin, ArrowRight } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { useProperties } from '../../../hooks/useProperties';

const fmt = (n: number) =>
  n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export function FeaturedProperties() {
  const { tenant } = useTenant();
  const { properties, loading } = useProperties();
  const siteData = tenant?.site_data as any;
  const primaryColor = siteData?.primary_color || '#b08d5e';

  const featured = properties
    .filter(p => p.status?.toLowerCase() === 'ativo' || p.status?.toLowerCase() === 'disponível' || !p.status)
    .slice(0, 6);

  return (
    <section id="imoveis" className="py-24 bg-[#111]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-16">
          <div>
            <div className="flex items-center gap-4 mb-4">
              <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
              <p className="text-xs tracking-[0.4em] uppercase font-medium" style={{ color: primaryColor }}>Portfólio</p>
            </div>
            <h2 className="font-serif text-3xl sm:text-4xl text-white font-bold">Imóveis em Destaque</h2>
          </div>
          <Link
            to="/imoveis"
            className="flex items-center gap-2 text-sm font-medium transition-colors hover:opacity-80 flex-shrink-0"
            style={{ color: primaryColor }}
          >
            Ver todos os imóveis <ArrowRight size={16} />
          </Link>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="rounded-2xl overflow-hidden border border-white/8 animate-pulse" style={{ background: 'rgba(255,255,255,0.02)' }}>
                <div className="aspect-[4/3] bg-white/5" />
                <div className="p-5 space-y-3">
                  <div className="h-4 bg-white/5 rounded w-3/4" />
                  <div className="h-3 bg-white/5 rounded w-1/2" />
                  <div className="h-6 bg-white/5 rounded w-1/3 mt-4" />
                </div>
              </div>
            ))}
          </div>
        ) : featured.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-white/30 text-lg">Nenhum imóvel disponível no momento.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {featured.map((property) => {
              const image = property.images?.[0] || 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?q=80&w=800&auto=format&fit=crop';
              const city = property.location?.city || property.city || '';
              const neighborhood = property.location?.neighborhood || property.neighborhood || '';
              const location = [neighborhood, city].filter(Boolean).join(', ');
              const isRent = property.listing_type === 'rent';

              return (
                <div
                  key={property.id}
                  className="rounded-2xl overflow-hidden border border-white/8 group hover:border-white/20 transition-all duration-300"
                  style={{ background: 'rgba(255,255,255,0.02)' }}
                >
                  {/* Imagem */}
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <img
                      src={image}
                      alt={property.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute top-4 left-4 flex gap-2">
                      <span
                        className="px-3 py-1 rounded-full text-xs font-bold"
                        style={{ backgroundColor: primaryColor, color: '#0e0e0e' }}
                      >
                        {isRent ? 'Aluguel' : 'Venda'}
                      </span>
                      {property.type && (
                        <span className="px-3 py-1 rounded-full text-xs font-bold bg-black/60 text-white/80 backdrop-blur-sm">
                          {property.type}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-5">
                    <h3 className="font-serif text-white font-semibold text-lg mb-1 line-clamp-1">
                      {property.title}
                    </h3>
                    {location && (
                      <div className="flex items-center gap-1.5 text-white/40 text-sm mb-4">
                        <MapPin size={13} />
                        <span className="line-clamp-1">{location}</span>
                      </div>
                    )}

                    {/* Specs */}
                    <div className="flex items-center gap-4 text-white/40 text-xs mb-5 border-t border-white/8 pt-4">
                      {property.bedrooms > 0 && (
                        <span className="flex items-center gap-1.5"><Bed size={13} /> {property.bedrooms}</span>
                      )}
                      {property.bathrooms > 0 && (
                        <span className="flex items-center gap-1.5"><Bath size={13} /> {property.bathrooms}</span>
                      )}
                      {property.garage > 0 && (
                        <span className="flex items-center gap-1.5"><Car size={13} /> {property.garage}</span>
                      )}
                      {property.area > 0 && (
                        <span className="flex items-center gap-1.5"><Maximize size={13} /> {property.area}m²</span>
                      )}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-white/30 text-xs mb-0.5">{isRent ? 'Aluguel mensal' : 'Valor'}</p>
                        <p className="font-serif text-xl font-bold" style={{ color: primaryColor }}>
                          {fmt(property.price)}
                          {isRent && <span className="text-sm font-normal text-white/30">/mês</span>}
                        </p>
                      </div>
                      <Link
                        to={`/imovel/${property.slug || property.id}`}
                        className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider px-4 py-2.5 rounded-xl border transition-all duration-300 hover:opacity-80"
                        style={{ borderColor: primaryColor + '40', color: primaryColor }}
                      >
                        Ver Detalhes <ArrowRight size={13} />
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </section>
  );
}

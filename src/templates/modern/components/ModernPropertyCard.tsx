import React from 'react';
import { Link } from 'react-router-dom';

export interface ModernProperty {
  id: string;
  title: string;
  slug: string;
  price: number;
  type: string;
  listing_type: 'sale' | 'rent';
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

interface ModernPropertyCardProps {
  property: ModernProperty;
  primaryColor?: string;
  index?: number;
}

const BADGE: Record<string, { bg: string; color: string; label: string }> = {
  sale:  { bg: '#dcfce7', color: '#15803d', label: 'Venda' },
  rent:  { bg: '#dbeafe', color: '#1d4ed8', label: 'Aluguel' },
};

const fmt = (n: number) => n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

export default function ModernPropertyCard({ property, primaryColor = '#16a34a', index = 0 }: ModernPropertyCardProps) {
  const img   = property.images?.[0];
  const badge = BADGE[property.listing_type] ?? { bg: '#fef3c7', color: '#b45309', label: 'Investimento' };

  return (
    <>
      <style>{`
        .mn-card-${property.id} {
          display: block; text-decoration: none; color: inherit;
          background: #fff; border-radius: 18px; overflow: hidden;
          border: 1.5px solid #f1f5f9;
          transition: box-shadow 0.25s, transform 0.25s;
          animation: mn-card-in 0.45s ease ${index * 0.07}s both;
        }
        .mn-card-${property.id}:hover {
          box-shadow: 0 16px 48px rgba(0,0,0,0.1);
          transform: translateY(-4px);
        }
        .mn-card-${property.id}:hover .mn-card-img-${property.id} {
          transform: scale(1.06);
        }
        @keyframes mn-card-in {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Link to={`/imoveis/${property.slug || property.id}`} className={`mn-card-${property.id}`}>
        {/* ── Imagem ── */}
        <div style={{ position: 'relative', height: 224, overflow: 'hidden', background: '#f1f5f9' }}>
          {img ? (
            <img
              src={img}
              alt={property.title}
              className={`mn-card-img-${property.id}`}
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', transition: 'transform 0.55s ease' }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <svg width="52" height="52" viewBox="0 0 24 24" fill="#cbd5e1">
                <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
              </svg>
            </div>
          )}

          {/* Badge tipo */}
          <span style={{
            position: 'absolute', top: 14, left: 14,
            padding: '5px 12px', borderRadius: 100,
            background: badge.bg, color: badge.color,
            fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
            letterSpacing: '0.02em',
          }}>{badge.label}</span>

          {/* Badge destaque */}
          {property.featured && (
            <span style={{
              position: 'absolute', top: 14, right: 14,
              padding: '5px 12px', borderRadius: 100,
              background: '#fef9c3', color: '#854d0e',
              fontSize: 12, fontWeight: 700, fontFamily: "'Plus Jakarta Sans', sans-serif",
            }}>Destaque</span>
          )}
        </div>

        {/* ── Info ── */}
        <div style={{ padding: '20px 20px 22px' }}>
          {/* Localização */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 5 }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="#94a3b8">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 119.5 9a2.5 2.5 0 012.5 2.5z"/>
            </svg>
            <span style={{ fontSize: 12, color: '#94a3b8', fontFamily: "'Plus Jakarta Sans', sans-serif", fontWeight: 500 }}>
              {[property.neighborhood, property.city].filter(Boolean).join(', ')}
            </span>
          </div>

          {/* Título */}
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 14, lineHeight: 1.35, letterSpacing: '-0.2px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
            {property.title}
          </h3>

          {/* Preço */}
          <div style={{ marginBottom: 16 }}>
            <span style={{ fontSize: 21, fontWeight: 800, color: primaryColor, letterSpacing: '-0.5px', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>
              {fmt(property.price)}
            </span>
            {property.listing_type === 'rent' && (
              <span style={{ fontSize: 13, color: '#94a3b8', fontWeight: 500, marginLeft: 3 }}>/mês</span>
            )}
          </div>

          {/* Divider */}
          <div style={{ height: 1, background: '#f1f5f9', marginBottom: 14 }} />

          {/* Specs */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14 }}>
            {property.bedrooms > 0 && (
              <Spec icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="#94a3b8"><path d="M20 9.556V3h-2v2H6V3H4v6.557C2.81 10.25 2 11.526 2 13v4h1l1 4h1l1-4h12l1 4h1l1-4h1v-4c0-1.474-.811-2.75-2-3.444zM11 9H6V7h5v2zm7 0h-5V7h5v2z"/></svg>} label={`${property.bedrooms} Quartos`} />
            )}
            {property.bathrooms > 0 && (
              <Spec icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="#94a3b8"><path d="M7 12c2.21 0 4-1.79 4-4S9.21 4 7 4 3 5.79 3 8s1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm14 2h-9.83c.53.78 1.04 1.59 1.52 2H21v6H3v-3.42c-.6-.7-1.13-1.42-1.6-2.15L1 11v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V9c0-.55-.45-1-1-1z"/></svg>} label={`${property.bathrooms} Banhos`} />
            )}
            {property.area > 0 && (
              <Spec icon={<svg width="13" height="13" viewBox="0 0 24 24" fill="#94a3b8"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>} label={`${property.area} m²`} />
            )}
          </div>
        </div>
      </Link>
    </>
  );
}

const Spec: React.FC<{ icon: React.ReactNode; label: string }> = ({ icon, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
    {icon}
    <span style={{ fontSize: 13, fontWeight: 600, color: '#374151', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
  </div>
);

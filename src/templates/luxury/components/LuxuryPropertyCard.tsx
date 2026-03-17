import React from 'react';
import { Link } from 'react-router-dom';

export interface LuxuryProperty {
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

interface LuxuryPropertyCardProps {
  property: LuxuryProperty;
  index?: number;
  variant?: 'default' | 'featured'; // featured = card maior para destaque
}

const formatPrice = (price: number, listingType: 'sale' | 'rent') => {
  const formatted = price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return listingType === 'rent' ? `${formatted}/mês` : formatted;
};

export default function LuxuryPropertyCard({ property, index = 0, variant = 'default' }: LuxuryPropertyCardProps) {
  const img = property.images?.[0];
  const isFeatured = variant === 'featured';

  return (
    <>
      <style>{`
        .lx-card-${property.id} { display: block; text-decoration: none; color: inherit; }
        .lx-card-${property.id}:hover .lx-card-img { transform: scale(1.04); }
        .lx-card-${property.id}:hover .lx-card-arrow { opacity: 1; transform: translateX(0); }
        @keyframes lx-card-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <Link
        to={`/imoveis/${property.slug || property.id}`}
        className={`lx-card-${property.id}`}
        style={{ animation: `lx-card-in 0.5s ease ${index * 0.08}s both` }}
      >
        {/* Imagem */}
        <div style={{
          position: 'relative', overflow: 'hidden', borderRadius: 20,
          aspectRatio: isFeatured ? '16/10' : '4/3',
          background: '#161616', marginBottom: 20,
        }}>
          {img ? (
            <img
              src={img}
              alt={property.title}
              className="lx-card-img"
              style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'transform 0.6s ease', display: 'block' }}
            />
          ) : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#161616' }}>
              <svg width="48" height="48" viewBox="0 0 48 48" fill="none" opacity="0.15">
                <path d="M6 18l18-14 18 14v26a4 4 0 01-4 4H10a4 4 0 01-4-4V18z" stroke="white" strokeWidth="2"/>
                <rect x="17" y="30" width="14" height="18" rx="2" stroke="white" strokeWidth="2"/>
              </svg>
            </div>
          )}

          {/* Badges */}
          <div style={{ position: 'absolute', top: 14, left: 14, display: 'flex', gap: 6 }}>
            {property.featured && (
              <span style={{ padding: '4px 10px', borderRadius: 100, background: '#fff', color: '#0e0e0e', fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Destaque
              </span>
            )}
            <span style={{ padding: '4px 10px', borderRadius: 100, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(8px)', color: 'rgba(255,255,255,0.8)', fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 600, letterSpacing: '0.04em', border: '1px solid rgba(255,255,255,0.1)' }}>
              {property.listing_type === 'rent' ? 'Aluguel' : 'Venda'}
            </span>
          </div>

          {/* Preço sobreposto */}
          <div style={{ position: 'absolute', bottom: 14, left: 14 }}>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: isFeatured ? 22 : 18, fontWeight: 700, color: '#fff', letterSpacing: '-0.02em', textShadow: '0 1px 12px rgba(0,0,0,0.8)' }}>
              {formatPrice(property.price, property.listing_type)}
            </div>
          </div>

          {/* Arrow hover */}
          <div
            className="lx-card-arrow"
            style={{ position: 'absolute', bottom: 14, right: 14, width: 38, height: 38, borderRadius: '50%', background: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', opacity: 0, transform: 'translateX(8px)', transition: 'all 0.3s ease' }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M2 7h10M7 2l5 5-5 5" stroke="#0e0e0e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Conteúdo */}
        <div>
          <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: isFeatured ? 20 : 17, fontWeight: 600, color: '#fff', marginBottom: 8, lineHeight: 1.3, letterSpacing: '-0.01em' }}>
            {property.title}
          </h3>

          {/* Localização */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 14 }}>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
            </svg>
            <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>
              {property.neighborhood}{property.neighborhood && property.city ? ', ' : ''}{property.city}
            </span>
          </div>

          {/* Specs */}
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {property.bedrooms > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                  <path d="M20 9.556V3h-2v2H6V3H4v6.557C2.81 10.25 2 11.526 2 13v4h1l1 4h1l1-4h12l1 4h1l1-4h1v-4c0-1.474-.811-2.75-2-3.444zM11 9H6V7h5v2zm7 0h-5V7h5v2z"/>
                </svg>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{property.bedrooms} quartos</span>
              </div>
            )}
            {property.area > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{property.area} m²</span>
              </div>
            )}
            {property.garage > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="rgba(255,255,255,0.25)">
                  <path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>
                </svg>
                <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>{property.garage} vagas</span>
              </div>
            )}
          </div>
        </div>
      </Link>
    </>
  );
}

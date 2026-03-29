import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';

// ─── Tipo completo da propriedade ─────────────────────────────
interface FullProperty {
  id: string;
  title: string;
  slug: string;
  description: string;
  price: number;
  type: string;
  listing_type: 'sale' | 'rent';
  bedrooms: number;
  bathrooms: number;
  suites: number;
  area: number;
  built_area: number;
  garage: number;
  city: string;
  neighborhood: string;
  state: string;
  address: string;
  zip_code: string;
  features: string[];
  images: string[];
  featured: boolean;
  status: string;
  iptu: number;
  condominium: number;
  financing_available: boolean;
  down_payment: number;
  latitude: number;
  longitude: number;
  video_url: string;
  seo_title: string;
  seo_description: string;
}

const formatPrice = (price: number, listingType: 'sale' | 'rent') => {
  const formatted = price?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });
  return listingType === 'rent' ? `${formatted}/mês` : formatted;
};

// ─── Spec item ────────────────────────────────────────────────
const SpecItem: React.FC<{ icon: React.ReactNode; label: string; value: string }> = ({ icon, label, value }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '20px 24px', borderRadius: 16, background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
    <div style={{ color: 'rgba(255,255,255,0.3)' }}>{icon}</div>
    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff' }}>{value}</div>
    <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', fontWeight: 600 }}>{label}</div>
  </div>
);

// ─── MAIN ─────────────────────────────────────────────────────
export default function LuxuryPropertyDetail() {
  const { id, slug } = useParams<{ id: string; slug: string }>();
  const identifier = slug || id;
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [property, setProperty] = useState<FullProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [leadForm, setLeadForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const galleryRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!identifier || !tenant?.id) return;
    setLoading(true);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    let query = supabase.from('properties').select('*').eq('company_id', tenant.id);
    if (isUuid) {
      query = query.eq('id', identifier);
    } else {
      query = query.eq('slug', identifier);
    }
    query.single().then(({ data, error }) => {
      if (error || !data) { console.error('Erro ao buscar imóvel:', error); navigate('/imoveis'); return; }
      setProperty(data as FullProperty);
      setLoading(false);
    });
  }, [identifier, tenant?.id]);

  // Keyboard navigation no lightbox
  useEffect(() => {
    if (!lightboxOpen || !property) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLightboxIdx(i => (i + 1) % property.images.length);
      if (e.key === 'ArrowLeft') setLightboxIdx(i => (i - 1 + property.images.length) % property.images.length);
      if (e.key === 'Escape') setLightboxOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [lightboxOpen, property]);

  const openLightbox = (idx: number) => { setLightboxIdx(idx); setLightboxOpen(true); };

  const handleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !tenant?.id) return;
    setSending(true);
    await supabase.from('leads').insert([{
      name: leadForm.name,
      phone: leadForm.phone,
      message: leadForm.message || `Interesse no imóvel: ${property.title}`,
      property_id: property.id,
      source: 'Site',
      company_id: tenant.id,
    }]);
    setSending(false);
    setSent(true);
  };

  const siteData = (tenant?.site_data as any) || {};
  const whatsapp = siteData.social?.whatsapp || siteData.contact?.phone || '';
  const whatsappMsg = property
    ? encodeURIComponent(`Olá! Tenho interesse no imóvel: ${property.title} — ${window.location.href}`)
    : '';

  if (loading) return (
    <div style={{ background: '#0e0e0e', minHeight: '100vh', paddingTop: 72, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <style>{`@keyframes lx-spin { to { transform: rotate(360deg); } }`}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', animation: 'lx-spin 0.8s linear infinite' }} />
    </div>
  );

  if (!property) return null;

  const hasImages = property.images?.length > 0;
  const specs = [
    ...(property.bedrooms > 0 ? [{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M20 9.556V3h-2v2H6V3H4v6.557C2.81 10.25 2 11.526 2 13v4h1l1 4h1l1-4h12l1 4h1l1-4h1v-4c0-1.474-.811-2.75-2-3.444zM11 9H6V7h5v2zm7 0h-5V7h5v2z"/></svg>, label: 'Quartos', value: `${property.bedrooms}` }] : []),
    ...(property.suites > 0 ? [{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14c1.66 0 3-1.34 3-3S8.66 8 7 8s-3 1.34-3 3 1.34 3 3 3zm12-3c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3zm-10.5 3h-3C3.67 14 2 15.67 2 17.5V19h10v-1.5c0-1.83-1.67-3.5-3.5-3.5zm10 0h-3c-1.83 0-3.5 1.67-3.5 3.5V19h10v-1.5c0-1.83-1.67-3.5-3.5-3.5z"/></svg>, label: 'Suítes', value: `${property.suites}` }] : []),
    ...(property.bathrooms > 0 ? [{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M7 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm14 2h-9.83c.53.78 1.04 1.59 1.52 2H21v6H3v-3.42c-.6-.7-1.13-1.42-1.6-2.15L1 11v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V9c0-.55-.45-1-1-1z"/></svg>, label: 'Banheiros', value: `${property.bathrooms}` }] : []),
    ...(property.area > 0 ? [{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, label: 'Área total', value: `${property.area} m²` }] : []),
    ...(property.built_area > 0 ? [{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18 15H6v-2h12v2zm0-4H6V9h12v2zm0-4H6V5h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z"/></svg>, label: 'Área construída', value: `${property.built_area} m²` }] : []),
    ...(property.garage > 0 ? [{ icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>, label: 'Vagas', value: `${property.garage}` }] : []),
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .lx-detail-root { font-family: 'DM Sans', sans-serif; background: #0e0e0e; }
        .lx-thumb { cursor: pointer; border-radius: 12px; overflow: hidden; aspect-ratio: 4/3; transition: opacity 0.2s, outline 0.15s; }
        .lx-thumb:hover { opacity: 0.8; }
        .lx-thumb.active { outline: 2px solid #fff; outline-offset: 2px; }
        .lx-feature-tag { display: inline-flex; align-items: center; gap: 6px; padding: 7px 14px; borderRadius: 100px; background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); fontFamily: 'DM Sans', sans-serif; fontSize: 13px; color: rgba(255,255,255,0.55); }
        .lx-input-field { width: 100%; background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; padding: 12px 16px; font-family: 'DM Sans', sans-serif; font-size: 14px; color: #fff; outline: none; transition: border-color 0.18s; }
        .lx-input-field:focus { border-color: rgba(255,255,255,0.3); }
        .lx-input-field::placeholder { color: rgba(255,255,255,0.2); }
        @media (max-width: 1024px) { .lx-detail-layout { grid-template-columns: 1fr !important; } }
        @media (max-width: 600px) { .lx-specs-grid { grid-template-columns: repeat(2, 1fr) !important; } }
      `}</style>

      <div className="lx-detail-root" style={{ paddingTop: 72 }}>

        {/* Breadcrumb */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '20px clamp(24px,4vw,48px)' }}>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>
            <Link to="/" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => (e.target as HTMLElement).style.color='#fff'} onMouseLeave={e => (e.target as HTMLElement).style.color='rgba(255,255,255,0.3)'}>Início</Link>
            <span>/</span>
            <Link to="/imoveis" style={{ color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.15s' }} onMouseEnter={e => (e.target as HTMLElement).style.color='#fff'} onMouseLeave={e => (e.target as HTMLElement).style.color='rgba(255,255,255,0.3)'}>Imóveis</Link>
            <span>/</span>
            <span style={{ color: 'rgba(255,255,255,0.6)' }}>{property.title}</span>
          </div>
        </div>

        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 clamp(24px,4vw,48px) 80px' }}>

          {/* ── GALERIA PRINCIPAL ── */}
          <div style={{ display: 'grid', gridTemplateColumns: hasImages && property.images.length > 1 ? '1fr 240px' : '1fr', gap: 12, marginBottom: 48, height: 520 }}>
            {/* Imagem principal */}
            <div
              style={{ borderRadius: 24, overflow: 'hidden', background: '#161616', cursor: hasImages ? 'pointer' : 'default', position: 'relative', height: '100%' }}
              onClick={() => hasImages && openLightbox(activeImg)}
            >
              {hasImages ? (
                <img
                  src={property.images[activeImg]}
                  alt={property.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.3s' }}
                />
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="rgba(255,255,255,0.07)">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                </div>
              )}
              {hasImages && (
                <div style={{ position: 'absolute', bottom: 16, right: 16, padding: '6px 14px', borderRadius: 100, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, color: '#fff', border: '1px solid rgba(255,255,255,0.1)' }}>
                  {activeImg + 1} / {property.images.length}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {hasImages && property.images.length > 1 && (
              <div ref={galleryRef} style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto', paddingRight: 4 }}>
                {property.images.map((img, i) => (
                  <div
                    key={i}
                    className={`lx-thumb ${i === activeImg ? 'active' : ''}`}
                    onClick={() => setActiveImg(i)}
                    style={{ flexShrink: 0 }}
                  >
                    <img src={img} alt={`${i + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── LAYOUT PRINCIPAL: info esq + CTA dir ── */}
          <div className="lx-detail-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 380px', gap: 48, alignItems: 'start' }}>

            {/* ── COLUNA ESQUERDA ── */}
            <div>
              {/* Header */}
              <div style={{ marginBottom: 40 }}>
                <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
                  <span style={{ padding: '5px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.08)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    {property.type}
                  </span>
                  <span style={{ padding: '5px 12px', borderRadius: 100, background: property.listing_type === 'rent' ? 'rgba(14,165,233,0.12)' : 'rgba(52,211,153,0.12)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 700, color: property.listing_type === 'rent' ? '#7dd3fc' : '#6ee7b7', letterSpacing: '0.07em', textTransform: 'uppercase' }}>
                    {property.listing_type === 'rent' ? 'Aluguel' : 'Venda'}
                  </span>
                </div>

                <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff', lineHeight: 1.1, marginBottom: 14 }}>
                  {property.title}
                </h1>

                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)">
                    <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5S10.62 6.5 12 6.5s2.5 1.12 2.5 2.5S13.38 11.5 12 11.5z"/>
                  </svg>
                  <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
                    {[property.neighborhood, property.city, property.state].filter(Boolean).join(', ')}
                  </span>
                </div>
              </div>

              {/* Specs grid */}
              {specs.length > 0 && (
                <div className="lx-specs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 40 }}>
                  {specs.map((s, i) => <SpecItem key={i} {...s} />)}
                </div>
              )}

              {/* Descrição */}
              {property.description && (
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: '-0.01em' }}>
                    Sobre o imóvel
                  </h2>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.9, whiteSpace: 'pre-line' }}>
                    {property.description}
                  </p>
                </div>
              )}

              {/* Características */}
              {property.features?.length > 0 && (
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: '-0.01em' }}>
                    Diferenciais
                  </h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {property.features.map((feat, i) => (
                      <span key={i} className="lx-feature-tag">
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="rgba(255,255,255,0.4)">
                          <path d="M1 5l3 3 5-7" stroke="rgba(255,255,255,0.4)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                        </svg>
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Custos adicionais */}
              {(property.iptu > 0 || property.condominium > 0) && (
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: '-0.01em' }}>
                    Custos adicionais
                  </h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {property.iptu > 0 && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>IPTU</div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
                          {property.iptu.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/ano
                        </div>
                      </div>
                    )}
                    {property.condominium > 0 && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: '#161616', border: '1px solid rgba(255,255,255,0.06)' }}>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Condomínio</div>
                        <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff' }}>
                          {property.condominium.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })}/mês
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mapa */}
              {property.latitude && property.longitude && (
                <div style={{ marginBottom: 40 }}>
                  <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16, letterSpacing: '-0.01em' }}>
                    Localização
                  </h2>
                  <div style={{ borderRadius: 20, overflow: 'hidden', height: 300, background: '#161616' }}>
                    <iframe
                      src={`https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`}
                      width="100%" height="100%"
                      style={{ border: 'none', filter: 'invert(90%) hue-rotate(180deg)' }}
                      loading="lazy"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* ── COLUNA DIREITA: sticky CTA ── */}
            <div style={{ position: 'sticky', top: 96 }}>

              {/* Preço */}
              <div style={{ padding: '28px', borderRadius: 24, background: '#111', border: '1px solid rgba(255,255,255,0.08)', marginBottom: 16 }}>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  {property.listing_type === 'rent' ? 'Valor mensal' : 'Valor de venda'}
                </div>
                <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1, marginBottom: property.down_payment ? 12 : 0 }}>
                  {formatPrice(property.price, property.listing_type)}
                </div>
                {property.financing_available && property.down_payment > 0 && (
                  <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)', marginTop: 8 }}>
                    Entrada a partir de {property.down_payment.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 })} • Financiamento disponível
                  </div>
                )}
              </div>

              {/* Formulário de Lead */}
              {sent ? (
                <div style={{ padding: '28px', borderRadius: 24, background: '#111', border: '1px solid rgba(52,211,153,0.2)', textAlign: 'center' }}>
                  <div style={{ fontSize: 32, marginBottom: 12 }}>✓</div>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>Mensagem enviada!</h3>
                  <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.7 }}>
                    Em breve um de nossos especialistas entrará em contato.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleLead} style={{ padding: '28px', borderRadius: 24, background: '#111', border: '1px solid rgba(255,255,255,0.08)' }}>
                  <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, fontWeight: 700, color: '#fff', marginBottom: 20 }}>
                    Tenho interesse
                  </h3>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    <input
                      className="lx-input-field"
                      placeholder="Seu nome"
                      value={leadForm.name}
                      onChange={e => setLeadForm(p => ({ ...p, name: e.target.value }))}
                      required
                    />
                    <input
                      className="lx-input-field"
                      placeholder="WhatsApp / Telefone"
                      value={leadForm.phone}
                      onChange={e => setLeadForm(p => ({ ...p, phone: e.target.value }))}
                      required
                    />
                    <textarea
                      className="lx-input-field"
                      placeholder="Mensagem (opcional)"
                      value={leadForm.message}
                      onChange={e => setLeadForm(p => ({ ...p, message: e.target.value }))}
                      rows={3}
                      style={{ resize: 'none' }}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={sending}
                    style={{ width: '100%', padding: '14px 0', borderRadius: 12, background: '#fff', color: '#0e0e0e', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, border: 'none', cursor: sending ? 'wait' : 'pointer', transition: 'opacity 0.18s', opacity: sending ? 0.7 : 1, marginBottom: 10 }}
                  >
                    {sending ? 'Enviando...' : 'Solicitar informações'}
                  </button>

                  {whatsapp && (
                    <a
                      href={`https://wa.me/${whatsapp.replace(/\D/g, '')}?text=${whatsappMsg}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', padding: '13px 0', borderRadius: 12, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#4ade80', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none', transition: 'all 0.18s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.18)'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'rgba(37,211,102,0.1)'; }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#4ade80">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
                      </svg>
                      Conversar no WhatsApp
                    </a>
                  )}
                </form>
              )}

              {/* Link voltar */}
              <Link
                to="/imoveis"
                style={{ display: 'block', textAlign: 'center', marginTop: 16, fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none', transition: 'color 0.15s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color='rgba(255,255,255,0.6)'}
                onMouseLeave={e => (e.target as HTMLElement).style.color='rgba(255,255,255,0.3)'}
              >
                ← Ver todos os imóveis
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* ── LIGHTBOX ── */}
      {lightboxOpen && property.images?.length > 0 && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.95)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightboxOpen(false)}
        >
          <button
            onClick={() => setLightboxOpen(false)}
            style={{ position: 'absolute', top: 24, right: 24, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 44, height: 44, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >×</button>

          <button
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + property.images.length) % property.images.length); }}
            style={{ position: 'absolute', left: 24, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >←</button>

          <img
            src={property.images[lightboxIdx]}
            alt=""
            style={{ maxWidth: '90vw', maxHeight: '90vh', objectFit: 'contain', borderRadius: 8 }}
            onClick={e => e.stopPropagation()}
          />

          <button
            onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % property.images.length); }}
            style={{ position: 'absolute', right: 24, background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', width: 48, height: 48, borderRadius: '50%', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >→</button>

          <div style={{ position: 'absolute', bottom: 24, fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.4)' }}>
            {lightboxIdx + 1} / {property.images.length}
          </div>
        </div>
      )}
    </>
  );
}

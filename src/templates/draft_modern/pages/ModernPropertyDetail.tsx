import React, { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';

interface FullProperty {
  id: string; title: string; slug: string;
  description: string; price: number;
  type: string; listing_type: 'sale' | 'rent';
  bedrooms: number; bathrooms: number; suites: number;
  area: number; built_area: number; garage: number;
  city: string; neighborhood: string; state: string; address: string;
  features: string[]; images: string[];
  status: string; iptu: number; condominium: number;
  financing_available: boolean; down_payment: number;
  latitude: number; longitude: number;
}

const fmt = (n: number) => n?.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 });

const SpecCard: React.FC<{ icon: React.ReactNode; value: string; label: string; primary: string }> = ({ icon, value, label, primary }) => (
  <div style={{ padding: '18px 20px', borderRadius: 14, background: '#f8fafc', border: '1.5px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 6 }}>
    <div style={{ color: primary }}>{icon}</div>
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 20, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em' }}>{value}</div>
    <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em' }}>{label}</div>
  </div>
);

export default function ModernPropertyDetail() {
  const { slug } = useParams<{ slug: string }>();
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const siteData = (tenant?.site_data as any) || {};
  const primary = siteData.primary_color || '#16a34a';

  const [property, setProperty] = useState<FullProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImg, setActiveImg] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState(0);
  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!slug || !tenant?.id) return;
    setLoading(true);
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);
    let query = supabase.from('properties').select('*').eq('company_id', tenant.id);
    if (isUuid) {
      query = query.eq('id', slug);
    } else {
      query = query.eq('slug', slug);
    }
    query.single().then(({ data, error }) => {
      if (error || !data) { console.error('Erro ao buscar imóvel:', error); navigate('/imoveis'); return; }
      setProperty(data as FullProperty);
      setLoading(false);
    });
  }, [slug, tenant?.id]);

  useEffect(() => {
    if (!lightboxOpen || !property) return;
    const fn = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setLightboxIdx(i => (i + 1) % property.images.length);
      if (e.key === 'ArrowLeft')  setLightboxIdx(i => (i - 1 + property.images.length) % property.images.length);
      if (e.key === 'Escape')     setLightboxOpen(false);
    };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [lightboxOpen, property]);

  const handleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!property || !tenant?.id) return;
    setSending(true);
    await supabase.from('leads').insert([{ name: form.name, phone: form.phone, message: form.message || `Interesse no imóvel: ${property.title}`, property_id: property.id, source: 'Site', company_id: tenant.id }]);
    setSending(false);
    setSent(true);
  };

  const whatsapp = siteData.social?.whatsapp || siteData.contact?.phone || '';
  const wMsg = property ? encodeURIComponent(`Olá! Tenho interesse no imóvel: ${property.title} — ${window.location.href}`) : '';

  if (loading) return (
    <div style={{ minHeight: '80vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#fff' }}>
      <style>{`@keyframes mn-spin { to { transform:rotate(360deg); } }`}</style>
      <div style={{ width: 32, height: 32, borderRadius: '50%', border: `2px solid ${primary}30`, borderTopColor: primary, animation: 'mn-spin 0.8s linear infinite' }} />
    </div>
  );

  if (!property) return null;

  const hasImages = property.images?.length > 0;
  const BADGE: Record<string, { bg: string; color: string; label: string }> = {
    sale: { bg: '#dcfce7', color: '#15803d', label: 'Venda' },
    rent: { bg: '#dbeafe', color: '#1d4ed8', label: 'Aluguel' },
  };
  const badge = BADGE[property.listing_type] ?? { bg: '#fef3c7', color: '#b45309', label: 'Investimento' };

  const specs = [
    ...(property.bedrooms  > 0 ? [{ icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M20 9.556V3h-2v2H6V3H4v6.557C2.81 10.25 2 11.526 2 13v4h1l1 4h1l1-4h12l1 4h1l1-4h1v-4c0-1.474-.811-2.75-2-3.444zM11 9H6V7h5v2zm7 0h-5V7h5v2z"/></svg>, value: `${property.bedrooms}`, label: 'Quartos' }] : []),
    ...(property.suites    > 0 ? [{ icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 14c1.66 0 3-1.34 3-3S8.66 8 7 8s-3 1.34-3 3 1.34 3 3 3zm12-3c0-1.66-1.34-3-3-3s-3 1.34-3 3 1.34 3 3 3 3-1.34 3-3zm-10.5 3h-3C3.67 14 2 15.67 2 17.5V19h10v-1.5c0-1.83-1.67-3.5-3.5-3.5zm10 0h-3c-1.83 0-3.5 1.67-3.5 3.5V19h10v-1.5c0-1.83-1.67-3.5-3.5-3.5z"/></svg>, value: `${property.suites}`, label: 'Suítes' }] : []),
    ...(property.bathrooms > 0 ? [{ icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M7 12c2.21 0 4-1.79 4-4S9.21 4 7 4 3 5.79 3 8s1.79 4 4 4zm0-6c1.1 0 2 .9 2 2s-.9 2-2 2-2-.9-2-2 .9-2 2-2zm14 2h-9.83c.53.78 1.04 1.59 1.52 2H21v6H3v-3.42c-.6-.7-1.13-1.42-1.6-2.15L1 11v8c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V9c0-.55-.45-1-1-1z"/></svg>, value: `${property.bathrooms}`, label: 'Banheiros' }] : []),
    ...(property.area      > 0 ? [{ icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>, value: `${property.area} m²`, label: 'Área Total' }] : []),
    ...(property.built_area > 0 ? [{ icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18 15H6v-2h12v2zm0-4H6V9h12v2zm0-4H6V5h12v2zM3 22l1.5-1.5L6 22l1.5-1.5L9 22l1.5-1.5L12 22l1.5-1.5L15 22l1.5-1.5L18 22l1.5-1.5L21 22V2l-1.5 1.5L18 2l-1.5 1.5L15 2l-1.5 1.5L12 2l-1.5 1.5L9 2 7.5 3.5 6 2 4.5 3.5 3 2v20z"/></svg>, value: `${property.built_area} m²`, label: 'Área Construída' }] : []),
    ...(property.garage    > 0 ? [{ icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/></svg>, value: `${property.garage}`, label: 'Vagas' }] : []),
  ];

  return (
    <>
      <style>{`
        @keyframes mn-fadein { from { opacity:0; transform:translateY(14px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mn-spin   { to { transform:rotate(360deg); } }
        .mn-thumb { cursor:pointer; border-radius:10px; overflow:hidden; aspect-ratio:4/3; border:2px solid transparent; transition:all 0.15s; flex-shrink:0; }
        .mn-thumb:hover { opacity:0.8; }
        .mn-thumb.active { border-color: var(--mn-detail-primary); }
        .mn-form-input { width:100%; padding:11px 14px; border-radius:10px; border:1.5px solid #e5e7eb; background:#fff; font-family:'Plus Jakarta Sans',sans-serif; font-size:14px; color:#0f172a; outline:none; transition:border-color 0.15s; }
        .mn-form-input:focus { border-color: var(--mn-detail-primary); }
        .mn-form-input::placeholder { color:#9ca3af; }
        @media (max-width:1024px) { .mn-detail-layout { grid-template-columns:1fr !important; } }
        @media (max-width:768px)  { .mn-gallery-grid { grid-template-columns:1fr !important; } .mn-specs-grid { grid-template-columns:repeat(2,1fr) !important; } }
      `}</style>
      <style>{`:root { --mn-detail-primary: ${primary}; }`}</style>

      <div style={{ background: '#fff', minHeight: '100vh' }}>

        {/* Breadcrumb */}
        <div style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9', padding: '14px clamp(20px,4vw,48px)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', gap: 8, alignItems: 'center', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: '#94a3b8' }}>
            {[{ to: '/', label: 'Início' }, { to: '/imoveis', label: 'Imóveis' }].map((b, i) => (
              <React.Fragment key={b.to}>
                <Link to={b.to} style={{ color: '#94a3b8', textDecoration: 'none', transition: 'color 0.13s' }} onMouseEnter={e => (e.target as HTMLElement).style.color='#0f172a'} onMouseLeave={e => (e.target as HTMLElement).style.color='#94a3b8'}>{b.label}</Link>
                <span>/</span>
              </React.Fragment>
            ))}
            <span style={{ color: '#374151', fontWeight: 600 }}>{property.title}</span>
          </div>
        </div>

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(28px,4vw,48px) clamp(20px,4vw,48px) 80px' }}>

          {/* ── GALERIA ── */}
          <div className="mn-gallery-grid" style={{ display: 'grid', gridTemplateColumns: hasImages && property.images.length > 1 ? '1fr 200px' : '1fr', gap: 12, marginBottom: 40, height: 480 }}>
            {/* Principal */}
            <div style={{ borderRadius: 20, overflow: 'hidden', background: '#f1f5f9', cursor: hasImages ? 'pointer' : 'default', position: 'relative', height: '100%' }}
              onClick={() => hasImages && (setLightboxIdx(activeImg), setLightboxOpen(true))}>
              {hasImages ? (
                <img src={property.images[activeImg]} alt={property.title} style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'opacity 0.25s', display: 'block' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="72" height="72" viewBox="0 0 24 24" fill="#cbd5e1"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                </div>
              )}
              {/* Badges */}
              <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 8 }}>
                <span style={{ padding: '5px 12px', borderRadius: 100, background: badge.bg, color: badge.color, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700 }}>{badge.label}</span>
                {property.financing_available && (
                  <span style={{ padding: '5px 12px', borderRadius: 100, background: '#fef9c3', color: '#854d0e', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700 }}>Financiável</span>
                )}
              </div>
              {hasImages && (
                <div style={{ position: 'absolute', bottom: 14, right: 14, padding: '5px 12px', borderRadius: 100, background: 'rgba(255,255,255,0.9)', backdropFilter: 'blur(6px)', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 600, color: '#374151', border: '1px solid rgba(0,0,0,0.08)' }}>
                  {activeImg + 1} / {property.images.length}
                </div>
              )}
            </div>

            {/* Thumbnails */}
            {hasImages && property.images.length > 1 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, overflowY: 'auto' }}>
                {property.images.map((img, i) => (
                  <div key={i} className={`mn-thumb ${i === activeImg ? 'active' : ''}`} onClick={() => setActiveImg(i)} style={{ minHeight: 72 }}>
                    <img src={img} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* ── LAYOUT: INFO + STICKY CTA ── */}
          <div className="mn-detail-layout" style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 48, alignItems: 'start' }}>

            {/* ── COLUNA ESQUERDA ── */}
            <div>
              {/* Header */}
              <div style={{ marginBottom: 36 }}>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ padding: '4px 12px', borderRadius: 100, background: '#f1f5f9', color: '#64748b', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{property.type}</span>
                </div>
                <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 'clamp(24px,4vw,40px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1.12, marginBottom: 12 }}>
                  {property.title}
                </h1>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="#94a3b8"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5A2.5 2.5 0 119.5 9a2.5 2.5 0 012.5 2.5z"/></svg>
                  <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: '#64748b' }}>
                    {[property.neighborhood, property.city, property.state].filter(Boolean).join(', ')}
                  </span>
                </div>
              </div>

              {/* Specs */}
              {specs.length > 0 && (
                <div className="mn-specs-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 36 }}>
                  {specs.map((s, i) => <SpecCard key={i} {...s} primary={primary} />)}
                </div>
              )}

              {/* Descrição */}
              {property.description && (
                <div style={{ marginBottom: 36 }}>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 14, letterSpacing: '-0.2px' }}>Sobre o Imóvel</h2>
                  <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, color: '#64748b', lineHeight: 1.9, whiteSpace: 'pre-line' }}>{property.description}</p>
                </div>
              )}

              {/* Características */}
              {property.features?.length > 0 && (
                <div style={{ marginBottom: 36 }}>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 14, letterSpacing: '-0.2px' }}>Diferenciais</h2>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {property.features.map((feat, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 100, background: `${primary}10`, border: `1px solid ${primary}22`, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: primary, fontWeight: 600 }}>
                        <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                          <path d="M1.5 5l2.5 2.5 5-6" stroke={primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                        {feat}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Custos adicionais */}
              {(property.iptu > 0 || property.condominium > 0) && (
                <div style={{ marginBottom: 36 }}>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 14, letterSpacing: '-0.2px' }}>Custos Adicionais</h2>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    {property.iptu > 0 && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: '#f8fafc', border: '1.5px solid #f1f5f9' }}>
                        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>IPTU</div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{fmt(property.iptu)}<span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>/ano</span></div>
                      </div>
                    )}
                    {property.condominium > 0 && (
                      <div style={{ padding: '16px 20px', borderRadius: 14, background: '#f8fafc', border: '1.5px solid #f1f5f9' }}>
                        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Condomínio</div>
                        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 17, fontWeight: 800, color: '#0f172a' }}>{fmt(property.condominium)}<span style={{ fontSize: 13, fontWeight: 500, color: '#94a3b8' }}>/mês</span></div>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Mapa */}
              {property.latitude && property.longitude && (
                <div style={{ marginBottom: 36 }}>
                  <h2 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 18, fontWeight: 700, color: '#0f172a', marginBottom: 14, letterSpacing: '-0.2px' }}>Localização</h2>
                  <div style={{ borderRadius: 18, overflow: 'hidden', height: 280, border: '1.5px solid #f1f5f9' }}>
                    <iframe src={`https://maps.google.com/maps?q=${property.latitude},${property.longitude}&z=15&output=embed`} width="100%" height="100%" style={{ border: 'none' }} loading="lazy" />
                  </div>
                </div>
              )}
            </div>

            {/* ── COLUNA DIREITA: sticky ── */}
            <div style={{ position: 'sticky', top: 84 }}>
              {/* Preço */}
              <div style={{ padding: '24px', borderRadius: 18, background: '#f8fafc', border: '1.5px solid #f1f5f9', marginBottom: 14 }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
                  {property.listing_type === 'rent' ? 'Valor mensal' : 'Valor de venda'}
                </div>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 'clamp(26px,3vw,34px)', fontWeight: 800, color: primary, letterSpacing: '-0.05em', lineHeight: 1 }}>
                  {fmt(property.price)}
                  {property.listing_type === 'rent' && <span style={{ fontSize: 15, fontWeight: 500, color: '#94a3b8' }}>/mês</span>}
                </div>
                {property.financing_available && property.down_payment > 0 && (
                  <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: '#64748b', marginTop: 10, lineHeight: 1.6 }}>
                    Entrada a partir de {fmt(property.down_payment)} · Financiamento disponível
                  </div>
                )}
              </div>

              {/* Formulário */}
              {sent ? (
                <div style={{ padding: '28px', borderRadius: 18, background: '#f0fdf4', border: '1.5px solid #bbf7d0', textAlign: 'center' }}>
                  <div style={{ fontSize: 36, marginBottom: 10 }}>✓</div>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 17, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Mensagem enviada!</h3>
                  <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>Em breve um especialista entrará em contato.</p>
                </div>
              ) : (
                <form onSubmit={handleLead} style={{ padding: '24px', borderRadius: 18, background: '#fff', border: '1.5px solid #f1f5f9', display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>Tenho Interesse</h3>
                  <input className="mn-form-input" placeholder="Seu nome *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                  <input className="mn-form-input" placeholder="WhatsApp *" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
                  <textarea className="mn-form-input" placeholder="Mensagem (opcional)" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={3} style={{ resize: 'none' }} />
                  <button type="submit" disabled={sending} style={{ padding: '13px', borderRadius: 11, background: primary, color: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 700, border: 'none', cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1, transition: 'opacity 0.15s' }}>
                    {sending ? 'Enviando…' : 'Solicitar Informações'}
                  </button>
                  {whatsapp && (
                    <a href={`https://wa.me/${whatsapp.replace(/\D/g,'')}?text=${wMsg}`} target="_blank" rel="noopener noreferrer"
                      style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px', borderRadius: 11, background: '#f0fdf4', border: '1.5px solid #bbf7d0', color: '#15803d', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none', transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#dcfce7'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='#f0fdf4'}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="#15803d"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Conversar no WhatsApp
                    </a>
                  )}
                </form>
              )}

              <Link to="/imoveis" style={{ display: 'block', textAlign: 'center', marginTop: 14, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: '#94a3b8', textDecoration: 'none', transition: 'color 0.13s' }}
                onMouseEnter={e => (e.target as HTMLElement).style.color='#374151'} onMouseLeave={e => (e.target as HTMLElement).style.color='#94a3b8'}>
                ← Ver todos os imóveis
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* LIGHTBOX */}
      {lightboxOpen && property.images?.length > 0 && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.94)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setLightboxOpen(false)}>
          <button onClick={() => setLightboxOpen(false)} style={{ position: 'absolute', top: 20, right: 20, width: 40, height: 40, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', fontSize: 20, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
          <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i - 1 + property.images.length) % property.images.length); }} style={{ position: 'absolute', left: 20, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>‹</button>
          <img src={property.images[lightboxIdx]} alt="" style={{ maxWidth: '88vw', maxHeight: '88vh', objectFit: 'contain', borderRadius: 10 }} onClick={e => e.stopPropagation()} />
          <button onClick={e => { e.stopPropagation(); setLightboxIdx(i => (i + 1) % property.images.length); }} style={{ position: 'absolute', right: 20, width: 44, height: 44, borderRadius: '50%', background: 'rgba(255,255,255,0.1)', border: 'none', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>›</button>
          <div style={{ position: 'absolute', bottom: 20, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.45)' }}>{lightboxIdx + 1} / {property.images.length}</div>
        </div>
      )}
    </>
  );
}

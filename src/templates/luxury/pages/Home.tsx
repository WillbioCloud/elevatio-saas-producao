import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import LuxuryPropertyCard, { LuxuryProperty } from '../components/LuxuryPropertyCard';

function useFeaturedProperties(companyId: string | undefined) {
  const [properties, setProperties] = useState<LuxuryProperty[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!companyId) {
      setLoading(false);
      return;
    }
    supabase
      .from('properties')
      .select('id, title, slug, price, type, listing_type, bedrooms, bathrooms, area, suites, garage_spaces, city, neighborhood, state, images, featured, status')
      .eq('company_id', companyId)
      .in('status', ['Disponível', 'disponível', 'Ativo', 'ativo', 'available'])
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => {
        if (!data?.length) {
          supabase.from('properties').select('id, title, slug, price, type, listing_type, bedrooms, bathrooms, area, suites, garage_spaces, city, neighborhood, state, images, featured, status')
            .eq('company_id', companyId).not('status', 'in', '("Vendido","Alugado","vendido","alugado")')
            .order('featured', { ascending: false }).limit(6)
            .then(({ data: fallback }) => { setProperties((fallback ?? []) as LuxuryProperty[]); setLoading(false); });
        } else {
          setProperties(data as LuxuryProperty[]); setLoading(false);
        }
      });
  }, [companyId]);

  return { properties, loading };
}

const FaqItem: React.FC<{ question: string; answer: string; defaultOpen?: boolean }> = ({ question, answer, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <button onClick={() => setOpen((v) => !v)} style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, padding: '28px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(15px,1.5vw,18px)', fontWeight: 500, color: '#fff', lineHeight: 1.4 }}>{question}</span>
        <span style={{ width: 32, height: 32, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.25s', background: open ? '#fff' : 'transparent', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 4l4 4 4-4" stroke={open ? '#0e0e0e' : '#fff'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
      </button>
      {open && <div style={{ paddingBottom: 28, paddingRight: 48, fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.45)', lineHeight: 1.8, animation: 'lx-fade-in 0.2s ease' }}>{answer}</div>}
    </div>
  );
};

export default function LuxuryHome() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};
  const { properties, loading } = useFeaturedProperties(tenant?.id);
  const heroRef = useRef<HTMLDivElement>(null);

  const heroImage = siteData.hero_image_url || '';
  const heroTitle = siteData.hero_title || tenant?.name || 'Imóveis Exclusivos';
  const heroSubtitle = siteData.hero_subtitle || 'Residências de alto padrão selecionadas para o seu estilo de vida.';
  const aboutText = siteData.about_text || `${tenant?.name || 'Nossa equipe'} conecta pessoas e imóveis com atendimento próximo, curadoria de oportunidades e suporte em cada etapa da negociação.`;
  const aboutImage = siteData.about_image_url || '';
  const whatsapp = siteData.social?.whatsapp || siteData.contact?.phone || '';
  const whatsappLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null;

  const stats = [
    { num: siteData.stat_properties || '200+', label: 'Imóveis Vendidos' },
    { num: siteData.stat_clients || '98%',     label: 'Satisfação' },
    { num: siteData.stat_years || '10+ Anos',  label: 'de Experiência' },
  ];

  const defaultFaqs = [
    { q: 'Como funciona o processo de compra?', a: 'Nossa equipe acompanha você em cada etapa — da visita ao registro em cartório. Oferecemos suporte jurídico completo e total transparência no processo.' },
    { q: 'Vocês trabalham com imóveis para locação?', a: 'Sim. Gerenciamos contratos de locação residencial e comercial, desde a captação do inquilino até a vistoria final, com garantia locatícia.' },
    { q: 'Como é feita a avaliação do meu imóvel?', a: 'Realizamos uma análise de mercado comparativa (AMC) gratuita, considerando localização, metragem, conservação e benchmarks de venda recentes na região.' }
  ];
  const rawFaqs: any[] = siteData.faqs || defaultFaqs;
  const faqs = rawFaqs.map((f: any) => ({ question: f.question || f.q || '', answer: f.answer || f.a || '' }));

  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onScroll = () => { el.style.transform = `translateY(${window.scrollY * 0.25}px)`; };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleContact = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    setSending(true);
    await supabase.from('leads').insert([{
      name: form.name, phone: form.phone, message: form.message || 'Interesse em imóveis',
      source: 'Site', company_id: tenant.id, status: 'Aguardando Atendimento', funnel_step: 'pre_atendimento',
    }]);
    setSending(false); setSent(true);
  };

  return (
    <>
      <style>{`
        @keyframes lx-fade-in { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .lx-feature-card { background:#161616; border-radius:20px; padding:32px; border:1px solid rgba(255,255,255,0.06); transition:border-color 0.25s,background 0.25s; }
        .lx-feature-card:hover { border-color:rgba(255,255,255,0.12); background:#1c1c1c; }
        .lx-input { width:100%; background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.1); border-radius:12px; padding:12px 16px; font-family:'DM Sans',sans-serif; font-size:14px; color:#fff; outline:none; transition:border-color 0.18s; }
        .lx-input:focus { border-color:rgba(255,255,255,0.3); }
        .lx-input::placeholder { color:rgba(255,255,255,0.2); }
        @media (max-width: 900px) { .lx-why-grid, .lx-faq-grid, .lx-about-grid, .lx-contact-grid { grid-template-columns:1fr !important; } .lx-faq-grid h2 { font-size:48px !important; position:static !important; margin-bottom:32px; } .lx-hero-stats { display:none !important; } }
      `}</style>

      {/* HERO */}
      <section style={{ position: 'relative', minHeight: '100vh', background: '#0e0e0e', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        <div ref={heroRef} style={{ position: 'absolute', inset: '-10%', backgroundSize: 'cover', backgroundPosition: 'center', ...(heroImage ? { backgroundImage: `url(${heroImage})` } : {}) }}>
          {!heroImage && <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1c1c1c 0%, #0e0e0e 100%)' }} />}
        </div>
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'linear-gradient(to top, rgba(14,14,14,1) 0%, rgba(14,14,14,0.5) 40%, rgba(14,14,14,0.15) 100%)' }} />

        <div className="lx-hero-stats" style={{ position: 'absolute', top: 120, right: 48, zIndex: 2, display: 'flex', flexDirection: 'column', gap: 28, textAlign: 'right' }}>
          {stats.map((s, i) => (
            <div key={i} style={{ animation: `lx-fade-in 0.6s ease ${0.3 + i * 0.15}s both` }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: '#fff' }}>{s.num}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ position: 'relative', zIndex: 2, padding: '0 clamp(24px,4vw,48px) 72px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(64px, 12vw, 180px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 0.9, color: '#ffffff', marginBottom: 32, animation: 'lx-fade-in 0.7s ease 0.1s both' }}>{heroTitle}</h1>
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(15px,1.4vw,18px)', color: 'rgba(255,255,255,0.45)', maxWidth: 420, lineHeight: 1.7, animation: 'lx-fade-in 0.7s ease 0.25s both' }}>{heroSubtitle}</p>
            <div style={{ display: 'flex', gap: 12, animation: 'lx-fade-in 0.7s ease 0.4s both' }}>
              <Link to="/imoveis" style={{ padding: '14px 28px', borderRadius: 100, background: '#ffffff', color: '#0e0e0e', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Ver Portfólio →</Link>
              <Link to="/sobre" style={{ padding: '14px 28px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Quem Somos</Link>
            </div>
          </div>
        </div>
      </section>

      {/* DESTAQUES */}
      <section style={{ background: '#0e0e0e', padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 56, gap: 24, flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>Nossos Imóveis</h2>
          </div>
          {loading ? (
             <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 28 }}>
                <div style={{ color: '#fff' }}>Carregando portfólio...</div>
             </div>
          ) : properties.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 28 }}>
              {properties.map((p, i) => <LuxuryPropertyCard key={p.id} property={p} index={i} variant={p.featured ? 'featured' : 'default'} />)}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '64px 24px', background: '#111', borderRadius: 24, border: '1px dashed rgba(255,255,255,0.08)' }}>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.3)' }}>Nenhum imóvel disponível no momento.</p>
            </div>
          )}
          <div style={{ marginTop: 56, textAlign: 'center' }}>
            <Link to="/imoveis" style={{ padding: '14px 36px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.15)', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: 'none' }}>Ver todos os imóveis →</Link>
          </div>
        </div>
      </section>

      {/* POR QUE NÓS */}
      <section style={{ background: '#0a0a0a', padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)' }}>
        <div className="lx-why-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
          <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', aspectRatio: '3/4', background: '#161616' }}>
            {aboutImage && <img src={aboutImage} alt="Sobre" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            <div style={{ position: 'absolute', top: 24, left: 24, background: '#fff', color: '#0e0e0e', padding: '8px 16px', borderRadius: 100, fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700 }}>Por que {tenant?.name || 'Nós'}</div>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              { title: 'Curadoria Rigorosa', desc: 'Não listamos tudo — apenas imóveis que atendem nossos critérios de design, localização e valorização.' },
              { title: 'Visão de Mercado', desc: 'Nossa experiência permite avaliar imóveis além do preço — analisamos espaço, luz, materiais e valor de longo prazo.' },
              { title: 'Especialistas Locais', desc: 'Com conhecimento profundo do mercado, oferecemos orientação honesta baseada em dados reais e experiência prática.' },
              { title: 'Experiência Fluida', desc: 'Do primeiro contato ao registro em cartório, cuidamos de tudo. Processo transparente, sem surpresas.' },
            ].map((f, i) => (
              <div key={i} className="lx-feature-card" style={{ animation: `lx-fade-in 0.5s ease ${0.1 + i * 0.1}s both` }}>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 14, letterSpacing: '-0.01em', lineHeight: 1.3 }}>{f.title}</h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.8 }}>{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* QUEM SOMOS */}
      <section style={{ background: '#0e0e0e', padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)' }}>
        <div className="lx-about-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
          <div>
            <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 14 }}>Nossa História</div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(32px,4vw,52px)', fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05, marginBottom: 24 }}>{siteData.about_title || `Quem é a ${tenant?.name || 'Imobiliária'}`}</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.45)', lineHeight: 1.9, marginBottom: 36, whiteSpace: 'pre-line' }}>{aboutText}</p>
            <Link to="/sobre" style={{ display: 'inline-flex', padding: '14px 28px', borderRadius: 100, background: '#fff', color: '#0e0e0e', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Conheça nossa história →</Link>
          </div>
          <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', aspectRatio: '4/5', background: '#161616' }}>
            {aboutImage && <img src={aboutImage} alt={`Sobre ${tenant?.name}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
          </div>
        </div>
      </section>

      {/* CONTATO */}
      <section style={{ background: '#0a0a0a', padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)' }}>
         <div className="lx-contact-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'start' }}>
          <div>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(32px,4vw,52px)', fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1.05, marginBottom: 20 }}>Fale com um especialista</h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, marginBottom: 40 }}>Tem interesse em algum imóvel ou quer avaliar o seu? Nossa equipe responde rápido.</p>
            {whatsappLink && <a href={whatsappLink} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', padding: '13px 22px', borderRadius: 100, background: 'rgba(37,211,102,0.1)', border: '1px solid rgba(37,211,102,0.2)', color: '#4ade80', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none' }}>Conversar no WhatsApp</a>}
          </div>
          {sent ? (
            <div style={{ padding: '48px 32px', borderRadius: 24, background: '#111', border: '1px solid rgba(255,255,255,0.07)', textAlign: 'center' }}>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 10 }}>Mensagem recebida!</h3>
              <p style={{ color: 'rgba(255,255,255,0.4)' }}>Em breve um de nossos especialistas entrará em contato.</p>
            </div>
          ) : (
            <form onSubmit={handleContact} style={{ padding: '36px', borderRadius: 24, background: '#111', border: '1px solid rgba(255,255,255,0.07)', display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input className="lx-input" placeholder="Seu nome *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
              <input className="lx-input" placeholder="WhatsApp / Telefone *" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} required />
              <textarea className="lx-input" placeholder="Como podemos ajudar?" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={4} style={{ resize: 'none' }} />
              <button type="submit" disabled={sending} style={{ padding: '14px', borderRadius: 12, background: '#fff', color: '#0e0e0e', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, border: 'none', cursor: sending ? 'wait' : 'pointer' }}>{sending ? 'Enviando…' : 'Enviar Mensagem'}</button>
            </form>
          )}
        </div>
      </section>
    </>
  );
}

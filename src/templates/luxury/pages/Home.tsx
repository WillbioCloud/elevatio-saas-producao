import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import LuxuryPropertyCard, { LuxuryProperty } from '../components/LuxuryPropertyCard';

// ─── Hook: buscar imóveis em destaque ─────────────────────────
function useFeaturedProperties(companyId: string | undefined) {
  const [properties, setProperties] = useState<LuxuryProperty[]>([]);
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('properties')
      .select('id, title, slug, price, type, listing_type, bedrooms, bathrooms, area, suites, garage, city, neighborhood, state, images, featured, status')
      .eq('company_id', companyId)
      .eq('status', 'Disponível')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setProperties(data as LuxuryProperty[]); });
  }, [companyId]);
  return properties;
}

// ─── FAQ Accordion item ───────────────────────────────────────
const FaqItem: React.FC<{ question: string; answer: string; defaultOpen?: boolean }> = ({ question, answer, defaultOpen }) => {
  const [open, setOpen] = useState(defaultOpen ?? false);
  return (
    <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
      <button
        onClick={() => setOpen(v => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center',
          justifyContent: 'space-between', gap: 16,
          padding: '28px 0', background: 'none', border: 'none',
          cursor: 'pointer', textAlign: 'left',
        }}
      >
        <span style={{
          fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(15px,1.5vw,18px)',
          fontWeight: 500, color: '#fff', lineHeight: 1.4,
        }}>{question}</span>
        <span style={{
          width: 32, height: 32, borderRadius: '50%',
          border: '1px solid rgba(255,255,255,0.15)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0, transition: 'all 0.25s',
          background: open ? '#fff' : 'transparent',
          transform: open ? 'rotate(180deg)' : 'rotate(0deg)',
        }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path d="M2 4l4 4 4-4" stroke={open ? '#0e0e0e' : '#fff'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <div style={{
          paddingBottom: 28, paddingRight: 48,
          fontFamily: "'DM Sans', sans-serif",
          fontSize: 15, color: 'rgba(255,255,255,0.45)',
          lineHeight: 1.8,
          animation: 'lx-fade-in 0.2s ease',
        }}>
          {answer}
        </div>
      )}
    </div>
  );
};


// ─── MAIN COMPONENT ───────────────────────────────────────────
export default function LuxuryHome() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};
  const properties = useFeaturedProperties(tenant?.id);
  const heroRef = useRef<HTMLDivElement>(null);

  // Parallax sutil no hero
  useEffect(() => {
    const el = heroRef.current;
    if (!el) return;
    const onScroll = () => {
      const y = window.scrollY;
      el.style.transform = `translateY(${y * 0.25}px)`;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const faqs = siteData.faqs || [
    { q: 'Como funciona o processo de compra?', a: 'Nossa equipe acompanha você em cada etapa — da visita ao registro em cartório. Oferecemos suporte jurídico completo e total transparência no processo.' },
    { q: 'Vocês trabalham com imóveis para locação?', a: 'Sim. Gerenciamos contratos de locação residencial e comercial, desde a captação do inquilino até a vistoria final, com garantia locatícia.' },
    { q: 'Posso personalizar o imóvel antes da entrega?', a: 'Para imóveis em lançamento, sim — trabalhamos com construtoras parceiras que oferecem personalização de acabamentos. Consulte nossa equipe.' },
    { q: 'Como é feita a avaliação do meu imóvel?', a: 'Realizamos uma análise de mercado comparativa (AMC) gratuita, considerando localização, metragem, conservação e benchmarks de venda recentes na região.' },
  ];

  return (
    <>
      <style>{`
        @keyframes lx-fade-in {
          from { opacity: 0; transform: translateY(20px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .lx-feature-card {
          background: #161616; border-radius: 20px;
          padding: 32px; border: 1px solid rgba(255,255,255,0.06);
          transition: border-color 0.25s, background 0.25s;
        }
        .lx-feature-card:hover {
          border-color: rgba(255,255,255,0.12);
          background: #1c1c1c;
        }
      `}</style>

      {/* ════════════════════════════════════════════════
          1. HERO — nome gigante + foto bleeding
      ════════════════════════════════════════════════ */}
      <section style={{ position: 'relative', minHeight: '100vh', background: '#0e0e0e', overflow: 'hidden', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end' }}>
        {/* Foto de fundo com parallax */}
        <div
          ref={heroRef}
          style={{
            position: 'absolute', inset: '-10%',
            backgroundImage: siteData.heroBgImage ? `url(${siteData.heroBgImage})` : undefined,
            backgroundSize: 'cover', backgroundPosition: 'center',
          }}
        >
          {!siteData.heroBgImage && (
            <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(160deg, #1c1c1c 0%, #0e0e0e 100%)' }} />
          )}
        </div>

        {/* Gradiente sobre a foto */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 1,
          background: 'linear-gradient(to top, rgba(14,14,14,1) 0%, rgba(14,14,14,0.5) 40%, rgba(14,14,14,0.15) 100%)',
        }} />

        {/* Stats — canto superior direito */}
        <div style={{
          position: 'absolute', top: 120, right: 48, zIndex: 2,
          display: 'flex', flexDirection: 'column', gap: 28, textAlign: 'right',
        }} className="lx-hero-stats">
          {[
            { num: siteData.statProperties || '200+', label: 'Imóveis Vendidos' },
            { num: siteData.statClients || '98%',     label: 'Satisfação' },
            { num: siteData.statYears || '12 anos',   label: 'de Experiência' },
          ].map((s, i) => (
            <div key={i} style={{ animation: `lx-fade-in 0.6s ease ${0.3 + i * 0.15}s both` }}>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(28px,3.5vw,48px)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.03em', color: '#fff' }}>{s.num}</div>
              <div style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.06em', textTransform: 'uppercase', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Conteúdo principal */}
        <div style={{ position: 'relative', zIndex: 2, padding: '0 48px 72px', maxWidth: 1280, margin: '0 auto', width: '100%' }}>
          {/* Nome da imobiliária — tipografia gigante */}
          <h1 style={{
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 'clamp(64px, 12vw, 180px)',
            fontWeight: 700,
            letterSpacing: '-0.04em',
            lineHeight: 0.9,
            color: '#ffffff',
            marginBottom: 32,
            animation: 'lx-fade-in 0.7s ease 0.1s both',
          }}>
            {tenant?.name || siteData.heroTitle || 'Imobiliária'}
          </h1>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>
            <p style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 'clamp(15px, 1.4vw, 18px)',
              color: 'rgba(255,255,255,0.45)',
              maxWidth: 420, lineHeight: 1.7,
              animation: 'lx-fade-in 0.7s ease 0.25s both',
            }}>
              {siteData.heroSubtitle || 'Residências de alto padrão selecionadas para o seu estilo de vida.'}
            </p>

            <div style={{ display: 'flex', gap: 12, animation: 'lx-fade-in 0.7s ease 0.4s both' }}>
              <Link
                to="/imoveis"
                style={{
                  padding: '14px 28px', borderRadius: 100,
                  background: '#ffffff', color: '#0e0e0e',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14, fontWeight: 700,
                  letterSpacing: '0.03em',
                  textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'opacity 0.2s',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >
                Ver Portfólio <span>→</span>
              </Link>
              <Link
                to="/contato"
                style={{
                  padding: '14px 28px', borderRadius: 100,
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#fff',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14, fontWeight: 600,
                  textDecoration: 'none',
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  transition: 'border-color 0.2s, background 0.2s',
                }}
                onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.5)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
                onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
              >
                Falar com Corretor
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          2. IMÓVEIS EM DESTAQUE — grid 3 colunas
      ════════════════════════════════════════════════ */}
      <section style={{ background: '#0e0e0e', padding: 'clamp(64px, 8vw, 112px) clamp(24px, 4vw, 48px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>
          {/* Header da seção */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 56, gap: 24, flexWrap: 'wrap' }}>
            <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(28px,3.5vw,44px)', fontWeight: 700, letterSpacing: '-0.03em', color: '#fff' }}>
              Nossos Imóveis
            </h2>
            <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.35)', maxWidth: 280, lineHeight: 1.7, textAlign: 'right' }}>
              Uma seleção curada de residências projetadas com clareza e propósito.
            </p>
          </div>

          {/* Grid */}
          {properties.length > 0 ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 28 }}>
              {properties.map((p, i) => <LuxuryPropertyCard key={p.id} property={p} index={i} variant={p.featured ? 'featured' : 'default'} />)}
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 28 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ animation: `lx-fade-in 0.5s ease ${i * 0.08}s both` }}>
                  <div style={{ borderRadius: 20, overflow: 'hidden', aspectRatio: '4/3', background: '#161616', marginBottom: 20 }} />
                  <div style={{ height: 20, borderRadius: 8, background: '#161616', marginBottom: 10, width: '70%' }} />
                  <div style={{ height: 14, borderRadius: 8, background: '#161616', width: '40%' }} />
                </div>
              ))}
            </div>
          )}

          <div style={{ marginTop: 56, textAlign: 'center' }}>
            <Link
              to="/imoveis"
              style={{
                padding: '14px 36px', borderRadius: 100,
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#fff',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14, fontWeight: 600,
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'border-color 0.2s, background 0.2s',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.15)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Ver todos os imóveis →
            </Link>
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          3. POR QUE NÓS — imagem esq + 2×2 cards dir
      ════════════════════════════════════════════════ */}
      <section style={{ background: '#0a0a0a', padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32, alignItems: 'start' }}>
          {/* Imagem com tag */}
          <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', aspectRatio: '3/4', background: '#161616' }}>
            {siteData.whyUsImage ? (
              <img src={siteData.whyUsImage} alt="Por que nós" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: '#161616', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="64" height="64" viewBox="0 0 80 80" fill="none" opacity="0.08">
                  <rect x="8" y="32" width="64" height="40" rx="4" stroke="white" strokeWidth="2"/>
                  <path d="M8 40l32-24 32 24" stroke="white" strokeWidth="2"/>
                </svg>
              </div>
            )}
            <div style={{
              position: 'absolute', top: 24, left: 24,
              background: '#fff', color: '#0e0e0e',
              padding: '8px 16px', borderRadius: 100,
              fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 700,
            }}>
              Por que {tenant?.name || 'Nós'}
            </div>
          </div>

          {/* 2×2 feature cards */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            {[
              {
                title: 'Curadoria Rigorosa',
                desc: 'Não listamos tudo — apenas imóveis que atendem nossos critérios de design, localização e valorização. Cada propriedade é revisada antes de chegar ao seu conhecimento.',
              },
              {
                title: 'Visão Arquitetônica',
                desc: 'Nossa experiência em arquitetura e design urbano nos permite avaliar imóveis além do preço — analisamos espaço, luz, materiais e valor de longo prazo.',
              },
              {
                title: 'Especialistas Locais',
                desc: 'Com conhecimento profundo dos mercados e bairros da cidade, oferecemos orientação honesta baseada em dados reais e experiência prática de campo.',
              },
              {
                title: 'Experiência Fluida',
                desc: 'Do primeiro contato ao registro em cartório, cuidamos de tudo. Processo transparente, sem surpresas e com suporte jurídico completo em cada etapa.',
              },
            ].map((f, i) => (
              <div key={i} className="lx-feature-card" style={{ animation: `lx-fade-in 0.5s ease ${0.1 + i * 0.1}s both` }}>
                <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 14, letterSpacing: '-0.01em', lineHeight: 1.3 }}>
                  {f.title}
                </h3>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)', lineHeight: 1.8 }}>
                  {f.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          4. FAQ — editorial: label grande + accordion
      ════════════════════════════════════════════════ */}
      <section style={{ background: '#0e0e0e', padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 64, alignItems: 'start' }}>
          {/* Label esquerda */}
          <div>
            <h2 style={{
              fontFamily: "'DM Sans', sans-serif",
              fontSize: 'clamp(56px, 8vw, 120px)',
              fontWeight: 700, letterSpacing: '-0.05em',
              lineHeight: 0.9, color: '#fff',
              position: 'sticky', top: 100,
            }}>
              FAQ
            </h2>
          </div>
          {/* Accordion direita */}
          <div style={{ paddingTop: 8 }}>
            {faqs.map((item: any, i: number) => (
              <FaqItem
                key={i}
                question={item.q || item.question}
                answer={item.a || item.answer}
                defaultOpen={i === 1}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ════════════════════════════════════════════════
          5. CTA FINAL
      ════════════════════════════════════════════════ */}
      <section style={{ background: '#080808', padding: 'clamp(80px,10vw,140px) clamp(24px,4vw,48px)', textAlign: 'center', borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 640, margin: '0 auto' }}>
          <h2 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(32px,5vw,64px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1.05, color: '#fff', marginBottom: 20 }}>
            Encontre seu próximo imóvel.
          </h2>
          <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.35)', lineHeight: 1.8, marginBottom: 40 }}>
            {siteData.aboutText || 'Atendimento personalizado, total discrição e o imóvel certo para o seu estilo de vida.'}
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Link
              to="/imoveis"
              style={{ padding: '16px 36px', borderRadius: 100, background: '#fff', color: '#0e0e0e', fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 700, textDecoration: 'none', transition: 'opacity 0.2s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
            >
              Explorar Portfólio →
            </Link>
            <Link
              to="/contato"
              style={{ padding: '16px 36px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 15, fontWeight: 600, textDecoration: 'none', transition: 'all 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)'; (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)'; (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              Falar com Especialista
            </Link>
          </div>
        </div>
      </section>

      <style>{`
        @media (max-width: 768px) {
          .lx-hero-stats { display: none !important; }
        }
        @media (max-width: 900px) {
          .lx-why-grid { grid-template-columns: 1fr !important; }
          .lx-faq-grid { grid-template-columns: 1fr !important; }
          .lx-faq-grid h2 { font-size: 48px !important; position: static !important; margin-bottom: 32px; }
        }
      `}</style>
    </>
  );
}
import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import ModernPropertyCard, { ModernProperty } from '../../../templates/draft_modern/components/ModernPropertyCard';

// ─── Dados estáticos ───────────────────────────────────────────
const SERVICES = [
  { icon: 'M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z M9 21V12h6v9', title: 'Venda de Imóveis', desc: 'Promovemos e vendemos seu imóvel atraindo compradores qualificados com estratégias de mercado comprovadas.' },
  { icon: 'M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2 M9 7a4 4 0 100 8 4 4 0 000-8z M23 21v-2a4 4 0 00-3-3.87 M16 3.13a4 4 0 010 7.75', title: 'Representação do Comprador', desc: 'Guiamos você em todo o processo de compra, priorizando seus interesses e buscando o melhor negócio.' },
  { icon: 'M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z M14 2v6h6 M16 13H8 M16 17H8 M10 9H8', title: 'Gestão de Locações', desc: 'Gerenciamos relações com inquilinos, manutenção e finanças para maximizar os retornos do seu aluguel.' },
  { icon: 'M18 20V10 M12 20V4 M6 20v-6', title: 'Consultoria de Investimento', desc: 'Fornecemos orientação estratégica para ajudar você a capitalizar oportunidades imobiliárias com segurança.' },
  { icon: 'M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z', title: 'Avaliação de Imóveis', desc: 'Avaliação precisa do valor do seu imóvel para vendas, compras ou investimentos com laudos completos.' },
  { icon: 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z', title: 'Soluções Personalizadas', desc: 'Serviços imobiliários customizados e alinhados com seus objetivos específicos de vida e investimento.' },
];

const DEFAULT_OFFERS = [
  { num: '01', label: 'Residências de Luxo', desc: 'Experimente elegância incomparável em nossas residências de luxo, com design requintado, amenidades premium e localizações privilegiadas para os gostos mais exigentes.' },
  { num: '02', label: 'Imóveis Sustentáveis', desc: 'Descubra a vida sustentável em propriedades eco-friendly, projetadas para minimizar o impacto ambiental enquanto oferecem confortos modernos e eficiência energética.' },
  { num: '03', label: 'Casas de Temporada', desc: 'Explore nossa curadoria de casas de temporada únicas, com arquitetura diferenciada e locais excepcionais para estadias verdadeiramente inesquecíveis.' },
];

const TESTIMONIALS = [
  { name: 'Carlos Mendes', role: 'Empresário', text: 'Atenção aos detalhes e expertise de mercado tornaram a busca pelo meu imóvel uma experiência tranquila e muito satisfatória.' },
  { name: 'Ana Paula Lima', role: 'Advogada', text: 'Profissionalismo e profundo conhecimento em imóveis de alto padrão me deram total confiança durante todo o processo.' },
  { name: 'Roberto Costa', role: 'Arquiteto', desc: 'A paixão pela sustentabilidade habitacional me ajudou a encontrar um lar bonito e eco-friendly que amo de verdade.', text: 'A paixão pela sustentabilidade habitacional me ajudou a encontrar um lar bonito e eco-friendly que amo de verdade.' },
  { name: 'Fernanda Silva', role: 'Médica', text: 'A dedicação e eficiência tornaram o aluguel do meu imóvel sem complicações. A expertise é realmente incomparável.' },
];

// ─── Hook ─────────────────────────────────────────────────────
function useFeaturedProperties(companyId: string | undefined) {
  const [properties, setProperties] = useState<ModernProperty[]>([]);
  useEffect(() => {
    if (!companyId) return;
    supabase
      .from('properties')
      .select('id,title,slug,price,type,listing_type,bedrooms,bathrooms,area,suites,garage,city,neighborhood,state,images,featured,status')
      .eq('company_id', companyId)
      .eq('status', 'Disponível')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(6)
      .then(({ data }) => { if (data) setProperties(data as ModernProperty[]); });
  }, [companyId]);
  return properties;
}

// ─── Componentes de apoio ─────────────────────────────────────
const SectionTag: React.FC<{ label: string; color: string }> = ({ label, color }) => (
  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 100, background: `${color}18`, marginBottom: 14 }}>
    <div style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
    <span style={{ fontSize: 13, fontWeight: 700, color, letterSpacing: '0.03em', fontFamily: "'Plus Jakarta Sans', sans-serif" }}>{label}</span>
  </div>
);

const H2: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, color: '#0f172a', letterSpacing: '-0.04em', lineHeight: 1.15, ...style }}>
    {children}
  </h2>
);



const FaqItem: React.FC<{ q: string; a: string; color: string }> = ({ q, a, color }) => {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ borderBottom: '1px solid #e8ecf0' }}>
      <button onClick={() => setOpen(v => !v)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 16, padding: '20px 0', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
        <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 600, color: '#0f172a', lineHeight: 1.45 }}>{q}</span>
        <span style={{ width: 28, height: 28, borderRadius: '50%', border: `1.5px solid ${open ? color : '#d1d5db'}`, background: open ? color : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, transition: 'all 0.2s' }}>
          <svg width="11" height="11" viewBox="0 0 12 12" fill="none" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            <path d="M2 4l4 4 4-4" stroke={open ? '#fff' : '#6b7280'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </span>
      </button>
      {open && (
        <div style={{ paddingBottom: 18, paddingRight: 44, fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#64748b', lineHeight: 1.8, animation: 'mn-fadein 0.18s ease' }}>
          {a}
        </div>
      )}
    </div>
  );
};

// ─── MAIN ─────────────────────────────────────────────────────
export default function ModernHome() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};
  const primary  = siteData.primary_color || '#16a34a';
  const properties = useFeaturedProperties(tenant?.id);
  const [activeOffer, setActiveOffer] = useState(0);
  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const offers = siteData.offers || DEFAULT_OFFERS;

  const stats = [
    { num: siteData.stat_projects || '200+', label: 'Projetos Concluídos', color: primary },
    { num: siteData.stat_clients  || '70+',  label: 'Clientes Satisfeitos', color: '#0ea5e9' },
    { num: siteData.stat_value    || '10M+', label: 'Em Transações (R$)', color: '#8b5cf6' },
  ];

  const faqs = siteData.faqs || [
    { q: 'Como funciona o processo de compra de um imóvel?', a: 'O processo envolve selecionar o imóvel ideal, negociar condições com o corretor, assinar o contrato e concluir o pagamento. Nossa equipe guia você em cada etapa.' },
    { q: 'Como determinar o valor que posso investir?', a: 'Recomendamos consultar um especialista em financiamento que avaliará sua renda, despesas e score de crédito para orientação personalizada.' },
    { q: 'Quais documentos são necessários para locação?', a: 'Normalmente: documento de identidade, comprovante de renda e histórico de locações. Alguns proprietários exigem fiador ou seguro-fiança.' },
    { q: 'Posso rescindir um contrato de locação antecipadamente?', a: 'Depende do contrato. Recomendamos revisar as cláusulas de rescisão antes de assinar e discutir as opções com nossos corretores.' },
    { q: 'Quais são os riscos de investir em imóveis?', a: 'Os riscos incluem flutuações de mercado e custos de manutenção. Oferecemos análise profissional de mercado para minimizá-los.' },
    { q: 'Como funciona a avaliação do meu imóvel?', a: 'Realizamos uma análise de mercado comparativa (AMC) gratuita considerando localização, metragem, conservação e benchmarks da região.' },
  ];

  const handleLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    setSending(true);
    await supabase.from('leads').insert([{ ...form, source: 'Site', company_id: tenant.id }]);
    setSending(false);
    setSent(true);
  };

  return (
    <>
      <style>{`
        @keyframes mn-fadein  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mn-fadein2 { from { opacity:0; } to { opacity:1; } }
        @keyframes mn-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        @keyframes mn-marquee  { from { transform:translateX(0); } to { transform:translateX(-50%); } }

        .mn-section { padding: clamp(40px,5vw,64px) 0; }
        .mn-container { max-width: 1280px; margin: 0 auto; padding: 0 clamp(16px,3vw,32px); }

        .mn-offer-tab {
          display: flex; align-items: flex-start; gap: 14px;
          padding: 16px 18px; border-radius: 14px;
          cursor: pointer; border: 1.5px solid transparent; transition: all 0.2s;
        }
        .mn-offer-tab:hover { background: #f8fafc; }

        .mn-service-card {
          padding: 26px 22px; border-radius: 16px;
          border: 1.5px solid #f1f5f9; background: #fff;
          transition: all 0.22s;
        }
        .mn-service-card:hover { box-shadow: 0 10px 36px rgba(0,0,0,0.08); transform: translateY(-3px); border-color: #e2e8f0; }

        .mn-testimonial-card {
          padding: 24px; border-radius: 16px;
          background: #fff; border: 1.5px solid #f1f5f9;
          transition: box-shadow 0.22s;
        }
        .mn-testimonial-card:hover { box-shadow: 0 8px 28px rgba(0,0,0,0.07); }

        .mn-form-input {
          width: 100%; padding: 12px 16px;
          border-radius: 10px; border: 1.5px solid #e5e7eb;
          background: #fff; font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 14px; color: #0f172a; outline: none; transition: border-color 0.18s;
        }
        .mn-form-input:focus { border-color: var(--mn-primary); }
        .mn-form-input::placeholder { color: #9ca3af; }

        .mn-shimmer { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size: 200% 100%; animation: mn-shimmer 1.4s infinite; }

        @media (max-width: 960px) {
          .mn-offer-grid   { grid-template-columns: 1fr !important; }
          .mn-why-grid     { grid-template-columns: repeat(2,1fr) !important; }
          .mn-props-grid   { grid-template-columns: repeat(2,1fr) !important; }
          .mn-about-grid   { grid-template-columns: 1fr !important; }
          .mn-contact-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 600px) {
          .mn-why-grid   { grid-template-columns: 1fr !important; }
          .mn-props-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <style>{`:root { --mn-primary: ${primary}; }`}</style>

      {/* ══════════════════════════════════════════
          1. HERO — imagem de fundo com bordas
             arredondadas dentro da margem
      ══════════════════════════════════════════ */}
      <section style={{ background: '#f1f5f9', padding: 'clamp(10px,1.2vw,16px) clamp(16px,3vw,32px) clamp(20px,2vw,28px)' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto' }}>

          {/* Card com imagem de fundo */}
          <div style={{
            position: 'relative',
            borderRadius: 28,
            overflow: 'hidden',
            minHeight: 'clamp(500px, 70vh, 680px)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'flex-end',
            animation: 'mn-fadein 0.7s ease both',
          }}>

            {/* ── IMAGEM DE FUNDO ── */}
            {siteData.hero_image_url ? (
              <img
                src={siteData.hero_image_url}
                alt=""
                style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: 'center', display: 'block' }}
              />
            ) : (
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, #334155 0%, #1e293b 40%, #0f172a 100%)' }}>
                {/* Pattern sutil */}
                <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.04 }} viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice">
                  <defs>
                    <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                      <path d="M 10 0 L 0 0 0 10" fill="none" stroke="white" strokeWidth="0.5"/>
                    </pattern>
                  </defs>
                  <rect width="100%" height="100%" fill="url(#grid)"/>
                </svg>
                {/* Ícone casa centralizado */}
                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="120" height="120" viewBox="0 0 24 24" fill="rgba(255,255,255,0.07)">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                </div>
              </div>
            )}

            {/* ── GRADIENTE OVERLAY — escurece de baixo para cima ── */}
            <div style={{
              position: 'absolute', inset: 0,
              background: 'linear-gradient(to top, rgba(10,15,28,0.88) 0%, rgba(10,15,28,0.55) 42%, rgba(10,15,28,0.15) 72%, transparent 100%)',
            }} />

            {/* ── CONTEÚDO SOBRE A IMAGEM ── */}
            <div style={{ position: 'relative', zIndex: 2, padding: 'clamp(28px,4vw,52px)' }}>

              {/* Tag */}
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '5px 14px', borderRadius: 100, background: `${primary}28`, border: `1px solid ${primary}44`, marginBottom: 18, backdropFilter: 'blur(6px)' }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: primary }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.03em', fontFamily: "'Plus Jakarta Sans', sans-serif", opacity: 0.9 }}>
                  Soluções Imobiliárias
                </span>
              </div>

              {/* Título */}
              <h1 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(32px,5vw,62px)', fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1.06, marginBottom: 16, maxWidth: 700, textShadow: '0 2px 20px rgba(0,0,0,0.3)' }}>
                {siteData.hero_title || 'Encontre o Lar Perfeito para Você'}
              </h1>

              {/* Subtítulo */}
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 'clamp(14px,1.5vw,17px)', color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, marginBottom: 32, maxWidth: 520 }}>
                {siteData.hero_subtitle || 'Soluções personalizadas, guiando você em cada etapa com experiências únicas alinhadas às suas necessidades.'}
              </p>

              {/* Linha inferior: CTAs + Stats lado a lado */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap' }}>

                {/* CTAs */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <Link to="/imoveis"
                    style={{ padding: '13px 26px', borderRadius: 11, background: primary, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'opacity 0.15s,transform 0.15s', boxShadow: `0 4px 20px ${primary}55` }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.opacity='0.88'; (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.opacity='1'; (e.currentTarget as HTMLElement).style.transform='translateY(0)'; }}>
                    Ver Imóveis →
                  </Link>
                  <Link to="/contato"
                    style={{ padding: '13px 26px', borderRadius: 11, border: '1.5px solid rgba(255,255,255,0.25)', color: '#fff', background: 'rgba(255,255,255,0.1)', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 600, textDecoration: 'none', backdropFilter: 'blur(6px)', transition: 'all 0.15s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.18)'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.1)'}>
                    Saiba Mais
                  </Link>
                </div>

                {/* Stats — pills de vidro */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  {stats.map((s, i) => (
                    <div key={i} style={{ padding: '12px 20px', borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(10px)' }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.04em', lineHeight: 1 }}>{s.num}</div>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.55)', marginTop: 4 }}>{s.label}</div>
                    </div>
                  ))}

                  {/* Rating bubble */}
                  <div style={{ padding: '10px 16px', borderRadius: 14, background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.16)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex' }}>
                      {['#818cf8','#a78bfa','#f472b6'].map((c, i) => (
                        <div key={i} style={{ width: 26, height: 26, borderRadius: '50%', background: c, border: '2px solid rgba(255,255,255,0.3)', marginLeft: i > 0 ? -7 : 0 }} />
                      ))}
                    </div>
                    <div>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 13, fontWeight: 800, color: '#fff' }}>4.8 / 5.0</div>
                      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.5)', fontWeight: 500 }}>Avaliação</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          2. O QUE OFERECEMOS — tabs + imagem grande
      ══════════════════════════════════════════ */}
      <section style={{ background: '#fff' }} className="mn-section">
        <div className="mn-container">
          {/* Header alinhado à esquerda — igual ao VistaHaven */}
          <div style={{ marginBottom: 40 }}>
            <SectionTag label="O Que Oferecemos" color={primary} />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap' }}>
              <H2 style={{ maxWidth: 420 }}>Soluções Imobiliárias Completas</H2>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#64748b', maxWidth: 360, lineHeight: 1.75, marginBottom: 4 }}>
                Nossos serviços abrangem residências de luxo, imóveis sustentáveis e locações de temporada premium.
              </p>
            </div>
          </div>

          <div className="mn-offer-grid" style={{ display: 'grid', gridTemplateColumns: '1.1fr 0.9fr', gap: 20, alignItems: 'stretch' }}>

            {/* ── Imagem grande à esquerda ── */}
            <div style={{ position: 'relative', borderRadius: 18, overflow: 'hidden', background: '#1e293b', minHeight: 460 }}>
              {offers[activeOffer]?.image ? (
                <img
                  src={offers[activeOffer].image}
                  alt={offers[activeOffer].label}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', position: 'absolute', inset: 0, display: 'block', transition: 'opacity 0.3s' }}
                />
              ) : (
                <div style={{
                  position: 'absolute', inset: 0,
                  background: [
                    'linear-gradient(135deg,#1e3a5f,#0f172a)',
                    'linear-gradient(135deg,#14532d,#052e16)',
                    'linear-gradient(135deg,#7c2d12,#1c1917)',
                  ][activeOffer] || 'linear-gradient(135deg,#1e293b,#0f172a)',
                  transition: 'background 0.4s',
                }}>
                  <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <svg width="80" height="80" viewBox="0 0 24 24" fill="rgba(255,255,255,0.06)"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
                  </div>
                </div>
              )}
              {/* Overlay gradiente */}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.1) 50%, transparent 100%)' }} />
              {/* Label flutuante na base */}
              <div style={{ position: 'absolute', bottom: 28, left: 28, right: 28 }}>
                <span style={{ display: 'inline-block', padding: '4px 12px', borderRadius: 100, background: primary, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 800, color: '#fff', letterSpacing: '0.06em', marginBottom: 10 }}>
                  {offers[activeOffer]?.num}
                </span>
                <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 22, fontWeight: 800, color: '#fff', letterSpacing: '-0.03em', lineHeight: 1.2, textShadow: '0 2px 12px rgba(0,0,0,0.5)' }}>
                  {offers[activeOffer]?.label}
                </div>
              </div>
            </div>

            {/* ── Tabs à direita ── */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6 }}>
              {offers.map((o: any, i: number) => {
                const isActive = activeOffer === i;
                return (
                  <div key={i}
                    onClick={() => setActiveOffer(i)}
                    style={{
                      display: 'flex', alignItems: 'flex-start', gap: 14,
                      padding: '18px 18px',
                      borderRadius: 14,
                      cursor: 'pointer',
                      border: `1.5px solid ${isActive ? primary + '30' : '#f0f0f0'}`,
                      background: isActive ? `${primary}07` : '#fff',
                      transition: 'all 0.18s',
                    }}
                    onMouseEnter={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#fafafa'; }}
                    onMouseLeave={e => { if (!isActive) (e.currentTarget as HTMLElement).style.background = '#fff'; }}
                  >
                    {/* Número */}
                    <div style={{
                      width: 44, height: 44, borderRadius: 12, flexShrink: 0,
                      background: isActive ? primary : '#f4f4f5',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.18s',
                    }}>
                      <span style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 800, color: isActive ? '#fff' : '#a1a1aa' }}>{o.num}</span>
                    </div>
                    {/* Texto */}
                    <div style={{ paddingTop: 3, flex: 1 }}>
                      <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 15, fontWeight: 700, color: '#0f172a', letterSpacing: '-0.2px', marginBottom: isActive ? 7 : 0 }}>
                        {o.label}
                      </div>
                      {isActive && (
                        <div style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: '#64748b', lineHeight: 1.72, animation: 'mn-fadein2 0.2s ease' }}>
                          {o.desc}
                        </div>
                      )}
                    </div>
                    {/* Seta circular */}
                    <div style={{
                      width: 26, height: 26, borderRadius: '50%', flexShrink: 0, marginTop: 9,
                      border: `1.5px solid ${isActive ? primary : '#e4e4e7'}`,
                      background: isActive ? primary : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.18s',
                    }}>
                      <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                        <path d="M2 5h6M5 2l3 3-3 3" stroke={isActive ? '#fff' : '#a1a1aa'} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          3. POR QUE NÓS — 6 cards de serviço
      ══════════════════════════════════════════ */}
      <section style={{ background: '#fff' }} className="mn-section">
        <div className="mn-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 36 }}>
            <div>
              <SectionTag label="Por Que Nos Escolher" color={primary} />
              <H2>Explore Nossos Serviços de Especialistas</H2>
            </div>
            <Link to="/imoveis"
              style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 700, color: primary, textDecoration: 'none', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 4, transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.65'}
              onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}>
              Ver todos os imóveis →
            </Link>
          </div>

          {/* Grid de cards com borda externa arredondada nos cantos */}
          <div className="mn-why-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: '#e8eaed', borderRadius: 16, overflow: 'hidden' }}>
            {SERVICES.map((s, i) => (
              <div key={i}
                style={{
                  padding: '28px 24px',
                  background: '#fff',
                  transition: 'background 0.18s',
                  animation: `mn-fadein 0.4s ease ${i * 0.05}s both`,
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#fafafa'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#fff'}
              >
                <div style={{ marginBottom: 16 }}>
                  <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                    {s.icon.split(' M').map((d, j) => (
                      <path key={j} d={j === 0 ? d : 'M' + d} />
                    ))}
                  </svg>
                </div>
                <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 8, letterSpacing: '-0.15px' }}>{s.title}</h3>
                <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, color: '#6b7280', lineHeight: 1.72 }}>{s.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          4. IMÓVEIS EM DESTAQUE
      ══════════════════════════════════════════ */}
      <section id="imoveis-destaque" style={{ background: '#f8fafc' }} className="mn-section">
        <div className="mn-container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
            <div>
              <SectionTag label="Imóveis em Destaque" color={primary} />
              <H2>Casas Ideais para o Seu Estilo de Vida</H2>
            </div>
            <Link to="/imoveis"
              style={{ padding: '9px 18px', borderRadius: 10, border: `1.5px solid ${primary}`, color: primary, fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none', flexShrink: 0, transition: 'all 0.15s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = primary; (e.currentTarget as HTMLElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; (e.currentTarget as HTMLElement).style.color = primary; }}>
              Ver Todos →
            </Link>
          </div>

          {properties.length > 0 ? (
            <div className="mn-props-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {properties.map((p, i) => (
                <ModernPropertyCard key={p.id} property={p} primaryColor={primary} index={i} />
              ))}
            </div>
          ) : (
            <div className="mn-props-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 18 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 16, overflow: 'hidden', border: '1.5px solid #f1f5f9', background: '#fff', animation: `mn-fadein 0.4s ease ${i*0.05}s both` }}>
                  <div className="mn-shimmer" style={{ height: 210 }} />
                  <div style={{ padding: 18 }}>
                    <div className="mn-shimmer" style={{ height: 12, borderRadius: 6, width: '48%', marginBottom: 10 }} />
                    <div className="mn-shimmer" style={{ height: 16, borderRadius: 6, width: '78%', marginBottom: 12 }} />
                    <div className="mn-shimmer" style={{ height: 22, borderRadius: 6, width: '38%' }} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════
          5. QUEM SOMOS
      ══════════════════════════════════════════ */}
      <section style={{ background: '#f8fafc' }} className="mn-section">
        <div className="mn-container">
          <div className="mn-about-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center' }}>
            {/* Imagem */}
            <div style={{ position: 'relative', borderRadius: 22, overflow: 'hidden', aspectRatio: '4/3', background: '#e2e8f0' }}>
              {siteData.about_image_url ? (
                <img src={siteData.about_image_url} alt="Quem somos" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : (
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg,#e2e8f0,#cbd5e1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <svg width="80" height="80" viewBox="0 0 24 24" fill="#94a3b8" opacity="0.45">
                    <path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/>
                  </svg>
                </div>
              )}
              {/* Stat overlay */}
              <div style={{ position: 'absolute', bottom: 18, right: 18, background: '#fff', borderRadius: 14, padding: '13px 20px', boxShadow: '0 6px 24px rgba(0,0,0,0.12)' }}>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 26, fontWeight: 800, color: primary, letterSpacing: '-0.05em' }}>90%</div>
                <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#64748b', fontWeight: 600 }}>Taxa de Retenção</div>
              </div>
            </div>

            {/* Texto */}
            <div>
              <SectionTag label="Quem Somos" color={primary} />
              <H2 style={{ marginBottom: 18 }}>Redefinindo a Excelência Imobiliária</H2>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, color: '#64748b', lineHeight: 1.85, marginBottom: 28 }}>
                {siteData.about_text || `Fundados com paixão por espaços residenciais excepcionais, nos especializamos em imóveis de luxo, residências sustentáveis e temporadas premium. Nossa jornada é definida por um compromisso com qualidade, inovação e satisfação do cliente.`}
              </p>

              {/* Lista de diferenciais */}
              {[
                { title: 'Nossa Visão', desc: 'Ser referência no mercado imobiliário, oferecendo serviços incomparáveis em luxo, sustentabilidade e locações.' },
                { title: 'Equipe Especializada', desc: 'Profissionais experientes em imóveis de alto padrão, habitação sustentável e locações de temporada.' },
                { title: 'Soluções Personalizadas', desc: 'Serviços customizados alinhados com seus objetivos de estilo de vida e investimento, garantindo uma experiência única.' },
              ].map((item, i) => (
                <div key={i} style={{ display: 'flex', gap: 14, marginBottom: 20, paddingBottom: 20, borderBottom: i < 2 ? '1px solid #f1f5f9' : 'none' }}>
                  <div style={{ width: 34, height: 34, borderRadius: 10, background: `${primary}18`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 2 }}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={primary} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 4 }}>{item.title}</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>{item.desc}</div>
                  </div>
                </div>
              ))}

              <Link to="/sobre" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '12px 24px', borderRadius: 11, background: primary, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none', marginTop: 8, transition: 'opacity 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity='0.88'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity='1'}>
                Conheça Nossa Equipe →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          6. TESTEMUNHOS
      ══════════════════════════════════════════ */}
      <section style={{ background: '#fff' }} className="mn-section">
        <div className="mn-container">
          <div style={{ textAlign: 'center', marginBottom: 48 }}>
            <SectionTag label="O Que Dizem Nossos Clientes" color={primary} />
            <H2>Confiado por Muitos, Amado por Todos</H2>
            <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, color: '#64748b', maxWidth: 480, margin: '12px auto 0', lineHeight: 1.8 }}>
              As histórias de sucesso de nossos clientes refletem nosso comprometimento com a excelência.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(260px,1fr))', gap: 18 }}>
            {TESTIMONIALS.map((t, i) => (
              <div key={i} className="mn-testimonial-card" style={{ animation: `mn-fadein 0.45s ease ${i*0.07}s both` }}>
                {/* Estrelas */}
                <div style={{ display: 'flex', gap: 3, marginBottom: 14 }}>
                  {[1,2,3,4,5].map(s => (
                    <svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24">
                      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01z"/>
                    </svg>
                  ))}
                </div>
                <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#374151', lineHeight: 1.75, marginBottom: 18, fontStyle: 'italic' }}>
                  "{t.text}"
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 38, height: 38, borderRadius: '50%', background: `${primary}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 800, color: primary }}>{t.name[0]}</span>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{t.name}</div>
                    <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 12, color: '#94a3b8' }}>{t.role}</div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════
          7. FAQ + CONTATO (lado a lado)
      ══════════════════════════════════════════ */}
      <section style={{ background: '#f8fafc' }} className="mn-section">
        <div className="mn-container">
          <div className="mn-contact-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'start' }}>

            {/* FAQ */}
            <div>
              <SectionTag label="Perguntas Frequentes" color={primary} />
              <H2 style={{ marginBottom: 32 }}>Dúvidas? Temos Respostas</H2>
              <div>
                {faqs.map((f: any, i: number) => (
                  <FaqItem key={i} q={f.q} a={f.a} color={primary} />
                ))}
              </div>
            </div>

            {/* Formulário de contato */}
            <div>
              <SectionTag label="Fale Conosco" color={primary} />
              <H2 style={{ marginBottom: 10 }}>Vamos Tornar Sua Jornada Imobiliária Fácil</H2>
              <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, color: '#64748b', lineHeight: 1.8, marginBottom: 32 }}>
                Tem perguntas ou está pronto para dar o próximo passo? Nossa equipe está aqui para guiar você.
              </p>

              {sent ? (
                <div style={{ padding: '32px 24px', borderRadius: 16, background: `${primary}10`, border: `1.5px solid ${primary}30`, textAlign: 'center' }}>
                  <div style={{ fontSize: 40, marginBottom: 12 }}>✓</div>
                  <h3 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Mensagem Enviada!</h3>
                  <p style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, color: '#64748b', lineHeight: 1.7 }}>Em breve um de nossos especialistas entrará em contato.</p>
                </div>
              ) : (
                <form onSubmit={handleLead} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                    <input className="mn-form-input" placeholder="Seu nome *" value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} required />
                    <input className="mn-form-input" type="email" placeholder="Seu e-mail *" value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} required />
                  </div>
                  <input className="mn-form-input" placeholder="WhatsApp / Telefone" value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))} />
                  <textarea className="mn-form-input" placeholder="Como podemos ajudá-lo?" value={form.message} onChange={e => setForm(p => ({ ...p, message: e.target.value }))} rows={4} style={{ resize: 'none' }} />
                  <button type="submit" disabled={sending} style={{ padding: '14px', borderRadius: 11, background: primary, color: '#fff', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 15, fontWeight: 700, border: 'none', cursor: sending ? 'wait' : 'pointer', opacity: sending ? 0.7 : 1, transition: 'opacity 0.15s,transform 0.15s' }}
                    onMouseEnter={e => { if (!sending) (e.currentTarget as HTMLElement).style.opacity='0.88'; }}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity=sending?'0.7':'1'}>
                    {sending ? 'Enviando…' : 'Enviar Mensagem →'}
                  </button>
                  {siteData.social?.whatsapp && (
                    <a href={`https://wa.me/${siteData.social.whatsapp.replace(/\D/g,'')}?text=${encodeURIComponent('Olá! Gostaria de mais informações sobre imóveis.')}`} target="_blank" rel="noopener noreferrer"
                      style={{ padding: '13px', borderRadius: 11, border: '1.5px solid #bbf7d0', background: '#f0fdf4', color: '#15803d', fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: 14, fontWeight: 700, textDecoration: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, transition: 'all 0.15s' }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#dcfce7'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='#f0fdf4'}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="#15803d"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                      Conversar no WhatsApp
                    </a>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
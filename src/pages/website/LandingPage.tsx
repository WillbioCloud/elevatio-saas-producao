import React, { useState, useEffect, useRef, useLayoutEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollSmoother } from 'gsap/ScrollSmoother';
import { Bot, Check, FileSignature, Globe, Headset, Kanban, Target, X, Zap } from 'lucide-react';
import { supabase } from '../../lib/supabase';

gsap.registerPlugin(ScrollTrigger, ScrollSmoother);

// ============================================================
// ELEVATIO VENDAS — Landing Page SaaS (Versão Fundida)
// Cards: novo design Webflow | Comparação: tabela completa
// ============================================================

interface SaaSPlan {
  id?: string;
  name: string;
  price: number | string;
  description?: string;
  is_popular?: boolean;
  badge?: string;
  features?: string[];
  [key: string]: any;
}

// ── Linhas da tabela de comparação (completa do antigo) ──────
type PlanComparisonFeature = {
  name: string;
  key: string;
  type?: 'boolean' | 'text';
};

const TESTIMONIALS = [
  { name: 'Rafael Duarte', company: 'Horizonte Imóveis', role: 'Diretor Comercial', quote: 'O sistema otimizou nosso fluxo de trabalho e facilitou a gestão dos leads. A integração com o site foi rápida e prática.', avatar: 'RD' },
  { name: 'Camila Torres', company: 'Nova Casa Group', role: 'Gestora Imobiliária', quote: 'A plataforma é fácil de usar e o suporte sempre eficiente. Centralizamos todos os imóveis e contatos em um só lugar.', avatar: 'CT' },
  { name: 'Lucas Prado', company: 'Prime Brokers', role: 'CEO', quote: 'A automação de tarefas e relatórios detalhados trouxeram mais controle e agilidade para nossa equipe.', avatar: 'LP' },
  { name: 'Fernanda Reis', company: 'Elite Realty', role: 'Coordenadora de Vendas', quote: 'A variedade de planos e templates personalizáveis atendeu exatamente às nossas necessidades de negócio.', avatar: 'FR' },
];

const FAQS = [
  { q: 'Como funciona o funil de leads?', a: 'Gerencie e acompanhe leads facilmente pelo Kanban visual, otimizando oportunidades e automatizando tarefas diárias.' },
  { q: 'Posso trocar de plano quando quiser?', a: 'Sim, a alteração de plano é simples e pode ser feita a qualquer momento pelo painel. O ajuste de valor é feito na próxima cobrança.' },
  { q: 'Quais integrações a plataforma oferece?', a: 'Integração com portais imobiliários, marketing digital, pagamentos via Asaas e assistente de IA para automação de descrições.' },
  { q: 'Há limite de usuários ou imóveis?', a: 'Cada plano tem limites próprios. O plano Elite oferece usuários e imóveis ilimitados para grandes operações.' },
  { q: 'Como é feita a cobrança dos planos?', a: 'A cobrança é mensal, feita automaticamente. Cancelamentos são processados pelo painel e o acesso continua até o fim do período pago.' },
];

const STATS = [
  { value: '1K+', label: 'Sites criados para imobiliárias' },
  { value: '100%', label: 'Disponibilidade garantida' },
  { value: '1.600', label: 'Leads gerenciados por mês' },
  { value: '+3M', label: 'Imóveis cadastrados' },
];

const FEATURES_LIST = [
  { step: '01', title: 'Escolha seu template', desc: '4 templates premium: Classic, Minimalist, Luxury e Modern. Personalize cores, logo e conteúdo pelo painel.' },
  { step: '02', title: 'Gerencie com CRM Kanban', desc: 'Pipeline visual de leads, automação de tarefas e distribuição inteligente para sua equipe de corretores.' },
  { step: '03', title: 'Publique e acompanhe ao vivo', desc: 'Site no ar em minutos. Edite, publique e acompanhe visitas, leads e conversões em tempo real.' },
];

// ── Hooks ─────────────────────────────────────────────────────
const useIsomorphicLayoutEffect = typeof window !== 'undefined' ? useLayoutEffect : useEffect;

function useScrollSmoother() {
  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      ScrollSmoother.create({
        wrapper: '#smooth-wrapper',
        content: '#smooth-content',
        smooth: 1.2,
        effects: true,
      });
    });
    return () => ctx.revert();
  }, []);
}

// Scroll suave compatível com ScrollSmoother
function scrollToSection(id: string) {
  const smoother = ScrollSmoother.get();
  if (smoother) {
    smoother.scrollTo(`#${id}`, true, 'top 72px');
  } else {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  }
}

function useFadeIn(ref: React.RefObject<HTMLElement>, opts?: { y?: number; stagger?: number; selector?: string }) {
  useLayoutEffect(() => {
    if (!ref.current) return;
    const targets = opts?.selector ? ref.current.querySelectorAll(opts.selector) : [ref.current];
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0, y: opts?.y ?? 30, duration: 0.7, ease: 'power2.out',
        stagger: opts?.stagger ?? 0,
        scrollTrigger: { trigger: ref.current!, start: 'top 92%', once: true },
      });
    });
    return () => ctx.revert();
  }, []);
}

// ── NAVBAR MEGAMENU DATA ──────────────────────────────────────
const MENU_GESTAO = [
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>,
    label: 'Kanban de Leads', desc: 'Organize e acompanhe seus leads facilmente.',
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/></svg>,
    label: 'Edição de Site', desc: 'Personalize seu site com templates exclusivos.',
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
    label: 'ERP Integrado', desc: 'Controle financeiro e contratos em um só lugar.',
  },
];
const MENU_FUNC = [
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>,
    label: 'Automação', desc: 'Automatize tarefas e ganhe produtividade.',
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
    label: 'Relatórios', desc: 'Acompanhe resultados com relatórios avançados.',
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>,
    label: 'Gamificação', desc: 'Motivação extra para sua equipe de vendas.',
  },
  {
    icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
    label: 'Contratos', desc: 'Gerencie contratos e documentos importantes.',
  }
];
const MENU_PLANS: { label: string; desc: string; highlight?: boolean }[] = [
  { label: 'Starter', desc: 'Para corretores iniciantes e autônomos.' },
  { label: 'Basic', desc: 'Para pequenas equipes em crescimento.' },
  { label: 'Profissional', desc: 'O padrão da indústria consolidada.', highlight: true },
  { label: 'Business', desc: 'Controle total e automação avançada.' },
  { label: 'Premium', desc: 'Tecnologia de ponta com IA.' },
  { label: 'Elite', desc: 'Recursos ilimitados para grandes negócios.' },
];

// ── NAVBAR ────────────────────────────────────────────────────
const Navbar: React.FC = () => {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', fn);
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from(ref.current, { opacity: 0, y: -20, duration: 0.5, ease: 'power2.out' });
    });
    return () => ctx.revert();
  }, []);

  // Hover com delay de fechamento para evitar flicker
  const handleMouseEnter = () => {
    if (hoverTimer.current) clearTimeout(hoverTimer.current);
    setMenuOpen(true);
  };
  const handleMouseLeave = () => {
    hoverTimer.current = setTimeout(() => setMenuOpen(false), 150);
  };

  const textColor = scrolled ? '#1e293b' : '#ffffff';
  const bgDropdown: React.CSSProperties = {
    position: 'absolute', top: 'calc(100% + 8px)', left: '50%', transform: 'translateX(-50%)',
    width: 920, background: '#fff', borderRadius: 20,
    boxShadow: '0 24px 64px rgba(15,23,42,0.14), 0 2px 12px rgba(15,23,42,0.06)',
    border: '1px solid #e2e8f0', padding: '28px',
    display: menuOpen ? 'grid' : 'none',
    gridTemplateColumns: '1fr 1px 1fr 1px 0.85fr',
    gap: 0, zIndex: 300,
    animation: menuOpen ? 'ev-dropdown-in 0.22s cubic-bezier(.4,0,.2,1) forwards' : 'none',
  };

  return (
    <header ref={ref} style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 200, transition: 'all 0.35s ease', background: scrolled ? 'rgba(255,255,255,0.97)' : 'transparent', backdropFilter: scrolled ? 'blur(16px)' : 'none', borderBottom: scrolled ? '1px solid rgba(0,0,0,0.05)' : '1px solid transparent', boxShadow: scrolled ? '0 4px 30px rgba(0,0,0,0.05)' : 'none' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', height: 72, display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'relative' }}>

        {/* Logo */}
        <a href="#" className="-m-1.5 flex shrink-0 items-center gap-3 p-1.5 transition-opacity hover:opacity-80">
          <span className="sr-only">Elevatio Vendas</span>
          <img src="/logo/logo.png" alt="Elevatio Vendas Logo" className="h-10 w-auto object-contain drop-shadow-md" />
          <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 20, letterSpacing: '-0.5px', color: scrolled ? '#0f172a' : '#ffffff' }}>
            Elevatio<span style={{ color: '#0ea5e9' }}>Vendas</span>
          </span>
        </a>

        {/* Nav links */}
        <nav style={{ display: 'flex', gap: 4, alignItems: 'center' }} className="ev-nav-desktop">

          <button onClick={() => scrollToSection('hero')} className="ev-nav-link ev-nav-btn" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: textColor, transition: 'color 0.2s', padding: '8px 14px', borderRadius: 8 }}>Início</button>

          {/* Recursos com megamenu hover */}
          <div
            style={{ position: 'relative' }}
            onMouseEnter={handleMouseEnter}
            onMouseLeave={handleMouseLeave}
          >
            <button
              onClick={() => { scrollToSection('solucoes'); setMenuOpen(false); }}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, color: menuOpen ? '#1a56db' : textColor, background: menuOpen ? (scrolled ? 'rgba(26,86,219,0.07)' : 'rgba(255,255,255,0.12)') : 'none', border: 'none', cursor: 'pointer', padding: '8px 14px', borderRadius: 8, transition: 'all 0.2s' }}
            >
              Recursos
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ transition: 'transform 0.2s', transform: menuOpen ? 'rotate(180deg)' : 'rotate(0deg)', opacity: 0.65 }}><path d="M6 9l6 6 6-6"/></svg>
            </button>

            {/* ── MEGAMENU DROPDOWN ── */}
            <div style={bgDropdown}>

              {/* Col 1 — Gestão */}
              <div style={{ paddingRight: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg, #1a56db, #0ea5e9)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase' as const }}>Gestão de Imóveis</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                  {MENU_GESTAO.map((item, i) => (
                    <button key={i} onClick={() => { scrollToSection('solucoes'); setMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s', width: '100%', textAlign: 'left' as const }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, rgba(26,86,219,0.1), rgba(14,165,233,0.06))', border: '1px solid rgba(26,86,219,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, color: '#1a56db' }}>{item.icon}</div>
                      <div>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, background: '#f1f5f9', margin: '0 4px' }} />

              {/* Col 2 — Funcionalidades */}
              <div style={{ padding: '0 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase' as const }}>Funcionalidades</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 2 }}>
                  {MENU_FUNC.map((item, i) => (
                    <button key={i} onClick={() => { scrollToSection('solucoes'); setMenuOpen(false); }}
                      style={{ display: 'flex', alignItems: 'flex-start', gap: 12, padding: '10px 12px', borderRadius: 12, background: 'none', border: 'none', cursor: 'pointer', transition: 'background 0.15s', width: '100%', textAlign: 'left' as const }}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f0f7ff'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    >
                      <div style={{ width: 34, height: 34, borderRadius: 9, background: 'linear-gradient(135deg, rgba(14,165,233,0.1), rgba(56,189,248,0.06))', border: '1px solid rgba(14,165,233,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1, color: '#0ea5e9' }}>{item.icon}</div>
                      <div>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: '#0f172a', marginBottom: 2 }}>{item.label}</div>
                        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#64748b', lineHeight: 1.4 }}>{item.desc}</div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider */}
              <div style={{ width: 1, background: '#f1f5f9', margin: '0 4px' }} />

              {/* Col 3 — Planos + CTA */}
              <div style={{ paddingLeft: 24 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', flexShrink: 0 }} />
                  <span style={{ fontSize: 11, fontFamily: "'DM Sans',sans-serif", fontWeight: 700, letterSpacing: '0.1em', color: '#94a3b8', textTransform: 'uppercase' as const }}>Planos</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 8px', marginBottom: 16 }}>
                  {MENU_PLANS.map((p, i) => (
                    <a key={i} href={`/admin/login?mode=signup&plan=${p.label.toLowerCase()}`}
                      style={{ display: 'block', padding: '8px 10px', borderRadius: 10, textDecoration: 'none', transition: 'all 0.15s',
                        background: p.highlight ? 'linear-gradient(135deg, #1a56db, #0ea5e9)' : '#f8fafc',
                        border: p.highlight ? 'none' : '1px solid #e8edf5',
                        boxShadow: p.highlight ? '0 4px 12px rgba(26,86,219,0.2)' : 'none',
                      }}
                      onMouseEnter={e => { if (!p.highlight) { (e.currentTarget as HTMLElement).style.background = '#f0f7ff'; (e.currentTarget as HTMLElement).style.borderColor = '#bfdbfe'; } }}
                      onMouseLeave={e => { if (!p.highlight) { (e.currentTarget as HTMLElement).style.background = '#f8fafc'; (e.currentTarget as HTMLElement).style.borderColor = '#e8edf5'; } }}
                    >
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: p.highlight ? '#fff' : '#0f172a', marginBottom: 1 }}>{p.label}</div>
                      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 10, color: p.highlight ? 'rgba(255,255,255,0.7)' : '#94a3b8', lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' as const }}>
                        {p.desc.length > 26 ? p.desc.slice(0, 26) + '…' : p.desc}
                      </div>
                    </a>
                  ))}
                </div>

                {/* CTA card dentro do dropdown */}
                <div style={{ background: 'linear-gradient(135deg, #0f2460, #1a3a7a)', borderRadius: 14, padding: '16px', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ position: 'absolute', top: -20, right: -20, width: 80, height: 80, borderRadius: '50%', background: 'rgba(14,165,233,0.18)', pointerEvents: 'none' }} />
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: '#fff', marginBottom: 4, position: 'relative', lineHeight: 1.3 }}>Escolha o plano ideal para crescer</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 12, lineHeight: 1.45, position: 'relative' }}>Compare recursos e encontre a solução perfeita para sua imobiliária.</div>
                  <button onClick={() => { scrollToSection('planos'); setMenuOpen(false); }}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff', padding: '7px 14px', borderRadius: 8, border: 'none', cursor: 'pointer', position: 'relative', transition: 'opacity 0.2s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.85'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
                  >
                    Ver planos
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {[['Planos','planos'],['Comparar','comparar'],['FAQ','faq']].map(([l,id]) => (
            <button key={l} onClick={() => scrollToSection(id)} className="ev-nav-link ev-nav-btn" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', color: textColor, transition: 'color 0.2s', padding: '8px 14px', borderRadius: 8 }}>{l}</button>
          ))}
        </nav>

        {/* CTAs direita */}
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexShrink: 0 }}>
          <a href="/admin/login" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, textDecoration: 'none', color: scrolled ? '#374151' : '#ffffff', padding: '8px 16px', transition: 'opacity 0.2s' }}>Entrar</a>
          <button onClick={() => scrollToSection('planos')} className="ev-btn-primary" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, border: 'none', cursor: 'pointer', padding: '10px 22px', borderRadius: 10 }}>Teste grátis</button>
        </div>
      </div>
    </header>
  );
};

// ── HERO ──────────────────────────────────────────────────────
const Hero: React.FC = () => {
  const heroRef = useRef<HTMLElement>(null);
  const eyebrowRef = useRef<HTMLDivElement>(null);
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const proofRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const ctx = gsap.context(() => {
      const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
      tl.from(eyebrowRef.current, { opacity: 0, y: 15, duration: 0.5, delay: 0.1 })
        .from(h1Ref.current,   { opacity: 0, y: 25, duration: 0.6 }, '-=0.3')
        .from(subRef.current,  { opacity: 0, y: 20, duration: 0.6 }, '-=0.4')
        .from(ctaRef.current,  { opacity: 0, y: 15, duration: 0.5 }, '-=0.4')
        .from(proofRef.current,{ opacity: 0, y: 15, duration: 0.5 }, '-=0.3');
      gsap.to('.ev-orb-1', { y: -120, ease: 'none', scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: 1 }});
      gsap.to('.ev-orb-2', { y: -60,  ease: 'none', scrollTrigger: { trigger: heroRef.current, start: 'top top', end: 'bottom top', scrub: 1.5 }});
    });
    return () => ctx.revert();
  }, []);

  return (
    <section id="hero" ref={heroRef} style={{ minHeight: '100vh', background: 'linear-gradient(150deg, #0c1445 0%, #0f2460 35%, #1a3a7a 65%, #0c2d6e 100%)', display: 'flex', alignItems: 'center', position: 'relative', overflow: 'hidden', paddingTop: 72 }}>
      <div className="ev-orb-1" style={{ position: 'absolute', top: '10%', right: '5%', width: 500, height: 500, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.15) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div className="ev-orb-2" style={{ position: 'absolute', bottom: '5%', left: '-5%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,86,219,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', inset: 0, backgroundImage: 'linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px)', backgroundSize: '60px 60px', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 32px', width: '100%', position: 'relative' }}>
        <div style={{ maxWidth: 700 }}>
          <div ref={eyebrowRef} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', borderRadius: 100, padding: '6px 16px', marginBottom: 28 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#0ea5e9', animation: 'ev-pulse 2s infinite' }} />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: '#bae6fd', letterSpacing: '0.05em' }}>Tudo para sua imobiliária crescer</span>
          </div>
          <h1 ref={h1Ref} style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(42px,6vw,72px)', fontWeight: 800, lineHeight: 1.08, letterSpacing: '-2px', color: '#ffffff', marginBottom: 24 }}>
            Site e CRM<br />
            <span style={{ background: 'linear-gradient(90deg, #38bdf8, #7dd3fc, #e0f2fe)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>em um só lugar</span>
          </h1>
          <p ref={subRef} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 20, lineHeight: 1.65, color: 'rgba(255,255,255,0.8)', marginBottom: 44, maxWidth: 560 }}>
            Gerencie imóveis, leads e equipe com automação, Kanban e templates exclusivos. Escolha o plano ideal e simplifique sua rotina.
          </p>
          <div ref={ctaRef} style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <button onClick={() => scrollToSection('planos')} className="ev-btn-primary" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', padding: '16px 36px', borderRadius: 12, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Ver planos <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </button>
            <button onClick={() => scrollToSection('solucoes')} className="ev-btn-secondary" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, border: 'none', cursor: 'pointer', padding: '16px 36px', borderRadius: 12 }}>Demonstração</button>
          </div>
          <div ref={proofRef} style={{ marginTop: 56, display: 'flex', alignItems: 'center', gap: 20 }}>
            <div style={{ display: 'flex' }}>
              {['RD','CT','LP','FR'].map((ini,i) => (
                <div key={i} style={{ width: 36, height: 36, borderRadius: '50%', background: `hsl(${210+i*20},70%,55%)`, border: '2px solid rgba(12,20,69,0.8)', marginLeft: i>0?-10:0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans',sans-serif" }}>{ini}</div>
              ))}
            </div>
            <div>
              <div style={{ display: 'flex', gap: 2, marginBottom: 2 }}>{[1,2,3,4,5].map(s=><svg key={s} width="14" height="14" viewBox="0 0 24 24" fill="#fbbf24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
              <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>+1.000 imobiliárias já usam</span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── STATS — contador animado com IntersectionObserver ─────────
// Sem GSAP aqui: a seção fica logo após o hero, então ScrollTrigger
// não é confiável (seção pode já estar visível no mount).
// IntersectionObserver é mais simples e sempre funciona.
const STATS_PARSED = [
  { num: 200,    prefix: '+',  suffix: '', label: 'Sites criados para imobiliárias' },
  { num: 100,  prefix: '',  suffix: '%',  label: 'Disponibilidade garantida' },
  { num: 1600, prefix: '',  suffix: '',   label: 'Leads gerenciados por mês (possibilidades infinitas)' },
  { num: 3,    prefix: '+', suffix: 'M',  label: 'Imóveis cadastrados' },
];

const StatCounter: React.FC<{ num: number; prefix: string; suffix: string; label: string; index: number }> = ({ num, prefix, suffix, label, index }) => {
  const [display, setDisplay] = useState('0');
  const [visible, setVisible] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hasRun = useRef(false);

  // IntersectionObserver dispara quando o elemento entra na tela
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting && !hasRun.current) { setVisible(true); hasRun.current = true; } },
      { threshold: 0.3 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  // Contador numérico via requestAnimationFrame
  useEffect(() => {
    if (!visible) return;
    const delayMs = index * 120;
    const duration = 2000;
    let start: number | null = null;
    let raf: number;

    const step = (ts: number) => {
      if (!start) start = ts;
      const elapsed = ts - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      const current = Math.round(eased * num);
      setDisplay(current.toLocaleString('pt-BR'));
      if (progress < 1) raf = requestAnimationFrame(step);
      else setDisplay(num.toLocaleString('pt-BR')); // valor final exato
    };

    const timeout = setTimeout(() => { raf = requestAnimationFrame(step); }, delayMs);
    return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
  }, [visible]);

  return (
    <div ref={ref} className="ev-stat" style={{
      padding: '32px 24px', textAlign: 'center',
      opacity: visible ? 1 : 0,
      transform: visible ? 'translateY(0)' : 'translateY(24px)',
      transition: `opacity 0.7s ease ${index * 0.12}s, transform 0.7s ease ${index * 0.12}s`,
    }}>
      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(36px,4vw,52px)', fontWeight: 800, letterSpacing: '-2px', lineHeight: 1, background: 'linear-gradient(135deg, #1a56db, #0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', marginBottom: 8 }}>
        {prefix}{display}{suffix}
      </div>
      <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: '#64748b' }}>{label}</div>
    </div>
  );
};

const Stats: React.FC = () => (
  <section style={{ background: '#fff', borderBottom: '1px solid #f1f5f9' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '72px 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
        {STATS_PARSED.map((s, i) => (
          <div key={i} style={{ borderRight: i < STATS_PARSED.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
            <StatCounter {...s} index={i} />
          </div>
        ))}
      </div>
    </div>
  </section>
);

// ── SOLUÇÕES ──────────────────────────────────────────────────
const Solucoes: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  useFadeIn(ref, { selector: '.ev-sol-card', stagger: 0.08, y: 36 });

  const gestaoItems = [
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>, label: 'Kanban de Leads', desc: 'Organize e acompanhe seus leads facilmente.' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 15a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1H5a1 1 0 01-1-1v-4z"/><path d="M14 16h6M17 13v6"/></svg>, label: 'Edição de Site', desc: 'Personalize seu site com templates exclusivos.' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>, label: 'ERP Integrado', desc: 'Controle financeiro e contratos em um só lugar.' },
  ];

  const funcItems = [
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>, label: 'Automação', desc: 'Automatize tarefas e ganhe produtividade.' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>, label: 'Relatórios', desc: 'Acompanhe resultados com relatórios avançados.' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>, label: 'Gamificação', desc: 'Motivação extra para sua equipe de vendas.' },
    { icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 01-2 2H5l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/></svg>, label: 'Contratos', desc: 'Crie e gerencie contratos digitais facilmente.' },
  ];

  const planItems = [
    { label: 'Starter', desc: 'Para corretores iniciantes e autônomos.' },
    { label: 'Basic', desc: 'Para pequenas equipes em crescimento.' },
    { label: 'Profissional', desc: 'O padrão da indústria imobiliária.', highlight: true },
    { label: 'Business', desc: 'Controle total e automação avançada.' },
    { label: 'Premium', desc: 'Tecnologia de ponta com IA.' },
    { label: 'Elite', desc: 'Recursos ilimitados para grandes negócios.' },
  ];

  const ItemRow: React.FC<{ icon: React.ReactNode; label: string; desc: string; accent?: string }> = ({ icon, label, desc, accent = '#1a56db' }) => (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', borderRadius: 14, transition: 'background 0.15s', cursor: 'default' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#f8fafc'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
    >
      <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: `linear-gradient(135deg, ${accent}18, ${accent}0d)`, border: `1px solid ${accent}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: accent, marginTop: 1 }}>
        {icon}
      </div>
      <div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: '#0f172a', marginBottom: 3 }}>{label}</div>
        <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: '#64748b', lineHeight: 1.45 }}>{desc}</div>
      </div>
    </div>
  );

  return (
    <section id="solucoes" ref={ref} style={{ background: '#fff', padding: '104px 0 96px', borderBottom: '1px solid #f1f5f9' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'rgba(26,86,219,0.07)', border: '1px solid rgba(26,86,219,0.15)', borderRadius: 100, padding: '5px 16px', marginBottom: 18 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#1a56db' }} />
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: '#1a56db', letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>Soluções completas</span>
          </div>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(32px,4vw,52px)', fontWeight: 800, letterSpacing: '-1.5px', color: '#0f172a', marginBottom: 16, lineHeight: 1.1 }}>
            Tudo que sua imobiliária<br />
            <span style={{ background: 'linear-gradient(90deg, #1a56db, #0ea5e9)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>precisa para crescer</span>
          </h2>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, color: '#64748b', maxWidth: 520, margin: '0 auto', lineHeight: 1.6 }}>
            Do site ao CRM, da automação ao financeiro — uma plataforma pensada para o mercado imobiliário.
          </p>
        </div>

        {/* Grid principal 3 colunas + CTA */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

          {/* Coluna 1 — Gestão de Imóveis */}
          <div className="ev-sol-card" style={{ background: '#f8fafc', borderRadius: 20, padding: '28px 20px 20px', border: '1px solid #e2e8f0' }}>
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #1a56db, #0ea5e9)' }} />
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#1a56db', textTransform: 'uppercase' as const }}>Gestão de Imóveis</span>
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                Controle total do seu portfólio
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const }}>
              {gestaoItems.map((item, i) => <ItemRow key={i} {...item} accent="#1a56db" />)}
            </div>
          </div>

          {/* Coluna 2 — Funcionalidades */}
          <div className="ev-sol-card" style={{ background: 'linear-gradient(145deg, #0f2460, #1a3a7a)', borderRadius: 20, padding: '28px 20px 20px', border: '1px solid rgba(14,165,233,0.2)', boxShadow: '0 20px 60px rgba(26,86,219,0.2)', position: 'relative', overflow: 'hidden' }}>
            {/* Orb decorativo */}
            <div style={{ position: 'absolute', top: -40, right: -40, width: 160, height: 160, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.2) 0%, transparent 70%)', pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', bottom: -30, left: -30, width: 120, height: 120, borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />

            <div style={{ padding: '0 16px 16px', position: 'relative' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#0ea5e9' }} />
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#7dd3fc', textTransform: 'uppercase' as const }}>Funcionalidades</span>
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 19, fontWeight: 800, color: '#fff', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                Mais produtividade para sua equipe
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' as const, position: 'relative' }}>
              {funcItems.map((item, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 14, padding: '14px 16px', borderRadius: 14, transition: 'background 0.15s', cursor: 'default' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                >
                  <div style={{ width: 40, height: 40, borderRadius: 11, flexShrink: 0, background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7dd3fc', marginTop: 1 }}>
                    {item.icon}
                  </div>
                  <div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 3 }}>{item.label}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.55)', lineHeight: 1.45 }}>{item.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Coluna 3 — Planos + CTA */}
          <div className="ev-sol-card" style={{ background: '#f8fafc', borderRadius: 20, padding: '28px 20px 20px', border: '1px solid #e2e8f0', display: 'flex', flexDirection: 'column' as const }}>
            <div style={{ padding: '0 16px 16px' }}>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, marginBottom: 6 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)' }} />
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', color: '#0ea5e9', textTransform: 'uppercase' as const }}>Planos</span>
              </div>
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 19, fontWeight: 800, color: '#0f172a', letterSpacing: '-0.5px', lineHeight: 1.2 }}>
                Do autônomo ao grande player
              </div>
            </div>

            {/* Lista de planos compacta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '0 8px', flex: 1 }}>
              {planItems.map((p, i) => (
                <a key={i} href={`/admin/login?mode=signup&plan=${p.label.toLowerCase()}`}
                  style={{ display: 'block', padding: '10px 12px', borderRadius: 12, textDecoration: 'none', transition: 'all 0.15s',
                    background: p.highlight ? 'linear-gradient(135deg, #1a56db, #0ea5e9)' : '#fff',
                    border: p.highlight ? 'none' : '1px solid #e2e8f0',
                    boxShadow: p.highlight ? '0 4px 16px rgba(26,86,219,0.25)' : 'none',
                  }}
                  onMouseEnter={e => { if (!p.highlight) { (e.currentTarget as HTMLElement).style.borderColor = '#1a56db'; (e.currentTarget as HTMLElement).style.background = '#fafbff'; } }}
                  onMouseLeave={e => { if (!p.highlight) { (e.currentTarget as HTMLElement).style.borderColor = '#e2e8f0'; (e.currentTarget as HTMLElement).style.background = '#fff'; } }}
                >
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, color: p.highlight ? '#fff' : '#0f172a', marginBottom: 2 }}>{p.label}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, color: p.highlight ? 'rgba(255,255,255,0.7)' : '#94a3b8', lineHeight: 1.3 }}>
                    {p.desc.length > 26 ? p.desc.slice(0, 26) + '…' : p.desc}
                  </div>
                </a>
              ))}
            </div>

            {/* CTA card inferior */}
            <div style={{ margin: '16px 8px 0', background: 'linear-gradient(135deg, #0f2460, #1a3a7a)', borderRadius: 16, padding: '20px', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -20, width: 90, height: 90, borderRadius: '50%', background: 'rgba(14,165,233,0.18)', pointerEvents: 'none' }} />
              <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 15, fontWeight: 800, color: '#fff', marginBottom: 6, lineHeight: 1.25, position: 'relative' }}>
                Escolha o plano ideal para crescer
              </div>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.6)', marginBottom: 14, lineHeight: 1.5, position: 'relative' }}>
                Compare recursos e encontre a solução perfeita para sua imobiliária.
              </div>
              <button onClick={() => scrollToSection('planos')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff', padding: '9px 18px', borderRadius: 10, border: 'none', cursor: 'pointer', boxShadow: '0 4px 14px rgba(14,165,233,0.4)', position: 'relative', transition: 'opacity 0.2s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.opacity = '0.88'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.opacity = '1'}
              >
                Ver planos
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

// ── FEATURES ──────────────────────────────────────────────────
const Features: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  useFadeIn(ref, { selector: '.ev-feat', stagger: 0.1, y: 30 });

  const featureIcons = [
    <Kanban className="w-6 h-6 text-blue-500" />,
    <Target className="w-6 h-6 text-blue-500" />,
    <Zap className="w-6 h-6 text-blue-500" />,
  ];

  return (
    <section id="recursos" ref={ref} style={{ background: '#f8fafc', padding: '96px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 72 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Como funciona</span>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(32px,4vw,48px)', fontWeight: 800, letterSpacing: '-1.5px', color: '#0f172a', marginBottom: 16 }}>Seu site e CRM em minutos</h2>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, color: '#64748b', maxWidth: 500, margin: '0 auto' }}>4 templates: Minimalista, Luxuoso, Classic ou sob demanda.</p>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {FEATURES_LIST.map((f, i) => (
            <div key={i} className="ev-feat ev-card-hover" style={{ background: '#fff', borderRadius: 20, padding: '40px 36px', border: '1px solid #e2e8f0', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: -20, right: -10, fontFamily: "'Sora',sans-serif", fontSize: 80, fontWeight: 900, color: 'rgba(26,86,219,0.04)', lineHeight: 1, userSelect: 'none' as const }}>{f.step}</div>
              <div style={{ width: 48, height: 48, borderRadius: 12, marginBottom: 20, background: 'linear-gradient(135deg, rgba(26,86,219,0.1), rgba(14,165,233,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {featureIcons[i]}
              </div>
              <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 12 }}>{f.title}</h3>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: '#64748b', lineHeight: 1.65 }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── PRICING CARDS (novo design Webflow) ───────────────────────
const Pricing: React.FC<{ plans: SaaSPlan[]; loadingPlans: boolean }> = ({ plans, loadingPlans }) => {
  const navigate = useNavigate();
  const [annual, setAnnual] = useState(false);
  const isYearly = annual;
  const ref = useRef<HTMLElement>(null);
  useFadeIn(ref, { selector: '.ev-plan', stagger: 0.08, y: 30 });

  return (
    <section id="planos" ref={ref} style={{ background: '#fff', padding: '96px 0' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Planos e preços</span>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(32px,4vw,48px)', fontWeight: 800, letterSpacing: '-1.5px', color: '#0f172a', marginBottom: 16 }}>Planos flexíveis para todo porte</h2>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, color: '#64748b', marginBottom: 32 }}>Compare recursos e escolha o plano ideal. Teste por 7 dias grátis.</p>

          {/* Toggle mensal/anual */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: '#f1f5f9', borderRadius: 100, padding: '4px 4px 4px 16px' }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: annual ? '#94a3b8' : '#0f172a' }}>Mensal</span>
            <button onClick={() => setAnnual(!annual)} style={{ width: 44, height: 24, borderRadius: 100, border: 'none', cursor: 'pointer', background: annual ? '#1a56db' : '#cbd5e1', position: 'relative', transition: 'background 0.25s' }}>
              <div style={{ position: 'absolute', top: 2, left: annual ? 22 : 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.15)' }} />
            </button>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: annual ? '#0f172a' : '#94a3b8' }}>
              Anual <span style={{ color: '#16a34a', fontSize: 12 }}>−15%</span>
            </span>
          </div>
        </div>

        {loadingPlans ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
            {[1, 2, 3].map((skeleton) => (
              <div
                key={skeleton}
                style={{
                  borderRadius: 20,
                  padding: '32px 28px',
                  border: '1px solid #e2e8f0',
                  background: '#f8fafc',
                  minHeight: 360,
                  animation: 'ev-pulse 1.2s ease-in-out infinite',
                }}
              />
            ))}
          </div>
        ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 20 }}>
          {plans.map((plan, i) => {
            const basePrice = Number(plan.price || 0);
            const price = annual ? basePrice * 0.85 : basePrice;
            const totalAnual = annual ? price * 12 : null;
            return (
              <div key={i} className={`ev-plan ${!plan.is_popular ? 'ev-card-hover' : ''}`} style={{
                borderRadius: 20, padding: '32px 28px', position: 'relative', overflow: 'hidden',
                background: plan.is_popular ? 'linear-gradient(150deg, #1a3a7a, #0f2460)' : '#fff',
                border: plan.is_popular ? '1px solid rgba(14,165,233,0.4)' : '1px solid #e2e8f0',
                boxShadow: plan.is_popular ? '0 24px 64px rgba(26,86,219,0.25)' : '0 2px 12px rgba(0,0,0,0.04)',
                transform: plan.is_popular ? 'scale(1.03)' : 'scale(1)',
                zIndex: plan.is_popular ? 10 : 1,
              }}>
                {plan.badge && (
                  <div style={{ position: 'absolute', top: 16, right: 16, background: 'linear-gradient(135deg, #0ea5e9, #38bdf8)', color: '#fff', fontSize: 11, fontWeight: 700, fontFamily: "'DM Sans',sans-serif", padding: '4px 12px', borderRadius: 100 }}>{plan.badge}</div>
                )}
                <h3 style={{ fontFamily: "'Sora',sans-serif", fontSize: 18, fontWeight: 800, color: plan.is_popular ? '#fff' : '#0f172a', marginBottom: 8 }}>{plan.name}</h3>
                <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: plan.is_popular ? 'rgba(255,255,255,0.7)' : '#64748b', marginBottom: 20 }}>{plan.description}</p>
                <div style={{ marginBottom: 24 }}>
                  <span style={{ fontFamily: "'Sora',sans-serif", fontSize: 36, fontWeight: 900, letterSpacing: '-1.5px', color: plan.is_popular ? '#7dd3fc' : '#1a56db' }}>R${price.toFixed(2).replace('.',',')}</span>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: plan.is_popular ? 'rgba(255,255,255,0.6)' : '#94a3b8' }}>/mês</span>
                  {annual && (
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: plan.is_popular ? '#7dd3fc' : '#0f172a', marginTop: 4 }}>
                      Total anual: <b>R${totalAnual!.toFixed(2).replace('.',',')}</b>
                    </div>
                  )}
                </div>
                <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 28px 0', display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
                  {isYearly && plan.has_free_domain && (
                    <li style={{ display: 'flex', alignItems: 'flex-start', gap: 10, fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 700, color: plan.is_popular ? '#7dd3fc' : '#1a56db' }}>
                      <Check size={20} className="shrink-0" />
                      <span>🎁 Domínio Grátis (1º Ano)</span>
                    </li>
                  )}
                  {(plan.features || []).map((feat, j) => (
                    <li key={j} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                        <circle cx="12" cy="12" r="10" fill={plan.is_popular ? 'rgba(14,165,233,0.2)' : 'rgba(26,86,219,0.08)'}/>
                        <path d="M8 12l3 3 5-6" stroke={plan.is_popular ? '#7dd3fc' : '#1a56db'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: plan.is_popular ? 'rgba(255,255,255,0.9)' : '#475569' }}>{feat}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => navigate(`/admin/login?mode=signup&plan=${plan.name.toLowerCase()}`)}
                  className={plan.is_popular ? 'ev-btn-primary' : 'ev-btn-light'}
                  style={{ display: 'block', width: '100%', textAlign: 'center', fontFamily: "'DM Sans',sans-serif", fontSize: 15, fontWeight: 700, padding: '13px 0', borderRadius: 12, border: 'none', cursor: 'pointer' }}
                >
                  Testar grátis
                </button>
              </div>
            );
          })}
        </div>
        )}

        {/* CTA para ir à comparação */}
        <div style={{ textAlign: 'center', marginTop: 40 }}>
          <button onClick={() => scrollToSection('comparar')} style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 600, color: '#64748b', background: 'none', border: 'none', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6, transition: 'color 0.2s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.color = '#1a56db'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.color = '#64748b'}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 10h18M3 14h18M10 3v18M14 3v18" strokeLinecap="round"/></svg>
            Comparar todos os recursos em detalhe
          </button>
        </div>
      </div>
    </section>
  );
};

// ── COMPARAÇÃO DE PLANOS (tabela completa do antigo, visual novo) ──
const PlanComparison: React.FC<{ plans: any[]; features: PlanComparisonFeature[]; loadingPlans: boolean }> = ({ plans, features, loadingPlans }) => {
  const navigate = useNavigate();
  const ref = useRef<HTMLElement>(null);
  const [annual, setAnnual] = useState(false);
  useFadeIn(ref, { y: 30 });

  useIsomorphicLayoutEffect(() => {
    const scope = ref.current;
    if (!scope) return;

    let cleanup: (() => void) | undefined;

    const ctx = gsap.context(() => {
      const card = document.getElementById('domain-alert-card');
      const orb = document.getElementById('orb-follow');

      if (card && orb) {
        const onMove = (e: MouseEvent) => {
          const rect = card.getBoundingClientRect();
          gsap.to(orb, {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top,
            opacity: 0.4,
            duration: 0.6,
            ease: 'power2.out',
          });
        };

        const onLeave = () => {
          gsap.to(orb, { opacity: 0, duration: 0.5 });
        };

        card.addEventListener('mousemove', onMove);
        card.addEventListener('mouseleave', onLeave);

        cleanup = () => {
          card.removeEventListener('mousemove', onMove);
          card.removeEventListener('mouseleave', onLeave);
        };
      }
    }, scope);

    return () => {
      cleanup?.();
      ctx.revert();
    };
  }, []);

  const featureIcons: Record<string, React.ReactNode> = {
    has_funnel: <Kanban className="w-4 h-4 text-blue-400" />,
    has_gamification: <Target className="w-4 h-4 text-yellow-400" />,
    has_erp: <FileSignature className="w-4 h-4 text-green-400" />,
    aura_access: <Bot className="w-4 h-4 text-purple-400" />,
    support_level: <Headset className="w-4 h-4 text-sky-400" />,
  };

  // Helper: renderiza célula de valor
  const renderCell = (val: any, type?: PlanComparisonFeature['type'], featureKey?: string) => {
    if (type === 'boolean') {
      return val ? (
        <Check className="w-5 h-5 mx-auto text-green-400" strokeWidth={2.5} />
      ) : (
        <X className="w-5 h-5 mx-auto text-red-400" strokeWidth={2.5} />
      );
    }

    if (featureKey === 'max_contracts' && val === 0) {
      return <X className="w-5 h-5 mx-auto text-red-400" strokeWidth={2.5} />;
    }

    if (val === null || val === undefined || val === '') {
      return <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Não</span>;
    }
    if (typeof val === 'string' && val.length > 0) {
      const isIlimitado = val.toLowerCase().includes('ilimitado') || val.toLowerCase().includes('prioridade');
      const isSpecial   = val.toLowerCase().includes('vip') || val.toLowerCase().includes('liberada');
      return (
        <span style={{
          fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600,
          color: isIlimitado ? '#38bdf8' : isSpecial ? '#c084fc' : 'rgba(255,255,255,0.85)',
        }}>{val}</span>
      );
    }
    return <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>{String(val)}</span>;
  };

  return (
    <section id="comparar" ref={ref} style={{ background: '#070d1f', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '96px 0' }}>
      <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px' }}>

        {/* Cabeçalho */}
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#0ea5e9', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Detalhes Completos</span>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 800, letterSpacing: '-1.5px', color: '#fff', marginBottom: 12 }}>Compare os Planos</h2>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 17, color: '#94a3b8', maxWidth: 560, margin: '0 auto 28px' }}>
            Visão detalhada de todos os recursos para ajudar você a tomar a melhor decisão para o seu negócio.
          </p>
          {/* Toggle mensal/anual (sincronizado com os cards) */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 100, padding: '4px 4px 4px 16px' }}>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: annual ? '#475569' : '#e2e8f0' }}>Mensal</span>
            <button onClick={() => setAnnual(!annual)} style={{ width: 40, height: 22, borderRadius: 100, border: 'none', cursor: 'pointer', background: annual ? '#1a56db' : 'rgba(255,255,255,0.2)', position: 'relative', transition: 'background 0.25s' }}>
              <div style={{ position: 'absolute', top: 1, left: annual ? 19 : 1, width: 20, height: 20, borderRadius: '50%', background: '#fff', transition: 'left 0.25s', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
            </button>
            <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 600, color: annual ? '#e2e8f0' : '#475569' }}>
              Anual <span style={{ color: '#4ade80', fontSize: 11 }}>−15%</span>
            </span>
          </div>
        </div>

        <div
          id="domain-alert-card"
          className="relative max-w-4xl mx-auto mb-12 p-6 rounded-2xl bg-slate-900/60 border border-slate-800/80 overflow-hidden group cursor-default"
        >
          <div id="orb-follow" className="absolute w-96 h-96 bg-brand-500/25 rounded-full blur-[80px] opacity-0 pointer-events-none -translate-x-1/2 -translate-y-1/2" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-brand-500/20 flex items-center justify-center text-brand-400 border border-brand-500/30">
              <Globe size={20} />
            </div>
            <p className="text-sm text-slate-400 leading-relaxed">
              <strong className="text-slate-200">Nota:</strong> O valor do domínio não está incluso (.com.br ~R$40 | .com ~R$70). A configuração técnica e o apontamento são por nossa conta.
            </p>
          </div>
        </div>

        {/* Tabela */}
        <div className="ev-custom-scrollbar" style={{ overflowX: 'auto', paddingBottom: 8 }}>
          {loadingPlans && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 220, color: '#94a3b8', fontFamily: "'DM Sans',sans-serif" }}>
              Carregando planos...
            </div>
          )}
          {!loadingPlans && (
          <table style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', minWidth: 1020 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                {/* Coluna fixa: recurso */}
                <th style={{ padding: '16px 20px', background: '#070d1f', position: 'sticky', left: 0, zIndex: 20, minWidth: 230, fontFamily: "'Sora',sans-serif", color: 'rgba(255,255,255,0.5)', fontSize: 12, fontWeight: 700, letterSpacing: '0.05em', textTransform: 'uppercase' as const }}>
                  Recurso
                </th>
                {plans.map((plan, i) => {
                  const price = annual ? Number(plan.price || 0) * 0.85 : Number(plan.price || 0);
                  const isPro = plan.is_popular;
                  return (
                    <th key={i} style={{ padding: '12px 16px', textAlign: 'center', minWidth: 130, background: isPro ? 'rgba(14,165,233,0.08)' : '#070d1f', borderLeft: '1px solid rgba(255,255,255,0.05)' }}>
                      {isPro && <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 9, fontWeight: 800, color: '#38bdf8', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 4 }}>⭐ Popular</div>}
                      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 800, color: isPro ? '#7dd3fc' : '#fff', marginBottom: 2 }}>{plan.name}</div>
                      <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 13, fontWeight: 700, color: isPro ? '#93c5fd' : '#0ea5e9' }}>
                        R${price.toFixed(2).replace('.',',')}
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>

            <tbody style={{ fontSize: 14, color: '#cbd5e1' }}>
              {features.map((feature) => (
                <tr key={feature.key} className="ev-row-hover" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <td style={{ padding: '14px 20px', background: '#070d1f', position: 'sticky', left: 0, zIndex: 10, display: 'flex', alignItems: 'center', gap: 8, boxShadow: '4px 0 20px -8px rgba(0,0,0,0.6)' }}>
                    {featureIcons[feature.key] && <span style={{ display: 'inline-flex', flexShrink: 0 }}>{featureIcons[feature.key]}</span>}
                    <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, fontWeight: 500, color: '#cbd5e1' }}>{feature.name}</span>
                  </td>
                  {plans.map((plan, pi) => {
                    const value = plan[feature.key];
                    const isPro = plan.is_popular;
                    return (
                      <td key={pi} style={{ padding: '14px 16px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.04)', background: isPro ? 'rgba(14,165,233,0.03)' : 'transparent' }}>
                        {renderCell(value, feature.type, feature.key)}
                      </td>
                    );
                  })}
                </tr>
              ))}

              {/* Linha de botões CTA */}
              <tr style={{ borderTop: '2px solid rgba(255,255,255,0.1)' }}>
                <td style={{ padding: '20px', background: '#070d1f', position: 'sticky', left: 0, zIndex: 10 }}>
                  <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, color: '#475569', textTransform: 'uppercase' as const, letterSpacing: '0.06em' }}>Começar</span>
                </td>
                {plans.map((plan, i) => (
                  <td key={i} style={{ padding: '20px 12px', textAlign: 'center', borderLeft: '1px solid rgba(255,255,255,0.04)', background: plan.is_popular ? 'rgba(14,165,233,0.04)' : 'transparent' }}>
                    <button
                      onClick={() => navigate(`/admin/login?mode=signup&plan=${plan.name.toLowerCase()}`)}
                      style={{
                        fontFamily: "'DM Sans',sans-serif", fontSize: 13, fontWeight: 700, cursor: 'pointer',
                        padding: '9px 18px', borderRadius: 10, border: 'none', width: '100%', transition: 'all 0.2s',
                        background: plan.is_popular ? 'linear-gradient(135deg, #1a56db, #0ea5e9)' : 'rgba(255,255,255,0.07)',
                        color: plan.is_popular ? '#fff' : 'rgba(255,255,255,0.7)',
                        boxShadow: plan.is_popular ? '0 4px 14px rgba(14,165,233,0.35)' : 'none',
                      }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1.04)'; (e.currentTarget as HTMLElement).style.opacity = '0.9'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform = 'scale(1)'; (e.currentTarget as HTMLElement).style.opacity = '1'; }}
                    >
                      Assinar
                    </button>
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
          )}
          {!loadingPlans && plans.length === 0 && (
            <div style={{ fontFamily: "'DM Sans',sans-serif", color: '#94a3b8', textAlign: 'center', padding: '24px 0' }}>
              Nenhum plano disponível no momento.
            </div>
          )}
        </div>

        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#334155', textAlign: 'center', marginTop: 16 }}>
          Role horizontalmente para ver todos os planos em telas menores.
        </p>
      </div>
    </section>
  );
};

// ── TESTIMONIALS ──────────────────────────────────────────────
const Testimonials: React.FC<{ dynamicReviews: any[] }> = ({ dynamicReviews }) => {
  const ref = useRef<HTMLElement>(null);
  void TESTIMONIALS;

  useIsomorphicLayoutEffect(() => {
    const scope = ref.current;
    if (!scope || dynamicReviews.length === 0) return;

    const targets = scope.querySelectorAll('.ev-test');
    const ctx = gsap.context(() => {
      gsap.from(targets, {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: 'power2.out',
        stagger: 0.1,
        scrollTrigger: { trigger: scope, start: 'top 92%', once: true },
      });
    }, scope);

    return () => ctx.revert();
  }, [dynamicReviews.length]);

  return (
    <>
      {dynamicReviews.length > 0 && (
        <section ref={ref} style={{ background: '#fff', padding: '96px 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#1a56db', textTransform: 'uppercase' as const, display: 'block', marginBottom: 16 }}>Depoimentos de clientes</span>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-1.5px', color: '#0f172a' }}>Resultados que transformam negócios</h2>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20 }}>
          {dynamicReviews.map((item, i) => {
            const rating = Math.max(0, Math.min(5, Number(item.rating || 0)));
            const t = { role: '', company: '' };

            return (
            <div key={i} className="ev-test ev-card-hover" style={{ background: '#fff', borderRadius: 20, padding: '32px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', gap: 2, marginBottom: 20 }}>{[1,2,3,4,5].map(s=><svg key={s} width="16" height="16" viewBox="0 0 24 24" fill={s <= rating ? '#fbbf24' : '#e5e7eb'}><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>)}</div>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, lineHeight: 1.7, color: '#374151', fontStyle: 'italic', marginBottom: 24 }}>"{item.comment}"</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 44, height: 44, borderRadius: '50%', overflow: 'hidden', background: `linear-gradient(135deg, hsl(${210 + i * 20},70%,55%), hsl(${230 + i * 20},70%,65%))`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14, fontWeight: 700, color: '#fff', fontFamily: "'DM Sans',sans-serif" }}>
                  {item.profiles?.avatar_url ? (
                    <img
                      src={item.profiles.avatar_url}
                      alt={item.profiles?.name || 'Cliente'}
                      style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                    />
                  ) : (
                    item.profiles?.name?.split(' ').filter(Boolean).slice(0, 2).map((part: string) => part[0]).join('').toUpperCase() || 'CL'
                  )}
                </div>
                <div>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.profiles?.name}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#94a3b8' }}>{item.companies?.name}</div>
                </div>
                <div style={{ display: 'none' }}>
                  <div style={{ fontFamily: "'Sora',sans-serif", fontSize: 14, fontWeight: 700, color: '#0f172a' }}>{item.profiles?.name}</div>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: '#94a3b8' }}>{t.role} · {t.company}</div>
                </div>
              </div>
            </div>
            );
          })}
        </div>
      </div>
    </section>
      )}
    </>
  );
};

// ── FAQ ───────────────────────────────────────────────────────
const FAQ: React.FC = () => {
  const [open, setOpen] = useState<number | null>(null);
  const ref = useRef<HTMLElement>(null);
  useFadeIn(ref, { selector: '.ev-faq', stagger: 0.05, y: 20 });
  return (
    <section id="faq" ref={ref} style={{ background: '#f8fafc', padding: '96px 0' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '0 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(28px,4vw,44px)', fontWeight: 800, letterSpacing: '-1.5px', color: '#0f172a', marginBottom: 12 }}>Perguntas frequentes respondidas</h2>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 17, color: '#64748b' }}>Tire dúvidas sobre planos, recursos e integrações.</p>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 8 }}>
          {FAQS.map((faq, i) => (
            <div key={i} className="ev-faq" style={{ border: '1px solid', borderColor: open===i ? '#bfdbfe' : '#e2e8f0', borderRadius: 16, overflow: 'hidden', background: open===i ? '#fafbff' : '#fff', transition: 'all 0.3s ease' }}>
              <button onClick={() => setOpen(open===i ? null : i)} style={{ width: '100%', padding: '20px 24px', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', textAlign: 'left' as const }}>
                <span style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, color: '#0f172a' }}>{faq.q}</span>
                <div style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, background: open===i ? '#1a56db' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'background 0.2s' }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={open===i ? '#fff' : '#64748b'} strokeWidth="2.5" style={{ transform: open===i ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.25s' }}><path d="M6 9l6 6 6-6"/></svg>
                </div>
              </button>
              {open===i && <div style={{ padding: '0 24px 20px 24px' }}><p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 15, color: '#64748b', lineHeight: 1.7, margin: 0 }}>{faq.a}</p></div>}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ── FINAL CTA ─────────────────────────────────────────────────
const FinalCTA: React.FC = () => {
  const ref = useRef<HTMLElement>(null);
  useFadeIn(ref, { y: 30 });
  return (
    <section ref={ref} style={{ background: 'linear-gradient(150deg, #0c1445 0%, #1a3a7a 100%)', padding: '96px 0', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(14,165,233,0.12) 0%, transparent 70%)', pointerEvents: 'none' }} />
      <div style={{ maxWidth: 700, margin: '0 auto', padding: '0 32px', textAlign: 'center', position: 'relative' }}>
        <span style={{ display: 'inline-block', fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: '0.12em', color: '#0ea5e9', textTransform: 'uppercase' as const, marginBottom: 20 }}>Escolha o plano certo para você</span>
        <h2 style={{ fontFamily: "'Sora',sans-serif", fontSize: 'clamp(32px,5vw,56px)', fontWeight: 800, letterSpacing: '-2px', color: '#fff', marginBottom: 20, lineHeight: 1.1 }}>Impulsione sua imobiliária hoje</h2>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, color: 'rgba(255,255,255,0.7)', marginBottom: 44 }}>Comece grátis por 7 dias. Sem cartão de crédito.</p>
        <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => scrollToSection('planos')} className="ev-btn-primary" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 700, border: 'none', cursor: 'pointer', padding: '16px 40px', borderRadius: 12 }}>Começar agora</button>
          <a href="mailto:contato@elevatiovendas.com" className="ev-btn-secondary" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, fontWeight: 600, textDecoration: 'none', padding: '16px 40px', borderRadius: 12 }}>Falar com equipe</a>
        </div>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)', marginTop: 28 }}>contato@elevatiovendas.com · +55 (64) 99923-2217</p>
      </div>
    </section>
  );
};

// ── FOOTER ────────────────────────────────────────────────────
const Footer: React.FC = () => (
  <footer style={{ background: '#070d1f', borderTop: '1px solid rgba(255,255,255,0.06)', padding: '56px 0 32px' }}>
    <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr 1fr', gap: 40, marginBottom: 48 }}>
        <div>
          <div className="mb-6 flex items-center gap-3">
            <img src="/logo/logo.png" alt="Elevatio Vendas Logo" className="h-10 w-auto object-contain drop-shadow-md opacity-90 grayscale transition-all duration-300 hover:grayscale-0" />
            <span style={{ fontFamily: "'Sora',sans-serif", fontWeight: 700, fontSize: 18, color: '#fff' }}>
              Elevatio<span style={{ color: '#0ea5e9' }}>Vendas</span>
            </span>
          </div>
          <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.5)', lineHeight: 1.7, maxWidth: 280 }}>A plataforma completa de site e CRM para imobiliárias que querem crescer com tecnologia.</p>
        </div>
        {[{ title: 'Produto', items: ['Recursos','Planos','Templates','Integrações'] }, { title: 'Empresa', items: ['Sobre','Blog','Parceiros','Contato'] }].map(col => (
          <div key={col.title}>
            <h4 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16 }}>{col.title}</h4>
            {col.items.map(item => <div key={item} style={{ marginBottom: 10 }}><a href="#" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', transition: 'color 0.2s' }}>{item}</a></div>)}
          </div>
        ))}
        <div>
          <h4 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.5)', letterSpacing: '0.1em', textTransform: 'uppercase' as const, marginBottom: 16 }}>Contato</h4>
          <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8 }}>
            <p>contato@elevatiovendas.com</p>
            <p>+55 (64) 99923-2217</p>
            <p style={{ marginTop: 8, fontSize: 12, color: 'rgba(255,255,255,0.3)' }}>Seg–Sex, 8h às 17h</p>
          </div>
        </div>
      </div>
      <div style={{ borderTop: '1px solid rgba(255,255,255,0.07)', paddingTop: 24, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap' as const, gap: 12 }}>
        <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.3)' }}>© {new Date().getFullYear()} Elevatio Vendas. Todos os direitos reservados.</p>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacidade','Termos'].map(item => <a key={item} href="#" style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.3)', textDecoration: 'none' }}>{item}</a>)}
        </div>
      </div>
    </div>
  </footer>
);

// ── ROOT ──────────────────────────────────────────────────────
export default function LandingPage() {
  useScrollSmoother();
  const [searchParams, setSearchParams] = useSearchParams();
  const [plans, setPlans] = useState<any[]>([]);
  const [loadingPlans, setLoadingPlans] = useState(true);
  const [dynamicReviews, setDynamicReviews] = useState<any[]>([]);
  const tenantNotFound = searchParams.get('tenant_status') === 'not-found';
  const tenantSlug = searchParams.get('tenant_slug') || '';

  const dismissTenantNotice = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete('tenant_status');
    nextParams.delete('tenant_slug');
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const { data } = await supabase.from('saas_plans').select('*').order('price', { ascending: true });
        setPlans(data || []);
      } finally {
        setLoadingPlans(false);
      }
    };

    fetchPlans();
  }, []);

  useEffect(() => {
    const fetchReviews = async () => {
      const { data } = await supabase
        .from('system_reviews')
        .select('rating, comment, profiles(name, avatar_url), companies(name)')
        .eq('is_public', true)
        .limit(6);

      if (data) setDynamicReviews(data);
    };

    fetchReviews();
  }, []);

  let comparisonData: PlanComparisonFeature[] = [];

  if (plans.length > 0) {
    comparisonData = [
      { name: 'Usuários', key: 'max_users' },
      { name: 'Imóveis', key: 'max_properties' },
      { name: 'Contratos Ativos', key: 'max_contracts', type: 'text' },
      { name: 'Fotos/Imóvel', key: 'max_photos' },
      { name: 'Funil de Vendas(CRM)', key: 'has_funnel', type: 'boolean' },
      { name: 'Pipeline', key: 'has_pipeline', type: 'boolean' },
      { name: 'Módulo de Gamificação', key: 'has_gamification', type: 'boolean' },
      { name: 'Módulo de Finanças(ERP)', key: 'has_erp', type: 'boolean' },
      { name: 'IA Descrições/Mês', key: 'ia_limit' },
      { name: 'IA Aura', key: 'aura_access', type: 'text' },
      { name: 'Site Profissional', key: 'has_site', type: 'boolean' },
      { name: 'Domínio Grátis 1º Ano (No Plano Anual)', key: 'has_free_domain', type: 'boolean' },
      { name: 'Integração Portais Zap/VivaReal', key: 'has_portals', type: 'boolean' },
      { name: 'E-mail Marketing', key: 'has_email_auto', type: 'boolean' },
      { name: 'API de Integração com Checkout', key: 'has_api', type: 'boolean' },
      { name: 'Nível Suporte', key: 'support_level', type: 'text' },
    ];
  }

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700;800;900&family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        #smooth-wrapper { overflow: hidden; position: fixed; top: 0; left: 0; width: 100%; height: 100%; }
        #smooth-content { will-change: transform; }
        @keyframes ev-pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        @keyframes ev-dropdown-in {
          from { opacity: 0; transform: translateX(-50%) translateY(-8px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
        .ev-nav-desktop { display: flex; }

        .ev-btn-primary {
          background: linear-gradient(135deg, #1a56db, #0ea5e9);
          color: #fff;
          transition: all 0.3s ease;
          box-shadow: 0 4px 14px rgba(14,165,233,0.35);
        }
        .ev-btn-primary:hover {
          transform: translateY(-2px) scale(1.02);
          box-shadow: 0 12px 24px rgba(14,165,233,0.5);
        }
        .ev-btn-secondary {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.15);
          color: #fff;
          transition: all 0.3s ease;
        }
        .ev-btn-secondary:hover {
          background: rgba(255,255,255,0.15);
          transform: translateY(-2px);
        }
        .ev-btn-light {
          background: rgba(26,86,219,0.07);
          color: #1a56db;
          transition: all 0.3s ease;
        }
        .ev-btn-light:hover {
          background: rgba(26,86,219,0.15);
          transform: translateY(-2px);
        }
        .ev-card-hover {
          transition: transform 0.3s ease, box-shadow 0.3s ease;
        }
        .ev-card-hover:hover {
          transform: translateY(-4px);
          box-shadow: 0 16px 40px rgba(0,0,0,0.08) !important;
        }
        .ev-row-hover { transition: background 0.2s ease; }
        .ev-row-hover:hover { background: rgba(255,255,255,0.03) !important; }
        .ev-nav-link:hover { color: #0ea5e9 !important; }
        .ev-nav-btn { font-family: inherit; }

        .ev-custom-scrollbar::-webkit-scrollbar { height: 5px; }
        .ev-custom-scrollbar::-webkit-scrollbar-track { background: rgba(255,255,255,0.02); border-radius: 10px; }
        .ev-custom-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 10px; }
        .ev-custom-scrollbar::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.25); }

        @media (max-width: 768px) {
          .ev-nav-desktop { display: none !important; }
          #smooth-wrapper { position: static !important; height: auto !important; overflow: visible !important; }
          #smooth-content { will-change: auto !important; }
        }
      `}</style>

      <Navbar />

      {tenantNotFound && (
        <div
          role="alert"
          className="fixed left-1/2 top-24 z-[500] w-[calc(100%-32px)] max-w-xl -translate-x-1/2 rounded-xl border border-amber-200 bg-white px-5 py-4 shadow-2xl"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-700">
              <Globe size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-['DM_Sans'] text-sm font-bold text-slate-900">
                Empresa nao encontrada
              </p>
              <p className="mt-1 font-['DM_Sans'] text-sm leading-relaxed text-slate-600">
                {tenantSlug
                  ? `Nao encontramos uma imobiliaria ativa para o subdominio "${tenantSlug}".`
                  : 'Nao encontramos uma imobiliaria ativa para este subdominio.'}
              </p>
            </div>
            <button
              type="button"
              onClick={dismissTenantNotice}
              className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
              aria-label="Fechar aviso"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}

      <div id="smooth-wrapper">
        <div id="smooth-content">
          <Hero />
          <Stats />
          <Solucoes />
          <Features />
          <Pricing plans={plans} loadingPlans={loadingPlans} />
          <PlanComparison plans={plans} features={comparisonData} loadingPlans={loadingPlans} />
          <Testimonials dynamicReviews={dynamicReviews} />
          <FAQ />
          <FinalCTA />
          <Footer />
        </div>
      </div>
    </>
  );
}

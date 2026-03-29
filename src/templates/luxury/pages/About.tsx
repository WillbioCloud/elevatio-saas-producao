import React from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';

export default function LuxuryAbout() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};
  const companyName = tenant?.name || 'Imobiliária';
  const aboutText = siteData.about_text || `${companyName} surgiu com o propósito de transformar a experiência imobiliária — unindo curadoria criteriosa, atendimento próximo e visão estratégica de mercado.`;
  const aboutImage = siteData.about_image_url || '';
  const aboutTitle = siteData.about_title || `Conheça a ${companyName}`;

  const pillars = [
    { label: 'Missão', text: siteData.mission || 'Conectar pessoas e imóveis com transparência, elegância e foco total na realização dos objetivos de cada cliente.' },
    { label: 'Visão', text: siteData.vision || 'Ser referência em imóveis de alto padrão, reconhecidos pela curadoria exclusiva e pelo atendimento que antecipa as necessidades do cliente.' },
    { label: 'Valores', text: siteData.values || 'Ética, discrição, excelência no atendimento, compromisso com resultados e valorização de relacionamentos de longo prazo.' },
  ];

  const team: { name: string; role: string, creci?: string }[] = siteData.team || [];
  const whatsapp = siteData.social?.whatsapp || siteData.contact?.phone || '';
  const whatsappLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : null;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        @keyframes lx-fadein { from { opacity:0; transform:translateY(20px); } to { opacity:1; transform:translateY(0); } }
        .lx-about-root { font-family:'DM Sans',sans-serif; background:#0e0e0e; min-height:100vh; color:#fff; padding-top:72px; }
        .lx-divider { height:1px; background:rgba(255,255,255,0.06); }
        @media (max-width:900px) { .lx-about-hero-grid, .lx-pillar-grid { grid-template-columns:1fr !important; } .lx-team-grid { grid-template-columns:repeat(2,1fr) !important; } }
        @media (max-width:480px) { .lx-team-grid { grid-template-columns:1fr !important; } }
      `}</style>

      <div className="lx-about-root">
        <section style={{ padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)', background: '#0e0e0e' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>Sobre Nós</div>
            <div className="lx-about-hero-grid" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'end' }}>
              <h1 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 'clamp(40px,6vw,80px)', fontWeight: 700, letterSpacing: '-0.04em', lineHeight: 1, color: '#fff', animation: 'lx-fadein 0.7s ease both' }}>{aboutTitle}</h1>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 'clamp(16px,1.6vw,20px)', color: 'rgba(255,255,255,0.4)', lineHeight: 1.8, animation: 'lx-fadein 0.7s ease 0.15s both' }}>{aboutText.split('\n')[0]}</p>
            </div>
          </div>
        </section>

        <div className="lx-divider" />

        <section style={{ padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)', background: '#0a0a0a' }}>
          <div className="lx-about-hero-grid" style={{ maxWidth: 1280, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 72, alignItems: 'center' }}>
            <div style={{ position: 'relative', borderRadius: 24, overflow: 'hidden', aspectRatio: '4/3', background: '#161616' }}>
              {aboutImage && <img src={aboutImage} alt={companyName} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
            </div>
            <div>
              <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.9, marginBottom: 32, whiteSpace: 'pre-line' }}>{aboutText}</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { num: siteData.stat_properties || '200+', label: 'Imóveis' },
                  { num: siteData.stat_clients || '98%',     label: 'Satisfação' },
                  { num: siteData.stat_years || '10+ Anos',  label: 'Mercado' },
                ].map((s, i) => (
                  <div key={i}>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 'clamp(24px,3vw,36px)', fontWeight: 700, letterSpacing: '-0.04em', color: '#fff' }}>{s.num}</div>
                    <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.3)', marginTop: 4, letterSpacing: '0.06em', textTransform: 'uppercase' }}>{s.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <div className="lx-divider" />

        <section style={{ padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)', background: '#0e0e0e' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 40 }}>Nossa Essência</div>
            <div className="lx-pillar-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 24 }}>
              {pillars.map((p, i) => (
                <div key={i} style={{ padding: '32px', borderRadius: 20, background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 16 }}>{String(i + 1).padStart(2, '0')}</div>
                  <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 24, fontWeight: 700, color: '#fff', marginBottom: 16 }}>{p.label}</h3>
                  <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.8 }}>{p.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {team.length > 0 && (
          <section style={{ padding: 'clamp(64px,8vw,112px) clamp(24px,4vw,48px)', background: '#0a0a0a' }}>
            <div style={{ maxWidth: 1280, margin: '0 auto' }}>
              <div style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.3)', marginBottom: 16 }}>Time</div>
              <h2 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 'clamp(28px,4vw,48px)', fontWeight: 700, color: '#fff', marginBottom: 48 }}>Nossa Equipe</h2>
              <div className="lx-team-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 20 }}>
                {team.map((member, i) => (
                  <div key={i} style={{ padding: '28px', borderRadius: 20, background: '#111', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(255,255,255,0.06)', marginBottom: 18, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, fontWeight: 700, color: 'rgba(255,255,255,0.3)' }}>{(member.name || 'A')[0]}</div>
                    <h3 style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 6 }}>{member.name}</h3>
                    <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>{member.role}</p>
                    {member.creci && <p style={{ fontFamily: "'DM Sans',sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.2)', marginTop: 8 }}>CRECI {member.creci}</p>}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </div>
    </>
  );
}

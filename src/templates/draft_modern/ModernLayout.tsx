import React, { useEffect, useState } from 'react';
import { Outlet, Link, NavLink, useLocation } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

export default function ModernLayout() {
  const { tenant } = useTenant();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const siteData = (tenant?.site_data as any) || {};
  const primary = siteData.primary_color || '#16a34a';

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const nav = [
    { to: '/', label: 'Início', end: true },
    { to: '/imoveis', label: 'Imóveis' },
    { to: '/sobre', label: 'Sobre' },
    { to: '/contato', label: 'Contato' },
  ];

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:ital,wght@0,300;0,400;0,500;0,600;0,700;0,800;1,400&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { scroll-behavior: smooth; }
        body { font-family: 'Plus Jakarta Sans', sans-serif; }

        .mn-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 200;
          background: rgba(255,255,255,0.97);
          border-bottom: 1px solid rgba(0,0,0,0.07);
          transition: box-shadow 0.25s;
          backdrop-filter: blur(8px);
        }
        .mn-nav.scrolled { box-shadow: 0 1px 24px rgba(0,0,0,0.09); }
        .mn-nav-inner {
          max-width: 1280px; margin: 0 auto;
          padding: 0 clamp(16px,3vw,32px); height: 64px;
          display: flex; align-items: center; justify-content: space-between; gap: 20px;
        }
        .mn-logo { display: flex; align-items: center; gap: 10px; text-decoration: none; flex-shrink: 0; }
        .mn-logo-mark {
          width: 36px; height: 36px; border-radius: 10px;
          display: flex; align-items: center; justify-content: center;
        }
        .mn-logo-text { font-size: 18px; font-weight: 800; color: #0f172a; letter-spacing: -0.5px; }

        .mn-links { display: flex; gap: 2px; list-style: none; }
        .mn-links a {
          padding: 8px 14px; border-radius: 8px;
          font-size: 14px; font-weight: 600; letter-spacing: -0.1px;
          text-decoration: none; color: #64748b; transition: all 0.15s;
        }
        .mn-links a:hover { color: #0f172a; background: #f1f5f9; }
        .mn-links a.active { color: #0f172a; background: #f1f5f9; }

        .mn-cta {
          padding: 10px 22px; border-radius: 10px;
          font-size: 14px; font-weight: 700; letter-spacing: -0.1px;
          color: #fff; text-decoration: none; flex-shrink: 0;
          display: inline-flex; align-items: center; gap: 6px;
          transition: opacity 0.15s, transform 0.15s;
        }
        .mn-cta:hover { opacity: 0.88; transform: translateY(-1px); }

        .mn-burger {
          display: none; flex-direction: column; gap: 5px;
          background: none; border: none; padding: 6px; cursor: pointer;
        }
        .mn-burger span {
          display: block; width: 22px; height: 2px;
          background: #0f172a; border-radius: 2px; transition: all 0.22s;
        }

        .mn-mobile {
          position: fixed; top: 68px; left: 0; right: 0; bottom: 0;
          background: #fff; z-index: 199;
          padding: 16px 20px 32px;
          display: flex; flex-direction: column; gap: 3px;
          animation: mn-in 0.18s ease;
          border-top: 1px solid #f1f5f9;
          overflow-y: auto;
        }
        .mn-mobile a {
          padding: 14px 16px; border-radius: 12px;
          font-size: 16px; font-weight: 600;
          text-decoration: none; color: #374151; transition: all 0.13s;
        }
        .mn-mobile a:hover { background: #f8fafc; }
        .mn-mobile-cta {
          margin-top: 10px; text-align: center;
          font-weight: 700; color: #fff; border-radius: 12px;
        }

        /* ── FOOTER ── */
        .mn-footer { background: #0f172a; color: #fff; }
        .mn-footer-body {
          max-width: 1280px; margin: 0 auto;
          padding: 56px clamp(16px,3vw,32px) 36px;
          display: grid; grid-template-columns: 1.8fr 1fr 1fr 1.2fr; gap: 40px;
        }
        .mn-footer-brand { font-size: 19px; font-weight: 800; color: #fff; margin-bottom: 12px; letter-spacing: -0.4px; }
        .mn-footer-desc { font-size: 14px; color: rgba(255,255,255,0.42); line-height: 1.8; margin-bottom: 24px; }
        .mn-footer-socials { display: flex; gap: 8px; }
        .mn-footer-social {
          width: 34px; height: 34px; border-radius: 8px;
          background: rgba(255,255,255,0.07); border: 1px solid rgba(255,255,255,0.09);
          display: flex; align-items: center; justify-content: center;
          color: rgba(255,255,255,0.45); text-decoration: none; transition: all 0.15s;
        }
        .mn-footer-social:hover { background: rgba(255,255,255,0.13); color: #fff; }
        .mn-footer-col-title { font-size: 11px; font-weight: 700; letter-spacing: 0.09em; text-transform: uppercase; color: rgba(255,255,255,0.28); margin-bottom: 16px; }
        .mn-footer-col-links { display: flex; flex-direction: column; gap: 9px; }
        .mn-footer-col-links a { font-size: 14px; color: rgba(255,255,255,0.52); text-decoration: none; transition: color 0.13s; }
        .mn-footer-col-links a:hover { color: #fff; }
        .mn-footer-col-links span { font-size: 14px; color: rgba(255,255,255,0.42); line-height: 1.65; }
        .mn-footer-bottom {
          max-width: 1280px; margin: 0 auto;
          padding: 16px clamp(16px,3vw,32px);
          border-top: 1px solid rgba(255,255,255,0.07);
          display: flex; justify-content: space-between; align-items: center; gap: 16px;
          flex-wrap: wrap;
        }
        .mn-footer-copy { font-size: 13px; color: rgba(255,255,255,0.22); }

        @keyframes mn-in { from { opacity:0; transform:translateY(-6px); } to { opacity:1; transform:translateY(0); } }

        @media (max-width: 900px) {
          .mn-links, .mn-cta { display: none !important; }
          .mn-burger { display: flex !important; }
          .mn-footer-body { grid-template-columns: 1fr 1fr; padding: 40px 20px 28px; gap: 28px; }
        }
        @media (max-width: 520px) {
          .mn-footer-body { grid-template-columns: 1fr; }
          .mn-footer-bottom { flex-direction: column; text-align: center; padding: 16px 20px; }
        }
      `}</style>

      <div style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", background: '#fff', color: '#0f172a', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>

        {/* ── NAV ── */}
        <header className={`mn-nav ${scrolled ? 'scrolled' : ''}`}>
          <div className="mn-nav-inner">
            <Link to="/" className="mn-logo">
              <div className="mn-logo-mark" style={{ background: primary }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
                  <path d="M3 9.5L12 3l9 6.5V20a1 1 0 01-1 1H4a1 1 0 01-1-1V9.5z" stroke="white" strokeWidth="2.2" strokeLinejoin="round"/>
                  <path d="M9 21V12h6v9" stroke="white" strokeWidth="2.2" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className="mn-logo-text">{tenant?.name || 'Imóveis'}</span>
            </Link>

            <ul className="mn-links">
              {nav.map(n => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => isActive ? 'active' : ''}>{n.label}</NavLink>
                </li>
              ))}
            </ul>

            <Link to="/contato" className="mn-cta" style={{ background: primary }}>
              Fale Conosco
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none">
                <path d="M2.5 7h9M7 2.5l4.5 4.5L7 11.5" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </Link>

            <button className="mn-burger" onClick={() => setMobileOpen(v => !v)} aria-label="Menu">
              <span style={{ transform: mobileOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <span style={{ opacity: mobileOpen ? 0 : 1, transform: mobileOpen ? 'translateX(10px)' : 'none' }} />
              <span style={{ transform: mobileOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>
          </div>
        </header>

        {mobileOpen && (
          <nav className="mn-mobile">
            {nav.map(n => <Link key={n.to} to={n.to}>{n.label}</Link>)}
            <Link to="/contato" className="mn-mobile-cta" style={{ background: primary, padding: '14px 16px' }}>
              Fale Conosco →
            </Link>
          </nav>
        )}

        {/* CONTENT */}
        <main style={{ flex: 1, paddingTop: 64 }}>
          <Outlet />
        </main>

        {/* ── FOOTER ── */}
        <footer className="mn-footer">
          <div className="mn-footer-body">
            <div>
              <div className="mn-footer-brand">{tenant?.name || 'Imóveis'}</div>
              <p className="mn-footer-desc">
                {siteData.about_text?.slice(0, 130) || 'Soluções imobiliárias personalizadas que guiam você em cada etapa com experiências únicas alinhadas às suas necessidades e aspirações.'}
              </p>
              <div className="mn-footer-socials">
                {siteData.social?.instagram && (
                  <a href={`https://instagram.com/${siteData.social.instagram}`} className="mn-footer-social" target="_blank" rel="noopener noreferrer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/></svg>
                  </a>
                )}
                {siteData.social?.whatsapp && (
                  <a href={`https://wa.me/${siteData.social.whatsapp.replace(/\D/g,'')}`} className="mn-footer-social" target="_blank" rel="noopener noreferrer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                )}
                {siteData.social?.facebook && (
                  <a href={`https://facebook.com/${siteData.social.facebook}`} className="mn-footer-social" target="_blank" rel="noopener noreferrer">
                    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                  </a>
                )}
              </div>
            </div>

            <div>
              <div className="mn-footer-col-title">Navegação</div>
              <div className="mn-footer-col-links">
                <Link to="/">Início</Link>
                <Link to="/imoveis">Imóveis</Link>
                <Link to="/sobre">Sobre</Link>
                <Link to="/contato">Contato</Link>
              </div>
            </div>

            <div>
              <div className="mn-footer-col-title">Serviços</div>
              <div className="mn-footer-col-links">
                <a href="#">Compra e Venda</a>
                <a href="#">Locação</a>
                <a href="#">Avaliação</a>
                <a href="#">Consultoria</a>
              </div>
            </div>

            <div>
              <div className="mn-footer-col-title">Contato</div>
              <div className="mn-footer-col-links">
                {siteData.contact?.phone && (
                  <a href={`tel:${siteData.contact.phone}`}>{siteData.contact.phone}</a>
                )}
                {siteData.contact?.email && (
                  <a href={`mailto:${siteData.contact.email}`}>{siteData.contact.email}</a>
                )}
                {siteData.contact?.address && (
                  <span>{siteData.contact.address}</span>
                )}
              </div>
            </div>
          </div>

          <div className="mn-footer-bottom">
            <span className="mn-footer-copy">© {new Date().getFullYear()} {tenant?.name}. Todos os direitos reservados.</span>
            <span className="mn-footer-copy">Powered by ElevatioVendas</span>
          </div>
        </footer>
      </div>
    </>
  );
}
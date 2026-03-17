import React, { useEffect, useState } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

export default function LuxuryLayout() {
  const { tenant } = useTenant();
  const location = useLocation();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const primaryColor = (tenant?.site_data as any)?.primaryColor || '#ffffff';

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Fecha mobile ao navegar
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lx-root {
          font-family: 'DM Sans', -apple-system, sans-serif;
          background: #0e0e0e;
          color: #ffffff;
          min-height: 100vh;
          -webkit-font-smoothing: antialiased;
        }

        /* ── NAVBAR ── */
        .lx-nav {
          position: fixed; top: 0; left: 0; right: 0; z-index: 100;
          transition: background 0.3s ease, border-color 0.3s ease;
          border-bottom: 1px solid transparent;
        }
        .lx-nav.scrolled {
          background: rgba(14,14,14,0.92);
          backdrop-filter: blur(16px);
          border-bottom-color: rgba(255,255,255,0.07);
        }
        .lx-nav-inner {
          max-width: 1280px; margin: 0 auto;
          padding: 0 32px; height: 72px;
          display: flex; align-items: center; justify-content: space-between;
        }
        .lx-brand {
          font-size: 18px; font-weight: 700; letter-spacing: 0.02em;
          text-decoration: none; color: #ffffff;
          display: flex; align-items: center; gap: 10px;
        }
        .lx-brand-dot {
          width: 8px; height: 8px; border-radius: 50%;
          background: #ffffff; flex-shrink: 0;
        }
        .lx-nav-links {
          display: flex; gap: 36px; list-style: none;
        }
        .lx-nav-links a {
          font-size: 13px; font-weight: 500; letter-spacing: 0.06em;
          text-transform: uppercase; text-decoration: none;
          color: rgba(255,255,255,0.5); transition: color 0.2s;
        }
        .lx-nav-links a:hover { color: #ffffff; }
        .lx-nav-cta {
          padding: 9px 20px; border-radius: 100px;
          border: 1px solid rgba(255,255,255,0.2);
          background: transparent; color: #fff;
          font-family: 'DM Sans', sans-serif;
          font-size: 13px; font-weight: 600; letter-spacing: 0.04em;
          text-decoration: none; cursor: pointer;
          transition: all 0.2s;
        }
        .lx-nav-cta:hover {
          background: #ffffff; color: #0e0e0e;
          border-color: #ffffff;
        }
        .lx-hamburger {
          display: none; flex-direction: column; gap: 5px;
          background: none; border: none; cursor: pointer; padding: 4px;
        }
        .lx-hamburger span {
          display: block; width: 22px; height: 2px;
          background: #fff; border-radius: 2px; transition: all 0.25s;
        }

        /* Mobile nav */
        .lx-mobile-nav {
          position: fixed; top: 72px; left: 0; right: 0; bottom: 0;
          background: #0e0e0e; z-index: 99;
          display: flex; flex-direction: column; align-items: center;
          justify-content: center; gap: 32px;
          animation: lx-fade-in 0.22s ease;
        }
        .lx-mobile-nav a {
          font-size: 32px; font-weight: 700;
          text-decoration: none; color: rgba(255,255,255,0.6);
          letter-spacing: -0.02em; transition: color 0.2s;
        }
        .lx-mobile-nav a:hover { color: #fff; }

        /* ── FOOTER ── */
        .lx-footer {
          background: #080808;
          border-top: 1px solid rgba(255,255,255,0.06);
          padding: 80px 32px 48px;
        }
        .lx-footer-inner {
          max-width: 1280px; margin: 0 auto;
          display: grid; grid-template-columns: 1fr 1fr 1fr;
          gap: 48px;
        }
        .lx-footer-brand { font-size: 22px; font-weight: 700; margin-bottom: 12px; }
        .lx-footer-sub { font-size: 13px; color: rgba(255,255,255,0.3); line-height: 1.7; }
        .lx-footer-col-title {
          font-size: 11px; font-weight: 700; letter-spacing: 0.1em;
          text-transform: uppercase; color: rgba(255,255,255,0.3);
          margin-bottom: 18px;
        }
        .lx-footer-col-links { display: flex; flex-direction: column; gap: 10px; }
        .lx-footer-col-links a {
          font-size: 14px; color: rgba(255,255,255,0.55);
          text-decoration: none; transition: color 0.2s;
        }
        .lx-footer-col-links a:hover { color: #fff; }
        .lx-footer-bottom {
          max-width: 1280px; margin: 48px auto 0;
          padding-top: 28px;
          border-top: 1px solid rgba(255,255,255,0.06);
          display: flex; align-items: center; justify-content: space-between;
        }
        .lx-footer-copy {
          font-size: 12px; letter-spacing: 0.06em;
          text-transform: uppercase; color: rgba(255,255,255,0.2);
        }
        .lx-footer-badge {
          font-size: 11px; font-weight: 600; letter-spacing: 0.08em;
          text-transform: uppercase; color: rgba(255,255,255,0.2);
        }

        @keyframes lx-fade-in {
          from { opacity: 0; transform: translateY(-8px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 768px) {
          .lx-nav-links, .lx-nav-cta { display: none !important; }
          .lx-hamburger { display: flex !important; }
          .lx-footer-inner { grid-template-columns: 1fr; gap: 32px; }
          .lx-footer-bottom { flex-direction: column; gap: 12px; }
        }
      `}</style>

      <div className="lx-root">
        {/* ── NAVBAR ── */}
        <header className={`lx-nav ${scrolled ? 'scrolled' : ''}`}>
          <div className="lx-nav-inner">
            <Link to="/" className="lx-brand">
              <div className="lx-brand-dot" style={{ background: primaryColor }} />
              {tenant?.name || 'Imobiliária'}
            </Link>

            <ul className="lx-nav-links">
              <li><Link to="/">Início</Link></li>
              <li><Link to="/imoveis">Imóveis</Link></li>
              <li><Link to="/sobre">Sobre</Link></li>
              <li><Link to="/contato">Contato</Link></li>
            </ul>

            <Link to="/imoveis" className="lx-nav-cta">Ver Portfólio →</Link>

            <button
              className="lx-hamburger"
              onClick={() => setMobileOpen(v => !v)}
              aria-label="Menu"
            >
              <span style={{ transform: mobileOpen ? 'rotate(45deg) translate(5px, 5px)' : 'none' }} />
              <span style={{ opacity: mobileOpen ? 0 : 1 }} />
              <span style={{ transform: mobileOpen ? 'rotate(-45deg) translate(5px, -5px)' : 'none' }} />
            </button>
          </div>
        </header>

        {/* Mobile Nav */}
        {mobileOpen && (
          <nav className="lx-mobile-nav">
            <Link to="/">Início</Link>
            <Link to="/imoveis">Imóveis</Link>
            <Link to="/sobre">Sobre</Link>
            <Link to="/contato">Contato</Link>
          </nav>
        )}

        {/* ── PAGE CONTENT ── */}
        <main>
          <Outlet />
        </main>

        {/* ── FOOTER ── */}
        <footer className="lx-footer">
          <div className="lx-footer-inner">
            <div>
              <div className="lx-footer-brand">{tenant?.name || 'Imobiliária'}</div>
              <p className="lx-footer-sub">
                Propriedades de alto padrão selecionadas com critério, atendimento discreto e total personalização para clientes exigentes.
              </p>
            </div>
            <div>
              <div className="lx-footer-col-title">Navegação</div>
              <div className="lx-footer-col-links">
                <Link to="/">Início</Link>
                <Link to="/imoveis">Imóveis</Link>
                <Link to="/sobre">Sobre</Link>
                <Link to="/contato">Contato</Link>
              </div>
            </div>
            <div>
              <div className="lx-footer-col-title">Atendimento</div>
              <div className="lx-footer-col-links">
                <a href="#">WhatsApp</a>
                <a href="#">Agendar Visita</a>
                <a href="#">Avalie seu Imóvel</a>
              </div>
            </div>
          </div>
          <div className="lx-footer-bottom">
            <span className="lx-footer-copy">
              © {new Date().getFullYear()} {tenant?.name}. Todos os direitos reservados.
            </span>
            <span className="lx-footer-badge">Exclusive Real Estate</span>
          </div>
        </footer>
      </div>
    </>
  );
}
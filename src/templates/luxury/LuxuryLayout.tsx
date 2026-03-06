import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

export default function LuxuryLayout() {
  const { tenant } = useTenant();
  // Template de luxo força tons escuros/dourados se a cor principal não for definida
  const primaryColor = (tenant?.site_data as any)?.primaryColor || '#D4AF37';

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-serif">
      <header className="border-b border-white/10 bg-slate-950/80 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-24 flex items-center justify-between">
          <Link to="/" className="text-3xl font-normal tracking-widest uppercase" style={{ color: primaryColor }}>
            {tenant?.name || 'Imobiliária'}
          </Link>
          <nav className="hidden md:flex gap-10 font-light text-sm uppercase tracking-widest text-slate-400">
            <Link to="/" className="hover:text-white transition-colors">Início</Link>
            <Link to="/imoveis" className="hover:text-white transition-colors">Imóveis</Link>
            <Link to="/sobre" className="hover:text-white transition-colors">Sobre</Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="bg-black py-16 border-t border-white/10 text-center">
        <p className="text-slate-600 uppercase text-xs tracking-widest">
          &copy; {new Date().getFullYear()} {tenant?.name}. Exclusive Real Estate.
        </p>
      </footer>
    </div>
  );
}

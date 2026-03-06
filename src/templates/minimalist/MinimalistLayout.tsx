import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

export default function MinimalistLayout() {
  const { tenant } = useTenant();
  const primaryColor = (tenant?.site_data as any)?.primaryColor || '#0EA5E9';

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans">
      <header className="border-b border-slate-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="text-2xl font-black tracking-tighter" style={{ color: primaryColor }}>
            {tenant?.name || 'Imobiliária'}
          </Link>
          <nav className="hidden md:flex gap-8 font-medium text-sm text-slate-600">
            <Link to="/" className="hover:text-black transition-colors">Início</Link>
            <Link to="/imoveis" className="hover:text-black transition-colors">Imóveis</Link>
            <Link to="/sobre" className="hover:text-black transition-colors">Quem Somos</Link>
          </nav>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="bg-slate-50 py-12 border-t border-slate-100 text-center">
        <p className="text-slate-500 font-medium">
          &copy; {new Date().getFullYear()} {tenant?.name}. Todos os direitos reservados.
        </p>
      </footer>
    </div>
  );
}

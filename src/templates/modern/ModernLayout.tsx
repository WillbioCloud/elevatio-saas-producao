import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';

export default function ModernLayout() {
  const { tenant } = useTenant();
  const primaryColor = (tenant?.site_data as any)?.primaryColor || '#6366F1';

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans selection:bg-brand-500 selection:text-white">
      <div className="p-4">
        <header className="bg-white rounded-3xl shadow-sm border border-slate-100 sticky top-4 z-50">
          <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
            <Link to="/" className="text-2xl font-black tracking-tight flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl" style={{ backgroundColor: primaryColor }}></div>
              {tenant?.name || 'Imobiliária'}
            </Link>
            <nav className="hidden md:flex gap-8 font-bold text-sm text-slate-500">
              <Link to="/" className="hover:text-slate-900 transition-colors">Início</Link>
              <Link to="/imoveis" className="hover:text-slate-900 transition-colors">Imóveis</Link>
              <Link to="/sobre" className="hover:text-slate-900 transition-colors">Sobre Nós</Link>
            </nav>
          </div>
        </header>
      </div>

      <main className="px-4 pb-4">
        <Outlet />
      </main>

      <footer className="bg-slate-900 text-white m-4 rounded-3xl py-12 text-center">
        <p className="text-slate-400 font-medium">
          &copy; {new Date().getFullYear()} {tenant?.name}. Feito com inovação.
        </p>
      </footer>
    </div>
  );
}

import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { Building2, Phone, Mail, MapPin, Instagram, Facebook } from 'lucide-react';

export default function MinimalistLayout() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};
  const primaryColor = siteData.primaryColor || '#0EA5E9';

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans text-slate-900">
      {/* Top Bar */}
      <div className="bg-slate-900 text-slate-300 py-2 text-xs font-medium hidden md:block">
        <div className="max-w-7xl mx-auto px-6 flex justify-between items-center">
          <div className="flex gap-6">
            <span className="flex items-center gap-2">
              <Phone size={14} /> {tenant?.phone || '(00) 0000-0000'}
            </span>
            <span className="flex items-center gap-2">
              <Mail size={14} /> contato@{tenant?.domain || tenant?.subdomain}.com.br
            </span>
          </div>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white transition-colors">
              <Instagram size={16} />
            </a>
            <a href="#" className="hover:text-white transition-colors">
              <Facebook size={16} />
            </a>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200/50 shadow-sm">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            {tenant?.logo_url ? (
              <img src={tenant.logo_url} alt={tenant.name} className="h-10 object-contain" />
            ) : (
              <>
                <div 
                  className="p-2 rounded-lg" 
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  <Building2 size={24} />
                </div>
                <span className="text-2xl font-black tracking-tight text-slate-900">
                  {tenant?.name || 'Sua Imobiliária'}
                </span>
              </>
            )}
          </Link>

          <nav className="hidden md:flex gap-8 font-bold text-sm text-slate-600">
            <Link to="/" className="hover:text-slate-900 transition-colors">Início</Link>
            <Link to="/imoveis" className="hover:text-slate-900 transition-colors">Comprar</Link>
            <Link to="/imoveis" className="hover:text-slate-900 transition-colors">Alugar</Link>
            <Link to="/sobre" className="hover:text-slate-900 transition-colors">Sobre Nós</Link>
          </nav>

          <Link 
            to="/contato" 
            className="hidden md:flex px-6 py-2.5 rounded-full text-white font-bold text-sm transition-transform hover:scale-105 shadow-md"
            style={{ backgroundColor: primaryColor }}
          >
            Fale Conosco
          </Link>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        <Outlet />
      </main>

      {/* Footer Profissional */}
      <footer className="bg-slate-950 text-slate-400 py-16 mt-auto">
        <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-4 gap-12">
          <div className="md:col-span-2">
            <Link to="/" className="flex items-center gap-2 mb-6 text-white">
              <Building2 size={28} style={{ color: primaryColor }} />
              <span className="text-2xl font-black tracking-tight">
                {tenant?.name || 'Sua Imobiliária'}
              </span>
            </Link>
            <p className="text-slate-400 leading-relaxed max-w-md mb-6">
              {siteData.aboutText || 'Transformando a maneira como você busca, compra e aluga imóveis. Experiência digital com atendimento humano.'}
            </p>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Links Úteis</h4>
            <ul className="space-y-4 font-medium">
              <li><Link to="/imoveis" className="hover:text-white transition-colors">Todos os Imóveis</Link></li>
              <li><Link to="/sobre" className="hover:text-white transition-colors">Nossa História</Link></li>
              <li><Link to="/financiamento" className="hover:text-white transition-colors">Financiamento</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-6 uppercase tracking-wider text-sm">Contato</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <MapPin size={18} style={{ color: primaryColor }} /> Seu Endereço Aqui
              </li>
              <li className="flex items-center gap-3">
                <Phone size={18} style={{ color: primaryColor }} /> {tenant?.phone || '(00) 0000-0000'}
              </li>
              <li className="flex items-center gap-3">
                <Mail size={18} style={{ color: primaryColor }} /> contato@{tenant?.domain || 'site'}.com.br
              </li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto px-6 mt-16 pt-8 border-t border-white/10 text-sm flex flex-col md:flex-row justify-between items-center">
          <p>&copy; {new Date().getFullYear()} {tenant?.name}. Todos os direitos reservados.</p>
          <p className="mt-2 md:mt-0 opacity-50 flex items-center gap-1">
            Tecnologia por <Building2 size={12}/> Elevatio Vendas
          </p>
        </div>
      </footer>
    </div>
  );
}

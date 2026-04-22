import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail, MapPin, MessageCircle, Phone, Youtube } from 'lucide-react';
import { Icons } from '../../components/Icons';
import ContactModal from '../../components/ContactModal';
import { useTenant } from '../../contexts/TenantContext';
import {
  getAboutText,
  getPrimaryColor,
  getSocialLink,
  getTenantAddress,
  getTenantCreci,
  getTenantEmail,
  getTenantLogo,
  getTenantLogoWhite,
  getTenantMapLink,
  getTenantName,
  getTenantPhone,
  getWhatsappLink,
} from '../../utils/tenantUtils';

const ModernLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const { tenant } = useTenant();

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 50);
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  const companyName = getTenantName(tenant);
  const primaryColor = getPrimaryColor(tenant);
  const logoUrl = getTenantLogo(tenant);
  const footerLogoUrl = getTenantLogoWhite(tenant);

  // Extrai o siteData para pegarmos a logo secundária
  const siteData = typeof tenant?.site_data === 'string'
    ? JSON.parse(tenant.site_data)
    : tenant?.site_data || {};
  const logoAltUrl = siteData.logo_alt_url || logoUrl; // Fallback para a logo principal se não houver secundária

  // Troca dinâmica de Favicon e Título do Site (Multi-tenant)
  useEffect(() => {
    // 1. Atualiza o Título da Aba
    if (companyName) {
      document.title = `${companyName} | Imóveis`;
    }

    // 2. Atualiza o Favicon da Aba
    if (siteData.favicon_url) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
      if (!link) {
        link = document.createElement('link');
        link.rel = 'icon';
        document.head.appendChild(link);
      }
      link.href = siteData.favicon_url;
    }
  }, [siteData.favicon_url, companyName]);

  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return <Outlet />;

  const contactPhone = getTenantPhone(tenant);
  const contactEmail = getTenantEmail(tenant);
  const contactAddress = getTenantAddress(tenant);
  const contactMapLink = getTenantMapLink(tenant);
  const tenantCreci = getTenantCreci(tenant);
  const aboutText = getAboutText(tenant);
  const saleWhatsappLink = getWhatsappLink(
    tenant,
    'Gostaria de anunciar meu imóvel com a imobiliária. Pode me passar mais informações?'
  );
  const contactWhatsappLink = getWhatsappLink(tenant, `Olá! Gostaria de falar com ${companyName}.`);

  const socialLinks = useMemo(
    () => [
      { key: 'instagram', href: getSocialLink(tenant, 'instagram'), icon: Instagram, label: 'Instagram' },
      { key: 'facebook', href: getSocialLink(tenant, 'facebook'), icon: Facebook, label: 'Facebook' },
      { key: 'youtube', href: getSocialLink(tenant, 'youtube'), icon: Youtube, label: 'YouTube' },
      { key: 'linkedin', href: getSocialLink(tenant, 'linkedin'), icon: Linkedin, label: 'LinkedIn' },
    ].filter((item) => item.href),
    [tenant]
  );

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800 bg-gray-50">

      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center gap-4">
          <Link to="/" className="flex items-center group min-w-0">
            <img
              src={isScrolled ? logoAltUrl : logoUrl}
              alt={companyName}
              className={`w-auto object-contain transition-all duration-300 ${isScrolled ? 'h-9' : 'h-12'}`}
            />
          </Link>

          <nav className="hidden md:flex items-center gap-8 font-medium text-sm">
            <Link to="/" className="hover:text-amber-600 transition-colors">Home</Link>
            <Link to="/imoveis" className="hover:text-amber-600 transition-colors">Imóveis</Link>
            <Link to="/servicos" className="hover:text-amber-600 transition-colors">Serviços</Link>
            <Link to="/sobre" className="hover:text-amber-600 transition-colors">Sobre Nós</Link>
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="rounded-full px-5 py-2.5 text-white shadow-md transition-all hover:shadow-lg cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              Fale Conosco
            </button>
          </nav>

          <button
            className="md:hidden text-slate-900"
            onClick={() => setIsMobileMenuOpen((value) => !value)}
            aria-label="Abrir menu"
          >
            {isMobileMenuOpen ? <Icons.X /> : <Icons.Menu />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t p-4 flex flex-col gap-4 shadow-xl absolute w-full">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="py-2 border-b">Home</Link>
            <Link to="/imoveis" onClick={() => setIsMobileMenuOpen(false)} className="py-2 border-b">Imóveis</Link>
            <Link to="/servicos" onClick={() => setIsMobileMenuOpen(false)} className="py-2 border-b">Serviços</Link>
            <Link to="/sobre" onClick={() => setIsMobileMenuOpen(false)} className="py-2 border-b">Sobre Nós</Link>
            <Link to="/admin/login" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-500">
              Área do Corretor
            </Link>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsContactModalOpen(true);
              }}
              className="rounded-lg py-3 text-center font-bold text-white cursor-pointer"
              style={{ backgroundColor: primaryColor }}
            >
              Fale Conosco
            </button>
          </div>
        )}
      </header>

      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer Premium */}
      <footer className="bg-slate-950 text-slate-300 pt-20 pb-10 border-t border-slate-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12 lg:gap-8 mb-16">
            
            {/* Coluna 1: Marca e Bio (Ocupa 4 colunas) */}
            <div className="lg:col-span-4 space-y-6">
              <Link to="/" className="inline-block transition-opacity hover:opacity-80">
                {logoAltUrl ? (
                  <img src={logoAltUrl} alt={tenant?.name} className="h-10 object-contain" />
                ) : (
                  <span className="text-2xl font-black text-white tracking-tight">
                    {tenant?.name || 'Imobiliária'}
                    <span style={{ color: primaryColor }}>.</span>
                  </span>
                )}
              </Link>
              <p className="text-slate-400 text-sm leading-relaxed max-w-sm font-light">
                {siteData?.about_text 
                  ? siteData.about_text.substring(0, 150) + '...'
                  : 'Transformando a experiência imobiliária com transparência, segurança e foco absoluto no que realmente importa: você.'}
              </p>
              {siteData?.social_instagram && (
                <div className="flex items-center gap-4 pt-2">
                  <a href={siteData.social_instagram} target="_blank" rel="noreferrer" className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center hover:bg-white/10 hover:text-white transition-all">
                    <Instagram size={18} />
                  </a>
                  {/* Adicione outros ícones sociais aqui se necessário */}
                </div>
              )}
            </div>

            {/* Coluna 2: Navegação (Ocupa 2 colunas) */}
            <div className="lg:col-span-2">
              <h4 className="text-white font-semibold mb-6 tracking-wide">Navegação</h4>
              <ul className="space-y-4 text-sm font-light text-slate-400">
                <li><Link to="/imoveis" className="hover:text-white transition-colors">Encontrar Imóveis</Link></li>
                <li><Link to="/sobre" className="hover:text-white transition-colors">Nossa História</Link></li>
                <li><Link to="/servicos" className="hover:text-white transition-colors">Serviços</Link></li>
                <li><Link to="/financiamentos" className="hover:text-white transition-colors">Financiamento</Link></li>
              </ul>
            </div>

            {/* Coluna 3: Atendimento e Contato (Ocupa 4 colunas) */}
            <div className="lg:col-span-4">
              <h4 className="text-white font-semibold mb-6 tracking-wide">Atendimento</h4>
              <ul className="space-y-4 text-sm font-light text-slate-400">
                {contactAddress && (
                  <li className="flex items-start gap-3 group">
                    <MapPin size={18} className="shrink-0 text-slate-500 mt-0.5 group-hover:text-white transition-colors" />
                    <a
                      href={contactMapLink}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="leading-relaxed hover:text-brand-500 transition-colors cursor-pointer"
                    >
                      {contactAddress}
                    </a>
                  </li>
                )}
                {(siteData?.contact_phone || tenant?.phone) && (
                  <li className="flex items-center gap-3 group">
                    <Phone size={18} className="shrink-0 text-slate-500 group-hover:text-white transition-colors" />
                    <span>{siteData?.contact_phone || tenant?.phone}</span>
                  </li>
                )}
                {(siteData?.contact_email || tenant?.email) && (
                  <li className="flex items-center gap-3 group">
                    <Mail size={18} className="shrink-0 text-slate-500 group-hover:text-white transition-colors" />
                    <span>{siteData?.contact_email || tenant?.email}</span>
                  </li>
                )}
              </ul>
            </div>

            {/* Coluna 4: Documentação (Ocupa 2 colunas) */}
            <div className="lg:col-span-2">
              <h4 className="text-white font-semibold mb-6 tracking-wide">Legal</h4>
              <ul className="space-y-4 text-sm font-light text-slate-400">
                {tenantCreci && (
                  <li>
                    <p className="text-sm mt-1 opacity-70 font-semibold">{tenantCreci}</p>
                  </li>
                )}
                {siteData?.cnpj && (
                  <li>
                    <span className="block text-xs uppercase tracking-wider text-slate-600 mb-1 font-bold">CNPJ</span>
                    <span className="text-white font-medium">{siteData.cnpj}</span>
                  </li>
                )}
              </ul>
            </div>

          </div>

          {/* Bottom Bar: Copyright & Assinatura */}
          <div className="border-t border-white/10 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-slate-500 text-sm font-light">
              &copy; {new Date().getFullYear()} {siteData?.corporate_name || tenant?.name || 'Imobiliária'}. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-2 text-sm text-slate-500 font-light">
              <span>Tecnologia de ponta por</span>
              <a href="https://elevatiovendas.vercel.app" target="_blank" rel="noopener noreferrer" className="font-bold text-slate-300 hover:text-white transition-colors tracking-wide">
                Elevatio Vendas
              </a>
            </div>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
};

export default ModernLayout;

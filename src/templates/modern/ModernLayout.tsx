import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, MessageCircle, Youtube } from 'lucide-react';
import { Icons } from '../../components/Icons';
import ContactModal from '../../components/ContactModal';
import { useTenant } from '../../contexts/TenantContext';
import {
  getAboutText,
  getPrimaryColor,
  getSocialLink,
  getTenantAddress,
  getTenantEmail,
  getTenantLogo,
  getTenantLogoWhite,
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
      <div className="bg-slate-900 text-white py-2 text-xs md:text-sm">
        <div className="container mx-auto px-4 flex justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            {saleWhatsappLink ? (
              <a
                href={saleWhatsappLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1 hover:text-amber-400 transition-colors"
              >
                <Icons.House size={14} />
                Venda seu Imóvel Conosco
              </a>
            ) : (
              <button
                type="button"
                onClick={() => setIsContactModalOpen(true)}
                className="flex items-center gap-1 hover:text-amber-400 transition-colors"
              >
                <Icons.House size={14} />
                Venda seu Imóvel Conosco
              </button>
            )}
          </div>

          <div className="hidden md:flex gap-4 items-center">
            {contactPhone && <span>{contactPhone}</span>}
            <Link to="/admin/login" className="hover:text-amber-400 transition-colors">
              Área do Corretor
            </Link>
          </div>
        </div>
      </div>

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
              onClick={() => {
                if (contactWhatsappLink) {
                  window.open(contactWhatsappLink, '_blank');
                  return;
                }
                setIsContactModalOpen(true);
              }}
              className="rounded-full px-5 py-2.5 text-white shadow-md transition-all hover:shadow-lg"
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
                if (contactWhatsappLink) {
                  window.open(contactWhatsappLink, '_blank');
                  return;
                }
                setIsContactModalOpen(true);
              }}
              className="rounded-lg py-3 text-center font-bold text-white"
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

      <footer className="bg-slate-900 text-gray-300 py-12">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src={footerLogoUrl}
                alt={companyName}
                className="h-11 w-auto object-contain transition-all duration-300"
              />
            </Link>
            <p className="text-sm leading-relaxed mb-4 mt-5">
              {aboutText}
            </p>

            {socialLinks.length > 0 && (
              <div className="flex items-center gap-3 mt-4">
                {socialLinks.map(({ key, href, icon: Icon, label }) => (
                  <a
                    key={key}
                    href={href}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={label}
                    className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/70 hover:text-white hover:border-white/40 transition-all"
                  >
                    <Icon size={18} />
                  </a>
                ))}
              </div>
            )}
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/imoveis" className="hover:text-amber-400">Comprar Imóvel</Link></li>
              <li><Link to="/servicos" className="hover:text-amber-400">Serviços</Link></li>
              <li><Link to="/sobre" className="hover:text-amber-400">Sobre Nós</Link></li>
              <li><Link to="/financiamentos" className="hover:text-amber-400">Financiamentos</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Contato</h4>
            <ul className="space-y-4 text-sm text-slate-400">
              {/* Renderização segura do endereço (verifica se é objeto ou string) */}
              {(siteData.address || siteData.contact_phone || siteData.contact_email) && (
                <>
                  {siteData.address && (
                    <li className="flex items-start gap-3">
                      <Icons.MapPin size={18} className="shrink-0 text-slate-500 mt-0.5" />
                      <span>
                        {typeof siteData.address === 'object'
                          ? `${siteData.address.street || ''}, ${siteData.address.number || 's/n'}${siteData.address.city ? ' - ' + siteData.address.city : ''}`
                          : siteData.address}
                      </span>
                    </li>
                  )}
                  
                  {siteData.contact_phone && (
                    <li className="flex items-center gap-3">
                      <Icons.Phone size={18} className="shrink-0 text-slate-500" />
                      <span>{siteData.contact_phone}</span>
                    </li>
                  )}
                  
                  {siteData.contact_email && (
                    <li className="flex items-center gap-3">
                      <Icons.Mail size={18} className="shrink-0 text-slate-500" />
                      <span>{siteData.contact_email}</span>
                    </li>
                  )}
                </>
              )}
              
              {/* Fallback caso não haja dados novos, tenta usar os dados antigos ou do tenant base */}
              {!siteData.address && !siteData.contact_phone && !siteData.contact_email && tenant && (
                <>
                  {tenant.phone && (
                    <li className="flex items-center gap-3">
                      <Icons.Phone size={18} className="shrink-0 text-slate-500" />
                      <span>{tenant.phone}</span>
                    </li>
                  )}
                </>
              )}
            </ul>
          </div>

          <div>
            <h4 className="text-white font-bold mb-4">Atendimento</h4>
            <div className="flex flex-col gap-3">
              {contactWhatsappLink ? (
                <a
                  href={contactWhatsappLink}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle size={18} />
                  Chamar no WhatsApp
                </a>
              ) : (
                <button
                  type="button"
                  onClick={() => setIsContactModalOpen(true)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl py-3 px-4 font-bold text-white transition-opacity hover:opacity-90"
                  style={{ backgroundColor: primaryColor }}
                >
                  <MessageCircle size={18} />
                  Solicitar Contato
                </button>
              )}
              <p className="text-sm text-slate-400">
                Atendimento digital com a identidade visual e os dados da sua imobiliária.
              </p>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-4 mt-12 pt-8 border-t border-slate-800 text-center text-xs text-gray-500">
          © {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
        </div>
      </footer>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
};

export default ModernLayout;

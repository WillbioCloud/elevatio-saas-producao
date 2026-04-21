import React, { useEffect, useMemo, useState } from 'react';
import { Link, Outlet, useLocation } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube, Menu, X } from 'lucide-react';
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
  getTenantName,
  getTenantPhone,
  getWhatsappLink,
} from '../../utils/tenantUtils';

export default function MinimalistLayout() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const { tenant } = useTenant();

  const companyName = getTenantName(tenant);
  const primaryColor = getPrimaryColor(tenant);
  const logoUrl = getTenantLogo(tenant);
  const hasLogo = logoUrl !== '/logo-placeholder.png';
  const contactPhone = getTenantPhone(tenant);
  const contactEmail = getTenantEmail(tenant);
  const contactAddress = getTenantAddress(tenant);
  const aboutText = getAboutText(tenant);

  const siteData = React.useMemo(() => {
    return typeof tenant?.site_data === 'string'
      ? JSON.parse(tenant.site_data)
      : tenant?.site_data || {};
  }, [tenant?.site_data]);

  const socialLinks = useMemo(
    () => [
      { key: 'instagram', href: getSocialLink(tenant, 'instagram'), icon: Instagram, label: 'Instagram' },
      { key: 'facebook', href: getSocialLink(tenant, 'facebook'), icon: Facebook, label: 'Facebook' },
      { key: 'youtube', href: getSocialLink(tenant, 'youtube'), icon: Youtube, label: 'YouTube' },
      { key: 'linkedin', href: getSocialLink(tenant, 'linkedin'), icon: Linkedin, label: 'LinkedIn' },
    ].filter((item) => item.href),
    [tenant]
  );

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location.pathname]);

  // Favicon and Title
  useEffect(() => {
    if (companyName) {
      document.title = `${companyName} | Imóveis`;
    }
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

  return (
    <div className="flex min-h-screen flex-col bg-[#fcfcfc] font-sans text-slate-900">
      {/* Top Bar - Very clean */}
      <div className="hidden bg-black py-2.5 text-xs font-medium text-slate-300 md:block">
        <div className="mx-auto flex max-w-[1024px] items-center justify-between px-6">
          <div className="flex gap-8">
            {contactPhone && (
              <span className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
                <Phone size={14} /> {contactPhone}
              </span>
            )}
            {contactEmail && (
              <span className="flex items-center gap-2 hover:text-white transition-colors cursor-default">
                <Mail size={14} /> {contactEmail}
              </span>
            )}
          </div>
          <div className="flex gap-5">
            {socialLinks.map(({ key, href, icon: Icon }) => (
              <a key={key} href={href} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                <Icon size={16} />
              </a>
            ))}
          </div>
        </div>
      </div>

      <header className={`sticky top-0 z-50 transition-all duration-300 ${isScrolled ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-slate-100' : 'bg-white border-b border-slate-100'}`}>
        <div className="mx-auto flex h-16 max-w-[1024px] items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            {hasLogo ? (
              <img src={logoUrl} alt={companyName} className="h-8 object-contain" />
            ) : (
              <>
                <div className="w-5 h-5 bg-black rounded-sm"></div>
                <span className="text-lg font-semibold tracking-tight text-slate-900">{companyName}</span>
              </>
            )}
          </Link>

          <nav className="hidden gap-2 text-sm font-medium text-slate-500 md:flex">
            <Link to="/" className="px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors text-black">Início</Link>
            <Link to="/imoveis?listingType=sale" className="px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">Comprar</Link>
            <Link to="/imoveis?listingType=rent" className="px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">Alugar</Link>
            <Link to="/servicos" className="px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">Serviços</Link>
            <Link to="/sobre" className="px-3 py-2 hover:bg-slate-50 rounded-lg transition-colors">Sobre Nós</Link>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <button
              onClick={() => setIsContactModalOpen(true)}
              className="bg-black text-white px-4 py-1.5 rounded-full text-xs font-medium hover:opacity-90 transition-opacity"
            >
              Fale Conosco
            </button>
          </div>

          <button
            className="md:hidden text-slate-900 p-2 cursor-pointer"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile menu */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 p-6 flex flex-col gap-2 absolute w-full left-0 shadow-xl z-[60]">
            <Link to="/" className="px-3 py-2 text-sm font-medium bg-slate-50 rounded-lg text-black">Início</Link>
            <Link to="/imoveis?listingType=sale" className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Comprar</Link>
            <Link to="/imoveis?listingType=rent" className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Alugar</Link>
            <Link to="/servicos" className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Serviços</Link>
            <Link to="/sobre" className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Sobre Nós</Link>
            <Link to="/financiamentos" className="px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-50 rounded-lg transition-colors">Financiamentos</Link>
            <button
              type="button"
              onClick={() => {
                setIsMobileMenuOpen(false);
                setIsContactModalOpen(true);
              }}
              className="mt-4 w-full rounded-full py-2.5 font-medium text-white text-center text-sm bg-black"
            >
              Fale Conosco
            </button>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-auto bg-black py-10 md:py-12 text-slate-400">
        <div className="mx-auto grid max-w-[1024px] grid-cols-1 gap-8 md:gap-12 px-6 md:grid-cols-12">
          
          <div className="md:col-span-5 relative bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8">
            <Link to="/" className="mb-6 flex items-center gap-2">
              {hasLogo ? (
                <img src={logoUrl} alt={companyName} className="h-8 object-contain brightness-0 invert opacity-90" />
              ) : (
                <span className="text-xl font-semibold tracking-tight text-white">{companyName}</span>
              )}
            </Link>
            <p className="mb-6 max-w-sm text-sm leading-relaxed text-slate-400 font-light">{aboutText}</p>
            
            <div className="flex gap-3">
              {socialLinks.map(({ key, href, icon: Icon }) => (
                <a key={key} href={href} target="_blank" rel="noreferrer" className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center transition-colors hover:bg-white hover:text-black cursor-pointer">
                  <Icon size={14} />
                </a>
              ))}
            </div>
          </div>

          <div className="md:col-span-3 pt-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">Organization</span>
            <ul className="space-y-3 text-sm font-medium text-slate-400">
              <li><Link to="/imoveis?listingType=sale" className="hover:text-white transition-colors">Comprar Imóvel</Link></li>
              <li><Link to="/imoveis?listingType=rent" className="hover:text-white transition-colors">Alugar Imóvel</Link></li>
              <li><Link to="/servicos" className="hover:text-white transition-colors">Nossos Serviços</Link></li>
              <li><Link to="/sobre" className="hover:text-white transition-colors">Sobre a Empresa</Link></li>
              <li><Link to="/financiamentos" className="hover:text-white transition-colors">Financiamento</Link></li>
            </ul>
          </div>

          <div className="md:col-span-4 pt-2">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 block">Quick Access</span>
            <ul className="space-y-4 text-sm font-medium text-slate-400">
              <li className="flex items-start gap-3">
                <MapPin size={16} className="mt-0.5 shrink-0" /> 
                <span className="leading-relaxed">{contactAddress}</span>
              </li>
              {contactPhone && (
                <li className="flex items-center gap-3">
                  <Phone size={16} className="shrink-0" />
                  <a href={`tel:${contactPhone.replace(/\\D/g, '')}`} className="hover:text-white transition-colors">
                    {contactPhone}
                  </a>
                </li>
              )}
              {contactEmail && (
                <li className="flex items-center gap-3">
                  <Mail size={16} className="shrink-0" />
                  <a href={`mailto:${contactEmail}`} className="hover:text-white transition-colors">
                    {contactEmail}
                  </a>
                </li>
              )}
            </ul>
            
            {(siteData.creci || siteData.cnpj) && (
              <div className="mt-6 pt-6 border-t border-white/10 space-y-1 text-xs font-light tracking-wide text-slate-500">
                {siteData.creci && <p>CRECI: {siteData.creci}</p>}
                {siteData.cnpj && <p>CNPJ: {siteData.cnpj}</p>}
              </div>
            )}
          </div>
        </div>

        <div className="mx-auto mt-12 flex max-w-[1024px] flex-col items-center justify-between gap-4 border-t border-white/10 px-6 pt-6 text-xs text-slate-500 md:flex-row">
          <p>&copy; {new Date().getFullYear()} {companyName}. Todos os direitos reservados.</p>
          <div className="flex items-center gap-1">
            Bento Design por <a href="https://elevatiovendas.com.br" target="_blank" rel="noopener noreferrer" className="font-medium hover:text-white transition-colors ml-1">Elevatio Vendas</a>
          </div>
        </div>
      </footer>

      {isContactModalOpen && <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />}
    </div>
  );
}

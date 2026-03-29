import React, { useEffect, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Facebook, Instagram, Linkedin, Menu, X, MessageCircle } from 'lucide-react';
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

const ClassicLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { tenant } = useTenant();

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return <Outlet />;

  const companyName = getTenantName(tenant);
  const primaryColor = getPrimaryColor(tenant);
  const logoUrl = getTenantLogo(tenant);
  const logoAltUrl = getTenantLogoWhite(tenant);
  const contactEmail = getTenantEmail(tenant);
  const contactPhone = getTenantPhone(tenant);
  const contactAddress = getTenantAddress(tenant);
  const aboutText = getAboutText(tenant);
  const instagram = getSocialLink(tenant, 'instagram');
  const facebook = getSocialLink(tenant, 'facebook');
  const youtube = getSocialLink(tenant, 'youtube');
  const linkedin = getSocialLink(tenant, 'linkedin');
  const whatsappLink = getWhatsappLink(tenant, 'Olá');
  const hasLogo = logoUrl !== '/logo-placeholder.png';
  const hasAnySocial = Boolean(instagram || facebook || youtube || linkedin);

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <header
        className={`fixed left-0 right-0 top-0 z-50 transition-all duration-300 ${
          scrolled ? 'bg-white shadow-md py-4' : 'bg-transparent pt-6'
        }`}
      >
        <div className="container mx-auto flex items-center justify-between px-4 md:px-8">
          <Link to="/" className="z-50 flex flex-shrink-0 items-center">
            {hasLogo ? (
              <img
                src={scrolled ? logoAltUrl : logoUrl}
                alt={companyName}
                className="h-12 w-auto object-contain transition-all duration-500 ease-in-out md:h-16"
              />
            ) : (
              <span
                className={`text-2xl font-black transition-colors duration-300 ${
                  scrolled ? 'text-slate-900' : 'text-white'
                }`}
              >
                {companyName}
              </span>
            )}
          </Link>

          <nav
            className={`hidden transition-all duration-300 md:block ${
              scrolled
                ? 'bg-transparent text-slate-800'
                : 'rounded-full border border-white/20 bg-black/20 px-8 py-3 text-white backdrop-blur-md'
            }`}
          >
            <ul className="flex items-center space-x-8 text-sm font-medium">
              <li>
                <Link
                  to="/"
                  className={`transition-colors ${
                    scrolled ? 'hover:text-slate-600' : 'hover:text-white/80'
                  }`}
                >
                  Início
                </Link>
              </li>
              <li>
                <Link
                  to="/imoveis"
                  className={`transition-colors ${
                    scrolled ? 'hover:text-slate-600' : 'hover:text-white/80'
                  }`}
                >
                  Imóveis
                </Link>
              </li>
              <li>
                <Link
                  to="/servicos"
                  className={`transition-colors ${
                    scrolled ? 'hover:text-slate-600' : 'hover:text-white/80'
                  }`}
                >
                  Serviços
                </Link>
              </li>
              <li>
                <Link
                  to="/sobre"
                  className={`transition-colors ${
                    scrolled ? 'hover:text-slate-600' : 'hover:text-white/80'
                  }`}
                >
                  Sobre
                </Link>
              </li>
            </ul>
          </nav>

          <div className="hidden md:block">
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                <MessageCircle size={18} />
                {contactPhone || 'Fale Conosco'}
              </a>
            ) : (
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="rounded-lg px-6 py-2.5 text-sm font-semibold text-white transition-all hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Fale Conosco
              </button>
            )}
          </div>

          <button
            className={`z-50 transition-colors md:hidden ${scrolled ? 'text-slate-900' : 'text-white'}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {isMobileMenuOpen && (
          <div className="absolute top-full left-0 z-40 w-full animate-fade-in border-t border-gray-100 bg-white shadow-xl md:hidden">
            <div className="flex flex-col space-y-5 px-6 py-6">
              <Link
                to="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 text-base font-semibold text-gray-700 transition-colors hover:text-gray-900"
              >
                Início
              </Link>
              <Link
                to="/imoveis"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 text-base font-semibold text-gray-700 transition-colors hover:text-gray-900"
              >
                Imóveis
              </Link>
              <Link
                to="/servicos"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 text-base font-semibold text-gray-700 transition-colors hover:text-gray-900"
              >
                Serviços
              </Link>
              <Link
                to="/sobre"
                onClick={() => setIsMobileMenuOpen(false)}
                className="py-2 text-base font-semibold text-gray-700 transition-colors hover:text-gray-900"
              >
                Sobre
              </Link>
              <div className="border-t border-gray-200 pt-4">
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="flex w-full items-center justify-center gap-2 rounded-xl px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <MessageCircle size={20} />
                    {contactPhone || 'Fale Conosco'}
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      setIsContactModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full rounded-xl px-6 py-3.5 text-center text-sm font-semibold text-white shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    Fale Conosco
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </header>

      <main className="flex-grow">
        <Outlet />
      </main>

      <footer className="border-t border-gray-100 bg-gray-50 py-16">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="mb-8 grid grid-cols-1 gap-12 md:grid-cols-4">
            <div className="md:col-span-1">
              <Link to="/" className="mb-6 inline-block">
                {hasLogo ? (
                  <img src={logoUrl} alt={companyName} className="h-8 w-auto object-contain" />
                ) : (
                  <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                    {companyName}
                  </span>
                )}
              </Link>
              <p className="mb-6 text-sm leading-relaxed text-gray-600">{aboutText}</p>

              <div>
                <h4 className="mb-4 font-bold text-slate-800">Siga-nos</h4>
                <div className="flex gap-3">
                  {!hasAnySocial && (
                    <p className="text-sm text-slate-500">Redes sociais não configuradas.</p>
                  )}
                  {instagram && (
                    <a
                      href={instagram}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-pink-600 hover:text-white"
                    >
                      <Instagram size={20} />
                    </a>
                  )}
                  {facebook && (
                    <a
                      href={facebook}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-blue-600 hover:text-white"
                    >
                      <Facebook size={20} />
                    </a>
                  )}
                  {youtube && (
                    <a
                      href={youtube}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-red-600 hover:text-white"
                    >
                      <Icons.Youtube size={20} />
                    </a>
                  )}
                  {linkedin && (
                    <a
                      href={linkedin}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-600 transition-colors hover:bg-sky-600 hover:text-white"
                    >
                      <Linkedin size={20} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold text-gray-900">Menu</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/sobre" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Sobre Nós
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Imóveis
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis?type=Casa" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Casas
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis?type=Apartamento" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Apartamentos
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis?listing_type=rent" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Para Alugar
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold text-gray-900">Serviços</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/servicos" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Nossos Serviços
                  </Link>
                </li>
                <li>
                  <Link to="/avaliacao" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Avaliação de Imóveis
                  </Link>
                </li>
                <li>
                  <Link to="/financiamento" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Financiamento
                  </Link>
                </li>
                <li>
                  <Link to="/documentacao" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Documentação
                  </Link>
                </li>
              </ul>
            </div>

            <div>
              <h4 className="mb-4 text-sm font-bold text-gray-900">Contato</h4>
              <ul className="mb-6 space-y-3">
                <li>
                  <Link to="/suporte" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Suporte
                  </Link>
                </li>
                <li>
                  <Link to="/contato" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                    Fale Conosco
                  </Link>
                </li>
              </ul>
              <div>
                <h4 className="mb-4 text-sm font-bold text-gray-900">Informações</h4>
                <p className="mb-2 text-sm text-gray-600">{contactAddress}</p>
                {contactPhone && (
                  <p className="mb-2 text-sm text-gray-600">
                    <a href={`tel:${contactPhone.replace(/\D/g, '')}`} className="hover:text-gray-900">
                      {contactPhone}
                    </a>
                  </p>
                )}
                {contactEmail && (
                  <p className="text-sm text-gray-600">
                    <a href={`mailto:${contactEmail}`} className="hover:text-gray-900">
                      {contactEmail}
                    </a>
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col items-center justify-between border-t border-gray-200 pt-8 md:flex-row">
            <div className="mb-4 flex items-center space-x-6 md:mb-0">
              <h5 className="text-sm font-bold text-gray-900">Legal</h5>
              <Link to="/privacidade" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                Política de Privacidade
              </Link>
              <Link to="/termos" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                Termos de Uso
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <span className="text-sm text-gray-600">
                © {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
              </span>
              <Link to="/admin/login" className="text-sm text-gray-600 transition-colors hover:text-gray-900">
                Área do Corretor
              </Link>
            </div>
          </div>
        </div>
      </footer>

      <ContactModal isOpen={isContactModalOpen} onClose={() => setIsContactModalOpen(false)} />
    </div>
  );
};

export default ClassicLayout;

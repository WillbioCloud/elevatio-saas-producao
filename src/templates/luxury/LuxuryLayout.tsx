import React, { useState } from 'react';
import { Outlet, Link } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { Icons } from '../../components/Icons';

type ContactAction =
  | { type: 'link'; href: string; label: string }
  | { type: 'anchor'; href: string; label: string };

export default function LuxuryLayout() {
  const { tenant } = useTenant();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const siteData = (tenant?.site_data as any) || {};
  const logoUrl = siteData.logo_white_url || siteData.logo_url || tenant?.logo_url;
  const companyName = tenant?.name || 'Imobiliária';
  const contactPhone = siteData.contact?.phone || tenant?.phone || '';
  const contactEmail = siteData.contact?.email || tenant?.email || '';
  const contactAddress = siteData.contact?.address || tenant?.address || '';
  const whatsapp = siteData.social?.whatsapp || contactPhone || '';
  const whatsappLink = whatsapp
    ? `https://wa.me/${String(whatsapp).replace(/\D/g, '')}?text=${encodeURIComponent(
        `Olá! Gostaria de falar com a equipe da ${companyName}.`
      )}`
    : '';

  const navItems = [
    { label: 'Início', path: '/' },
    { label: 'Imóveis', path: '/imoveis' },
    { label: 'Sobre', path: '/sobre' },
    { label: 'Serviços', path: '/servicos' },
  ];

  const contactAction: ContactAction = whatsappLink
    ? { type: 'anchor', href: whatsappLink, label: 'Fale Conosco' }
    : contactEmail
      ? { type: 'anchor', href: `mailto:${contactEmail}`, label: 'Fale Conosco' }
      : { type: 'link', href: '/servicos', label: 'Fale Conosco' };

  const renderBrand = (imageClassName: string, textClassName: string) => {
    if (logoUrl) {
      return (
        <img
          src={logoUrl}
          alt={companyName}
          className={imageClassName}
        />
      );
    }

    return (
      <span className={textClassName}>
        {companyName}
        <span className="text-sm align-top text-neutral-500 ml-0.5">&copy;</span>
      </span>
    );
  };

  const renderContactCta = (className: string, onClick?: () => void) => {
    if (contactAction.type === 'anchor') {
      return (
        <a
          href={contactAction.href}
          target={contactAction.href.startsWith('http') ? '_blank' : undefined}
          rel={contactAction.href.startsWith('http') ? 'noreferrer' : undefined}
          onClick={onClick}
          className={className}
        >
          {contactAction.label}
        </a>
      );
    }

    return (
      <Link
        to={contactAction.href}
        onClick={onClick}
        className={className}
      >
        {contactAction.label}
      </Link>
    );
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap');

        .modhous-root {
          font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          -webkit-font-smoothing: antialiased;
          -moz-osx-font-smoothing: grayscale;
          box-sizing: border-box;
          background: #0e0e0e;
          color: #ffffff;
        }

        .modhous-root *,
        .modhous-root *::before,
        .modhous-root *::after {
          box-sizing: inherit;
        }

        @keyframes modhous-fade-in {
          from {
            opacity: 0;
            transform: translateY(-8px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .modhous-fade-in {
          animation: modhous-fade-in 0.22s ease;
        }
      `}</style>

      <div className="modhous-root min-h-screen flex flex-col">
        <header className="fixed top-0 left-0 right-0 z-50 px-6 py-4 max-w-[1400px] mx-auto w-full bg-transparent selection:bg-white selection:text-black">
          <nav className="flex justify-between items-center bg-black border border-white/5 rounded-full px-4 py-2">
            <Link to="/" className="text-xl font-medium tracking-tighter text-white hover:text-neutral-300 transition-colors flex items-center">
              {logoUrl ? (
                <img 
                  src={logoUrl} 
                  alt={companyName} 
                  className="h-6 md:h-7 w-auto object-contain opacity-90 hover:opacity-100 transition-opacity" 
                />
              ) : (
                <>{companyName}<span className="text-sm align-top text-neutral-500 ml-0.5">&copy;</span></>
              )}
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="text-neutral-400 text-sm px-4 py-1.5 rounded-full hover:bg-neutral-800 hover:text-white transition-all"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="flex items-center gap-3">
              {renderContactCta(
                'hidden md:block bg-white text-black text-sm px-5 py-2 rounded-full font-medium hover:bg-neutral-200 transition-colors'
              )}

              <button
                type="button"
                onClick={() => setMobileMenuOpen((prev) => !prev)}
                className="md:hidden text-white p-1"
                aria-label={mobileMenuOpen ? 'Fechar menu' : 'Abrir menu'}
              >
                {mobileMenuOpen ? <Icons.X size={24} /> : <Icons.Menu size={24} />}
              </button>
            </div>
          </nav>

          {mobileMenuOpen && (
            <div className="md:hidden absolute top-20 left-6 right-6 bg-black border border-white/10 rounded-3xl p-6 shadow-xl modhous-fade-in">
              <div className="flex flex-col gap-4">
                {navItems.map((item) => (
                  <Link
                    key={item.path}
                    to={item.path}
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-neutral-300 text-lg py-2 border-b border-white/5"
                  >
                    {item.label}
                  </Link>
                ))}

                {renderContactCta(
                  'bg-white text-black text-center mt-4 text-sm px-5 py-3 rounded-full font-medium',
                  () => setMobileMenuOpen(false)
                )}
              </div>
            </div>
          )}
        </header>

        <main className="flex-grow selection:bg-white selection:text-black">
          <Outlet />
        </main>

        <footer className="px-6 py-20 max-w-[1400px] mx-auto w-full selection:bg-white selection:text-black">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-12">
            <div className="md:col-span-4">
              <Link to="/" className="text-2xl font-medium tracking-tighter text-white mb-6 block">
                {logoUrl ? (
                  <img 
                    src={logoUrl} 
                    alt={companyName} 
                    className="h-8 w-auto object-contain opacity-70 hover:opacity-100 transition-opacity" 
                  />
                ) : (
                  <>{companyName}<span className="text-sm align-top text-neutral-500 ml-0.5">&copy;</span></>
                )}
              </Link>

              <p className="text-neutral-500 text-sm max-w-sm leading-relaxed whitespace-pre-line">
                {siteData.about_text?.slice(0, 160) ||
                  'Curadoria de propriedades residenciais e comerciais de alto padrão.'}
              </p>
            </div>

            <div className="md:col-span-2 space-y-4">
              <h4 className="text-neutral-300 text-sm font-medium mb-5">Explorar</h4>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="text-neutral-500 hover:text-white text-sm block transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </div>

            <div className="md:col-span-3 space-y-4">
              <h4 className="text-neutral-300 text-sm font-medium mb-5">Portfólio</h4>
              <Link
                to="/imoveis?listing_type=sale"
                className="text-neutral-500 hover:text-white text-sm block transition-colors"
              >
                Imóveis à Venda
              </Link>
              <Link
                to="/imoveis?listing_type=rent"
                className="text-neutral-500 hover:text-white text-sm block transition-colors"
              >
                Imóveis para Aluguel
              </Link>
            </div>

            <div className="md:col-span-3 space-y-4">
              <h4 className="text-neutral-300 text-sm font-medium mb-5">Contato</h4>
              {contactPhone && <span className="text-neutral-500 text-sm block">{contactPhone}</span>}
              {contactEmail && <span className="text-neutral-500 text-sm block">{contactEmail}</span>}
              {contactAddress && (
                <span className="text-neutral-500 text-sm block whitespace-pre-line">
                  {contactAddress}
                </span>
              )}
            </div>
          </div>

          <div className="mt-20 pt-10 border-t border-white/5 text-center flex flex-col md:flex-row justify-between gap-4">
            <p className="text-neutral-700 text-xs tracking-wider uppercase">
              &copy; {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
            </p>
            <p className="text-neutral-700 text-xs tracking-wider uppercase opacity-50">
              Powered by Elevatio Vendas
            </p>
          </div>
        </footer>
      </div>
    </>
  );
}

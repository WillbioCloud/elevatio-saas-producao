import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Instagram, Facebook, Linkedin, Youtube, Menu, X, Diamond, ArrowUp } from 'lucide-react';
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

const BasicoLayout: React.FC = () => {
  const { tenant } = useTenant();
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 50);
    window.addEventListener('scroll', onScroll);
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileOpen]);

  const companyName = getTenantName(tenant);
  const primaryColor = getPrimaryColor(tenant);
  const logoUrl = getTenantLogo(tenant);
  const contactPhone = getTenantPhone(tenant);
  const contactEmail = getTenantEmail(tenant);
  const contactAddress = getTenantAddress(tenant);
  const aboutText = getAboutText(tenant);
  const whatsappLink = getWhatsappLink(tenant, 'Olá');
  const instagramLink = getSocialLink(tenant, 'instagram');
  const facebookLink = getSocialLink(tenant, 'facebook');
  const linkedinLink = getSocialLink(tenant, 'linkedin');
  const youtubeLink = getSocialLink(tenant, 'youtube');
  const hasLogo = logoUrl !== '/logo-placeholder.png';

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Serviços', href: '/#servicos' },
    { label: 'Imóveis', href: '/imoveis' },
    { label: 'Sobre Nós', href: '/#sobre' },
  ];

  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white antialiased">
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          scrolled
            ? 'border-b border-white/10 bg-[#0e0e0e]/95 py-3 backdrop-blur-xl'
            : 'bg-gradient-to-b from-black/60 to-transparent py-5'
        }`}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <Link to="/" className="group relative z-10 flex items-center gap-3">
            {hasLogo ? (
              <img src={logoUrl} alt={companyName} className="h-10 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-3">
                <div
                  className="flex h-11 w-11 items-center justify-center border-2 transition-all duration-500 group-hover:border-[var(--primary)] group-hover:bg-[var(--primary)]"
                  style={{ borderColor: primaryColor }}
                >
                  <Diamond
                    style={{ color: primaryColor }}
                    size={18}
                    className="transition-colors duration-500 group-hover:text-[#0e0e0e]"
                  />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-serif text-xl font-bold tracking-wider text-white">{companyName}</span>
                </div>
              </div>
            )}
          </Link>

          <div className="hidden items-center gap-9 lg:flex">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="relative text-[13px] uppercase tracking-widest text-white/75 transition-colors duration-300 after:absolute after:bottom-[-6px] after:left-1/2 after:h-[1px] after:w-0 after:-translate-x-1/2 after:transition-all after:duration-400 after:content-[''] hover:text-white hover:after:w-full"
                style={{ ['--tw-after-bg' as never]: primaryColor }}
              >
                {link.label}
              </a>
            ))}
          </div>

          <div className="flex items-center gap-5">
            <a
              href={whatsappLink || '#contato'}
              target={whatsappLink ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="hidden items-center gap-2 border px-7 py-2.5 text-[12px] font-medium uppercase tracking-widest transition-all duration-500 md:inline-flex"
              style={{ borderColor: primaryColor, color: primaryColor }}
              onMouseEnter={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = primaryColor;
                (e.currentTarget as HTMLElement).style.color = '#0e0e0e';
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = primaryColor;
              }}
            >
              {contactPhone || 'Agendar Consulta'}
            </a>
            <button
              className="p-2 text-white/90 transition-colors duration-300 hover:text-white lg:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </nav>

      <div className={`fixed inset-0 z-40 transition-all duration-500 lg:hidden ${mobileOpen ? 'visible' : 'invisible'}`}>
        <div
          className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <div className={`absolute right-0 top-0 h-full w-full max-w-sm border-l border-white/10 bg-[#111] transition-transform duration-500 ease-out ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between border-b border-white/10 p-6">
            <span className="font-serif text-lg font-bold tracking-wider text-white">Menu</span>
            <button onClick={() => setMobileOpen(false)} className="p-1 text-white/70 transition-colors hover:text-white">
              <X size={24} />
            </button>
          </div>
          <div className="space-y-1 p-6">
            {navLinks.map((link, index) => (
              <a
                key={link.href}
                href={link.href}
                className="block border-b border-white/10 py-3.5 text-base tracking-wide text-white/80 transition-all duration-300 hover:pl-2 hover:text-white"
                onClick={() => setMobileOpen(false)}
                style={{ animationDelay: `${index * 50}ms` }}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-6">
              <a
                href={whatsappLink || '#contato'}
                target={whatsappLink ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="block border px-6 py-3.5 text-center text-sm font-medium uppercase tracking-widest transition-all duration-500"
                style={{ borderColor: primaryColor, color: primaryColor }}
                onClick={() => setMobileOpen(false)}
              >
                {contactPhone || 'Agendar Consulta'}
              </a>
            </div>
          </div>
        </div>
      </div>

      <main>
        <Outlet />
      </main>

      <footer className="relative bg-[#0e0e0e]">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="mx-auto max-w-7xl px-6 py-16 sm:py-20">
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
            <div className="sm:col-span-2 lg:col-span-1">
              <Link to="/" className="group mb-7 flex items-center gap-3">
                {hasLogo ? (
                  <img src={logoUrl} alt={companyName} className="h-10 w-auto object-contain" />
                ) : (
                  <>
                    <div
                      className="flex h-11 w-11 items-center justify-center border-2 transition-all duration-500 group-hover:bg-[var(--primary)]"
                      style={{ borderColor: primaryColor }}
                    >
                      <Diamond style={{ color: primaryColor }} size={18} />
                    </div>
                    <div className="flex flex-col leading-none">
                      <span className="font-serif text-xl font-bold tracking-wider text-white">{companyName}</span>
                    </div>
                  </>
                )}
              </Link>
              <p className="mb-7 max-w-xs text-sm leading-relaxed text-white/40">
                {aboutText.slice(0, 120)}
                {aboutText.length > 120 ? '...' : ''}
              </p>
              <div className="flex items-center gap-3">
                {instagramLink && (
                  <a href={instagramLink} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all duration-300 hover:border-white/40 hover:text-white">
                    <Instagram size={16} />
                  </a>
                )}
                {facebookLink && (
                  <a href={facebookLink} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all duration-300 hover:border-white/40 hover:text-white">
                    <Facebook size={16} />
                  </a>
                )}
                {linkedinLink && (
                  <a href={linkedinLink} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all duration-300 hover:border-white/40 hover:text-white">
                    <Linkedin size={16} />
                  </a>
                )}
                {youtubeLink && (
                  <a href={youtubeLink} target="_blank" rel="noopener noreferrer" className="flex h-10 w-10 items-center justify-center rounded-lg border border-white/10 text-white/40 transition-all duration-300 hover:border-white/40 hover:text-white">
                    <Youtube size={16} />
                  </a>
                )}
              </div>
            </div>

            <div>
              <h4 className="relative mb-7 font-serif text-lg font-semibold text-white">
                Links Rápidos
                <div className="absolute -bottom-2 left-0 h-0.5 w-8" style={{ backgroundColor: `${primaryColor}66` }} />
              </h4>
              <ul className="space-y-3.5">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="inline-block text-sm text-white/40 transition-all duration-300 hover:pl-1 hover:text-white">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="relative mb-7 font-serif text-lg font-semibold text-white">
                Imóveis
                <div className="absolute -bottom-2 left-0 h-0.5 w-8" style={{ backgroundColor: `${primaryColor}66` }} />
              </h4>
              <ul className="space-y-3.5">
                {['Casas', 'Apartamentos', 'Terrenos', 'Comerciais', 'Para Alugar'].map((segment) => (
                  <li key={segment}>
                    <Link to="/imoveis" className="inline-block text-sm text-white/40 transition-all duration-300 hover:pl-1 hover:text-white">
                      {segment}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h4 className="relative mb-7 font-serif text-lg font-semibold text-white">
                Contato
                <div className="absolute -bottom-2 left-0 h-0.5 w-8" style={{ backgroundColor: `${primaryColor}66` }} />
              </h4>
              <div className="space-y-4 text-sm leading-relaxed text-white/40">
                <p>{contactAddress}</p>
                {contactPhone && (
                  <p style={{ color: `${primaryColor}bb` }}>
                    <a href={`tel:${contactPhone.replace(/\D/g, '')}`}>{contactPhone}</a>
                  </p>
                )}
                {contactEmail && (
                  <p style={{ color: `${primaryColor}bb` }}>
                    <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-white/10">
          <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-6 py-6 sm:flex-row">
            <p className="text-center text-sm text-white/30 sm:text-left">
              © {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-sm text-white/30 transition-colors duration-300 hover:text-white">Política de Privacidade</a>
              <a href="#" className="text-sm text-white/30 transition-colors duration-300 hover:text-white">Termos de Uso</a>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="flex h-10 w-10 items-center justify-center rounded-full border border-white/10 text-white/40 transition-all duration-300 hover:border-white/40 hover:text-white"
                aria-label="Voltar ao topo"
              >
                <ArrowUp size={16} />
              </button>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default BasicoLayout;

import React, { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { useTenant } from '../../contexts/TenantContext';
import { Instagram, Facebook, Linkedin, Youtube, Menu, X, Diamond, ArrowUp } from 'lucide-react';

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
    return () => { document.body.style.overflow = ''; };
  }, [mobileOpen]);

  const siteData = tenant?.site_data as any;
  const companyName = tenant?.name || 'Imobiliária';
  const primaryColor = siteData?.primary_color || '#b08d5e';
  const logoUrl = siteData?.logo_url || '';
  const whatsapp = siteData?.social?.whatsapp || siteData?.contact?.phone || '';
  const whatsappLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : '#contato';

  const navLinks = [
    { label: 'Home', href: '/' },
    { label: 'Serviços', href: '/#servicos' },
    { label: 'Imóveis', href: '/imoveis' },
    { label: 'Sobre Nós', href: '/#sobre' },
  ];

  return (
    <div className="bg-[#0e0e0e] text-white min-h-screen antialiased">
      {/* Navbar */}
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-700 ${
          scrolled
            ? 'bg-[#0e0e0e]/95 backdrop-blur-xl border-b border-white/10 py-3'
            : 'bg-gradient-to-b from-black/60 to-transparent py-5'
        }`}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 group relative z-10">
            {logoUrl ? (
              <img src={logoUrl} alt={companyName} className="h-10 w-auto object-contain" />
            ) : (
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 border-2 flex items-center justify-center transition-all duration-500 group-hover:bg-[var(--primary)] group-hover:border-[var(--primary)]" style={{ borderColor: primaryColor }}>
                  <Diamond style={{ color: primaryColor }} size={18} className="group-hover:text-[#0e0e0e] transition-colors duration-500" />
                </div>
                <div className="flex flex-col leading-none">
                  <span className="font-serif text-white text-xl font-bold tracking-wider">{companyName}</span>
                </div>
              </div>
            )}
          </Link>

          {/* Desktop Nav */}
          <div className="hidden lg:flex items-center gap-9">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white/75 text-[13px] tracking-widest uppercase hover:text-white transition-colors duration-300 relative after:content-[''] after:absolute after:bottom-[-6px] after:left-1/2 after:-translate-x-1/2 after:w-0 after:h-[1px] after:transition-all after:duration-400 hover:after:w-full"
                style={{ ['--tw-after-bg' as any]: primaryColor }}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA + Mobile Toggle */}
          <div className="flex items-center gap-5">
            <a
              href={whatsappLink}
              target={whatsapp ? '_blank' : undefined}
              rel="noopener noreferrer"
              className="hidden md:inline-flex items-center gap-2 border px-7 py-2.5 text-[12px] tracking-widest uppercase font-medium transition-all duration-500"
              style={{ borderColor: primaryColor, color: primaryColor }}
              onMouseEnter={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = primaryColor;
                (e.currentTarget as HTMLElement).style.color = '#0e0e0e';
              }}
              onMouseLeave={e => {
                (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent';
                (e.currentTarget as HTMLElement).style.color = primaryColor;
              }}
            >
              Agendar Consulta
            </a>
            <button
              className="lg:hidden text-white/90 p-2 hover:text-white transition-colors duration-300"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile Menu */}
      <div className={`fixed inset-0 z-40 lg:hidden transition-all duration-500 ${mobileOpen ? 'visible' : 'invisible'}`}>
        <div
          className={`absolute inset-0 bg-black/80 backdrop-blur-sm transition-opacity duration-500 ${mobileOpen ? 'opacity-100' : 'opacity-0'}`}
          onClick={() => setMobileOpen(false)}
        />
        <div className={`absolute right-0 top-0 h-full w-full max-w-sm bg-[#111] border-l border-white/10 transition-transform duration-500 ease-out ${mobileOpen ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="flex items-center justify-between p-6 border-b border-white/10">
            <span className="font-serif text-white text-lg font-bold tracking-wider">Menu</span>
            <button onClick={() => setMobileOpen(false)} className="text-white/70 hover:text-white transition-colors p-1">
              <X size={24} />
            </button>
          </div>
          <div className="p-6 space-y-1">
            {navLinks.map((link, i) => (
              <a
                key={link.href}
                href={link.href}
                className="block text-white/80 text-base tracking-wide hover:text-white hover:pl-2 transition-all duration-300 py-3.5 border-b border-white/10"
                onClick={() => setMobileOpen(false)}
                style={{ animationDelay: `${i * 50}ms` }}
              >
                {link.label}
              </a>
            ))}
            <div className="pt-6">
              <a
                href={whatsappLink}
                target={whatsapp ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="block border px-6 py-3.5 text-sm tracking-widest uppercase text-center font-medium transition-all duration-500"
                style={{ borderColor: primaryColor, color: primaryColor }}
                onClick={() => setMobileOpen(false)}
              >
                Agendar Consulta
              </a>
            </div>
          </div>
        </div>
      </div>

      {/* Page Content */}
      <main>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-[#0e0e0e] relative">
        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        <div className="max-w-7xl mx-auto px-6 py-16 sm:py-20">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-10 lg:gap-8">
            {/* Brand */}
            <div className="sm:col-span-2 lg:col-span-1">
              <a href="#home" className="flex items-center gap-3 mb-7 group">
                {logoUrl ? (
                  <img src={logoUrl} alt={companyName} className="h-10 w-auto object-contain" />
                ) : (
                  <>
                    <div className="w-11 h-11 border-2 flex items-center justify-center transition-all duration-500 group-hover:bg-[var(--primary)]" style={{ borderColor: primaryColor }}>
                      <Diamond style={{ color: primaryColor }} size={18} />
                    </div>
                    <div className="flex flex-col leading-none">
                      <span className="font-serif text-white text-xl font-bold tracking-wider">{companyName}</span>
                    </div>
                  </>
                )}
              </a>
              <p className="text-white/40 text-sm leading-relaxed mb-7 max-w-xs">
                {siteData?.about_text?.slice(0, 120) || 'Especialistas em imóveis. Experiência, exclusividade e excelência em cada negociação.'}
              </p>
              <div className="flex items-center gap-3">
                {siteData?.social_instagram && (
                  <a href={siteData.social_instagram} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all duration-300">
                    <Instagram size={16} />
                  </a>
                )}
                {siteData?.social_facebook && (
                  <a href={siteData.social_facebook} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all duration-300">
                    <Facebook size={16} />
                  </a>
                )}
                {siteData?.social_linkedin && (
                  <a href={siteData.social_linkedin} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all duration-300">
                    <Linkedin size={16} />
                  </a>
                )}
                {siteData?.social_youtube && (
                  <a href={siteData.social_youtube} target="_blank" rel="noopener noreferrer" className="w-10 h-10 rounded-lg border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all duration-300">
                    <Youtube size={16} />
                  </a>
                )}
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="font-serif text-white font-semibold mb-7 text-lg relative">
                Links Rápidos
                <div className="absolute -bottom-2 left-0 w-8 h-0.5" style={{ backgroundColor: primaryColor + '66' }} />
              </h4>
              <ul className="space-y-3.5">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    <a href={link.href} className="text-white/40 text-sm hover:text-white hover:pl-1 transition-all duration-300 inline-block">
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Imóveis */}
            <div>
              <h4 className="font-serif text-white font-semibold mb-7 text-lg relative">
                Imóveis
                <div className="absolute -bottom-2 left-0 w-8 h-0.5" style={{ backgroundColor: primaryColor + '66' }} />
              </h4>
              <ul className="space-y-3.5">
                {['Casas', 'Apartamentos', 'Terrenos', 'Comerciais', 'Para Alugar'].map((s) => (
                  <li key={s}>
                    <Link to="/imoveis" className="text-white/40 text-sm hover:text-white hover:pl-1 transition-all duration-300 inline-block">
                      {s}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>

            {/* Contact */}
            <div>
              <h4 className="font-serif text-white font-semibold mb-7 text-lg relative">
                Contato
                <div className="absolute -bottom-2 left-0 w-8 h-0.5" style={{ backgroundColor: primaryColor + '66' }} />
              </h4>
              <div className="space-y-4 text-white/40 text-sm leading-relaxed">
                {siteData?.contact?.address && <p>{siteData.contact.address}</p>}
                {siteData?.contact?.phone && (
                  <p style={{ color: primaryColor + 'bb' }}>
                    <a href={`tel:${siteData.contact.phone.replace(/\D/g, '')}`}>{siteData.contact.phone}</a>
                  </p>
                )}
                {siteData?.contact?.email && (
                  <p style={{ color: primaryColor + 'bb' }}>
                    <a href={`mailto:${siteData.contact.email}`}>{siteData.contact.email}</a>
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10">
          <div className="max-w-7xl mx-auto px-6 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-white/30 text-sm text-center sm:text-left">
              © {new Date().getFullYear()} {companyName}. Todos os direitos reservados.
            </p>
            <div className="flex items-center gap-6">
              <a href="#" className="text-white/30 text-sm hover:text-white transition-colors duration-300">Política de Privacidade</a>
              <a href="#" className="text-white/30 text-sm hover:text-white transition-colors duration-300">Termos de Uso</a>
              <button
                onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
                className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center text-white/40 hover:text-white hover:border-white/40 transition-all duration-300"
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

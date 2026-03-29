import React from 'react';
import { Outlet, Link } from 'react-router-dom';
import { Building2, Phone, Mail, MapPin, Instagram, Facebook } from 'lucide-react';
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
  const { tenant } = useTenant();
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
  const hasLogo = logoUrl !== '/logo-placeholder.png';

  return (
    <div className="flex min-h-screen flex-col bg-slate-50 font-sans text-slate-900">
      <div className="hidden bg-slate-900 py-2 text-xs font-medium text-slate-300 md:block">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-6">
          <div className="flex gap-6">
            {contactPhone && (
              <span className="flex items-center gap-2">
                <Phone size={14} /> {contactPhone}
              </span>
            )}
            {contactEmail && (
              <span className="flex items-center gap-2">
                <Mail size={14} /> {contactEmail}
              </span>
            )}
          </div>
          <div className="flex gap-4">
            {instagramLink && (
              <a href={instagramLink} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                <Instagram size={16} />
              </a>
            )}
            {facebookLink && (
              <a href={facebookLink} target="_blank" rel="noreferrer" className="transition-colors hover:text-white">
                <Facebook size={16} />
              </a>
            )}
          </div>
        </div>
      </div>

      <header className="sticky top-0 z-50 border-b border-slate-200/50 bg-white/80 backdrop-blur-md shadow-sm">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6">
          <Link to="/" className="flex items-center gap-2">
            {hasLogo ? (
              <img src={logoUrl} alt={companyName} className="h-10 object-contain" />
            ) : (
              <>
                <div
                  className="rounded-lg p-2"
                  style={{ backgroundColor: `${primaryColor}15`, color: primaryColor }}
                >
                  <Building2 size={24} />
                </div>
                <span className="text-2xl font-black tracking-tight text-slate-900">{companyName}</span>
              </>
            )}
          </Link>

          <nav className="hidden gap-8 text-sm font-bold text-slate-600 md:flex">
            <Link to="/" className="transition-colors hover:text-slate-900">Início</Link>
            <Link to="/imoveis" className="transition-colors hover:text-slate-900">Comprar</Link>
            <Link to="/imoveis" className="transition-colors hover:text-slate-900">Alugar</Link>
            <Link to="/sobre" className="transition-colors hover:text-slate-900">Sobre Nós</Link>
          </nav>

          {whatsappLink ? (
            <a
              href={whatsappLink}
              target="_blank"
              rel="noreferrer"
              className="hidden rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-105 md:flex"
              style={{ backgroundColor: primaryColor }}
            >
              {contactPhone || 'Fale Conosco'}
            </a>
          ) : (
            <Link
              to="/contato"
              className="hidden rounded-full px-6 py-2.5 text-sm font-bold text-white shadow-md transition-transform hover:scale-105 md:flex"
              style={{ backgroundColor: primaryColor }}
            >
              Fale Conosco
            </Link>
          )}
        </div>
      </header>

      <main className="flex-1">
        <Outlet />
      </main>

      <footer className="mt-auto bg-slate-950 py-16 text-slate-400">
        <div className="mx-auto grid max-w-7xl grid-cols-1 gap-12 px-6 md:grid-cols-4">
          <div className="md:col-span-2">
            <Link to="/" className="mb-6 flex items-center gap-3 text-white">
              {hasLogo ? (
                <img src={logoUrl} alt={companyName} className="h-10 object-contain" />
              ) : (
                <Building2 size={28} style={{ color: primaryColor }} />
              )}
              <span className="text-2xl font-black tracking-tight">{companyName}</span>
            </Link>
            <p className="mb-6 max-w-md leading-relaxed text-slate-400">{aboutText}</p>
          </div>

          <div>
            <h4 className="mb-6 text-sm font-bold uppercase tracking-wider text-white">Links Úteis</h4>
            <ul className="space-y-4 font-medium">
              <li><Link to="/imoveis" className="transition-colors hover:text-white">Todos os Imóveis</Link></li>
              <li><Link to="/sobre" className="transition-colors hover:text-white">Nossa História</Link></li>
              <li><Link to="/financiamento" className="transition-colors hover:text-white">Financiamento</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="mb-6 text-sm font-bold uppercase tracking-wider text-white">Contato</h4>
            <ul className="space-y-4">
              <li className="flex items-center gap-3">
                <MapPin size={18} style={{ color: primaryColor }} /> {contactAddress}
              </li>
              {contactPhone && (
                <li className="flex items-center gap-3">
                  <Phone size={18} style={{ color: primaryColor }} />
                  <a href={`tel:${contactPhone.replace(/\D/g, '')}`} className="transition-colors hover:text-white">
                    {contactPhone}
                  </a>
                </li>
              )}
              {contactEmail && (
                <li className="flex items-center gap-3">
                  <Mail size={18} style={{ color: primaryColor }} />
                  <a href={`mailto:${contactEmail}`} className="transition-colors hover:text-white">
                    {contactEmail}
                  </a>
                </li>
              )}
            </ul>
          </div>
        </div>

        <div className="mx-auto mt-16 flex max-w-7xl flex-col items-center justify-between gap-2 border-t border-white/10 px-6 pt-8 text-sm md:flex-row">
          <p>&copy; {new Date().getFullYear()} {companyName}. Todos os direitos reservados.</p>
          <p className="mt-2 flex items-center gap-1 opacity-50 md:mt-0">
            Tecnologia por <Building2 size={12} /> Elevatio Vendas
          </p>
        </div>
      </footer>
    </div>
  );
}

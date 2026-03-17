import React, { useEffect, useState } from 'react';
import { Link, useLocation, Outlet } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import ContactModal from '../../components/ContactModal';
import { useTenant } from '../../contexts/TenantContext';
import { Facebook, Instagram, Linkedin, Twitter, Menu, X, MessageCircle } from 'lucide-react';

const ClassicLayout: React.FC = () => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { tenant } = useTenant();

  // Força o site público a ser sempre Claro
  useEffect(() => {
    document.documentElement.classList.remove('dark');
  }, []);

  // Detecta scroll para mudar estilo do navbar
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 60);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return <Outlet />;

  const companyName = tenant?.name || 'Estately';
  const siteData = tenant?.site_data;
  const primaryColor = siteData?.primary_color || '#1e293b';
  const secondaryColor = siteData?.secondary_color || '#3b82f6';
  
  // LÓGICA DAS LOGOS
  const logoUrl = siteData?.logo_url || 'https://placehold.co/400x100/png?text=Logo+Completa';
  // Lemos a logo alternativa do banco (se não existir, faz fallback para a principal)
  const logoAltUrl = siteData?.logo_alt_url || siteData?.logo_white_url || logoUrl;
  
  const contactEmail = siteData?.contact?.email || '';
  const contactPhone = siteData?.contact?.phone || '';
  const contactAddress = siteData?.contact?.address || '';
  const whatsapp = siteData?.social?.whatsapp || '';
  const instagram = siteData?.social?.instagram || '';
  const facebook = siteData?.social?.facebook || '';

  const whatsappLink = whatsapp ? `https://wa.me/${whatsapp.replace(/\D/g, '')}` : '';

  return (
    <div className="min-h-screen flex flex-col bg-white">
      
      {/* Navbar com Efeito Premium - Pílula Flutuante */}
      <header 
        className={`fixed w-full z-50 transition-all duration-300 left-0 right-0 ${
          scrolled ? 'top-0 bg-white shadow-md py-4' : 'top-0 pt-6 bg-transparent'
        }`}
      >
        <div className="container mx-auto px-4 md:px-8 flex items-center justify-between">
          
          {/* ESQUERDA: Logo (Independente) */}
          <Link to="/" className="flex-shrink-0 flex items-center z-50">
            {logoUrl ? (
              <img
                // Troca a logo dependendo se rolou a tela ou não
                src={scrolled ? logoAltUrl : logoUrl}
                alt={companyName}
                // Aumentamos a altura (h-12 no mobile, h-16 no desktop)
                className="h-12 md:h-16 w-auto object-contain transition-all duration-500 ease-in-out"
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

          {/* CENTRO: Menu Pílula */}
          <nav 
            className={`hidden md:block transition-all duration-300 ${
              scrolled 
                ? 'bg-transparent text-slate-800' 
                : 'bg-black/20 backdrop-blur-md border border-white/20 rounded-full px-8 py-3 text-white'
            }`}
          >
            <ul className="flex items-center space-x-8 font-medium text-sm">
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

          {/* DIREITA: Botão Fale Conosco (Independente) */}
          <div className="hidden md:block z-10">
            {whatsappLink ? (
              <a
                href={whatsappLink}
                target="_blank"
                rel="noreferrer"
                className="text-sm font-semibold text-white px-6 py-2.5 rounded-lg transition-all hover:opacity-90 flex items-center gap-2"
                style={{ backgroundColor: primaryColor }}
              >
                <MessageCircle size={18} />
                Fale Conosco
              </a>
            ) : (
              <button
                onClick={() => setIsContactModalOpen(true)}
                className="text-sm font-semibold text-white px-6 py-2.5 rounded-lg transition-all hover:opacity-90"
                style={{ backgroundColor: primaryColor }}
              >
                Fale Conosco
              </button>
            )}
          </div>

          {/* Mobile Menu Toggle */}
          <button 
            className={`md:hidden transition-colors z-50 ${scrolled ? 'text-slate-900' : 'text-white'}`}
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <X size={28} /> : <Menu size={28} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isMobileMenuOpen && (
          <div className="md:hidden absolute top-full left-0 w-full bg-white shadow-xl border-t border-gray-100 z-40 animate-fade-in">
            <div className="py-6 px-6 flex flex-col space-y-5">
              <Link 
                to="/" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-semibold text-gray-700 hover:text-gray-900 py-2 transition-colors"
              >
                Início
              </Link>
              <Link 
                to="/imoveis" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-semibold text-gray-700 hover:text-gray-900 py-2 transition-colors"
              >
                Imóveis
              </Link>
              <Link 
                to="/servicos" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-semibold text-gray-700 hover:text-gray-900 py-2 transition-colors"
              >
                Serviços
              </Link>
              <Link 
                to="/sobre" 
                onClick={() => setIsMobileMenuOpen(false)}
                className="text-base font-semibold text-gray-700 hover:text-gray-900 py-2 transition-colors"
              >
                Sobre
              </Link>
              <div className="pt-4 border-t border-gray-200">
                {whatsappLink ? (
                  <a
                    href={whatsappLink}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setIsMobileMenuOpen(false)}
                    className="w-full text-sm font-semibold text-white px-6 py-3.5 rounded-xl text-center flex items-center justify-center gap-2 shadow-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <MessageCircle size={20} />
                    Fale Conosco
                  </a>
                ) : (
                  <button
                    onClick={() => {
                      setIsContactModalOpen(true);
                      setIsMobileMenuOpen(false);
                    }}
                    className="w-full text-sm font-semibold text-white px-6 py-3.5 rounded-xl text-center shadow-lg"
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

      {/* Main Content */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer Estilo Estately */}
      <footer className="bg-gray-50 border-t border-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-8">
            
            {/* Coluna 1: Logo e Descrição */}
            <div className="md:col-span-1">
              <Link to="/" className="inline-block mb-6">
                {logoUrl ? (
                  <img
                    src={logoUrl}
                    alt={companyName}
                    className="h-8 w-auto object-contain"
                  />
                ) : (
                  <span className="text-2xl font-bold" style={{ color: primaryColor }}>
                    {companyName}
                  </span>
                )}
              </Link>
              <p className="text-sm text-gray-600 leading-relaxed mb-6">
                © {new Date().getFullYear()} {companyName}
              </p>
              
              {/* Redes Sociais Dinâmicas */}
              <div>
                <h4 className="font-bold text-slate-800 mb-4">Siga-nos</h4>
                <div className="flex gap-3">
                  {(!siteData?.social_instagram && !siteData?.social_facebook && !siteData?.social_linkedin && !siteData?.social_youtube) && (
                    <p className="text-sm text-slate-500">Redes sociais não configuradas.</p>
                  )}
                  {siteData?.social_instagram && (
                    <a 
                      href={siteData.social_instagram} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-pink-600 hover:text-white transition-colors"
                    >
                      <Instagram size={20} />
                    </a>
                  )}
                  {siteData?.social_facebook && (
                    <a 
                      href={siteData.social_facebook} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-blue-600 hover:text-white transition-colors"
                    >
                      <Facebook size={20} />
                    </a>
                  )}
                  {siteData?.social_youtube && (
                    <a 
                      href={siteData.social_youtube} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-red-600 hover:text-white transition-colors"
                    >
                      <Icons.Youtube size={20} />
                    </a>
                  )}
                  {siteData?.social_linkedin && (
                    <a 
                      href={siteData.social_linkedin} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-600 hover:bg-sky-600 hover:text-white transition-colors"
                    >
                      <Linkedin size={20} />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Coluna 2: Menu */}
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-4">Menu</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/sobre" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Sobre Nós
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Imóveis
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis?type=Casa" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Casas
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis?type=Apartamento" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Apartamentos
                  </Link>
                </li>
                <li>
                  <Link to="/imoveis?listing_type=rent" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Para Alugar
                  </Link>
                </li>
              </ul>
            </div>

            {/* Coluna 3: Serviços */}
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-4">Serviços</h4>
              <ul className="space-y-3">
                <li>
                  <Link to="/servicos" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Nossos Serviços
                  </Link>
                </li>
                <li>
                  <Link to="/avaliacao" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Avaliação de Imóveis
                  </Link>
                </li>
                <li>
                  <Link to="/financiamento" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Financiamento
                  </Link>
                </li>
                <li>
                  <Link to="/documentacao" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Documentação
                  </Link>
                </li>
              </ul>
            </div>

            {/* Coluna 4: Contato */}
            <div>
              <h4 className="text-sm font-bold text-gray-900 mb-4">Contato</h4>
              <ul className="space-y-3 mb-6">
                <li>
                  <Link to="/suporte" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Suporte
                  </Link>
                </li>
                <li>
                  <Link to="/contato" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Fale Conosco
                  </Link>
                </li>
              </ul>
              <div>
                <h4 className="text-sm font-bold text-gray-900 mb-4">Informações</h4>
                {contactPhone && (
                  <p className="text-sm text-gray-600 mb-2">
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

          {/* Bottom Footer */}
          <div className="pt-8 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center">
            <div className="flex items-center space-x-6 mb-4 md:mb-0">
              <h5 className="text-sm font-bold text-gray-900">Legal</h5>
              <Link to="/privacidade" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Política de Privacidade
              </Link>
              <Link to="/termos" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                Termos de Uso
              </Link>
            </div>
            <div className="flex items-center space-x-6">
              <Link to="/admin/login" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
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

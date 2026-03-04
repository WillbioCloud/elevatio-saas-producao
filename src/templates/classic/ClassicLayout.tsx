import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Icons } from '../../components/Icons';
import ContactModal from '../../components/ContactModal';
import { useTenant } from '../../contexts/TenantContext';

const ClassicLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isContactModalOpen, setIsContactModalOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const location = useLocation();
  const { tenant } = useTenant();

  // Força o site público a ser sempre Claro
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

  const isAdmin = location.pathname.startsWith('/admin');
  if (isAdmin) return <>{children}</>;

  const companyName = tenant?.name || 'Imobiliária';
  const companyPhone = tenant?.phone || '';
  const companyEmail = tenant?.email || '';
  const companyAddress = tenant?.address || '';
  const companyLogo = tenant?.logo_url || '/img/Logo-horizontal.png';
  const companyLogoScrolled = tenant?.logo_url || '/img/Logo.png';
  const companyLogoWhite = tenant?.logo_white_url || '/img/Logo-branca.png';

  return (
    <div className="min-h-screen flex flex-col font-sans text-gray-800 bg-gray-50">
      {/* Top Bar */}
      <div className="bg-slate-900 text-white py-2 text-xs md:text-sm">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            {companyPhone && (
              <Link 
                to={`https://wa.me/${companyPhone.replace(/\D/g, '')}?text=Gostaria%20de%20anunciar%20meu%20im%C3%B3vel,%20poderia%20me%20passar%20mais%20informa%C3%A7%C3%B5es?`}
                target="_blank" 
                className="flex items-center gap-1 hover:text-amber-400 transition-colors"
              >
                <Icons.House size={14} />
                Venda seu Imóvel Conosco
              </Link>
            )}
          </div>
          <div className="hidden md:flex gap-4">
            <Link to="/admin/login" className="hover:text-amber-400 transition-colors">Área do Corretor</Link>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur-md shadow-sm border-b border-gray-100">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          {/* Logo Dinâmica */}
          <Link to="/" className="flex items-center gap-2 group">
            <img
              src={isScrolled ? companyLogoScrolled : companyLogo}
              alt={companyName}
              className="h-10 w-auto object-contain transition-all duration-300"
            />
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-8 font-medium text-sm">
            <Link to="/" className="hover:text-amber-600 transition-colors">Home</Link>
            <Link to="/imoveis" className="hover:text-amber-600 transition-colors">Imóveis</Link>
            <Link to="/servicos" className="hover:text-amber-600 transition-colors">Serviços</Link>
            <Link to="/sobre" className="hover:text-amber-600 transition-colors">Sobre Nós</Link>
            <button
              type="button"
              onClick={() => setIsContactModalOpen(true)}
              className="rounded-full bg-slate-900 px-5 py-2.5 text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg"
            >
              Fale Conosco
            </button>
          </nav>

          {/* Mobile Menu Toggle */}
          <button 
            className="md:hidden text-slate-900"
            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          >
            {isMobileMenuOpen ? <Icons.X /> : <Icons.Menu />}
          </button>
        </div>

        {/* Mobile Nav */}
        {isMobileMenuOpen && (
          <div className="md:hidden bg-white border-t p-4 flex flex-col gap-4 shadow-xl absolute w-full">
            <Link to="/" onClick={() => setIsMobileMenuOpen(false)} className="py-2 border-b">Home</Link>
            <Link to="/imoveis" onClick={() => setIsMobileMenuOpen(false)} className="py-2 border-b">Imóveis</Link>
            <Link to="/servicos" onClick={() => setIsMobileMenuOpen(false)} className="py-2 border-b">Serviços</Link>
            <Link to="/admin/login" onClick={() => setIsMobileMenuOpen(false)} className="py-2 text-slate-500">Área do Corretor</Link>
            <button
              type="button"
              onClick={() => {
                setIsContactModalOpen(true);
                setIsMobileMenuOpen(false);
              }}
              className="rounded-lg bg-amber-500 py-3 text-center font-bold text-white"
            >
              Fale Conosco
            </button>
          </div>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-grow">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-gray-300 py-12">
        <div className="container mx-auto px-4 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <Link to="/" className="flex items-center gap-2 group">
              <img
                src={companyLogoWhite}
                alt={companyName}
                className="h-11 w-auto object-contain transition-all duration-300"
              />
            </Link>
            <p className="text-sm leading-relaxed mb-4 mt-5">
              Especialistas em imóveis de alto padrão. Encontramos o lar perfeito para sua história.
            </p>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Links Rápidos</h4>
            <ul className="space-y-2 text-sm">
              <li><Link to="/imoveis" className="hover:text-amber-400">Comprar Imóvel</Link></li>
              <li><Link to="/bairros/jardins" className="hover:text-amber-400">Imóveis nos Jardins</Link></li>
              {companyPhone && (
                <li>
                  <Link 
                    to={`https://wa.me/${companyPhone.replace(/\D/g, '')}?text=Gostaria%20de%20anunciar%20meu%20im%C3%B3vel,%20poderia%20me%20passar%20mais%20informa%C3%A7%C3%B5es?`}
                    target="_blank" 
                    className="flex items-center gap-1 hover:text-amber-400 transition-colors"
                  >
                    Venda seu Imóvel Conosco
                  </Link>
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Contato</h4>
            <ul className="space-y-2 text-sm">
              {companyAddress && (
                <li className="flex items-center gap-2">
                  <Icons.MapPin size={16}/>
                  {companyAddress}
                </li>
              )}
              {companyPhone && (
                <li className="flex items-center gap-2">
                  <Icons.Phone size={16}/>
                  {companyPhone}
                </li>
              )}
              {companyEmail && (
                <li className="flex items-center gap-2">
                  <Icons.Mail size={16}/>
                  {companyEmail}
                </li>
              )}
            </ul>
          </div>
          <div>
            <h4 className="text-white font-bold mb-4">Newsletter</h4>
            <div className="flex gap-2">
              <input 
                type="email" 
                placeholder="Seu e-mail" 
                className="bg-slate-800 border border-slate-700 text-white px-3 py-2 rounded-l-md w-full focus:outline-none focus:border-amber-500"
              />
              <button className="bg-amber-500 text-slate-900 px-4 py-2 rounded-r-md font-bold hover:bg-amber-400">OK</button>
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

export default ClassicLayout;

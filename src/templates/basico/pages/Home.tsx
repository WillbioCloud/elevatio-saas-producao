import React from 'react';
import { Search, MapPin, Home as HomeIcon, DollarSign, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { About } from '../components/About';
import { Metrics } from '../components/Metrics';
import { FeaturedProperties } from '../components/FeaturedProperties';
import { Services } from '../components/Services';
import { Testimonials } from '../components/Testimonials';
import { FAQ } from '../components/FAQ';
import { Contact } from '../components/Contact';
import PartnersCarousel from '../../../components/PartnersCarousel';

export default function BasicoHome() {
  const { tenant } = useTenant();
  const siteData = typeof tenant?.site_data === 'string' 
    ? JSON.parse(tenant.site_data) 
    : tenant?.site_data || {};
  const navigate = useNavigate();

  const primaryColor = siteData?.primary_color || '#b08d5e';
  const heroTitle = siteData?.hero_title || 'Encontre a Residência dos Seus Sonhos';
  const heroSubtitle = siteData?.hero_subtitle || 'Experiência exclusiva em imóveis. Encontramos a propriedade perfeita que combina sofisticação, conforto e um estilo de vida incomparável.';
  const heroBg = siteData?.hero_image_url || 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?q=80&w=2071&auto=format&fit=crop';

  return (
    <>
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background */}
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat scale-105"
        style={{ backgroundImage: `url('${heroBg}')`, animation: 'bsc-float 25s ease-in-out infinite' }}
      />
      <div className="absolute inset-0 bg-black/55" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-[#0e0e0e]" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/30 via-transparent to-black/30" />

      <style>{`
        @keyframes bsc-float {
          0%, 100% { transform: scale(1.05) translateY(0); }
          50% { transform: scale(1.08) translateY(-10px); }
        }
        @keyframes bsc-fade-up {
          from { opacity: 0; transform: translateY(24px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .bsc-fade-up { animation: bsc-fade-up 0.8s ease forwards; }
        .bsc-fade-up-delay { animation: bsc-fade-up 0.8s 0.4s ease forwards; opacity: 0; }
      `}</style>

      {/* Decorative lines */}
      <div className="absolute top-32 left-8 w-px h-24 bg-gradient-to-b from-transparent via-white/20 to-transparent hidden lg:block" />
      <div className="absolute top-32 right-8 w-px h-24 bg-gradient-to-b from-transparent via-white/20 to-transparent hidden lg:block" />

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6 text-center pt-20">
        <div className="bsc-fade-up">
          <div className="flex items-center justify-center gap-4 mb-8">
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
            <p className="tracking-[0.5em] uppercase text-xs font-medium" style={{ color: primaryColor }}>
              {tenant?.name || 'Imobiliária de Alto Padrão'}
            </p>
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
          </div>

          <h1 className="font-serif text-4xl sm:text-5xl md:text-6xl lg:text-7xl xl:text-8xl text-white font-bold leading-[1.1] mb-7">
            {heroTitle.includes(' ') ? (
              <>
                {heroTitle.split(' ').slice(0, Math.ceil(heroTitle.split(' ').length / 2)).join(' ')}
                <br />
                <span
                  className="italic font-medium"
                  style={{
                    background: `linear-gradient(135deg, ${primaryColor}dd, ${primaryColor}, ${primaryColor}99)`,
                    WebkitBackgroundClip: 'text',
                    WebkitTextFillColor: 'transparent',
                  }}
                >
                  {heroTitle.split(' ').slice(Math.ceil(heroTitle.split(' ').length / 2)).join(' ')}
                </span>
              </>
            ) : heroTitle}
          </h1>

          <p className="text-white/65 text-base sm:text-lg max-w-2xl mx-auto mb-12 leading-relaxed font-light">
            {heroSubtitle}
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center mb-16">
            <button
              onClick={() => navigate('/imoveis')}
              className="px-10 py-4 text-[13px] tracking-[0.2em] uppercase font-bold transition-all duration-500 inline-flex items-center justify-center gap-2"
              style={{ backgroundColor: primaryColor, color: '#0e0e0e' }}
            >
              Explorar Imóveis
            </button>
            <a
              href="#contato"
              className="border border-white/30 text-white px-10 py-4 text-[13px] tracking-[0.2em] uppercase font-medium hover:bg-white/10 hover:border-white/60 transition-all duration-500 inline-flex items-center justify-center gap-2 backdrop-blur-sm"
            >
              Fale Conosco
            </a>
          </div>
        </div>

        {/* Search Bar */}
        <div className="bsc-fade-up-delay">
          <div className="bg-[#0e0e0e]/80 backdrop-blur-xl border border-white/10 p-5 sm:p-7 max-w-4xl mx-auto rounded-lg shadow-2xl shadow-black/40">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-5">
              <div className="relative">
                <MapPin className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: primaryColor }} />
                <input
                  type="text"
                  placeholder="Localização"
                  className="w-full bg-white/5 border border-white/10 text-white pl-11 pr-4 py-3.5 text-sm rounded-md transition-all duration-300 placeholder:text-white/35 outline-none focus:border-white/30"
                />
              </div>
              <div className="relative">
                <HomeIcon className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: primaryColor }} />
                <select className="w-full bg-white/5 border border-white/10 text-white/60 pl-11 py-3.5 text-sm appearance-none rounded-md transition-all duration-300 cursor-pointer outline-none">
                  <option value="">Tipo de Imóvel</option>
                  <option value="casa">Casa</option>
                  <option value="apartamento">Apartamento</option>
                  <option value="cobertura">Cobertura</option>
                  <option value="terreno">Terreno</option>
                </select>
              </div>
              <div className="relative">
                <DollarSign className="absolute left-4 top-1/2 -translate-y-1/2" size={18} style={{ color: primaryColor }} />
                <select className="w-full bg-white/5 border border-white/10 text-white/60 pl-11 py-3.5 text-sm appearance-none rounded-md transition-all duration-300 cursor-pointer outline-none">
                  <option value="">Faixa de Preço</option>
                  <option value="1">Até R$ 500 mil</option>
                  <option value="2">R$ 500k - R$ 1M</option>
                  <option value="3">R$ 1M - R$ 3M</option>
                  <option value="4">Acima de R$ 3M</option>
                </select>
              </div>
            </div>
            <button
              onClick={() => navigate('/imoveis')}
              className="w-full sm:w-auto px-12 py-3.5 text-[13px] tracking-[0.15em] uppercase font-bold flex items-center justify-center gap-2.5 mx-auto rounded-md transition-all duration-500 hover:opacity-90"
              style={{ backgroundColor: primaryColor, color: '#0e0e0e' }}
            >
              <Search size={16} />
              Buscar Imóveis
            </button>
          </div>
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2" style={{ animation: 'bsc-float 2.5s ease-in-out infinite' }}>
        <span className="text-white/40 text-[10px] tracking-[0.3em] uppercase">Scroll</span>
        <ChevronDown className="text-white/40" size={20} />
      </div>
    </section>
    <About />
    <Metrics />
    <FeaturedProperties />
    <Services />
    <Testimonials />
    <FAQ />
    <Contact />
    {/* Carrossel de Parcerias */}
    {siteData.show_partnerships !== false && siteData.partners && siteData.partners.length > 0 && (
      <PartnersCarousel partners={siteData.partners} />
    )}
  </>
  );
}

import React, { useEffect, useState } from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import PartnersCarousel from '../../../components/PartnersCarousel';
import { Search, MapPin, Bed, Bath, Square, ArrowRight, Home as HomeIcon } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { Building2 } from 'lucide-react';

export default function MinimalistHome() {
  const { tenant } = useTenant();
  const siteData = typeof tenant?.site_data === 'string' 
    ? JSON.parse(tenant.site_data) 
    : tenant?.site_data || {};
  const primaryColor = siteData.primaryColor || '#0EA5E9';
  const [featuredProperties, setFeaturedProperties] = useState<any[]>([]);

  // Busca os últimos 3 imóveis da imobiliária para colocar na vitrine
  useEffect(() => {
    if (!tenant?.id) return;

    const fetchProperties = async () => {
      const { data } = await supabase
        .from('properties')
        .select('*')
        .eq('company_id', tenant.id)
        .eq('status', 'available')
        .limit(3);

      if (data) setFeaturedProperties(data);
    };

    fetchProperties();
  }, [tenant]);

  return (
    <div className="animate-fade-in">
      {/* Hero Section com Barra de Pesquisa */}
      <section className="relative pt-32 pb-40 px-6 flex items-center justify-center min-h-[80vh] overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            src="https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80" 
            alt="Hero Background" 
            className="w-full h-full object-cover"
          />
          <div className="absolute inset-0 bg-slate-900/70 backdrop-blur-[2px]"></div>
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto text-center">
          <h1 className="text-5xl md:text-7xl font-black text-white tracking-tight mb-6 drop-shadow-lg leading-tight">
            {siteData.heroTitle || 'O imóvel dos seus sonhos está aqui'}
          </h1>
          <p className="text-xl md:text-2xl text-slate-200 mb-12 max-w-3xl mx-auto font-medium drop-shadow">
            {siteData.heroSubtitle || 'Encontre casas e apartamentos perfeitos para a sua família com as melhores condições do mercado.'}
          </p>

          {/* Barra de Pesquisa Flutuante */}
          <div className="bg-white p-3 rounded-2xl md:rounded-full shadow-2xl flex flex-col md:flex-row items-center gap-3 max-w-4xl mx-auto animate-slide-up">
            <div className="flex-1 w-full flex items-center gap-3 px-4 py-3 md:py-0 border-b md:border-b-0 md:border-r border-slate-100">
              <Search className="text-slate-400 shrink-0" />
              <input 
                type="text" 
                placeholder="Bairro, cidade ou código..." 
                className="w-full bg-transparent outline-none text-slate-700 font-medium placeholder:font-normal" 
              />
            </div>
            <div className="flex-1 w-full flex items-center gap-3 px-4 py-3 md:py-0">
              <HomeIcon className="text-slate-400 shrink-0" />
              <select className="w-full bg-transparent outline-none text-slate-700 font-medium cursor-pointer">
                <option value="">Tipo de Imóvel</option>
                <option value="casa">Casa</option>
                <option value="apartamento">Apartamento</option>
                <option value="terreno">Terreno</option>
              </select>
            </div>
            <button 
              className="w-full md:w-auto px-8 py-4 rounded-xl md:rounded-full text-white font-bold flex items-center justify-center gap-2 transition-transform hover:scale-105 shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              Buscar Imóveis
            </button>
          </div>
        </div>
      </section>

      {/* Destaques Section */}
      <section className="py-24 px-6 max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-6">
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tight">
              Imóveis em Destaque
            </h2>
            <p className="text-slate-500 mt-2 font-medium">
              As melhores oportunidades selecionadas para você.
            </p>
          </div>
          <Link 
            to="/imoveis" 
            className="font-bold flex items-center gap-2 hover:opacity-80 transition-opacity" 
            style={{ color: primaryColor }}
          >
            Ver todos os imóveis <ArrowRight size={20} />
          </Link>
        </div>

        {featuredProperties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {featuredProperties.map((prop) => (
              <div 
                key={prop.id} 
                className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm hover:shadow-xl transition-all group cursor-pointer flex flex-col"
              >
                <div className="relative h-64 overflow-hidden">
                  <img 
                    src={prop.images?.[0] || "https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80"} 
                    alt={prop.title} 
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" 
                  />
                  <div className="absolute top-4 left-4 bg-white/90 backdrop-blur px-3 py-1 rounded-full text-xs font-bold text-slate-900 uppercase tracking-wider">
                    {prop.transaction_type === 'sale' ? 'Venda' : 'Aluguel'}
                  </div>
                </div>

                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex items-center gap-2 text-slate-500 text-sm font-medium mb-3">
                    <MapPin size={16} style={{ color: primaryColor }} />
                    <span className="truncate">{prop.city}, {prop.state}</span>
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 mb-2 line-clamp-2">
                    {prop.title}
                  </h3>

                  <div className="mt-auto pt-6 border-t border-slate-100 flex items-center justify-between">
                    <div className="flex items-center gap-4 text-slate-600 text-sm font-medium">
                      <span className="flex items-center gap-1.5" title="Quartos">
                        <Bed size={18} /> {prop.bedrooms || 0}
                      </span>
                      <span className="flex items-center gap-1.5" title="Banheiros">
                        <Bath size={18} /> {prop.bathrooms || 0}
                      </span>
                      <span className="flex items-center gap-1.5" title="Área">
                        <Square size={18} /> {prop.area || 0}m²
                      </span>
                    </div>
                    <span className="font-black text-xl" style={{ color: primaryColor }}>
                      R$ {Number(prop.price).toLocaleString('pt-BR')}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-slate-50 rounded-3xl border border-slate-100 border-dashed">
            <Building2 size={48} className="mx-auto text-slate-300 mb-4" />
            <h3 className="text-xl font-bold text-slate-700">Nenhum imóvel em destaque ainda.</h3>
            <p className="text-slate-500 mt-2">Os imóveis que você cadastrar aparecerão aqui magicamente.</p>
          </div>
        )}
      </section>

      {/* Quem Somos Section */}
      <section className="py-24 px-6 bg-white">
        <div className="max-w-7xl mx-auto flex flex-col lg:flex-row items-center gap-16">
          <div className="flex-1 relative">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-200 to-slate-50 rounded-[3rem] transform -rotate-3 scale-105 -z-10"></div>
            <img 
              src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?ixlib=rb-4.0.3&auto=format&fit=crop&w=1000&q=80" 
              alt="Sobre Nós" 
              className="rounded-[3rem] shadow-2xl object-cover h-[500px] w-full"
            />
            <div className="absolute -bottom-8 -right-8 bg-white p-8 rounded-3xl shadow-xl text-center hidden md:block">
              <span className="block text-5xl font-black mb-1" style={{ color: primaryColor }}>+10</span>
              <span className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                Anos de<br/>Experiência
              </span>
            </div>
          </div>

          <div className="flex-1">
            <h2 className="text-4xl font-black text-slate-900 tracking-tight mb-6">
              A sua história começa com a chave certa.
            </h2>
            <p className="text-lg text-slate-600 leading-relaxed mb-8">
              {siteData.aboutText || 'Somos mais do que uma imobiliária. Somos especialistas em realizar sonhos e garantir os melhores negócios. Com anos de experiência no mercado, oferecemos um atendimento transparente, ágil e focado no que você realmente precisa.'}
            </p>
            <div className="flex gap-4">
              <Link 
                to="/sobre" 
                className="px-8 py-4 rounded-full font-bold text-white transition-transform hover:scale-105 shadow-md" 
                style={{ backgroundColor: primaryColor }}
              >
                Conheça Nossa História
              </Link>
            </div>
          </div>
        </div>
      </section>
      {/* Carrossel de Parcerias */}
      {siteData.show_partnerships !== false && siteData.partners && siteData.partners.length > 0 && (
        <PartnersCarousel partners={siteData.partners} />
      )}
    </div>
  );
}

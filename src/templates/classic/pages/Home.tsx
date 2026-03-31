import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import { Property } from '../../../types';
import PartnersCarousel from '../../../components/PartnersCarousel';
import PropertyCard from '../components/PropertyCard';
import { Search, MapPin, Building, Home as HomeIcon, Briefcase, Map, Waves, TreePine, Key, TrendingUp, Loader2, ChevronDown } from 'lucide-react';

const Home: React.FC = () => {
  const { tenant } = useTenant();
  const siteData = typeof tenant?.site_data === 'string' 
    ? JSON.parse(tenant.site_data) 
    : tenant?.site_data || {};
  const navigate = useNavigate();
  const [searchLocation, setSearchLocation] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [isTypeDropdownOpen, setIsTypeDropdownOpen] = useState(false);
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);
  const heroTitle = siteData?.hero_title || 'Encontre o imóvel dos seus sonhos';
  const heroSubtitle = siteData?.hero_subtitle || 'A sua jornada para um novo lar começa aqui.';
  const primaryColor = siteData?.primary_color || '#1e293b';

  useEffect(() => {
    let isMounted = true;

    const fetchFeaturedProperties = async () => {
      if (!tenant?.id) return;

      setIsLoadingProperties(true);

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*, profiles(*)')
          .eq('company_id', tenant.id)
          .neq('status', 'Vendido')
          .neq('status', 'Alugado')
          .limit(6);

        if (error) throw error;

        if (isMounted && data) {
          const formattedData = data.map(item => ({
            ...item,
            agent: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
            images: typeof item.images === 'string' ? JSON.parse(item.images || '[]') : (item.images || []),
            features: typeof item.features === 'string' ? JSON.parse(item.features || '[]') : (item.features || [])
          })) as Property[];

          setFeaturedProperties(formattedData);
        }
      } catch (error) {
        console.error('Erro ao buscar destaques:', error);
      } finally {
        if (isMounted) setIsLoadingProperties(false);
      }
    };

    fetchFeaturedProperties();

    return () => {
      isMounted = false;
    };
  }, [tenant?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchLocation) params.set('city', searchLocation);
    if (propertyType) params.set('type', propertyType);
    navigate(`/imoveis?${params.toString()}`);
  };

  const lifestyles = [
    { id: 'praia', title: 'Frente para o Mar', icon: Waves, image: 'https://images.unsplash.com/photo-1499793983690-e29da59ef1c2?auto=format&fit=crop&q=80&w=800' },
    { id: 'condominio', title: 'Condomínio Fechado', icon: TreePine, image: 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80&w=800' },
    { id: 'cobertura', title: 'Coberturas', icon: Key, image: 'https://images.unsplash.com/photo-1512918728675-ed5a9ecdebfd?auto=format&fit=crop&q=80&w=800' },
    { id: 'investimento', title: 'Para Investimento', icon: TrendingUp, image: 'https://images.unsplash.com/photo-1554469384-e58fac16e23a?auto=format&fit=crop&q=80&w=800' },
  ];

  const propertyTypes = [
    { id: 'Casa', title: 'Casas', icon: HomeIcon },
    { id: 'Apartamento', title: 'Apartamentos', icon: Building },
    { id: 'Lote/Terreno', title: 'Lotes e Terrenos', icon: Map },
    { id: 'Comercial', title: 'Comercial', icon: Briefcase },
  ];

  return (
    <div className="min-h-screen bg-slate-50 pb-12 font-sans">
      
      {/* 1. HERO SECTION */}
      <section className="relative h-screen flex items-center justify-center">
        <div 
          className="absolute inset-0 z-0 bg-cover bg-center bg-no-repeat"
          style={{ 
            backgroundImage: `url('${siteData?.hero_image_url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?ixlib=rb-4.0.3&auto=format&fit=crop&w=2000&q=80'}')` 
          }}
        >
          <div className="absolute inset-0 bg-slate-900/40"></div>
        </div>

        <div className="relative z-10 w-full max-w-5xl mx-auto px-4 text-center mt-16 md:mt-0">
          <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white mb-6 drop-shadow-lg leading-tight">
            {siteData?.hero_title || 'Encontre o imóvel perfeito para você'}
          </h1>
          <p className="text-lg md:text-2xl text-white/90 mb-10 max-w-3xl mx-auto drop-shadow-md">
            {siteData?.hero_subtitle || 'A sua jornada para a casa dos sonhos começa aqui. Descubra as melhores opções na sua região.'}
          </p>

          <form onSubmit={handleSearch} className="bg-white p-4 md:p-4 rounded-2xl md:rounded-full shadow-2xl flex flex-col md:flex-row items-stretch md:items-center gap-4 md:gap-3 max-w-4xl mx-auto animate-fade-in-up">
            <div className="flex-1 flex items-center px-4 py-3 md:py-0 w-full border-b md:border-b-0 md:border-r border-slate-200">
              <MapPin className="text-slate-400 mr-3 shrink-0" size={20} />
              <input
                type="text"
                placeholder="Cidade ou bairro..."
                className="w-full bg-transparent border-none focus:outline-none text-slate-700 placeholder:text-slate-400"
                value={searchLocation}
                onChange={(e) => setSearchLocation(e.target.value)}
              />
            </div>

            <div className="flex-1 flex items-center px-4 w-full md:w-auto pb-3 md:pb-0 relative">
              <Building className="text-slate-400 mr-3 shrink-0" size={20} />
              
              {/* Dropdown Customizado */}
              <div className="relative w-full">
                <button
                  type="button"
                  onClick={() => setIsTypeDropdownOpen(!isTypeDropdownOpen)}
                  className="w-full bg-transparent border-none focus:outline-none text-slate-700 cursor-pointer flex justify-between items-center text-left"
                >
                  <span className="truncate font-medium">
                    {propertyType ? propertyTypes.find(t => t.id === propertyType)?.title || propertyType : 'Qualquer tipo'}
                  </span>
                  <ChevronDown 
                    className={`text-slate-400 transition-transform duration-300 ${isTypeDropdownOpen ? 'rotate-180' : ''}`} 
                    size={16} 
                  />
                </button>

                {isTypeDropdownOpen && (
                  <>
                    {/* Overlay invisível para fechar ao clicar fora */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setIsTypeDropdownOpen(false)}
                    ></div>

                    {/* Menu Dropdown */}
                    <div className="absolute top-full right-0 mt-6 w-[340px] bg-white rounded-3xl shadow-xl border border-slate-100 py-2 z-50 overflow-hidden animate-fade-in-up">
                      <div 
                        className="px-5 py-3 hover:bg-slate-300 cursor-pointer text-slate-700 transition-colors font-medium text-sm flex itens-center gap-4"
                        onClick={() => {
                          setPropertyType('');
                          setIsTypeDropdownOpen(false);
                        }}
                      >
                        Qualquer tipo
                      </div>
                      {propertyTypes.map(type => (
                        <div 
                          key={type.id}
                          className="px-5 py-3 hover:bg-slate-300 cursor-pointer text-slate-700 transition-colors font-medium text-sm flex items-center gap-3"
                          onClick={() => {
                            setPropertyType(type.id);
                            setIsTypeDropdownOpen(false);
                          }}
                        >
                          <type.icon size={16} className="text-slate-400" />
                          {type.title}
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            </div>

            <button
              type="submit"
              className="w-full md:w-auto text-white px-8 py-3.5 rounded-xl md:rounded-full font-bold flex items-center justify-center gap-2 transition-all hover:opacity-90 hover:scale-105 shadow-md shrink-0"
              style={{ backgroundColor: primaryColor }}
            >
              <Search size={20} />
              Buscar
            </button>
          </form>
        </div>
      </section>

      {/* 2. EXPLORE POR ESTILO DE VIDA */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-2">Explore por Estilo de Vida</h2>
        <p className="text-slate-500 mb-10">Encontre o imóvel que combina perfeitamente com você.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {lifestyles.map((style) => (
            <div
              key={style.id}
              onClick={() => navigate(`/imoveis?lifestyle=${style.id}`)}
              className="group relative h-72 rounded-3xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all"
            >
              <img
                src={style.image}
                alt={style.title}
                className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-900/80 via-slate-900/20 to-transparent"></div>
              <div className="absolute bottom-6 left-6 text-white">
                <style.icon size={28} className="mb-3 opacity-80" />
                <h3 className="text-xl font-bold">{style.title}</h3>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. IMÓVEIS EM DESTAQUE */}
      <section className="py-12 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-end mb-10">
            <div>
              <h2 className="text-3xl font-bold text-slate-900 mb-2">Imóveis em Destaque</h2>
              <p className="text-slate-500">As melhores oportunidades selecionadas para você.</p>
            </div>
            <button
              onClick={() => navigate('/imoveis')}
              className="hidden md:block font-bold hover:underline"
              style={{ color: primaryColor }}
            >
              Ver todos &rarr;
            </button>
          </div>

          {isLoadingProperties ? (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="animate-spin text-slate-400" size={40} />
            </div>
          ) : featuredProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.map(property => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-slate-50 rounded-3xl border border-dashed border-slate-300">
              <p className="text-slate-500">Nenhum imóvel em destaque no momento.</p>
            </div>
          )}

          <div className="mt-8 text-center md:hidden">
            <button
              onClick={() => navigate('/imoveis')}
              className="font-bold border px-6 py-3 rounded-full"
              style={{ color: primaryColor, borderColor: primaryColor }}
            >
              Ver todos os imóveis
            </button>
          </div>
        </div>
      </section>

      {/* 4. O QUE VOCÊ PROCURA? */}
      <section className="py-20 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h2 className="text-3xl font-bold text-slate-900 mb-10 text-center">O que você procura?</h2>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {propertyTypes.map((type) => (
            <div
              key={type.id}
              onClick={() => {
                const params = new URLSearchParams();
                params.set('type', type.id);
                navigate(`/imoveis?${params.toString()}`);
              }}
              className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer flex flex-col items-center text-center group"
            >
              <div
                className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4 group-hover:bg-brand-50 transition-colors"
                style={{ color: primaryColor }}
              >
                <type.icon size={28} className="sm:w-8 sm:h-8" />
              </div>
              <h3 className="font-bold text-slate-800 text-sm sm:text-base">{type.title}</h3>
            </div>
          ))}
        </div>
      </section>

      {/* Carrossel de Parcerias */}
      {siteData.show_partnerships !== false && siteData.partners && siteData.partners.length > 0 && (
        <PartnersCarousel partners={siteData.partners} />
      )}
    </div>
  );
};

export default Home;

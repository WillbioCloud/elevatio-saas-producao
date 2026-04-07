import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { Icons } from '../../../components/Icons';
import Loading from '../../../components/Loading';
import PartnersCarousel from '../../../components/PartnersCarousel';
import { supabase } from '../../../lib/supabase';
import { ListingType, Property, type SiteData } from '../../../types';
import PropertyCard from '../components/PropertyCard';
import {
  getHeroSubtitle,
  getHeroTitle,
  getPrimaryColor,
  getTenantLogo,
} from '../tenantUtils';

type CondominiumRecord = NonNullable<SiteData['condominiums']>[number];

const parseSiteData = (raw: unknown): SiteData => {
  if (!raw) return {};

  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === 'object' ? (parsed as SiteData) : {};
    } catch {
      return {};
    }
  }

  return typeof raw === 'object' ? (raw as SiteData) : {};
};

const Home: React.FC = () => {
  const { tenant } = useTenant();
  const siteData = useMemo(() => parseSiteData(tenant?.site_data), [tenant?.site_data]);
  const navigate = useNavigate();
  const [listingMode, setListingMode] = useState<ListingType>('sale');
  const [selectedCity, setSelectedCity] = useState('');
  const [selectedNeighborhood, setSelectedNeighborhood] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [properties, setProperties] = useState<Property[]>([]);
  const [activeCondos, setActiveCondos] = useState<CondominiumRecord[]>([]);
  const [loading, setLoading] = useState(true);

  const logoUrl = getTenantLogo(tenant);
  const primaryColor = getPrimaryColor(tenant);
  const heroTitle = getHeroTitle(tenant);
  const heroSubtitle = getHeroSubtitle(tenant);

  useEffect(() => {
    let isMounted = true;

    const fetchProperties = async () => {
      if (!tenant?.id) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*, profiles(name, phone, email)')
          .eq('company_id', tenant.id)
          .neq('status', 'Vendido')
          .neq('status', 'Alugado')
          .eq('has_intermediation_signed', true)
          .order('featured', { ascending: false })
          .order('created_at', { ascending: false });

        if (error) throw error;

        if (isMounted && data) {
          const mapped = data.map((item: any) => ({
            ...item,
            location: {
              city: item.city || '',
              neighborhood: item.neighborhood || '',
              state: item.state || '',
              address: item.address || '',
            },
            agent: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
            features: Array.isArray(item.features) ? item.features : [],
            images: Array.isArray(item.images) ? item.images : [],
          })) as Property[];

          setProperties(mapped);
        }
      } catch (error) {
        console.error('Erro ao buscar imóveis do tenant:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchProperties();

    return () => {
      isMounted = false;
    };
  }, [tenant?.id]);

  useEffect(() => {
    let isMounted = true;

    const fetchActiveCondos = async () => {
      if (!tenant?.id) {
        if (isMounted) setActiveCondos([]);
        return;
      }

      const registeredCondos = siteData.condominiums || [];
      if (!registeredCondos.length) {
        if (isMounted) setActiveCondos([]);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('condominium_id')
          .eq('company_id', tenant.id)
          .neq('status', 'Vendido')
          .neq('status', 'Alugado')
          .not('condominium_id', 'is', null);

        if (error) throw error;

        const activeIds = new Set(
          (data || [])
            .map((item: { condominium_id?: string | null }) => item.condominium_id)
            .filter((value): value is string => Boolean(value))
        );

        if (isMounted) {
          setActiveCondos(registeredCondos.filter((condo) => activeIds.has(condo.id)));
        }
      } catch (error) {
        console.error('Erro ao buscar condominios ativos:', error);
        if (isMounted) setActiveCondos([]);
      }
    };

    void fetchActiveCondos();

    return () => {
      isMounted = false;
    };
  }, [siteData.condominiums, tenant?.id]);

  const cities = useMemo(
    () => Array.from(new Set(properties.map((property) => property.location.city).filter(Boolean))).sort(),
    [properties]
  );

  const neighborhoods = useMemo(
    () =>
      Array.from(
        new Set(
          properties
            .filter((property) => !selectedCity || property.location.city === selectedCity)
            .map((property) => property.location.neighborhood)
            .filter(Boolean)
        )
      ).sort(),
    [properties, selectedCity]
  );

  const propertyTypes = useMemo(
    () => Array.from(new Set(properties.map((property) => property.type).filter(Boolean))).sort(),
    [properties]
  );

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();

    const params = new URLSearchParams();
    if (selectedCity) params.set('city', selectedCity);
    if (selectedNeighborhood) params.set('neighborhood', selectedNeighborhood);
    if (selectedType) params.set('type', selectedType);
    params.set('listingType', listingMode);

    const query = params.toString();
    navigate(query ? `/imoveis?${query}` : '/imoveis');
  };

  const featuredProperties = properties.filter((property) => property.featured).slice(0, 3);

  return (
    <div className="animate-fade-in bg-slate-50 dark:bg-dark-bg min-h-screen font-sans overflow-x-hidden">
      {/* Hero Section Premium */}
      <section className="relative min-h-[600px] md:min-h-[650px] h-[85vh] max-h-[900px] w-full p-4 md:p-6 pb-0">
        <div className="relative w-full h-full rounded-[2.5rem] overflow-hidden shadow-2xl">
            {/* Mídia de Fundo (Vídeo ou Imagem Dinâmica) */}
            <div className="absolute inset-0 bg-slate-900">
              {siteData?.hero_video_url ? (
                <video
                  key={siteData.hero_video_url}
                  src={siteData.hero_video_url}
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-90"
                />
              ) : (
                <img
                  src={siteData?.hero_image_url || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1920&q=80'}
                  alt="Fundo da página inicial"
                  className="w-full h-full object-cover opacity-90"
                />
              )}
              {/* Overlay escuro para garantir a leitura dos textos brancos */}
              <div className="absolute inset-0 bg-black/40"></div>
            </div>

            {/* Conteúdo Central */}
            <div className="relative z-10 h-full flex flex-col items-center justify-center text-center px-4">
              {/* Usa a Logo Símbolo (logo_alt_url) ou fallback para a logo normal */}
              {(siteData?.logo_alt_url || logoUrl) && (
                <img
                  src={siteData?.logo_alt_url || logoUrl}
                  alt="Símbolo da Imobiliária"
                  className="h-20 md:h-24 w-auto mb-6 drop-shadow-2xl animate-fade-in object-contain"
                />
              )}
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold tracking-tight text-white mb-3 md:mb-4 lg:mb-6 drop-shadow-lg leading-tight">
                {heroTitle}
            </h1>
            <p className="text-sm sm:text-base md:text-lg lg:text-xl text-white/90 mb-6 lg:mb-12 max-w-2xl font-light">
                {heroSubtitle}
            </p>

            <div className="w-full max-w-4xl flex justify-center md:justify-start mb-4">
              <div className="bg-white/95 rounded-full p-1 shadow-xl inline-flex gap-1">
                {[
                  { value: 'sale', label: 'Comprar' },
                  { value: 'rent', label: 'Alugar' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setListingMode(option.value as ListingType)}
                    className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all ${
                      listingMode === option.value
                        ? 'text-white shadow'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                    style={listingMode === option.value ? { backgroundColor: primaryColor } : undefined}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Barra de Busca Estilo "Cápsula" */}
            <form onSubmit={handleSearch} className="w-full max-w-4xl bg-white p-2 rounded-[2rem] md:rounded-full shadow-xl flex flex-col md:flex-row items-stretch md:items-center animate-slide-up">
                <div className="flex-1 grid grid-cols-1 md:grid-cols-3 md:divide-x md:divide-slate-100">
                  <div className="w-full px-4 md:px-6 py-3">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cidade</label>
                    <select
                      value={selectedCity}
                      onChange={(e) => {
                        setSelectedCity(e.target.value);
                        setSelectedNeighborhood('');
                      }}
                      className="w-full bg-transparent outline-none text-slate-800 font-medium text-sm md:text-base"
                    >
                      <option value="">Todas as cidades</option>
                      {cities.map((city) => (
                        <option key={city} value={city}>{city}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full px-4 md:px-6 py-3 border-t md:border-t-0 border-slate-100">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Bairro</label>
                    <select
                      value={selectedNeighborhood}
                      onChange={(e) => setSelectedNeighborhood(e.target.value)}
                      className="w-full bg-transparent outline-none text-slate-800 font-medium text-sm md:text-base"
                    >
                      <option value="">Todos os bairros</option>
                      {neighborhoods.map((neighborhood) => (
                        <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                      ))}
                    </select>
                  </div>

                  <div className="w-full px-4 md:px-6 py-3 border-t md:border-t-0 border-slate-100">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipo de imóvel</label>
                    <select
                      value={selectedType}
                      onChange={(e) => setSelectedType(e.target.value)}
                      className="w-full bg-transparent outline-none text-slate-800 font-medium text-sm md:text-base"
                    >
                      <option value="">Todos os tipos</option>
                      {propertyTypes.map((type) => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                {/* Botão de Busca Preto (Pill Shape) */}
            <button
                className="text-white px-8 py-4 rounded-full font-medium transition-all shadow-lg flex items-center gap-2 w-full md:w-auto justify-center mt-2 md:mt-0 md:ml-2"
                style={{ backgroundColor: primaryColor }}
            >
                    <Icons.Search size={20} />
                    Buscar
                </button>
            </form>
            </div>
        </div>
      </section>

      {/* Condomínios e Regiões em Destaque (Dinâmico) */}
      {activeCondos.length > 0 && (
        <section className="py-20 bg-slate-50">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Condomínios em Destaque</h2>
              <p className="text-slate-600 max-w-2xl mx-auto">
                Explore os melhores endereços e encontre o lugar perfeito para o seu próximo capítulo.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {activeCondos.map((condo) => (
                <div
                  key={condo.id}
                  onClick={() => navigate(`/imoveis?q=${encodeURIComponent(condo.name)}`)}
                  className="group relative h-80 rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-xl transition-all duration-300"
                >
                  <img
                    src={condo.image_url || 'https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&q=80'}
                    alt={condo.name}
                    className="absolute inset-0 w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-slate-900/20 to-transparent"></div>
                  <div className="absolute bottom-0 left-0 right-0 p-8">
                    <h3 className="text-2xl font-bold text-white mb-2 transform translate-y-2 group-hover:translate-y-0 transition-transform">{condo.name}</h3>
                    <div className="flex items-center text-brand-400 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0 delay-75">
                      <span className="text-sm font-semibold uppercase tracking-wider">Ver imóveis</span>
                      <Icons.ArrowRight size={16} className="ml-2" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Grid Visual de Estilo de Vida */}
      <section className="py-20 bg-white dark:bg-dark-bg">
        <div className="container mx-auto px-6">
          <div className="mb-12">
            <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white mb-4">Explore por Estilo de Vida</h2>
            <p className="text-slate-500 text-lg">Encontre o imóvel que combina com sua rotina.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6 h-[600px]">
             <div onClick={() => navigate('/imoveis?type=Casa')} className="md:col-span-2 md:row-span-2 relative rounded-[2.5rem] overflow-hidden cursor-pointer group">
               <img src="https://images.unsplash.com/photo-1613977257363-707ba9348227?auto=format&fit=crop&w=800&q=80" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Casas" />
               <div className="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-black/60 to-transparent">
                  <h3 className="text-white text-3xl font-semibold">Casas</h3>
                  <p className="text-white/80 mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0">Design e arquitetura contemporânea</p>
               </div>
             </div>
             
             <div onClick={() => navigate('/imoveis?type=Apartamento')} className="relative rounded-[2.5rem] overflow-hidden cursor-pointer group">
               <img src="https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?auto=format&fit=crop&w=600&q=80" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Apartamentos" />
               <div className="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-black/60 to-transparent">
                  <h3 className="text-white text-3xl font-semibold">Apartamentos</h3>
                  <p className="text-white/80 mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0">Comididade, conforto e para aqueles que buscam uma vida tranquila</p>
               </div>
             </div>

             <div onClick={() => navigate('/imoveis?type=Cobertura')} className="relative rounded-[2.5rem] overflow-hidden cursor-pointer group">
               <img src="https://www.multiimob.com.br/blog/wp-content/uploads/2024/11/Vantagens-e-Desvantagens-de-Morar-em-Coberturas.jpeg" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Coberturas" />
               <div className="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-black/60 to-transparent">
                  <h3 className="text-white text-3xl font-semibold">Coberturas</h3>
                  <p className="text-white/80 mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0">Espaços luxuosos e modernos para uma vida de qualidade</p>
               </div>
             </div>

             <div onClick={() => navigate('/imoveis?type=Terreno')} className="md:col-span-2 relative rounded-[2.5rem] overflow-hidden cursor-pointer group">
               <img src="https://plantasdecasas.com/wp-content/uploads/2017/01/comprar-terreno2.jpg" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" alt="Bairros" />
               <div className="absolute bottom-0 left-0 p-8 w-full bg-gradient-to-t from-black/60 to-transparent">
                  <h3 className="text-white text-2xl font-semibold">Lotes</h3>
                  <p className="text-white/80 mt-2 opacity-0 group-hover:opacity-100 transition-opacity transform translate-y-4 group-hover:translate-y-0">Oportunidades de investimento em terras e lotes</p>
               </div>
             </div>
          </div>
        </div>
      </section>

      {/* Destaques */}
      <section className="py-20 bg-slate-50 dark:bg-dark-bg">
        <div className="container mx-auto px-6">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
            <div>
              <h2 className="text-3xl md:text-4xl font-semibold text-slate-900 dark:text-white">Imóveis em Destaque</h2>
              <p className="text-slate-500 mt-2 text-lg">Oportunidades selecionadas recentemente.</p>
            </div>
            <button onClick={() => navigate('/imoveis')} className="px-6 py-3 rounded-full border border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white transition-all font-medium">
              Ver todos os imóveis
            </button>
          </div>

          {loading ? (
            <div className="flex justify-center py-20"><Loading /></div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {featuredProperties.length > 0 ? (
                featuredProperties.map(property => (
                  <PropertyCard key={property.id} property={property} />
                ))
              ) : (
                <p className="col-span-3 text-center text-gray-400 py-10">
                  Nenhum imóvel destacado no momento.
                </p>
              )}
            </div>
          )}
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

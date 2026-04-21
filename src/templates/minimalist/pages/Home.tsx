import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { Search, ArrowRight, MapPin, Send, HomeIcon, Building, Hotel } from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import Loading from '../../../components/Loading';
import PartnersCarousel from '../../../components/PartnersCarousel';
import PropertyCard from '../components/PropertyCard';
import CondominiumCard from '../components/CondominiumCard';
import { Property, ListingType } from '../../../types';
import { getPrimaryColor, getWhatsappLink } from '../../../utils/tenantUtils';

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed.filter((item): item is string => typeof item === 'string') : [value];
    } catch {
      return [value];
    }
  }
  return [];
};

export default function Home() {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  
  const siteData = React.useMemo(() => {
    return typeof tenant?.site_data === 'string' 
      ? JSON.parse(tenant.site_data) 
      : tenant?.site_data || {};
  }, [tenant?.site_data]);
    
  const primaryColor = getPrimaryColor(tenant);
  const quickContactLink = getWhatsappLink(tenant, 'Olá, gostaria de ajuda para encontrar um imóvel.') || `https://wa.me/55${(siteData.contact?.phone || '').replace(/\D/g, '')}?text=Olá,%20gostaria%20de%20ajuda%20para%20encontrar%20um%20imóvel.`;
  
  const [listingType, setListingType] = useState<ListingType>('sale');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [currentSlide, setCurrentSlide] = useState(0);

  const heroImages = React.useMemo(() => {
    if (siteData.hero_carousel_images && siteData.hero_carousel_images.length > 0) {
      return siteData.hero_carousel_images;
    }
    if (siteData.hero_image_url) {
      return [siteData.hero_image_url];
    }
    return [
      "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=2000&q=80",
      "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?auto=format&fit=crop&w=2000&q=80",
      "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2000&q=80"
    ];
  }, [siteData]);

  useEffect(() => {
    if (siteData.hero_video_url || heroImages.length <= 1) return;
    const timer = setInterval(() => {
      setCurrentSlide(prev => (prev + 1) % heroImages.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [siteData.hero_video_url, heroImages.length]);

  const [activeCondos, setActiveCondos] = useState<any[]>([]);

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
          .order('created_at', { ascending: false })
          .limit(6);

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
            features: parseStringArray(item.features),
            images: parseStringArray(item.images),
          })) as Property[];

          setFeaturedProperties(mapped);
        }
      } catch (error) {
        console.error('Erro ao buscar imóveis:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    void fetchProperties();
    return () => { isMounted = false; };
  }, [tenant]);

  useEffect(() => {
    let isMounted = true;
    const fetchActiveCondos = async () => {
      if (!tenant?.id) return;
      const registeredCondos = siteData.condominiums || [];
      if (!registeredCondos.length) return;

      try {
        const { data } = await supabase
          .from('properties')
          .select('condominium_id')
          .eq('company_id', tenant.id)
          .neq('status', 'Vendido')
          .neq('status', 'Alugado')
          .not('condominium_id', 'is', null);

        const activeIds = new Set((data || []).map((item: any) => item.condominium_id).filter(Boolean));
        if (isMounted) {
          setActiveCondos(registeredCondos.filter((condo: any) => activeIds.has(condo.id)));
        }
      } catch (error) {
        console.error('Erro ao buscar condominios:', error);
      }
    };
    void fetchActiveCondos();
    return () => { isMounted = false; };
  }, [tenant, siteData.condominiums]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedType) params.set('type', selectedType);
    params.set('listingType', listingType);
    navigate(`/imoveis?${params.toString()}`);
  };

  return (
    <div className="animate-fade-in bg-[#fcfcfc] text-slate-900 overflow-x-hidden pt-8">
      {/* Hero Section */}
      <section className="px-4 md:px-8 flex items-center justify-center max-w-[1024px] mx-auto mb-8">
        <div className="w-full bg-slate-900 border border-slate-100 rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col justify-between min-h-[460px] md:min-h-[400px]">
          {/* Media Background */}
          {siteData.hero_video_url ? (
            <video 
              autoPlay 
              loop 
              muted 
              playsInline 
              src={siteData.hero_video_url} 
              className="absolute inset-0 w-full h-full object-cover opacity-60"
            />
          ) : (
            <div className="absolute inset-0 w-full h-full">
              {heroImages.map((src: string, index: number) => (
                <img 
                  key={src}
                  src={src}
                  alt={`Hero ${index + 1}`}
                  className={`absolute inset-0 w-full h-full object-cover transition-opacity duration-1000 ${
                    index === currentSlide ? 'opacity-60' : 'opacity-0'
                  }`}
                />
              ))}
            </div>
          )}
          
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent pointer-events-none"></div>

          <div className="relative z-10 flex justify-between items-start mb-12">
            <div>
              <span className="text-[10px] font-bold text-white/70 uppercase tracking-widest mb-4 block drop-shadow-sm">System Status</span>
              <h1 className="text-3xl md:text-4xl font-light tracking-tight text-white mb-2 drop-shadow-md">
                {siteData.hero_title || siteData.heroTitle || 'Espaços inspiradores.'}
              </h1>
              <p className="text-sm text-slate-200 max-w-sm drop-shadow-sm">
                {siteData.hero_subtitle || siteData.heroSubtitle || 'Encontre imóveis com design autêntico.'}
              </p>
            </div>
          </div>

          <form onSubmit={handleSearch} className="relative z-10 flex flex-col md:flex-row gap-3 md:gap-4 mt-auto">
            {/* Input de Busca e Select de Venda/Aluguel */}
            <div className="flex-1 w-full bg-white/10 backdrop-blur-md p-1.5 md:p-2 rounded-xl flex items-center gap-1.5 md:gap-2 border border-white/20 hover:bg-white/20 transition-all focus-within:ring-1 focus-within:ring-blue-500">
              <Search className="w-4 h-4 md:w-5 md:h-5 text-white/70 ml-2 shrink-0" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Busque por bairro, cidade, ref..." 
                className="w-full bg-transparent outline-none text-sm md:text-base font-medium placeholder:text-white/60 text-white min-w-0" 
              />
              <div className="h-5 md:h-6 w-px bg-white/20 shrink-0"></div>
              <select 
                value={listingType}
                onChange={(e) => setListingType(e.target.value as ListingType)}
                className="bg-transparent outline-none text-xs md:text-sm font-bold text-white cursor-pointer [&>option]:text-slate-900 shrink-0 border-none px-1 md:px-2 focus:ring-0 max-w-[85px] md:max-w-none"
              >
                <option value="sale">Compra</option>
                <option value="rent">Aluguel</option>
              </select>
            </div>
            
            {/* Select de Tipo de Imóvel */}
            <div className="w-full md:w-48 bg-white/10 backdrop-blur-md rounded-xl border border-white/20 p-1.5 md:p-2 hover:bg-white/20 transition-all focus-within:ring-1 shrink-0">
              <select 
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full h-full bg-transparent outline-none text-sm font-medium text-white cursor-pointer [&>option]:text-slate-900 py-1"
              >
                <option value="">Tipo imóvel</option>
                <option value="Casa">Casa</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Cobertura">Cobertura</option>
                <option value="Terreno">Terreno</option>
              </select>
            </div>

            <button 
              type="submit"
              className="w-full md:w-32 bg-white text-black rounded-[19px] text-sm font-bold transition-all hover:bg-slate-100 disabled:opacity-50 py-3 shrink-0"
            >
              Buscar
            </button>
          </form>

        </div>
      </section>

      {/* Bento Grid Principal */}
      <section className="max-w-[1024px] mx-auto px-4 md:px-8 mb-8">
        <div className="grid grid-cols-1 md:grid-cols-4 md:grid-rows-3 gap-5 md:min-h-[600px] md:auto-rows-min">
          
          {/* Categorias Block */}
          <div className="md:col-span-1 md:row-span-2 bg-white border border-slate-100 rounded-3xl p-6 flex flex-col justify-between">
            <div>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4 md:mb-6">Explorar</span>
              <div className="grid grid-cols-2 md:grid-cols-1 gap-3">
                <div onClick={() => navigate('/imoveis?type=Casa')} className="group p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <HomeIcon size={14} className="text-slate-400 transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-blue-600" />
                    <span className="text-sm font-medium">Casas</span>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
                <div onClick={() => navigate('/imoveis?type=Apartamento')} className="group p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <Building size={14} className="text-slate-400 transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-red-600" />
                    <span className="text-sm font-medium">Apartamentos</span>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
                <div onClick={() => navigate('/imoveis?type=Cobertura')} className="group p-4 bg-slate-50 border border-slate-100 rounded-2xl flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-all duration-300">
                  <div className="flex items-center gap-3">
                    <Hotel size={14} className="text-slate-400 transition-transform duration-300 group-hover:-translate-y-1 group-hover:text-yellow-600" />
                    <span className="text-sm font-medium">Coberturas</span>
                  </div>
                  <ArrowRight size={14} className="text-slate-400 transition-transform duration-300 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </div>

          {/* Destaques (Main Space) - Extends further since we removed condos */}
          <div className="md:col-span-3 md:row-span-2 bg-white border border-slate-100 rounded-3xl p-6 md:p-8 flex flex-col">
            <div className="flex justify-between items-end mb-6 shrink-0">
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Imóveis</span>
                <h3 className="text-xl font-medium tracking-tight">Imóveis em Destaque</h3>
                <p className="text-xs text-slate-400 mt-1">Nossa curadoria especial</p>
              </div>
              <Link to="/imoveis" className="text-xs font-bold underline underline-offset-4 text-slate-600 hover:text-black">Ver todos</Link>
            </div>
            
            {loading ? (
              <div className="flex-1 flex justify-center items-center py-10"><Loading /></div>
            ) : featuredProperties.length > 0 ? (
              <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
                {featuredProperties.slice(0, 3).map((prop) => (
                  <div key={prop.id} className="h-[280px] shadow-sm hover:shadow-md transition-shadow rounded-2xl overflow-hidden border border-slate-100">
                    <PropertyCard property={prop} />
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center">
                <span className="text-sm font-medium text-slate-500 mb-1">Nenhum destaque</span>
              </div>
            )}
          </div>

          {/* Nossa Filosofia (Stretches across bottom) */}
          <div className="md:col-span-2 md:row-span-1 bg-black text-white border border-slate-800 rounded-3xl p-6 md:p-8 flex flex-col justify-between">
            <div className="flex justify-between items-start">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nossa Filosofia</span>
            </div>
            <div className="mt-8 md:mt-0">
              <h2 className="text-2xl md:text-3xl font-light tracking-tight">Simplicidade é a <br/>maior sofisticação.</h2>
              <p className="text-sm text-slate-400 mt-3 line-clamp-2 md:line-clamp-none opacity-80">
                {siteData.about_text || siteData.aboutText || 'Reduzimos o complexo ao essencial, proporcionando uma experiência curada exclusiva.'}
              </p>
            </div>
          </div>
          
          {/* Quick Contact Block */}
          <div className="md:col-span-2 md:row-span-1 bg-slate-100 border border-slate-200 rounded-3xl p-6 md:p-8 flex flex-col justify-between">
            <div>
               <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Assessoria</span>
               <h3 className="text-2xl font-medium tracking-tight text-slate-900 mb-2">Precisa de ajuda?</h3>
               <p className="text-sm text-slate-600">Nossa equipe está pronta para ajudar você a encontrar o imóvel perfeito para o seu momento.</p>
            </div>
            <div className="mt-6">
              <a href={quickContactLink} 
                 target="_blank" rel="noopener noreferrer"
                 className="inline-flex items-center gap-2 bg-black text-white px-5 py-2.5 rounded-full text-sm font-medium hover:bg-slate-800 transition-colors">
                <Send size={16} />
                Falar com consultor
              </a>
            </div>
          </div>

        </div>
      </section>

      {/* Parceiros */}
      {siteData.show_partnerships !== false && siteData.partners && siteData.partners.length > 0 && (
        <div className="max-w-[1024px] mx-auto px-4 md:px-8 mb-8">
          <div className="bg-white border border-slate-100 rounded-3xl p-6">
             <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4 px-2">Extensions</span>
             <PartnersCarousel partners={siteData.partners} />
          </div>
        </div>
      )}
    </div>
  );
}

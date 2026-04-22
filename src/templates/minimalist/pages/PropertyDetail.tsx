import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import { Property } from '../../../types';
import Loading from '../../../components/Loading';
import PropertyCard from '../components/PropertyCard';
import { MapPin, BedDouble, Bath, Car, Maximize2, ArrowLeft, Send, Share2, Check, X, ChevronLeft, ChevronRight } from 'lucide-react';
import { getWhatsappLink } from '../../../utils/tenantUtils';

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

export default function PropertyDetail() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const routeKey = slug || id || '';
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [property, setProperty] = useState<Property | null>(null);
  const [similarProperties, setSimilarProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeImage, setActiveImage] = useState(0);
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [shareText, setShareText] = useState('Compartilhar');
  const [isCopied, setIsCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchProperty = async () => {
      if (!tenant?.id || !routeKey) {
        if (isMounted) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        let { data, error } = await supabase
          .from('properties')
          .select('*, profiles(name, phone, email)')
          .eq('company_id', tenant.id)
          .eq('slug', routeKey)
          .maybeSingle();

        if (error) throw error;

        if (!data) {
          const fallbackRes = await supabase
            .from('properties')
            .select('*, profiles(name, phone, email)')
            .eq('company_id', tenant.id)
            .eq('id', routeKey)
            .maybeSingle();

          data = fallbackRes.data;
          error = fallbackRes.error;
        }

        if (error) throw error;
        if (isMounted && data) {
          setProperty({
            ...data,
            location: {
              city: data.city || '',
              neighborhood: data.neighborhood || '',
              state: data.state || '',
              address: data.address || '',
            },
            agent: Array.isArray(data.profiles) ? data.profiles[0] : data.profiles,
            features: parseStringArray(data.features),
            images: parseStringArray(data.images),
          } as Property);

          // Fetch similar properties
          const { data: similarData, error: similarError } = await supabase
            .from('properties')
            .select('*, profiles(name, phone, email)')
            .eq('company_id', tenant.id)
            .limit(4);

          if (!similarError && similarData) {
            const currentId = data.id;
            const currentCity = data.city;
            
            const filteredSimilar = similarData
              .filter((p: any) => p.id !== currentId) // Use array filter instead of mock .neq()
              .map((item: any) => ({
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
              }))
              .filter((p: any) => p.city === currentCity || p.type === data.type) // Priority to same city or type
              .slice(0, 3) as Property[];
              
            setSimilarProperties(filteredSimilar);
          }
        }
      } catch (error) {
        console.error('Erro ao buscar imóvel:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProperty();
    return () => { isMounted = false; };
  }, [tenant, routeKey]);

  // Keyboard navigation for gallery
  useEffect(() => {
    if (!isGalleryOpen || !property?.images) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsGalleryOpen(false);
      if (e.key === 'ArrowRight') {
        setActiveImage((prev) => prev === property.images.length - 1 ? 0 : prev + 1);
      }
      if (e.key === 'ArrowLeft') {
        setActiveImage((prev) => prev === 0 ? property.images.length - 1 : prev - 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen, property]);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-[#fcfcfc]"><Loading /></div>;
  }

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-[#fcfcfc]">
        <h2 className="text-xl font-medium text-slate-900">Imóvel não encontrado.</h2>
        <button onClick={() => navigate('/imoveis')} className="mt-4 underline text-slate-500">Voltar para listagem</button>
      </div>
    );
  }

  const displayPrice = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property.price || 0);
  const message = `Olá! Tenho interesse no imóvel "${property.title}" (Ref: ${property.id}).`;
  const wpLink = getWhatsappLink(tenant, message);

  const handleShare = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({
          title: property.title,
          text: `Confira este imóvel: ${property.title}`,
          url: url,
        });
      } catch (error) {
        console.error('Erro ao compartilhar', error);
      }
    } else {
      navigator.clipboard.writeText(url);
      setShareText('Copiado!');
      setIsCopied(true);
      setTimeout(() => {
        setShareText('Compartilhar');
        setIsCopied(false);
      }, 2000);
    }
  };

  return (
    <div className="animate-fade-in bg-[#fcfcfc] min-h-screen pb-20">
      
      {/* Top Media Hero */}
      <div className="w-full max-w-[1024px] mx-auto px-4 md:px-8 pt-4 md:pt-8 mb-8">
        <div className="flex items-center justify-between mb-6">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            <ArrowLeft size={16} /> Voltar
          </button>
          <button onClick={handleShare} className="flex items-center gap-2 text-sm font-medium text-slate-500 hover:text-slate-900 transition-colors">
            {isCopied ? <Check size={16} className="text-emerald-500" /> : <Share2 size={16} />} 
            <span className={isCopied ? "text-emerald-500" : ""}>{shareText}</span>
          </button>
        </div>

        <div className="bg-white rounded-3xl p-4 border border-slate-100 flex flex-col md:flex-row gap-4 h-auto md:h-[500px]">
          {/* Main Image */}
          <div 
            className="flex-1 bg-slate-100 rounded-2xl overflow-hidden relative cursor-pointer"
            onClick={() => setIsGalleryOpen(true)}
          >
            {property.images && property.images.length > 0 ? (
              <img src={property.images[activeImage]} alt={property.title} className="w-full h-full object-cover transition-transform duration-700" />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center text-slate-300">Image Area</div>
            )}
            <div className="absolute top-4 left-4 bg-black/50 backdrop-blur text-white text-[10px] font-bold px-3 py-1.5 rounded-full uppercase tracking-widest pointer-events-none">
              {property.type}
            </div>
          </div>

          {/* Thumbnails */}
          <div className="flex md:flex-col gap-3 overflow-x-auto md:overflow-y-auto md:w-32 shrink-0 pb-2 md:pb-0 hide-scrollbar">
            {property.images?.map((img: string, idx: number) => (
              <div 
                key={idx} 
                onClick={() => setActiveImage(idx)}
                className={`w-24 h-24 md:w-full md:h-24 rounded-xl overflow-hidden shrink-0 cursor-pointer border-2 transition-all ${
                  activeImage === idx ? 'border-black' : 'border-transparent opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} alt={`Thumb ${idx}`} className="w-full h-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Content Layout */}
      <div className="w-full max-w-[1024px] mx-auto px-4 md:px-8 flex flex-col md:flex-row gap-8">
        
        {/* Main Details */}
        <div className="flex-1">
          <div className="mb-8">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">Details</span>
            <h1 className="text-3xl md:text-4xl font-light tracking-tight text-slate-900 mb-4">{property.title}</h1>
            <p className="flex items-center gap-2 text-sm text-slate-500 font-medium pb-6 border-b border-slate-100">
              <MapPin size={16} />
              {property.location?.address}{property.location?.address && property.location?.neighborhood ? ', ' : ''}
              {property.location?.neighborhood} - {property.location?.city}/{property.location?.state}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
             <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center">
                 <BedDouble size={20} className="text-slate-400 mb-2" />
                 <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Quartos</span>
                 <span className="text-xl font-light tracking-tight text-slate-900">{property.bedrooms || '-'}</span>
             </div>
             <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center">
                 <Bath size={20} className="text-slate-400 mb-2" />
                 <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Banheiros</span>
                 <span className="text-xl font-light tracking-tight text-slate-900">{property.bathrooms || '-'}</span>
             </div>
             <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center">
                 <Car size={20} className="text-slate-400 mb-2" />
                 <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Vagas</span>
                 <span className="text-xl font-light tracking-tight text-slate-900">{property.garage || '-'}</span>
             </div>
             <div className="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col items-center justify-center">
                 <Maximize2 size={20} className="text-slate-400 mb-2" />
                 <span className="text-xs text-slate-500 uppercase font-bold tracking-widest">Área (m²)</span>
                 <span className="text-xl font-light tracking-tight text-slate-900">{property.area || '-'}</span>
             </div>
          </div>

          {property.description && (
             <div className="bg-white border border-slate-100 rounded-3xl p-8 mb-8">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Sobre o Imóvel</span>
                <p className="text-slate-600 text-sm leading-relaxed whitespace-pre-wrap">
                  {property.description}
                </p>
             </div>
          )}

          {property.features && property.features.length > 0 && (
             <div className="bg-white border border-slate-100 rounded-3xl p-8 mb-8">
               <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-6">Comodidades</span>
               <div className="grid grid-cols-2 md:grid-cols-3 gap-y-4 gap-x-2">
                 {property.features.map((feature: string, idx: number) => (
                    <div key={idx} className="flex items-center gap-2 text-sm text-slate-700 font-medium">
                       <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
                       {feature}
                    </div>
                 ))}
               </div>
             </div>
          )}

        </div>

        {/* Sidebar / Sidebar Card */}
        <div className="w-full md:w-80 shrink-0">
           <div className="sticky top-24 bg-black text-white rounded-3xl p-8 border border-slate-800 flex flex-col">
              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Investimento</span>
              <div className="text-4xl font-light tracking-tight mb-8">
                {displayPrice}
              </div>

              {property.agent && (
                <div className="mb-8 p-4 bg-slate-900 rounded-2xl border border-slate-800">
                   <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-2">Corretor Responsável</p>
                   <p className="text-sm font-medium">{property.agent.name}</p>
                   <p className="text-xs text-slate-400">{property.agent.phone}</p>
                </div>
              )}

              <a 
                 href={wpLink}
                 target="_blank"
                 rel="noopener noreferrer"
                 className="w-full flex items-center justify-center gap-2 bg-white text-black py-4 rounded-2xl text-sm font-bold transition-transform hover:scale-[1.02]"
              >
                 <Send size={16} /> Contactar Corretor
              </a>
           </div>
        </div>

      </div>

      {/* Similar Properties Section */}
      {similarProperties.length > 0 && (
        <div className="w-full max-w-[1024px] mx-auto px-4 md:px-8 mt-12 md:mt-16 pt-12 md:pt-16 border-t border-slate-100 overflow-hidden">
          <div className="mb-6 md:mb-8">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2 px-1">You may also like</span>
            <h2 className="text-3xl font-light tracking-tight text-slate-900">Imóveis Semelhantes</h2>
          </div>
          <div className="flex overflow-x-auto gap-6 pb-4 hide-scrollbar snap-x">
            {similarProperties.map(prop => (
              <div key={prop.id} className="w-[300px] md:w-[350px] shrink-0 h-[350px] snap-start">
                <PropertyCard property={prop} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Fullscreen Gallery Form */}
      {isGalleryOpen && property && property.images && property.images.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-sm flex items-center justify-center animate-fade-in touch-none">
          {/* Close button */}
          <button 
            onClick={() => setIsGalleryOpen(false)}
            className="absolute top-6 right-6 md:top-8 md:right-8 text-white/70 hover:text-white transition-colors bg-black/50 hover:bg-white/10 rounded-full p-2"
          >
            <X size={24} />
          </button>

          {/* Previous button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setActiveImage((prev) => prev === 0 ? property.images.length - 1 : prev - 1);
            }}
            className="absolute left-4 md:left-8 text-white/50 hover:text-white transition-colors bg-black/50 hover:bg-white/10 rounded-full p-3"
          >
            <ChevronLeft size={32} />
          </button>

          {/* Main Stage */}
          <div className="w-full h-full max-h-screen p-4 md:p-12 flex flex-col items-center justify-center select-none" onClick={() => setIsGalleryOpen(false)}>
             <img 
                src={property.images[activeImage]} 
                alt={`${property.title} - ${activeImage + 1}`} 
                className="max-w-full max-h-[80vh] object-contain cursor-default"
                onClick={(e) => e.stopPropagation()}
             />
             
             {/* Counter */}
             <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/70 text-sm font-medium tracking-wide">
               {activeImage + 1} / {property.images.length}
             </div>
          </div>

          {/* Next button */}
          <button 
            onClick={(e) => {
              e.stopPropagation();
              setActiveImage((prev) => prev === property.images.length - 1 ? 0 : prev + 1);
            }}
            className="absolute right-4 md:right-8 text-white/50 hover:text-white transition-colors bg-black/50 hover:bg-white/10 rounded-full p-3"
          >
            <ChevronRight size={32} />
          </button>
        </div>
      )}

    </div>
  );
}

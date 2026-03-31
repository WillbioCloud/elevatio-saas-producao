import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import Loading from '../../../components/Loading';
import SimilarProperties from '../../../components/SimilarProperties';
import { Property } from '../../../types';
import { supabase } from '../../../lib/supabase';
import { ArrowLeft, Home, ArrowRight, X, MapPin, CheckCircle, MessageCircle, Loader2, Maximize, Maximize2, Bed, Bath, Car } from 'lucide-react';
import PropertyCard from '../components/PropertyCard';

const PropertyDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const siteData = tenant?.site_data;
  const primaryColor = siteData?.primary_color || '#1e293b';
  const secondaryColor = siteData?.secondary_color || '#3b82f6';

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: 'Olá, gostaria de agendar uma visita a este imóvel.'
  });
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success'>('idle');
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    let isMounted = true;

    async function fetchProperty() {
      if (!slug || !tenant?.id) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*, profiles(*)')
          .eq('company_id', tenant.id)
          .eq('slug', slug)
          .maybeSingle();

        if (error) {
          console.error('Erro do Supabase:', error);
          if (isMounted) setLoading(false);
          return;
        }

        if (!data) {
          // Imóvel não encontrado
          if (isMounted) setLoading(false);
          return;
        }

        if (isMounted && data) {
          const agentData = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

          // PARSERS SEGUROS
          let parsedImages: string[] = [];
          if (Array.isArray(data.images)) parsedImages = data.images;
          else if (typeof data.images === 'string') {
            try {
              parsedImages = JSON.parse(data.images);
            } catch {
              parsedImages = [data.images];
            }
          }

          let parsedFeatures: string[] = [];
          if (Array.isArray(data.features)) parsedFeatures = data.features;
          else if (typeof data.features === 'string') {
            try {
              parsedFeatures = JSON.parse(data.features);
            } catch {
              parsedFeatures = [data.features];
            }
          }

          const mappedProperty: Property = {
            ...data,
            agent: agentData,
            location: {
              city: data.city || '',
              neighborhood: data.neighborhood || '',
              state: data.state || '',
              address: data.address || '',
              zip_code: data.zip_code || ''
            },
            features: parsedFeatures || [],
            images: parsedImages || []
          };
          setProperty(mappedProperty);
        }
      } catch (error) {
        console.error('Erro ao buscar imóvel:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProperty();

    return () => {
      isMounted = false;
    };
  }, [slug, tenant?.id]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isGalleryOpen || !property) return;
      if (e.key === 'Escape') closeGallery();
      if (e.key === 'ArrowRight') nextImage();
      if (e.key === 'ArrowLeft') prevImage();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen, currentImageIndex, property]);

  if (loading) return <Loading />;

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Imóvel não encontrado</h2>
        <button onClick={() => navigate('/imoveis')} className="text-gray-900 hover:underline font-medium">
          Voltar para lista de imóveis
        </button>
      </div>
    );
  }

  const isRent = property.listing_type === 'rent';
  const isUnavailable = property.status === 'Alugado' || property.status === 'Vendido';
  const safeAddress = property.location?.address || '';
  const safeNeighborhood = property.location?.neighborhood || '';
  const safeCity = property.location?.city || '';
  const fullAddress = `${safeAddress}, ${safeNeighborhood}, ${safeCity}`;
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  const openGallery = (index: number) => {
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
    document.body.style.overflow = 'hidden';
  };

  const closeGallery = () => {
    setIsGalleryOpen(false);
    document.body.style.overflow = 'auto';
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === (property.images?.length || 1) - 1 ? 0 : prev + 1));
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? (property.images?.length || 1) - 1 : prev - 1));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');

    try {
      const payload = {
        name: contactForm.name,
        phone: contactForm.phone,
        email: contactForm.email || null,
        message: contactForm.message,
        source: 'site',
        property_id: property?.id,
        funnel_step: 'pre_atendimento',
        status: 'Aguardando Atendimento',
        stage_updated_at: new Date().toISOString(),
        company_id: tenant?.id
      };

      await supabase.from('leads').insert([payload]);

      const text = `Olá! Gostaria de mais informações sobre o imóvel: ${property?.title}. Meu nome é ${contactForm.name}.`;
      const whatsapp = tenant?.site_data?.social?.whatsapp || '5511999999999';
      const cleanPhone = whatsapp.replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

      window.open(waUrl, '_blank');
      setFormStatus('success');

      setTimeout(() => {
        setFormStatus('idle');
        setContactForm(prev => ({ ...prev, name: '', phone: '', email: '' }));
      }, 3000);
    } catch (error) {
      console.error('Erro ao enviar lead:', error);
      setFormStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* GALERIA MODAL */}
      {isGalleryOpen && property?.images && property.images.length > 0 && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col">
          <div className="flex items-center justify-between p-4 md:p-6 text-white absolute top-0 left-0 right-0 z-20">
            <span className="font-bold bg-black/40 px-4 py-2 rounded-full">
              {currentImageIndex + 1} / {property.images.length}
            </span>
            <button onClick={closeGallery} className="p-3 bg-white/10 rounded-full">
              <X size={28} />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center w-full h-full" onClick={closeGallery}>
            {property.images.length > 1 && (
              <button onClick={prevImage} className="absolute left-2 md:left-8 p-3 bg-black/50 text-white rounded-full z-10">
                <ArrowLeft size={24} />
              </button>
            )}

            <img 
              src={property.images[currentImageIndex] || 'https://placehold.co/800x600'} 
              alt="Foto" 
              className="max-h-full max-w-full object-contain" 
              onClick={(e) => e.stopPropagation()} 
            />

            {property.images.length > 1 && (
              <button onClick={nextImage} className="absolute right-2 md:right-8 p-3 bg-black/50 text-white rounded-full z-10">
                <ArrowRight size={24} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* CABEÇALHO */}
      <div className="bg-white pt-24 sm:pt-28 md:pt-32 pb-4 shadow-sm relative z-10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button onClick={() => navigate(-1)} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 mb-6 font-semibold">
            <ArrowLeft size={18} /> Voltar
          </button>
          <h1 className="text-2xl sm:text-3xl md:text-5xl font-semibold text-gray-900 mb-2">
            {property?.title || 'Imóvel'}
          </h1>
          <div className="flex items-center text-gray-500 gap-2">
            <MapPin size={18} />
            <span className="text-sm sm:text-base">{safeNeighborhood}, {safeCity}</span>
          </div>
        </div>
      </div>

      {/* FOTOS GRID */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[300px] md:h-[600px] relative">
          <div 
            className="md:col-span-2 md:row-span-2 relative h-full rounded-3xl overflow-hidden cursor-pointer" 
            onClick={() => openGallery(0)}
          >
            <img 
              src={property?.images?.[0] || 'https://placehold.co/800x600'} 
              alt="Capa" 
              className="w-full h-full object-cover" 
            />
            <div className="absolute top-6 left-6 flex flex-wrap gap-2">
              <span className="bg-white/90 px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase">
                {property?.type || 'Imóvel'}
              </span>
              <span 
                className="px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase text-white" 
                style={{ backgroundColor: isRent ? secondaryColor : primaryColor }}
              >
                {isRent ? 'Aluguel' : 'Venda'}
              </span>
              {property.built_area && (
                  <span className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-white">
                    <Home size={14} className="text-slate-300" />
                    {property.built_area} m² Const.
                  </span>
                )}
              {(property.suites || 0) > 0 && (
                  <span className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-white">
                    <Bed size={14} className="text-slate-300" />
                    {property.suites} Suítes
                  </span>
                )}
            </div>
          </div>

          {property?.images && property.images.slice(1, 5).map((img, idx) => (
            <div 
              key={idx} 
              className="relative h-full hidden md:block rounded-3xl overflow-hidden cursor-pointer" 
              onClick={() => openGallery(idx + 1)}
            >
              <img 
                src={img || 'https://placehold.co/800x600'} 
                alt={`Foto ${idx}`} 
                className="w-full h-full object-cover" 
              />
            </div>
          ))}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          <div className="lg:col-span-8 space-y-12">
            
            {/* Cards de Métricas (Design Clean) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-200 dark:border-slate-700 pb-8">
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Maximize size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.area} m²</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Área Útil</span>
                  </div>
                </div>
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Bed size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.bedrooms}</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Quartos</span>
                  </div>
                </div>
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Bath size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.bathrooms}</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Banheiros</span>
                  </div>
                </div>
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Car size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.garage}</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Vagas</span>
                  </div>
                </div>
            </div>

            {/* Descrição */}
            <div>
              <h2 className="text-2xl font-semibold mb-6">Sobre o imóvel</h2>
              <p className="text-gray-600 whitespace-pre-line">{property?.description}</p>
            </div>

            {/* Features */}
            {property?.features && property.features.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold mb-6">Comodidades</h2>
                <div className="flex flex-wrap gap-3">
                  {property.features.map((feature, index) => (
                    <span key={index} className="flex items-center gap-2 border px-5 py-3 rounded-full text-sm">
                      <CheckCircle size={16} /> {typeof feature === 'string' ? feature : 'Comodidade'}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Mapa */}
            <div className="rounded-3xl overflow-hidden border h-[400px]">
              <iframe title="Mapa" width="100%" height="100%" frameBorder="0" src={mapUrl} />
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-24 bg-white p-6 sm:p-8 rounded-3xl shadow-xl border w-full">
              <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-6">
                {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(property?.price || 0)}
              </h2>

              {!isUnavailable && formStatus === 'success' ? (
                <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl text-center border border-emerald-100">
                  <CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                  <p className="font-bold text-lg mb-2">Solicitação Enviada!</p>
                  <p className="text-sm">Abrindo o WhatsApp...</p>
                </div>
              ) : !isUnavailable ? (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <input
                    type="text"
                    required
                    placeholder="Nome Completo"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 outline-none text-base"
                    value={contactForm.name}
                    onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                  />
                  <input
                    type="tel"
                    required
                    placeholder="Seu WhatsApp"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 outline-none text-base"
                    value={contactForm.phone}
                    onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                  />
                  <input
                    type="email"
                    placeholder="Seu e-mail (opcional)"
                    className="w-full px-4 py-3 rounded-xl bg-gray-50 border-none focus:ring-2 outline-none text-base"
                    value={contactForm.email}
                    onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                  />

                  <button
                    type="submit"
                    disabled={formStatus === 'sending'}
                    className="w-full text-white font-bold py-4 rounded-xl flex justify-center items-center gap-2 text-base sm:text-lg"
                    style={{ backgroundColor: primaryColor }}
                  >
                    {formStatus === 'sending' ? (
                      <>
                        <Loader2 size={20} className="animate-spin" /> Processando...
                      </>
                    ) : (
                      <>
                        <MessageCircle size={20} /> Fale Conosco
                      </>
                    )}
                  </button>
                </form>
              ) : (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                  <p className="text-amber-900 font-bold">Imóvel Indisponível</p>
                  <p className="text-amber-800 text-sm mt-1">
                    Este imóvel já foi {isRent ? 'alugado' : 'vendido'}.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* Seção de Imóveis Similares */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-12 w-full">
        <SimilarProperties
          currentPropertyId={property.id}
          listingType={property.listing_type || 'sale'}
          city={property.location?.city || property.city}
          neighborhood={property.location?.neighborhood || property.neighborhood}
          renderCard={(p) => <PropertyCard key={p.id} property={p} />}
        />
      </div>
    </div>
  );
};

export default PropertyDetail;

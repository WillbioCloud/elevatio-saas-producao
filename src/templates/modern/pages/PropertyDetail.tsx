import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useTenant } from '../../../contexts/TenantContext';
import { Icons } from '../../../components/Icons';
import Loading from '../../../components/Loading';
import { supabase } from '../../../lib/supabase';
import { Property } from '../../../types';
import { cleanPhone, getPrimaryColor, getTenantPhone, getWhatsappLink } from '../tenantUtils';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

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

const PropertyDetail: React.FC = () => {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const routeKey = slug || id || '';
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [property, setProperty] = useState<Property | null>(null);
  const [loading, setLoading] = useState(true);

  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: 'Olá, gostaria de agendar uma visita a este imóvel.',
  });
  const [contactIntent, setContactIntent] = useState<'contato' | 'visita'>('contato');
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const thumbnailRefs = useRef<(HTMLImageElement | null)[]>([]);
  const primaryColor = getPrimaryColor(tenant);

  useEffect(() => {
    let isMounted = true;

    const fetchProperty = async () => {
      if (!routeKey || !tenant?.id) {
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
          const agent = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles;

          setProperty({
            ...data,
            agent,
            location: {
              city: data.city || '',
              neighborhood: data.neighborhood || '',
              state: data.state || '',
              address: data.address || '',
              zip_code: data.zip_code || '',
            },
            features: parseStringArray(data.features),
            images: parseStringArray(data.images),
          } as Property);
        }
      } catch (error) {
        console.error('Erro ao buscar imóvel do tenant:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchProperty();

    return () => {
      isMounted = false;
    };
  }, [routeKey, tenant?.id]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!isGalleryOpen || !property) return;
      if (event.key === 'Escape') closeGallery();
      if (event.key === 'ArrowRight') nextImage();
      if (event.key === 'ArrowLeft') prevImage();
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isGalleryOpen, property]);

  // Atualiza o SEO (Título da Aba)
  useEffect(() => {
    if (property) {
      document.title = `${property.title} | Imóveis`;
    }
  }, [property]);

  // Efeito para rolar o carrossel de miniaturas automaticamente
  useEffect(() => {
    if (isGalleryOpen && thumbnailRefs.current[currentImageIndex]) {
      thumbnailRefs.current[currentImageIndex]?.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center',
      });
    }
  }, [currentImageIndex, isGalleryOpen]);

  const rentTotal = property && property.listing_type === 'rent'
    ? (property.price || 0) + (property.iptu || 0) + (property.condominium || 0)
    : 0;

  const handleShare = async () => {
    if (!property) return;
    // Usamos a URL atual do navegador para funcionar perfeitamente tanto no localhost quanto em produção
    const shareUrl = window.location.href;

    if (navigator.share) {
      try {
        await navigator.share({
          title: property.title,
          text: `Confira este imóvel: ${property.title}`,
          url: shareUrl,
        });
      } catch (error) {
        console.log('Erro ao compartilhar', error);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Link copiado para a área de transferência!');
    }
  };

  const galleryImages = useMemo(
    () => (property?.images && property.images.length > 0 ? property.images : ['https://placehold.co/1200x800?text=Sem+Foto']),
    [property]
  );

  if (loading) return <Loading />;

  if (!property) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold text-slate-800 mb-4">Imóvel não encontrado</h2>
        <button onClick={() => navigate('/imoveis')} className="text-slate-900 hover:underline font-medium">
          Voltar para lista de imóveis
        </button>
      </div>
    );
  }

  const isRent = property.listing_type === 'rent';
  const isUnavailable = property.is_available === false || property.status === 'Alugado' || property.status === 'Vendido';
  const isRentUnavailable = isRent && isUnavailable;
  const fullAddress = `${property.location.address || ''}, ${property.location.neighborhood}, ${property.location.city} - ${property.location.state}`;
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

  const nextImage = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === galleryImages.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? galleryImages.length - 1 : prev - 1));
  };

  const handleContactSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setFormStatus('sending');

    try {
      if (!tenant?.id || !property.id) {
        throw new Error('Tenant ou imóvel não identificado.');
      }

      const { error } = await supabase.from('leads').insert({
        company_id: tenant.id,
        property_id: property.id,
        name: contactForm.name,
        email: contactForm.email || null,
        phone: contactForm.phone,
        message: contactForm.message || 'Tenho interesse neste imóvel.',
        status: 'novo',
        source: 'Site Público',
      });

      if (error) throw error;

      const introText =
        contactIntent === 'visita'
          ? 'Olá! Gostaria de agendar uma visita para o imóvel'
          : 'Olá! Gostaria de mais informações sobre o imóvel';
      const whatsappText = `${introText}: ${property.title}. Meu nome é ${contactForm.name}.`;
      const tenantWhatsappLink = getWhatsappLink(tenant, whatsappText);
      const fallbackDigits = cleanPhone(property.agent?.phone || getTenantPhone(tenant));
      const fallbackWhatsappLink = fallbackDigits
        ? `https://wa.me/${fallbackDigits}?text=${encodeURIComponent(whatsappText)}`
        : '';

      if (tenantWhatsappLink || fallbackWhatsappLink) {
        window.open(tenantWhatsappLink || fallbackWhatsappLink, '_blank');
      }

      setFormStatus('success');

      setTimeout(() => {
        setFormStatus('idle');
        setContactForm((prev) => ({ ...prev, name: '', phone: '', email: '' }));
      }, 3000);
    } catch (error) {
      console.error('Erro ao enviar lead:', error);
      alert('Ocorreu um erro ao enviar sua solicitação. Tente novamente.');
      setFormStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-sans">
      {isGalleryOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-fade-in touch-none">
          <div className="flex items-center justify-between p-4 md:p-6 text-white absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <span className="font-bold tracking-widest text-sm uppercase pointer-events-auto bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10">
              {currentImageIndex + 1} / {galleryImages.length}
            </span>
            <button
              onClick={closeGallery}
              className="p-3 hover:bg-white/20 rounded-full transition-all pointer-events-auto backdrop-blur-sm"
              aria-label="Fechar galeria"
            >
              <Icons.X size={28} />
            </button>
          </div>

          <div className="flex-1 relative flex items-center justify-center w-full h-full" onClick={closeGallery}>
            {galleryImages.length > 1 && (
              <button
                onClick={prevImage}
                className="absolute left-2 md:left-8 p-3 md:p-4 bg-black/50 hover:bg-black/80 border border-white/10 text-white rounded-full backdrop-blur transition-all z-10"
              >
                <Icons.ArrowLeft size={24} />
              </button>
            )}

            <img
              src={galleryImages[currentImageIndex]}
              alt={`Foto ${currentImageIndex + 1}`}
              className="max-h-full max-w-full object-contain select-none transition-transform duration-300"
              onClick={(e) => e.stopPropagation()}
            />

            {galleryImages.length > 1 && (
              <button
                onClick={nextImage}
                className="absolute right-2 md:right-8 p-3 md:p-4 bg-black/50 hover:bg-black/80 border border-white/10 text-white rounded-full backdrop-blur transition-all z-10"
              >
                <Icons.ArrowRight size={24} />
              </button>
            )}
          </div>

          {galleryImages.length > 1 && (
            <div 
              className="p-4 md:p-6 bg-black/50 backdrop-blur-md z-20 w-full"
              onClick={(e) => e.stopPropagation()}
            >
              {/* REMOVIDO o md:justify-center e adicionado px-4 md:px-8 para evitar o negative overflow */}
              <div className="flex gap-3 overflow-x-auto snap-x pb-4 justify-start px-4 md:px-8 [&::-webkit-scrollbar]:hidden">
                {galleryImages.map((image, idx) => (
                  <img
                    key={idx}
                    ref={(element) => {
                      // O TypeScript pode reclamar se não tipar o element corretamente, mas o React aceita
                      if (element) thumbnailRefs.current[idx] = element;
                    }}
                    src={image}
                    alt={`Miniatura ${idx + 1}`}
                    className={`h-16 md:h-20 w-24 md:w-32 flex-shrink-0 object-cover cursor-pointer rounded-xl snap-center transition-all duration-300 ${
                      idx === currentImageIndex
                        ? 'border-2 border-brand-500 opacity-100 scale-105 shadow-[0_0_15px_rgba(14,165,233,0.3)]'
                        : 'opacity-40 hover:opacity-100 border border-transparent'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(idx);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="bg-white dark:bg-slate-900 pt-8 pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-2 text-slate-500 hover:text-slate-900 transition-colors font-semibold mb-6 group w-fit"
          >
            <Icons.ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Voltar
          </button>

          <nav className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-6">
            <Link to="/" className="hover:text-black transition-colors">Home</Link>
            <span className="text-slate-300">/</span>
            <Link to="/imoveis" className="hover:text-black transition-colors">Imóveis</Link>
            <span className="text-slate-300">/</span>
            <span className="text-slate-900 truncate max-w-[200px]">{property.location.city}</span>
          </nav>

          <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 mb-2">
            <div>
              <h1 className="text-3xl md:text-5xl font-semibold text-slate-900 leading-tight mb-2">
                {property.title}
              </h1>
              <div className="flex items-center text-slate-500 gap-2 text-lg font-light">
                <Icons.MapPin size={18} />
                <span>{property.location.neighborhood}, {property.location.city}</span>
              </div>
            </div>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:text-brand-600 px-4 py-2.5 rounded-xl font-medium transition-all shadow-sm w-fit"
            >
              <Icons.Share2 size={18} />
              <span className="md:hidden lg:inline">Compartilhar</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[300px] md:h-[600px] relative">
          <div
            className="md:col-span-2 md:row-span-2 relative h-full rounded-[2rem] overflow-hidden shadow-sm group cursor-pointer"
            onClick={() => openGallery(0)}
          >
            <img
              src={galleryImages[0]}
              alt={property.title}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />

            <div className="absolute top-6 left-6 flex flex-wrap gap-2">
              <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-slate-900">
                {property.type}
              </span>
              <span
                className="px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-white backdrop-blur-md"
                style={{ backgroundColor: isRent ? '#4f46e5' : primaryColor }}
              >
                {isRent ? 'Aluguel' : 'Venda'}
              </span>

              {property.built_area && (
                <span className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-white">
                  <Icons.Home size={14} className="text-slate-300" />
                  {property.built_area} m² Const.
                </span>
              )}

              {isRentUnavailable && (
                <span className="px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-white bg-red-600/90 backdrop-blur-md">
                  Imóvel Alugado
                </span>
              )}

              {(property.suites || 0) > 0 && (
                <span className="flex items-center gap-1.5 bg-slate-900/80 backdrop-blur-md px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-white">
                  <Icons.Bed size={14} className="text-slate-300" />
                  {property.suites} Suítes
                </span>
              )}
            </div>
          </div>

          {galleryImages.slice(1, 5).map((img, idx) => (
            <div
              key={idx}
              className="relative h-full hidden md:block rounded-[2rem] overflow-hidden group cursor-pointer"
              onClick={() => openGallery(idx + 1)}
            >
              <img
                src={img}
                alt={`Visão ${idx + 2}`}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
            </div>
          ))}

          <button
            onClick={(event) => {
              event.stopPropagation();
              openGallery(0);
            }}
            className="absolute bottom-4 right-4 md:bottom-6 md:right-6 bg-white/90 backdrop-blur-md text-slate-900 px-4 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-xl hover:bg-white transition-colors flex items-center gap-2 text-xs md:text-base"
          >
            <Icons.Grid size={18} className="hidden md:block" />
            <Icons.Camera size={16} className="md:hidden" />
            <span className="hidden md:inline">Ver todas as fotos</span>
            <span className="md:hidden">1/{galleryImages.length}</span>
          </button>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          <div className="lg:col-span-8 space-y-12">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-200 pb-8">
              <div className="px-4 md:px-6 py-4 bg-white rounded-3xl shadow-xl border border-slate-200 flex items-center gap-3">
                <Icons.Maximize size={24} className="text-slate-400" />
                <div>
                  <span className="block text-xl font-bold text-slate-900">{property.area} m²</span>
                  <span className="text-xs text-slate-500 font-medium uppercase">Área Útil</span>
                </div>
              </div>

              <div className="px-4 md:px-6 py-4 bg-white rounded-3xl shadow-xl border border-slate-200 flex items-center gap-3">
                <Icons.Bed size={24} className="text-slate-400" />
                <div>
                  <span className="block text-xl font-bold text-slate-900">{property.bedrooms}</span>
                  <span className="text-xs text-slate-500 font-medium uppercase">Quartos</span>
                </div>
              </div>

              <div className="px-4 md:px-6 py-4 bg-white rounded-3xl shadow-xl border border-slate-200 flex items-center gap-3">
                <Icons.Bath size={24} className="text-slate-400" />
                <div>
                  <span className="block text-xl font-bold text-slate-900">{property.bathrooms}</span>
                  <span className="text-xs text-slate-500 font-medium uppercase">Banheiros</span>
                </div>
              </div>

              <div className="px-4 md:px-6 py-4 bg-white rounded-3xl shadow-xl border border-slate-200 flex items-center gap-3">
                <Icons.Car size={24} className="text-slate-400" />
                <div>
                  <span className="block text-xl font-bold text-slate-900">{property.garage}</span>
                  <span className="text-xs text-slate-500 font-medium uppercase">Vagas</span>
                </div>
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-6">Sobre o imóvel</h2>
              <p className="text-slate-600 leading-relaxed text-lg whitespace-pre-line font-light">
                {property.description}
              </p>
            </div>

            {property.features.length > 0 && (
              <div>
                <h2 className="text-2xl font-semibold text-slate-900 mb-6">Comodidades</h2>
                <div className="flex flex-wrap gap-3">
                  {property.features.map((feature, index) => (
                    <span key={index} className="flex items-center gap-2 text-slate-700 bg-white border border-slate-200 px-5 py-3 rounded-full text-sm font-medium">
                      <Icons.CheckCircle size={16} className="text-slate-900" />
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-[2rem] overflow-hidden border border-slate-200 h-[300px] md:h-[400px]">
              {property.latitude && property.longitude ? (
                <MapContainer
                  center={[property.latitude, property.longitude]}
                  zoom={15}
                  style={{ height: '100%', width: '100%' }}
                >
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                  <Marker position={[property.latitude, property.longitude]} />
                </MapContainer>
              ) : (
                <iframe
                  title="Mapa de localização"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  src={mapUrl}
                  className="grayscale hover:grayscale-0 transition-all duration-500"
                />
              )}
            </div>
          </div>

          <div className="lg:col-span-4 mt-8 md:mt-12 lg:mt-0">
            <div className="lg:sticky lg:top-8">
              <div className="bg-white p-6 md:p-8 rounded-[2rem] shadow-2xl border border-slate-200">
                <div className="mb-8">
                  <h2 className="text-4xl font-bold text-slate-900 flex items-baseline gap-1">
                    {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(isRent && rentTotal > 0 ? rentTotal : property.price)}
                    {isRent && <span className="text-xl text-slate-500 font-medium">/mês</span>}
                  </h2>
                  <div className="text-sm text-slate-500 font-medium tracking-wide mb-1">
                    {isRent ? 'Inclui no pacote quando informado(Condominio, etc.)' : 'Preço de Venda'}
                  </div>

                  {/* Detalhamento removido conforme solicitação. Mostramos apenas o valor total acima. */}

                  {property.financing_available && (
                    <div className="mt-4 bg-emerald-50 border border-emerald-100 rounded-2xl p-4">
                      <div className="flex items-start gap-3">
                        <div className="bg-emerald-100 text-emerald-600 p-2 rounded-lg shrink-0">
                          <Icons.CheckCircle size={20} />
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-emerald-800">Aceita Financiamento</h4>
                          <p className="text-xs text-emerald-600 mt-1 mb-3">Este imóvel está apto para financiamento bancário.</p>
                          <Link
                            to="/financiamentos"
                            className="inline-flex items-center gap-1.5 text-xs font-bold bg-white text-emerald-700 px-3 py-2 rounded-lg shadow-sm hover:shadow border border-emerald-100 transition-all"
                          >
                            <Icons.Calculator size={14} /> Simular Parcelas
                          </Link>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <hr className="border-slate-300 my-4" />

                {isRentUnavailable ? (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-start gap-3">
                      <div className="mt-0.5 rounded-full bg-amber-100 p-2 text-amber-700">
                        <Icons.AlertTriangle size={18} />
                      </div>
                      <div>
                        <p className="text-amber-900 font-bold">Imóvel Indisponível</p>
                        <p className="text-amber-800 text-sm mt-1 leading-relaxed">
                          Este imóvel já está alugado no momento, mas pode voltar a ficar disponível no futuro.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="bg-transparent md:bg-white md:rounded-3xl md:p-6 lg:p-8 md:shadow-xl md:border border-slate-100 mt-6">
                    <div className="flex bg-slate-200 p-0.5 rounded-xl mb-4">
                      <button
                        type="button"
                        onClick={() => setContactIntent('contato')}
                        className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                          contactIntent === 'contato' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        style={contactIntent === 'contato' ? { color: primaryColor } : undefined}
                      >
                        Solicitar Contato
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactIntent('visita')}
                        className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                          contactIntent === 'visita' ? 'bg-white shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                        style={contactIntent === 'visita' ? { color: primaryColor } : undefined}
                      >
                        Agendar Visita
                      </button>
                    </div>

                    {formStatus === 'success' ? (
                      <div className="bg-emerald-50 text-emerald-700 p-6 rounded-2xl text-center border border-emerald-100 animate-fade-in">
                        <Icons.CheckCircle size={48} className="mx-auto mb-4 text-emerald-500" />
                        <p className="font-bold text-lg mb-2">Solicitação Enviada!</p>
                        <p className="text-sm">Abrindo o WhatsApp...</p>
                      </div>
                    ) : (
                      <form onSubmit={handleContactSubmit} className="space-y-4">
                        <input
                          type="text"
                          required
                          placeholder="Nome Completo"
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 outline-none"
                          value={contactForm.name}
                          onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                        />
                        <input
                          type="tel"
                          required
                          placeholder="Seu WhatsApp"
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 outline-none"
                          value={contactForm.phone}
                          onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                        />
                        <input
                          type="email"
                          placeholder="Seu e-mail (opcional)"
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 outline-none"
                          value={contactForm.email}
                          onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                        />

                        <button
                          type="submit"
                          disabled={formStatus === 'sending'}
                          className="w-full text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 mt-2"
                          style={{ backgroundColor: primaryColor }}
                        >
                          {formStatus === 'sending' ? (
                            <>
                              <Icons.Loader2 size={20} className="animate-spin" /> Processando...
                            </>
                          ) : (
                            <>
                              <Icons.MessageCircle size={20} /> {contactIntent === 'contato' ? 'Solicitar Contato' : 'Solicitar Visita'}
                            </>
                          )}
                        </button>
                        <p className="text-[10px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1 font-medium">
                          <Icons.Shield size={12} /> Seus dados estão seguros conosco
                        </p>
                      </form>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PropertyDetail;

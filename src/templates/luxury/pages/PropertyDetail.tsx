import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Icons } from '../../../components/Icons';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';

interface FullProperty {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  price: number | null;
  type: string | null;
  listing_type: string | null;
  bedrooms: number | null;
  bathrooms: number | null;
  suites: number | null;
  area: number | null;
  built_area: number | null;
  garage: number | null;
  city: string | null;
  neighborhood: string | null;
  state: string | null;
  address: string | null;
  features: string[] | string | null;
  images: string[] | string | null;
  status: string | null;
  iptu: number | null;
  condominium: number | null;
}

const parseStringArray = (value: unknown): string[] => {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
  }

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed)
        ? parsed.filter((item): item is string => typeof item === 'string' && item.length > 0)
        : value
          ? [value]
          : [];
    } catch {
      return value ? [value] : [];
    }
  }

  return [];
};

const formatCurrency = (value: number) =>
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0,
  });

const getListingLabel = (listingType: string | null) => {
  const normalized = String(listingType || '').toLowerCase();

  if (
    normalized === 'rent' ||
    normalized.includes('alug') ||
    normalized.includes('venda e aluguel')
  ) {
    return 'Aluguel';
  }

  return 'Venda';
};

export default function LuxuryPropertyDetail() {
  const { id, slug } = useParams<{ id?: string; slug?: string }>();
  const identifier = slug || id || '';
  const navigate = useNavigate();
  const { tenant } = useTenant();

  const [property, setProperty] = useState<FullProperty | null>(null);
  const [loading, setLoading] = useState(true);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const thumbnailRefs = useRef<(HTMLImageElement | null)[]>([]);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [leadForm, setLeadForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: 'Olá, gostaria de saber mais detalhes sobre este imóvel.',
  });

  const galleryImages = useMemo(() => {
    const parsed = parseStringArray(property?.images);
    return parsed.length > 0
      ? parsed
      : ['https://placehold.co/1200x800/111111/ffffff?text=Imovel'];
  }, [property?.images]);

  useEffect(() => {
    let isMounted = true;

    const fetchProperty = async () => {
      if (!identifier || !tenant?.id) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);

      try {
        const isUuid =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
            identifier
          );

        const fetchBy = async (field: 'id' | 'slug') =>
          supabase
            .from('properties')
            .select('*')
            .eq('company_id', tenant.id)
            .eq(field, identifier)
            .maybeSingle();

        let response = isUuid ? await fetchBy('id') : await fetchBy('slug');

        if (!response.data && !isUuid) {
          response = await fetchBy('id');
        }

        if (response.error) {
          throw response.error;
        }

        if (!response.data) {
          if (isMounted) setProperty(null);
          return;
        }

        const data = response.data;

        if (isMounted) {
          setProperty({
            ...data,
            features: parseStringArray(data.features),
            images: parseStringArray(data.images),
          } as FullProperty);
        }
      } catch (error) {
        console.error('Erro ao buscar imovel:', error);
        if (isMounted) setProperty(null);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    void fetchProperty();

    return () => {
      isMounted = false;
    };
  }, [identifier, tenant?.id]);

  // ─── Efeito de SEO Dinâmico ─────────────────────────────────
  useEffect(() => {
    if (!property) return;

    // Atualiza o Título da Aba do Navegador
    const baseTitle = tenant?.name || 'Imóveis de Luxo';
    document.title = `${property.title} | ${baseTitle}`;

    // Atualiza a Meta Description (útil para o Googlebot)
    let metaDescription = document.querySelector('meta[name="description"]');
    if (!metaDescription) {
      metaDescription = document.createElement('meta');
      metaDescription.setAttribute('name', 'description');
      document.head.appendChild(metaDescription);
    }

    // Pega as primeiras 150 letras da descrição para o SEO
    const cleanDesc = property.description?.replace(/<[^>]+>/g, '').substring(0, 150) + '...';
    metaDescription.setAttribute('content', cleanDesc);

    // Limpeza ao desmontar o componente (voltar ao normal se o cliente sair da página)
    return () => {
      document.title = baseTitle;
    };
  }, [property, tenant?.name]);

  useEffect(() => {
    if (!galleryOpen) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setGalleryOpen(false);
      }

      if (event.key === 'ArrowRight') {
        setCurrentImageIndex((prev) =>
          galleryImages.length > 0 ? (prev + 1) % galleryImages.length : prev
        );
      }

      if (event.key === 'ArrowLeft') {
        setCurrentImageIndex((prev) =>
          galleryImages.length > 0
            ? (prev - 1 + galleryImages.length) % galleryImages.length
            : prev
        );
      }
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [galleryOpen, galleryImages.length]);

  useEffect(() => {
    if (!galleryOpen) return;

    thumbnailRefs.current[currentImageIndex]?.scrollIntoView({
      behavior: 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [currentImageIndex, galleryOpen]);

  const openGallery = (index = 0) => {
    const safeIndex =
      galleryImages.length > 0
        ? Math.min(Math.max(index, 0), galleryImages.length - 1)
        : 0;

    setCurrentImageIndex(safeIndex);
    setGalleryOpen(true);
  };

  const closeGallery = () => {
    setGalleryOpen(false);
  };

  const nextImage = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % galleryImages.length);
  };

  const prevImage = (event?: React.MouseEvent) => {
    event?.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + galleryImages.length) % galleryImages.length);
  };

  const handleContactSubmit = async (event: React.FormEvent) => {
    event.preventDefault();

    if (!tenant?.id || !property?.id) return;

    setSending(true);
    setSubmitError('');

    try {
      const { error } = await supabase.from('leads').insert([
        {
          company_id: tenant.id,
          property_id: property.id,
          name: leadForm.name,
          email: leadForm.email || null,
          phone: leadForm.phone,
          message: `[Interesse no imovel: ${property.title}]\n${leadForm.message}`,
          source: 'Site',
          status: 'Aguardando Atendimento',
          funnel_step: 'pre_atendimento',
        },
      ]);

      if (error) {
        throw error;
      }

      setSent(true);
    } catch (error) {
      console.error('Erro ao enviar lead:', error);
      setSubmitError('Nao foi possivel enviar sua solicitacao agora. Tente novamente.');
    } finally {
      setSending(false);
    }
  };

  const [copied, setCopied] = useState(false);

  const handleShare = async () => {
    if (!property) return;

    // ATENÇÃO: Substitua pelo seu Reference ID do Supabase
    const supabaseProjectRef = 'udqychpxnbdaxlorbhyw';

    // Monta a URL da Edge Function enviando o ID do imóvel e a URL de origem
    const originUrl = window.location.origin;
    const botBaitUrl = `https://${supabaseProjectRef}.supabase.co/functions/v1/og-imovel?id=${property.id}&tenant_url=${originUrl}`;

    const shareData = {
      title: property.title,
      text: `Confira este imóvel incrível: ${property.title}`,
      url: botBaitUrl,
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
      } catch (err) {
        console.error('Erro ao compartilhar', err);
      }
    } else {
      // No desktop, copia o link da Edge Function
      navigator.clipboard.writeText(botBaitUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black pt-32 pb-20 px-6">
        <div className="max-w-[1400px] mx-auto animate-pulse">
          <div className="h-5 w-40 rounded-full bg-white/10 mb-8" />
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
            <div className="lg:col-span-2 aspect-video rounded-[2rem] bg-white/10" />
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
              <div className="aspect-square lg:aspect-auto lg:h-full rounded-[2rem] bg-white/10" />
              <div className="aspect-square lg:aspect-auto lg:h-full rounded-[2rem] bg-white/10" />
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-14 w-2/3 rounded-2xl bg-white/10" />
              <div className="h-28 rounded-2xl bg-white/10" />
              <div className="h-48 rounded-2xl bg-white/10" />
            </div>
            <div className="lg:col-span-4 h-[440px] rounded-[2rem] bg-white/10" />
          </div>
        </div>
      </div>
    );
  }

  if (!property) {
    return (
      <div className="min-h-screen bg-black px-6 pt-32 pb-20 text-center text-white">
        <div className="mx-auto max-w-xl">
          <h2 className="text-3xl font-medium">Imovel nao encontrado</h2>
          <p className="mt-4 text-white/55">
            Nao foi possivel localizar este imovel no portfolio atual.
          </p>
          <button
            type="button"
            onClick={() => navigate('/imoveis')}
            className="mt-8 rounded-full border border-white/15 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-white/5"
          >
            Voltar para Imóveis
          </button>
        </div>
      </div>
    );
  }

  const images = galleryImages;
  const features = parseStringArray(property.features);
  const mainImage = images[0];
  const sideTopImage = images[1] || images[0];
  const sideBottomImage = images[2] || images[0];
  const sideTopIndex = images[1] ? 1 : 0;
  const sideBottomIndex = images[2] ? 2 : images[1] ? 1 : 0;
  const listingLabel = getListingLabel(property.listing_type);
  const price = property.price || 0;
  const condominium = property.condominium || 0;
  const iptu = property.iptu || 0;
  const isRent = listingLabel === 'Aluguel';
  const displayPrice = isRent ? price + condominium + iptu : price;
  const area = property.built_area || property.area || 0;
  const locationText = [property.neighborhood, property.city, property.state]
    .filter(Boolean)
    .join(', ');
  const aboutParagraphs = (property.description || '')
    .split(/\n+/)
    .map((item) => item.trim())
    .filter(Boolean);

  const amenityItems =
    features.length > 0
      ? features
      : [
          property.type || '',
          property.suites ? `${property.suites} suites` : '',
          property.garage ? `${property.garage} vagas de garagem` : '',
          property.status || '',
          condominium > 0 ? 'Condominio informado' : '',
          iptu > 0 ? 'IPTU informado' : '',
        ].filter(Boolean);

  return (
    <>
      <div className="pt-32 pb-20 px-6 max-w-[1400px] mx-auto selection:bg-white selection:text-black">
        {/* Barra de Navegação no Topo (Voltar + Compartilhar) */}
        <div className="flex justify-between items-center mb-12">
          <Link
            to="/imoveis"
            className="inline-flex items-center gap-2 text-neutral-400 hover:text-white transition-colors text-sm font-medium"
          >
            <Icons.ArrowLeft className="w-4 h-4" />
            Voltar para imóveis
          </Link>

          <button
            onClick={handleShare}
            className="inline-flex items-center gap-2 text-neutral-300 hover:text-white transition-colors text-sm font-medium px-5 py-2.5 rounded-full border border-white/10 bg-[#111] hover:bg-white/10"
          >
            {copied ? (
              <>
                <svg
                  className="w-4 h-4 text-green-400"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
                <span className="text-green-400">Link copiado!</span>
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <circle cx="18" cy="5" r="3" />
                  <circle cx="6" cy="12" r="3" />
                  <circle cx="18" cy="19" r="3" />
                  <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                  <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                </svg>
                Compartilhar Imóvel
              </>
            )}
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-16">
          <button
            type="button"
            onClick={() => openGallery(0)}
            className="lg:col-span-2 relative aspect-video rounded-[2rem] overflow-hidden bg-[#111111] text-left"
          >
            <img src={mainImage} alt={property.title} className="w-full h-full object-cover" />
          </button>

          <div className="grid grid-cols-2 lg:grid-cols-1 gap-6">
            <button
              type="button"
              onClick={() => openGallery(sideTopIndex)}
              className="relative aspect-square lg:aspect-auto lg:h-full rounded-[2rem] overflow-hidden bg-[#111111] text-left"
            >
              <img
                src={sideTopImage}
                alt={`${property.title} foto 2`}
                className="w-full h-full object-cover"
              />
            </button>

            <button
              type="button"
              onClick={() => openGallery(sideBottomIndex)}
              className="relative aspect-square lg:aspect-auto lg:h-full rounded-[2rem] overflow-hidden bg-[#111111] text-left"
            >
              <img
                src={sideBottomImage}
                alt={`${property.title} foto 3`}
                className="w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer hover:bg-black/50 transition-colors">
                <span className="text-white font-medium border border-white/30 px-6 py-3 rounded-full backdrop-blur-sm">
                  Ver Galeria
                </span>
              </div>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-16">
          <div className="lg:col-span-8">
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-6">
              <div className="mb-6 md:mb-0">
                <h1 className="text-4xl md:text-5xl font-medium mb-4">{property.title}</h1>
                <div className="flex items-center gap-2 text-neutral-400">
                  <Icons.MapPin className="w-5 h-5" />
                  {locationText || 'Localizacao indisponivel'}
                </div>
              </div>

              <div className="text-left md:text-right">
                <div className="text-3xl font-medium">{formatCurrency(displayPrice)}</div>
                <div className="text-neutral-400 text-sm mt-1">
                  {isRent ? 'Inclui pacote quando informado(Condominio, etc.)' : listingLabel}
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-8 py-8 border-y border-white/10 mb-12">
              <div className="flex items-center gap-4">
                <div className="bg-[#111111] p-4 rounded-full">
                  <Icons.BedDouble className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-medium text-xl">{property.bedrooms || '--'}</div>
                  <div className="text-neutral-400 text-sm">Quartos</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-[#111111] p-4 rounded-full">
                  <Icons.Bath className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-medium text-xl">{property.bathrooms || '--'}</div>
                  <div className="text-neutral-400 text-sm">Banheiros</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-[#111111] p-4 rounded-full">
                  <Icons.Maximize className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-medium text-xl">
                    {area > 0 ? area.toLocaleString('pt-BR') : '--'}
                  </div>
                  <div className="text-neutral-400 text-sm">Área Construída</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-[#111111] p-4 rounded-full">
                  <Icons.ShowerHead className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-medium text-xl">{property.suites || '--'}</div>
                  <div className="text-neutral-400 text-sm">Suítes</div>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="bg-[#111111] p-4 rounded-full">
                  <Icons.Car className="w-6 h-6" />
                </div>
                <div>
                  <div className="font-medium text-xl">{property.garage || '--'}</div>
                  <div className="text-neutral-400 text-sm">Garagem</div>
                </div>
              </div>
            </div>

            <div className="mb-16">
              <h2 className="text-2xl font-medium mb-6">Sobre este imovel</h2>
              <div className="space-y-6 text-neutral-400 leading-relaxed text-lg">
                {(aboutParagraphs.length > 0
                  ? aboutParagraphs
                  : ['Descricao do imovel indisponivel.']).map((paragraph, index) => (
                  <p key={`${paragraph}-${index}`}>{paragraph}</p>
                ))}
              </div>
            </div>

            <div>
              <h2 className="text-2xl font-medium mb-8">Características e comodidades</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                {amenityItems.map((feature, index) => (
                  <div key={`${feature}-${index}`} className="flex items-center gap-3 text-neutral-300">
                    <div className="bg-[#111111] p-1.5 rounded-full">
                      <Icons.Check className="w-4 h-4 text-white" />
                    </div>
                    {feature}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-4">
            <div className="bg-[#111111] p-8 rounded-[2rem] sticky top-32 border border-white/5">
              <h3 className="text-2xl font-medium mb-3">Interessado neste imovel?</h3>
              <p className="text-neutral-400 text-sm mb-8">
                Entre em contato com nossa equipe para agendar uma visita privada.
              </p>

              {sent ? (
                <div className="rounded-2xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-center">
                  <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/15 text-emerald-300">
                    <Icons.CheckCircle className="h-5 w-5" />
                  </div>
                  <p className="text-lg font-medium text-white">Solicitacao enviada</p>
                  <p className="mt-2 text-sm text-neutral-400">
                    Nossa equipe retornara em breve.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleContactSubmit} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      required
                      placeholder="Seu nome"
                      className="w-full bg-black border border-white/10 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-colors"
                      value={leadForm.name}
                      onChange={(event) =>
                        setLeadForm((prev) => ({ ...prev, name: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <input
                      type="email"
                      placeholder="Email"
                      className="w-full bg-black border border-white/10 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-colors"
                      value={leadForm.email}
                      onChange={(event) =>
                        setLeadForm((prev) => ({ ...prev, email: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <input
                      type="tel"
                      required
                      placeholder="Numero de telefone"
                      className="w-full bg-black border border-white/10 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-colors"
                      value={leadForm.phone}
                      onChange={(event) =>
                        setLeadForm((prev) => ({ ...prev, phone: event.target.value }))
                      }
                    />
                  </div>

                  <div>
                    <textarea
                      placeholder="Mensagem"
                      rows={4}
                      className="w-full bg-black border border-white/10 rounded-xl px-5 py-4 text-sm focus:outline-none focus:border-white/30 transition-colors resize-none"
                      value={leadForm.message}
                      onChange={(event) =>
                        setLeadForm((prev) => ({ ...prev, message: event.target.value }))
                      }
                    />
                  </div>

                  {submitError && (
                    <div className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200">
                      {submitError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={sending}
                    className="w-full bg-white text-black font-medium rounded-xl py-4 mt-2 hover:bg-neutral-200 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {sending ? 'Enviando...' : 'Solicitar detalhes'}
                  </button>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>

      {galleryOpen && images.length > 0 && (
        <div className="fixed inset-0 z-[120] bg-black/95 flex flex-col">
          <div className="flex items-center justify-between p-4 md:p-6 text-white absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <span className="font-bold tracking-widest text-sm uppercase pointer-events-auto bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10">
              {currentImageIndex + 1} / {images.length}
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
            {images.length > 1 && (
              <button
                onClick={prevImage}
                className="absolute left-2 md:left-8 p-3 md:p-4 bg-black/50 hover:bg-black/80 border border-white/10 text-white rounded-full backdrop-blur transition-all z-10"
              >
                <Icons.ArrowLeft size={24} />
              </button>
            )}

            <img
              src={images[currentImageIndex]}
              alt={`Imagem ${currentImageIndex + 1} do imovel`}
              className="max-h-full max-w-full object-contain select-none transition-transform duration-300"
              onClick={(event) => event.stopPropagation()}
            />

            {images.length > 1 && (
              <button
                onClick={nextImage}
                className="absolute right-2 md:right-8 p-3 md:p-4 bg-black/50 hover:bg-black/80 border border-white/10 text-white rounded-full backdrop-blur transition-all z-10"
              >
                <Icons.ArrowRight size={24} />
              </button>
            )}
          </div>

          {images.length > 1 && (
            <div className="p-4 md:p-6 bg-black/50 backdrop-blur-md z-20 w-full">
              {/* REMOVIDO o md:justify-center para evitar que as primeiras fotos fujam para a esquerda (negative overflow) */}
              <div className="flex gap-3 overflow-x-auto snap-x pb-4 justify-start px-4 md:px-8 [&::-webkit-scrollbar]:hidden">
                {images.map((image, index) => (
                  <img
                    key={`${image}-${index}`}
                    ref={(element) => {
                      thumbnailRefs.current[index] = element;
                    }}
                    src={image}
                    alt={`Miniatura ${index + 1}`}
                    className={`h-16 md:h-20 w-24 md:w-32 flex-shrink-0 object-cover cursor-pointer rounded-xl snap-center transition-all duration-300 ${
                      index === currentImageIndex
                        ? 'border-2 border-white opacity-100 scale-105 shadow-[0_0_15px_rgba(255,255,255,0.3)]'
                        : 'opacity-40 hover:opacity-100 border border-transparent'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(index);
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

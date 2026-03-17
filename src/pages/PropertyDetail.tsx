import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useProperties } from '../hooks/useProperties';
import { Icons } from '../components/Icons';
import Loading from '../components/Loading';
import { Property } from '../types';
import { supabase } from '../lib/supabase';
import { MapContainer, Marker, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

const PropertyDetail: React.FC = () => {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const { properties, loading } = useProperties();
  const [property, setProperty] = useState<Property | null>(null);
  
  // --- Estados do formulário de contato ---
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phone: '',
    message: 'Olá, gostaria de agendar uma visita a este imóvel.'
  });
  const [contactIntent, setContactIntent] = useState<'contato' | 'visita'>('contato');
  const [formStatus, setFormStatus] = useState<'idle' | 'sending' | 'success'>('idle');

  // Captura a origem do tráfego (Ex: Facebook Ads, Google Ads)
  const utmSource = new URLSearchParams(window.location.search).get('utm_source') || 'site';

  // --- Estados da Galeria (Lightbox) ---
  const [isGalleryOpen, setIsGalleryOpen] = useState(false);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  useEffect(() => {
    if (properties.length > 0 && slug) {
      const found = properties.find((p) => p.slug === slug || p.id === slug);
      if (found) {
        setProperty(found);
      }
    }
  }, [properties, slug]);

  // --- Lógica de Navegação da Galeria e Teclado ---
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
  
  if (!property && !loading && properties.length > 0) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center text-center p-4">
        <h2 className="text-2xl font-bold text-slate-800 dark:text-white mb-4">Imóvel não encontrado</h2>
        <button onClick={() => navigate('/imoveis')} className="text-slate-900 hover:underline font-medium">
          Voltar para lista de imóveis
        </button>
      </div>
    );
  }

  if (!property) return null;

  const isRent = property.listing_type === 'rent';
  const isUnavailable = property.is_available === false || property.status === 'Alugado' || property.status === 'Vendido';
  const isRentUnavailable = isRent && isUnavailable;
  const fullAddress = `${property.location.address || ''}, ${property.location.neighborhood}, ${property.location.city} - ${property.location.state}`;
  const mapUrl = `https://maps.google.com/maps?q=${encodeURIComponent(fullAddress)}&t=&z=15&ie=UTF8&iwloc=&output=embed`;

  // Funções da Galeria
  const openGallery = (index: number) => {
    setCurrentImageIndex(index);
    setIsGalleryOpen(true);
    document.body.style.overflow = 'hidden'; // Evita scroll da página no fundo
  };

  const closeGallery = () => {
    setIsGalleryOpen(false);
    document.body.style.overflow = 'auto'; // Restaura scroll da página
  };

  const nextImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === property.images.length - 1 ? 0 : prev + 1));
  };

  const prevImage = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setCurrentImageIndex((prev) => (prev === 0 ? property.images.length - 1 : prev - 1));
  };

  const handleContactSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormStatus('sending');

    try {
      // 1. Busca as regras de roteamento no banco
      const { data: settings } = await supabase.from('settings').select('*').eq('id', 1).single();
      const routeToCentral = settings?.route_to_central ?? true;
      let targetPhone = settings?.central_whatsapp;
      let assignedTo = settings?.central_user_id || null;
      let funnelStep = 'pre_atendimento';
      let statusName = 'Aguardando Atendimento';

      // 2. Se a central estiver desligada, manda pro corretor dono do imóvel
      if (!routeToCentral && property?.agent) {
        targetPhone = property.agent.phone;
        assignedTo = property.agent_id;
        funnelStep = 'atendimento';
        statusName = 'Aguardando atendimento';
      }

      // Fallback de segurança para o telefone
      if (!targetPhone) targetPhone = '5511999999999';

      // 3. Salva no CRM
      const payload = {
        name: contactForm.name,
        phone: contactForm.phone,
        email: contactForm.email || null,
        message: contactIntent === 'visita'
          ? `${contactForm.message}`
          : `${contactForm.message}`,
        source: utmSource,
        property_id: property?.id,
        assigned_to: assignedTo,
        funnel_step: funnelStep,
        status: statusName,
        stage_updated_at: new Date().toISOString()
      };

      await supabase.from('leads').insert([payload]);

      // 4. Prepara e abre o WhatsApp
      const introText = contactIntent === 'visita'
        ? 'Olá! Gostaria de agendar uma visita para o imóvel'
        : 'Olá! Gostaria de mais informações sobre o imóvel';

      const text = `${introText}: ${property?.title}. Meu nome é ${contactForm.name}.`;
      const cleanPhone = targetPhone.replace(/\D/g, '');
      const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;

      window.open(waUrl, '_blank');
      setFormStatus('success');

      // Limpa após 3 segundos
      setTimeout(() => {
        setFormStatus('idle');
        setContactForm(prev => ({ ...prev, name: '', phone: '', email: '' }));
      }, 3000);
    } catch (error) {
      console.error('Erro ao enviar lead:', error);
      alert('Ocorreu um erro ao enviar sua solicitação. Tente novamente.');
      setFormStatus('idle');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 pb-20 font-sans">
      
      {/* =========================================
          MODAL DA GALERIA (LIGHTBOX)
      ========================================= */}
      {isGalleryOpen && (
        <div className="fixed inset-0 z-[100] bg-black/95 flex flex-col animate-fade-in touch-none">
          {/* Top Navbar */}
          <div className="flex items-center justify-between p-4 md:p-6 text-white absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/60 to-transparent pointer-events-none">
            <span className="font-bold tracking-widest text-sm uppercase pointer-events-auto bg-black/40 px-4 py-2 rounded-full backdrop-blur-sm border border-white/10">
              {currentImageIndex + 1} / {property.images.length}
            </span>
            <button 
              onClick={closeGallery} 
              className="p-3 hover:bg-white/20 rounded-full transition-all pointer-events-auto backdrop-blur-sm"
              aria-label="Fechar Galeria"
            >
              <Icons.X size={28} />
            </button>
          </div>

          {/* Área Principal da Imagem */}
          <div className="flex-1 relative flex items-center justify-center w-full h-full" onClick={closeGallery}>
            {/* Botão Voltar (Oculto se houver apenas 1 foto) */}
            {property.images.length > 1 && (
              <button 
                onClick={prevImage} 
                className="absolute left-2 md:left-8 p-3 md:p-4 bg-black/50 hover:bg-black/80 border border-white/10 text-white rounded-full backdrop-blur transition-all z-10"
              >
                <Icons.ArrowLeft size={24} /> 
              </button>
            )}

            <img 
              src={property.images[currentImageIndex]} 
              alt={`Foto ${currentImageIndex + 1}`} 
              className="max-h-full max-w-full object-contain select-none transition-transform duration-300"
              onClick={(e) => e.stopPropagation()} // Impede fechar ao clicar na foto
            />

            {/* Botão Avançar */}
            {property.images.length > 1 && (
              <button 
                onClick={nextImage} 
                className="absolute right-2 md:right-8 p-3 md:p-4 bg-black/50 hover:bg-black/80 border border-white/10 text-white rounded-full backdrop-blur transition-all z-10"
              >
                <Icons.ArrowRight size={24} />
              </button>
            )}
          </div>

          {/* Miniaturas (Carrossel Inferior para Mobile e Desktop) */}
          {property.images.length > 1 && (
            <div className="p-4 md:p-6 bg-black/50 backdrop-blur-md z-20">
              <div className="flex gap-3 overflow-x-auto snap-x pb-2 justify-start md:justify-center [&::-webkit-scrollbar]:hidden">
                {property.images.map((img, idx) => (
                  <img 
                    key={idx}
                    src={img}
                    alt={`Miniatura ${idx + 1}`}
                    className={`h-16 md:h-20 w-24 md:w-32 object-cover cursor-pointer rounded-xl snap-center transition-all duration-300 ${
                      idx === currentImageIndex 
                        ? 'border-2 border-white opacity-100 scale-105 shadow-[0_0_15px_rgba(255,255,255,0.3)]' 
                        : 'opacity-40 hover:opacity-100 border border-transparent'
                    }`}
                    onClick={() => setCurrentImageIndex(idx)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
      {/* ========================================= */}


      {/* --- BREADCRUMBS & TITLE HEADER --- */}
      <div className="bg-white dark:bg-slate-900 pt-8 pb-4">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* NOVO: Botão Voltar Dinâmico */}
            <button 
              onClick={() => navigate(-1)} 
              className="flex items-center gap-2 text-slate-500 hover:text-brand-600 dark:text-slate-400 dark:hover:text-brand-400 transition-colors font-semibold mb-6 group w-fit"
            >
              <Icons.ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
              Voltar
            </button>

            <nav className="flex items-center gap-2 text-sm font-medium text-slate-500 mb-6">
                <Link to="/" className="hover:text-black dark:hover:text-white transition-colors">Home</Link>
                <span className="text-slate-300">/</span>
                <Link to="/imoveis" className="hover:text-black dark:hover:text-white transition-colors">Imóveis</Link>
                <span className="text-slate-300">/</span>
                <span className="text-slate-900 dark:text-white truncate max-w-[200px]">{property.location.city}</span>
            </nav>
            <h1 className="text-3xl md:text-5xl font-semibold text-slate-900 dark:text-white leading-tight mb-2">
                {property.title}
            </h1>
            <div className="flex items-center text-slate-500 dark:text-slate-400 gap-2 text-lg font-light">
                <Icons.MapPin size={18} />
                <span>{property.location.neighborhood}, {property.location.city}</span>
            </div>
        </div>
      </div>

      {/* --- GALERIA GRID (Rounded aesthetic) --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 h-[300px] md:h-[600px] relative">
            {/* Imagem Principal */}
            <div 
              className="md:col-span-2 md:row-span-2 relative h-full rounded-[2rem] overflow-hidden shadow-sm group cursor-pointer"
              onClick={() => openGallery(0)}
            >
              <img 
                src={property.images[0] || 'https://placehold.co/800x600'} 
                alt={property.title} 
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
              
              <div className="absolute top-6 left-6 flex flex-wrap gap-2">
                <span className="bg-white/90 backdrop-blur px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-slate-900">
                  {property.type}
                </span>
                <span className={`px-4 py-2 rounded-full text-sm font-bold shadow-sm uppercase tracking-wider text-white backdrop-blur-md ${
                  isRent ? 'bg-indigo-600/90' : 'bg-emerald-600/90'
                }`}>
                  {isRent ? 'Aluguel' : 'Venda'}
                </span>
                
                {/* NOVA TAG: Área Construída (Condicional) */}
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

            {/* Imagens Secundárias */}
            {property.images.slice(1, 5).map((img, idx) => (
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
              onClick={(e) => { e.stopPropagation(); openGallery(0); }}
              className="absolute bottom-4 right-4 md:bottom-6 md:right-6 bg-white/90 backdrop-blur-md text-slate-900 px-4 py-2 md:px-6 md:py-3 rounded-full font-bold shadow-xl hover:bg-white transition-colors flex items-center gap-2 text-xs md:text-base"
            >
              <Icons.Grid size={18} className="hidden md:block" />
              <Icons.Camera size={16} className="md:hidden" />
              <span className="hidden md:inline">Ver todas as fotos</span>
              <span className="md:hidden">1/{property.images.length}</span>
            </button>
          </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          
          {/* --- COLUNA ESQUERDA (Info) --- */}
          <div className="lg:col-span-8 space-y-12">
            
            {/* Cards de Métricas (Design Clean) */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 border-b border-slate-200 dark:border-slate-700 pb-8">
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Icons.Maximize size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.area} m²</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Área Útil</span>
                  </div>
                </div>
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Icons.Bed size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.bedrooms}</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Quartos</span>
                  </div>
                </div>
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Icons.Bath size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.bathrooms}</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Banheiros</span>
                  </div>
                </div>
                <div className="px-4 md:px-6 py-4 bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-200 dark:border-slate-700 flex items-center gap-3">
                  <Icons.Car size={24} className="text-slate-400" />
                  <div>
                    <span className="block text-xl font-bold text-slate-900 dark:text-white">{property.garage}</span>
                    <span className="text-xs text-slate-500 font-medium uppercase">Vagas</span>
                  </div>
                </div>
            </div>

            {/* Descrição */}
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">Sobre o imóvel</h2>
              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-lg whitespace-pre-line font-light">
                {property.description}
              </p>
            </div>

            {/* Features (Pills Style) */}
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-6">Comodidades</h2>
              <div className="flex flex-wrap gap-3">
                {property.features.map((feature, index) => (
                  <span key={index} className="flex items-center gap-2 text-slate-700 dark:text-slate-300 bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 px-5 py-3 rounded-full text-sm font-medium">
                    <Icons.CheckCircle size={16} className="text-slate-900 dark:text-white" />
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            {/* Mapa */}
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
                  title="Mapa de Localização"
                  width="100%"
                  height="100%"
                  frameBorder="0"
                  src={mapUrl}
                  className="grayscale hover:grayscale-0 transition-all duration-500"
                />
              )}
            </div>
          </div>

          {/* --- COLUNA DIREITA (Sticky Sidebar) --- */}
          <div className="lg:col-span-4 mt-8 md:mt-12 lg:mt-0">
            <div className="lg:sticky lg:top-8">
              
              {/* Card Principal */}
              <div className="bg-white dark:bg-slate-800 p-6 md:p-8 rounded-[2rem] shadow-2xl border border-slate-200 dark:border-slate-700">
                {/* Preço (Dinâmico para Aluguel/Venda) */}
                <div className="mb-8">
                    <p className="text-sm text-slate-500 font-medium uppercase tracking-wide mb-1">
                      {isRent ? 'Aluguel' : 'Preço de Venda'}
                    </p>
                    <h2 className="text-4xl font-bold text-slate-900 dark:text-white flex items-baseline gap-1">
                        {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: 0 }).format(property.price)}
                        {isRent && <span className="text-xl text-slate-500 font-medium">/mês</span>}
                    </h2>

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

                <hr className="border-slate-300 dark:border-slate-700 my-4" />

                {/* Formulário Embutido */}
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
                          contactIntent === 'contato' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        Solicitar Contato
                      </button>
                      <button
                        type="button"
                        onClick={() => setContactIntent('visita')}
                        className={`flex-1 py-2 text-xs sm:text-sm font-bold rounded-lg transition-all ${
                          contactIntent === 'visita' ? 'bg-white text-brand-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                        }`}
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
                          onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
                        />
                        <input
                          type="tel"
                          required
                          placeholder="Seu WhatsApp"
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 outline-none"
                          value={contactForm.phone}
                          onChange={e => setContactForm({ ...contactForm, phone: e.target.value })}
                        />
                        <input
                          type="email"
                          placeholder="Seu e-mail (opcional)"
                          className="w-full px-4 py-3 rounded-xl bg-slate-50 border-none focus:ring-2 focus:ring-brand-500 outline-none"
                          value={contactForm.email}
                          onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
                        />

                        <button
                          type="submit"
                          disabled={formStatus === 'sending'}
                          className="w-full bg-slate-900 hover:bg-brand-600 text-white font-bold py-4 rounded-xl transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2 mt-2"
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
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Icons } from '../../../components/Icons';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import { Property } from '../../../types';
import { MapPin, Search, Sliders, Bed, Bath, Maximize2, ArrowRight, Loader2 } from 'lucide-react';

const Home: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [searchLocation, setSearchLocation] = useState('');
  const [propertyType, setPropertyType] = useState('');
  const [priceRange, setPriceRange] = useState('');
  const [bedrooms, setBedrooms] = useState('');
  const [featuredProperties, setFeaturedProperties] = useState<Property[]>([]);
  const [isLoadingProperties, setIsLoadingProperties] = useState(true);

  // Dados do site_data
  const siteData = tenant?.site_data;
  const heroImageUrl = siteData?.hero_image_url;
  const heroTitle = siteData?.hero_title || 'Imóveis para moradia e investimentos';
  const primaryColor = siteData?.primary_color || '#1e293b';
  const secondaryColor = siteData?.secondary_color || '#3b82f6';

  // Buscar imóveis em destaque
  useEffect(() => {
    const fetchFeaturedProperties = async () => {
      if (!tenant?.id) return;

      setIsLoadingProperties(true);
      
      const { data, error } = await supabase
        .from('properties')
        .select('*')
        .eq('company_id', tenant.id)
        .eq('featured', true)
        .neq('status', 'Vendido')
        .neq('status', 'Alugado')
        .order('created_at', { ascending: false })
        .limit(6);

      if (error) {
        console.error('Erro ao buscar imóveis em destaque:', error);
      } else if (data) {
        const mappedProperties = data.map(prop => ({
          ...prop,
          location: {
            city: prop.city || '',
            neighborhood: prop.neighborhood || '',
            state: prop.state || '',
            address: prop.address,
            zip_code: prop.zip_code,
          }
        }));
        setFeaturedProperties(mappedProperties);
      }

      setIsLoadingProperties(false);
    };

    fetchFeaturedProperties();
  }, [tenant?.id]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (searchLocation) params.set('search', searchLocation);
    if (propertyType) params.set('type', propertyType);
    if (priceRange) params.set('price', priceRange);
    if (bedrooms) params.set('bedrooms', bedrooms);
    
    const query = params.toString();
    navigate(query ? `/imoveis?${query}` : '/imoveis');
  };

  return (
    <div className="bg-white">
      
      {/* Hero Section */}
      <section 
        className="relative bg-gray-900 overflow-hidden min-h-screen flex items-center"
        style={{
          backgroundImage: heroImageUrl ? `url(${heroImageUrl})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* Overlay */}
        <div className="absolute inset-0 bg-gradient-to-br from-gray-900/80 to-gray-900/60"></div>

        {/* Content */}
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 md:py-40 w-full">
          <div className="max-w-3xl">
            <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold text-white mb-6 leading-tight">
              {heroTitle}
            </h1>
            
            {/* Search Bar Horizontal */}
            <form onSubmit={handleSearch} className="bg-white rounded-2xl shadow-2xl p-2">
              <div className="flex flex-col md:flex-row md:items-center md:divide-x divide-gray-200">
                
                {/* Location */}
                <div className="flex-1 px-4 py-3">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Localização</label>
                  <div className="flex items-center">
                    <MapPin size={18} className="text-gray-400 mr-2" />
                    <input
                      type="text"
                      value={searchLocation}
                      onChange={(e) => setSearchLocation(e.target.value)}
                      placeholder="Cidade ou bairro"
                      className="w-full text-sm font-medium text-gray-900 placeholder:text-gray-400 outline-none bg-transparent"
                    />
                  </div>
                </div>

                {/* Property Type */}
                <div className="flex-1 px-4 py-3 border-t md:border-t-0 border-gray-100">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo de imóvel</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value)}
                    className="w-full text-sm font-medium text-gray-900 outline-none bg-transparent"
                  >
                    <option value="">Todos os tipos</option>
                    <option value="Casa">Casas</option>
                    <option value="Apartamento">Apartamentos</option>
                    <option value="Cobertura">Coberturas</option>
                    <option value="Comercial">Comercial</option>
                  </select>
                </div>

                {/* Price */}
                <div className="flex-1 px-4 py-3 border-t md:border-t-0 border-gray-100">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Preço</label>
                  <select
                    value={priceRange}
                    onChange={(e) => setPriceRange(e.target.value)}
                    className="w-full text-sm font-medium text-gray-900 outline-none bg-transparent"
                  >
                    <option value="">Qualquer valor</option>
                    <option value="0-500000">Até R$ 500 mil</option>
                    <option value="500000-1000000">R$ 500 mil - R$ 1 milhão</option>
                    <option value="1000000-2000000">R$ 1 milhão - R$ 2 milhões</option>
                    <option value="2000000+">Acima de R$ 2 milhões</option>
                  </select>
                </div>

                {/* Bedrooms */}
                <div className="flex-1 px-4 py-3 border-t md:border-t-0 border-gray-100">
                  <label className="block text-xs font-semibold text-gray-500 mb-1">Quartos</label>
                  <select
                    value={bedrooms}
                    onChange={(e) => setBedrooms(e.target.value)}
                    className="w-full text-sm font-medium text-gray-900 outline-none bg-transparent"
                  >
                    <option value="">Qualquer</option>
                    <option value="1">1+</option>
                    <option value="2">2+</option>
                    <option value="3">3+</option>
                    <option value="4">4+</option>
                    <option value="5">5+</option>
                  </select>
                </div>

                {/* More Filters & Search Button */}
                <div className="flex items-center gap-2 px-2 py-2 border-t md:border-t-0 border-gray-100">
                  <button
                    type="button"
                    className="flex items-center justify-center w-12 h-12 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                  >
                    <Sliders size={20} className="text-gray-700" />
                  </button>
                  <button
                    type="submit"
                    className="flex items-center justify-center px-8 h-12 rounded-xl text-white font-semibold transition-all hover:opacity-90"
                    style={{ backgroundColor: primaryColor }}
                  >
                    <Search size={20} className="mr-2" />
                    Buscar
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      </section>

      {/* Latest in your area - Grid de Imóveis */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Destaques da região
            </h2>
            <button
              onClick={() => navigate('/imoveis')}
              className="text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-2 transition-colors"
            >
              Ver todos
              <ArrowRight size={16} />
            </button>
          </div>

          {isLoadingProperties ? (
            <div className="flex justify-center items-center py-20">
              <Loader2 className="animate-spin text-gray-400" size={48} />
            </div>
          ) : featuredProperties.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {featuredProperties.map((property) => (
                <div 
                  key={property.id}
                  onClick={() => navigate(`/imovel/${property.slug}`)}
                  className="group cursor-pointer"
                >
                  {/* Image Container */}
                  <div className="relative aspect-[4/3] rounded-2xl overflow-hidden mb-4 bg-gray-100">
                    <img
                      src={property.images?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'}
                      alt={property.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {/* Bookmark Icon */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                      }}
                      className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm flex items-center justify-center hover:bg-white transition-colors shadow-lg"
                    >
                      <Icons.Heart size={18} className="text-gray-700" />
                    </button>
                  </div>

                  {/* Property Info */}
                  <div>
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="text-2xl font-bold text-gray-900">
                          {new Intl.NumberFormat('pt-BR', {
                            style: 'currency',
                            currency: 'BRL',
                            minimumFractionDigits: 0,
                          }).format(property.price)}
                        </p>
                      </div>
                    </div>

                    {/* Specs */}
                    <div className="flex items-center gap-4 text-sm text-gray-600 mb-3">
                      <span className="flex items-center gap-1">
                        <Bed size={16} />
                        {property.bedrooms} quartos
                      </span>
                      <span className="flex items-center gap-1">
                        <Bath size={16} />
                        {property.bathrooms} banheiros
                      </span>
                      <span className="flex items-center gap-1">
                        <Maximize2 size={16} />
                        {property.area} m²
                      </span>
                    </div>

                    {/* Address */}
                    <p className="text-sm text-gray-600 line-clamp-1">
                      {property.location.address || `${property.location.neighborhood}, ${property.location.city}, ${property.location.state}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20">
              <Icons.Home className="mx-auto text-gray-300 mb-4" size={64} />
              <p className="text-gray-500 text-lg">
                Nenhum imóvel em destaque no momento.
              </p>
            </div>
          )}
        </div>
      </section>

      {/* You might be interested in */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900">
              Você pode se interessar
            </h2>
            <button
              onClick={() => navigate('/imoveis')}
              className="text-sm font-semibold text-gray-700 hover:text-gray-900 flex items-center gap-2 transition-colors"
            >
              Ver todos
              <ArrowRight size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {featuredProperties.slice(0, 2).map((property) => (
              <div 
                key={property.id}
                onClick={() => navigate(`/imovel/${property.slug}`)}
                className="group cursor-pointer"
              >
                <div className="relative aspect-[16/10] rounded-2xl overflow-hidden mb-4 bg-gray-100">
                  <img
                    src={property.images?.[0] || 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=800'}
                    alt={property.title}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                </div>
                <div>
                  <p className="text-2xl font-bold text-gray-900 mb-2">
                    {new Intl.NumberFormat('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                      minimumFractionDigits: 0,
                    }).format(property.price)}
                  </p>
                  <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                    <span>{property.bedrooms} quartos</span>
                    <span>{property.bathrooms} banheiros</span>
                    <span>{property.area} m²</span>
                  </div>
                  <p className="text-sm text-gray-600">
                    {property.location.address || `${property.location.neighborhood}, ${property.location.city}`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
};

export default Home;

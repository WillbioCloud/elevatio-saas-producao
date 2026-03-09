import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import { useTenant } from '../../../contexts/TenantContext';
import { Icons } from '../../../components/Icons';
import { ListingType, Property, PropertyType } from '../../../types';
import { Bed, Bath, Maximize2, MapPin, Loader2, Star } from 'lucide-react';

const Properties: React.FC = () => {
  const navigate = useNavigate();
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

  const siteData = tenant?.site_data;
  const primaryColor = siteData?.primary_color || '#1e293b';
  const secondaryColor = siteData?.secondary_color || '#3b82f6';

  const currentCity = searchParams.get('city') || '';
  const currentNeighborhood = searchParams.get('neighborhood') || '';
  const currentType = searchParams.get('type') || '';
  const currentFeatured = searchParams.get('featured') === 'true';
  const listingType = (searchParams.get('listingType') as ListingType) || 'sale';

  useEffect(() => {
    if (searchParams.get('listingType')) return;

    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('listingType', 'sale');
    setSearchParams(nextParams, { replace: true });
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    let isMounted = true;
    const controller = new AbortController();

    async function fetchProperties() {
      if (!tenant?.id) return;
      
      setLoading(true);
      
      try {
        let query = supabase
          .from('properties')
          .select('*, profiles(name, phone, email)')
          .eq('company_id', tenant.id)
          .abortSignal(controller.signal);

        if (currentCity) query = query.ilike('city', `%${currentCity}%`);
        if (currentNeighborhood) query = query.ilike('neighborhood', `%${currentNeighborhood}%`);
        if (currentType) query = query.eq('type', currentType);
        if (currentFeatured) query = query.eq('featured', true);
        query = query.eq('listing_type', listingType);

        if (listingType === 'sale') {
          query = query.not('status', 'eq', 'Vendido');
        }

        const { data, error } = await query;

        if (!isMounted) return;

        if (error) throw error;

        if (data) {
          const mappedData: Property[] = data.map((item: any) => ({
            ...item,
            location: {
              city: item.city || '',
              neighborhood: item.neighborhood || '',
              state: item.state || '',
              address: item.address || ''
            },
            agent: Array.isArray(item.profiles) ? item.profiles[0] : item.profiles,
            features: item.features || [],
            images: item.images || []
          }));
          
          setProperties(mappedData);
        }
      } catch (err: any) {
        const isAbort = err.name === 'AbortError' || err.message?.includes('AbortError');
        if (isMounted && !isAbort) {
          console.error('Erro na busca de imóveis:', err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    fetchProperties();

    return () => { 
      isMounted = false; 
      controller.abort();
    };
  }, [currentCity, currentNeighborhood, currentType, currentFeatured, listingType, tenant?.id]);

  const cities = useMemo(
    () => Array.from(new Set(properties.map((property) => property.location.city).filter(Boolean))).sort(),
    [properties]
  );

  const neighborhoods = useMemo(
    () =>
      Array.from(
        new Set(
          properties
            .filter((property) => !currentCity || property.location.city === currentCity)
            .map((property) => property.location.neighborhood)
            .filter(Boolean)
        )
      ).sort(),
    [properties, currentCity]
  );

  const handleFilterChange = (key: string, value: string) => {
    const nextParams = new URLSearchParams(searchParams);
    if (value) nextParams.set(key, value);
    else nextParams.delete(key);

    if (key === 'city') nextParams.delete('neighborhood');

    setSearchParams(nextParams);
  };

  const handleListingTypeChange = (value: ListingType) => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set('listingType', value);
    setSearchParams(nextParams);
  };

  return (
    <div className="bg-gray-50 min-h-screen py-12 md:py-20 animate-fade-in">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        <div className="flex flex-col gap-6 mb-10 md:mb-12">

          {/* Linha 1: Título e Botões Rápidos */}
          <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-2">Imóveis Exclusivos</h1>
              <p className="text-gray-600 text-sm md:text-base">Encontre o lar dos seus sonhos em nossa seleção premium.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Toggle Comprar/Alugar */}
              <div className="bg-white rounded-full p-1 shadow-sm border border-gray-200 flex gap-1 w-full sm:w-fit">
                {[
                  { value: 'sale', label: 'Comprar' },
                  { value: 'rent', label: 'Alugar' }
                ].map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => handleListingTypeChange(option.value as ListingType)}
                    className={`flex-1 sm:flex-none px-6 py-2.5 rounded-full text-sm font-semibold transition-all ${
                      listingType === option.value
                        ? 'text-white shadow'
                        : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                    }`}
                    style={{
                      backgroundColor: listingType === option.value ? primaryColor : 'transparent'
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Botão Destaques */}
              <label className="flex items-center justify-center gap-2 text-sm font-bold text-gray-600 cursor-pointer bg-white px-5 py-3 sm:py-2.5 rounded-full border border-gray-200 hover:bg-gray-50 transition-colors shadow-sm select-none w-full sm:w-auto">
                <Star className={currentFeatured ? "text-yellow-400 fill-yellow-400" : "text-gray-400"} size={18} />
                <input
                  type="checkbox"
                  checked={currentFeatured}
                  onChange={e => handleFilterChange('featured', e.target.checked ? 'true' : '')}
                  className="hidden"
                />
                Apenas Destaques
              </label>
            </div>
          </div>

          {/* Linha 2: Barra de Pesquisa Full Width */}
          <div className="w-full bg-white rounded-2xl p-2 md:p-3 shadow-md border border-gray-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-0 md:divide-x md:divide-gray-100">
              <div className="px-2 md:px-4 py-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Cidade</label>
                <select
                  className="w-full py-2.5 md:py-1 text-sm md:text-base rounded-xl md:rounded-none border border-gray-200 md:border-none focus:ring-2 md:focus:ring-0 outline-none bg-white cursor-pointer"
                  style={{ focusRingColor: primaryColor }}
                  value={currentCity}
                  onChange={e => handleFilterChange('city', e.target.value)}
                >
                  <option value="">Todas as cidades</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="px-2 md:px-4 py-1 border-t md:border-t-0 border-gray-100 mt-2 md:mt-0 pt-3 md:pt-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bairro</label>
                <select
                  className="w-full py-2.5 md:py-1 text-sm md:text-base rounded-xl md:rounded-none border border-gray-200 md:border-none focus:ring-2 md:focus:ring-0 outline-none bg-white cursor-pointer"
                  value={currentNeighborhood}
                  onChange={e => handleFilterChange('neighborhood', e.target.value)}
                >
                  <option value="">Todos os bairros</option>
                  {neighborhoods.map((neighborhood) => (
                    <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                  ))}
                </select>
              </div>

              <div className="px-2 md:px-4 py-1 border-t md:border-t-0 border-gray-100 mt-2 md:mt-0 pt-3 md:pt-1">
                <label className="block text-xs font-semibold text-gray-500 mb-1">Tipo</label>
                <select
                  className="w-full py-2.5 md:py-1 text-sm md:text-base rounded-xl md:rounded-none border border-gray-200 md:border-none focus:ring-2 md:focus:ring-0 outline-none bg-white cursor-pointer"
                  value={currentType}
                  onChange={e => handleFilterChange('type', e.target.value)}
                >
                  <option value="">Todos os Tipos</option>
                  {Object.values(PropertyType).map(t => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20">
            <Loader2 className="animate-spin text-gray-400" size={48} />
          </div>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {properties.map(property => (
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
                  {/* Badge Venda/Aluguel */}
                  <div 
                    className="absolute top-4 left-4 text-white font-bold text-xs px-4 py-2 rounded-full shadow-lg"
                    style={{ backgroundColor: property.listing_type === 'sale' ? primaryColor : secondaryColor }}
                  >
                    {property.listing_type === 'sale' ? 'Venda' : 'Aluguel'}
                  </div>
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
          <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-dashed border-gray-300">
            <Icons.Search className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-gray-700">
              {listingType === 'rent' ? 'Nenhum imóvel para aluguel encontrado neste local' : 'Nenhum imóvel encontrado'}
            </h3>
            <p className="text-gray-500">Tente ajustar os filtros ou verificar a conexão.</p>
            <button 
              onClick={() => setSearchParams({ listingType })} 
              className="mt-4 font-bold hover:underline"
              style={{ color: primaryColor }}
            >
              Limpar Filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;

import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { supabase } from '../../../lib/supabase';
import PropertyCard from '../../../components/PropertyCard';
import { Icons } from '../../../components/Icons';
import { ListingType, Property, PropertyType } from '../../../types';

const Properties: React.FC = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);

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
      setLoading(true);
      
      try {
        let query = supabase
          .from('properties')
          .select('*, profiles(name, phone, email)')
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
  }, [currentCity, currentNeighborhood, currentType, currentFeatured, listingType]);

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
      <div className="container mx-auto px-4">
        
        <div className="flex flex-col gap-6 mb-10 md:mb-12">

          {/* Linha 1: Título e Botões Rápidos */}
          <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-800 mb-2">Imóveis Exclusivos</h1>
              <p className="text-slate-500 text-sm md:text-base">Encontre o lar dos seus sonhos em nossa seleção premium.</p>
            </div>

            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 w-full lg:w-auto">
              {/* Toggle Comprar/Alugar */}
              <div className="bg-white rounded-full p-1 shadow-sm border border-slate-200 flex gap-1 w-full sm:w-fit">
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
                        ? 'bg-slate-900 text-white shadow'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    {option.label}
                  </button>
                ))}
              </div>

              {/* Botão Destaques */}
              <label className="flex items-center justify-center gap-2 text-sm font-bold text-slate-600 cursor-pointer bg-white px-5 py-3 sm:py-2.5 rounded-full border border-slate-200 hover:bg-slate-50 transition-colors shadow-sm select-none w-full sm:w-auto">
                <Icons.Star className={currentFeatured ? "text-yellow-400 fill-yellow-400" : "text-slate-400"} size={18} />
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
          <div className="w-full bg-white rounded-3xl md:rounded-full p-2 md:p-3 shadow-md border border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-2 md:gap-0 md:divide-x md:divide-slate-100">
              <div className="px-2 md:px-4 py-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Cidade</label>
                <select
                  className="w-full py-2.5 md:py-1 text-sm md:text-base rounded-xl md:rounded-none border border-slate-200 md:border-none focus:ring-2 md:focus:ring-0 focus:ring-brand-500 outline-none bg-white cursor-pointer"
                  value={currentCity}
                  onChange={e => handleFilterChange('city', e.target.value)}
                >
                  <option value="">Todas as cidades</option>
                  {cities.map((city) => (
                    <option key={city} value={city}>{city}</option>
                  ))}
                </select>
              </div>

              <div className="px-2 md:px-4 py-1 border-t md:border-t-0 border-slate-100 mt-2 md:mt-0 pt-3 md:pt-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Bairro</label>
                <select
                  className="w-full py-2.5 md:py-1 text-sm md:text-base rounded-xl md:rounded-none border border-slate-200 md:border-none focus:ring-2 md:focus:ring-0 focus:ring-brand-500 outline-none bg-white cursor-pointer"
                  value={currentNeighborhood}
                  onChange={e => handleFilterChange('neighborhood', e.target.value)}
                >
                  <option value="">Todos os bairros</option>
                  {neighborhoods.map((neighborhood) => (
                    <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                  ))}
                </select>
              </div>

              <div className="px-2 md:px-4 py-1 border-t md:border-t-0 border-slate-100 mt-2 md:mt-0 pt-3 md:pt-1">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1 block">Tipo</label>
                <select
                  className="w-full py-2.5 md:py-1 text-sm md:text-base rounded-xl md:rounded-none border border-slate-200 md:border-none focus:ring-2 md:focus:ring-0 focus:ring-brand-500 outline-none bg-white cursor-pointer"
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[1,2,3].map(i => (
              <div key={i} className="h-96 bg-gray-200 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : properties.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {properties.map(property => (
              <PropertyCard key={property.id} property={property} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
            <Icons.Search className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-gray-700">
              {listingType === 'rent' ? 'Nenhum imóvel para aluguel encontrado neste local' : 'Nenhum imóvel encontrado'}
            </h3>
            <p className="text-gray-500">Tente ajustar os filtros ou verificar a conexão.</p>
            <button onClick={() => setSearchParams({ listingType })} className="mt-4 text-brand-600 font-bold hover:underline">
              Limpar Filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;
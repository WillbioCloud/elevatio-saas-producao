import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { Icons } from '../../../components/Icons';
import { supabase } from '../../../lib/supabase';
import { ListingType, Property, PropertyType, type SiteData } from '../../../types';
import CondominiumCard from '../components/CondominiumCard';
import PropertyCard from '../components/PropertyCard';
import { getPrimaryColor } from '../tenantUtils';

const ITEMS_PER_PAGE = 15;

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

const Properties: React.FC = () => {
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const currentCity = searchParams.get('city') || '';
  const currentNeighborhood = searchParams.get('neighborhood') || '';
  const currentType = searchParams.get('type') || '';
  const currentFeatured = searchParams.get('featured') === 'true';
  const listingType = (searchParams.get('listingType') as ListingType) || 'sale';
  const siteData = useMemo(() => parseSiteData(tenant?.site_data), [tenant?.site_data]);
  const searchQuery = searchParams.get('q') || '';
  const primaryColor = getPrimaryColor(tenant) || '#0ea5e9';
  const condominiumsList = siteData?.condominiums || [];
  
  // Verifica se o texto da busca (q) é exatamente o nome de algum condomínio no banco geral
  const matchedCondominium = searchQuery 
    ? condominiumsList.find((c: any) => c.name.toLowerCase() === searchQuery.toLowerCase())
    : null;

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
      if (!tenant?.id) {
        if (isMounted) setLoading(false);
        return;
      }

      setLoading(true);
      
      try {
        let query = supabase
          .from('properties')
          .select('*, profiles(name, phone, email)')
          .eq('company_id', tenant.id)
          .eq('has_intermediation_signed', true)
          .abortSignal(controller.signal);

        if (currentCity) query = query.ilike('city', `%${currentCity}%`);
        if (currentNeighborhood) query = query.ilike('neighborhood', `%${currentNeighborhood}%`);
        if (currentType) query = query.eq('type', currentType);
        if (currentFeatured) query = query.eq('featured', true);
        if (searchQuery) {
          query = query.or(`neighborhood.ilike.%${searchQuery}%,title.ilike.%${searchQuery}%,city.ilike.%${searchQuery}%`);
        }
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
  }, [currentCity, currentNeighborhood, currentType, currentFeatured, listingType, searchQuery, tenant?.id]);

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

  const filteredProperties = properties;
  const paginatedProperties = filteredProperties.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );
  const totalPages = Math.ceil(filteredProperties.length / ITEMS_PER_PAGE);

  useEffect(() => {
    setCurrentPage(1);
  }, [currentCity, currentNeighborhood, currentType, currentFeatured, listingType, searchQuery]);

  useEffect(() => {
    // Se não houver páginas (ex: carregando ou sem resultados), trava na página 1
    if (totalPages === 0) {
      if (currentPage !== 1) setCurrentPage(1);
      return;
    }

    // Só reajusta se houver páginas e a atual for maior que o limite
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const paginationItems = useMemo<(number | string)[]>(() => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }

    if (currentPage <= 4) {
      return [1, 2, 3, 4, 5, 'end-ellipsis', totalPages];
    }

    if (currentPage >= totalPages - 3) {
      return [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages];
    }

    return [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];
  }, [currentPage, totalPages]);

  return (
    <div className="bg-gray-50 min-h-screen py-12 md:py-20 animate-fade-in">
      <div className="container mx-auto px-4">
        {/* Card Dinâmico do Condomínio (Se a busca for por um condomínio) */}
        {matchedCondominium && (
          <CondominiumCard 
            condominium={matchedCondominium} 
            primaryColor={primaryColor} 
          />
        )}
        
        <div className="flex flex-col gap-6 mb-10 md:mb-12">

          {/* Linha 1: Título e Botões Rápidos */}
          <div className="flex flex-col lg:flex-row justify-between lg:items-end gap-6">
            <div>
              <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-800 mb-2">Imóveis Exclusivos</h1>
              {searchQuery ? (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm md:text-base text-brand-600 dark:text-brand-400 font-medium bg-brand-50 dark:bg-brand-900/20 px-3 py-1 rounded-full border border-brand-100 dark:border-brand-800">
                    Buscando por: <strong className="font-bold">{searchQuery}</strong>
                  </span>
                  <button
                    onClick={() => handleFilterChange('q', '')}
                    className="text-sm text-slate-500 hover:text-red-500 font-medium transition-colors underline"
                  >
                    Limpar
                  </button>
                </div>
              ) : (
                <p className="text-slate-500 text-sm md:text-base mt-2">Encontre o lar dos seus sonhos em nossa seleção premium.</p>
              )}
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
                        ? 'text-white shadow'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                    style={listingType === option.value ? { backgroundColor: primaryColor } : undefined}
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
        ) : filteredProperties.length > 0 ? (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {paginatedProperties.map(property => (
                <PropertyCard key={property.id} property={property} />
              ))}
            </div>

            {totalPages > 1 && (
              <div className="mt-10 flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Anterior
                </button>

                {paginationItems.map((item, index) =>
                  typeof item === 'string' ? (
                    <span
                      key={`${item}-${index}`}
                      className="flex h-10 min-w-10 items-center justify-center px-1 text-sm font-semibold text-slate-400"
                    >
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      type="button"
                      onClick={() => handlePageChange(item)}
                      className={`flex h-10 min-w-10 items-center justify-center rounded-full border text-sm font-semibold transition ${
                        currentPage === item
                          ? 'border-transparent text-white shadow'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900'
                      }`}
                      style={currentPage === item ? { backgroundColor: primaryColor } : undefined}
                    >
                      {item}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 shadow-sm transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Próximo
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20 bg-white rounded-xl shadow-sm border border-dashed border-gray-300">
            <Icons.Search className="mx-auto text-gray-300 mb-4" size={48} />
            <h3 className="text-xl font-bold text-gray-700">
              {listingType === 'rent' ? 'Nenhum imóvel para aluguel encontrado neste local' : 'Nenhum imóvel encontrado'}
            </h3>
            <p className="text-gray-500">Tente ajustar os filtros ou verificar a conexão.</p>
            <button onClick={() => setSearchParams({ listingType })} className="mt-4 font-bold hover:underline" style={{ color: primaryColor }}>
              Limpar Filtros
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Properties;

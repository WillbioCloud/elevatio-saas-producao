import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import { Property } from '../../../types';
import PropertyCard from '../components/PropertyCard';
import Loading from '../../../components/Loading';
import { Search, Filter, X, LayoutGrid, List, ChevronLeft, ChevronRight } from 'lucide-react';

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

export default function Properties() {
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const siteData = React.useMemo(() => {
    if (typeof tenant?.site_data === 'string') {
      try {
        return JSON.parse(tenant.site_data);
      } catch {
        return {};
      }
    }
    return tenant?.site_data || {};
  }, [tenant?.site_data]);
  const pageTitle = siteData?.properties_title || siteData?.catalog_title || 'Imóveis Disponíveis';
  const pageSubtitle = siteData?.properties_subtitle || siteData?.catalog_subtitle || 'Encontre o imóvel ideal para seu estilo de vida.';

  // Filters State
  const [searchQuery, setSearchQuery] = useState(searchParams.get('q') || '');
  const [selectedType, setSelectedType] = useState(searchParams.get('type') || '');
  const [listingType, setListingType] = useState(searchParams.get('listingType') || 'sale');
  const [bedrooms, setBedrooms] = useState(searchParams.get('bedrooms') || '');
  const [bathrooms, setBathrooms] = useState(searchParams.get('bathrooms') || '');
  const [garage, setGarage] = useState(searchParams.get('garage') || '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') || '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') || '');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const ITEMS_PER_PAGE = 6;

  useEffect(() => {
    setSearchQuery(searchParams.get('q') || '');
    setSelectedType(searchParams.get('type') || '');
    setListingType(searchParams.get('listingType') || 'sale');
    setBedrooms(searchParams.get('bedrooms') || '');
    setBathrooms(searchParams.get('bathrooms') || '');
    setGarage(searchParams.get('garage') || '');
    setMinPrice(searchParams.get('minPrice') || '');
    setMaxPrice(searchParams.get('maxPrice') || '');
  }, [searchParams]);

  // Trigger re-fetch when params change
  useEffect(() => {
    let isMounted = true;
    const fetchProperties = async () => {
      if (!tenant?.id) {
        if (isMounted) setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const currentSearchQuery = searchParams.get('q') || '';
        const currentSelectedType = searchParams.get('type') || '';
        const currentListingType = searchParams.get('listingType') || 'sale';
        const currentBedrooms = searchParams.get('bedrooms') || '';
        const currentBathrooms = searchParams.get('bathrooms') || '';
        const currentGarage = searchParams.get('garage') || '';
        const currentMinPrice = searchParams.get('minPrice') || '';
        const currentMaxPrice = searchParams.get('maxPrice') || '';
        let query = supabase
          .from('properties')
          .select('*, profiles(name, phone, email)', { count: 'exact' })
          .eq('company_id', tenant.id)
          .neq('status', 'Vendido')
          .neq('status', 'Alugado')
          .eq('has_intermediation_signed', true)
          .eq('listing_type', currentListingType)
          .order('created_at', { ascending: false });

        if (currentSearchQuery) {
          query = query.ilike('title', `%${currentSearchQuery}%`); // Simplification for mock
        }
        if (currentSelectedType) {
          query = query.eq('type', currentSelectedType);
        }
        if (currentBedrooms) {
          query = query.eq('bedrooms', parseInt(currentBedrooms));
        }
        if (currentBathrooms) {
           query = query.eq('bathrooms', parseInt(currentBathrooms));
        }
        if (currentGarage) {
           query = query.eq('garage', parseInt(currentGarage));
        }
        if (currentMinPrice) {
           query = query.gte('price', parseInt(currentMinPrice.replace(/\D/g, '')));
        }
        if (currentMaxPrice) {
           query = query.lte('price', parseInt(currentMaxPrice.replace(/\D/g, '')));
        }

        const from = (page - 1) * ITEMS_PER_PAGE;
        const to = from + ITEMS_PER_PAGE - 1;
        query = query.range(from, to);

        const { data, error, count } = await query;

        if (error) throw error;

        if (isMounted && count !== null) setTotalPages(Math.ceil(count / ITEMS_PER_PAGE));

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
          setProperties(mapped);
        }
      } catch (error) {
        console.error('Erro ao buscar imóveis:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchProperties();
    return () => { isMounted = false; };
  }, [tenant, searchParams, page]);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', searchQuery);
    if (selectedType) params.set('type', selectedType);
    if (listingType) params.set('listingType', listingType);
    if (bedrooms) params.set('bedrooms', bedrooms);
    if (bathrooms) params.set('bathrooms', bathrooms);
    if (garage) params.set('garage', garage);
    if (minPrice) params.set('minPrice', minPrice);
    if (maxPrice) params.set('maxPrice', maxPrice);
    setPage(1);
    setSearchParams(params);
  };

  const clearFilters = () => {
    setSearchQuery('');
    setSelectedType('');
    setListingType('sale');
    setBedrooms('');
    setBathrooms('');
    setGarage('');
    setMinPrice('');
    setMaxPrice('');
    setPage(1);
    setSearchParams(new URLSearchParams());
  };

  return (
    <div className="animate-fade-in bg-[#fcfcfc] min-h-screen pt-4 md:pt-8 pb-16">
      <div className="max-w-[1024px] mx-auto px-4 md:px-8">
        
        {/* Header / Title */}
        <div className="mb-6 md:mb-8">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-2">Search Catalog</span>
          <h1 className="text-3xl md:text-4xl font-light tracking-tight text-slate-900">
            {pageTitle}
          </h1>
          <p className="text-sm text-slate-500 mt-2">
            {pageSubtitle}
          </p>
        </div>

        {/* Responsive Grid Layout: Sidebar Filters + Main Results */}
        <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-6 md:gap-8">
          
          {/* Floating Filters Card */}
          <div className="h-fit lg:sticky lg:top-28 bg-white border border-slate-100 rounded-[2rem] p-5 md:p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] flex flex-col gap-4 md:gap-5">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="w-4 h-4 text-slate-400" />
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Filtros</span>
            </div>

            {/* Keyword Search */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">Busca livre</label>
              <div className="w-full bg-slate-50 p-3 rounded-xl flex items-center gap-2 border border-slate-100 focus-within:border-slate-300 transition-colors">
                <Search className="w-4 h-4 text-slate-400 shrink-0" />
                <input 
                  type="text" 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Bairro, cidade, ref..." 
                  className="w-full bg-transparent outline-none text-sm font-medium placeholder:text-slate-400 text-slate-700" 
                />
              </div>
            </div>
            
            {/* Property Type */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">Tipo de Imóvel</label>
              <select 
                value={selectedType}
                onChange={(e) => setSelectedType(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-sm font-medium text-slate-700 cursor-pointer focus:border-slate-300 transition-colors"
              >
                <option value="">Todos os tipos</option>
                <option value="Casa">Casa</option>
                <option value="Apartamento">Apartamento</option>
                <option value="Cobertura">Cobertura</option>
                <option value="Terreno">Terreno</option>
              </select>
            </div>

            {/* Listing Type */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">Negócio</label>
               <select 
                  value={listingType}
                  onChange={(e) => setListingType(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-sm font-medium text-slate-700 cursor-pointer focus:border-slate-300 transition-colors"
                >
                  <option value="sale">Comprar</option>
                  <option value="rent">Alugar</option>
                </select>
            </div>

            {/* Layout Options (Bedrooms, Bathrooms, Garage) */}
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Quartos</label>
                <select 
                  value={bedrooms}
                  onChange={(e) => setBedrooms(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                >
                  <option value="">Qts</option>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Banhos</label>
                <select 
                  value={bathrooms}
                  onChange={(e) => setBathrooms(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                >
                  <option value="">Ban</option>
                  {[1, 2, 3, 4, 5].map(n => <option key={n} value={n}>{n}+</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-500 block mb-1">Vagas</label>
                <select 
                  value={garage}
                  onChange={(e) => setGarage(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-lg p-2 outline-none text-sm font-medium text-slate-700 cursor-pointer"
                >
                  <option value="">Vag</option>
                  {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}+</option>)}
                </select>
              </div>
            </div>

            {/* Price Range */}
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-2">Faixa de Preço (R$)</label>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  placeholder="Mínimo"
                  value={minPrice}
                  onChange={(e) => setMinPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-slate-300 transition-colors"
                />
                <span className="text-slate-400 text-sm">-</span>
                <input
                  type="number"
                  placeholder="Máximo"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(e.target.value)}
                  className="w-full bg-slate-50 border border-slate-100 rounded-xl p-3 outline-none text-sm font-medium text-slate-700 placeholder:text-slate-400 focus:border-slate-300 transition-colors"
                />
              </div>
            </div>

            <div className="pt-2 flex flex-col gap-2">
              <button 
                onClick={applyFilters}
                className="w-full bg-black text-white px-6 py-3 rounded-xl text-sm font-bold transition-all hover:opacity-90"
              >
                Refinar Resultados
              </button>
              
              {(searchQuery || selectedType || bedrooms || bathrooms || garage || minPrice || maxPrice) && (
                <button 
                  onClick={clearFilters}
                  className="w-full flex items-center justify-center gap-1 bg-white text-slate-500 border border-slate-100 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all hover:bg-slate-50 hover:text-slate-700"
                >
                  <X size={14} /> Limpar
                </button>
              )}
            </div>
          </div>

          {/* Results Area */}
          <div className="flex-1">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-slate-500 font-medium">Resultados encontrados</span>
              <div className="flex items-center gap-2 bg-white border border-slate-100 p-1 rounded-xl">
                <button onClick={() => setViewMode('grid')} className={`p-2 rounded-lg transition-colors ${viewMode === 'grid' ? 'bg-slate-100 text-black' : 'text-slate-400 hover:text-slate-600'}`}><LayoutGrid size={16} /></button>
                <button onClick={() => setViewMode('list')} className={`p-2 rounded-lg transition-colors ${viewMode === 'list' ? 'bg-slate-100 text-black' : 'text-slate-400 hover:text-slate-600'}`}><List size={16} /></button>
              </div>
            </div>
            {loading ? (
              <div className="flex justify-center items-center py-20 bg-white border border-slate-100 rounded-[2rem] h-full">
                <Loading />
              </div>
            ) : properties.length > 0 ? (
              <>
                <div className={`grid gap-5 md:gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2' : 'grid-cols-1'}`}>
                  {properties.map(property => (
                    <div key={property.id} className="h-[350px]">
                      <PropertyCard property={property} /> 
                    </div>
                  ))}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-4 mt-12">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 border border-slate-200 rounded-full text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"><ChevronLeft size={20} /></button>
                    <span className="text-sm font-bold text-slate-700">Página {page} de {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 border border-slate-200 rounded-full text-slate-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-50"><ChevronRight size={20} /></button>
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-16 md:py-20 bg-white border border-slate-100 border-dashed rounded-[2rem] h-full flex flex-col items-center justify-center p-6">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block mb-4">Sem Resultados</span>
                <h3 className="text-xl font-medium text-slate-900">Nenhum imóvel encontrado.</h3>
                <p className="text-sm text-slate-500 mt-2 max-w-[300px]">Os filtros aplicados não retornaram resultados na nossa base.</p>
                <button onClick={clearFilters} className="mt-6 px-6 py-2.5 border border-slate-200 rounded-full text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors uppercase tracking-wider">
                  Limpar todos os filtros
                </button>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
}

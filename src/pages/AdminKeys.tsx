import React, { useEffect, useMemo, useState } from 'react';
import { Icons } from '../components/Icons';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

type KeyProperty = {
  id: string;
  title: string;
  status?: string | null;
  location?: {
    neighborhood?: string;
    address?: string;
    city?: string;
  } | null;
  neighborhood?: string | null;
  address?: string | null;
  city?: string | null;
  listing_type?: 'sale' | 'rent' | null;
  bedrooms?: number | null;
  price?: number | null;
  rent_price?: number | null;
  images?: string[] | null;
};

const formatBRL = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);

const getKeyStatusMeta = (status?: string | null) => {
  if (status === 'Disponível') {
    return {
      label: '🔑 Chave na Imobiliária',
      className: 'bg-emerald-100 text-emerald-700 border border-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:border-emerald-500/20',
    };
  }

  if (status === 'Alugado') {
    return {
      label: '🏠 Com Inquilino',
      className: 'bg-amber-100 text-amber-700 border border-amber-200 dark:bg-amber-500/15 dark:text-amber-300 dark:border-amber-500/20',
    };
  }

  if (status === 'Vendido') {
    return {
      label: '🔒 Chave Entregue',
      className: 'bg-red-100 text-red-700 border border-red-200 dark:bg-red-500/15 dark:text-red-300 dark:border-red-500/20',
    };
  }

  return {
    label: '📍 Status não mapeado',
    className: 'bg-slate-100 text-slate-700 border border-slate-200 dark:bg-white/10 dark:text-slate-300 dark:border-white/10',
  };
};

const AdminKeys: React.FC = () => {
  const { user } = useAuth();
  const [properties, setProperties] = useState<KeyProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [listingTypeFilter, setListingTypeFilter] = useState<'all' | 'sale' | 'rent'>('all');
  const [bedroomsFilter, setBedroomsFilter] = useState<'all' | '1' | '2' | '3' | '4'>('all');

  useEffect(() => {
    let isMounted = true;

    const fetchProperties = async () => {
      setLoading(true);

      try {
        let query = supabase
          .from('properties')
          .select('id, title, status, location, neighborhood, address, city, listing_type, bedrooms, price, rent_price:rent_package_price, images')
          .order('created_at', { ascending: false });

        if (user?.role !== 'super_admin' && user?.company_id) {
          query = query.eq('company_id', user.company_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        if (isMounted) setProperties((data as KeyProperty[]) || []);
      } catch (error) {
        console.error('Erro ao buscar quadro de chaves:', error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchProperties();

    return () => {
      isMounted = false;
    };
  }, [user?.company_id, user?.role]);

  const filteredProperties = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return properties.filter((property) => {
      const neighborhood = property.location?.neighborhood || property.neighborhood || '';
      const address = property.location?.address || property.address || '';
      const city = property.location?.city || property.city || '';
      const listingType = property.listing_type || (Number(property.rent_price || 0) > 0 ? 'rent' : 'sale');
      const bedrooms = Number(property.bedrooms || 0);

      const matchesSearch =
        normalizedSearch.length === 0 ||
        neighborhood.toLowerCase().includes(normalizedSearch) ||
        address.toLowerCase().includes(normalizedSearch) ||
        city.toLowerCase().includes(normalizedSearch);

      const matchesListingType = listingTypeFilter === 'all' || listingType === listingTypeFilter;
      const matchesBedrooms = bedroomsFilter === 'all' || bedrooms >= Number(bedroomsFilter);

      return matchesSearch && matchesListingType && matchesBedrooms;
    });
  }, [bedroomsFilter, listingTypeFilter, properties, search]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-brand-50 dark:bg-brand-500/10 text-brand-700 dark:text-brand-300 text-xs font-bold uppercase tracking-[0.18em]">
            <Icons.Key size={14} /> Gestão de Chaves
          </div>
          <h1 className="mt-3 text-3xl font-serif font-bold text-slate-800 dark:text-white">Quadro de Chaves</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Visualize rapidamente onde estão as chaves de todos os imóveis da carteira.
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border px-4 py-3 shadow-sm">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500 font-bold">Resumo Atual</p>
          <p className="mt-1 text-2xl font-bold text-slate-800 dark:text-white">{filteredProperties.length}</p>
          <p className="text-sm text-slate-500 dark:text-slate-400">imóveis no quadro filtrado</p>
        </div>
      </div>

      <div className="bg-white dark:bg-dark-card rounded-3xl border border-slate-200 dark:border-dark-border shadow-sm p-5 md:p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Icons.Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por bairro ou endereço..."
              className="w-full pl-11 pr-4 py-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
            />
          </div>

          <select
            value={listingTypeFilter}
            onChange={(e) => setListingTypeFilter(e.target.value as 'all' | 'sale' | 'rent')}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Tipo: Todos</option>
            <option value="sale">Tipo: Venda</option>
            <option value="rent">Tipo: Locação</option>
          </select>

          <select
            value={bedroomsFilter}
            onChange={(e) => setBedroomsFilter(e.target.value as 'all' | '1' | '2' | '3' | '4')}
            className="w-full px-4 py-3 rounded-2xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-slate-900/40 text-slate-700 dark:text-slate-200 outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="all">Quartos: Todos</option>
            <option value="1">1+ quartos</option>
            <option value="2">2+ quartos</option>
            <option value="3">3+ quartos</option>
            <option value="4">4+ quartos</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="min-h-[280px] rounded-3xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm flex items-center justify-center">
          <div className="text-center">
            <Icons.Loader2 size={28} className="animate-spin mx-auto text-brand-500" />
            <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">Carregando quadro de chaves...</p>
          </div>
        </div>
      ) : filteredProperties.length === 0 ? (
        <div className="min-h-[280px] rounded-3xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm flex items-center justify-center">
          <div className="text-center max-w-md px-6">
            <div className="w-16 h-16 rounded-2xl mx-auto bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-400 dark:text-slate-500">
              <Icons.Key size={28} />
            </div>
            <h2 className="mt-4 text-lg font-bold text-slate-800 dark:text-white">Nenhum imóvel encontrado</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              Ajuste os filtros para localizar o imóvel desejado no quadro de chaves.
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {filteredProperties.map((property) => {
            const keyStatus = getKeyStatusMeta(property.status);
            const neighborhood = property.location?.neighborhood || property.neighborhood || 'Bairro não informado';
            const address = property.location?.address || property.address || property.location?.city || property.city || 'Endereço não informado';
            const cover = property.images?.[0];
            const listingType = property.listing_type || (Number(property.rent_price || 0) > 0 ? 'rent' : 'sale');
            const displayPrice = listingType === 'rent'
              ? Number(property.rent_price || property.price || 0)
              : Number(property.price || 0);

            return (
              <div key={property.id} className="group overflow-hidden rounded-3xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border shadow-sm hover:shadow-lg transition-all duration-300">
                <div className="relative h-52 overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-800 dark:to-slate-900">
                  {cover ? (
                    <img
                      src={cover}
                      alt={property.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-400 dark:text-slate-500">
                      <Icons.Home size={40} />
                    </div>
                  )}

                  <div className="absolute inset-x-4 bottom-4">
                    <div className={`inline-flex items-center justify-center rounded-2xl px-4 py-3 text-sm font-extrabold shadow-lg backdrop-blur-sm ${keyStatus.className}`}>
                      {keyStatus.label}
                    </div>
                  </div>
                </div>

                <div className="p-5 space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-slate-800 dark:text-white line-clamp-1">{property.title}</h2>
                    <p className="mt-1 text-sm text-slate-500 dark:text-slate-400 flex items-center gap-2">
                      <Icons.MapPin size={14} className="shrink-0" />
                      <span className="line-clamp-1">{neighborhood}</span>
                    </p>
                    <p className="mt-1 text-xs text-slate-400 dark:text-slate-500 line-clamp-1">{address}</p>
                  </div>

                  <div className="flex items-center justify-between pt-4 border-t border-slate-100 dark:border-dark-border">
                    <div>
                      <p className="text-xs uppercase tracking-[0.14em] font-bold text-slate-400 dark:text-slate-500">
                        {listingType === 'rent' ? 'Locação' : 'Venda'}
                      </p>
                      <p className="text-base font-bold text-slate-800 dark:text-white">
                        {displayPrice > 0 ? formatBRL(displayPrice) : 'Sob consulta'}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-2xl px-3 py-2 bg-slate-50 dark:bg-slate-900/40 text-slate-600 dark:text-slate-300 border border-slate-100 dark:border-dark-border">
                      <Icons.Bed size={16} />
                      <span className="text-sm font-bold">{property.bedrooms || 0} quartos</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AdminKeys;

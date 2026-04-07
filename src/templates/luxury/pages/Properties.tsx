import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Icons } from '../../../components/Icons';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import LuxuryPropertyCard, { LuxuryProperty } from '../components/LuxuryPropertyCard';

interface Filters {
  listing_type: '' | 'sale' | 'rent';
  type: string;
  minPrice: string;
  maxPrice: string;
  minArea: string;
  bedrooms: string;
  city: string;
  search: string;
}

const PROPERTY_TYPES = [
  'Apartamento',
  'Casa',
  'Cobertura',
  'Terreno',
  'Comercial',
  'Sítio',
];

const PAGE_SIZE = 12;

const FilterChip: React.FC<{
  active: boolean;
  label: string;
  onClick: () => void;
}> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 16px',
      borderRadius: 999,
      border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,0.12)'}`,
      background: active ? '#fff' : 'transparent',
      color: active ? '#0e0e0e' : 'rgba(255,255,255,0.52)',
      fontFamily: "'DM Sans', sans-serif",
      fontSize: 13,
      fontWeight: 600,
      cursor: 'pointer',
      transition: 'all 0.18s ease',
      whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

const FilterInput: React.FC<{
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}> = ({ label, placeholder, value, onChange, type = 'text' }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label
      style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 11,
        fontWeight: 700,
        color: 'rgba(255,255,255,0.3)',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
    >
      {label}
    </label>

    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: '12px 14px',
        fontFamily: "'DM Sans', sans-serif",
        fontSize: 14,
        color: '#fff',
        outline: 'none',
        transition: 'border-color 0.18s ease',
        width: '100%',
      }}
      onFocus={(e) => {
        (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.28)';
      }}
      onBlur={(e) => {
        (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
      }}
    />
  </div>
);

export default function Properties() {
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const [properties, setProperties] = useState<LuxuryProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [availableBedrooms, setAvailableBedrooms] = useState<number[]>([]);

  const [filters, setFilters] = useState<Filters>({
    listing_type: (searchParams.get('tipo') as Filters['listing_type']) || '',
    type: searchParams.get('categoria') || '',
    minPrice: searchParams.get('preco_min') || '',
    maxPrice: searchParams.get('preco_max') || '',
    minArea: searchParams.get('area') || '',
    bedrooms: searchParams.get('quartos') || '',
    city: searchParams.get('cidade') || '',
    search: searchParams.get('q') || '',
  });

  const setFilter = (key: keyof Filters, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(0);
  };

  const clearFilters = () => {
    setFilters({
      listing_type: '',
      type: '',
      minPrice: '',
      maxPrice: '',
      minArea: '',
      bedrooms: '',
      city: '',
      search: '',
    });
    setPage(0);
  };

  const handlePageChange = (nextPage: number) => {
    setPage(nextPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const fetchProperties = useCallback(async () => {
    if (!tenant?.id) {
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      let query = supabase
        .from('properties')
        .select(
          'id, title, slug, price, condominium, iptu, type, listing_type, bedrooms, bathrooms, area, suites, garage, city, neighborhood, state, images, featured, status',
          { count: 'exact' }
        )
        .eq('company_id', tenant.id)
        .eq('status', 'Disponível')
        .eq('has_intermediation_signed', true)
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.listing_type) {
        query = query.eq('listing_type', filters.listing_type);
      }

      if (filters.type) {
        query = query.ilike('type', `%${filters.type}%`);
      }

      if (filters.minPrice) {
        query = query.gte('price', Number(filters.minPrice.replace(/\D/g, '')));
      }

      if (filters.maxPrice) {
        query = query.lte('price', Number(filters.maxPrice.replace(/\D/g, '')));
      }

      if (filters.minArea) {
        query = query.gte('area', Number(filters.minArea));
      }

      if (filters.bedrooms) {
        query = query.gte('bedrooms', Number(filters.bedrooms));
      }

      if (filters.city) {
        query = query.ilike('city', `%${filters.city}%`);
      }

      if (filters.search) {
        query = query.or(
          `title.ilike.%${filters.search}%,neighborhood.ilike.%${filters.search}%,city.ilike.%${filters.search}%`
        );
      }

      const { data, count, error } = await query;

      if (error) throw error;

      setProperties((data ?? []) as LuxuryProperty[]);
      setTotal(count ?? 0);
    } catch (error) {
      console.error('Erro ao buscar imóveis:', error);
      setProperties([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, filters, page]);

  useEffect(() => {
    async function fetchDynamicFilters() {
      if (!tenant?.id) return;

      const { data } = await supabase
        .from('properties')
        .select('city, bedrooms')
        .eq('company_id', tenant.id)
        .eq('status', 'Disponível');

      if (data) {
        // Extrai cidades únicas
        const uniqueCities = Array.from(new Set(data.map((d) => d.city).filter(Boolean))) as string[];
        setAvailableCities(uniqueCities.sort());

        // Extrai quantidade de quartos únicas
        const uniqueBeds = Array.from(new Set(data.map((d) => d.bedrooms).filter((b) => b != null))) as number[];
        setAvailableBedrooms(uniqueBeds.sort((a, b) => a - b));
      }
    }

    fetchDynamicFilters();
  }, [tenant?.id]);

  useEffect(() => {
    fetchProperties();
  }, [fetchProperties]);

  useEffect(() => {
    const params: Record<string, string> = {};

    if (filters.listing_type) params.tipo = filters.listing_type;
    if (filters.type) params.categoria = filters.type;
    if (filters.minPrice) params.preco_min = filters.minPrice;
    if (filters.maxPrice) params.preco_max = filters.maxPrice;
    if (filters.minArea) params.area = filters.minArea;
    if (filters.bedrooms) params.quartos = filters.bedrooms;
    if (filters.city) params.cidade = filters.city;
    if (filters.search) params.q = filters.search;

    setSearchParams(params, { replace: true });
  }, [filters, setSearchParams]);

  const activeFilterCount = useMemo(
    () => Object.values(filters).filter((value) => value !== '').length,
    [filters]
  );

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const siteData = (tenant?.site_data as any) || {};
  const companyName = tenant?.name || 'Imobiliária';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .lx-props-root {
          font-family: 'DM Sans', sans-serif;
          background: #0e0e0e;
          min-height: 100vh;
          color: #fff;
        }

        .lx-filter-drawer {
          background: #111111;
          border-bottom: 1px solid rgba(255,255,255,0.07);
          overflow: hidden;
          transition: max-height 0.35s ease, opacity 0.25s ease;
        }

        .lx-filter-drawer.open {
          max-height: 560px;
          opacity: 1;
        }

        .lx-filter-drawer.closed {
          max-height: 0;
          opacity: 0;
        }

        .lx-skeleton {
          background: linear-gradient(90deg, #161616 25%, #1e1e1e 50%, #161616 75%);
          background-size: 200% 100%;
          animation: lx-shimmer 1.4s infinite;
          border-radius: 24px;
          aspect-ratio: 4 / 3;
        }

        @keyframes lx-shimmer {
          0% { background-position: 200% 0; }
          100% { background-position: -200% 0; }
        }

        input::placeholder {
          color: rgba(255,255,255,0.2);
        }

        input[type=number]::-webkit-inner-spin-button {
          -webkit-appearance: none;
        }

        @media (max-width: 900px) {
          .lx-props-grid {
            grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important;
          }

          .lx-filter-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
          }
        }

        @media (max-width: 640px) {
          .lx-props-grid,
          .lx-filter-grid {
            grid-template-columns: 1fr !important;
          }

          .lx-filter-chips {
            flex-wrap: wrap !important;
          }
        }
      `}</style>

      <div className="lx-props-root" style={{ paddingTop: 72 }}>
        <section
          style={{
            background: '#080808',
            padding: 'clamp(48px,6vw,82px) clamp(24px,4vw,48px) 32px',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
          }}
        >
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'flex-end',
                justifyContent: 'space-between',
                gap: 24,
                flexWrap: 'wrap',
                marginBottom: 30,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    color: 'rgba(255,255,255,0.28)',
                    marginBottom: 14,
                  }}
                >
                  Portfólio
                </div>

                <h1
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 'clamp(34px,5vw,58px)',
                    fontWeight: 700,
                    letterSpacing: '-0.05em',
                    color: '#fff',
                    lineHeight: 1,
                    marginBottom: 12,
                  }}
                >
                  Imóveis da {companyName}
                </h1>

                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.34)',
                    lineHeight: 1.8,
                    maxWidth: 620,
                  }}
                >
                  {siteData.properties_intro ||
                    'Explore uma seleção de imóveis com apresentação premium, filtros rápidos e uma navegação feita para facilitar sua busca.'}
                </p>
              </div>

              <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 480 }}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="rgba(255,255,255,0.3)"
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    pointerEvents: 'none',
                  }}
                >
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                </svg>

                <input
                  value={filters.search}
                  onChange={(e) => setFilter('search', e.target.value)}
                  placeholder="Buscar por nome, bairro ou cidade..."
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: 14,
                    padding: '13px 14px 13px 42px',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 14,
                    color: '#fff',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)';
                  }}
                  onBlur={(e) => {
                    (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)';
                  }}
                />
              </div>
            </div>

            <div
              className="lx-filter-chips"
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                overflowX: 'auto',
                paddingBottom: 2,
              }}
            >
              <FilterChip
                active={filters.listing_type === ''}
                label="Todos"
                onClick={() => setFilter('listing_type', '')}
              />
              <FilterChip
                active={filters.listing_type === 'sale'}
                label="Venda"
                onClick={() => setFilter('listing_type', 'sale')}
              />
              <FilterChip
                active={filters.listing_type === 'rent'}
                label="Aluguel"
                onClick={() => setFilter('listing_type', 'rent')}
              />

              {/* Controles: Grid/List e Filtros */}
              <div className="flex items-center gap-4" style={{ marginLeft: 'auto' }}>
                <div className="hidden sm:flex items-center bg-white/5 border border-white/10 rounded-full p-1">
                  <button
                    onClick={() => setViewMode('grid')}
                    className={`p-2 rounded-full transition-colors ${viewMode === 'grid' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                    aria-label="Visualização em Grade"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
                  </button>
                  <button
                    onClick={() => setViewMode('list')}
                    className={`p-2 rounded-full transition-colors ${viewMode === 'list' ? 'bg-white text-black' : 'text-neutral-400 hover:text-white'}`}
                    aria-label="Visualização em Lista"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="8" x2="21" y1="6" y2="6"/><line x1="8" x2="21" y1="12" y2="12"/><line x1="8" x2="21" y1="18" y2="18"/><line x1="3" x2="3.01" y1="6" y2="6"/><line x1="3" x2="3.01" y1="12" y2="12"/><line x1="3" x2="3.01" y1="18" y2="18"/></svg>
                  </button>
                </div>

                <button
                  className="flex items-center gap-2 px-5 py-3 rounded-full border border-white/10 hover:border-white/30 text-sm font-medium transition-colors"
                  onClick={() => setFiltersOpen(true)}
                >
                  <Icons.Filter size={16} />
                  <span>Filtros Avançados</span>
                  {activeFilterCount > 0 && (
                    <span className="ml-1 flex h-5 w-5 items-center justify-center rounded-full bg-white text-black text-[10px] font-bold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className={`lx-filter-drawer ${filtersOpen ? 'open' : 'closed'}`}>
          <div
            style={{
              maxWidth: 1280,
              margin: '0 auto',
              padding: '24px clamp(24px,4vw,48px) 28px',
            }}
          >
            <div
              className="lx-filter-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                gap: 16,
                marginBottom: 18,
              }}
            >
              {/* TIPO DO IMÓVEL */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Tipo do imóvel
                </label>
                <select
                  value={filters.type}
                  onChange={(e) => setFilter('type', e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#fff', outline: 'none', width: '100%' }}
                >
                  <option value="" style={{ background: '#111', color: '#fff' }}>Todos</option>
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type} style={{ background: '#111', color: '#fff' }}>{type}</option>
                  ))}
                </select>
              </div>

              {/* MANTÉM OS PREÇOS */}
              <FilterInput label="Preço mínimo" placeholder="Ex: 500000" value={filters.minPrice} onChange={(value) => setFilter('minPrice', value)} type="number" />
              <FilterInput label="Preço máximo" placeholder="Ex: 2000000" value={filters.maxPrice} onChange={(value) => setFilter('maxPrice', value)} type="number" />

              {/* DROPDOWN DINÂMICO DE CIDADE */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Cidade
                </label>
                <select
                  value={filters.city}
                  onChange={(e) => setFilter('city', e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#fff', outline: 'none', width: '100%' }}
                >
                  <option value="" style={{ background: '#111', color: '#fff' }}>Todas</option>
                  {availableCities.map((city) => (
                    <option key={city} value={city} style={{ background: '#111', color: '#fff' }}>{city}</option>
                  ))}
                </select>
              </div>

              {/* MANTÉM A ÁREA */}
              <FilterInput label="Área mínima" placeholder="Ex: 120" value={filters.minArea} onChange={(value) => setFilter('minArea', value)} type="number" />

              {/* DROPDOWN DINÂMICO DE QUARTOS */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Quartos
                </label>
                <select
                  value={filters.bedrooms}
                  onChange={(e) => setFilter('bedrooms', e.target.value)}
                  style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px', fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#fff', outline: 'none', width: '100%' }}
                >
                  <option value="" style={{ background: '#111', color: '#fff' }}>Todos</option>
                  {availableBedrooms.map((num) => (
                    <option key={num} value={num.toString()} style={{ background: '#111', color: '#fff' }}>
                      {num} {num === 1 ? 'Quarto' : 'Quartos'} ou mais
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 10,
                flexWrap: 'wrap',
              }}
            >
              <button
                onClick={clearFilters}
                style={{
                  padding: '11px 16px',
                  borderRadius: 999,
                  border: '1px solid rgba(255,255,255,0.12)',
                  background: 'transparent',
                  color: 'rgba(255,255,255,0.72)',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Limpar filtros
              </button>

              <button
                onClick={() => setFiltersOpen(false)}
                style={{
                  padding: '11px 18px',
                  borderRadius: 999,
                  border: 'none',
                  background: '#fff',
                  color: '#0e0e0e',
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Aplicar
              </button>
            </div>
          </div>
        </div>

        <section style={{ padding: '40px clamp(24px,4vw,48px) 80px' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 16,
                flexWrap: 'wrap',
                marginBottom: 30,
              }}
            >
              <div
                style={{
                  fontFamily: "'DM Sans', sans-serif",
                  fontSize: 14,
                  color: 'rgba(255,255,255,0.34)',
                }}
              >
                {loading ? 'Carregando imóveis...' : `${total} imóveis encontrados`}
              </div>

              {activeFilterCount > 0 && (
                <div
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    color: 'rgba(255,255,255,0.28)',
                  }}
                >
                  {activeFilterCount} filtro(s) ativo(s)
                </div>
              )}
            </div>

            <div className={`grid gap-6 ${viewMode === 'grid' ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3' : 'grid-cols-1'}`}>
              {loading
                ? Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="lx-skeleton" />
                  ))
                : properties.map((property, i) => (
                    <LuxuryPropertyCard
                      key={property.id}
                      property={property}
                      index={i}
                      variant={i === 0 && page === 0 ? 'featured' : 'default'}
                      viewMode={viewMode}
                    />
                  ))}
            </div>

            {!loading && properties.length === 0 && (
              <div
                style={{
                  marginTop: 32,
                  padding: '32px',
                  borderRadius: 24,
                  background: '#111111',
                  border: '1px solid rgba(255,255,255,0.06)',
                }}
              >
                <h3
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 22,
                    fontWeight: 700,
                    color: '#fff',
                    letterSpacing: '-0.03em',
                    marginBottom: 10,
                  }}
                >
                  Nenhum imóvel encontrado
                </h3>

                <p
                  style={{
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 15,
                    color: 'rgba(255,255,255,0.42)',
                    lineHeight: 1.8,
                    marginBottom: 18,
                  }}
                >
                  Tente ajustar os filtros ou limpar a busca para visualizar mais opções.
                </p>

                <button
                  onClick={clearFilters}
                  style={{
                    padding: '12px 18px',
                    borderRadius: 999,
                    border: 'none',
                    background: '#fff',
                    color: '#0e0e0e',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Limpar filtros
                </button>
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 10,
                  flexWrap: 'wrap',
                  marginTop: 42,
                }}
              >
                <button
                  disabled={page === 0}
                  onClick={() => handlePageChange(Math.max(page - 1, 0))}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'transparent',
                    color: page === 0 ? 'rgba(255,255,255,0.2)' : '#fff',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: page === 0 ? 'default' : 'pointer',
                  }}
                >
                  Anterior
                </button>

                {Array.from({ length: totalPages }).map((_, i) => {
                  const active = i === page;

                  return (
                    <button
                      key={i}
                      onClick={() => handlePageChange(i)}
                      style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,0.12)'}`,
                        background: active ? '#fff' : 'transparent',
                        color: active ? '#0e0e0e' : 'rgba(255,255,255,0.7)',
                        fontFamily: "'DM Sans', sans-serif",
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      {i + 1}
                    </button>
                  );
                })}

                <button
                  disabled={page >= totalPages - 1}
                  onClick={() => handlePageChange(Math.min(page + 1, totalPages - 1))}
                  style={{
                    padding: '11px 16px',
                    borderRadius: 999,
                    border: '1px solid rgba(255,255,255,0.12)',
                    background: 'transparent',
                    color:
                      page >= totalPages - 1
                        ? 'rgba(255,255,255,0.2)'
                        : '#fff',
                    fontFamily: "'DM Sans', sans-serif",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: page >= totalPages - 1 ? 'default' : 'pointer',
                  }}
                >
                  Próxima
                </button>
              </div>
            )}
          </div>
        </section>
      </div>
    </>
  );
}

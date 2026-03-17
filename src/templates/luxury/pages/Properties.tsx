import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import LuxuryPropertyCard, { LuxuryProperty } from '../../../templates/luxury/components/LuxuryPropertyCard';

// ─── Tipos de filtros ─────────────────────────────────────────
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

const PROPERTY_TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Terreno', 'Comercial', 'Sítio'];

// ─── Chip de filtro ───────────────────────────────────────────
const FilterChip: React.FC<{ active: boolean; label: string; onClick: () => void }> = ({ active, label, onClick }) => (
  <button
    onClick={onClick}
    style={{
      padding: '8px 16px', borderRadius: 100,
      border: `1px solid ${active ? '#fff' : 'rgba(255,255,255,0.12)'}`,
      background: active ? '#fff' : 'transparent',
      color: active ? '#0e0e0e' : 'rgba(255,255,255,0.5)',
      fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600,
      cursor: 'pointer', transition: 'all 0.18s', whiteSpace: 'nowrap',
    }}
  >
    {label}
  </button>
);

// ─── Input de filtro ──────────────────────────────────────────
const FilterInput: React.FC<{ label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string }> = ({
  label, placeholder, value, onChange, type = 'text'
}) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
      {label}
    </label>
    <input
      type={type}
      value={value}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 10, padding: '10px 14px',
        fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#fff',
        outline: 'none', transition: 'border-color 0.18s',
        width: '100%',
      }}
      onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.3)'}
      onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'}
    />
  </div>
);

// ─── MAIN ─────────────────────────────────────────────────────
export default function LuxuryProperties() {
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();

  const [properties, setProperties] = useState<LuxuryProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const PAGE_SIZE = 12;

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
    setFilters(prev => ({ ...prev, [key]: value }));
    setPage(0);
  };

  // Buscar imóveis
  const fetchProperties = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('properties')
        .select('id, title, slug, price, type, listing_type, bedrooms, bathrooms, area, suites, garage, city, neighborhood, state, images, featured, status', { count: 'exact' })
        .eq('company_id', tenant.id)
        .eq('status', 'Disponível')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (filters.listing_type) q = q.eq('listing_type', filters.listing_type);
      if (filters.type) q = q.ilike('type', `%${filters.type}%`);
      if (filters.minPrice) q = q.gte('price', Number(filters.minPrice.replace(/\D/g, '')));
      if (filters.maxPrice) q = q.lte('price', Number(filters.maxPrice.replace(/\D/g, '')));
      if (filters.minArea) q = q.gte('area', Number(filters.minArea));
      if (filters.bedrooms) q = q.gte('bedrooms', Number(filters.bedrooms));
      if (filters.city) q = q.ilike('city', `%${filters.city}%`);
      if (filters.search) q = q.or(`title.ilike.%${filters.search}%,neighborhood.ilike.%${filters.search}%,city.ilike.%${filters.search}%`);

      const { data, count, error } = await q;
      if (error) throw error;
      setProperties(data as LuxuryProperty[]);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, filters, page]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  // Atualizar URL ao filtrar
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
  }, [filters]);

  const activeFilterCount = useMemo(() =>
    Object.values(filters).filter(v => v !== '').length, [filters]);

  const clearFilters = () => {
    setFilters({ listing_type: '', type: '', minPrice: '', maxPrice: '', minArea: '', bedrooms: '', city: '', search: '' });
    setPage(0);
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const siteData = (tenant?.site_data as any) || {};

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');
        .lx-props-root { font-family: 'DM Sans', sans-serif; background: #0e0e0e; min-height: 100vh; }
        .lx-filter-drawer {
          background: #111; border-bottom: 1px solid rgba(255,255,255,0.07);
          overflow: hidden; transition: max-height 0.35s ease, opacity 0.25s ease;
        }
        .lx-filter-drawer.open { max-height: 500px; opacity: 1; }
        .lx-filter-drawer.closed { max-height: 0; opacity: 0; }
        .lx-skeleton { background: linear-gradient(90deg, #161616 25%, #1e1e1e 50%, #161616 75%); background-size: 200% 100%; animation: lx-shimmer 1.4s infinite; border-radius: 20px; }
        @keyframes lx-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
        input::placeholder { color: rgba(255,255,255,0.2); }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        @media (max-width: 900px) {
          .lx-props-grid { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)) !important; }
        }
        @media (max-width: 600px) {
          .lx-props-grid { grid-template-columns: 1fr !important; }
          .lx-filter-chips { flex-wrap: wrap !important; }
        }
      `}</style>

      <div className="lx-props-root" style={{ paddingTop: 72 }}>

        {/* ── HERO MÍNIMO ── */}
        <div style={{ background: '#080808', padding: 'clamp(48px,6vw,80px) clamp(24px,4vw,48px) 32px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1280, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 32 }}>
              <div>
                <h1 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 'clamp(32px,5vw,56px)', fontWeight: 700, letterSpacing: '-0.04em', color: '#fff', lineHeight: 1, marginBottom: 10 }}>
                  Portfólio
                </h1>
                <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.3)' }}>
                  {loading ? '...' : `${total} imóveis encontrados`}
                </p>
              </div>

              {/* Search bar */}
              <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 480 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="rgba(255,255,255,0.3)" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
                </svg>
                <input
                  value={filters.search}
                  onChange={e => setFilter('search', e.target.value)}
                  placeholder="Buscar por nome, bairro, cidade..."
                  style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: '12px 14px 12px 42px', fontFamily: "'DM Sans', sans-serif", fontSize: 14, color: '#fff', outline: 'none' }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.25)'}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = 'rgba(255,255,255,0.1)'}
                />
              </div>
            </div>

            {/* Chips de filtro rápido */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <FilterChip active={filters.listing_type === ''} label="Todos" onClick={() => setFilter('listing_type', '')} />
              <FilterChip active={filters.listing_type === 'sale'} label="Venda" onClick={() => setFilter('listing_type', 'sale')} />
              <FilterChip active={filters.listing_type === 'rent'} label="Aluguel" onClick={() => setFilter('listing_type', 'rent')} />

              <div style={{ width: 1, height: 24, background: 'rgba(255,255,255,0.1)', margin: '0 4px' }} />

              {PROPERTY_TYPES.map(t => (
                <FilterChip key={t} active={filters.type === t} label={t} onClick={() => setFilter('type', filters.type === t ? '' : t)} />
              ))}

              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
                {activeFilterCount > 0 && (
                  <button
                    onClick={clearFilters}
                    style={{ padding: '8px 14px', borderRadius: 100, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.08)', color: 'rgba(252,165,165,0.8)', fontFamily: "'DM Sans', sans-serif", fontSize: 12, fontWeight: 600, cursor: 'pointer', transition: 'all 0.18s' }}
                  >
                    Limpar ({activeFilterCount})
                  </button>
                )}
                <button
                  onClick={() => setFiltersOpen(v => !v)}
                  style={{ padding: '8px 16px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.15)', background: filtersOpen ? 'rgba(255,255,255,0.08)' : 'transparent', color: 'rgba(255,255,255,0.6)', fontFamily: "'DM Sans', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.18s' }}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0019 4H5c-.72 0-1.17.77-.75 1.61z"/>
                  </svg>
                  Filtros avançados
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── PAINEL DE FILTROS AVANÇADOS ── */}
        <div className={`lx-filter-drawer ${filtersOpen ? 'open' : 'closed'}`}>
          <div style={{ maxWidth: 1280, margin: '0 auto', padding: '28px clamp(24px,4vw,48px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 20 }}>
              <FilterInput label="Preço mínimo" placeholder="R$ 0" value={filters.minPrice} onChange={v => setFilter('minPrice', v)} type="number" />
              <FilterInput label="Preço máximo" placeholder="Sem limite" value={filters.maxPrice} onChange={v => setFilter('maxPrice', v)} type="number" />
              <FilterInput label="Área mínima (m²)" placeholder="Ex: 80" value={filters.minArea} onChange={v => setFilter('minArea', v)} type="number" />
              <FilterInput label="Quartos mínimos" placeholder="Ex: 2" value={filters.bedrooms} onChange={v => setFilter('bedrooms', v)} type="number" />
              <FilterInput label="Cidade" placeholder="Ex: São Paulo" value={filters.city} onChange={v => setFilter('city', v)} />
            </div>
          </div>
        </div>

        {/* ── GRID DE IMÓVEIS ── */}
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: 'clamp(40px,5vw,64px) clamp(24px,4vw,48px)' }}>
          {loading ? (
            <div className="lx-props-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 28 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i}>
                  <div className="lx-skeleton" style={{ aspectRatio: '4/3', marginBottom: 20 }} />
                  <div className="lx-skeleton" style={{ height: 20, width: '70%', marginBottom: 10 }} />
                  <div className="lx-skeleton" style={{ height: 14, width: '45%' }} />
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '80px 24px' }}>
              <div style={{ fontSize: 48, marginBottom: 20, opacity: 0.15 }}>
                <svg width="64" height="64" viewBox="0 0 24 24" fill="white" style={{ display: 'block', margin: '0 auto' }}>
                  <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                </svg>
              </div>
              <h3 style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 22, fontWeight: 700, color: '#fff', marginBottom: 10 }}>
                Nenhum imóvel encontrado
              </h3>
              <p style={{ fontFamily: "'DM Sans', sans-serif", fontSize: 15, color: 'rgba(255,255,255,0.3)', marginBottom: 24 }}>
                Tente ajustar os filtros ou limpar a busca.
              </p>
              <button
                onClick={clearFilters}
                style={{ padding: '12px 28px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.2)', color: '#fff', background: 'transparent', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: 'pointer' }}
              >
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="lx-props-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 28 }}>
              {properties.map((p, i) => (
                <LuxuryPropertyCard
                  key={p.id}
                  property={p}
                  index={i}
                  variant={p.featured ? 'featured' : 'default'}
                />
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 64 }}>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                style={{ padding: '10px 20px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: page === 0 ? 'rgba(255,255,255,0.2)' : '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: page === 0 ? 'default' : 'pointer', transition: 'all 0.18s' }}
              >
                ← Anterior
              </button>

              {Array.from({ length: totalPages }).map((_, i) => (
                <button
                  key={i}
                  onClick={() => setPage(i)}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: `1px solid ${i === page ? '#fff' : 'rgba(255,255,255,0.12)'}`, background: i === page ? '#fff' : 'transparent', color: i === page ? '#0e0e0e' : 'rgba(255,255,255,0.5)', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.18s' }}
                >
                  {i + 1}
                </button>
              ))}

              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page === totalPages - 1}
                style={{ padding: '10px 20px', borderRadius: 100, border: '1px solid rgba(255,255,255,0.15)', background: 'transparent', color: page === totalPages - 1 ? 'rgba(255,255,255,0.2)' : '#fff', fontFamily: "'DM Sans', sans-serif", fontSize: 14, fontWeight: 600, cursor: page === totalPages - 1 ? 'default' : 'pointer', transition: 'all 0.18s' }}
              >
                Próximo →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

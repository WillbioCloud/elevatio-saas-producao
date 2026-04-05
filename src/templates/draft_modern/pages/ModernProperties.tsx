import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';
import ModernPropertyCard, { ModernProperty } from '../../../templates/draft_modern/components/ModernPropertyCard';

const TYPES = ['Apartamento', 'Casa', 'Cobertura', 'Terreno', 'Comercial', 'Sítio'];
const PAGE_SIZE = 12;

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

// ── Chip ──────────────────────────────────────────────────────
const Chip: React.FC<{ active: boolean; label: string; onClick: () => void; primary: string }> = ({ active, label, onClick, primary }) => (
  <button onClick={onClick} style={{ padding: '8px 16px', borderRadius: 100, border: `1.5px solid ${active ? primary : '#e2e8f0'}`, background: active ? primary : '#fff', color: active ? '#fff' : '#64748b', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', transition: 'all 0.15s', whiteSpace: 'nowrap' }}>
    {label}
  </button>
);

// ── Input ─────────────────────────────────────────────────────
const FInput: React.FC<{ label: string; placeholder: string; value: string; onChange: (v: string) => void; type?: string; primary: string }> = ({ label, placeholder, value, onChange, type = 'text', primary }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
    <label style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{label}</label>
    <input type={type} value={value} placeholder={placeholder} onChange={e => onChange(e.target.value)}
      style={{ padding: '10px 14px', borderRadius: 10, border: '1.5px solid #e5e7eb', background: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: '#0f172a', outline: 'none', width: '100%', transition: 'border-color 0.15s' }}
      onFocus={e => (e.target as HTMLElement).style.borderColor = primary}
      onBlur={e => (e.target as HTMLElement).style.borderColor = '#e5e7eb'} />
  </div>
);

// ── MAIN ──────────────────────────────────────────────────────
export default function ModernProperties() {
  const { tenant } = useTenant();
  const [searchParams, setSearchParams] = useSearchParams();
  const siteData = (tenant?.site_data as any) || {};
  const primary = siteData.primary_color || '#16a34a';

  const [properties, setProperties] = useState<ModernProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const [f, setF] = useState<Filters>({
    listing_type: (searchParams.get('tipo') as Filters['listing_type']) || '',
    type:     searchParams.get('categoria') || '',
    minPrice: searchParams.get('preco_min') || '',
    maxPrice: searchParams.get('preco_max') || '',
    minArea:  searchParams.get('area') || '',
    bedrooms: searchParams.get('quartos') || '',
    city:     searchParams.get('cidade') || '',
    search:   searchParams.get('q') || '',
  });

  const set = (k: keyof Filters, v: string) => { setF(p => ({ ...p, [k]: v })); setPage(0); };

  const fetchProperties = useCallback(async () => {
    if (!tenant?.id) return;
    setLoading(true);
    try {
      let q = supabase
        .from('properties')
        .select('id,title,slug,price,type,listing_type,bedrooms,bathrooms,area,suites,garage,city,neighborhood,state,images,featured,status', { count: 'exact' })
        .eq('company_id', tenant.id)
        .eq('status', 'Disponível')
        .order('featured', { ascending: false })
        .order('created_at', { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (f.listing_type) q = q.eq('listing_type', f.listing_type);
      if (f.type)         q = q.ilike('type', `%${f.type}%`);
      if (f.minPrice)     q = q.gte('price', Number(f.minPrice));
      if (f.maxPrice)     q = q.lte('price', Number(f.maxPrice));
      if (f.minArea)      q = q.gte('area', Number(f.minArea));
      if (f.bedrooms)     q = q.gte('bedrooms', Number(f.bedrooms));
      if (f.city)         q = q.ilike('city', `%${f.city}%`);
      if (f.search)       q = q.or(`title.ilike.%${f.search}%,neighborhood.ilike.%${f.search}%,city.ilike.%${f.search}%`);

      const { data, count } = await q;
      setProperties(data as ModernProperty[] ?? []);
      setTotal(count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [tenant?.id, f, page]);

  useEffect(() => { fetchProperties(); }, [fetchProperties]);

  useEffect(() => {
    const p: Record<string, string> = {};
    if (f.listing_type) p.tipo = f.listing_type;
    if (f.type)         p.categoria = f.type;
    if (f.minPrice)     p.preco_min = f.minPrice;
    if (f.maxPrice)     p.preco_max = f.maxPrice;
    if (f.minArea)      p.area = f.minArea;
    if (f.bedrooms)     p.quartos = f.bedrooms;
    if (f.city)         p.cidade = f.city;
    if (f.search)       p.q = f.search;
    setSearchParams(p, { replace: true });
  }, [f]);

  const activeCount = useMemo(() => Object.values(f).filter(v => v).length, [f]);
  const clear = () => { setF({ listing_type: '', type: '', minPrice: '', maxPrice: '', minArea: '', bedrooms: '', city: '', search: '' }); setPage(0); };
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <>
      <style>{`
        @keyframes mn-shimmer { 0% { background-position:200% 0; } 100% { background-position:-200% 0; } }
        @keyframes mn-fadein  { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        .mn-filter-panel { overflow: hidden; transition: max-height 0.32s ease, opacity 0.22s ease; }
        .mn-filter-panel.open  { max-height: 400px; opacity: 1; }
        .mn-filter-panel.closed { max-height: 0; opacity: 0; }
        .mn-shimmer { background: linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%); background-size: 200% 100%; animation: mn-shimmer 1.4s infinite; }
        input[type=number]::-webkit-inner-spin-button { -webkit-appearance: none; }
        input::placeholder { color: #9ca3af; }
        @media (max-width: 900px) { .mn-pg-grid { grid-template-columns: repeat(2,1fr) !important; } }
        @media (max-width: 560px) { .mn-pg-grid { grid-template-columns: 1fr !important; } .mn-chips { flex-wrap: wrap !important; } }
      `}</style>

      <div style={{ background: '#fff', minHeight: '100vh', fontFamily: "'Plus Jakarta Sans',sans-serif" }}>

        {/* ── HEADER ── */}
        <div style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9', padding: 'clamp(36px,5vw,60px) clamp(20px,4vw,48px) 0' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto' }}>
            <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 24, flexWrap: 'wrap', marginBottom: 28 }}>
              <div>
                <h1 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 'clamp(30px,5vw,52px)', fontWeight: 800, letterSpacing: '-0.04em', color: '#0f172a', lineHeight: 1, marginBottom: 8 }}>
                  Portfólio de Imóveis
                </h1>
                <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: '#94a3b8', fontWeight: 500 }}>
                  {loading ? '…' : `${total} imóveis encontrados`}
                </p>
              </div>

              {/* Search */}
              <div style={{ position: 'relative', flex: '1 1 280px', maxWidth: 440 }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="#94a3b8" style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
                  <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"/>
                </svg>
                <input value={f.search} onChange={e => set('search', e.target.value)} placeholder="Buscar por nome, bairro, cidade…"
                  style={{ width: '100%', padding: '11px 14px 11px 40px', borderRadius: 11, border: '1.5px solid #e5e7eb', background: '#fff', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: '#0f172a', outline: 'none' }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = primary}
                  onBlur={e => (e.target as HTMLElement).style.borderColor = '#e5e7eb'} />
              </div>
            </div>

            {/* Chips */}
            <div className="mn-chips" style={{ display: 'flex', gap: 8, alignItems: 'center', overflowX: 'auto', paddingBottom: 20 }}>
              <Chip active={!f.listing_type} label="Todos" onClick={() => set('listing_type', '')} primary={primary} />
              <Chip active={f.listing_type === 'sale'} label="Venda" onClick={() => set('listing_type', f.listing_type === 'sale' ? '' : 'sale')} primary={primary} />
              <Chip active={f.listing_type === 'rent'} label="Aluguel" onClick={() => set('listing_type', f.listing_type === 'rent' ? '' : 'rent')} primary={primary} />
              <div style={{ width: 1, height: 22, background: '#e2e8f0', flexShrink: 0, margin: '0 4px' }} />
              {TYPES.map(t => (
                <Chip key={t} active={f.type === t} label={t} onClick={() => set('type', f.type === t ? '' : t)} primary={primary} />
              ))}
              <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, flexShrink: 0 }}>
                {activeCount > 0 && (
                  <button onClick={clear} style={{ padding: '8px 14px', borderRadius: 100, border: '1.5px solid #fecaca', background: '#fef2f2', color: '#dc2626', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                    Limpar ({activeCount})
                  </button>
                )}
                <button onClick={() => setFiltersOpen(v => !v)} style={{ padding: '8px 16px', borderRadius: 100, border: `1.5px solid ${filtersOpen ? primary : '#e2e8f0'}`, background: filtersOpen ? `${primary}10` : '#fff', color: filtersOpen ? primary : '#64748b', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6, transition: 'all 0.15s' }}>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><path d="M4.25 5.61C6.27 8.2 10 13 10 13v6c0 .55.45 1 1 1h2c.55 0 1-.45 1-1v-6s3.72-4.8 5.74-7.39A.998.998 0 0019 4H5c-.72 0-1.17.77-.75 1.61z"/></svg>
                  Filtros avançados
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── FILTROS AVANÇADOS ── */}
        <div className={`mn-filter-panel ${filtersOpen ? 'open' : 'closed'}`} style={{ background: '#f8fafc', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px clamp(20px,4vw,48px)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(190px,1fr))', gap: 18 }}>
              <FInput label="Preço mínimo" placeholder="R$ 0" value={f.minPrice} onChange={v => set('minPrice', v)} type="number" primary={primary} />
              <FInput label="Preço máximo" placeholder="Sem limite" value={f.maxPrice} onChange={v => set('maxPrice', v)} type="number" primary={primary} />
              <FInput label="Área mínima (m²)" placeholder="Ex: 80" value={f.minArea} onChange={v => set('minArea', v)} type="number" primary={primary} />
              <FInput label="Quartos mínimos" placeholder="Ex: 2" value={f.bedrooms} onChange={v => set('bedrooms', v)} type="number" primary={primary} />
              <FInput label="Cidade" placeholder="Ex: São Paulo" value={f.city} onChange={v => set('city', v)} primary={primary} />
            </div>
          </div>
        </div>

        {/* ── GRID ── */}
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: 'clamp(36px,5vw,56px) clamp(20px,4vw,48px)' }}>
          {loading ? (
            <div className="mn-pg-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} style={{ borderRadius: 18, overflow: 'hidden', border: '1.5px solid #f1f5f9' }}>
                  <div className="mn-shimmer" style={{ height: 224 }} />
                  <div style={{ padding: 20 }}>
                    <div className="mn-shimmer" style={{ height: 13, borderRadius: 7, width: '50%', marginBottom: 10 }} />
                    <div className="mn-shimmer" style={{ height: 18, borderRadius: 7, width: '80%', marginBottom: 14 }} />
                    <div className="mn-shimmer" style={{ height: 26, borderRadius: 7, width: '40%' }} />
                  </div>
                </div>
              ))}
            </div>
          ) : properties.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '72px 24px' }}>
              <div style={{ width: 72, height: 72, borderRadius: '50%', background: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <svg width="32" height="32" viewBox="0 0 24 24" fill="#cbd5e1"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>
              </div>
              <h3 style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 20, fontWeight: 700, color: '#0f172a', marginBottom: 8 }}>Nenhum imóvel encontrado</h3>
              <p style={{ fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, color: '#94a3b8', marginBottom: 24 }}>Tente ajustar os filtros ou limpar a busca.</p>
              <button onClick={clear} style={{ padding: '12px 28px', borderRadius: 100, border: `1.5px solid ${primary}`, color: primary, background: 'transparent', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>
                Limpar filtros
              </button>
            </div>
          ) : (
            <div className="mn-pg-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 22 }}>
              {properties.map((p, i) => (
                <ModernPropertyCard key={p.id} property={p} primaryColor={primary} index={i} />
              ))}
            </div>
          )}

          {/* Paginação */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 56 }}>
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                style={{ padding: '10px 20px', borderRadius: 100, border: '1.5px solid #e2e8f0', background: '#fff', color: page === 0 ? '#cbd5e1' : '#374151', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 600, cursor: page === 0 ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                ← Anterior
              </button>
              {Array.from({ length: totalPages }).map((_, i) => (
                <button key={i} onClick={() => setPage(i)}
                  style={{ width: 40, height: 40, borderRadius: '50%', border: `1.5px solid ${i === page ? primary : '#e2e8f0'}`, background: i === page ? primary : '#fff', color: i === page ? '#fff' : '#64748b', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 700, cursor: 'pointer', transition: 'all 0.15s' }}>
                  {i + 1}
                </button>
              ))}
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1}
                style={{ padding: '10px 20px', borderRadius: 100, border: '1.5px solid #e2e8f0', background: '#fff', color: page === totalPages - 1 ? '#cbd5e1' : '#374151', fontFamily: "'Plus Jakarta Sans',sans-serif", fontSize: 14, fontWeight: 600, cursor: page === totalPages - 1 ? 'default' : 'pointer', transition: 'all 0.15s' }}>
                Próximo →
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

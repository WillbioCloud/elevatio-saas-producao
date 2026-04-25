import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import WelcomeBalloon from '../components/ui/WelcomeBalloon';

type KeyProperty = {
  id: string;
  title: string;
  status?: string | null;
  listing_type?: string | null;
  address?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  bedrooms?: number | null;
  price?: number | null;
  images?: string[] | null;
  key_status?: string | null;
};

const getPropertyLocationText = (property: Pick<KeyProperty, 'address' | 'neighborhood' | 'city' | 'state'>) => {
  const cityState = [property.city, property.state].filter(Boolean).join(' - ');
  return [property.neighborhood, property.address, cityState].filter(Boolean).join(', ');
};

export default function AdminKeys() {
  const { user } = useAuth();
  const [properties, setProperties] = useState<KeyProperty[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('todos');
  const [updatingKeyId, setUpdatingKeyId] = useState<string | null>(null);

  const fetchProperties = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('properties')
        .select('id, title, status, listing_type, address, neighborhood, city, state, bedrooms, price, images, key_status')
        .order('created_at', { ascending: false });

      // Multi-tenant isolation
      if (user?.role !== 'super_admin' && user?.company_id) {
        query = query.eq('company_id', user.company_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setProperties((data as KeyProperty[]) || []);
    } catch (error) {
      console.error('Erro ao buscar imóveis para chaves:', error);
    } finally {
      setLoading(false);
    }
  };

  // Garanta que o hook useEffect recarregue quando o usuário mudar
  useEffect(() => {
    if (user?.company_id) {
      fetchProperties();
    }
  }, [user?.company_id]);

  const handleUpdateKeyStatus = async (propertyId: string, newStatus: string) => {
    if (!window.confirm('Tem certeza que deseja alterar a localização desta chave?')) return;

    setUpdatingKeyId(propertyId);
    try {
      const { error } = await supabase
        .from('properties')
        .update({ key_status: newStatus })
        .eq('id', propertyId);

      if (error) throw error;
      fetchProperties(); // Recarrega os dados
    } catch (error: any) {
      alert('Erro ao atualizar status da chave: ' + error.message);
    } finally {
      setUpdatingKeyId(null);
    }
  };

  const filteredProperties = properties.filter((prop) => {
    const locationText = getPropertyLocationText(prop);

    const matchesSearch =
      prop.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (locationText && locationText.toLowerCase().includes(searchTerm.toLowerCase()));

    const matchesType =
      filterType === 'todos' ||
      (filterType === 'venda' && (prop.listing_type === 'sale' || prop.listing_type === 'venda')) ||
      (filterType === 'locacao' && (prop.listing_type === 'rent' || prop.listing_type === 'locacao'));

    return matchesSearch && matchesType;
  });

  const KEY_STATUS_MAP = {
    agency: { label: '🔑 Na Imobiliária', color: 'bg-emerald-500', icon: Icons.Key },
    broker: { label: '🏃‍♀️ Com Corretor', color: 'bg-indigo-500', icon: Icons.UserCircle },
    client: { label: '🏠 Com Inquilino', color: 'bg-amber-500', icon: Icons.Home },
    owner: { label: '📦 Com Proprietário', color: 'bg-slate-500', icon: Icons.Package },
  };

  return (
    <div className="animate-fade-in">
      <WelcomeBalloon pageId="keys" icon="Key" title="Controle de Chaves" description="Fim da bagunça! Saiba exatamente se a chave do imóvel está na imobiliária, com o proprietário ou no bolso de algum corretor." />

      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900 dark:text-white">
            <Icons.Key className="text-brand-500" size={32} /> Quadro de Chaves
          </h1>
          <p className="mt-2 max-w-2xl leading-relaxed text-slate-500">
            Gerencie a logística e localização das chaves de todos os imóveis da imobiliária.
          </p>
        </div>
      </div>

      <div className="mb-8 flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-dark-border dark:bg-dark-card md:flex-row">
        <div className="relative flex-1">
          <Icons.Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
          <input
            type="text"
            placeholder="Buscar por bairro, endereço ou título..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-3 pl-11 pr-4 outline-none focus:ring-2 focus:ring-brand-500 dark:border-dark-border dark:bg-white/5"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium text-slate-700 outline-none focus:ring-2 focus:ring-brand-500 dark:border-dark-border dark:bg-white/5 dark:text-slate-300"
        >
          <option value="todos">Todos os Imóveis</option>
          <option value="locacao">Para Locação</option>
          <option value="venda">Para Venda</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Icons.Loader2 className="animate-spin text-brand-500" size={40} />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
          {filteredProperties.map((prop) => {
            const currentKey = KEY_STATUS_MAP[prop.key_status || 'agency'];
            const KeyIcon = currentKey.icon;
            const locationText = getPropertyLocationText(prop);

            return (
              <div
                key={prop.id}
                className="flex flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-xl dark:border-dark-border dark:bg-dark-card"
              >
                <div className="relative h-40 bg-slate-200">
                  {prop.images && prop.images[0] ? (
                    <img src={prop.images[0]} alt={prop.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-slate-400">
                      <Icons.Image size={40} />
                    </div>
                  )}
                  <div className="absolute right-4 top-4 z-10 shadow-xl">
                    <span className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-bold text-white ${currentKey.color}`}>
                      <KeyIcon size={14} /> {currentKey.label}
                    </span>
                  </div>
                </div>

                <div className="flex flex-1 flex-col p-6">
                  <h3 className="line-clamp-1 text-lg font-bold text-slate-800 dark:text-white">{prop.title}</h3>
                  <p className="mt-2 mb-6 flex items-center gap-1 text-sm text-slate-500">
                    <Icons.MapPin size={14} /> {locationText || 'Sem endereço'}
                  </p>

                  <div className="mt-auto border-t border-slate-100 pt-6 dark:border-dark-border">
                    <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-400">
                      Mudar Localização da Chave:
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { status: 'agency', icon: Icons.Key, label: 'Imobiliária' },
                        { status: 'broker', icon: Icons.UserCircle, label: 'Corretor' },
                        { status: 'client', icon: Icons.Home, label: 'Inquilino' },
                        { status: 'owner', icon: Icons.Package, label: 'Dono' },
                      ].map((item) => (
                        <button
                          key={item.status}
                          onClick={() => handleUpdateKeyStatus(prop.id, item.status)}
                          disabled={updatingKeyId === prop.id || prop.key_status === item.status}
                          className={`flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-bold transition-all ${
                            prop.key_status === item.status
                              ? 'cursor-not-allowed border border-slate-200 bg-slate-100 text-slate-400 dark:border-white/5 dark:bg-white/5'
                              : 'border border-slate-100 bg-slate-50 text-slate-700 hover:bg-slate-100 dark:border-dark-border dark:bg-dark-bg dark:text-slate-300 dark:hover:bg-white/10'
                          }`}
                        >
                          {updatingKeyId === prop.id && prop.key_status !== item.status ? (
                            <Icons.Loader2 size={14} className="animate-spin" />
                          ) : (
                            <item.icon size={14} />
                          )}
                          {item.label}
                        </button>
                      ))}
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
}

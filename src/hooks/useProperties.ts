import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Property } from '../types';

interface UsePropertiesOptions {
  publicOnly?: boolean;
}

type RawProperty = Omit<Property, 'location'> & {
  city?: string | null;
  neighborhood?: string | null;
  state?: string | null;
  address?: string | null;
  features?: unknown;
  images?: unknown;
  agent?: {
    name?: string | null;
    email?: string | null;
    phone?: string | null;
  } | null;
};

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string; code?: string | number };
  return maybe.name === 'AbortError' || maybe.message?.includes('AbortError') === true || maybe.code === 20 || maybe.code === '20';
};

const normalizeProperty = (p: RawProperty): Property => ({
  ...p,
  location: {
    city: p.city ?? '',
    neighborhood: p.neighborhood ?? '',
    state: p.state ?? '',
    address: p.address ?? '',
  },
  features: Array.isArray(p.features) ? (p.features as string[]) : [],
  images: Array.isArray(p.images) ? (p.images as string[]) : [],
  agent: p.agent
    ? {
        name: p.agent.name ?? 'Corretor',
        email: p.agent.email ?? '',
        phone: p.agent.phone ?? '',
      }
    : undefined,
});

export function useProperties(options: UsePropertiesOptions = {}) {
  const { publicOnly = false } = options;
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const channelRef = useRef<any>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchProperties = async () => {
      const shouldShowInitialLoading = !hasLoadedOnceRef.current;

      if (shouldShowInitialLoading) {
        setLoading(true);
      }

      try {
        let query = supabase.from('properties').select('*, agent:profiles (name, email, phone)');

        if (publicOnly) {
          query = query.eq('status', 'active').eq('has_intermediation_signed', true);
        }

        const { data, error: joinError } = await query.order('created_at', { ascending: false });

        if (joinError) {
          throw joinError;
        }

        if (isMounted && data) {
          setProperties(data.map((property) => normalizeProperty(property as any)));
          setError(null);
          hasLoadedOnceRef.current = true;
        }
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }

        console.warn('Busca com JOIN falhou, tentando busca simples...', err);

        try {
          let simpleQuery = supabase.from('properties').select('*');

          if (publicOnly) {
            simpleQuery = simpleQuery.eq('status', 'active').eq('has_intermediation_signed', true);
          }

          const { data: simpleData, error: simpleError } = await simpleQuery.order('created_at', { ascending: false });

          if (simpleError) throw simpleError;

          if (isMounted && simpleData) {
            setProperties(simpleData.map((property) => normalizeProperty({ ...property, agent: null } as any)));
            setError(null);
            hasLoadedOnceRef.current = true;
          }
        } catch (simpleError) {
          if (isAbortError(simpleError)) {
            return;
          }

          if (isMounted) {
            console.error('Erro fatal ao buscar imoveis:', simpleError);
            setError('Nao foi possivel carregar os imoveis.');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchProperties();

    const channel = supabase
      .channel('public:properties_list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'properties' }, () => {
        void fetchProperties();
      })
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, [publicOnly]);

  return { properties, loading, error };
}

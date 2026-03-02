import { useEffect, useState, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { Property } from '../types';

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

export function useProperties() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Ref para controlar o canal de realtime
  const channelRef = useRef<any>(null);
  const hasLoadedOnceRef = useRef(false);

  useEffect(() => {
    let isMounted = true;

    const fetchProperties = async () => {
      const shouldShowInitialLoading = !hasLoadedOnceRef.current;
      // NÃO limpe setProperties([]) aqui. Mantenha os dados velhos na tela.
      if (shouldShowInitialLoading && properties.length === 0) {
        setLoading(true);
      }

      try {
        // Tenta buscar COM os dados do corretor (JOIN)
        // Isso requer que a tabela 'profiles' tenha permissão de leitura pública (SELECT TO public)
        const { data, error: joinError } = await supabase
          .from('properties')
          .select(`*, agent:profiles (name, email, phone)`)
          .order('created_at', { ascending: false });

        if (joinError) {
          // Se der erro no JOIN (ex: permissão de profiles), lançamos erro para cair no catch
          // e tentar a busca simples
          throw joinError;
        }

        if (isMounted && data) {
          const mapped = data.map((p) => normalizeProperty(p as any));
          setProperties(mapped);
          setError(null);
          hasLoadedOnceRef.current = true;
        }
      } catch (err) {
        if (isAbortError(err)) {
          return;
        }

        // FALLBACK: Se falhar (provavelmente RLS em profiles), busca apenas os dados do imóvel
        console.warn('Busca com JOIN falhou, tentando busca simples...', err);

        try {
          const { data: simpleData, error: simpleError } = await supabase
            .from('properties')
            .select('*')
            .order('created_at', { ascending: false });

          if (simpleError) throw simpleError;

          if (isMounted && simpleData) {
            const mapped = simpleData.map((p) => normalizeProperty({ ...p, agent: null } as any));
            setProperties(mapped);
            setError(null);
            hasLoadedOnceRef.current = true;
          }
        } catch (simpleError) {
          if (isAbortError(simpleError)) {
            return;
          }

          if (isMounted) {
            console.error('Erro fatal ao buscar imóveis:', simpleError);
            setError('Não foi possível carregar os imóveis.');
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    void fetchProperties();

    // Configuração do Realtime
    // Usamos um canal único para evitar duplicidade de conexões
    const channel = supabase
      .channel('public:properties_list')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'properties' },
        () => {
          void fetchProperties();
        }
      )
      .subscribe();

    channelRef.current = channel;

    return () => {
      isMounted = false;
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current);
      }
    };
  }, []); // Array vazio = executa apenas na montagem

  return { properties, loading, error };
}
import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useTenant } from '../contexts/TenantContext';

interface SimilarPropertiesProps {
  currentPropertyId: string;
  listingType: string;
  city?: string | null;
  neighborhood?: string | null;
  renderCard: (property: any) => React.ReactNode;
}

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

export default function SimilarProperties({
  currentPropertyId,
  listingType,
  city,
  neighborhood,
  renderCard
}: SimilarPropertiesProps) {
  const { tenant } = useTenant();
  const [properties, setProperties] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!tenant?.id || !currentPropertyId) return;

    const fetchSimilar = async () => {
      try {
        const { data, error } = await supabase
          .from('properties')
          .select('*, profiles(name, phone, email)')
          .eq('company_id', tenant.id)
          .eq('listing_type', listingType)
          .eq('status', 'Disponível') // Substituímos is_available por status
          .neq('id', currentPropertyId)
          .limit(10); // Busca até 10 para ranquear por localidade no front

        if (error) throw error;

        if (data && data.length > 0) {
          // Ranqueamento: Prioriza mesmo bairro (peso 2) e mesma cidade (peso 1)
          const sorted = data.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;
            if (city && a.city === city) scoreA += 1;
            if (city && b.city === city) scoreB += 1;
            if (neighborhood && a.neighborhood === neighborhood) scoreA += 2;
            if (neighborhood && b.neighborhood === neighborhood) scoreB += 2;
            return scoreB - scoreA;
          });

          // Formata os 3 melhores para o padrão que os Cards esperam
          const mapped = sorted.slice(0, 3).map(p => ({
            ...p,
            agent: Array.isArray(p.profiles) ? p.profiles[0] : p.profiles,
            location: {
              city: p.city || '',
              neighborhood: p.neighborhood || '',
              state: p.state || '',
              address: p.address || '',
              zip_code: p.zip_code || '',
            },
            features: parseStringArray(p.features),
            images: parseStringArray(p.images),
          }));

          setProperties(mapped);
        }
      } catch (err) {
        console.error('Erro ao buscar imóveis similares:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchSimilar();
  }, [tenant?.id, currentPropertyId, listingType, city, neighborhood]);

  if (loading || properties.length === 0) return null;

  return (
    <div className="mt-16 pt-16 border-t border-slate-200 dark:border-white/10 w-full">
      <h2 className="text-2xl md:text-3xl font-bold text-slate-900 dark:text-white mb-8">
        Você também pode gostar
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8">
        {properties.map(renderCard)}
      </div>
    </div>
  );
}

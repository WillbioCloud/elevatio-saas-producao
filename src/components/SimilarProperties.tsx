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
  renderCard,
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
          .eq('status', 'active')
          .eq('has_intermediation_signed', true)
          .neq('id', currentPropertyId)
          .limit(10);

        if (error) throw error;

        if (data && data.length > 0) {
          const sorted = data.sort((a, b) => {
            let scoreA = 0;
            let scoreB = 0;

            if (city && a.city === city) scoreA += 1;
            if (city && b.city === city) scoreB += 1;
            if (neighborhood && a.neighborhood === neighborhood) scoreA += 2;
            if (neighborhood && b.neighborhood === neighborhood) scoreB += 2;

            return scoreB - scoreA;
          });

          setProperties(
            sorted.slice(0, 3).map((property) => ({
              ...property,
              agent: Array.isArray(property.profiles) ? property.profiles[0] : property.profiles,
              location: {
                city: property.city || '',
                neighborhood: property.neighborhood || '',
                state: property.state || '',
                address: property.address || '',
                zip_code: property.zip_code || '',
              },
              features: parseStringArray(property.features),
              images: parseStringArray(property.images),
            }))
          );
        }
      } catch (error) {
        console.error('Erro ao buscar imóveis similares:', error);
      } finally {
        setLoading(false);
      }
    };

    void fetchSimilar();
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

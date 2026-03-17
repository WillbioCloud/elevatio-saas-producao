import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';

const MASTER_DOMAINS = [
  'localhost',
  'lvh.me',
  'app-elevatiovendas.vercel.app',
  'elevatiovendas.com.br',
  'elevatiovendas.vercel.app',
  'www.elevatiovendas.com.br',
] as const;

export type Company = {
  id: string;
  name: string;
  subdomain: string | null;
  domain: string | null;
  logo_url?: string | null;
  logo_white_url?: string | null;
  plan?: string | null;
  active?: boolean | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  site_data?: any;
  [key: string]: unknown;
};

export type Profile = {
  id: string;
  company_id: string | null;
  role?: string | null;
  name?: string | null;
  email?: string | null;
  [key: string]: unknown;
};

type TenantContextType = {
  tenant: Company | null;
  isMasterDomain: boolean;
  isLoadingTenant: boolean;
};

const TenantContext = createContext<TenantContextType | undefined>(undefined);

const getHostData = (hostname: string): {
  isMasterDomain: boolean;
  slug: string | null;
  customDomain: string | null;
} => {
  const normalizedHostname = hostname.toLowerCase();
  const isMasterDomain = MASTER_DOMAINS.includes(normalizedHostname as (typeof MASTER_DOMAINS)[number]);

  if (isMasterDomain) {
    return { isMasterDomain: true, slug: null, customDomain: null };
  }

  if (normalizedHostname.endsWith('.lvh.me')) {
    return {
      isMasterDomain: false,
      slug: normalizedHostname.replace(/\.lvh\.me$/, ''),
      customDomain: null
    };
  }

  if (normalizedHostname.endsWith('.localhost') && normalizedHostname !== 'localhost') {
    return {
      isMasterDomain: false,
      slug: normalizedHostname.replace(/\.localhost$/, ''),
      customDomain: null
    };
  }

  if (normalizedHostname.endsWith('.vercel.app')) {
    return {
      isMasterDomain: false,
      slug: normalizedHostname.replace(/\.vercel\.app$/, ''),
      customDomain: null
    };
  }

  if (normalizedHostname.endsWith('.elevatiovendas.com.br')) {
    return {
      isMasterDomain: false,
      slug: normalizedHostname.replace(/\.elevatiovendas\.com\.br$/, ''),
      customDomain: null
    };
  }

  return {
    isMasterDomain: false,
    slug: null,
    customDomain: normalizedHostname,
  };
};

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Company | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [isMasterDomain, setIsMasterDomain] = useState(true);

  useEffect(() => {
    let isMounted = true;

    const resolveTenant = async () => {
      const hostname = window.location.hostname;
      const cleanHostname = hostname.replace('www.', '');
      const hostData = getHostData(hostname);

      setIsMasterDomain(hostData.isMasterDomain);

      if (hostData.isMasterDomain) {
        if (isMounted) {
          setTenant(null);
          setIsLoadingTenant(false);
        }
        return;
      }

      try {
        let query = supabase.from('companies').select('*');

        if (hostData.customDomain) {
          query = query.eq('domain', cleanHostname);
        } else if (hostData.slug) {
          query = query.eq('subdomain', hostData.slug);
        }

        const { data, error } = await query.limit(1).maybeSingle();

        if (error) {
          console.error('Erro na query do banco:', error);
          throw error;
        }

        if (isMounted) {
          setTenant((data as Company | null) ?? null);
        }
      } catch (error) {
        console.error('Erro ao carregar tenant:', error);
        if (isMounted) {
          setTenant(null);
        }
      } finally {
        if (isMounted) {
          setIsLoadingTenant(false);
        }
      }
    };

    resolveTenant();

    return () => {
      isMounted = false;
    };
  }, []);

  const value = useMemo(
    () => ({ tenant, isMasterDomain, isLoadingTenant }),
    [tenant, isMasterDomain, isLoadingTenant]
  );

  if (isLoadingTenant) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center text-brand-600 bg-white dark:bg-slate-900">
        <Loader2 className="animate-spin mb-4" size={46} />
        <p className="text-slate-600 dark:text-slate-200">Carregando imobiliária...</p>
      </div>
    );
  }

  if (!isMasterDomain && !tenant && !isLoadingTenant) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center px-6 text-center bg-white dark:bg-slate-900">
        <h1 className="text-3xl font-bold text-slate-800 dark:text-slate-100 mb-3">404</h1>
        <p className="text-lg text-slate-600 dark:text-slate-300">Imobiliária não encontrada</p>
      </div>
    );
  }

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
};

export const useTenant = (): TenantContextType => {
  const context = useContext(TenantContext);

  if (!context) {
    throw new Error('useTenant deve ser usado dentro de TenantProvider');
  }

  return context;
};

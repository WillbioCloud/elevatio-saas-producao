import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { FinanceConfig } from '../types';
import { buildTenantNotFoundRedirectUrl, getHostData } from '../utils/domain';

export type Company = {
  id: string;
  name: string;
  subdomain: string | null;
  domain: string | null;
  document?: string | null;
  template?: string | null;
  template_id?: string | null;
  logo_url?: string | null;
  logo_white_url?: string | null;
  admin_signature_url?: string | null;
  plan?: string | null;
  active?: boolean | null;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  site_data?: any;
  finance_config?: FinanceConfig | string | null;
  use_asaas?: boolean | null;
  default_commission?: number | null;
  broker_commission?: number | null;
  payment_api_key?: string | null;
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

export const TenantProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [tenant, setTenant] = useState<Company | null>(null);
  const [isLoadingTenant, setIsLoadingTenant] = useState(true);
  const [isMasterDomain, setIsMasterDomain] = useState(true);
  const [isRedirectingTenant, setIsRedirectingTenant] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const resolveTenant = async () => {
      const hostname = window.location.hostname;
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
        let query = supabase
          .from('companies')
          .select('*')
          .eq('active', true);

        if (hostData.customDomain) {
          query = query.eq('domain', hostData.customDomain);
        } else if (hostData.slug) {
          query = query.eq('subdomain', hostData.slug);
        } else {
          if (isMounted) {
            setTenant(null);
          }
          return;
        }

        const { data, error } = await query.limit(1).maybeSingle();

        if (error) {
          console.error('Erro na query do banco:', error);
          throw error;
        }

        if (!data && hostData.slug && hostData.shouldRedirectOnTenantNotFound) {
          if (isMounted) {
            setIsRedirectingTenant(true);
          }

          window.location.replace(buildTenantNotFoundRedirectUrl(hostData.slug));
          return;
        }

        const parsedFinanceConfig =
          typeof data?.finance_config === 'string'
            ? (() => {
                try {
                  return JSON.parse(data.finance_config) as FinanceConfig;
                } catch {
                  return null;
                }
              })()
            : ((data?.finance_config as FinanceConfig | null) ?? null);

        const parsedSiteData =
          typeof data?.site_data === 'string'
            ? (() => {
                try {
                  return JSON.parse(data.site_data) as Record<string, unknown>;
                } catch {
                  return null;
                }
              })()
            : ((data?.site_data as Record<string, unknown> | null) ?? null);

        const siteDataTemplateId =
          typeof parsedSiteData?.template_id === 'string' ? parsedSiteData.template_id : null;
        const siteDataLegacyTemplate =
          typeof parsedSiteData?.template === 'string' ? parsedSiteData.template : null;
        const normalizedTemplate =
          typeof data?.template === 'string' ? data.template : siteDataLegacyTemplate;

        if (isMounted) {
          setTenant(
            data
              ? ({
                  ...data,
                  site_data: parsedSiteData,
                  phone:
                    typeof parsedSiteData?.contact_phone === 'string'
                      ? parsedSiteData.contact_phone
                      : typeof (parsedSiteData?.contact as { phone?: unknown } | undefined)?.phone === 'string'
                        ? (parsedSiteData?.contact as { phone: string }).phone
                        : null,
                  email:
                    typeof parsedSiteData?.contact_email === 'string'
                      ? parsedSiteData.contact_email
                      : typeof (parsedSiteData?.contact as { email?: unknown } | undefined)?.email === 'string'
                        ? (parsedSiteData?.contact as { email: string }).email
                        : null,
                  address:
                    typeof parsedSiteData?.address === 'string'
                      ? parsedSiteData.address
                      : typeof (parsedSiteData?.contact as { address?: unknown } | undefined)?.address === 'string'
                        ? (parsedSiteData?.contact as { address: string }).address
                        : null,
                  document:
                    typeof data.document === 'string'
                      ? data.document
                      : typeof parsedSiteData?.cnpj === 'string'
                        ? parsedSiteData.cnpj
                        : null,
                  logo_url:
                    typeof data.logo_url === 'string'
                      ? data.logo_url
                      : typeof parsedSiteData?.logo_url === 'string'
                        ? parsedSiteData.logo_url
                        : null,
                  logo_white_url:
                    typeof parsedSiteData?.logo_white_url === 'string'
                      ? parsedSiteData.logo_white_url
                      : null,
                  admin_signature_url:
                    typeof data.admin_signature_url === 'string'
                      ? data.admin_signature_url
                      : null,
                  template: normalizedTemplate,
                  template_id: siteDataTemplateId ?? normalizedTemplate,
                  finance_config: parsedFinanceConfig,
                  use_asaas:
                    typeof data.use_asaas === 'boolean'
                      ? data.use_asaas
                      : parsedFinanceConfig?.use_asaas ?? false,
                  default_commission:
                    data.default_commission ?? parsedFinanceConfig?.default_commission ?? null,
                  broker_commission:
                    data.broker_commission ?? parsedFinanceConfig?.broker_commission ?? null,
                  payment_api_key: data.payment_api_key ?? null,
                } as Company)
              : null
          );
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

  if (isRedirectingTenant) {
    return (
      <div className="min-h-screen w-full flex flex-col items-center justify-center text-brand-600 bg-white dark:bg-slate-900">
        <Loader2 className="animate-spin mb-4" size={46} />
        <p className="text-slate-600 dark:text-slate-200">Redirecionando para a Elevatio Vendas...</p>
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

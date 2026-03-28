import type { Company } from '../types';

export const getSiteData = (tenant: Company | null | undefined): any =>
  (tenant?.site_data as any) ?? {};

export const getPrimaryColor = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).primary_color || '#0f172a';

export const getSecondaryColor = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).secondary_color || '#3b82f6';

export const getTenantName = (tenant: Company | null | undefined): string =>
  tenant?.name || 'Imobiliária';

// Correção Crítica da Logo: A logo fica na RAIZ de tenant (tenant.logo_url) e não dentro de site_data!
export const getTenantLogo = (tenant: Company | null | undefined): string =>
  tenant?.logo_url || '/logo-placeholder.png';

export const getTenantLogoWhite = (tenant: Company | null | undefined): string =>
  tenant?.logo_white_url || tenant?.logo_url || '/logo-placeholder.png';

export const getTenantEmail = (tenant: Company | null | undefined): string =>
  tenant?.email || getSiteData(tenant).contact?.email || '';

export const getTenantPhone = (tenant: Company | null | undefined): string =>
  tenant?.phone || getSiteData(tenant).whatsapp || getSiteData(tenant).contact?.phone || '';

export const getTenantAddress = (tenant: Company | null | undefined): string =>
  tenant?.address || getSiteData(tenant).address || getSiteData(tenant).contact?.address || 'Endereço não informado';

export const getAboutText = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).about_text || `${getTenantName(tenant)} conecta pessoas e imóveis com atendimento próximo e suporte em cada etapa da negociação.`;

export const getSocialLink = (tenant: Company | null | undefined, key: string): string => {
  const siteData = getSiteData(tenant);
  return siteData[`social_${key}`] || siteData.social?.[key] || '';
};

export const cleanPhone = (value: string | null | undefined): string =>
  (value || '').replace(/\D/g, '');

export const getWhatsappLink = (tenant: Company | null | undefined, text?: string): string => {
  const digits = cleanPhone(getTenantPhone(tenant));
  if (!digits) return '';
  return text ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : `https://wa.me/${digits}`;
};

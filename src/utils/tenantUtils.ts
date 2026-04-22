import type { Company } from '../types';

export const getSiteData = (tenant: Company | null | undefined): any =>
  (tenant?.site_data as any) ?? {};

export const getPrimaryColor = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).primary_color || '#0f172a';

export const getSecondaryColor = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).secondary_color || '#3b82f6';

export const getTenantName = (tenant: Company | null | undefined): string =>
  tenant?.name || 'Imobiliária';

// A MÁGICA: Procura na raiz E no site_data para garantir que pega a logo do AdminSiteBuilder
export const getTenantLogo = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).logo_url || tenant?.logo_url || '/logo-placeholder.png';

export const getTenantLogoWhite = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).logo_white_url || tenant?.logo_white_url || getTenantLogo(tenant);

export const getTenantEmail = (tenant: Company | null | undefined): string =>
  tenant?.email || getSiteData(tenant).contact?.email || '';

export const getTenantPhone = (tenant: Company | null | undefined): string =>
  tenant?.phone || getSiteData(tenant).whatsapp || getSiteData(tenant).contact?.phone || '';

export const getTenantAddress = (tenant: Company | null | undefined): string => {
  const siteData = getSiteData(tenant);
  const addressData = siteData.address || siteData.contact?.address || tenant?.address;

  if (!addressData) return '';

  if (typeof addressData === 'string') return addressData;

  const parts: string[] = [];
  if (addressData.street) parts.push(addressData.street);
  if (addressData.number) parts.push(addressData.number);
  if (addressData.neighborhood) parts.push(addressData.neighborhood);
  if (addressData.city) parts.push(`${addressData.city}${addressData.state ? ` - ${addressData.state}` : ''}`);
  if (addressData.zip) parts.push(`CEP: ${addressData.zip}`);

  return parts.join(', ');
};

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

export const getTenantMapLink = (tenant: Company | null | undefined): string => {
  const siteData = getSiteData(tenant);
  const addr = siteData.address || siteData.contact?.address;

  if (addr && typeof addr !== 'string' && addr.lat && addr.lng) {
    return `https://www.google.com/maps?q=${addr.lat},${addr.lng}`;
  }

  const addressString = getTenantAddress(tenant);
  if (addressString) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(addressString)}`;
  }

  return '#';
};

export const getTenantCreci = (tenant: Company | null | undefined): string => {
  const creci = getSiteData(tenant).creci;
  return creci ? `CRECI: ${creci}` : '';
};

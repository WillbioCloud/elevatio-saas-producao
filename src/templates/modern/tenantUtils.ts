import type { Company, SiteData } from '../../types';

type SocialKey = 'instagram' | 'facebook' | 'youtube' | 'linkedin' | 'whatsapp';

type ModernSiteData = SiteData & {
  address?: string | null;
  whatsapp?: string | null;
  social_links?: Partial<Record<SocialKey, string | null>>;
  template?: string | null;
};

const EMPTY_SITE_DATA: ModernSiteData = {};

export const getSiteData = (tenant: Company | null | undefined): ModernSiteData =>
  (tenant?.site_data as ModernSiteData | undefined) ?? EMPTY_SITE_DATA;

export const getPrimaryColor = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).primary_color || '#0f172a';

export const getSecondaryColor = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).secondary_color || '#3b82f6';

export const getTenantName = (tenant: Company | null | undefined): string =>
  tenant?.name || 'Imobiliária';

export const getTenantLogo = (tenant: Company | null | undefined): string =>
  tenant?.logo_url || '/logo-placeholder.png';

export const getTenantLogoWhite = (tenant: Company | null | undefined): string =>
  tenant?.logo_white_url || tenant?.logo_url || '/logo-placeholder.png';

export const getTenantEmail = (tenant: Company | null | undefined): string =>
  tenant?.email ||
  getSiteData(tenant).contact?.email ||
  '';

export const getTenantPhone = (tenant: Company | null | undefined): string =>
  tenant?.phone ||
  getSiteData(tenant).whatsapp ||
  getSiteData(tenant).contact?.phone ||
  getSiteData(tenant).social?.whatsapp ||
  getSiteData(tenant).social_links?.whatsapp ||
  '';

export const getTenantAddress = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).address ||
  tenant?.address ||
  getSiteData(tenant).contact?.address ||
  'Endereço não informado';

export const getHeroTitle = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).hero_title || 'Imóveis para viver e investir';

export const getHeroSubtitle = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).hero_subtitle || 'Encontre oportunidades exclusivas com atendimento consultivo e visão de longo prazo.';

export const getAboutText = (tenant: Company | null | undefined): string =>
  getSiteData(tenant).about_text ||
  `${getTenantName(tenant)} conecta pessoas e imóveis com atendimento próximo, curadoria de oportunidades e suporte em cada etapa da negociação.`;

export const getSocialLink = (tenant: Company | null | undefined, key: SocialKey): string => {
  const siteData = getSiteData(tenant);

  const legacySocial = {
    instagram: siteData.social?.instagram,
    facebook: siteData.social?.facebook,
    youtube: siteData.social?.youtube,
    linkedin: undefined,
    whatsapp: siteData.social?.whatsapp,
  } satisfies Partial<Record<SocialKey, string | null | undefined>>;

  const flatSocial = {
    instagram: siteData.social_instagram,
    facebook: siteData.social_facebook,
    youtube: siteData.social_youtube,
    linkedin: siteData.social_linkedin,
    whatsapp: undefined,
  } satisfies Partial<Record<SocialKey, string | null | undefined>>;

  const directLink =
    siteData.social_links?.[key] ||
    flatSocial[key] ||
    legacySocial[key];

  return typeof directLink === 'string' ? directLink : '';
};

export const cleanPhone = (value: string | null | undefined): string =>
  (value || '').replace(/\D/g, '');

export const getWhatsappLink = (tenant: Company | null | undefined, text?: string): string => {
  const digits = cleanPhone(getTenantPhone(tenant));
  if (!digits) return '';

  return text
    ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}`
    : `https://wa.me/${digits}`;
};

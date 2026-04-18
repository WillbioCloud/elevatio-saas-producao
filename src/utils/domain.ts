export const MAIN_DOMAIN = 'elevatiovendas.com.br';
export const MAIN_DOMAIN_URL = `https://${MAIN_DOMAIN}`;

const PLATFORM_DOMAINS = [
  MAIN_DOMAIN,
  'elevatiovendas.com',
  'elevatiovendas.vercel.app',
] as const;

const MASTER_HOSTS = [
  'localhost',
  '127.0.0.1',
  'lvh.me',
  'app-elevatiovendas.vercel.app',
] as const;

const RESERVED_PLATFORM_SUBDOMAINS = new Set(['www', 'app']);
const SUPER_ADMIN_SUBDOMAINS = new Set(['admin']);

export type HostEnvironmentType = 'landing' | 'superadmin' | 'app' | 'website';

export type HostData = {
  hostname: string;
  type: HostEnvironmentType;
  isMasterDomain: boolean;
  slug: string | null;
  customDomain: string | null;
  shouldRedirectOnTenantNotFound: boolean;
};

const normalizeHostname = (hostname: string): string =>
  hostname
    .trim()
    .toLowerCase()
    .replace(/:\d+$/, '')
    .replace(/\.$/, '');

const stripLeadingWww = (hostname: string): string => hostname.replace(/^www\./, '');

const normalizeSubdomain = (rawSubdomain: string): string | null => {
  const labels = rawSubdomain.split('.').filter(Boolean);
  const withoutWww = labels[0] === 'www' ? labels.slice(1) : labels;
  const candidate = withoutWww.join('.');

  if (!candidate || RESERVED_PLATFORM_SUBDOMAINS.has(candidate)) {
    return null;
  }

  return candidate;
};

const getSubdomainForDomain = (hostname: string, domain: string): string | null => {
  if (hostname === domain || hostname === `www.${domain}`) {
    return null;
  }

  if (!hostname.endsWith(`.${domain}`)) {
    return null;
  }

  return normalizeSubdomain(hostname.slice(0, -(domain.length + 1)));
};

const getRawSubdomainForDomain = (hostname: string, domain: string): string | null => {
  if (!hostname.endsWith(`.${domain}`)) {
    return null;
  }

  return hostname.slice(0, -(domain.length + 1));
};

export const getTenantSubdomainFromHostname = (hostname: string): string | null => {
  const normalizedHostname = normalizeHostname(hostname);
  return getSubdomainForDomain(normalizedHostname, MAIN_DOMAIN);
};

export const getHostData = (hostname: string): HostData => {
  const normalizedHostname = normalizeHostname(hostname);

  if (MASTER_HOSTS.includes(normalizedHostname as (typeof MASTER_HOSTS)[number])) {
    return {
      hostname: normalizedHostname,
      type: 'landing',
      isMasterDomain: true,
      slug: null,
      customDomain: null,
      shouldRedirectOnTenantNotFound: false,
    };
  }

  if (normalizedHostname.endsWith('.localhost')) {
    const localSlug = normalizeSubdomain(normalizedHostname.replace(/\.localhost$/, ''));

    if (!localSlug) {
      return {
        hostname: normalizedHostname,
        type: 'landing',
        isMasterDomain: true,
        slug: null,
        customDomain: null,
        shouldRedirectOnTenantNotFound: false,
      };
    }

    return {
      hostname: normalizedHostname,
      type: 'app',
      isMasterDomain: false,
      slug: localSlug,
      customDomain: null,
      shouldRedirectOnTenantNotFound: false,
    };
  }

  if (normalizedHostname.endsWith('.lvh.me')) {
    const localSlug = normalizeSubdomain(normalizedHostname.replace(/\.lvh\.me$/, ''));

    if (!localSlug) {
      return {
        hostname: normalizedHostname,
        type: 'landing',
        isMasterDomain: true,
        slug: null,
        customDomain: null,
        shouldRedirectOnTenantNotFound: false,
      };
    }

    return {
      hostname: normalizedHostname,
      type: 'app',
      isMasterDomain: false,
      slug: localSlug,
      customDomain: null,
      shouldRedirectOnTenantNotFound: false,
    };
  }

  for (const domain of PLATFORM_DOMAINS) {
    const rawSubdomain = getRawSubdomainForDomain(normalizedHostname, domain);
    const subdomain = getSubdomainForDomain(normalizedHostname, domain);

    if (normalizedHostname === domain || normalizedHostname === `www.${domain}`) {
      return {
        hostname: normalizedHostname,
        type: 'landing',
        isMasterDomain: true,
        slug: null,
        customDomain: null,
        shouldRedirectOnTenantNotFound: false,
      };
    }

    if (rawSubdomain && RESERVED_PLATFORM_SUBDOMAINS.has(rawSubdomain)) {
      return {
        hostname: normalizedHostname,
        type: rawSubdomain === 'app' ? 'app' : 'landing',
        isMasterDomain: true,
        slug: null,
        customDomain: null,
        shouldRedirectOnTenantNotFound: false,
      };
    }

    if (!subdomain) {
      if (rawSubdomain) {
        return {
          hostname: normalizedHostname,
          type: rawSubdomain.endsWith('app') ? 'app' : 'landing',
          isMasterDomain: true,
          slug: null,
          customDomain: null,
          shouldRedirectOnTenantNotFound: false,
        };
      }

      continue;
    }

    if (SUPER_ADMIN_SUBDOMAINS.has(subdomain)) {
      return {
        hostname: normalizedHostname,
        type: 'superadmin',
        isMasterDomain: true,
        slug: null,
        customDomain: null,
        shouldRedirectOnTenantNotFound: false,
      };
    }

    return {
      hostname: normalizedHostname,
      type: 'app',
      isMasterDomain: false,
      slug: subdomain,
      customDomain: null,
      shouldRedirectOnTenantNotFound: domain === MAIN_DOMAIN,
    };
  }

  return {
    hostname: normalizedHostname,
    type: 'website',
    isMasterDomain: false,
    slug: null,
    customDomain: stripLeadingWww(normalizedHostname),
    shouldRedirectOnTenantNotFound: false,
  };
};

export const getEnvironment = (hostname: string): {
  type: HostEnvironmentType;
  subdomain?: string;
  customDomain?: string;
} => {
  const hostData = getHostData(hostname);

  return {
    type: hostData.type,
    subdomain: hostData.slug ?? undefined,
    customDomain: hostData.customDomain ?? undefined,
  };
};

export const buildTenantNotFoundRedirectUrl = (slug: string): string => {
  const url = new URL(MAIN_DOMAIN_URL);
  url.searchParams.set('tenant_status', 'not-found');
  url.searchParams.set('tenant_slug', slug);
  return url.toString();
};

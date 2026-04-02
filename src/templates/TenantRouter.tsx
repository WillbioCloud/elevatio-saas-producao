import React, { Suspense } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';
import { templatesRegistry } from './templateRegistry';

// Lazy imports keep each template split into its own chunk.

// Basico
const BasicoLayout = React.lazy(() => import('./basico/BasicoLayout'));
const BasicoHome = React.lazy(() => import('./basico/pages/Home'));
const BasicoProperties = React.lazy(() => import('./basico/pages/BasicoProperties'));
const BasicoPropertyDetail = React.lazy(() => import('./basico/pages/BasicoPropertyDetail'));

// Classic
const ClassicLayout = React.lazy(() => import('./classic/ClassicLayout'));
const ClassicHome = React.lazy(() => import('./classic/pages/Home'));
const ClassicProperties = React.lazy(() => import('./classic/pages/Properties'));
const ClassicPropertyDetail = React.lazy(() => import('./classic/pages/PropertyDetail'));
const ClassicAbout = React.lazy(() => import('./classic/pages/About'));
const ClassicServices = React.lazy(() => import('./classic/pages/Services'));
const ClassicFinanciamentos = React.lazy(() => import('./classic/pages/Financiamentos'));

// Luxury
const LuxuryLayout = React.lazy(() => import('./luxury/LuxuryLayout'));
const LuxuryHome = React.lazy(() => import('./luxury/pages/Home'));
const LuxuryProperties = React.lazy(() => import('./luxury/pages/Properties'));
const LuxuryPropertyDetail = React.lazy(() => import('./luxury/pages/PropertyDetail'));
const LuxuryServices = React.lazy(() => import('./luxury/pages/Services'));
const LuxuryAbout = React.lazy(() => import('./luxury/pages/About'));

// Minimalist
const MinimalistLayout = React.lazy(() => import('./minimalist/MinimalistLayout'));
const MinimalistHome = React.lazy(() => import('./minimalist/pages/Home'));

// Modern
const ModernLayout = React.lazy(() => import('./modern/ModernLayout'));
const ModernHome = React.lazy(() => import('./modern/pages/Home'));
const ModernProperties = React.lazy(() => import('./modern/pages/Properties'));
const ModernPropertyDetail = React.lazy(() => import('./modern/pages/PropertyDetail'));
const ModernAbout = React.lazy(() => import('./modern/pages/About'));
const ModernServices = React.lazy(() => import('./modern/pages/Services'));
const ModernFinanciamentos = React.lazy(() => import('./modern/pages/Financiamentos'));

const TemplateLoader = () => (
  <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e]">
    <div className="w-8 h-8 border-4 border-neutral-800 border-t-white rounded-full animate-spin"></div>
  </div>
);

type TenantRouterProps = {
  customDomain?: string;
};

const parseTenantSiteData = (siteData: unknown): Record<string, unknown> => {
  if (!siteData) {
    return {};
  }

  if (typeof siteData === 'string') {
    try {
      const parsed = JSON.parse(siteData);
      return parsed && typeof parsed === 'object' ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  return typeof siteData === 'object' ? (siteData as Record<string, unknown>) : {};
};

export default function TenantRouter(_props: TenantRouterProps) {
  const { tenant, isLoadingTenant } = useTenant();

  if (isLoadingTenant) {
    return <TemplateLoader />;
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0e0e0e] text-white">
        <h2>Site não encontrado ou inativo.</h2>
      </div>
    );
  }

  const siteData = parseTenantSiteData(tenant.site_data);

  // Blindagem: aceita template salvo em coluna dedicada, legado ou dentro do site_data.
  const rawTemplate =
    tenant.template_id ??
    tenant.template ??
    siteData.template_id ??
    siteData.template ??
    'modern';
  const currentTemplateId = String(rawTemplate).toLowerCase().trim();
  const safeTemplateId = Object.prototype.hasOwnProperty.call(templatesRegistry, currentTemplateId)
    ? currentTemplateId
    : 'modern';

  const Layout =
    safeTemplateId === 'luxury' ? LuxuryLayout :
    safeTemplateId === 'basico' ? BasicoLayout :
    safeTemplateId === 'classic' ? ClassicLayout :
    safeTemplateId === 'minimalist' ? MinimalistLayout :
    ModernLayout;

  const Home =
    safeTemplateId === 'luxury' ? LuxuryHome :
    safeTemplateId === 'basico' ? BasicoHome :
    safeTemplateId === 'classic' ? ClassicHome :
    safeTemplateId === 'minimalist' ? MinimalistHome :
    ModernHome;

  const PropertiesPage =
    safeTemplateId === 'luxury' ? LuxuryProperties :
    safeTemplateId === 'basico' ? BasicoProperties :
    safeTemplateId === 'classic' ? ClassicProperties :
    ModernProperties;

  const PropertyDetailPage =
    safeTemplateId === 'luxury' ? LuxuryPropertyDetail :
    safeTemplateId === 'basico' ? BasicoPropertyDetail :
    safeTemplateId === 'classic' ? ClassicPropertyDetail :
    ModernPropertyDetail;

  const AboutPage =
    safeTemplateId === 'luxury' ? LuxuryAbout :
    safeTemplateId === 'classic' ? ClassicAbout :
    ModernAbout;

  const ServicesPage =
    safeTemplateId === 'luxury' ? LuxuryServices :
    safeTemplateId === 'classic' ? ClassicServices :
    ModernServices;

  const FinancingPage = safeTemplateId === 'classic' ? ClassicFinanciamentos : ModernFinanciamentos;

  return (
    <Suspense fallback={<TemplateLoader />}>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="imoveis" element={<PropertiesPage />} />
          <Route path="imovel/:id" element={<PropertyDetailPage />} />
          <Route path="imovel/:slug" element={<PropertyDetailPage />} />
          <Route path="sobre" element={<AboutPage />} />
          <Route path="servicos" element={<ServicesPage />} />
          <Route path="financiamentos" element={<FinancingPage />} />
          <Route path="financiamento" element={<Navigate to="/financiamentos" replace />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

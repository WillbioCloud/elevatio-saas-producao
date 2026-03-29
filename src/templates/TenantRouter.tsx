import React from 'react';
import { Route, Routes, Navigate } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

// Basico
import BasicoLayout from './basico/BasicoLayout';
import BasicoHome from './basico/pages/Home';
import BasicoProperties from './basico/pages/BasicoProperties';
import BasicoPropertyDetail from './basico/pages/BasicoPropertyDetail';

// Classic
import ClassicLayout from './classic/ClassicLayout';
import ClassicHome from './classic/pages/Home';
import ClassicProperties from './classic/pages/Properties';
import ClassicPropertyDetail from './classic/pages/PropertyDetail';
import ClassicAbout from './classic/pages/About';
import ClassicServices from './classic/pages/Services';
import ClassicFinanciamentos from './classic/pages/Financiamentos';

// Luxury
import LuxuryLayout from './luxury/LuxuryLayout';
import LuxuryHome from './luxury/pages/Home';
import LuxuryProperties from './luxury/pages/Properties';
import LuxuryPropertyDetail from './luxury/pages/PropertyDetail';
import LuxuryAbout from './luxury/pages/About';

// Minimalist (Usa as páginas do Modern como fallback onde não tem próprias)
import MinimalistLayout from './minimalist/MinimalistLayout';
import MinimalistHome from './minimalist/pages/Home';

// Modern
import ModernLayout from './modern/ModernLayout';
import ModernHome from './modern/pages/Home';
import ModernProperties from './modern/pages/Properties';
import ModernPropertyDetail from './modern/pages/PropertyDetail';
import ModernAbout from './modern/pages/About';
import ModernServices from './modern/pages/Services';
import ModernFinanciamentos from './modern/pages/Financiamentos';

export default function TenantRouter() {
  const { tenant, isLoadingTenant } = useTenant();

  if (isLoadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500" />
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <h1 className="text-2xl">Site não encontrado ou inativo.</h1>
      </div>
    );
  }

  const templateName = tenant?.site_data?.template || tenant?.template || 'classic';

  // Fallbacks: Se o template não tem uma página específica (ex: Minimalist não tem About), usa a do Modern.
  const Layout =
    templateName === 'luxury' ? LuxuryLayout :
    templateName === 'minimalist' ? MinimalistLayout :
    templateName === 'basico' ? BasicoLayout :
    templateName === 'classic' ? ClassicLayout :
    ModernLayout;

  const Home =
    templateName === 'luxury' ? LuxuryHome :
    templateName === 'minimalist' ? MinimalistHome :
    templateName === 'basico' ? BasicoHome :
    templateName === 'classic' ? ClassicHome :
    ModernHome;

  const PropertiesPage =
    templateName === 'luxury' ? LuxuryProperties :
    templateName === 'basico' ? BasicoProperties :
    templateName === 'classic' ? ClassicProperties :
    ModernProperties; // Minimalist usa o ModernProperties

  const PropertyDetailPage =
    templateName === 'luxury' ? LuxuryPropertyDetail :
    templateName === 'basico' ? BasicoPropertyDetail :
    templateName === 'classic' ? ClassicPropertyDetail :
    ModernPropertyDetail; // Minimalist usa o ModernPropertyDetail

  const AboutPage =
    templateName === 'luxury' ? LuxuryAbout :
    templateName === 'classic' ? ClassicAbout :
    ModernAbout;
  const ServicesPage = templateName === 'classic' ? ClassicServices : ModernServices;
  const FinancingPage = templateName === 'classic' ? ClassicFinanciamentos : ModernFinanciamentos;

  return (
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
  );
}

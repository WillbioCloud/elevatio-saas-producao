import React from 'react';
import { Route, Routes } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

import BasicoLayout from './basico/BasicoLayout';
import BasicoHome from './basico/pages/Home';
import BasicoProperties from './basico/pages/BasicoProperties';
import BasicoPropertyDetail from './basico/pages/BasicoPropertyDetail';

import ClassicLayout from './classic/ClassicLayout';
import ClassicHome from './classic/pages/Home';
import ClassicProperties from './classic/pages/Properties';
import ClassicPropertyDetail from './classic/pages/PropertyDetail';
import ClassicAbout from './classic/pages/About';
import ClassicServices from './classic/pages/Services';
import ClassicFinanciamentos from './classic/pages/Financiamentos';

import LuxuryLayout from './luxury/LuxuryLayout';
import LuxuryHome from './luxury/pages/Home';
import LuxuryProperties from './luxury/pages/Properties';
import LuxuryPropertyDetail from './luxury/pages/PropertyDetail';

import MinimalistLayout from './minimalist/MinimalistLayout';
import MinimalistHome from './minimalist/pages/Home';

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

  const Layout =
    templateName === 'luxury' ? LuxuryLayout :
    templateName === 'modern' ? ModernLayout :
    templateName === 'minimalist' ? MinimalistLayout :
    templateName === 'basico' ? BasicoLayout :
    ClassicLayout;

  const Home =
    templateName === 'luxury' ? LuxuryHome :
    templateName === 'modern' ? ModernHome :
    templateName === 'minimalist' ? MinimalistHome :
    templateName === 'basico' ? BasicoHome :
    ClassicHome;

  const PropertiesPage =
    templateName === 'luxury' ? LuxuryProperties :
    templateName === 'modern' ? ModernProperties :
    templateName === 'basico' ? BasicoProperties :
    ClassicProperties;

  const PropertyDetailPage =
    templateName === 'luxury' ? LuxuryPropertyDetail :
    templateName === 'modern' ? ModernPropertyDetail :
    templateName === 'basico' ? BasicoPropertyDetail :
    ClassicPropertyDetail;

  const AboutPage =
    templateName === 'modern' ? ModernAbout : ClassicAbout;

  const ServicesPage =
    templateName === 'modern' ? ModernServices : ClassicServices;

  const FinancingPage =
    templateName === 'modern' ? ModernFinanciamentos : ClassicFinanciamentos;

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
        <Route path="financiamento" element={<FinancingPage />} />
      </Route>
    </Routes>
  );
}

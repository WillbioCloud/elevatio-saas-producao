import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTenant } from '../contexts/TenantContext';

// Layouts
import MinimalistLayout from './minimalist/MinimalistLayout';
import LuxuryLayout from './luxury/LuxuryLayout';
import ModernLayout from './modern/ModernLayout';
import ClassicLayout from './classic/ClassicLayout';

// Home Pages
import MinimalistHome from './minimalist/pages/Home';
import LuxuryHome from './luxury/pages/Home';
import ModernHome from './modern/pages/Home';
import ClassicHome from './classic/pages/Home';
import BasicoHome from './basico/pages/Home';

// Layout Básico
import BasicoLayout from './basico/BasicoLayout';

// Páginas Internas Compartilhadas (Classic / fallback)
import Properties from './classic/pages/Properties';
import PropertyDetail from './classic/pages/PropertyDetail';
import About from './classic/pages/About';
import Services from './classic/pages/Services';

// Páginas específicas Modern
import ModernProperties from './modern/pages/ModernProperties';
import ModernPropertyDetail from './modern/pages/ModernPropertyDetail';

// Páginas específicas Luxury
import LuxuryProperties from './luxury/pages/Properties';
import LuxuryPropertyDetail from './luxury/pages/PropertyDetail';

// Páginas específicas Básico
import BasicoProperties from './basico/pages/BasicoProperties';
import BasicoPropertyDetail from './basico/pages/BasicoPropertyDetail';

export default function TenantRouter() {
  const { tenant, isLoadingTenant } = useTenant();

  if (isLoadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
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

  // Define 'classic' como o template Premium padrão se não houver nenhum selecionado
  const templateName = tenant?.template || 'classic';

  // Componentes Dinâmicos (Agora com o Classic incluído!)
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
    Properties;

  const PropertyDetailPage =
    templateName === 'luxury' ? LuxuryPropertyDetail :
    templateName === 'modern' ? ModernPropertyDetail :
    templateName === 'basico' ? BasicoPropertyDetail :
    PropertyDetail;

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Home dinâmica dependendo do template */}
        <Route index element={<Home />} />

        {/* Páginas internas */}
        <Route path="imoveis" element={<PropertiesPage />} />
        {/* Aceita tanto id quanto slug como parâmetro genérico */}
        <Route path="imovel/:id" element={<PropertyDetailPage />} />
        <Route path="imovel/:slug" element={<PropertyDetailPage />} />
        <Route path="sobre" element={<About />} />
        <Route path="servicos" element={<Services />} />
      </Route>
    </Routes>
  );
}

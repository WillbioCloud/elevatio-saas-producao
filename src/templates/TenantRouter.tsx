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

// Páginas Internas Compartilhadas
import Properties from './classic/pages/Properties';
import PropertyDetail from './classic/pages/PropertyDetail';
import About from './classic/pages/About';
import Services from './classic/pages/Services';

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
    ClassicLayout;

  const Home = 
    templateName === 'luxury' ? LuxuryHome : 
    templateName === 'modern' ? ModernHome : 
    templateName === 'minimalist' ? MinimalistHome : 
    ClassicHome;

  return (
    <Routes>
      <Route element={<Layout />}>
        {/* Home dinâmica dependendo do template */}
        <Route index element={<Home />} />
        
        {/* Páginas internas */}
        <Route path="imoveis" element={<Properties />} />
        <Route path="imoveis/:id" element={<PropertyDetail />} />
        <Route path="sobre" element={<About />} />
        <Route path="servicos" element={<Services />} />
      </Route>
    </Routes>
  );
}

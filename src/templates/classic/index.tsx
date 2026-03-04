import React from 'react';
import { Routes, Route } from 'react-router-dom';
import ClassicLayout from './ClassicLayout';
import Home from './pages/Home';
import Properties from './pages/Properties';
import PropertyDetail from './pages/PropertyDetail';
import About from './pages/About';
import Services from './pages/Services';
import Financiamentos from './pages/Financiamentos';
import AnimatedPage from '../../components/AnimatedPage';

export default function ClassicTemplate() {
  return (
    <ClassicLayout>
      <Routes>
        <Route path="/" element={<AnimatedPage><Home /></AnimatedPage>} />
        <Route path="/imoveis" element={<AnimatedPage><Properties /></AnimatedPage>} />
        <Route path="/imoveis/:slug" element={<AnimatedPage><PropertyDetail /></AnimatedPage>} />
        <Route path="/bairros/:slug" element={<AnimatedPage><Properties /></AnimatedPage>} />
        <Route path="/sobre" element={<AnimatedPage><About /></AnimatedPage>} />
        <Route path="/servicos" element={<AnimatedPage><Services /></AnimatedPage>} />
        <Route path="/financiamentos" element={<AnimatedPage><Financiamentos /></AnimatedPage>} />
      </Routes>
    </ClassicLayout>
  );
}

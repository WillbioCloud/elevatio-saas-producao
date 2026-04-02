import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

export type TemplateStatus = 'disponivel' | 'em_breve' | 'manutencao';

type TemplateComponent = LazyExoticComponent<ComponentType<any>>;

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  status: TemplateStatus;
  component: TemplateComponent;
}

const LuxuryLayout = lazy(() => import('./luxury/LuxuryLayout'));
const ModernLayout = lazy(() => import('./modern/ModernLayout'));
const BasicoLayout = lazy(() => import('./basico/BasicoLayout'));
const ClassicLayout = lazy(() => import('./classic/ClassicLayout'));
const MinimalistLayout = lazy(() => import('./minimalist/MinimalistLayout'));
const DraftModernLayout = lazy(() => import('./draft_modern/ModernLayout'));

export const templatesRegistry = {
  luxury: {
    id: 'luxury',
    name: 'Alto Padrão (Luxo)',
    description: 'Design escuro e elegante, perfeito para imóveis premium.',
    status: 'disponivel',
    component: LuxuryLayout,
  },
  modern: {
    id: 'modern',
    name: 'Moderno Contemporâneo',
    description: 'Visual focado em conversão e usabilidade rápida.',
    status: 'disponivel',
    component: ModernLayout,
  },
  basico: {
    id: 'basico',
    name: 'Essencial',
    description: 'Simples, direto ao ponto e muito rápido.',
    status: 'disponivel',
    component: BasicoLayout,
  },
  classic: {
    id: 'classic',
    name: 'Clássico Tradicional',
    description: 'Para imobiliárias que buscam passar tradição e solidez.',
    status: 'disponivel',
    component: ClassicLayout,
  },
  minimalist: {
    id: 'minimalist',
    name: 'Minimalista',
    description: 'Foco total nas fotografias dos imóveis.',
    status: 'disponivel',
    component: MinimalistLayout,
  },
  draft_modern: {
    id: 'draft_modern',
    name: 'Moderno V2 (Beta)',
    description: 'Nova versão em desenvolvimento.',
    status: 'em_breve',
    component: DraftModernLayout,
  },
} satisfies Record<string, TemplateConfig>;

export type TemplateRegistryKey = keyof typeof templatesRegistry;

export const templatesList = Object.values(templatesRegistry);

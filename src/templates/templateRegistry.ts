import { lazy } from 'react';

export type TemplateStatus = 'disponivel' | 'em_breve' | 'manutencao';

export interface TemplateConfig {
  id: string;          // O ID que vai pro banco de dados (ex: 'luxury')
  name: string;        // O nome bonito em Português
  description: string; // Uma breve descrição para o painel
  status: TemplateStatus;
  component: React.LazyExoticComponent<any>;
}

// 🚀 A MÁGICA DO CODE SPLITTING: 
// O 'lazy' faz com que o Vercel quebre cada template em um arquivo separado.
// O navegador do cliente SÓ VAI BAIXAR o template que a imobiliária estiver usando!
const LuxuryLayout = lazy(() => import('./luxury/LuxuryLayout'));
const ModernLayout = lazy(() => import('./modern/ModernLayout'));
const BasicoLayout = lazy(() => import('./basico/BasicoLayout'));
const ClassicLayout = lazy(() => import('./classic/ClassicLayout'));
const MinimalistLayout = lazy(() => import('./minimalist/MinimalistLayout'));

// Se você tiver um draft, pode importar também, mas deixamos bloqueado pro usuário final
const DraftModernLayout = lazy(() => import('./draft_modern/ModernLayout'));

export const templatesRegistry: TemplateConfig[] = [
  {
    id: 'luxury',
    name: 'Alto Padrão (Luxo)',
    description: 'Design escuro e elegante, perfeito para imóveis premium.',
    status: 'disponivel',
    component: LuxuryLayout,
  },
  {
    id: 'modern',
    name: 'Moderno Contemporâneo',
    description: 'Visual focado em conversão e usabilidade rápida.',
    status: 'disponivel',
    component: ModernLayout,
  },
  {
    id: 'basico',
    name: 'Essencial',
    description: 'Simples, direto ao ponto e muito rápido.',
    status: 'disponivel',
    component: BasicoLayout,
  },
  {
    id: 'classic',
    name: 'Clássico Tradicional',
    description: 'Para imobiliárias que buscam passar tradição e solidez.',
    status: 'disponivel',
    component: ClassicLayout,
  },
  {
    id: 'minimalist',
    name: 'Minimalista',
    description: 'Foco total nas fotografias dos imóveis.',
    status: 'disponivel',
    component: MinimalistLayout,
  },
  {
    id: 'draft_modern',
    name: 'Moderno V2 (Beta)',
    description: 'Nova versão em desenvolvimento.',
    status: 'em_breve', // Este não vai deixar selecionar no painel!
    component: DraftModernLayout,
  }
];
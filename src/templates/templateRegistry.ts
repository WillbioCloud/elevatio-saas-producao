import { lazy, type ComponentType, type LazyExoticComponent } from 'react';

type TemplateComponent = LazyExoticComponent<ComponentType<any>>;

export interface TemplateRegistryItem {
  component: TemplateComponent;
}

// 1. Importacao Dinamica (Lazy Load) para o site carregar super rapido
const LuxuryLayout = lazy(() => import('./luxury/LuxuryLayout'));
const ModernLayout = lazy(() => import('./modern/ModernLayout'));
const BasicoLayout = lazy(() => import('./basico/BasicoLayout'));
const ClassicLayout = lazy(() => import('./classic/ClassicLayout'));
const MinimalistLayout = lazy(() => import('./minimalist/MinimalistLayout'));
const DraftModernLayout = lazy(() => import('./draft_modern/ModernLayout'));

// 2. O Dicionario de Codigos: Mapeia o SLUG do banco de dados para o Componente React Real
export const templatesRegistry: Record<string, TemplateRegistryItem> = {
  luxury: { component: LuxuryLayout },
  modern: { component: ModernLayout },
  basico: { component: BasicoLayout },
  classic: { component: ClassicLayout },
  minimalist: { component: MinimalistLayout },
  draft_modern: { component: DraftModernLayout },
};

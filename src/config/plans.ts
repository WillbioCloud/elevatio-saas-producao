export type PlanType = 'free' | 'starter' | 'basic' | 'profissional' | 'business' | 'premium' | 'elite';

export interface PlanLimits {
  maxUsers: number;
  maxProperties: number;
  maxAiDescriptionsPerDay: number;
  features: {
    crm: boolean;
    leadsPipeline: boolean;
    gamification: boolean;
    contractsAndFinance: boolean;
    aiAura: boolean;
    portalsIntegration: boolean;
    automation: boolean;
  };
}

export interface PlanCatalogItem {
  id: PlanType;
  name: string;
  description: string;
  price: number;
  priceMensal: number;
  priceAnual: number;
  features: string[];
  limits: {
    users: number;
    properties: number;
    leads: number;
  };
}

export const PLAN_CONFIG: Record<PlanType, PlanLimits> = {
  free: {
    maxUsers: 1, maxProperties: 5, maxAiDescriptionsPerDay: 5,
    features: { crm: true, leadsPipeline: false, gamification: false, contractsAndFinance: false, aiAura: false, portalsIntegration: false, automation: false }
  },
  starter: {
    maxUsers: 2, maxProperties: 50, maxAiDescriptionsPerDay: 50,
    features: { crm: true, leadsPipeline: false, gamification: false, contractsAndFinance: false, aiAura: false, portalsIntegration: false, automation: false }
  },
  basic: {
    maxUsers: 5, maxProperties: 400, maxAiDescriptionsPerDay: 200,
    features: { crm: true, leadsPipeline: true, gamification: false, contractsAndFinance: false, aiAura: false, portalsIntegration: false, automation: false }
  },
  profissional: {
    maxUsers: 8, maxProperties: 1000, maxAiDescriptionsPerDay: 600,
    features: { crm: true, leadsPipeline: true, gamification: true, contractsAndFinance: false, aiAura: false, portalsIntegration: false, automation: false }
  },
  business: {
    maxUsers: 12, maxProperties: 2000, maxAiDescriptionsPerDay: 1000,
    features: { crm: true, leadsPipeline: true, gamification: true, contractsAndFinance: true, aiAura: false, portalsIntegration: false, automation: true }
  },
  premium: {
    maxUsers: 20, maxProperties: 3500, maxAiDescriptionsPerDay: 1450,
    features: { crm: true, leadsPipeline: true, gamification: true, contractsAndFinance: true, aiAura: true, portalsIntegration: false, automation: true }
  },
  elite: {
    maxUsers: 999999, maxProperties: 999999, maxAiDescriptionsPerDay: 999999,
    features: { crm: true, leadsPipeline: true, gamification: true, contractsAndFinance: true, aiAura: true, portalsIntegration: true, automation: true }
  }
};

const PLAN_ALIASES: Record<string, PlanType> = {
  professional: 'profissional',
};

export const normalizePlanType = (value: unknown, fallback?: PlanType): PlanType | undefined => {
  if (typeof value !== 'string') return fallback;

  const normalizedValue = value.trim().toLowerCase();
  if (!normalizedValue) return fallback;

  if (normalizedValue in PLAN_CONFIG) {
    return normalizedValue as PlanType;
  }

  return PLAN_ALIASES[normalizedValue] ?? fallback;
};

export const getPlanConfig = (value: unknown, fallback: PlanType = 'free'): PlanLimits => {
  const normalizedPlan = normalizePlanType(value, fallback) ?? fallback;
  return PLAN_CONFIG[normalizedPlan];
};

export const PLANS: PlanCatalogItem[] = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Ideal para corretores independentes que estão começando.',
    price: 54.90,
    priceMensal: 54.90,
    priceAnual: 43.92, // Valor mensal no plano anual (20% OFF)
    features: ['Até 2 usuários', 'Até 50 imóveis', '50 descrições com IA/mês', 'CRM Básico'],
    limits: { users: PLAN_CONFIG.starter.maxUsers, properties: PLAN_CONFIG.starter.maxProperties, leads: -1 }
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Para pequenas imobiliárias com foco em crescimento.',
    price: 74.90,
    priceMensal: 74.90,
    priceAnual: 59.92,
    features: ['Até 5 usuários', 'Até 400 imóveis', 'Pipeline de Leads', 'Gestão de Tarefas'],
    limits: { users: PLAN_CONFIG.basic.maxUsers, properties: PLAN_CONFIG.basic.maxProperties, leads: -1 }
  },
  {
    id: 'profissional',
    name: 'Profissional',
    description: 'O padrão da indústria para imobiliárias consolidadas.',
    price: 119.90,
    priceMensal: 119.90,
    priceAnual: 95.92,
    features: ['Até 8 usuários', 'Até 1000 imóveis', 'Gamificação', 'Relatórios Avançados'],
    limits: { users: PLAN_CONFIG.profissional.maxUsers, properties: PLAN_CONFIG.profissional.maxProperties, leads: -1 }
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Para quem precisa de controle total e automação.',
    price: 179.90,
    priceMensal: 179.90,
    priceAnual: 143.92,
    features: ['Até 12 usuários', 'Até 2000 imóveis', 'Contratos e Finanças', 'Automação de Marketing'],
    limits: { users: PLAN_CONFIG.business.maxUsers, properties: PLAN_CONFIG.business.maxProperties, leads: -1 }
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Tecnologia de ponta com IA para alta performance.',
    price: 249.90,
    priceMensal: 249.90,
    priceAnual: 199.92,
    features: ['Até 20 usuários', 'Até 3500 imóveis', 'Aura AI (Assistente)', 'Integração de Portais'],
    limits: { users: PLAN_CONFIG.premium.maxUsers, properties: PLAN_CONFIG.premium.maxProperties, leads: -1 }
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Sem limites. Para os maiores players do mercado.',
    price: 349.90,
    priceMensal: 349.90,
    priceAnual: 279.92,
    features: ['Usuários Ilimitados', 'Imóveis Ilimitados', 'IA Ilimitada', 'Suporte Dedicado 24/7'],
    limits: { users: -1, properties: -1, leads: -1 }
  },
  {
    id: 'free',
    name: 'Free',
    description: 'Plano de entrada para operações enxutas e testes.',
    price: 0,
    priceMensal: 0,
    priceAnual: 0,
    features: ['1 usuário', 'Até 5 imóveis', '5 descrições com IA/mês', 'CRM Essencial'],
    limits: { users: PLAN_CONFIG.free.maxUsers, properties: PLAN_CONFIG.free.maxProperties, leads: -1 }
  }
];

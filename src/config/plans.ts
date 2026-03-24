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

export const PLANS = [
  {
    id: 'starter',
    name: 'Starter',
    description: 'Ideal para corretores independentes que estão começando.',
    priceMensal: 54.90,
    priceAnual: 43.92, // Valor mensal no plano anual (20% OFF)
    features: ['Até 2 usuários', 'Até 50 imóveis', '50 descrições com IA/mês', 'CRM Básico']
  },
  {
    id: 'basic',
    name: 'Basic',
    description: 'Para pequenas imobiliárias com foco em crescimento.',
    priceMensal: 74.90,
    priceAnual: 59.92,
    features: ['Até 5 usuários', 'Até 400 imóveis', 'Pipeline de Leads', 'Gestão de Tarefas']
  },
  {
    id: 'profissional',
    name: 'Profissional',
    description: 'O padrão da indústria para imobiliárias consolidadas.',
    priceMensal: 119.90,
    priceAnual: 95.92,
    features: ['Até 8 usuários', 'Até 1000 imóveis', 'Gamificação', 'Relatórios Avançados']
  },
  {
    id: 'business',
    name: 'Business',
    description: 'Para quem precisa de controle total e automação.',
    priceMensal: 179.90,
    priceAnual: 143.92,
    features: ['Até 12 usuários', 'Até 2000 imóveis', 'Contratos e Finanças', 'Automação de Marketing']
  },
  {
    id: 'premium',
    name: 'Premium',
    description: 'Tecnologia de ponta com IA para alta performance.',
    priceMensal: 249.90,
    priceAnual: 199.92,
    features: ['Até 20 usuários', 'Até 3500 imóveis', 'Aura AI (Assistente)', 'Integração de Portais']
  },
  {
    id: 'elite',
    name: 'Elite',
    description: 'Sem limites. Para os maiores players do mercado.',
    priceMensal: 349.90,
    priceAnual: 279.92,
    features: ['Usuários Ilimitados', 'Imóveis Ilimitados', 'IA Ilimitada', 'Suporte Dedicado 24/7']
  }
];

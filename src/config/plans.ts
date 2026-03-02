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
// src/types.ts

export type ListingType = 'sale' | 'rent';

export enum PropertyType {
  APARTMENT = 'Apartamento',
  HOUSE = 'Casa',
  PENTHOUSE = 'Cobertura',
  COMMERCIAL = 'Comercial',
  LAND = 'Terreno',
  SOBRADO = 'Sobrado',
}

export enum LeadStatus {
  NEW = 'Novo',
  CONTACTED = 'Em Contato',
  QUALIFYING = 'Qualificando',
  VISIT = 'Visita Agendada',
  PROPOSAL = 'Proposta',
  CLOSED = 'Fechado',
  LOST = 'Perdido'
}

export interface Property {
  id: string;
  slug: string;
  title: string;
  description: string;
  price: number;
  type: PropertyType;
  listing_type?: ListingType;
  status?: string;
  is_available?: boolean;

  // Campos condicionais de venda/aluguel
  rent_package_price?: number;
  down_payment?: number;
  financing_available?: boolean;

  bedrooms: number;
  bathrooms: number;
  area: number;
  built_area?: number;
  garage: number;

  // Estrutura Visual (Frontend)
  location: {
    city: string;
    neighborhood: string;
    state: string;
    address?: string;
    zip_code?: string;
  };

  // Estrutura Plana (Banco de Dados) - Opcionais para mapeamento
  city?: string;
  neighborhood?: string;
  state?: string;
  address?: string;
  zip_code?: string;
  latitude?: number;
  longitude?: number;

  features: string[];
  images: string[];
  featured?: boolean;

  // Financeiro e Admin
  iptu?: number;
  condominium?: number;
  suites?: number;
  video_url?: string;
  owner_name?: string;
  owner_phone?: string;
  created_at?: string;

  // SEO
  seo_title?: string;
  seo_description?: string;

  // NOVO: Vinculo com Corretor
  agent_id?: string;
  agent?: {
    name: string;
    phone: string;
    email: string;
  };
}

export interface Task {
  id: string;
  title: string;
  description?: string;
  due_date: string;
  completed: boolean;
  type: 'call' | 'meeting' | 'email' | 'visit' | 'whatsapp' | 'other';
  lead_id: string;
  user_id: string;
  created_at?: string;
}

export interface TimelineEvent {
  id: string;
  created_at: string;
  type: 'status_change' | 'note' | 'call_log' | 'whatsapp' | 'system';
  description: string;
  metadata?: any;
  lead_id: string;
}

export interface Lead {
  id: string;
  name: string;
  email: string;
  phone: string;
  message?: string;
  status: LeadStatus | string;
  propertyId?: string;
  createdAt: string;
  source: string;
  assigned_to?: string;
  agent_id?: string;

  // Lead scoring de interesse
  lead_score?: number;
  score_visit?: number;
  score_favorite?: number;
  score_whatsapp?: number;

  // Preferências para Match Inteligente (IA)
  budget?: number;
  desired_type?: string;
  desired_bedrooms?: number;
  desired_location?: string;
  navigation_data?: any[];

  // JOIN: Dados expandidos do Imóvel e do Dono do Imóvel
  property?: {
    title: string;
    agent_id?: string;
    agent?: {
      name: string;
    };
  };
  properties?: Property; // Alias para casos de join

  deal_value?: number;
  sold_property_id?: string;
  commission_value?: number;
  payment_method?: string;
  contract_date?: string;
  proposal_notes?: string;

  // JOIN: Quem está atendendo (Assignee)
  assignee?: {
    name: string;
  };

  // Campos CRM Premium
  value?: number;
  probability?: number;
  loss_reason?: string;
  last_interaction?: string;
  expected_close_date?: string;
  score: number;
  updated_at?: string;
  funnel_step?: string;
  stage_updated_at?: string;
}

export interface LeadMatch {
  id: string;
  lead_id: string;
  property_id: string;
  match_score: number;
  match_reason: string;
  property?: Property;
}

export interface FilterState {
  city: string;
  minPrice: number | '';
  maxPrice: number | '';
  bedrooms: number | '';
  type: string;
  listingType?: ListingType | '';
}

export interface Profile {
  id: string;
  name: string;
  email: string;
  active: boolean;
  role?: string;
  phone?: string;

  // Gamificação do corretor
  xp_points?: number;
  level?: number;
  level_title?: string;
}

export interface Template {
  id: string;
  title: string;
  content: string;
  user_id: string;
  created_at?: string;
}

export interface Database {
  properties: Property;
  leads: Lead;
  tasks: Task;
  timeline_events: TimelineEvent;
  profiles: Profile;
  templates: Template;
}
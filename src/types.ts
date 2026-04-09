// src/types.ts

export interface SiteData {
  // Identidade Visual (Já existentes e novos)
  logo_url?: string | null;
  logo_alt_url?: string | null;
  logo_white_url?: string | null;
  favicon_url?: string | null;
  hero_image_url?: string | null;
  primary_color?: string;
  secondary_color?: string;

  // Hero Section (Textos da Página Inicial)
  hero_title?: string;
  hero_subtitle?: string;

  // Página "Sobre Nós"
  about_image_url?: string | null;
  about_title?: string;
  about_text?: string;

  // Dados Jurídicos e Contato
  creci?: string;
  cnpj?: string;
  corporate_name?: string; // Razão Social
  contact_email?: string;
  contact_phone?: string;
  address?: {
    street: string;
    number: string;
    neighborhood: string;
    city: string;
    state: string;
    zip: string;
  };

  // Seções Opcionais
  show_partnerships?: boolean;
  partners?: { id: string; name: string; logo_url: string }[];
  condominiums?: {
    id: string;
    name: string;
    image_url?: string;
    features?: string[];
    zip: string;
    street: string;
    neighborhood: string;
    city: string;
    state: string;
  }[];
  featured_regions?: { id: string; condominium_id?: string; name: string; image_url: string }[];

  // Redes Sociais (Footer)
  social_instagram?: string;
  social_facebook?: string;
  social_linkedin?: string;
  social_youtube?: string;

  // Campos legados (mantidos para compatibilidade)
  contact?: { 
    email: string | null; 
    phone: string | null; 
    address: string | null;
  };
  social?: { 
    instagram: string | null; 
    facebook: string | null; 
    whatsapp: string | null; 
    youtube: string | null;
  };
  seo?: { 
    title: string | null; 
    description: string | null;
  };
}

export type PixKeyType = 'cpf' | 'cnpj' | 'email' | 'phone' | 'random';

export interface FinanceConfig {
  use_asaas?: boolean;
  pix_type?: PixKeyType;
  pix_key?: string;
  pix_name?: string;
  pix_city?: string;
  default_commission?: number;
  broker_commission?: number;
}

export type UserRole = 'owner' | 'manager' | 'admin' | 'atendente' | 'corretor';
export type AppUserRole = UserRole | 'super_admin';

export interface CompanyPermissions {
  brokers_can_create_properties: boolean;
  brokers_can_edit_properties: boolean;
  atendentes_can_assign_leads: boolean;
}

export const DEFAULT_COMPANY_PERMISSIONS: CompanyPermissions = {
  brokers_can_create_properties: false,
  brokers_can_edit_properties: false,
  atendentes_can_assign_leads: true,
};

export interface CompanySettings {
  id: string;
  company_id: string;
  route_to_central?: boolean;
  central_whatsapp?: string | null;
  central_user_id?: string | null;
  kanban_config?: unknown;
  include_admins_in_roulette?: boolean;
  permissions: CompanyPermissions;
  created_at?: string;
  updated_at?: string;
}

export interface Company {
  id: string;
  name: string;
  subdomain: string;
  domain?: string | null;
  domain_secondary?: string | null;
  domain_type?: 'new' | 'existing' | null;
  domain_status?: 'pending' | 'active' | 'expired' | null;
  document?: string | null;
  slug?: string;
  plan: string;
  template?: string;
  logo_url?: string | null;
  logo_white_url?: string | null;
  admin_signature_url?: string | null;
  email?: string | null;
  phone?: string | null;
  address?: string | null;
  site_data?: SiteData;
  created_at?: string;
  updated_at?: string;
  finance_config?: FinanceConfig | string | null;
  use_asaas?: boolean | null;
  default_commission?: number | null;
  broker_commission?: number | null;
  payment_api_key?: string | null;
  payment_gateway?: 'asaas' | 'cora';
  manual_discount_value?: number | null;
  manual_discount_type?: 'fixed' | 'percentage' | null;
}

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
  condominium_id?: string | null;

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
  owner_email?: string;
  owner_cpf?: string;
  owner_document?: string;
  owner_rg?: string;
  owner_rg_org?: string;
  owner_rg_uf?: string;
  owner_profession?: string;
  owner_marital_status?: string;
  owner_nationality?: string;
  owner_address?: string;
  owner_pix_key?: string | null;
  owner_pix_type?: string | null;
  owner_spouse_name?: string;
  owner_spouse_cpf?: string;
  owner_spouse_document?: string;
  owner_spouse_rg?: string;
  owner_spouse_rg_org?: string;
  owner_spouse_rg_uf?: string;
  property_registration?: string;
  property_registry_office?: string;
  property_municipal_registration?: string;
  has_intermediation_signed?: boolean;
  commission_percentage?: number;
  has_exclusivity?: boolean;
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
  cpf?: string;
  rg?: string;
  profissao?: string;
  estado_civil?: string;
  endereco?: string;
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
  role?: AppUserRole;
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

export interface Invoice {
  id: string;
  company_id: string;
  property_id?: string;
  contract_id?: string;
  client_name: string;
  client_document?: string;
  description?: string;
  amount: number;
  due_date: string;
  status: 'pendente' | 'pago' | 'atrasado' | 'cancelado';
  gateway_id?: string;
  payment_url?: string;
  asaas_payment_link?: string;
  payment_notified?: boolean;
  created_at: string;
  property?: Property;
}

export interface Database {
  properties: Property;
  leads: Lead;
  tasks: Task;
  timeline_events: TimelineEvent;
  profiles: Profile;
  templates: Template;
}

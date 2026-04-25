# SUPABASE_ARCHITECTURE — Elevatio Vendas SaaS

> **Projeto:** Elevatio Vendas — CRM SaaS multi-tenant para imobiliárias
> **Supabase Project ID:** `udqychpxnbdaxlorbhyw`
> **Região:** `sa-east-1` (São Paulo)
> **PostgreSQL:** 17.6
> **Última atualização deste documento:** 25/04/2026

---

## 1. VISÃO GERAL DA ARQUITETURA

O Elevatio Vendas é um SaaS multi-tenant onde cada tenant é uma **imobiliária** (`companies`). O isolamento de dados entre tenants é garantido por **Row Level Security (RLS)** usando a função `get_my_company_id()` que lê o `company_id` do perfil autenticado.

### Stack
- **Frontend:** React 18 + TypeScript + Vite + Tailwind CSS
- **Backend:** Supabase (PostgreSQL 17.6 + Auth + Storage + Edge Functions)
- **Pagamentos SaaS:** Asaas (gateway de pagamento brasileiro)
- **Runtime Edge Functions:** Deno

### Hierarquia de Roles (do maior para o menor)

```
super_admin > owner > admin > manager > corretor
```

| Role | Descrição |
|---|---|
| `super_admin` | Acesso global a todos os tenants. Painel SaaS interno. |
| `owner` | Dono da imobiliária. Acesso total ao CRM do próprio tenant. |
| `admin` | Gerente / administrador intermediário. |
| `manager` | Gerente de equipe. Acesso elevado, não total. |
| `corretor` | Acesso restrito ao próprio funil de vendas. |

> **IMPORTANTE:** Novos usuários registrados via `auth.users` recebem automaticamente role `admin` pelo trigger `handle_new_user`. Após o setup wizard, o owner deve ser promovido manualmente para `owner` ou o sistema deve fazê-lo no fluxo de onboarding.

---

## 2. TABELAS — 36 TABELAS TOTAIS

### 2.1 Tabelas de Negócio (multi-tenant)

---

#### `companies` — Tenant raiz
**RLS:** ✅ | **Linhas:** 7

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `name` | text | Nome da imobiliária |
| `slug` | text UNIQUE | Identificador de URL |
| `subdomain` | text UNIQUE | Subdomínio do site público |
| `domain` | text | Domínio customizado principal |
| `domain_secondary` | text | Domínio secundário |
| `domain_status` | text | `pending\|active\|error\|expired` |
| `domain_secondary_status` | text | `pending\|active\|error\|idle` |
| `domain_type` | text | `new\|existing` |
| `email` | text | Email de contato |
| `phone` | text | Telefone |
| `cpf_cnpj` | text | Documento fiscal |
| `document` | text | Documento alternativo |
| `plan` | text | Nome do plano atual (default `'free'`) |
| `plan_status` | text | `trial\|active\|past_due\|canceled\|overdue` (default `'trial'`) |
| `trial_ends_at` | timestamptz | Fim do período de trial |
| `active` | boolean | Empresa ativa (default `true`) |
| `template` | text | Slug do template de site escolhido |
| `site_data` | jsonb | Configurações completas do site público |
| `logo_url` | text | URL do logo (redundante com `site_data.logo_url`) |
| `admin_signature_url` | text | Assinatura do administrador para contratos |
| `payment_api_key` | text | ⚠️ Chave de API do gateway do tenant (SENSÍVEL) |
| `payment_gateway` | text | Gateway usado (default `'asaas'`) |
| `use_asaas` | boolean | Habilita cobrança via Asaas para clientes (default `false`) |
| `asaas_customer_id` | text | ID do customer no Asaas (assinatura do plano) |
| `asaas_subscription_id` | text | ID da assinatura do plano no Asaas |
| `finance_config` | jsonb | Configurações financeiras extras (default `{}`) |
| `default_commission` | numeric | Comissão padrão da imobiliária (default 10%) |
| `broker_commission` | numeric | % da comissão que vai ao corretor (default 30%) |
| `manual_discount_value` | numeric | Valor de desconto manual (default 0) |
| `manual_discount_type` | text | `percentage\|fixed\|free` |
| `applied_coupon_id` | uuid FK→saas_coupons | Cupom ativo |
| `coupon_start_date` | timestamptz | Data de início do cupom |
| `whatsapp_credits` | int | Créditos de WhatsApp (default 0) |
| `created_by` | uuid | `auth.uid()` de quem criou |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

**site_data JSONB structure:**
```json
{
  "logo_url": null,
  "favicon_url": null,
  "primary_color": "#0f172a",
  "secondary_color": "#3b82f6",
  "hero_title": null,
  "hero_subtitle": null,
  "hero_image_url": null,
  "about_text": null,
  "about_image_url": null,
  "contact": { "phone": null, "email": null, "address": null },
  "social": { "whatsapp": null, "instagram": null, "facebook": null, "youtube": null },
  "seo": { "title": null, "description": null }
}
```

---

#### `profiles` — Usuários do sistema
**RLS:** ✅ | **Linhas:** 8

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK FK→auth.users | Mesmo ID do Supabase Auth |
| `email` | text | |
| `name` | text | |
| `role` | text | `owner\|admin\|manager\|corretor\|super_admin` (default `'corretor'`) |
| `active` | boolean | (default `false`) |
| `company_id` | uuid FK→companies | Tenant ao qual pertence |
| `phone` | text | |
| `cpf_cnpj` | text | |
| `creci` | text | Registro CRECI do corretor |
| `avatar_url` | text | |
| `theme_color` | text | (default `'#3b82f6'`) |
| `xp_points` | int | Pontos de experiência (default 0) |
| `level` | int | Nível gamificação (default 1) |
| `level_title` | text | (default `'Corretor Júnior'`) |
| `distribution_rules` | jsonb | Regras de distribuição automática de leads (default `{"types":[],"enabled":false}`) |
| `onboarding_state` | jsonb | Estado do onboarding (default `{"visited":{},"checklist":["create-company"]}`) |
| `last_assigned_at` | timestamptz | |
| `last_sign_in_at` | timestamptz | |
| `last_seen` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

#### `properties` — Imóveis
**RLS:** ✅ | **Linhas:** 4

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `agent_id` | uuid FK→profiles | Corretor responsável |
| `title` | text | |
| `description` | text | |
| `type` | text | Tipo do imóvel |
| `listing_type` | text | `sale\|rent` |
| `status` | text | `Disponível\|Indisponível\|Vendido\|Alugado\|Inativo` |
| `price` | numeric | Preço de venda |
| `rent_package_price` | numeric | Valor total do pacote de aluguel |
| `down_payment` | numeric | |
| `financing_available` | boolean | |
| `has_balloon` | boolean | |
| `balloon_value` | numeric | |
| `balloon_frequency` | text | |
| `city` | text | |
| `state` | text | |
| `neighborhood` | text | |
| `address` | text | |
| `zip_code` | text | |
| `latitude` | float8 | |
| `longitude` | float8 | |
| `area` | numeric | m² total |
| `built_area` | numeric | m² construída |
| `bedrooms` | int | |
| `suites` | int | |
| `bathrooms` | int | |
| `garage` | int | |
| `features` | text[] | |
| `images` | text[] | Array de URLs |
| `featured` | boolean | |
| `slug` | text UNIQUE | |
| `iptu` | numeric | |
| `condominium` | numeric | |
| `condominium_id` | text | |
| `video_url` | text | |
| `seo_title` | text | |
| `seo_description` | text | |
| `key_status` | text | `agency\|client\|broker\|owner` (default `'agency'`) |
| `commission_percentage` | numeric | (default 5) |
| `has_exclusivity` | boolean | (default true) |
| `has_intermediation_signed` | boolean | |
| `owner_signature_url` | text | |
| `owner_signature_at` | timestamptz | |
| `strategic_weight` | numeric | (default 1.0) |
| `priority_level` | text | `padrao\|prioritario\|urgente` (default `'padrao'`) |
| `property_registration` | text | Matrícula |
| `property_registry_office` | text | Cartório |
| `property_municipal_registration` | text | |
| `owner_name` | text | ⚠️ Dados pessoais sensíveis |
| `owner_phone` | text | ⚠️ |
| `owner_email` | text | ⚠️ |
| `owner_document` | text | ⚠️ CPF/CNPJ |
| `owner_rg` | text | ⚠️ |
| `owner_rg_org` | text | ⚠️ |
| `owner_rg_uf` | text | ⚠️ |
| `owner_nationality` | text | (default `'brasileiro(a)'`) |
| `owner_profession` | text | |
| `owner_marital_status` | text | |
| `owner_address` | text | |
| `owner_pix_key` | text | ⚠️ Chave PIX do proprietário |
| `owner_pix_type` | text | |
| `owner_spouse_name` | text | |
| `owner_spouse_document` | text | |
| `owner_spouse_rg` | text | |
| `owner_spouse_rg_org` | text | |
| `owner_spouse_rg_uf` | text | |
| `owner_spouse_cpf` | text | |
| `created_at` | timestamptz | |

> ⚠️ Todos os campos `owner_*` são dados pessoais sensíveis expostos publicamente pela policy `Imoveis publicos`.

---

#### `leads` — Funil CRM
**RLS:** ✅ | **Linhas:** 10

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `assigned_to` | uuid FK→profiles | |
| `property_id` | uuid FK→properties | Imóvel de interesse inicial |
| `sold_property_id` | uuid FK→properties | Imóvel efetivamente vendido/alugado |
| `name` | text | |
| `email` | text | |
| `phone` | text | |
| `message` | text | |
| `source` | text | Origem do lead (default `'Site'`) |
| `external_source` | text | |
| `external_lead_id` | text | |
| `campaign_id` | text | |
| `form_id` | text | |
| `is_property_specific` | boolean | (default `false`) |
| `funnel_step` | text | `pre_atendimento\|atendimento\|proposta\|venda_ganha\|perdido` (default `'pre_atendimento'`) |
| `stage_updated_at` | timestamptz | |
| `value` | numeric | Valor estimado |
| `deal_value` | float8 | Valor real do negócio |
| `commission_value` | float8 | |
| `payment_method` | text | |
| `contract_date` | date | |
| `probability` | int | % (default 20) |
| `score` | int | (default 50) |
| `lead_score` | int | Score calculado (default 0) |
| `score_visit` | int | (default 0) |
| `score_favorite` | int | (default 0) |
| `score_whatsapp` | int | (default 0) |
| `behavioral_score` | int | (default 0) |
| `source_quality` | text | `frio\|morno\|quente` (default `'frio'`) |
| `loss_reason` | text | |
| `proposal_notes` | text | |
| `budget` | numeric | |
| `desired_type` | text | |
| `desired_bedrooms` | int | |
| `desired_location` | text | |
| `interested_properties` | jsonb | Array de IDs de imóveis (default `[]`) |
| `navigation_data` | jsonb | Dados de navegação no site (default `[]`) |
| `metadata` | jsonb | (default `{}`) |
| `cpf` | text | |
| `rg` | text | |
| `rg_org` | text | |
| `rg_uf` | text | |
| `nationality` | text | (default `'brasileiro(a)'`) |
| `profissao` | text | |
| `estado_civil` | text | |
| `endereco` | text | |
| `cep` | text | |
| `street` | text | |
| `address_number` | text | |
| `neighborhood` | text | |
| `city` | text | |
| `state` | text | |
| `spouse_name` | text | |
| `spouse_cpf` | text | |
| `spouse_rg` | text | |
| `spouse_rg_org` | text | |
| `spouse_rg_uf` | text | |
| `asaas_customer_id` | text | |
| `last_interaction` | timestamptz | |
| `expected_close_date` | date | |
| `created_at` | timestamptz | |

---

#### `contracts` — Contratos
**RLS:** ✅ | **Linhas:** 71

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `lead_id` | uuid FK→leads | |
| `client_id` | uuid FK→leads | |
| `property_id` | uuid FK→properties | |
| `broker_id` | uuid FK→profiles | |
| `created_by` | uuid FK→auth.users | |
| `type` | text | `sale\|rent` |
| `status` | text | `pending\|active\|canceled\|archived\|finished` (default `'draft'`) |
| `keys_status` | text | Status das chaves (default `'na_imobiliaria'`) |
| `keys_notes` | text | |
| `start_date` | date | |
| `end_date` | date | |
| `sale_total_value` | numeric | |
| `sale_down_payment` | numeric | |
| `sale_financing_value` | numeric | |
| `sale_financing_bank` | text | |
| `sale_is_cash` | boolean | |
| `sale_payment_method` | text | |
| `sale_consortium_value` | numeric | (default 0) |
| `has_permutation` | boolean | |
| `permutation_details` | text | |
| `permutation_value` | numeric | |
| `rent_value` | numeric | |
| `condo_value` | numeric | |
| `iptu_value` | numeric | |
| `rent_guarantee_type` | text | |
| `rent_readjustment_index` | text | |
| `commission_percentage` | numeric | |
| `commission_total` | numeric | |
| `admin_fee_percent` | numeric | (default 10%) |
| `broker_fee_percent` | numeric | (default 100%) |
| `vistoria_items` | jsonb | (default `[]`) |
| `deposit_refunded` | boolean | |
| `contract_data` | jsonb | Dados dinâmicos (default `{}`) |
| `content` | text | Conteúdo texto |
| `html_content` | text | Conteúdo HTML renderizado |
| `notes` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

#### `installments` — Parcelas
**RLS:** ✅ | **Linhas:** 222

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `contract_id` | uuid FK→contracts | |
| `installment_number` | int | |
| `type` | text | |
| `amount` | numeric | |
| `due_date` | date | |
| `status` | text | (default `'pending'`) |
| `notified_due` | boolean | |
| `created_at` | timestamptz | |

---

#### `invoices` — Cobranças via gateway
**RLS:** ✅ | **Linhas:** 1

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `contract_id` | uuid FK→contracts | |
| `property_id` | uuid FK→properties | |
| `client_name` | text | |
| `client_document` | text | |
| `description` | text | |
| `amount` | numeric | |
| `due_date` | date | |
| `status` | text | `pendente\|pago\|atrasado\|cancelado` |
| `gateway_id` | text | ID no Asaas |
| `payment_url` | text | |
| `payment_notified` | boolean | |
| `metadata` | jsonb | |
| `created_at` | timestamptz | |

---

#### `contract_signatures` — Assinaturas eletrônicas
**RLS:** ✅ | **Linhas:** 193

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `contract_id` | uuid | |
| `company_id` | uuid FK→companies | |
| `signer_name` | text | |
| `signer_email` | text | |
| `signer_role` | text | Papel do assinante |
| `signer_document` | text | |
| `token` | uuid | Token público de acesso para assinar |
| `status` | text | `pending\|signed\|rejected` |
| `signature_image` | text | Base64 da assinatura |
| `signed_at` | timestamptz | |
| `ip_address` | text | |
| `signer_ip` | text | |
| `user_agent` | text | |
| `crypto_hash` | text | |
| `created_at` | timestamptz | |

> ⚠️ Policy `Permitir cliente assinar via token` faz UPDATE sem validar o token UUID.

---

#### `contract_templates` — Templates de contrato
**RLS:** ✅ | **Linhas:** 2

> ⚠️ Usa `tenant_id` em vez de `company_id` — inconsistência com o restante do banco.

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `tenant_id` | uuid FK→companies | ⚠️ Nome diferente do padrão |
| `name` | text | |
| `type` | text | `sale\|rent` |
| `content` | text | HTML do template |
| `created_at` | timestamptz | |

---

#### `notifications` — Notificações do CRM
**RLS:** ✅ | **Linhas:** 124

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `user_id` | uuid FK→profiles | |
| `sender_id` | uuid FK→profiles | |
| `title` | text | |
| `message` | text | |
| `content` | text | |
| `type` | text | (default `'info'`) |
| `read` | boolean | |
| `link` | text | |
| `created_at` | timestamptz | |

---

#### `tasks` — Tarefas do CRM
**RLS:** ✅ | **Linhas:** 55

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `lead_id` | uuid FK→leads | |
| `user_id` | uuid FK→profiles | |
| `title` | text | |
| `description` | text | |
| `type` | text | (default `'call'`) |
| `priority` | text | (default `'media'`) |
| `due_date` | timestamptz | |
| `completed` | boolean | |
| `status` | text | (default `'pending'`) |
| `created_at` | timestamptz | |

---

#### `timeline_events` — Histórico do lead
**RLS:** ✅ | **Linhas:** 89

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `lead_id` | uuid FK→leads | |
| `created_by` | uuid FK→profiles | (default `auth.uid()`) |
| `type` | text | |
| `description` | text | |
| `metadata` | jsonb | (default `{}`) |
| `created_at` | timestamptz | |

---

#### `settings` — Configurações da empresa
**RLS:** ✅ | **Linhas:** 3

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | int PK | `nextval('settings_id_seq')` |
| `company_id` | uuid FK→companies UNIQUE | |
| `central_user_id` | uuid FK→profiles | |
| `company_name` | text | (default `'TR Imóveis'`) |
| `auto_distribution` | boolean | (default `false`) |
| `route_to_central` | boolean | (default `true`) |
| `central_whatsapp` | text | (default `''`) |
| `kanban_config` | jsonb | Subetapas do kanban por coluna |
| `permissions` | jsonb | `{"atendentes_can_assign_leads":true,"brokers_can_edit_properties":false,"brokers_can_create_properties":false}` |

---

#### `site_visits` — Analytics do site público
**RLS:** ✅ | **Linhas:** 0

> ⚠️ Sem `company_id` — analytics misturadas entre tenants (bug M5).

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `page` | text | |
| `session_id` | text | |
| `device_id` | text | |
| `created_at` | timestamptz | |

---

#### `message_templates` — Templates de mensagem
**RLS:** ✅ | **Linhas:** 0

Colunas: `id`, `user_id` FK→auth.users, `title`, `content`, `active` boolean, `created_at`.

---

#### `lead_interests` — Interesses do lead
**RLS:** ✅ | **Linhas:** 0

Colunas: `id`, `lead_id` FK→leads, `property_id` FK→properties, `created_at`.

---

#### `lead_matches` — Matching lead × imóvel
**RLS:** ✅ | **Linhas:** 0

Colunas: `id`, `lead_id` FK→leads, `property_id` FK→properties, `match_score` int, `match_reason` text, `created_at`.

---

#### `lead_source_integrations` — Integrações de captação de leads ⭐ NOVA
**RLS:** ✅ | **Linhas:** 0

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `provider` | text | Ex: `facebook`, `rd_station` |
| `name` | text | Nome da integração |
| `status` | text | (default `'draft'`) |
| `webhook_secret` | text | |
| `verify_token` | text | |
| `is_active` | boolean | (default `false`) |
| `last_lead_received_at` | timestamptz | |
| `created_at` | timestamptz | |

---

#### `lead_source_mappings` — Mapeamento de formulários/anúncios ⭐ NOVA
**RLS:** ✅ | **Linhas:** 0

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `integration_id` | uuid FK→lead_source_integrations | |
| `property_id` | uuid FK→properties | Imóvel vinculado |
| `assigned_user_id` | uuid FK→profiles | Corretor pré-atribuído |
| `external_object_id` | text | ID externo (form_id, ad_id) |
| `external_object_type` | text | Tipo do objeto externo |
| `lead_mode` | text | (default `'generic'`) |
| `label` | text | |
| `created_at` | timestamptz | |

---

#### `external_lead_events` — Log de eventos externos ⭐ NOVA
**RLS:** ✅ | **Linhas:** 0

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `provider` | text | |
| `external_lead_id` | text | |
| `raw_payload` | jsonb | Payload bruto recebido |
| `status` | text | |
| `error_message` | text | |
| `created_at` | timestamptz | |

---

#### `whatsapp_instances` — Instâncias WhatsApp ⭐ NOVA
**RLS:** ✅ | **Linhas:** 0

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `user_id` | uuid FK→profiles | |
| `instance_name` | text UNIQUE | |
| `instance_token` | text | |
| `connection_status` | text | (default `'disconnected'`) |
| `qr_code` | text | |
| `phone_number` | text | |
| `profile_name` | text | |
| `profile_picture_url` | text | |
| `last_ping_at` | timestamptz | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

#### `whatsapp_message_logs` — Log de mensagens WhatsApp ⭐ NOVA
**RLS:** ✅ | **Linhas:** 0

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `to_phone` | text | |
| `template_name` | text | |
| `message_id` | text | |
| `status` | text | (default `'sent'`) |
| `payload` | jsonb | |
| `error_message` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | |

---

### 2.2 Tabelas de Gamificação

---

#### `badges` — Medalhas globais
**RLS:** ✅ | **Linhas:** 5 | Sem `company_id` (global)

Colunas: `id`, `icon`, `label`, `description`, `xp_reward` int, `created_at`.

---

#### `user_badges` — Medalhas conquistadas
**RLS:** ✅ | **Linhas:** 0

Colunas: `id`, `user_id` FK→profiles, `badge_id` FK→badges, `earned_at`.

---

#### `gamification_events` — Eventos de XP
**RLS:** ❌ **SEM RLS** | **Linhas:** 7

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `user_id` | uuid FK→profiles | |
| `action_type` | text | Tipo da ação |
| `entity_id` | uuid | |
| `points_awarded` | int | |
| `base_points` | int | |
| `multipliers` | jsonb | |
| `created_at` | timestamp | ⚠️ Sem timezone — inconsistente com restante do banco |

> ⚠️ **CRÍTICO:** Tabela sem RLS habilitado.

---

#### `gamification_seasons` — Temporadas
**RLS:** ✅ | **Linhas:** 0

Colunas: `id`, `company_id`, `name`, `start_date` timestamp, `end_date` timestamp, `status`. ⚠️ Datas sem timezone.

---

#### `season_rankings` — Rankings
**RLS:** ✅ | **Linhas:** 0

Colunas: `id`, `season_id`, `user_id`, `season_points` int, `deals_closed` int, `current_rank`, `conversion_rate` numeric.

---

### 2.3 Tabelas do SaaS

---

#### `saas_plans` — Planos disponíveis
**RLS:** ✅ | **Linhas:** 6

Campos booleanos de features: `has_funnel`, `has_pipeline`, `has_gamification`, `has_erp`, `has_site`, `has_portals`, `has_email_auto`, `has_api`, `has_free_domain`. Campos de limite: `max_properties`, `max_users`, `max_photos`, `max_contracts`. Preços: `price`, `price_monthly` (default 0), `price_yearly` (default 0). Outros: `name` UNIQUE, `description`, `icon`, `badge`, `is_popular`, `support_level`, `ia_limit`, `aura_access`, `features` jsonb, `active` boolean, `whatsapp_credits` int (default 0).

---

#### `saas_contracts` — Assinaturas das imobiliárias
**RLS:** ✅ | **Linhas:** 5

Colunas: `id`, `company_id` FK→companies, `plan_id` FK→saas_plans, `plan_name`, `status`, `billing_cycle` (`monthly\|annual`), `price`, `discount_value`, `discount_type`, `start_date`, `end_date`, `has_fidelity`, `fidelity_end_date`, `cancel_reason`, `canceled_at`, `customer_id` (Asaas), `subscription_id` (Asaas), `domain_status`, `domain_renewal_date`, `created_at`.

---

#### `saas_payments` — Histórico de pagamentos do SaaS
**RLS:** ✅ | **Linhas:** 12

Colunas: `id`, `company_id`, `amount`, `status`, `asaas_payment_id` UNIQUE, `reference_month`, `due_date`, `paid_at`, `created_at`.

---

#### `saas_coupons` — Cupons de desconto
**RLS:** ✅ | **Linhas:** 3

Colunas: `id`, `code` UNIQUE, `discount_type` (`percentage\|fixed\|free`), `discount_value`, `duration_months`, `max_uses`, `used_count`, `active`, `created_at`.

> ⚠️ SELECT público, UPDATE por qualquer autenticado. `apply_coupon_to_company()` sem validação de ownership.

---

#### `saas_notifications` — Alertas do painel super_admin
**RLS:** ✅ | **Linhas:** 17

Colunas: `id`, `title`, `message`, `type`, `is_read`, `link`, `created_at`.

> ⚠️ Policies de SELECT e UPDATE públicas (`qual: true`).

---

#### `saas_templates` — Templates de site
**RLS:** ✅ | **Linhas:** 5

Colunas: `id`, `slug` UNIQUE, `name`, `description`, `status` (`active\|construction\|exclusive`), `exclusive_company_id` FK→companies, `created_at`.

Templates: `luxury`, `modern`, `basico`, `classic`, `minimalist`.

---

#### `saas_tickets` — Tickets de suporte
**RLS:** ✅ | **Linhas:** 3

| Coluna | Tipo | Notas |
|---|---|---|
| `id` | uuid PK | |
| `company_id` | uuid FK→companies | |
| `subject` | text | |
| `priority` | text | `Alta\|Média\|Baixa` (default `'Média'`) |
| `status` | text | `Aberto\|Pendente\|Resolvido\|Fechado` |
| `support_rating` | int | Avaliação 1–5 |
| `support_feedback` | text | |
| `created_at` | timestamptz | |
| `updated_at` | timestamptz | Auto-atualizado por trigger |

---

#### `saas_ticket_messages` — Mensagens dos tickets
**RLS:** ✅ | **Linhas:** 11

Colunas: `id`, `ticket_id` FK→saas_tickets, `sender_type` (`client\|admin`), `message`, `created_at`.

---

#### `system_reviews` — Avaliações da plataforma
**RLS:** ✅ | **Linhas:** 2

Colunas: `id`, `company_id` FK→companies, `user_id` FK→auth.users, `rating` int (1–5), `comment`, `is_public` boolean (default false), `created_at`.

---

## 3. FUNÇÕES SQL

Todas são `SECURITY DEFINER`. ✅ = tem `SET search_path = public`.

| Função | Tipo | SP | Descrição |
|---|---|---|---|
| `get_my_company_id()` → uuid | STABLE | ✅ | `company_id` do usuário autenticado |
| `get_auth_company_id()` → uuid | STABLE | ✅ | Alias de `get_my_company_id()` |
| `get_auth_role()` → text | STABLE | ✅ | `role` do usuário autenticado |
| `is_admin()` → bool | — | ✅ | role IN `('owner','admin','super_admin')` |
| `is_owner()` → bool | — | ✅ | role IN `('owner','super_admin')` |
| `is_super_admin()` → bool | — | ✅ | role = `'super_admin'` |
| `handle_new_user()` → trigger | TRIGGER | ❌ | Cria perfil com role `'admin'` no registro |
| `notify_saas_new_company()` → trigger | TRIGGER | ❌ | Insere em `saas_notifications` ao criar empresa |
| `notify_payment_made(invoice_id, company_id, desc, amount)` → void | — | ❌ | Marca invoice e cria notificação PIX |
| `apply_coupon_to_company(company_id, coupon_code)` → jsonb | — | ❌ | Aplica cupom e incrementa contador |
| `rls_auto_enable()` → event_trigger | EVENT | ✅ | Habilita RLS em novas tabelas do schema public |
| `update_ticket_timestamp()` → trigger | TRIGGER | ❌ | Atualiza `updated_at` em saas_tickets |

> ⚠️ Funções sem `SET search_path`: `handle_new_user`, `notify_saas_new_company`, `notify_payment_made`, `apply_coupon_to_company`, `update_ticket_timestamp`.

> ⚠️ `notify_payment_made` e `apply_coupon_to_company` são SECURITY DEFINER sem validar ownership do `company_id` passado como parâmetro.

---

## 4. TRIGGERS

| Trigger | Tabela | Evento | Timing | Função |
|---|---|---|---|---|
| `trigger_new_company` | `companies` | INSERT | AFTER | `notify_saas_new_company()` |
| `Limpar Imagens do Imovel` | `properties` | DELETE | AFTER | `supabase_functions.http_request()` → edge fn `delete-property-images` ⚠️ |
| `trigger_update_ticket_timestamp` | `saas_tickets` | UPDATE | BEFORE | `update_ticket_timestamp()` |
| `on_auth_user_created` | `auth.users` | INSERT | AFTER | `handle_new_user()` |

> ⚠️ **CRÍTICO — `Limpar Imagens do Imovel`:** A `service_role key` do projeto está **hardcoded no SQL** da definição do trigger. Qualquer pessoa com acesso a `pg_get_functiondef()` ou às migrations pode ver a chave mestra. Deve ser rotacionada e substituída por `supabase_vault`.

---

## 5. RLS POLICIES — MAPA COMPLETO

### companies
| Policy | Cmd | Roles | Condição |
|---|---|---|---|
| Super admin tudo em empresas | ALL | public | `is_super_admin()` |
| Permitir criacao de imobiliaria | INSERT | public | `auth.role() = 'authenticated'` |
| Leitura Pública de Empresas | SELECT | public | `true` ⚠️ Expõe `payment_api_key` |
| Ler propria empresa | SELECT | public | `id = get_my_company_id()` |
| Ler propria empresa recem criada | SELECT | public | `created_by = auth.uid()` |
| Permitir atualizacao da propria empresa | UPDATE | authenticated | Qualquer membro da empresa |

### profiles
| Policy | Cmd | Roles | Condição |
|---|---|---|---|
| Super admin tudo em perfis | ALL | public | `is_super_admin()` |
| Permitir insercao do proprio perfil | INSERT | public | `auth.uid() = id` |
| Ver perfis da mesma empresa | SELECT | public | `auth.uid() = id OR company_id = get_my_company_id()` |
| Editar proprio perfil | UPDATE | public | `auth.uid() = id` |
| Admin gerencia perfis da empresa | UPDATE | public | próprio id OU (mesma empresa AND role IN owner/admin/super_admin) |

### properties
| Policy | Cmd | Roles | Condição |
|---|---|---|---|
| Imoveis publicos / Leitura Pública | SELECT | public | `true` ⚠️ |
| Autenticados inserem imoveis | INSERT | authenticated | `company_id = get_my_company_id()` |
| Enable insert properties dynamically | INSERT | authenticated | owner/manager/admin sempre; corretor se settings permitir |
| UPDATE imoveis | UPDATE | authenticated | `company_id = get_my_company_id()` |
| DELETE imoveis | DELETE | authenticated | `company_id = get_my_company_id()` |

### leads
| Policy | Cmd | Roles | Condição |
|---|---|---|---|
| Inserção Pública de Leads | INSERT | public | `true` ⚠️ |
| Site pode inserir leads publicos | INSERT | anon | `true` ⚠️ |
| Inserir leads na propria empresa | INSERT | authenticated | `company_id = get_my_company_id()` |
| Ver leads da propria empresa | SELECT | authenticated | `company_id = get_my_company_id()` |
| Atualizar leads da propria empresa | UPDATE | authenticated | `company_id = get_my_company_id()` |
| Deletar leads da propria empresa | DELETE | authenticated | mesma empresa AND role IN (owner/admin/super_admin) |

### contracts / installments / invoices / tasks / timeline_events
Todas scoped por `company_id = get_my_company_id()` para authenticated. DELETE em contracts exige role owner/admin/super_admin.

### notifications
| Policy | Cmd | Roles | Condição |
|---|---|---|---|
| Leitura de notificacoes | SELECT | public | `true` ⚠️ |
| Ver proprias notificacoes | SELECT | authenticated | `user_id = auth.uid() AND company_id = get_my_company_id()` |
| Inserir notificacoes | INSERT | authenticated | `company_id = get_my_company_id()` |
| Marcar notificacoes como lidas | UPDATE | authenticated | `user_id = auth.uid()` |
| Update de notificacoes | UPDATE | public | `true` ⚠️ UPDATE público |

### contract_signatures
| Policy | Cmd | Roles | Condição |
|---|---|---|---|
| Permitir CRM ler assinaturas | SELECT | public | company_id válido |
| Permitir CRM criar assinaturas | INSERT | public | authenticated |
| Permitir CRM excluir assinaturas | DELETE | public | authenticated |
| Permitir cliente assinar via token | UPDATE | public | `status = 'pending'` → `'signed'` ⚠️ Sem validar token |

### saas_contracts / saas_payments
Scoped por `company_id = get_my_company_id()`. super_admin vê tudo via `is_super_admin()`.

### saas_coupons
SELECT/INSERT/UPDATE públicos ou para qualquer autenticado. ⚠️

### saas_notifications
SELECT e UPDATE com `true` (públicos). ⚠️ Existe também policy restrita ao super_admin mas a pública sobrepõe.

### settings
SELECT público para mesma empresa. UPDATE restrito a roles owner/admin/super_admin via `get_auth_role()`.

### site_visits
INSERT público (anon e authenticated). SELECT restrito a owner/admin/super_admin.

### saas_tickets / saas_ticket_messages / system_reviews
Scoped por `company_id` via subquery em profiles. Adequadamente isolados.

### gamification_events
⚠️ **SEM RLS** — sem nenhuma política.

---

## 6. EDGE FUNCTIONS (22 ativas)

| Slug | Versão | JWT | Descrição |
|---|---|---|---|
| `create-asaas-checkout` | v34 | ❌ | Cria checkout de assinatura SaaS |
| `asaas-webhook` | v30 | ❌ | Recebe eventos do Asaas (plataforma) |
| `get-asaas-payment-link` | v29 | ❌ | Link de pagamento de fatura |
| `update-asaas-subscription` | v62 | ❌ | Upgrade/downgrade de plano |
| `cancel-asaas-subscription` | v20 | ❌ | Cancela assinatura |
| `reactivate-asaas-subscription` | v26 | ❌ | Reativa assinatura |
| `get-asaas-portal-link` | v18 | ✅ | Portal self-service do cliente |
| `delete-tenant` | v21 | ❌ | Hard delete multi-step de imobiliária |
| `list-asaas-payments` | v25 | ❌ | Lista cobranças de empresa no Asaas |
| `zap-feed` | v17 | ✅ | Exporta imóveis em XML para portais |
| `generate-charge` | v17 | ✅ | Gera cobrança para clientes das imobiliárias |
| `generate-asaas-charge` | v22 | ❌ | Cria boleto/PIX para inquilino/comprador |
| `tenant-webhook` | v17 | ❌ | Webhook Asaas para imobiliárias; atualiza installments/invoices |
| `delete-property-images` | v17 | ✅ | Remove imagens do Storage ao deletar imóvel |
| `og-imovel` | v24 | ❌ | Gera Open Graph tags dinâmicas para SEO |
| `check-domain` | v21 | ❌ | Verifica status de domínio customizado |
| `manage-vercel-domain` | v14 | ❌ | Gerencia domínios customizados no Vercel ⭐ NOVA |
| `ingest-external-lead` | v9 | ❌ | Ingesta leads de integrações externas ⭐ NOVA |
| `manage-whatsapp` | v9 | ✅ | Gerencia instâncias WhatsApp ⭐ NOVA |
| `create-asaas-addon` | v7 | ❌ | Cria add-on/crédito avulso no Asaas ⭐ NOVA |
| `send-whatsapp-official` | v17 | ❌ | Envia mensagens via WhatsApp Business API oficial ⭐ NOVA |
| `meta-whatsapp-webhook` | v4 | ❌ | Recebe webhooks da Meta/WhatsApp ⭐ NOVA |

---

## 7. STORAGE BUCKETS

| Bucket | Público | file_size_limit | allowed_mime_types | Isolamento tenant |
|---|---|---|---|---|
| `avatars` | ✅ | ❌ sem limite | ❌ qualquer tipo | ❌ |
| `company-assets` | ✅ | ❌ sem limite | ❌ qualquer tipo | ❌ |
| `properties` | ✅ | ❌ sem limite | ❌ qualquer tipo | ❌ |

> ⚠️ Nenhum bucket tem limites ou restrições de tipo. Não há isolamento de tenant nas policies de storage.

---

## 8. EXTENSÕES INSTALADAS

| Extensão | Schema | Versão |
|---|---|---|
| `pg_graphql` | graphql | 1.5.11 |
| `pg_net` | extensions | 0.20.0 |
| `pg_stat_statements` | extensions | 1.11 |
| `pgcrypto` | extensions | 1.3 |
| `plpgsql` | pg_catalog | 1.0 |
| `supabase_vault` | vault | 0.3.1 |
| `uuid-ossp` | extensions | 1.1 |

---

## 9. MIGRATIONS APLICADAS

| Versão | Nome | Descrição |
|---|---|---|
| `20260308024437` | `fix_rls_multitenant_isolation` | Correção de isolamento multi-tenant nas policies |
| `20260308235321` | `add_site_data_to_companies` | Adiciona coluna `site_data` jsonb à tabela companies |
| `20260409020319` | `add_owner_role_full_permissions` | Adiciona role owner; corrige is_admin(); cria is_owner(), get_auth_role(), get_auth_company_id() |
| `20260419043552` | `fix_billing_rls_and_constraints` | Corrige RLS de billing e constraints de banco |

---

## 10. TEMPLATES DE SITE PÚBLICO

Roteamento centralizado em `src/templates/TenantRouter.tsx`.

| Slug | Estilo | Fonte | Status |
|---|---|---|---|
| `luxury` | Dark `#0e0e0e`, hero gigante | DM Sans | ✅ Ativo |
| `modern` | Gradientes, hero arredondado | Plus Jakarta Sans | ✅ Ativo |
| `basico` | Dark, serif, foco em conversão | Serif | ✅ Ativo |
| `classic` | Navbar pílula flutuante | Tailwind | ✅ Ativo |
| `minimalist` | Fallback do Modern | System | ✅ Ativo |

---

## 11. VULNERABILIDADES DE SEGURANÇA ATIVAS

> **VEREDITO: NÃO DEPLOY EM PRODUÇÃO** sem corrigir C1–C4.

### Críticas

| # | Onde | Problema |
|---|---|---|
| **C1** | Trigger `Limpar Imagens do Imovel` | `service_role key` hardcoded no SQL do trigger — exposta em `pg_get_functiondef()`. Deve ser rotacionada e movida para `supabase_vault`. |
| **C2** | `leads` INSERT (public/anon) | `with_check: true` — lead pode ser criado sem `company_id` válido por qualquer pessoa |
| **C3** | `notifications` UPDATE (public) | `qual: true` — qualquer anônimo pode modificar qualquer notificação |
| **C4** | `companies` SELECT (public) | `qual: true` — expõe `payment_api_key` de todos os tenants publicamente |

### Altas

| # | Onde | Problema |
|---|---|---|
| **A1** | `contract_signatures` UPDATE | Policy não valida token UUID — qualquer anônimo pode assinar como pending |
| **A2** | `notifications` SELECT (public) | Leitura pública de notificações financeiras |
| **A3** | `apply_coupon_to_company()` | SECURITY DEFINER sem validar se caller é dono da empresa |
| **A4** | `notify_payment_made()` | SECURITY DEFINER sem validar caller |
| **A5** | `saas_coupons` UPDATE | Qualquer autenticado pode modificar cupons |
| **A6** | Storage buckets | Sem `file_size_limit`, `allowed_mime_types` ou isolamento de tenant |

### Médias

| # | Onde | Problema |
|---|---|---|
| **M1** | `properties` SELECT | Campos `owner_*` (CPF, RG, PIX) expostos publicamente |
| **M2** | `gamification_events` | Sem RLS habilitado |
| **M3** | `saas_coupons` SELECT | Todos os cupons expostos publicamente |
| **M4** | 5 funções SQL | Sem `SET search_path` — vulneráveis a search_path injection |
| **M5** | `site_visits` | Sem `company_id` — analytics misturadas entre tenants |
| **M6** | `saas_notifications` SELECT/UPDATE | Políticas públicas (`qual: true`) |

---

## 12. BUGS CONHECIDOS NO FRONTEND

| Arquivo | Bug |
|---|---|
| `AdminClients.tsx` | Usa `contracts!inner` — exclui clientes com contrato `draft/canceled` |
| `AdminTasks.tsx` | `toDateString()` sem normalizar timezone — tarefas de "hoje" aparecem em "Futuro" |
| `AdminConfig.tsx` L1433 | Toggle admin↔corretor pode afetar usuários `owner` inadvertidamente |
| `AdminConfig.tsx` L1379 | Tipo de convite aceita apenas `'admin'\|'corretor'` — não inclui `'owner'` |
| `AuthContext.tsx` | `isAdmin` provavelmente verifica apenas `role === 'admin'` sem incluir `'owner'` — causa redirecionamento para wizard com plano ativo |

### Correção obrigatória no AuthContext.tsx

```ts
// ❌ ANTES (provável)
const isAdmin = user?.role === 'admin' || user?.role === 'super_admin';

// ✅ DEPOIS
const isAdmin = ['owner', 'admin', 'super_admin'].includes(user?.role ?? '');
const isOwner = user?.role === 'owner' || user?.role === 'super_admin';
```

---

## 13. FLUXO DE ONBOARDING

1. Usuário se registra → `on_auth_user_created` cria `profile` com `role = 'admin'` e `company_id = null`
2. `AdminLayout.tsx` verifica `!user?.company_id && role !== 'super_admin'` → exibe `SetupWizardModal`
3. Wizard cria `companies` e `saas_contracts`
4. `company_id` é atribuído ao perfil
5. Dono deve ser promovido para `role = 'owner'` (manual ou automaticamente no wizard)

> **Nota:** Após mudança de role no banco, o JWT em cache ainda tem os metadados antigos. Logout + login forçam re-fetch do perfil.

---

## 14. PADRÕES E CONVENÇÕES DO BANCO

### Multi-tenancy
- Isolamento por `company_id` em todas as tabelas de negócio
- `get_my_company_id()` / `get_auth_company_id()` usadas nas policies para evitar recursão
- **Exceções sem company_id:** `badges` (global), `message_templates` (por user), `site_visits` (sem isolamento), `gamification_events` (tem company_id mas sem RLS)
- **Exceção de nomenclatura:** `contract_templates` usa `tenant_id` em vez de `company_id`

### PKs e timestamps
- PKs: `id uuid DEFAULT gen_random_uuid()`
- Timestamps: `created_at`, `updated_at` com `timezone('utc', now())`
- **Exceção:** tabelas de gamificação usam `timestamp` sem timezone

### Autenticação
- Supabase Auth integrado com `profiles` via trigger
- `auth.uid()`, `auth.role()`, `auth.jwt()` disponíveis nas policies
- JWT precisa de refresh após mudanças de role no banco
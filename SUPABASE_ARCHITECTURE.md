# 🗄️ Arquitetura do Banco de Dados — Elevatio Vendas SaaS
> **Projeto Supabase:** `udqychpxnbdaxlorbhyw`
> **Região:** sa-east-1 (São Paulo)
> **PostgreSQL:** 17.6
> **Última atualização:** 23/03/2026 — sincronizado via MCP direto ao banco

---

## ⚡ CONTEXTO CRÍTICO PARA A IA

Este é um **CRM Imobiliário SaaS Multi-Tenant**. Cada cliente é uma **imobiliária** com:
- Seu próprio `company_id` (UUID) em todas as tabelas de dados
- Um subdomínio ou slug de acesso ao site público
- Um template visual configurável

**Regra de ouro do multi-tenancy:** O isolamento de dados é feito 100% pelo RLS no banco via a função `get_my_company_id()`. O frontend **nunca** deve filtrar manualmente por `company_id` em SELECTs — o RLS já faz isso. Mas **sempre** deve incluir `company_id` em INSERTs e UPDATEs.

---

## 🔧 FUNÇÕES RLS (Database Functions)

### `get_my_company_id()` → `uuid`
```sql
SELECT company_id FROM public.profiles WHERE id = auth.uid();
```
- Retorna o `company_id` do usuário autenticado
- Usada em quase todas as policies RLS
- Declarada como `STABLE SECURITY DEFINER`

### `is_super_admin()` → `boolean`
```sql
SELECT EXISTS (
  SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'super_admin'
);
```
- Quando retorna `true`, bypassa o isolamento multi-tenant

### `handle_new_user()` — Trigger Function
```sql
-- Disparada por: AFTER INSERT ON auth.users (trigger: on_auth_user_created)
INSERT INTO public.profiles (id, email, name, role, active)
VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'), 'admin', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```
- `company_id` fica `NULL` até o usuário criar ou ingressar em uma empresa

---

## 🏗️ ROLES DE USUÁRIO

| Role | Descrição |
|---|---|
| `super_admin` | Dono da plataforma SaaS. Acesso total a todos os dados |
| `admin` | Dono/gestor da imobiliária. Acesso total aos dados da própria empresa |
| `corretor` | Corretor da imobiliária. Acesso limitado |

---

## 📐 DIAGRAMA DE RELACIONAMENTOS

```
auth.users (Supabase Auth)
    │
    │ [trigger: on_auth_user_created]
    ▼
profiles ──────────────────────────────────── companies
    │  company_id (FK)                             │
    │                                              │
    ├── leads ──── timeline_events                 │ (todos têm company_id FK)
    │     ├── lead_interests ── properties ────────┤
    │     ├── lead_matches ───── properties        │
    │     └── tasks                                │
    │                                              │
    ├── contracts ─── installments                 │
    │     ├── properties (FK)                      │
    │     ├── leads (FK)                           │
    │     ├── profiles/broker (FK)                 │
    │     └── invoices ─────────────────────────── │
    │                                              │
    ├── contract_templates (tenant_id FK) ─────────│
    ├── notifications                              │
    ├── message_templates                          │
    └── settings ──────────────────────────────────┘

SaaS Layer:
    saas_contracts ──── saas_plans
    saas_payments
    saas_notifications (só super_admin)

Analytics:
    site_visits (sem company_id — analytics global)
```

---

## 📋 TABELAS — REFERÊNCIA COMPLETA

---

### `companies` — Imobiliárias (Tenants)
> Tabela raiz do multi-tenancy. Cada linha = 1 imobiliária cliente.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `name` | `text` ✅ | Nome da imobiliária |
| `slug` | `text` unique | Slug único para URL |
| `subdomain` | `text` unique | Subdomínio único |
| `template` | `text` | Template do site: `classic`, `modern`, `luxury` |
| `plan` | `text` | Default: `'free'` |
| `plan_status` | `text` | `trial`, `active`, `suspended`, `canceled`. Default: `trial` |
| `trial_ends_at` | `timestamptz` | Data de expiração do trial |
| `active` | `boolean` | Default: `true` |
| `site_data` | `jsonb` | Configurações visuais do site público (ver estrutura abaixo) |
| `domain` | `text` | Domínio customizado |
| `phone` | `text` | Telefone |
| `document` | `text` | CNPJ/CPF |
| `cpf_cnpj` | `text` | CNPJ/CPF (alternativo) |
| `asaas_customer_id` | `text` | ID do cliente no Asaas |
| `asaas_subscription_id` | `text` | ID da assinatura no Asaas |
| `payment_gateway` | `text` | Gateway ativo. Default: `'asaas'` |
| `payment_api_key` | `text` | ⚠️ Chave API do gateway — NUNCA expor no frontend |
| `created_by` | `uuid` | `auth.uid()` de quem criou |
| `created_at` | `timestamptz` | Default: `now()` |

**Estrutura do `site_data` (JSONB):**
```typescript
interface SiteData {
  logo_url: string | null;
  favicon_url: string | null;
  hero_image_url: string | null;
  primary_color: string;        // default: "#0f172a"
  secondary_color: string;      // default: "#3b82f6"
  hero_title: string | null;
  hero_subtitle: string | null;
  about_text: string | null;
  about_image_url: string | null;
  social: { instagram, facebook, whatsapp, youtube: string | null };
  seo: { title, description: string | null };
  contact: { email, phone, address: string | null };
}
```

---

### `profiles` — Usuários da Plataforma
> Extensão do `auth.users`. Criado automaticamente pelo trigger `on_auth_user_created`.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | Mesmo ID do `auth.users` |
| `company_id` | `uuid` | FK → `companies.id`. NULL até ingressar |
| `email` | `text` | Email |
| `name` | `text` | Nome completo |
| `role` | `text` ✅ | `admin`, `corretor`, `super_admin`. Default: `corretor` |
| `active` | `boolean` ✅ | Default: `false` |
| `phone` | `text` | Telefone |
| `avatar_url` | `text` | URL do avatar |
| `company_logo` | `text` | URL do logo da empresa (cache no perfil) |
| `cpf_cnpj` | `text` | CPF/CNPJ do corretor |
| `creci` | `text` | Número do CRECI |
| `xp` | `integer` | Pontos XP. Default: `0` |
| `xp_points` | `integer` | XP alternativo. Default: `0` |
| `level` | `integer` | Nível. Default: `1` |
| `level_title` | `text` | Título. Default: `'Corretor Júnior'` |
| `distribution_rules` | `jsonb` | Default: `{"types":[],"enabled":false}` |
| `last_assigned_at` | `timestamptz` | Último lead atribuído (round-robin) |
| `last_sign_in_at` | `timestamptz` | Último login |
| `last_seen` | `timestamptz` | Última atividade |
| `updated_at` | `timestamptz` | Última atualização |
| `created_at` | `timestamptz` | Default: `now()` |

---

### `properties` — Imóveis
> Leitura pública (site), escrita isolada por empresa.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | `gen_random_uuid()` |
| `company_id` | `uuid` | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `agent_id` | `uuid` | FK → `profiles.id` |
| `title` | `text` ✅ | Título |
| `description` | `text` | Descrição |
| `price` | `numeric` ✅ | Preço |
| `type` | `text` ✅ | `Casa`, `Apartamento`, `Terreno`, `Comercial`, etc. |
| `listing_type` | `text` ✅ | `sale` ou `rent`. Default: `'sale'` |
| `status` | `text` | `Disponível`, `Indisponível`, `Vendido`, `Alugado`, `Inativo` |
| `featured` | `boolean` | Default: `false` |
| `slug` | `text` ✅ unique | URL amigável |
| `city` | `text` ✅ | Cidade |
| `neighborhood` | `text` ✅ | Bairro |
| `state` | `text` ✅ | Estado |
| `address` | `text` | Endereço |
| `zip_code` | `text` | CEP |
| `latitude` | `float8` | Latitude |
| `longitude` | `float8` | Longitude |
| `bedrooms` | `integer` | Default: `0` |
| `bathrooms` | `integer` | Default: `0` |
| `suites` | `integer` | Default: `0` |
| `garage` | `integer` | Default: `0` |
| `area` | `numeric` | Área total (m²). Default: `0` |
| `built_area` | `numeric` | Área construída (m²) |
| `iptu` | `numeric` | Default: `0` |
| `condominium` | `numeric` | Default: `0` |
| `rent_package_price` | `numeric` | Pacote aluguel completo |
| `images` | `text[]` | URLs das imagens. Default: `{}` |
| `features` | `text[]` | Características. Default: `{}` |
| `video_url` | `text` | URL do vídeo/tour |
| `financing_available` | `boolean` | Aceita financiamento |
| `down_payment` | `numeric` | Entrada sugerida |
| `has_balloon` | `boolean` | Tem balão. Default: `false` |
| `balloon_value` | `numeric` | Default: `0` |
| `balloon_frequency` | `text` | Frequência do balão |
| `seo_title` | `text` | Título SEO |
| `seo_description` | `text` | Descrição SEO |
| `owner_name` | `text` | Nome do proprietário |
| `owner_phone` | `text` | Telefone do proprietário |
| `owner_email` | `text` | Email do proprietário |
| `owner_document` | `text` | CPF/CNPJ do proprietário |
| `owner_rg` | `text` | RG do proprietário |
| `owner_profession` | `text` | Profissão |
| `owner_marital_status` | `text` | Estado civil |
| `owner_nationality` | `text` | Default: `'brasileiro(a)'` |
| `owner_address` | `text` | Endereço do proprietário |
| `owner_spouse_name` | `text` | Nome do cônjuge |
| `owner_spouse_document` | `text` | Documento do cônjuge |
| `property_registration` | `text` | Matrícula do imóvel |
| `property_registry_office` | `text` | Cartório de registro |
| `property_municipal_registration` | `text` | Inscrição municipal |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `leads` — Leads do CRM
> Núcleo do funil de vendas.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `assigned_to` | `uuid` | FK → `profiles.id` |
| `property_id` | `uuid` | FK → `properties.id` (interesse inicial) |
| `sold_property_id` | `uuid` | FK → `properties.id` (imóvel vendido) |
| `name` | `text` ✅ | Nome |
| `email` | `text` | Email |
| `phone` | `text` | Telefone |
| `rg` | `text` | RG do lead |
| `nationality` | `text` | Default: `'brasileiro(a)'` |
| `message` | `text` | Mensagem inicial |
| `source` | `text` | Default: `'Site'` |
| `status` | `text` ✅ | Default: `'Novo'` |
| `funnel_step` | `text` | `pre_atendimento`, `atendimento`, `proposta`, `perdido`. Default: `pre_atendimento` |
| `stage_updated_at` | `timestamptz` | Quando mudou de etapa |
| `value` | `numeric` | Valor estimado. Default: `0` |
| `deal_value` | `float8` | Valor real do negócio fechado |
| `probability` | `integer` | %. Default: `20` |
| `score` | `integer` | Default: `50` |
| `lead_score` | `integer` | Score calculado. Default: `0` |
| `score_visit` | `integer` | Default: `0` |
| `score_favorite` | `integer` | Default: `0` |
| `score_whatsapp` | `integer` | Default: `0` |
| `budget` | `numeric` | Orçamento |
| `desired_type` | `text` | Tipo desejado |
| `desired_bedrooms` | `integer` | Quartos desejados |
| `desired_location` | `text` | Localização desejada |
| `loss_reason` | `text` | Motivo de perda |
| `proposal_notes` | `text` | Notas da proposta |
| `payment_method` | `text` | Forma de pagamento |
| `commission_value` | `float8` | Valor da comissão |
| `contract_date` | `date` | Data do contrato |
| `expected_close_date` | `date` | Previsão de fechamento |
| `last_interaction` | `timestamptz` | Default: `now()` |
| `interested_properties` | `jsonb` | Default: `[]` |
| `navigation_data` | `jsonb` | Default: `[]` |
| `metadata` | `jsonb` | Default: `{}` |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `tasks` — Tarefas / Agenda

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` ✅ | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `user_id` | `uuid` | FK → `auth.users.id` |
| `lead_id` | `uuid` | FK → `leads.id` |
| `title` | `text` ✅ | Título |
| `description` | `text` | Descrição |
| `type` | `text` | `call`, `visit`, `email`, `other`. Default: `call` |
| `due_date` | `timestamptz` | Vencimento |
| `completed` | `boolean` | Default: `false` |
| `status` | `text` | `pending`, `done`. Default: `pending` |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `contracts` — Contratos Imobiliários

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` ✅ | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `lead_id` | `uuid` | FK → `leads.id` |
| `property_id` | `uuid` | FK → `properties.id` |
| `broker_id` | `uuid` | FK → `profiles.id` |
| `type` | `text` ✅ | `sale` ou `rent` |
| `status` | `text` | `pending`, `active`, `canceled`, `archived`, `finished`. Default: `draft` |
| `start_date` / `end_date` | `date` | Vigência |
| `keys_status` | `text` | Status das chaves. Default: `'na_imobiliaria'` |
| `keys_notes` | `text` | Observações sobre as chaves |
| `sale_total_value` | `numeric` | Valor total |
| `sale_down_payment` | `numeric` | Entrada |
| `sale_financing_value` | `numeric` | Valor financiado |
| `sale_financing_bank` | `text` | Banco |
| `sale_is_cash` | `boolean` | Default: `false` |
| `sale_payment_method` | `text` | Método de pagamento |
| `sale_consortium_value` | `numeric` | Default: `0` |
| `has_permutation` | `boolean` | Default: `false` |
| `permutation_details` / `permutation_value` | — | Dados da permuta |
| `rent_value` | `numeric` | Valor do aluguel |
| `condo_value` / `iptu_value` | `numeric` | Condomínio / IPTU |
| `rent_guarantee_type` | `text` | Tipo de garantia |
| `rent_readjustment_index` | `text` | Índice de reajuste |
| `commission_percentage` / `commission_total` | `numeric` | Comissão |
| `vistoria_items` | `jsonb` | Default: `[]` |
| `deposit_refunded` | `boolean` | Default: `false` |
| `notes` | `text` | Observações |
| `created_at` / `updated_at` | `timestamptz` | Default: `now()` |

---

### `installments` — Parcelas de Contrato

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` ✅ | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `contract_id` | `uuid` | FK → `contracts.id` |
| `amount` | `numeric` ✅ | Valor |
| `due_date` | `date` ✅ | Vencimento |
| `status` | `text` | `pending`, `paid`, `overdue`. Default: `pending` |
| `notified_due` | `boolean` | Default: `false` |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `invoices` — Faturas / Cobranças
> Cobranças emitidas no gateway com link de pagamento para o cliente.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `contract_id` | `uuid` | FK → `contracts.id` |
| `property_id` | `uuid` | FK → `properties.id` |
| `client_name` | `text` ✅ | Nome do cliente |
| `client_document` | `text` | CPF/CNPJ do cliente |
| `description` | `text` | Descrição da cobrança |
| `amount` | `numeric` ✅ | Valor |
| `due_date` | `date` ✅ | Vencimento |
| `status` | `text` | `pendente`, `pago`, `atrasado`, `cancelado`. Default: `pendente` |
| `gateway_id` | `text` | ID da cobrança no Asaas |
| `payment_url` | `text` | Link de pagamento para o cliente |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

> **Installments × Invoices:** `installments` = controle interno de parcelas. `invoices` = cobranças externas com link de pagamento emitido no gateway.

---

### `contract_templates` — Templates de Contrato
> Modelos personalizados por empresa.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `tenant_id` | `uuid` | FK → `companies.id` ⚠️ USA `tenant_id`, NÃO `company_id`! |
| `name` | `text` ✅ | Nome do template |
| `type` | `text` ✅ | `sale`, `rent`, etc. |
| `content` | `text` ✅ | HTML/texto com variáveis `{{campo}}` |
| `created_at` | `timestamptz` | Default: `now()` |

---

### `timeline_events` — Histórico de Atividades do Lead

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `lead_id` | `uuid` | FK → `leads.id` |
| `created_by` | `uuid` | `auth.uid()` |
| `type` | `text` ✅ | `note`, `call`, `visit`, `status_change`, etc. |
| `description` | `text` ✅ | Descrição |
| `metadata` | `jsonb` | Default: `{}` |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `notifications` — Notificações In-App

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` | FK → `companies.id` |
| `user_id` | `uuid` | FK → `profiles.id` (destinatário) |
| `title` | `text` ✅ | Título |
| `message` | `text` | Mensagem |
| `type` | `text` | `info`, `warning`, `success`, `error`. Default: `info` |
| `read` | `boolean` | Default: `false` |
| `link` | `text` | Link de ação |
| `created_at` | `timestamptz` | Default: `now()` |

---

### `settings` — Configurações do CRM da Empresa

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `integer` PK | |
| `company_id` | `uuid` | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `company_name` | `text` | Default: `'TR Imóveis'` |
| `auto_distribution` | `boolean` | Default: `false` |
| `route_to_central` | `boolean` | Default: `true` |
| `central_whatsapp` | `text` | Default: `''` |
| `central_user_id` | `uuid` | FK → `profiles.id` |
| `kanban_config` | `jsonb` | Configuração das etapas do Kanban |

**Valor padrão do `kanban_config`:**
```json
{
  "pre_atendimento": ["Aguardando Atendimento", "Tentando contato", "Agendando"],
  "atendimento": ["Aguardando atendimento", "Sem Contato", "Identificação de Interesse", "Visita", "Pedido"],
  "proposta": ["Elaborando Proposta", "Proposta em Aprovação", "Proposta Fria", "Proposta Aprovada", "Proposta Recusada"],
  "perdido": ["Sem contato", "Apenas pesquisando", "Contato Inválido", "Valor Alto", "Sem Entrada", "Outros"]
}
```

---

### `message_templates` — Templates de Mensagem

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `user_id` | `uuid` | FK → `auth.users.id` ⚠️ Isolado por user, não company |
| `title` | `text` ✅ | Nome do template |
| `content` | `text` ✅ | Conteúdo com variáveis |
| `active` | `boolean` | Default: `true` |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `lead_interests` / `lead_matches`

**lead_interests:** `id`, `lead_id` → leads, `property_id` → properties, `created_at`

**lead_matches:** `id`, `lead_id` → leads, `property_id` → properties, `match_score` (0-100), `match_reason`, `created_at`

---

### `site_visits` — Analytics Global

| Coluna | Descrição |
|---|---|
| `id` | uuid PK |
| `page` | URL visitada |
| `session_id` / `device_id` | Identificadores |
| `created_at` | Default: `now()` |

> ⚠️ Sem `company_id` — analytics global da plataforma

---

## 💳 TABELAS SaaS

### `saas_plans` — Planos de Assinatura
> Tabela com feature flags granulares por plano.

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `name` | `text` ✅ unique | Nome do plano |
| `price` | `numeric` ✅ | Preço |
| `max_properties` | `integer` | Limite de imóveis |
| `max_users` | `integer` | Limite de usuários |
| `max_photos` | `integer` | Limite de fotos por imóvel |
| `max_contracts` | `integer` | Limite de contratos. Default: `0` |
| `features` | `jsonb` | Lista de features em texto. Default: `[]` |
| `description` | `text` | Descrição do plano |
| `icon` | `text` | Ícone do plano |
| `badge` | `text` | Badge de destaque (ex: "Mais Vendido") |
| `is_popular` | `boolean` | Plano em destaque. Default: `false` |
| `stripe_price_id` | `text` | ID no Stripe (reserva futura) |
| `has_funnel` | `boolean` | Acesso ao funil/Kanban. Default: `false` |
| `has_pipeline` | `boolean` | Acesso ao pipeline. Default: `false` |
| `has_gamification` | `boolean` | Gamificação ativa. Default: `false` |
| `has_erp` | `boolean` | Módulo ERP/contratos. Default: `false` |
| `has_site` | `boolean` | Site público ativo. Default: `false` |
| `has_portals` | `boolean` | Integração com portais (ZAP, OLX, etc). Default: `false` |
| `has_email_auto` | `boolean` | Automação de e-mails. Default: `false` |
| `has_api` | `boolean` | Acesso à API. Default: `false` |
| `has_free_domain` | `boolean` | Domínio gratuito incluso. Default: `false` |
| `ia_limit` | `text` | Limite de uso da IA (ex: "100/mês", "ilimitado") |
| `aura_access` | `text` | Nível de acesso ao assistente Aura |
| `support_level` | `text` | Nível de suporte (ex: "email", "chat", "dedicado") |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

**Planos ativos (6 registros):**

| Plano | Preço | Max Imóveis | Max Usuários | Destaque |
|---|---|---|---|---|
| Starter | R$ 54,90 | 50 | 2 | — |
| Basic | R$ 74,90 | 400 | 5 | — |
| Profissional | R$ 119,90 | 1.000 | 8 | ⭐ `is_popular: true` |
| Business | R$ 179,90 | 2.000 | 12 | — |
| Premium | R$ 249,90 | 3.500 | 20 | — |
| Elite | R$ 349,90 | Ilimitado | Ilimitado | — |

---

### `saas_contracts` — Contratos de Assinatura SaaS

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` ✅ | FK → `companies.id` |
| `plan_id` | `uuid` | FK → `saas_plans.id` |
| `plan_name` | `text` | Nome do plano (desnormalizado) |
| `status` | `text` | `active`, `canceled`. Default: `active` |
| `billing_cycle` | `text` | `monthly`, `annual`. Default: `monthly` |
| `price` | `numeric` | Preço contratado |
| `start_date` / `end_date` | `date` | Vigência |
| `has_fidelity` | `boolean` | Tem fidelidade. Default: `false` |
| `fidelity_end_date` | `timestamptz` | Fim da fidelidade |
| `cancel_reason` | `text` | Motivo do cancelamento |
| `canceled_at` | `timestamptz` | Data do cancelamento |
| `customer_id` | `text` | ID do cliente no gateway de pagamento |
| `subscription_id` | `text` | ID da assinatura no gateway de pagamento |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `saas_payments` — Pagamentos SaaS

| Coluna | Tipo | Descrição |
|---|---|---|
| `id` | `uuid` PK | |
| `company_id` | `uuid` ✅ | FK → `companies.id` |
| `amount` | `numeric` ✅ | Valor |
| `status` | `text` | `pending`, `paid`, `overdue`. Default: `pending` |
| `paid_at` | `timestamptz` | Data do pagamento |
| `due_date` | `date` | Vencimento |
| `reference_month` | `date` | Mês de referência |
| `asaas_payment_id` | `text` | ID do pagamento no Asaas |
| `created_at` | `timestamptz` ✅ | Default: `now()` |

---

### `saas_notifications` — Notificações do Super Admin
> Acesso restrito exclusivamente ao `super_admin`.

Campos: `id`, `title`, `message`, `type`, `is_read` (Default: `false`), `link`, `created_at`

---

## 🛡️ POLÍTICAS RLS — RESUMO COMPLETO

### Legenda
✅ Liberado | 🔒 Restrito | 👑 Só super_admin | 🌐 Público

### `companies`
| Operação | Regra |
|---|---|
| SELECT | Própria empresa OU `created_by = auth.uid()` OU 🌐 Público (TenantRouter) |
| INSERT | Autenticados |
| UPDATE | Membro da empresa |
| ALL | 👑 super_admin |

### `profiles`
SELECT: próprio perfil ou da mesma empresa. UPDATE: próprio ou admin. ALL: 👑 super_admin

### `properties`
SELECT: 🌐 Público. INSERT/UPDATE/DELETE: `company_id = get_my_company_id()`

### `leads`
| Operação | Regra |
|---|---|
| SELECT / UPDATE | `company_id = get_my_company_id()` |
| INSERT anon | 🌐 Livre (formulário do site público) |
| INSERT auth | `company_id = get_my_company_id()` |
| DELETE | `company_id = get_my_company_id()` + role `admin`/`super_admin` |

### `tasks`, `contracts`, `installments`, `notifications`, `settings`, `invoices`
CRUD completo restrito a `company_id = get_my_company_id()`. DELETE de `contracts` exige role admin.

### `contract_templates`
Isolada por `tenant_id = get_my_company_id()`

### `timeline_events`, `lead_interests`, `lead_matches`
Isoladas via JOIN com `leads`: acessa se `lead.company_id = get_my_company_id()`

### `message_templates`
Isolado por `user_id = auth.uid()` (pessoal do corretor)

### `site_visits`
INSERT: 🌐 público. SELECT: admin/super_admin

### `saas_contracts`, `saas_payments`
SELECT: `company_id = get_my_company_id()`. ALL: 👑 super_admin

### `saas_plans`
SELECT: 🌐 público. ALL: 👑 super_admin

### `saas_notifications`
SELECT/UPDATE: 👑 super_admin exclusivo

---

## ⚙️ EDGE FUNCTIONS ATIVAS (13 funções)

| Slug | Versão | JWT | Descrição |
|---|---|---|---|
| `create-asaas-checkout` | v10 | ❌ | Cria cobrança/checkout no Asaas |
| `asaas-webhook` | v6 | ❌ | Recebe webhooks do Asaas (pagamentos) |
| `get-asaas-payment-link` | v8 | ❌ | Busca link de pagamento |
| `update-asaas-subscription` | v10 | ❌ | Atualiza assinatura no Asaas |
| `cancel-asaas-subscription` | v1 | ❌ | Cancela assinatura |
| `reactivate-asaas-subscription` | v2 | ❌ | Reativa assinatura cancelada |
| `get-asaas-portal-link` | v1 | ❌ | Link do portal do cliente Asaas |
| `delete-tenant` | v1 | ❌ | Deleta empresa e todos os dados |
| `list-asaas-payments` | v1 | ❌ | Lista pagamentos do Asaas |
| `zap-feed` | v1 | ✅ | Feed de imóveis para portal ZAP Imóveis |
| `generate-charge` | v1 | ✅ | Cobrança genérica (gateway agnóstico) |
| `generate-asaas-charge` | v6 | ❌ | Cobrança direta no Asaas |
| `tenant-webhook` | v1 | ❌ | Webhook de eventos do tenant |

> `zap-feed` e `generate-charge` exigem JWT válido. As demais autenticam internamente.

---

## 🧩 REGRAS DE NEGÓCIO

1. **RLS faz o isolamento:** nunca filtre por `company_id` em SELECTs manualmente.
2. **Novo usuário:** `role = 'admin'`, `company_id = NULL`. Precisa criar/ingressar em empresa.
3. **Imóveis públicos:** SELECT aberto. Apenas escrita é isolada por empresa.
4. **Leads do site:** INSERT anon — `company_id` deve vir do TenantContext no frontend.
5. **Templates:** campo `template` em `companies` define qual template é carregado. Valores: `classic`, `modern`, `luxury`.
6. **Pagamentos:** Asaas é o gateway principal. `payment_gateway` em `companies` permite trocar de gateway sem migrar schema.
7. **Gamificação:** `xp`, `level`, `level_title` em `profiles`.
8. **Storage:** Bucket `company-assets`. Path: `{company_id}/{tipo}-{timestamp}.{ext}`.
9. **Installments × Invoices:** installments = parcelas internas. invoices = cobranças externas com link de pagamento.
10. **contract_templates:** usa `tenant_id`, não `company_id` — atenção no INSERT.
11. **ZAP Feed:** exporta imóveis no formato do portal ZAP Imóveis. Requer JWT.
12. **Feature flags dos planos:** cada plano em `saas_plans` tem colunas booleanas granulares (`has_funnel`, `has_erp`, `has_site`, etc.) que controlam o que cada imobiliária pode acessar.
13. **saas_contracts.customer_id / subscription_id:** armazenam os IDs do gateway diretamente no contrato SaaS, complementando os campos em `companies`.

---

## 📝 CONVENÇÕES DE CÓDIGO

```typescript
// ✅ SELECT — sem filtro manual, RLS faz automaticamente
const { data } = await supabase.from('leads').select('*');

// ✅ INSERT — sempre incluir company_id
await supabase.from('leads').insert({ ...dados, company_id: user.company_id });

// ❌ ERRADO — não filtrar em SELECT
const { data } = await supabase.from('leads').select('*').eq('company_id', user.company_id);

// ✅ TenantContext para sites públicos
const { tenant } = useTenantContext();

// ⚠️ contract_templates usa tenant_id, não company_id!
await supabase.from('contract_templates').insert({ ...dados, tenant_id: user.company_id });

// ✅ invoices — company_id normal
await supabase.from('invoices').insert({ ...dados, company_id: user.company_id });

// ✅ Verificar feature flag de plano antes de renderizar módulo
const { data: contract } = await supabase
  .from('saas_contracts')
  .select('*, plan:saas_plans(has_erp, has_funnel, has_site)')
  .eq('company_id', tenant.id)
  .eq('status', 'active')
  .single();

if (contract?.plan?.has_erp) { /* mostrar módulo ERP */ }
```
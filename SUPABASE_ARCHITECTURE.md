# 🗄️ Arquitetura do Banco de Dados — Elevatio Vendas SaaS
> **Projeto Supabase:** SaaS Elevatio Vendas  
> **Região:** sa-east-1 (São Paulo)  
> **PostgreSQL:** 17.6  
> **Última atualização:** Gerado automaticamente via conexão ao banco em 09/03/2026

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
- Verifica se o usuário é super admin da plataforma (dono do SaaS)
- Quando retorna `true`, bypassa o isolamento multi-tenant

### `handle_new_user()` — Trigger Function
```sql
-- Disparada por: AFTER INSERT ON auth.users (trigger: on_auth_user_created)
INSERT INTO public.profiles (id, email, name, role, active)
VALUES (new.id, new.email, COALESCE(new.raw_user_meta_data->>'full_name', 'Usuário'), 'admin', true)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name;
```
- Cria automaticamente um `profile` para cada novo usuário do Auth
- O usuário entra com `role = 'admin'` e `active = true`
- `company_id` fica `NULL` até o usuário criar ou ingressar em uma empresa

---

## 🏗️ ROLES DE USUÁRIO

| Role | Descrição |
|---|---|
| `super_admin` | Dono da plataforma SaaS. Acesso total a todos os dados de todas as empresas |
| `admin` | Dono/gestor da imobiliária. Acesso total aos dados da própria empresa |
| `corretor` | Corretor da imobiliária. Acesso limitado (não pode deletar leads/contratos) |

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
    │     │                                        │
    │     ├── lead_interests ── properties ────────┤
    │     ├── lead_matches ───── properties        │
    │     └── tasks                                │
    │                                              │
    ├── contracts ─── installments                 │
    │     ├── properties (FK)                      │
    │     ├── leads (FK)                           │
    │     └── profiles/broker (FK)                 │
    │                                              │
    ├── notifications                              │
    ├── message_templates                          │
    └── settings ──────────────────────────────────┘
                                                   │
SaaS Layer (isolado):                              │
    saas_contracts ────────────────────────────────┤
    saas_payments ─────────────────────────────────┤
    saas_plans (público, sem company_id)            │
    saas_notifications (só super_admin)             │
                                                   │
Analytics:                                         │
    site_visits (sem company_id — analytics global)
```

---

## 📋 TABELAS — REFERÊNCIA COMPLETA

---

### `companies` — Imobiliárias (Tenants)
> Tabela raiz do multi-tenancy. Cada linha = 1 imobiliária cliente.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | `gen_random_uuid()` |
| `name` | `text` | ✅ | Nome da imobiliária |
| `slug` | `text` | — | Slug único para URL (ex: `trimoveis`) |
| `subdomain` | `text` | — | Subdomínio único (ex: `trimoveis`) |
| `template` | `text` | — | Template do site público: `classic`, `minimalist`, etc. |
| `plan` | `text` | — | Plano atual: `starter`, `basic`, `profissional`, `business`, `premium`, `elite` |
| `plan_status` | `text` | — | `trial`, `active`, `suspended`, `canceled`. Default: `trial` |
| `trial_ends_at` | `timestamptz` | — | Data de expiração do trial |
| `active` | `boolean` | — | Se a empresa está ativa. Default: `true` |
| `site_data` | `jsonb` | — | Configurações visuais do site público (ver estrutura abaixo) |
| `domain` | `text` | — | Domínio customizado |
| `phone` | `text` | — | Telefone da empresa |
| `document` | `text` | — | CNPJ/CPF |
| `cpf_cnpj` | `text` | — | CNPJ/CPF (campo alternativo) |
| `asaas_customer_id` | `text` | — | ID do cliente no gateway Asaas |
| `asaas_subscription_id` | `text` | — | ID da assinatura no Asaas |
| `created_by` | `uuid` | — | `auth.uid()` de quem criou |
| `created_at` | `timestamptz` | — | Default: `now()` |

**Estrutura do campo `site_data` (JSONB):**
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
  social: {
    instagram: string | null;
    facebook: string | null;
    whatsapp: string | null;     // número sem formatação
    youtube: string | null;
  };
  seo: {
    title: string | null;
    description: string | null;
  };
  contact: {
    email: string | null;
    phone: string | null;
    address: string | null;
  };
}
```

---

### `profiles` — Usuários da Plataforma
> Extensão do `auth.users`. Criado automaticamente pelo trigger `on_auth_user_created`.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | Mesmo ID do `auth.users` |
| `company_id` | `uuid` | — | FK → `companies.id`. NULL até ingressar em empresa |
| `email` | `text` | — | Email do usuário |
| `name` | `text` | — | Nome completo |
| `role` | `text` | ✅ | `admin`, `corretor`, `super_admin`. Default: `corretor` |
| `active` | `boolean` | ✅ | Se o usuário pode acessar o CRM. Default: `false` |
| `phone` | `text` | — | Telefone |
| `avatar_url` | `text` | — | URL do avatar |
| `xp` | `integer` | ✅ | Pontos de XP (gamificação). Default: `0` |
| `xp_points` | `integer` | ✅ | Pontos XP alternativo. Default: `0` |
| `level` | `integer` | ✅ | Nível do corretor. Default: `1` |
| `level_title` | `text` | ✅ | Título do nível. Default: `'Corretor Júnior'` |
| `distribution_rules` | `jsonb` | — | Regras de distribuição de leads. Default: `{"types": [], "enabled": false}` |
| `last_assigned_at` | `timestamptz` | — | Último lead atribuído (para distribuição round-robin) |
| `last_sign_in_at` | `timestamptz` | — | Último login |
| `last_seen` | `timestamptz` | — | Última atividade |
| `created_at` | `timestamptz` | — | Default: `now()` |

---

### `properties` — Imóveis
> Imóveis cadastrados por cada imobiliária. **Leitura pública** (site), escrita isolada por empresa.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | `gen_random_uuid()` |
| `company_id` | `uuid` | — | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `agent_id` | `uuid` | — | FK → `profiles.id` (corretor responsável) |
| `title` | `text` | ✅ | Título do imóvel |
| `description` | `text` | — | Descrição detalhada |
| `price` | `numeric` | ✅ | Preço de venda/aluguel |
| `type` | `text` | ✅ | Tipo: `Casa`, `Apartamento`, `Terreno`, `Comercial`, etc. |
| `listing_type` | `text` | ✅ | `sale` ou `rent`. CHECK constraint |
| `status` | `text` | — | `Disponível`, `Indisponível`, `Vendido`, `Alugado`, `Inativo` |
| `featured` | `boolean` | — | Destaque na home. Default: `false` |
| `slug` | `text` | ✅ | URL amigável, único globalmente |
| `city` | `text` | ✅ | Cidade |
| `neighborhood` | `text` | ✅ | Bairro |
| `state` | `text` | ✅ | Estado |
| `address` | `text` | — | Endereço completo |
| `zip_code` | `text` | — | CEP |
| `latitude` | `float8` | — | Latitude |
| `longitude` | `float8` | — | Longitude |
| `bedrooms` | `integer` | — | Quartos. Default: `0` |
| `bathrooms` | `integer` | — | Banheiros. Default: `0` |
| `suites` | `integer` | — | Suítes. Default: `0` |
| `garage` | `integer` | — | Vagas de garagem. Default: `0` |
| `area` | `numeric` | — | Área total (m²). Default: `0` |
| `built_area` | `numeric` | — | Área construída (m²) |
| `iptu` | `numeric` | — | IPTU mensal. Default: `0` |
| `condominium` | `numeric` | — | Condomínio mensal. Default: `0` |
| `rent_package_price` | `numeric` | — | Pacote completo aluguel (aluguel+cond+iptu) |
| `images` | `text[]` | — | Array de URLs das imagens. Default: `{}` |
| `features` | `text[]` | — | Array de características. Default: `{}` |
| `video_url` | `text` | — | URL do vídeo/tour virtual |
| `financing_available` | `boolean` | — | Aceita financiamento |
| `down_payment` | `numeric` | — | Entrada sugerida |
| `has_balloon` | `boolean` | — | Tem parcela balão. Default: `false` |
| `balloon_value` | `numeric` | — | Valor do balão. Default: `0` |
| `balloon_frequency` | `text` | — | Frequência do balão |
| `seo_title` | `text` | — | Título SEO |
| `seo_description` | `text` | — | Descrição SEO |
| `owner_name` | `text` | — | Nome do proprietário |
| `owner_phone` | `text` | — | Telefone do proprietário |
| `owner_email` | `text` | — | Email do proprietário |
| `owner_document` | `text` | — | CPF/CNPJ do proprietário |
| `owner_profession` | `text` | — | Profissão do proprietário |
| `owner_marital_status` | `text` | — | Estado civil do proprietário |
| `owner_address` | `text` | — | Endereço do proprietário |
| `owner_spouse_name` | `text` | — | Nome do cônjuge |
| `owner_spouse_document` | `text` | — | Documento do cônjuge |
| `property_registration` | `text` | — | Matrícula do imóvel |
| `property_registry_office` | `text` | — | Cartório de registro |
| `property_municipal_registration` | `text` | — | Inscrição municipal |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

---

### `leads` — Leads do CRM
> Potenciais clientes. Núcleo do funil de vendas.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `company_id` | `uuid` | — | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `assigned_to` | `uuid` | — | FK → `profiles.id` (corretor responsável) |
| `property_id` | `uuid` | — | FK → `properties.id` (imóvel de interesse inicial) |
| `sold_property_id` | `uuid` | — | FK → `properties.id` (imóvel que foi vendido) |
| `name` | `text` | ✅ | Nome do lead |
| `email` | `text` | — | Email |
| `phone` | `text` | — | Telefone |
| `message` | `text` | — | Mensagem inicial |
| `source` | `text` | — | Origem: `Site`, `Instagram`, `Indicação`, etc. Default: `Site` |
| `status` | `text` | ✅ | Status atual no CRM. Default: `Novo` |
| `funnel_step` | `text` | — | Etapa do funil Kanban: `pre_atendimento`, `atendimento`, `proposta`, `perdido`. Default: `pre_atendimento` |
| `stage_updated_at` | `timestamptz` | — | Quando mudou de etapa. Default: `now()` |
| `value` | `numeric` | — | Valor estimado do negócio. Default: `0` |
| `deal_value` | `float8` | — | Valor real do negócio fechado |
| `probability` | `integer` | — | Probabilidade de fechamento (%). Default: `20` |
| `score` | `integer` | — | Score interno. Default: `50` |
| `lead_score` | `integer` | — | Score calculado. Default: `0` |
| `score_visit` | `integer` | — | Pontos por visita ao site. Default: `0` |
| `score_favorite` | `integer` | — | Pontos por favoritar. Default: `0` |
| `score_whatsapp` | `integer` | — | Pontos por clique no WhatsApp. Default: `0` |
| `budget` | `numeric` | — | Orçamento disponível |
| `desired_type` | `text` | — | Tipo de imóvel desejado |
| `desired_bedrooms` | `integer` | — | Número de quartos desejados |
| `desired_location` | `text` | — | Localização desejada |
| `loss_reason` | `text` | — | Motivo de perda |
| `proposal_notes` | `text` | — | Notas da proposta |
| `payment_method` | `text` | — | Forma de pagamento |
| `commission_value` | `float8` | — | Valor da comissão |
| `contract_date` | `date` | — | Data do contrato |
| `expected_close_date` | `date` | — | Previsão de fechamento |
| `last_interaction` | `timestamptz` | — | Última interação. Default: `now()` |
| `interested_properties` | `jsonb` | — | Array de IDs de imóveis de interesse. Default: `[]` |
| `navigation_data` | `jsonb` | — | Dados de navegação anônima. Default: `[]` |
| `metadata` | `jsonb` | — | Dados extras. Default: `{}` |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

---

### `tasks` — Tarefas / Agenda
> Tarefas e lembretes dos corretores.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `company_id` | `uuid` | ✅ | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `user_id` | `uuid` | — | FK → `auth.users.id` (responsável) |
| `lead_id` | `uuid` | — | FK → `leads.id` (lead vinculado) |
| `title` | `text` | ✅ | Título da tarefa |
| `description` | `text` | — | Descrição |
| `type` | `text` | — | `call`, `visit`, `email`, `other`. Default: `call` |
| `due_date` | `timestamptz` | — | Data/hora de vencimento |
| `completed` | `boolean` | — | Se foi concluída. Default: `false` |
| `status` | `text` | — | `pending`, `done`. Default: `pending` |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

---

### `contracts` — Contratos Imobiliários
> Contratos de venda e locação.

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `company_id` | `uuid` | ✅ | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `lead_id` | `uuid` | — | FK → `leads.id` |
| `property_id` | `uuid` | — | FK → `properties.id` |
| `broker_id` | `uuid` | — | FK → `profiles.id` |
| `type` | `text` | ✅ | `sale` ou `rent`. CHECK constraint |
| `status` | `text` | — | `pending`, `active`, `canceled`, `archived`, `finished`. Default: `draft` |
| `start_date` | `date` | — | Início do contrato |
| `end_date` | `date` | — | Fim do contrato |
| `sale_total_value` | `numeric` | — | Valor total da venda |
| `sale_down_payment` | `numeric` | — | Entrada |
| `sale_financing_value` | `numeric` | — | Valor financiado |
| `sale_financing_bank` | `text` | — | Banco do financiamento |
| `sale_is_cash` | `boolean` | — | Venda à vista. Default: `false` |
| `sale_payment_method` | `text` | — | Método de pagamento |
| `sale_consortium_value` | `numeric` | — | Valor de consórcio. Default: `0` |
| `has_permutation` | `boolean` | — | Tem permuta. Default: `false` |
| `permutation_details` | `text` | — | Detalhes da permuta |
| `permutation_value` | `numeric` | — | Valor da permuta |
| `rent_value` | `numeric` | — | Valor do aluguel |
| `condo_value` | `numeric` | — | Valor do condomínio |
| `iptu_value` | `numeric` | — | Valor do IPTU |
| `rent_guarantee_type` | `text` | — | Tipo de garantia |
| `rent_readjustment_index` | `text` | — | Índice de reajuste |
| `commission_percentage` | `numeric` | — | % de comissão |
| `commission_total` | `numeric` | — | Valor total da comissão |
| `vistoria_items` | `jsonb` | — | Itens de vistoria. Default: `[]` |
| `deposit_refunded` | `boolean` | — | Depósito devolvido. Default: `false` |
| `notes` | `text` | — | Observações |
| `created_at` | `timestamptz` | — | Default: `now()` |
| `updated_at` | `timestamptz` | — | Default: `now()` |

---

### `installments` — Parcelas de Contrato

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `company_id` | `uuid` | ✅ | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `contract_id` | `uuid` | — | FK → `contracts.id` |
| `amount` | `numeric` | ✅ | Valor da parcela |
| `due_date` | `date` | ✅ | Vencimento |
| `status` | `text` | — | `pending`, `paid`, `overdue`. Default: `pending` |
| `notified_due` | `boolean` | — | Notificação enviada. Default: `false` |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

---

### `timeline_events` — Histórico de Atividades do Lead

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `lead_id` | `uuid` | — | FK → `leads.id` |
| `created_by` | `uuid` | — | `auth.uid()` |
| `type` | `text` | ✅ | Tipo do evento: `note`, `call`, `visit`, `status_change`, etc. |
| `description` | `text` | ✅ | Descrição do evento |
| `metadata` | `jsonb` | — | Dados extras. Default: `{}` |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

> ⚠️ **Sem `company_id` direto** — isolamento via `lead.company_id` nas policies RLS

---

### `notifications` — Notificações In-App

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `company_id` | `uuid` | — | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `user_id` | `uuid` | — | FK → `profiles.id` (destinatário) |
| `title` | `text` | ✅ | Título |
| `message` | `text` | — | Mensagem |
| `type` | `text` | — | `info`, `warning`, `success`, `error`. Default: `info` |
| `read` | `boolean` | — | Se foi lida. Default: `false` |
| `link` | `text` | — | Link de ação |
| `created_at` | `timestamptz` | — | Default: `now()` |

---

### `settings` — Configurações do CRM da Empresa

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `integer` | ✅ PK | |
| `company_id` | `uuid` | — | FK → `companies.id` ⚠️ Obrigatório no INSERT |
| `company_name` | `text` | — | Nome da empresa. Default: `'TR Imóveis'` |
| `auto_distribution` | `boolean` | — | Distribuição automática de leads. Default: `false` |
| `route_to_central` | `boolean` | — | Rotear leads para central. Default: `true` |
| `central_whatsapp` | `text` | — | WhatsApp da central. Default: `''` |
| `central_user_id` | `uuid` | — | FK → `profiles.id` (usuário central) |
| `kanban_config` | `jsonb` | — | Configuração das etapas do Kanban |

---

### `message_templates` — Templates de Mensagem WhatsApp/Email

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `user_id` | `uuid` | — | FK → `auth.users.id` ⚠️ Isolado por user, não company |
| `title` | `text` | ✅ | Nome do template |
| `content` | `text` | ✅ | Conteúdo com variáveis |
| `active` | `boolean` | — | Default: `true` |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

---

### `lead_interests` — Imóveis de Interesse do Lead

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `lead_id` | `uuid` | — | FK → `leads.id` |
| `property_id` | `uuid` | — | FK → `properties.id` |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

---

### `lead_matches` — Matches Automáticos Lead ↔ Imóvel

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `lead_id` | `uuid` | — | FK → `leads.id` |
| `property_id` | `uuid` | — | FK → `properties.id` |
| `match_score` | `integer` | — | Score do match (0-100) |
| `match_reason` | `text` | — | Motivo do match |
| `created_at` | `timestamptz` | — | Default: `now()` |

---

### `site_visits` — Analytics de Visitas ao Site Público

| Coluna | Tipo | Obrigatório | Descrição |
|---|---|---|---|
| `id` | `uuid` | ✅ PK | |
| `page` | `text` | ✅ | URL/rota visitada |
| `session_id` | `text` | — | ID da sessão |
| `device_id` | `text` | — | ID do dispositivo |
| `created_at` | `timestamptz` | ✅ | Default: `now()` |

> ⚠️ **Sem `company_id`** — analytics global da plataforma

---

## 💳 TABELAS SaaS (Gestão da Plataforma)

### `saas_plans` — Planos de Assinatura

| Plano | Preço | Max Imóveis | Max Usuários |
|---|---|---|---|
| `Starter` | R$ 54,90 | 50 | 2 |
| `Basic` | R$ 74,90 | 400 | 5 |
| `Profissional` ⭐ | R$ 119,90 | 1.000 | 8 |
| `Business` | R$ 179,90 | 2.000 | 12 |
| `Premium` | R$ 249,90 | 3.500 | 20 |
| `Elite` | R$ 349,90 | Ilimitado | Ilimitado |

### `saas_contracts` — Contratos de Assinatura SaaS

Vincula empresa ao plano. Campos: `company_id`, `plan_id`, `status` (`active`, `canceled`), `billing_cycle` (`monthly`, `annual`), `price`, `start_date`, `end_date`, `has_fidelity`, `fidelity_end_date`, `cancel_reason`.

### `saas_payments` — Pagamentos SaaS (via Asaas)

Histórico de pagamentos. Campos: `company_id`, `amount`, `status` (`pending`, `paid`, `overdue`), `paid_at`, `due_date`, `reference_month`, `asaas_payment_id`.

### `saas_notifications` — Notificações do Super Admin

Notificações internas da plataforma. Acesso restrito ao `super_admin`.

---

## 🛡️ POLÍTICAS RLS — RESUMO COMPLETO

### Legenda
- ✅ Liberado | 🔒 Restrito | 👑 Só super_admin | 🌐 Público

### `companies`
| Operação | Regra | Quem |
|---|---|---|
| SELECT | `id = get_my_company_id()` | Própria empresa |
| SELECT | `created_by = auth.uid()` | Recém criada |
| SELECT | `true` | 🌐 Público (leitura para TenantRouter) |
| INSERT | `auth.role() = 'authenticated'` | Autenticados |
| UPDATE | `id IN (SELECT company_id FROM profiles WHERE id = auth.uid())` | Membro da empresa |
| ALL | `is_super_admin()` | 👑 Super admin |

### `profiles`
| Operação | Regra |
|---|---|
| SELECT | `auth.uid() = id` OU `company_id = get_my_company_id()` |
| UPDATE | Próprio perfil OU admin da mesma empresa |
| ALL | 👑 Super admin |

### `properties`
| Operação | Regra |
|---|---|
| SELECT | 🌐 Público (imóveis são públicos para o site) |
| INSERT | `company_id = get_my_company_id()` |
| UPDATE | `company_id = get_my_company_id()` |
| DELETE | `company_id = get_my_company_id()` |

### `leads`
| Operação | Regra |
|---|---|
| SELECT | `company_id = get_my_company_id()` |
| INSERT (authenticated) | `company_id = get_my_company_id()` |
| INSERT (anon) | 🌐 Livre (formulário do site público) |
| UPDATE | `company_id = get_my_company_id()` |
| DELETE | `company_id = get_my_company_id()` + role `admin`/`super_admin` |

### `tasks`, `contracts`, `installments`, `notifications`, `settings`
Todas seguem o mesmo padrão: **CRUD completo restrito a `company_id = get_my_company_id()`**. Delete de `contracts` exige role `admin` ou `super_admin`.

### `timeline_events`, `lead_interests`, `lead_matches`
Isoladas via JOIN com `leads`: só acessa se o `lead.company_id = get_my_company_id()`.

### `message_templates`
Isolado por `user_id = auth.uid()` (pessoal do corretor, não da empresa).

### `site_visits`
INSERT: 🌐 público e autenticados. SELECT: só `admin`/`super_admin`.

### `saas_contracts`, `saas_payments`
SELECT: `company_id = get_my_company_id()`. ALL: 👑 super_admin.

### `saas_plans`
SELECT: 🌐 público. ALL: 👑 super_admin.

### `saas_notifications`
SELECT/UPDATE: só `super_admin` (via JWT `user_metadata.role`).

---

## ⚙️ EDGE FUNCTIONS ATIVAS

| Slug | Descrição | JWT Verify |
|---|---|---|
| `create-asaas-checkout` | Cria cobrança/checkout no Asaas | ❌ |
| `asaas-webhook` | Recebe webhooks do Asaas (pagamentos) | ❌ |
| `get-asaas-payment-link` | Busca link de pagamento | ❌ |
| `update-asaas-subscription` | Atualiza assinatura no Asaas | ❌ |
| `cancel-asaas-subscription` | Cancela assinatura | ❌ |
| `reactivate-asaas-subscription` | Reativa assinatura cancelada | ❌ |
| `get-asaas-portal-link` | Link do portal do cliente Asaas | ❌ |
| `delete-tenant` | Deleta empresa e todos os dados | ❌ |
| `list-asaas-payments` | Lista pagamentos do Asaas | ❌ |

> ⚠️ Todas as Edge Functions têm `verify_jwt: false`. A autenticação deve ser feita internamente em cada função.

---

## 🧩 REGRAS DE NEGÓCIO IMPORTANTES

1. **Multi-tenancy via RLS:** Nunca filtre manualmente por `company_id` em SELECTs — o RLS faz isso. Sempre inclua em INSERTs.

2. **Novo usuário:** Entra com `role = 'admin'` e `company_id = NULL`. Precisa criar/ingressar em empresa para usar o CRM.

3. **Imóveis são públicos:** Qualquer visitante do site pode listar e ver imóveis (`SELECT` público). Apenas escrita é restrita.

4. **Leads do site:** Formulários públicos inserem leads com `anon` role — a `company_id` deve ser passada pelo frontend via contexto do tenant.

5. **Templates do site:** O `template` field em `companies` define qual pasta de `src/templates/` é carregada pelo `TenantRouter`. Valores: `classic`, `minimalist` (outros podem ser adicionados).

6. **Pagamentos via Asaas:** Todo fluxo financeiro do SaaS passa pelo Asaas (gateway brasileiro). O `asaas_customer_id` e `asaas_subscription_id` ficam em `companies`.

7. **Gamificação:** Corretores têm `xp`, `level` e `level_title` em `profiles` para engajamento.

8. **Storage:** Bucket `company-assets` para uploads de logo, hero, favicon etc. Path: `{company_id}/{tipo}-{timestamp}.{ext}`.

---

## 📝 CONVENÇÕES DE CÓDIGO

```typescript
// ✅ CORRETO — SELECT (sem filtro company_id, RLS faz automaticamente)
const { data } = await supabase.from('leads').select('*');

// ✅ CORRETO — INSERT (sempre incluir company_id)
await supabase.from('leads').insert({ ...dados, company_id: user.company_id });

// ❌ ERRADO — não filtrar manualmente em SELECT
const { data } = await supabase.from('leads').select('*').eq('company_id', user.company_id);

// ✅ Para templates públicos — usar TenantContext, nunca query direta
const { tenant, properties } = useTenantContext();

// ✅ Verificar super admin
if (user.role === 'super_admin') { /* acesso total */ }
```

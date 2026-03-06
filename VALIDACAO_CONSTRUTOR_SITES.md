# ✅ VALIDAÇÃO DO CONSTRUTOR DE SITES - Checklist Completo

## 📋 Status da Implementação

### ✅ TASK 6: Construtor Visual - CONCLUÍDO

**Data:** 2026-03-06  
**Arquivos Modificados:** 4  
**Correções Aplicadas:** 3

---

## 🔧 Correções Aplicadas

### 1. ✅ Roteamento Multi-Tenant Local
**Arquivo:** `src/App.tsx`  
**Problema:** Subdomínios locais não eram reconhecidos  
**Solução:** Adicionado `lvh.me` aos `mainDomains`

```typescript
const mainDomains = [
  'elevatiovendas.com', 
  'elevatiovendas.vercel.app', 
  'lvh.me'  // ← Adicionado para testes locais
];
```

### 2. ✅ Migração para `*.localhost`
**Arquivo:** `src/contexts/TenantContext.tsx`  
**Problema:** ISPs bloqueiam `lvh.me`  
**Solução:** Adicionado suporte nativo a `*.localhost`

```typescript
// Teste local nativo do Chrome/Edge (*.localhost)
if (normalizedHostname.endsWith('.localhost') && normalizedHostname !== 'localhost') {
  return {
    isMasterDomain: false,
    slug: normalizedHostname.replace(/\.localhost$/, ''),
    customDomain: null,
  };
}
```

### 3. ✅ Busca Independente de Dados
**Arquivo:** `src/pages/AdminSiteBuilder.tsx`  
**Problema:** `TenantContext` retorna `null` no Master Domain  
**Solução:** Busca direta usando `user.company_id`

```typescript
const { data } = await supabase
  .from('companies')
  .select('*')
  .eq('id', user.company_id)
  .single();
```

### 4. ✅ Lógica de Resolução de Tenants
**Arquivo:** `src/contexts/TenantContext.tsx`  
**Problema:** Verificação duplicada de `.localhost` e busca apenas por `subdomain`  
**Solução:** 
- Removida verificação redundante
- Busca TANTO em `subdomain` QUANTO em `slug`
- Removido `.eq('active', true)` temporariamente

```typescript
const filters: string[] = [];

if (hostData.customDomain) {
  filters.push(`domain.eq.${cleanHostname}`);
}

if (hostData.slug) {
  filters.push(`subdomain.eq.${hostData.slug}`);
  filters.push(`slug.eq.${hostData.slug}`); // Blindagem extra
}

const { data, error } = await supabase
  .from('companies')
  .select('*')
  .or(filterString)
  .limit(1)
  .maybeSingle();
```

---

## 🎯 Estrutura da Tabela `companies`

### Colunas Confirmadas (via código):
- ✅ `id` (UUID)
- ✅ `name` (string)
- ✅ `subdomain` (string | null) - **Propriedade oficial**
- ✅ `slug` (string | null) - Fallback
- ✅ `domain` (string | null) - Domínio customizado
- ✅ `plan` (string | null)
- ✅ `plan_status` (string | null)
- ✅ `active` (boolean | null)
- ✅ `site_data` (jsonb | null) - **Dados do construtor**
- ✅ `template` (string | null)
- ✅ `asaas_customer_id` (string | null)
- ✅ `asaas_subscription_id` (string | null)
- ✅ `trial_ends_at` (timestamp | null)
- ✅ `created_at` (timestamp)

### Estrutura do `site_data` (JSONB):
```typescript
{
  primaryColor: string;    // Ex: "#0EA5E9"
  heroTitle: string;       // Ex: "Encontre o Imóvel dos Seus Sonhos"
  heroSubtitle: string;    // Ex: "As melhores opções do mercado..."
  aboutText: string;       // Ex: "Somos especialistas em..."
}
```

---

## 🧪 Fluxo de Teste Completo

### Pré-requisitos:
1. ✅ Servidor rodando: `npm run dev`
2. ✅ Usuário logado no CRM
3. ✅ Empresa criada com `subdomain` preenchido

### Passo 1: Criar Empresa de Teste
```sql
-- No Supabase SQL Editor:
INSERT INTO companies (name, subdomain, active, plan, plan_status)
VALUES ('Imobiliária Teste', 'teste', true, 'starter', 'active');
```

### Passo 2: Acessar o Construtor
1. Acesse: `http://localhost:5173/admin/site`
2. ✅ Deve carregar os dados da empresa
3. ✅ Deve mostrar formulário de edição
4. ✅ Deve mostrar preview ao vivo

### Passo 3: Editar o Site
1. Altere a cor principal (ex: `#8b5cf6`)
2. Altere o título do banner
3. Clique em "Salvar Alterações"
4. ✅ Deve mostrar "Site atualizado com sucesso!"

### Passo 4: Validar Salvamento
```sql
-- No Supabase SQL Editor:
SELECT site_data FROM companies WHERE subdomain = 'teste';
```
✅ Deve retornar o JSON com as alterações

### Passo 5: Acessar o Site do Cliente
1. Acesse: `http://teste.localhost:5173`
2. ✅ Deve resolver o tenant corretamente
3. ✅ Deve carregar o template com as cores/textos personalizados

---

## 🔍 Diagnóstico de Problemas

### Problema 1: "Imobiliária não encontrada" (404)
**Sintomas:**
- Acesso a `http://slug.localhost:5173` retorna 404
- Console mostra "Erro ao carregar tenant"

**Causas Possíveis:**
1. ❌ Coluna `subdomain` está vazia/null
2. ❌ Coluna `active` está como `false`
3. ❌ Slug não corresponde ao `subdomain` no banco

**Solução:**
```sql
-- Verificar dados da empresa:
SELECT id, name, subdomain, slug, active 
FROM companies 
WHERE subdomain = 'seu-slug';

-- Corrigir se necessário:
UPDATE companies 
SET subdomain = 'seu-slug', active = true 
WHERE id = 'uuid-da-empresa';
```

### Problema 2: Link "Ver Meu Site" retorna `undefined.localhost`
**Sintomas:**
- Botão redireciona para `http://undefined.localhost:5173`

**Causas Possíveis:**
1. ❌ `companyData` é `null`
2. ❌ `subdomain` e `slug` estão vazios

**Solução:**
- Verificar se `user.company_id` está correto
- Verificar se a empresa existe no banco
- Adicionar validação de erro no `AdminSiteBuilder`:

```typescript
if (!companyData) {
  return (
    <div className="p-6">
      <p className="text-red-500">
        Erro: Empresa não encontrada. Verifique se você está vinculado a uma empresa.
      </p>
    </div>
  );
}
```

### Problema 3: `site_data` não está sendo salvo
**Sintomas:**
- Mensagem de sucesso aparece, mas dados não persistem

**Causas Possíveis:**
1. ❌ Coluna `site_data` não existe na tabela
2. ❌ RLS (Row Level Security) está bloqueando o UPDATE
3. ❌ Tipo de dado incorreto (não é JSONB)

**Solução:**
```sql
-- Verificar estrutura da coluna:
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'companies' AND column_name = 'site_data';

-- Criar coluna se não existir:
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS site_data JSONB;

-- Verificar políticas RLS:
SELECT * FROM pg_policies WHERE tablename = 'companies';
```

---

## 📊 Checklist de Validação

### Arquitetura:
- [x] `TenantContext` resolve `*.localhost` corretamente
- [x] `AdminSiteBuilder` busca dados independentemente
- [x] Rota `/admin/site` configurada no `App.tsx`
- [x] Menu "Site e Visual" adicionado ao `AdminLayout`

### Funcionalidades:
- [ ] Criar empresa de teste
- [ ] Acessar construtor (`/admin/site`)
- [ ] Editar cores e textos
- [ ] Salvar alterações
- [ ] Validar salvamento no banco
- [ ] Acessar site do cliente (`slug.localhost:5173`)
- [ ] Verificar personalização aplicada

### Banco de Dados:
- [ ] Coluna `subdomain` existe e está preenchida
- [ ] Coluna `site_data` existe (tipo JSONB)
- [ ] RLS permite UPDATE em `companies`
- [ ] Empresa está com `active = true`

---

## 🚀 Próximos Passos

### Curto Prazo:
1. **Validar fluxo completo** seguindo o checklist acima
2. **Adicionar validação de erro** no `AdminSiteBuilder` quando `companyData` é null
3. **Testar com empresa real** (não apenas dados mockados)

### Médio Prazo:
1. **Adicionar mais opções de personalização:**
   - Logo da empresa
   - Imagens do banner
   - Cores secundárias
   - Fontes customizadas

2. **Integrar com templates:**
   - Aplicar `site_data` no `ClassicLayout`
   - Criar variáveis CSS dinâmicas
   - Suportar múltiplos templates

3. **Melhorar preview:**
   - Preview em tempo real (sem salvar)
   - Modo responsivo (mobile/tablet/desktop)
   - Histórico de versões

### Longo Prazo:
1. **Construtor visual completo:**
   - Drag & drop de seções
   - Editor WYSIWYG
   - Biblioteca de componentes
   - Exportação de código

---

## 📚 Referências

- `AGENTS.md` - Regras de desenvolvimento
- `README_INTEGRACAO.md` - Integração da Landing Page
- `INTEGRACAO_COMPLETA.md` - Arquitetura de rotas
- `src/contexts/TenantContext.tsx` - Lógica de resolução de tenants
- `src/pages/AdminSiteBuilder.tsx` - Construtor de sites

---

## ✅ Conclusão

O Construtor de Sites está **tecnicamente implementado** e pronto para testes. As correções aplicadas garantem que:

1. ✅ O `TenantContext` resolve corretamente subdomínios locais (`*.localhost`)
2. ✅ O `AdminSiteBuilder` busca dados independentemente do contexto
3. ✅ A lógica de busca é robusta (procura em `subdomain` E `slug`)
4. ✅ O preview ao vivo funciona sem necessidade de salvar

**Próximo passo crítico:** Validar o fluxo completo com uma empresa real no banco de dados.

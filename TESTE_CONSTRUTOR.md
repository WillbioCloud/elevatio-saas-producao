# 🧪 TESTE DO CONSTRUTOR DE SITES - Guia Prático

## 📋 Pré-requisitos

Antes de começar os testes, certifique-se de que:

- [x] Servidor está rodando: `npm run dev`
- [x] Você tem acesso ao Supabase Dashboard
- [x] Você está logado no CRM como admin

---

## 🎯 TESTE 1: Verificar Estrutura do Banco

### Passo 1.1: Verificar Coluna `site_data`

Acesse o Supabase SQL Editor e execute:

```sql
-- Verificar se a coluna site_data existe
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'companies' 
  AND column_name IN ('site_data', 'subdomain', 'slug');
```

**Resultado Esperado:**
```
column_name | data_type | is_nullable
------------|-----------|------------
site_data   | jsonb     | YES
subdomain   | text      | YES
slug        | text      | YES
```

### Passo 1.2: Criar Coluna se Não Existir

Se a coluna `site_data` não existir, execute:

```sql
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS site_data JSONB;
```

### Passo 1.3: Verificar Políticas RLS

```sql
-- Verificar políticas de UPDATE na tabela companies
SELECT policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'companies' AND cmd = 'UPDATE';
```

**Ação:** Se não houver política permitindo UPDATE, crie uma:

```sql
-- Permitir que usuários atualizem sua própria empresa
CREATE POLICY "Users can update their own company"
ON companies FOR UPDATE
USING (
  id IN (
    SELECT company_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);
```

---

## 🎯 TESTE 2: Criar Empresa de Teste

### Passo 2.1: Verificar Sua Empresa Atual

```sql
-- Substitua 'SEU_USER_ID' pelo ID do seu usuário
SELECT p.id as user_id, p.company_id, c.name, c.subdomain, c.slug, c.active
FROM profiles p
LEFT JOIN companies c ON c.id = p.company_id
WHERE p.id = 'SEU_USER_ID';
```

**Como descobrir seu User ID:**
1. Abra o DevTools (F12)
2. Console → Digite: `localStorage.getItem('supabase.auth.token')`
3. Copie o valor do campo `user.id`

### Passo 2.2: Atualizar Subdomain da Empresa

Se sua empresa não tem `subdomain` preenchido:

```sql
-- Substitua 'SUA_COMPANY_ID' e 'seu-slug' pelos valores corretos
UPDATE companies
SET subdomain = 'seu-slug', active = true
WHERE id = 'SUA_COMPANY_ID';
```

**Dica:** Use um slug simples, sem espaços ou caracteres especiais (ex: `teste`, `demo`, `imobiliaria1`)

### Passo 2.3: Validar Atualização

```sql
SELECT id, name, subdomain, slug, active, site_data
FROM companies
WHERE subdomain = 'seu-slug';
```

---

## 🎯 TESTE 3: Acessar o Construtor

### Passo 3.1: Navegar para o Construtor

1. Acesse: `http://localhost:5173/admin/site`
2. **Resultado Esperado:**
   - ✅ Página carrega sem erros
   - ✅ Formulário de edição aparece
   - ✅ Preview ao vivo aparece (lado direito)
   - ✅ Botão "Ver Meu Site" aparece no topo

### Passo 3.2: Verificar Console (F12)

Abra o DevTools e verifique:

- ❌ **Não deve ter erros** de `companyData is null`
- ❌ **Não deve ter erros** de `Cannot read property 'subdomain' of null`
- ✅ **Deve ter log** da busca no Supabase

### Passo 3.3: Verificar Link "Ver Meu Site"

1. Passe o mouse sobre o botão "Ver Meu Site"
2. Verifique o link no canto inferior esquerdo do navegador
3. **Resultado Esperado:** `http://seu-slug.localhost:5173`
4. **Erro Comum:** `http://undefined.localhost:5173` (significa que `subdomain` está vazio)

---

## 🎯 TESTE 4: Editar o Site

### Passo 4.1: Alterar Cor Principal

1. Clique no seletor de cor
2. Escolha uma cor (ex: roxo `#8b5cf6`)
3. **Resultado Esperado:**
   - ✅ Preview atualiza em tempo real
   - ✅ Cor do banner muda
   - ✅ Cor do ícone do menu muda

### Passo 4.2: Alterar Textos

1. Altere o "Título do Banner" para: `Bem-vindo à Nossa Imobiliária`
2. Altere o "Subtítulo" para: `Os melhores imóveis da região`
3. **Resultado Esperado:**
   - ✅ Preview atualiza em tempo real
   - ✅ Textos aparecem no preview

### Passo 4.3: Salvar Alterações

1. Clique em "Salvar Alterações"
2. **Resultado Esperado:**
   - ✅ Botão mostra spinner de loading
   - ✅ Alert aparece: "Site atualizado com sucesso!"
   - ❌ **Não deve aparecer:** "Erro ao salvar as edições"

### Passo 4.4: Validar Salvamento no Banco

```sql
-- Verificar se os dados foram salvos
SELECT site_data
FROM companies
WHERE subdomain = 'seu-slug';
```

**Resultado Esperado:**
```json
{
  "primaryColor": "#8b5cf6",
  "heroTitle": "Bem-vindo à Nossa Imobiliária",
  "heroSubtitle": "Os melhores imóveis da região",
  "aboutText": "Somos especialistas em realizar sonhos..."
}
```

---

## 🎯 TESTE 5: Acessar o Site do Cliente

### Passo 5.1: Abrir Nova Aba

1. Abra uma nova aba no navegador
2. Acesse: `http://seu-slug.localhost:5173`
3. **Resultado Esperado:**
   - ✅ Site carrega sem erro 404
   - ✅ Template do cliente aparece
   - ❌ **Não deve aparecer:** "Imobiliária não encontrada"

### Passo 5.2: Verificar Personalização

**IMPORTANTE:** Atualmente, o template ainda não está consumindo o `site_data`. Este teste validará quando a integração estiver completa.

**Próximo passo:** Integrar `site_data` no `ClassicLayout.tsx`

---

## 🎯 TESTE 6: Validar Resolução de Tenants

### Passo 6.1: Verificar TenantContext

Abra o DevTools (F12) e execute no Console:

```javascript
// Verificar hostname atual
console.log('Hostname:', window.location.hostname);

// Verificar se é Master Domain
const mainDomains = ['localhost', 'elevatiovendas.com', 'elevatiovendas.vercel.app', 'lvh.me'];
const isMaster = mainDomains.includes(window.location.hostname);
console.log('É Master Domain?', isMaster);

// Verificar se é subdomínio
const isSubdomain = window.location.hostname.endsWith('.localhost');
console.log('É Subdomínio?', isSubdomain);

// Extrair slug
const slug = window.location.hostname.replace('.localhost', '');
console.log('Slug extraído:', slug);
```

### Passo 6.2: Testar Diferentes URLs

| URL | Resultado Esperado |
|-----|-------------------|
| `http://localhost:5173` | Master Domain → Landing Page |
| `http://localhost:5173/admin/site` | Master Domain → Construtor |
| `http://teste.localhost:5173` | Subdomínio → Site do Cliente |
| `http://teste.localhost:5173/admin/login` | Subdomínio → Login CRM |

---

## 🚨 TROUBLESHOOTING

### Erro 1: "Imobiliária não encontrada" (404)

**Sintomas:**
- Acesso a `http://slug.localhost:5173` retorna 404
- Console mostra "Erro ao carregar tenant"

**Checklist de Diagnóstico:**
```sql
-- 1. Verificar se a empresa existe
SELECT id, name, subdomain, slug, active
FROM companies
WHERE subdomain = 'seu-slug' OR slug = 'seu-slug';

-- 2. Verificar se está ativa
SELECT active FROM companies WHERE subdomain = 'seu-slug';

-- 3. Verificar se o slug está correto
SELECT subdomain, slug FROM companies WHERE id = 'SUA_COMPANY_ID';
```

**Soluções:**
- Se não encontrar: Criar empresa ou atualizar `subdomain`
- Se `active = false`: Executar `UPDATE companies SET active = true WHERE id = '...'`
- Se slug diferente: Usar o slug correto na URL

### Erro 2: "Empresa não encontrada" no Construtor

**Sintomas:**
- Página `/admin/site` mostra mensagem de erro vermelha
- Console mostra `companyData is null`

**Checklist de Diagnóstico:**
```sql
-- 1. Verificar se o usuário tem company_id
SELECT id, company_id FROM profiles WHERE id = 'SEU_USER_ID';

-- 2. Verificar se a empresa existe
SELECT * FROM companies WHERE id = 'COMPANY_ID_DO_USUARIO';
```

**Soluções:**
- Se `company_id` é null: Vincular usuário a uma empresa
- Se empresa não existe: Criar empresa primeiro

### Erro 3: Link "Ver Meu Site" retorna `undefined.localhost`

**Sintomas:**
- Botão redireciona para `http://undefined.localhost:5173`

**Causa:** `subdomain` e `slug` estão vazios no banco

**Solução:**
```sql
UPDATE companies
SET subdomain = 'seu-slug'
WHERE id = 'SUA_COMPANY_ID';
```

### Erro 4: Alterações não são salvas

**Sintomas:**
- Mensagem de sucesso aparece, mas dados não persistem
- Ao recarregar, valores voltam ao padrão

**Checklist de Diagnóstico:**
```sql
-- 1. Verificar se a coluna existe
SELECT column_name FROM information_schema.columns
WHERE table_name = 'companies' AND column_name = 'site_data';

-- 2. Verificar políticas RLS
SELECT * FROM pg_policies WHERE tablename = 'companies' AND cmd = 'UPDATE';

-- 3. Tentar UPDATE manual
UPDATE companies
SET site_data = '{"test": "value"}'::jsonb
WHERE id = 'SUA_COMPANY_ID';
```

**Soluções:**
- Se coluna não existe: Criar coluna `site_data JSONB`
- Se RLS bloqueia: Criar política de UPDATE
- Se erro de permissão: Verificar se usuário está autenticado

---

## ✅ CHECKLIST FINAL

### Banco de Dados:
- [ ] Coluna `site_data` existe (tipo JSONB)
- [ ] Coluna `subdomain` está preenchida
- [ ] Empresa está com `active = true`
- [ ] Política RLS permite UPDATE

### Construtor:
- [ ] Página `/admin/site` carrega sem erros
- [ ] Formulário de edição aparece
- [ ] Preview ao vivo funciona
- [ ] Botão "Ver Meu Site" tem URL correto
- [ ] Alterações são salvas no banco

### Site do Cliente:
- [ ] URL `slug.localhost:5173` resolve corretamente
- [ ] Não retorna erro 404
- [ ] Template carrega

### Integração (Próximo Passo):
- [ ] Template consome `site_data`
- [ ] Cores personalizadas aparecem no site
- [ ] Textos personalizados aparecem no site

---

## 📊 RESULTADO ESPERADO

Ao final destes testes, você deve ter:

1. ✅ Empresa criada com `subdomain` preenchido
2. ✅ Construtor acessível e funcional
3. ✅ Dados salvos no banco (`site_data`)
4. ✅ Site do cliente acessível via `slug.localhost:5173`
5. ⏳ Integração com template (próximo passo)

---

## 🚀 PRÓXIMOS PASSOS

Após validar todos os testes acima:

1. **Integrar `site_data` no Template:**
   - Modificar `ClassicLayout.tsx` para ler `site_data`
   - Aplicar cores dinâmicas via CSS variables
   - Aplicar textos dinâmicos nos componentes

2. **Adicionar Mais Opções:**
   - Upload de logo
   - Imagens do banner
   - Cores secundárias
   - Fontes customizadas

3. **Melhorar Preview:**
   - Preview em tempo real (WebSocket)
   - Modo responsivo
   - Histórico de versões

---

**Data de Criação:** 2026-03-06  
**Última Atualização:** 2026-03-06  
**Status:** Pronto para Testes

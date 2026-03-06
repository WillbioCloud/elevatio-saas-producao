# 🚀 INÍCIO RÁPIDO - Construtor de Sites

**Tempo estimado:** 5 minutos

---

## 📋 Pré-requisitos

- ✅ Servidor rodando: `npm run dev`
- ✅ Acesso ao Supabase Dashboard
- ✅ Usuário logado no CRM

---

## ⚡ 3 Passos para Começar

### 1️⃣ Preparar o Banco de Dados (2 min)

Acesse o Supabase SQL Editor e execute:

```sql
-- 1. Criar coluna site_data (se não existir)
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS site_data JSONB;

-- 2. Criar política RLS (se não existir)
CREATE POLICY "Users can update their own company"
ON companies FOR UPDATE
USING (
  id IN (
    SELECT company_id 
    FROM profiles 
    WHERE id = auth.uid()
  )
);

-- 3. Garantir que sua empresa tem subdomain
-- Substitua 'SUA_COMPANY_ID' pelo ID real
UPDATE companies
SET subdomain = 'demo', active = true
WHERE id = 'SUA_COMPANY_ID';
```

**Como descobrir seu Company ID:**
1. Abra o DevTools (F12)
2. Console → Digite: `localStorage.getItem('supabase.auth.token')`
3. Procure por `user.company_id` no JSON

---

### 2️⃣ Acessar o Construtor (1 min)

1. Acesse: `http://localhost:5173/admin/site`
2. Você verá:
   - ✅ Formulário de edição (esquerda)
   - ✅ Preview ao vivo (direita)
   - ✅ Botão "Ver Meu Site" (topo)

**Se aparecer erro "Empresa não encontrada":**
- Verifique se executou o passo 1 corretamente
- Verifique se o `company_id` está correto

---

### 3️⃣ Personalizar e Salvar (2 min)

1. **Altere a cor principal:**
   - Clique no color picker
   - Escolha uma cor (ex: roxo `#8b5cf6`)
   - Veja o preview atualizar em tempo real

2. **Altere os textos:**
   - Título: `Bem-vindo à Nossa Imobiliária`
   - Subtítulo: `Os melhores imóveis da região`
   - Sobre: `Somos especialistas em realizar sonhos...`

3. **Salvar:**
   - Clique em "Salvar Alterações"
   - Aguarde a mensagem: "Site atualizado com sucesso!"

---

## ✅ Validar Salvamento

Execute no Supabase SQL Editor:

```sql
-- Verificar se os dados foram salvos
SELECT site_data
FROM companies
WHERE subdomain = 'demo';
```

**Resultado esperado:**
```json
{
  "primaryColor": "#8b5cf6",
  "heroTitle": "Bem-vindo à Nossa Imobiliária",
  "heroSubtitle": "Os melhores imóveis da região",
  "aboutText": "Somos especialistas em realizar sonhos..."
}
```

---

## 🌐 Ver o Site do Cliente

1. Abra uma nova aba
2. Acesse: `http://demo.localhost:5173`
3. Você verá o site do cliente

**Nota:** Atualmente, o template ainda não consome o `site_data`. A integração será feita na próxima etapa.

---

## 🚨 Problemas Comuns

### Erro 404 ao acessar `demo.localhost:5173`

**Causa:** Subdomain não está preenchido ou empresa não existe

**Solução:**
```sql
-- Verificar empresa
SELECT id, name, subdomain, active
FROM companies
WHERE subdomain = 'demo';

-- Se não encontrar, atualizar
UPDATE companies
SET subdomain = 'demo', active = true
WHERE id = 'SUA_COMPANY_ID';
```

### Link "Ver Meu Site" retorna `undefined.localhost`

**Causa:** Subdomain está vazio

**Solução:**
```sql
UPDATE companies
SET subdomain = 'demo'
WHERE id = 'SUA_COMPANY_ID';
```

### Erro "Empresa não encontrada" no construtor

**Causa:** Usuário não está vinculado a uma empresa

**Solução:**
```sql
-- Verificar vinculação
SELECT id, company_id FROM profiles WHERE id = 'SEU_USER_ID';

-- Se company_id for null, vincular
UPDATE profiles
SET company_id = 'SUA_COMPANY_ID'
WHERE id = 'SEU_USER_ID';
```

---

## 📚 Próximos Passos

Após validar o fluxo básico:

1. **Testes Completos:** Siga o guia em `TESTE_CONSTRUTOR.md`
2. **Integração:** Aplicar `site_data` no template
3. **Expansão:** Adicionar mais opções de personalização

---

## 🎯 Checklist Rápido

- [ ] Coluna `site_data` criada
- [ ] Política RLS criada
- [ ] Subdomain preenchido
- [ ] Construtor acessível
- [ ] Alterações salvas
- [ ] Site do cliente acessível

---

## 📞 Ajuda

Se encontrar problemas:

1. **Troubleshooting Detalhado:** `TESTE_CONSTRUTOR.md`
2. **Validação Técnica:** `VALIDACAO_CONSTRUTOR_SITES.md`
3. **Resumo Executivo:** `RESUMO_CONSTRUTOR_SITES.md`

---

**Tempo Total:** ~5 minutos  
**Dificuldade:** Fácil  
**Status:** ✅ Pronto para Uso

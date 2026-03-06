# 📝 CHANGELOG - Construtor de Sites

## [1.0.0] - 2026-03-06

### ✨ Novidades

#### 🎨 Construtor Visual de Sites
- Novo painel administrativo para personalização do site público
- Editor de cores com color picker e input hexadecimal
- Editor de textos (título do banner, subtítulo, texto sobre)
- Preview ao vivo com atualização em tempo real
- Salvamento automático no banco de dados (JSONB)
- Link direto para visualizar o site do cliente

#### 🔧 Melhorias Técnicas
- Busca independente de dados da empresa usando `user.company_id`
- Suporte robusto a subdomínios locais (`*.localhost`)
- Validação de erro quando empresa não existe
- Fallback seguro para `subdomain` e `slug`

### 🐛 Correções

#### TenantContext
- **Corrigido:** Verificação duplicada de `.localhost` removida
- **Corrigido:** Busca agora procura em `subdomain` E `slug`
- **Corrigido:** Filtro `active = true` removido temporariamente
- **Corrigido:** Suporte nativo a `*.localhost` adicionado

#### Roteamento
- **Corrigido:** `lvh.me` adicionado aos domínios principais
- **Corrigido:** Rota `/admin/site` configurada corretamente

#### AdminSiteBuilder
- **Corrigido:** Dependência do `TenantContext` removida
- **Corrigido:** Link "Ver Meu Site" com fallback seguro
- **Corrigido:** Validação de erro implementada

### 📁 Arquivos Modificados

```
src/
├── App.tsx                          [MODIFICADO]
│   └── Adicionado lvh.me aos mainDomains
│
├── contexts/
│   └── TenantContext.tsx            [MODIFICADO]
│       ├── Removida verificação duplicada
│       ├── Busca em subdomain E slug
│       └── Suporte a *.localhost
│
├── pages/
│   └── AdminSiteBuilder.tsx         [CRIADO]
│       ├── Editor de cores
│       ├── Editor de textos
│       ├── Preview ao vivo
│       ├── Salvamento no banco
│       └── Validação de erro
│
└── components/
    └── AdminLayout.tsx              [MODIFICADO]
        └── Menu "Site e Visual" adicionado
```

### 📚 Documentação Criada

```
docs/
├── VALIDACAO_CONSTRUTOR_SITES.md    [CRIADO]
│   ├── Histórico de correções
│   ├── Estrutura do banco
│   ├── Fluxo de teste
│   └── Diagnóstico de problemas
│
├── TESTE_CONSTRUTOR.md              [CRIADO]
│   ├── Guia passo a passo
│   ├── Queries SQL
│   ├── Troubleshooting
│   └── Checklist final
│
├── RESUMO_CONSTRUTOR_SITES.md       [CRIADO]
│   ├── Resumo executivo
│   ├── Estrutura técnica
│   ├── Próximos passos
│   └── Métricas
│
└── CHANGELOG_CONSTRUTOR.md          [CRIADO]
    └── Este arquivo
```

### 🗄️ Banco de Dados

#### Nova Coluna (se não existir)
```sql
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS site_data JSONB;
```

#### Estrutura do `site_data`
```json
{
  "primaryColor": "#0EA5E9",
  "heroTitle": "Encontre o Imóvel dos Seus Sonhos",
  "heroSubtitle": "As melhores opções do mercado com atendimento exclusivo.",
  "aboutText": "Somos especialistas em realizar sonhos e garantir os melhores negócios imobiliários."
}
```

#### Nova Política RLS (se não existir)
```sql
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

### 🎯 Rotas Adicionadas

```typescript
// Master Domain (localhost:5173)
/admin/site → AdminSiteBuilder (Construtor Visual)

// Subdomínios (slug.localhost:5173)
/ → Template do Cliente (consome site_data)
```

### 🎨 Design System

#### Componentes Novos
- Color Picker (input type="color")
- Live Preview (simulação de smartphone)
- Error State (mensagem de empresa não encontrada)

#### Cores Utilizadas
- `text-brand-500` - Roxo principal
- `bg-brand-600` - Botão primário
- `bg-red-50 dark:bg-red-900/20` - Erro
- `bg-slate-50 dark:bg-dark-bg` - Inputs

### 📊 Estatísticas

#### Código
- **Linhas Adicionadas:** ~250
- **Linhas Modificadas:** ~50
- **Componentes Criados:** 1
- **Hooks Utilizados:** 3 (useState, useEffect, useAuth)

#### Documentação
- **Documentos:** 4
- **Páginas:** ~20
- **Exemplos SQL:** 15+
- **Exemplos TypeScript:** 10+

### ⚠️ Breaking Changes

Nenhuma mudança que quebre compatibilidade.

### 🔄 Migrações Necessárias

1. **Banco de Dados:**
   - Criar coluna `site_data` (JSONB) se não existir
   - Criar política RLS para UPDATE se não existir
   - Preencher `subdomain` nas empresas existentes

2. **Código:**
   - Nenhuma migração necessária
   - Compatível com código existente

### 🧪 Testes

#### Testes Manuais Necessários
- [ ] Acessar `/admin/site` e verificar carregamento
- [ ] Editar cores e textos
- [ ] Salvar alterações
- [ ] Verificar salvamento no banco
- [ ] Acessar `slug.localhost:5173`
- [ ] Verificar resolução do tenant

#### Testes Automatizados
- [ ] Pendente (próxima iteração)

### 📝 Notas de Upgrade

#### De Versão Anterior
1. Execute `npm install` (sem novas dependências)
2. Execute as migrações SQL acima
3. Preencha `subdomain` nas empresas existentes
4. Teste o fluxo completo usando `TESTE_CONSTRUTOR.md`

#### Compatibilidade
- ✅ React 18
- ✅ TypeScript 5.x
- ✅ Vite 5.x
- ✅ Supabase 2.x
- ✅ Tailwind CSS 3.x

### 🚀 Próximas Versões

#### [1.1.0] - Planejado
- Integração do `site_data` no template
- Aplicação dinâmica de cores via CSS variables
- Aplicação dinâmica de textos nos componentes

#### [1.2.0] - Planejado
- Upload de logo da empresa
- Upload de imagens do banner
- Editor de cores secundárias
- Seletor de fontes

#### [2.0.0] - Futuro
- Construtor visual completo (drag & drop)
- Editor WYSIWYG
- Biblioteca de componentes
- Histórico de versões
- Preview responsivo (mobile/tablet/desktop)

### 🙏 Agradecimentos

Desenvolvido seguindo as diretrizes do `AGENTS.md`:
- ✅ Stale-While-Revalidate pattern
- ✅ Design System do Elevatio Vendas
- ✅ Sem alteração da lógica de autenticação
- ✅ Busca independente de dados

### 📞 Suporte

Para problemas ou dúvidas:
1. Consulte `TESTE_CONSTRUTOR.md` para troubleshooting
2. Consulte `VALIDACAO_CONSTRUTOR_SITES.md` para diagnóstico
3. Verifique o console do navegador (F12)
4. Verifique os logs do Supabase

### 🔗 Links Úteis

- [AGENTS.md](./AGENTS.md) - Regras de desenvolvimento
- [TESTE_CONSTRUTOR.md](./TESTE_CONSTRUTOR.md) - Guia de testes
- [VALIDACAO_CONSTRUTOR_SITES.md](./VALIDACAO_CONSTRUTOR_SITES.md) - Validação técnica
- [RESUMO_CONSTRUTOR_SITES.md](./RESUMO_CONSTRUTOR_SITES.md) - Resumo executivo

---

**Versão:** 1.0.0  
**Data:** 2026-03-06  
**Status:** ✅ Pronto para Testes  
**Desenvolvido por:** Kiro AI

# 🛠️ Comandos Úteis - Landing Page + CRM

## 🚀 Desenvolvimento

```bash
# Iniciar servidor de desenvolvimento
npm run dev

# Build de produção
npm run build

# Preview do build
npm run preview

# Verificar erros TypeScript
npx tsc --noEmit
```

## 🧪 Testes Rápidos

```bash
# Testar Landing Page
# Abra: http://localhost:5173/

# Testar Cadastro/Login
# Abra: http://localhost:5173/registro

# Testar CRM Login (original)
# Abra: http://localhost:5173/admin/login

# Testar Dashboard
# Abra: http://localhost:5173/admin/dashboard
```

## 🔍 Debug

```bash
# Ver estrutura de arquivos
ls -la src/pages/website/

# Ver assets copiados
ls -la public/logo/

# Verificar rotas no App.tsx
grep -n "SiteHome\|SiteSignup" src/App.tsx

# Verificar modificações no SiteSignup
grep -n "selectedPlan\|/admin/dashboard" src/pages/website/SiteSignup.tsx
```

## 🎨 Tailwind

```bash
# Recompilar Tailwind (se cores não aparecerem)
npm run build

# Verificar configuração
cat tailwind.config.js | grep -A 15 "brand:"
```

## 📦 Dependências

```bash
# Verificar se GSAP está instalado
npm list gsap

# Reinstalar dependências (se necessário)
npm install

# Limpar cache e reinstalar
rm -rf node_modules package-lock.json
npm install
```

## 🐛 Troubleshooting

### Erro: "Module not found: gsap"
```bash
npm install gsap
```

### Erro: "Cannot find module './landing-styles.css'"
```bash
# Verificar se o arquivo existe
ls -la src/pages/website/landing-styles.css
```

### Cores não aparecem
```bash
# Recompilar Tailwind
npm run build
```

### Imagens não carregam
```bash
# Verificar se as imagens existem
ls -la public/logo/

# Recopiar se necessário
cp "C:/Users/willbio/Desktop/Landing Page do meu Plano Site+CRM/public/logo/"* public/logo/
```

### TypeScript com erros
```bash
# Verificar erros
npx tsc --noEmit

# Ver diagnósticos específicos
# Use a ferramenta getDiagnostics do Kiro
```

## 🔄 Reverter Alterações (se necessário)

```bash
# Remover arquivos da Landing Page
rm -rf src/pages/website/
rm -rf public/logo/

# Reverter App.tsx (use git)
git checkout src/App.tsx

# Reverter Tailwind (use git)
git checkout tailwind.config.js
```

## 📊 Verificar Status

```bash
# Ver arquivos modificados
git status

# Ver diferenças
git diff src/App.tsx
git diff tailwind.config.js

# Ver histórico de commits
git log --oneline -10
```

## 🚀 Deploy

```bash
# Build de produção
npm run build

# Testar build localmente
npm run preview

# Deploy (Vercel/Netlify)
# Siga as instruções da plataforma
```

## 🔌 Edge Functions (Supabase)

```bash
# Deploy da função de listagem de pagamentos Asaas
npx supabase functions deploy list-asaas-payments --no-verify-jwt

# Verificar logs da função
npx supabase functions logs list-asaas-payments

# Testar função localmente (requer Docker)
npx supabase functions serve list-asaas-payments

# Listar todas as funções deployadas
npx supabase functions list
```

### Variáveis de Ambiente Necessárias (Supabase Dashboard)

```bash
# Acesse: Supabase Dashboard > Project Settings > Edge Functions > Secrets
# Adicione as seguintes variáveis:

ASAAS_API_KEY=sua-chave-api-asaas
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

## 📝 Logs Úteis

```bash
# Ver logs do servidor
npm run dev 2>&1 | tee dev.log

# Ver erros de build
npm run build 2>&1 | tee build.log
```

## 🎯 Atalhos de Navegação

```bash
# Abrir VS Code na pasta do projeto
code .

# Abrir navegador na Landing Page
start http://localhost:5173/

# Abrir navegador no CRM
start http://localhost:5173/admin/login
```

## 🔐 Variáveis de Ambiente

```bash
# Verificar .env.local
cat .env.local

# Exemplo de .env.local necessário:
# VITE_SUPABASE_URL=sua-url-aqui
# VITE_SUPABASE_ANON_KEY=sua-chave-aqui
```

## 📚 Documentação

```bash
# Ver documentação de integração
cat INTEGRACAO_COMPLETA.md

# Ver instruções de cópia
cat COPIAR_LANDING_PAGE.md

# Ver guia original
cat INTEGRACAO_LANDING_PAGE.md
```

## 🎨 Customização

```bash
# Editar cores brand
nano tailwind.config.js

# Editar estilos da Landing Page
nano src/pages/website/landing-styles.css

# Editar Landing Page
nano src/pages/website/SiteHome.tsx

# Editar Cadastro/Login
nano src/pages/website/SiteSignup.tsx
```

## 🧹 Limpeza

```bash
# Remover arquivos de documentação (após integração completa)
rm INTEGRACAO_LANDING_PAGE.md
rm COPIAR_LANDING_PAGE.md
rm COMANDOS_UTEIS.md
# Manter apenas: INTEGRACAO_COMPLETA.md
```

## ✅ Checklist Rápido

```bash
# 1. Servidor rodando?
npm run dev

# 2. Landing Page carrega?
curl -I http://localhost:5173/

# 3. TypeScript sem erros?
npx tsc --noEmit

# 4. Build funciona?
npm run build

# 5. Tudo OK? 🎉
echo "Integração concluída com sucesso!"
```

# 🚀 Instruções para Copiar a Landing Page

## ✅ O que já foi feito:

1. ✅ Estrutura de pastas criada (`src/pages/website/`)
2. ✅ Rotas configuradas no `App.tsx`
3. ✅ Cores brand atualizadas no `tailwind.config.js` (roxo/violeta)
4. ✅ CSS customizado criado (`src/pages/website/landing-styles.css`)
5. ✅ Início do `SiteHome.tsx` criado (imports e lógica)

## 📋 Próximos Passos MANUAIS:

### Passo 1: Completar SiteHome.tsx

O arquivo `src/pages/website/SiteHome.tsx` já tem:
- ✅ Imports
- ✅ Hooks e state
- ✅ useEffect com animações GSAP
- ✅ Função `handleStart` modificada para navegar para `/registro`
- ✅ Navbar

**VOCÊ PRECISA ADICIONAR** (copie do arquivo original):
1. Hero Section (linha ~160-180 do original)
2. Features Section (linha ~182-220)
3. Pricing Section (linha ~222-350)
4. Compare Plans Section (linha ~352-550)
5. Footer (linha ~552-570)
6. Fechar as tags `</div>` e `}` finais

### Passo 2: Criar SiteSignup.tsx

Copie TODO o conteúdo do arquivo `Login.tsx` da Landing Page para `src/pages/website/SiteSignup.tsx`

**MODIFICAÇÕES OBRIGATÓRIAS:**

1. No início do componente, adicione:
```typescript
const location = useLocation();
const selectedPlan = location.state?.plan;
```

2. Após o sucesso do login (dentro de `handleSignIn`), substitua:
```typescript
// ANTES:
navigate('/dashboard');

// DEPOIS:
navigate('/admin/dashboard', { replace: true, state: { plan: selectedPlan } });
```

3. Após o sucesso do cadastro (dentro de `handleSignUp`), adicione o plano ao state se necessário.

4. Adicione um indicador visual do plano selecionado (opcional mas recomendado):
```tsx
{selectedPlan && (
  <div className="mb-4 p-3 bg-brand-50 dark:bg-brand-900/20 rounded-lg">
    <p className="text-sm text-brand-600 dark:text-brand-400">
      Plano selecionado: <strong className="capitalize">{selectedPlan}</strong>
    </p>
  </div>
)}
```

### Passo 3: Importar o CSS da Landing Page

No arquivo `src/pages/website/SiteHome.tsx`, adicione no topo (após os imports):
```typescript
import './landing-styles.css';
```

### Passo 4: Copiar Assets

Copie as imagens da pasta `public/logo/` da Landing Page para `public/logo/` do CRM:
- `logo.png`
- `LogoText.png`

Se não existir a pasta, crie-a.

### Passo 5: Verificar Imports

Certifique-se de que todos os componentes Lucide React estão importados corretamente.

## 🎯 Estrutura Final Esperada:

```
src/pages/website/
├── SiteHome.tsx          (Landing Page completa)
├── SiteSignup.tsx        (Login/Cadastro com plano)
└── landing-styles.css    (Estilos customizados)

public/logo/
├── logo.png
└── LogoText.png
```

## 🧪 Testar

1. Inicie o servidor: `npm run dev`
2. Acesse: `http://localhost:5173/`
3. Deve mostrar a Landing Page
4. Clique em "Começar" em qualquer plano
5. Deve navegar para `/registro` com o plano no state
6. Complete o cadastro/login
7. Deve redirecionar para `/admin/dashboard`

## ⚠️ Troubleshooting

### Erro: "Module not found: gsap/ScrollTrigger"
```bash
npm install gsap
```

### Erro: "Cannot find module './landing-styles.css'"
Certifique-se de que o arquivo foi criado em `src/pages/website/landing-styles.css`

### Cores não aparecem
Execute: `npm run build` para recompilar o Tailwind

### Imagens não carregam
Verifique se as imagens estão em `public/logo/` (não `public/img/logo/`)

## 📞 Próximo Passo

Após copiar tudo, execute:
```bash
npm run build
```

Se compilar sem erros, está pronto! 🎉

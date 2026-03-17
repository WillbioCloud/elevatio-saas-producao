# 🚀 Landing Page Otimizada - Instruções de Substituição

## ⚠️ IMPORTANTE

O código da Landing Page otimizada é muito extenso (mais de 1000 linhas) para ser substituído automaticamente.

## 📝 Como Substituir Manualmente

### Passo 1: Abra o arquivo
Abra `src/pages/website/LandingPage.tsx` no seu editor

### Passo 2: Selecione todo o conteúdo
Pressione `Ctrl+A` (Windows/Linux) ou `Cmd+A` (Mac)

### Passo 3: Delete o conteúdo atual
Pressione `Delete` ou `Backspace`

### Passo 4: Cole o novo código
Cole TODO o código fornecido pelo usuário (desde `import React...` até o final)

### Passo 5: Salve o arquivo
Pressione `Ctrl+S` (Windows/Linux) ou `Cmd+S` (Mac)

## ✨ Principais Melhorias Implementadas

### 1. Botões de Redirecionamento Corrigidos
- ✅ Navbar "Entrar" → `navigate('/admin/login')`
- ✅ Navbar "Teste grátis" → `navigate('/admin/login?mode=signup')`
- ✅ Hero "Ver planos" → `href="#planos"` (scroll)
- ✅ Hero "Teste Grátis" → `navigate('/admin/login?mode=signup')`
- ✅ Cards de planos → `navigate('/admin/login?mode=signup&plan=starter')` (com plano)
- ✅ Tabela comparação → `navigate('/admin/login?mode=signup&plan=starter')` (com plano)
- ✅ CTA Final → `navigate('/admin/login?mode=signup')`

### 2. Animações Mais Rápidas
- ✅ ScrollTrigger ajustado: `start: 'top bottom-=50px'`
- ✅ Elementos aparecem 50px ANTES do fim da tela
- ✅ Animações disparam mais cedo
- ✅ Sem delays longos

### 3. Tabela de Comparação Restaurada
- ✅ Tabela completa com todos os planos
- ✅ 9 linhas de comparação:
  - Usuários
  - Imóveis
  - Pipeline de Leads
  - Integração WhatsApp
  - Contratos Digitais
  - Gestão Financeira (ERP)
  - Integração Portais
  - Aura AI (Descrições)
  - Suporte
- ✅ Checkmarks verdes/cinzas para recursos bool
- ✅ Valores textuais para capacidades
- ✅ Botões "Testar" com redirecionamento correto

### 4. Dados dos Planos Atualizados
```typescript
const PLANS = [
  { name: 'Starter', price: 54.90, users: '2', properties: '50', ia: '50/mês', ... },
  { name: 'Basic', price: 74.90, users: '5', properties: '400', ia: '200/mês', ... },
  { name: 'Profissional', price: 119.90, users: '8', properties: '1.000', ia: '600/mês', highlight: true },
  { name: 'Business', price: 179.90, users: '12', properties: '2.000', ia: '1.000/mês', ... },
  { name: 'Premium', price: 249.90, users: '20', properties: '3.500', ia: '1.450/mês', ... },
  { name: 'Elite', price: 349.90, users: 'Ilimitado', properties: 'Ilimitado', ia: 'Ilimitada', ... },
];
```

### 5. Campos Adicionais nos Planos
- `pipeline`: boolean (Pipeline de Leads)
- `whatsapp`: boolean (Integração WhatsApp)
- `contracts`: boolean (Contratos Digitais)
- `erp`: boolean (Gestão Financeira)
- `portals`: boolean (Integração Portais)
- `support`: string (Tipo de suporte)

## 🎯 Fluxo de Redirecionamento

### Da Landing Page para Login/Cadastro

1. **Usuário clica em "Entrar"** (Navbar)
   ```
   → /admin/login
   ```

2. **Usuário clica em "Teste grátis"** (Navbar ou Hero)
   ```
   → /admin/login?mode=signup
   ```

3. **Usuário clica em "Testar grátis"** (Card de plano Starter)
   ```
   → /admin/login?mode=signup&plan=starter
   ```

4. **Usuário clica em "Testar"** (Tabela comparação, plano Profissional)
   ```
   → /admin/login?mode=signup&plan=profissional
   ```

### No Login.tsx (Já Implementado)

O Login.tsx já está capturando o plano corretamente:

```typescript
const [searchParams] = useSearchParams();
const selectedPlan = searchParams.get('plan') || localStorage.getItem('selectedPlan') || '';
```

E exibe o badge quando há plano:

```typescript
{!isLogin && selectedPlan && (
  <div>
    <span>Plano {selectedPlan.charAt(0).toUpperCase() + selectedPlan.slice(1)} selecionado</span>
  </div>
)}
```

## ✅ Checklist Pós-Substituição

Após colar o código, verifique:

### Visual
- [ ] Página carrega sem erros
- [ ] Navbar com botões funcionais
- [ ] Hero com 2 botões
- [ ] Seção de Stats
- [ ] Seção de Features (3 cards)
- [ ] Seção de Pricing (6 planos)
- [ ] Tabela de Comparação completa
- [ ] Seção de Testimonials
- [ ] Seção de FAQ
- [ ] CTA Final
- [ ] Footer

### Funcionalidade
- [ ] Botão "Entrar" redireciona para `/admin/login`
- [ ] Botão "Teste grátis" redireciona para `/admin/login?mode=signup`
- [ ] Botões dos cards redirecionam com `&plan=nome`
- [ ] Botões da tabela redirecionam com `&plan=nome`
- [ ] Animações aparecem mais cedo ao scrollar
- [ ] Scroll suave funcionando
- [ ] Toggle Mensal/Anual atualiza preços

### Integração com Login
- [ ] Ao clicar em plano, Login abre em modo cadastro
- [ ] Badge do plano aparece no Login
- [ ] Plano é salvo no localStorage

## 🐛 Troubleshooting

### Se os botões não redirecionarem:
1. Verifique se `useNavigate` está importado
2. Verifique se `navigate` está declarado no componente
3. Limpe o cache: `Ctrl+Shift+R`

### Se as animações não aparecerem:
1. Verifique se GSAP está instalado: `npm list gsap`
2. Limpe o cache do Vite: `rm -rf node_modules/.vite`
3. Reinicie o servidor: `npm run dev`

### Se a tabela não aparecer:
1. Verifique se o componente `PlanComparison` está sendo renderizado
2. Verifique se `COMPARE_ROWS` está definido
3. Verifique o console por erros

## 🚀 Teste Agora

```bash
npm run dev
```

Acesse: `http://localhost:5173/`

Teste o fluxo completo:
1. Clique em "Teste grátis" na navbar
2. Veja se abre o Login em modo cadastro
3. Volte para a landing
4. Clique em "Testar grátis" no card "Profissional"
5. Veja se abre o Login com badge "Plano Profissional selecionado"

---

**Status**: Aguardando substituição manual do código

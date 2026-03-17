# INSTRUÇÕES COMPLETAS - Restaurar Design Premium Webflow

## ⚠️ IMPORTANTE
O código do componente é muito extenso (mais de 500 linhas). Por favor, siga estas instruções para implementação manual.

---

## PASSO 1: Abrir o arquivo
Abra `src/pages/website/LandingPage.tsx` no seu editor.

---

## PASSO 2: Localizar e DELETAR os componentes antigos

Encontre e DELETE completamente estas duas seções:

### Seção 1 - Pricing (linha ~295)
```typescript
// ─────────────────────────────────────────────
// PRICING CARDS
// ─────────────────────────────────────────────
const Pricing: React.FC = () => {
  // ... TODO O CÓDIGO ATÉ O FINAL DESTE COMPONENTE
};
```

### Seção 2 - PlanComparison (linha ~355)
```typescript
// ─────────────────────────────────────────────
// COMPARAÇÃO DE PLANOS (Design Escuro Original Restaurado)
// ─────────────────────────────────────────────
const PlanComparison: React.FC = () => {
  // ... TODO O CÓDIGO ATÉ O FINAL DESTE COMPONENTE
};
```

**DELETE AMBOS OS COMPONENTES COMPLETAMENTE** (desde o comentário `// ───` até o `};` final de cada um).

---

## PASSO 3: Colar o novo componente unificado

No lugar onde você deletou os dois componentes acima, cole o código que vou fornecer no próximo arquivo chamado `PRICING_COMPONENT_CODIGO.txt`.

O novo componente se chama `PricingAndCompare` e combina ambas as seções em um único componente com:
- ✅ Toggle Mensal/Anual com desconto de 15%
- ✅ 6 cards de planos com design escuro premium
- ✅ Ícones especiais (Target, FileSignature, Bot, Headset)
- ✅ Tabela de comparação completa com abas mobile
- ✅ Redirecionamento para `/admin/login?mode=signup&plan=xxx`

---

## PASSO 4: Atualizar a renderização principal

No final do arquivo `LandingPage.tsx`, encontre a função `export default function LandingPage()`.

Dentro dela, localize onde está:
```typescript
<div id="smooth-content">
  <Hero />
  <Stats />
  <Features />
  <Pricing />
  <PlanComparison />
  <Testimonials />
  <FAQ />
  <FinalCTA />
  <Footer />
</div>
```

**SUBSTITUA** as linhas `<Pricing />` e `<PlanComparison />` por:
```typescript
<PricingAndCompare />
```

Resultado final:
```typescript
<div id="smooth-content">
  <Hero />
  <Stats />
  <Features />
  <PricingAndCompare />
  <Testimonials />
  <FAQ />
  <FinalCTA />
  <Footer />
</div>
```

---

## PASSO 5: Adicionar classes CSS

Ainda no arquivo `LandingPage.tsx`, encontre a tag `<style>{` (linha ~590).

**ANTES** do fechamento `}`}</style>`, adicione estas classes CSS:

```css
/* --- ESTILOS DO WEBFLOW --- */
.gradient-text {
  background: linear-gradient(135deg, #1a56db, #0ea5e9);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}

.border-gradient {
  background: linear-gradient(#050505, #050505) padding-box,
              linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.02)) border-box;
  border: 1px solid transparent;
  border-radius: 1.5rem;
}

.highlight-card {
  background: linear-gradient(#0a0f1c, #0a0f1c) padding-box,
              linear-gradient(135deg, #1a56db, #0ea5e9) border-box;
}

.glow-effect {
  background: radial-gradient(circle at 50% 50%, rgba(14,165,233,0.15), transparent 70%);
}

.custom-scrollbar::-webkit-scrollbar {
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

/* Lógica das Abas da Tabela no Mobile */
@media (max-width: 1024px) {
  .mobile-compare-table th:not(:first-child),
  .mobile-compare-table td:not(:first-child) {
    display: none;
  }

  .mobile-compare-table.show-p1 th:nth-child(2),
  .mobile-compare-table.show-p1 td:nth-child(2) {
    display: table-cell;
  }

  .mobile-compare-table.show-p2 th:nth-child(3),
  .mobile-compare-table.show-p2 td:nth-child(3) {
    display: table-cell;
  }

  .mobile-compare-table.show-p3 th:nth-child(4),
  .mobile-compare-table.show-p3 td:nth-child(4) {
    display: table-cell;
  }

  .mobile-compare-table.show-p4 th:nth-child(5),
  .mobile-compare-table.show-p4 td:nth-child(5) {
    display: table-cell;
  }

  .mobile-compare-table.show-p5 th:nth-child(6),
  .mobile-compare-table.show-p5 td:nth-child(6) {
    display: table-cell;
  }

  .mobile-compare-table.show-p6 th:nth-child(7),
  .mobile-compare-table.show-p6 td:nth-child(7) {
    display: table-cell;
  }
}

/* Classes Tailwind Customizadas */
.bg-brand-600 {
  background-color: #1a56db;
}

.bg-brand-500 {
  background-color: #0ea5e9;
}

.text-brand-400 {
  color: #38bdf8;
}

.text-brand-500 {
  color: #0ea5e9;
}

.border-brand-500 {
  border-color: #0ea5e9;
}

.shadow-brand-500\/20 {
  box-shadow: 0 4px 14px rgba(14, 165, 233, 0.2);
}
```

---

## PASSO 6: Verificar imports

No topo do arquivo, certifique-se que a linha de imports do `lucide-react` inclui todos estes ícones:

```typescript
import { Check, Minus, Info, Target, FileSignature, Bot, Headset } from 'lucide-react';
```

---

## ✅ CHECKLIST FINAL

Antes de testar, verifique:
- [ ] Deletou os componentes `Pricing` e `PlanComparison` antigos
- [ ] Colou o novo componente `PricingAndCompare` no lugar
- [ ] Atualizou a renderização para usar `<PricingAndCompare />`
- [ ] Adicionou as classes CSS na tag `<style>`
- [ ] Verificou os imports do `lucide-react`
- [ ] Salvou o arquivo (Ctrl+S)

---

## 🧪 TESTAR

Execute `npm run dev` e acesse `http://localhost:5173/`

Teste:
1. Toggle Mensal/Anual (deve calcular -15% no anual)
2. Botões "Assinar" devem redirecionar para `/admin/login?mode=signup&plan=starter` (etc)
3. Em mobile (<1024px), as abas da tabela devem funcionar
4. Scroll horizontal na tabela deve ter scrollbar customizada
5. Card "Profissional" deve ter brilho e destaque

---

## 📄 PRÓXIMO ARQUIVO

Veja o arquivo `PRICING_COMPONENT_CODIGO.txt` para o código completo do componente `PricingAndCompare`.

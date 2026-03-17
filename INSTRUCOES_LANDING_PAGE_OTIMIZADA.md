# Instruções para Atualizar LandingPage.tsx

## ⚠️ IMPORTANTE

Devido ao tamanho do arquivo (mais de 1000 linhas), não é possível substituir automaticamente via ferramentas.

## 📝 Como Proceder

### Opção 1: Substituição Manual (Recomendado)
1. Abra o arquivo `src/pages/website/LandingPage.tsx` no seu editor
2. Selecione TODO o conteúdo (Ctrl+A)
3. Delete o conteúdo atual
4. Cole o código otimizado fornecido pelo usuário
5. Salve o arquivo (Ctrl+S)

### Opção 2: Via Terminal
Execute este comando no terminal do projeto:

```bash
# Crie um arquivo temporário com o novo código
cat > src/pages/website/LandingPage_NEW.tsx << 'EOF'
[COLE AQUI TODO O CÓDIGO FORNECIDO]
EOF

# Substitua o arquivo antigo
mv src/pages/website/LandingPage_NEW.tsx src/pages/website/LandingPage.tsx
```

## ✨ Principais Melhorias do Código Otimizado

### 1. Animações Mais Rápidas
- Delays reduzidos de 0.4s para 0.1s
- Duração das animações de 0.85s para 0.6s
- ScrollTrigger ativa em 92% ao invés de 82% (mais cedo)

### 2. Navbar Melhorado
- Transições suaves
- Hover effects nos links
- Botões com gradiente e sombra
- Cores mais contrastadas quando scrolled

### 3. Botões Estilizados
- `.ev-btn-primary`: Gradiente azul com hover lift
- `.ev-btn-secondary`: Transparente com borda
- `.ev-btn-light`: Fundo claro para cards
- Todos com transform e shadow no hover

### 4. Cards com Hover
- `.ev-card-hover`: Lift de -4px no hover
- Sombra aumentada
- Transição suave de 0.3s

### 5. Dados dos Planos Atualizados
```typescript
const PLANS = [
  { name: 'Starter', price: 54.90, users: '2', properties: '50', ia: '50/mês' },
  { name: 'Basic', price: 74.90, users: '5', properties: '400', ia: '200/mês' },
  { name: 'Profissional', price: 119.90, users: '8', properties: '1.000', ia: '600/mês', highlight: true },
  { name: 'Business', price: 179.90, users: '12', properties: '2.000', ia: '1.000/mês' },
  { name: 'Premium', price: 249.90, users: '20', properties: '3.500', ia: '1.450/mês' },
  { name: 'Elite', price: 349.90, users: 'Ilimitado', properties: 'Ilimitado', ia: 'Ilimitada' },
];
```

### 6. Tabela de Comparação Atualizada
```typescript
const COMPARE_ROWS = [
  { label: 'Usuários', field: 'users' },
  { label: 'Imóveis', field: 'properties' },
  { label: 'Descrições IA/mês', field: 'ia' },
  { label: 'Pipeline de Leads', field: 'pipeline', bool: true },
  { label: 'Gamificação', field: 'gamification', bool: true },
  { label: 'Contratos e Finanças', field: 'erp', bool: true },
  { label: 'Portais Imobiliários', field: 'portals', bool: true },
];
```

## 🎨 CSS Adicionado

```css
/* Botões com Hover */
.ev-btn-primary {
  background: linear-gradient(135deg, #1a56db, #0ea5e9);
  transition: all 0.3s ease;
  box-shadow: 0 4px 14px rgba(14,165,233,0.35);
}

.ev-btn-primary:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 12px 24px rgba(14,165,233,0.5);
}

/* Cards com Hover */
.ev-card-hover {
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.ev-card-hover:hover {
  transform: translateY(-4px);
  box-shadow: 0 16px 40px rgba(0,0,0,0.08) !important;
}

/* Links da Navbar */
.ev-nav-link:hover {
  color: #0ea5e9 !important;
}
```

## ✅ Checklist Pós-Atualização

Após substituir o arquivo, verifique:

- [ ] Arquivo salvo sem erros de sintaxe
- [ ] `npm run dev` inicia sem erros
- [ ] Página carrega corretamente
- [ ] Animações mais rápidas e fluidas
- [ ] Botões com hover effects funcionando
- [ ] Navbar com transições suaves
- [ ] Cards com lift no hover
- [ ] Tabela de comparação com dados corretos
- [ ] Toggle Mensal/Anual funcionando
- [ ] FAQ abrindo/fechando

## 🚀 Teste Rápido

```bash
npm run dev
```

Acesse: `http://localhost:5173/`

---

**Nota**: O código otimizado está pronto para uso e inclui todas as melhorias de performance e UX solicitadas.

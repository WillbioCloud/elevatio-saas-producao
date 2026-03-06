# 🎨 GUIA VISUAL DOS TEMPLATES

**Data:** 2026-03-06  
**Templates Disponíveis:** 3 (Minimalist, Luxury, Modern)

---

## 📋 Índice

1. [Template Minimalista](#template-minimalista)
2. [Template Luxury](#template-luxury)
3. [Template Modern](#template-modern)
4. [Comparação Lado a Lado](#comparação-lado-a-lado)
5. [Quando Usar Cada Template](#quando-usar-cada-template)

---

## 🎯 Template Minimalista

### Identidade Visual
- **Público-Alvo:** Imobiliárias tradicionais, foco em conversão
- **Estilo:** Limpo, claro, profissional
- **Cor Padrão:** Azul céu (`#0EA5E9`)

### Paleta de Cores
```
Fundo:      #FFFFFF (branco)
Texto:      #0F172A (slate-900)
Bordas:     #F1F5F9 (slate-100)
Secundário: #64748B (slate-500)
```

### Tipografia
```
Família:    Sans-serif (system)
Logo:       2xl, font-black, tracking-tighter
Títulos:    5xl-7xl, font-black, tracking-tight
Corpo:      xl, text-slate-500
```

### Componentes

#### Header
```
┌─────────────────────────────────────────────┐
│ IMOBILIÁRIA    Início  Imóveis  Quem Somos  │
└─────────────────────────────────────────────┘
  ↑ Sticky, borda inferior sutil
```

#### Hero Section
```
┌─────────────────────────────────────────────┐
│                                             │
│                                             │
│     ENCONTRE O IMÓVEL DOS SEUS SONHOS      │
│                                             │
│     Ajudamos você a encontrar o lugar      │
│     perfeito para viver as suas            │
│     melhores histórias.                    │
│                                             │
│     [ Ver Imóveis Disponíveis ]            │
│                                             │
│                                             │
└─────────────────────────────────────────────┘
  ↑ Fundo slate-50, texto centralizado
```

#### Footer
```
┌─────────────────────────────────────────────┐
│  © 2026 Imobiliária. Todos os direitos     │
│  reservados.                                │
└─────────────────────────────────────────────┘
  ↑ Fundo slate-50, borda superior
```

### Código de Exemplo
```typescript
<div className="min-h-screen bg-white text-slate-900">
  <header className="border-b border-slate-100 sticky top-0">
    <h1 style={{ color: primaryColor }}>
      {tenant?.name}
    </h1>
  </header>
  <main>
    <section className="py-32 bg-slate-50">
      <h1 className="text-7xl font-black">
        {siteData.heroTitle}
      </h1>
      <button 
        style={{ backgroundColor: primaryColor }}
        className="rounded-full px-8 py-4"
      >
        Ver Imóveis
      </button>
    </section>
  </main>
</div>
```

---

## 👑 Template Luxury

### Identidade Visual
- **Público-Alvo:** Imóveis de alto padrão, clientes exigentes
- **Estilo:** Elegante, sofisticado, exclusivo
- **Cor Padrão:** Dourado (`#D4AF37`)

### Paleta de Cores
```
Fundo:      #020617 (slate-950)
Texto:      #F1F5F9 (slate-100)
Bordas:     rgba(255,255,255,0.1)
Secundário: #94A3B8 (slate-400)
Destaque:   #D4AF37 (dourado)
```

### Tipografia
```
Família:    Serif (Georgia, Times)
Logo:       3xl, font-normal, tracking-widest, UPPERCASE
Títulos:    5xl-8xl, font-normal, tracking-tight
Corpo:      xl-2xl, font-light, text-slate-300
```

### Componentes

#### Header
```
┌─────────────────────────────────────────────┐
│ IMOBILIÁRIA        INÍCIO  IMÓVEIS  SOBRE   │
└─────────────────────────────────────────────┘
  ↑ Backdrop blur, uppercase, tracking widest
```

#### Hero Section
```
╔═════════════════════════════════════════════╗
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
║ ░                                         ░ ║
║ ░                                         ░ ║
║ ░     EXCLUSIVIDADE EM CADA DETALHE      ░ ║
║ ░                                         ░ ║
║ ░     Descubra propriedades de alto      ░ ║
║ ░     padrão selecionadas para o seu     ░ ║
║ ░     estilo de vida.                    ░ ║
║ ░                                         ░ ║
║ ░     [ EXPLORAR PORTFÓLIO ]             ░ ║
║ ░                                         ░ ║
║ ░                                         ░ ║
║ ░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░ ║
╚═════════════════════════════════════════════╝
  ↑ Gradiente radial escuro, texto dourado
```

#### Footer
```
┌─────────────────────────────────────────────┐
│  © 2026 IMOBILIÁRIA. EXCLUSIVE REAL ESTATE │
└─────────────────────────────────────────────┘
  ↑ Fundo preto absoluto, uppercase
```

### Código de Exemplo
```typescript
<div className="min-h-screen bg-slate-950 text-slate-100 font-serif">
  <header className="backdrop-blur-md border-b border-white/10">
    <h1 
      style={{ color: primaryColor }}
      className="uppercase tracking-widest"
    >
      {tenant?.name}
    </h1>
  </header>
  <main>
    <section className="py-48 relative">
      <div className="absolute inset-0 bg-gradient-to-b from-slate-900 to-slate-950" />
      <h1 className="text-8xl font-normal">
        {siteData.heroTitle}
      </h1>
      <button 
        style={{ backgroundColor: primaryColor, color: '#000' }}
        className="uppercase tracking-widest"
      >
        EXPLORAR
      </button>
    </section>
  </main>
</div>
```

---

## 🚀 Template Modern

### Identidade Visual
- **Público-Alvo:** Startups, imobiliárias tech, público jovem
- **Estilo:** Arrojado, inovador, digital
- **Cor Padrão:** Indigo (`#6366F1`)

### Paleta de Cores
```
Fundo:      #F8FAFC (slate-50)
Texto:      #1E293B (slate-800)
Cards:      #FFFFFF (branco)
Bordas:     #E2E8F0 (slate-100)
Destaque:   #6366F1 (indigo)
```

### Tipografia
```
Família:    Sans-serif (system)
Logo:       2xl, font-black, tracking-tight
Títulos:    5xl-7xl, font-black, tracking-tighter
Corpo:      xl, font-medium, text-slate-500
```

### Componentes

#### Header
```
╔═════════════════════════════════════════════╗
║ ┌─────────────────────────────────────────┐ ║
║ │ [■] Logo      Início  Imóveis  Sobre    │ ║
║ └─────────────────────────────────────────┘ ║
╚═════════════════════════════════════════════╝
  ↑ Rounded-3xl, shadow, sticky top-4, padding externo
```

#### Hero Section
```
╔═════════════════════════════════════════════╗
║ ┌─────────────────────────────────────────┐ ║
║ │                                         │ ║
║ │ 🚀 A revolução do mercado imobiliário   │ ║
║ │                                         │ ║
║ │ SUA NOVA CASA                           │ ║
║ │ A UM CLIQUE DE DISTÂNCIA                │ ║
║ │                                         │ ║
║ │ Experiência 100% digital, transparente  │ ║
║ │ e sem burocracia.                       │ ║
║ │                                         │ ║
║ │ [ Buscar Imóveis ]  ← Rounded-2xl      │ ║
║ │                                         │ ║
║ │                    ◉ ← Blur circular    │ ║
║ └─────────────────────────────────────────┘ ║
╚═════════════════════════════════════════════╝
  ↑ Card branco, rounded-3xl, shadow
```

#### Footer
```
╔═════════════════════════════════════════════╗
║ ┌─────────────────────────────────────────┐ ║
║ │  © 2026 Imobiliária. Feito com inovação │ ║
║ └─────────────────────────────────────────┘ ║
╚═════════════════════════════════════════════╝
  ↑ Rounded-3xl, fundo slate-900, margin 4
```

### Código de Exemplo
```typescript
<div className="min-h-screen bg-slate-50 font-sans">
  <div className="p-4">
    <header className="bg-white rounded-3xl shadow-sm sticky top-4">
      <div className="flex items-center gap-2">
        <div 
          className="w-8 h-8 rounded-xl" 
          style={{ backgroundColor: primaryColor }}
        />
        <h1 className="font-black">{tenant?.name}</h1>
      </div>
    </header>
  </div>
  <main className="px-4">
    <section className="bg-white rounded-3xl p-12">
      <div 
        className="inline-block rounded-full px-4 py-2"
        style={{ 
          backgroundColor: `${primaryColor}20`,
          color: primaryColor 
        }}
      >
        🚀 A revolução
      </div>
      <h1 className="text-7xl font-black tracking-tighter">
        {siteData.heroTitle}
      </h1>
      <button 
        style={{ backgroundColor: primaryColor }}
        className="rounded-2xl hover:scale-105"
      >
        Buscar
      </button>
    </section>
  </main>
</div>
```

---

## 📊 Comparação Lado a Lado

| Característica | Minimalista | Luxury | Modern |
|----------------|-------------|--------|--------|
| **Fundo** | Branco | Preto | Cinza claro |
| **Tipografia** | Sans-serif | Serif | Sans-serif |
| **Bordas** | Retas | Retas | Arredondadas |
| **Espaçamento** | Médio | Grande | Médio |
| **Sombras** | Suaves | Nenhuma | Pronunciadas |
| **Animações** | Mínimas | Nenhuma | Hover scale |
| **Cor Padrão** | Azul | Dourado | Indigo |
| **Público** | Geral | Alto padrão | Jovem/Tech |

### Elementos Visuais

| Elemento | Minimalista | Luxury | Modern |
|----------|-------------|--------|--------|
| **Logo** | Tracking tight | Uppercase widest | Com ícone colorido |
| **Botões** | Rounded-full | Retangular | Rounded-2xl |
| **Cards** | Sem | Sem | Rounded-3xl |
| **Header** | Sticky top-0 | Backdrop blur | Sticky top-4 |
| **Footer** | Borda superior | Preto absoluto | Rounded-3xl |

---

## 🎯 Quando Usar Cada Template

### Use Minimalista Quando:
- ✅ Imobiliária tradicional
- ✅ Foco em conversão
- ✅ Público amplo
- ✅ Orçamento limitado
- ✅ Primeira impressão profissional
- ✅ Imóveis residenciais padrão

**Exemplos:**
- Imobiliária Cidade Nova
- Corretora Lar Feliz
- Imóveis do Bairro

### Use Luxury Quando:
- ✅ Imóveis de alto padrão
- ✅ Clientes exigentes
- ✅ Exclusividade
- ✅ Mansões e coberturas
- ✅ Atendimento VIP
- ✅ Discrição e sofisticação

**Exemplos:**
- Luxury Real Estate
- Mansões Premium
- Exclusive Properties

### Use Modern Quando:
- ✅ Startup imobiliária
- ✅ Público jovem (25-40 anos)
- ✅ Foco em tecnologia
- ✅ Processo 100% digital
- ✅ Inovação e agilidade
- ✅ Apartamentos modernos

**Exemplos:**
- PropTech Imóveis
- Digital House
- Smart Living

---

## 🎨 Personalização por Template

### Minimalista
```typescript
// Cores que funcionam bem:
primaryColor: '#0EA5E9'  // Azul (padrão)
primaryColor: '#10B981'  // Verde
primaryColor: '#F59E0B'  // Laranja
primaryColor: '#8B5CF6'  // Roxo

// Evitar:
❌ Cores muito escuras (perde contraste)
❌ Cores neon (quebra minimalismo)
```

### Luxury
```typescript
// Cores que funcionam bem:
primaryColor: '#D4AF37'  // Dourado (padrão)
primaryColor: '#C0C0C0'  // Prata
primaryColor: '#B87333'  // Bronze
primaryColor: '#E5E4E2'  // Platina

// Evitar:
❌ Cores vibrantes (quebra elegância)
❌ Cores claras (perde contraste no fundo escuro)
```

### Modern
```typescript
// Cores que funcionam bem:
primaryColor: '#6366F1'  // Indigo (padrão)
primaryColor: '#EC4899'  // Pink
primaryColor: '#14B8A6'  // Teal
primaryColor: '#F97316'  // Orange

// Evitar:
❌ Cores pastéis (perde impacto)
❌ Cores muito escuras (perde contraste)
```

---

## ✅ Checklist de Escolha

### Para o Cliente:
- [ ] Qual é o público-alvo?
- [ ] Qual é o tipo de imóvel (padrão/luxo/moderno)?
- [ ] Qual é o orçamento de marketing?
- [ ] Qual é a identidade da marca?
- [ ] Qual é o diferencial competitivo?

### Para o Desenvolvedor:
- [ ] Template escolhido está disponível?
- [ ] Cores personalizadas foram definidas?
- [ ] Textos foram personalizados?
- [ ] Logo foi enviado?
- [ ] Site foi testado em mobile?

---

## 🚀 Próximos Passos

1. **Escolher Template:** Baseado no público e tipo de imóvel
2. **Personalizar Cores:** Usar o construtor visual
3. **Ajustar Textos:** Adaptar para a identidade da marca
4. **Testar:** Validar em diferentes dispositivos
5. **Lançar:** Publicar e monitorar performance

---

**Desenvolvido por:** Kiro AI  
**Data:** 2026-03-06  
**Versão:** 1.0.0  
**Status:** ✅ Guia Completo

# 🚀 Guia de Integração da Landing Page

## ✅ Estrutura Criada

A estrutura de integração foi preparada com sucesso:

```
src/pages/website/
├── SiteHome.tsx      (Placeholder - aguardando conteúdo)
└── SiteSignup.tsx    (Placeholder - aguardando conteúdo)
```

## 📋 Checklist de Integração

### 1️⃣ Copiar Arquivos da Landing Page

#### A. SiteHome.tsx
1. Abra o arquivo: `C:\Users\willbio\Desktop\Landing Page do meu Plano Site+CRM\src\pages\Home.tsx`
2. Copie TODO o conteúdo
3. Cole em: `src/pages/website/SiteHome.tsx` (substituindo o placeholder)
4. **MODIFICAÇÃO CRÍTICA:** Localize a função `handleStart` e altere para:
   ```typescript
   const handleStart = (planName: string) => {
     navigate('/registro', { state: { plan: planName } });
   };
   ```

#### B. SiteSignup.tsx
1. Abra o arquivo: `C:\Users\willbio\Desktop\Landing Page do meu Plano Site+CRM\src\pages\Login.tsx`
2. Copie TODO o conteúdo
3. Cole em: `src/pages/website/SiteSignup.tsx` (substituindo o placeholder)
4. **MODIFICAÇÕES CRÍTICAS:**
   - No início do componente, adicione:
     ```typescript
     const location = useLocation();
     const selectedPlan = location.state?.plan;
     ```
   - Após o sucesso do login/cadastro, redirecione com:
     ```typescript
     navigate('/admin/dashboard', { replace: true, state: { plan: selectedPlan } });
     ```

### 2️⃣ Copiar Assets (Imagens)

Copie as imagens da pasta `public/` da Landing Page para a pasta `public/` do projeto CRM:

```bash
# Execute no terminal (ajuste os caminhos se necessário)
cp -r "C:/Users/willbio/Desktop/Landing Page do meu Plano Site+CRM/public/"* ./public/
```

Ou copie manualmente via Windows Explorer.

### 3️⃣ Instalar Dependências Faltantes

Verifique se a Landing Page usa bibliotecas que não estão no CRM. Dependências já instaladas:
- ✅ gsap
- ✅ lucide-react
- ✅ framer-motion
- ✅ react-router-dom

Se houver outras, instale com:
```bash
npm install [nome-da-biblioteca]
```

### 4️⃣ Verificar Imports

Após copiar os arquivos, verifique se todos os imports estão corretos:

- Componentes UI (ex: `@/components/ui/button`)
- Utilitários (ex: `@/lib/utils`)
- Assets (ex: `/img/logo.png`)

### 5️⃣ Testar o Fluxo

1. **Acesse a Landing Page:**
   ```
   http://localhost:5173/
   ```
   Deve mostrar a Landing Page (SiteHome)

2. **Clique em "Começar" em um plano:**
   Deve navegar para `/registro` com o plano selecionado

3. **Complete o cadastro/login:**
   Deve redirecionar para `/admin/dashboard` com o plano no state

4. **Verifique o Login do CRM:**
   ```
   http://localhost:5173/admin/login
   ```
   Deve continuar funcionando normalmente (não foi alterado)

## 🎯 Arquitetura de Rotas

### Domínio Master (localhost / domínio principal)
- `/` → Landing Page (SiteHome)
- `/registro` → Cadastro/Login da Landing Page (SiteSignup)
- `/admin/login` → Login do CRM (inalterado)
- `/admin/*` → Painel CRM (inalterado)

### Subdomínios (clientes)
- `/` → Vitrine de Imóveis (Home original)
- `/imoveis` → Lista de Imóveis
- `/admin/login` → Login do CRM
- `/admin/*` → Painel CRM

## 🔒 Garantias de Segurança

✅ O `Home.tsx` original do CRM não foi alterado
✅ O `Login.tsx` original do CRM não foi alterado
✅ As rotas do CRM continuam funcionando normalmente
✅ A lógica de autenticação não foi modificada
✅ O sistema de multi-tenancy (subdomínios) permanece intacto

## 🐛 Troubleshooting

### Erro: "Module not found"
- Verifique se todos os imports estão corretos
- Certifique-se de que os assets foram copiados para `public/`

### Erro: "Cannot read property 'plan' of undefined"
- Verifique se o `location.state?.plan` está sendo usado com optional chaining

### Landing Page não aparece
- Confirme que você está acessando o domínio master (localhost)
- Verifique se o conteúdo foi copiado corretamente para `SiteHome.tsx`

### Navegação não funciona
- Verifique se as funções `handleStart` e o redirecionamento após login foram modificados corretamente

## 📞 Próximos Passos

Após completar a integração:
1. Teste todos os fluxos de navegação
2. Verifique o responsivo mobile
3. Teste o tema dark/light
4. Valide o TypeScript: `npm run build`
5. Faça commit das alterações

---

**Nota:** Este documento pode ser deletado após a integração estar completa e testada.

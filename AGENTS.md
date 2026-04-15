# Elevatio Vendas - AI CONTEXT & GUIDELINES

Este documento serve como fonte da verdade para Agentes de IA (Codex, Copilot, etc.) que trabalham neste projeto. Leia-o antes de gerar qualquer código.

## 1. Visão Geral do Projeto
**Nome:** Elevatio Vendas Site + CRM
**Tipo:** Plataforma Imobiliária Híbrida (Site Público + CRM Administrativo).
**Objetivo:** Permitir que clientes busquem imóveis (Venda/Aluguel) e corretores gerenciem leads, imóveis e tarefas em um painel administrativo.

## 2. Tech Stack
- **Framework:** React 18 + Vite (SPA - Single Page Application).
- **Linguagem:** TypeScript (Strict Mode).
- **Estilização:** Tailwind CSS (Mobile First).
- **Backend/Auth:** Supabase (Auth, Postgres DB, Storage, Realtime).
- **Inteligência Artificial:** Google Gemini API (modelos `1.5-flash-latest` e `2.5-flash`).
- **Animações:** GSAP e Framer Motion.
- **Ícones:** Lucide React.
- **Rotas:** React Router Dom v6.

## 3. Arquitetura de Pastas
- `/src/pages`:
  - **Públicas:** `Home`, `Properties`, `PropertyDetail`, `Login`, `About`, `Services`.
  - **Admin (Protegidas):** `AdminDashboard`, `AdminProperties`, `AdminLeads`, `AdminTasks`, `AdminConfig`.
- `/src/components`:
  - `AdminLayout`: Layout mestre do CRM (Sidebar + Topbar).
  - `Layout`: Layout mestre do Site Público (Navbar + Footer).
  - `ProtectedRoute`: Guarda de rotas que verifica sessão.

## 4. Authentication & State (CRÍTICO - LEIA COM ATENÇÃO)
O sistema de autenticação foi blindado contra loops de redirecionamento. **NÃO ALTERE A LÓGICA ABAIXO SEM COMPREENSÃO TOTAL.**

### A. Regra de Ouro do AuthContext (Prevenção de Loop)
O Supabase dispara eventos `SIGNED_IN` ou `TOKEN_REFRESHED` quando a aba do navegador ganha foco (visibilitychange).
1.  **Verificação de Estabilidade:** Ao receber um evento de auth, verifique se `newSession.user.id === currentUser.id`.
2.  **Ação:** Se os IDs forem iguais, **APENAS atualize o `setSession`** com o novo token e pare (`return`).
3.  **Proibido:** **JAMAIS** recarregue o perfil do usuário (`fetchProfileData`) ou limpe o estado `user` nesse cenário. Isso causa um "piscar" no estado que o `ProtectedRoute` interpreta como "não logado", gerando um loop infinito de Login <-> Dashboard.

### B. Fetch de Dados (Hooks)
1.  **Stale-While-Revalidate:** Nunca limpe o estado (ex: `setProperties([])`) antes de iniciar um fetch. Mantenha os dados antigos na tela até os novos chegarem.
2.  **Ignorar AbortError:** Se uma requisição for cancelada (mudança de aba), capture o `AbortError` e **ignore-o silenciosamente**. Não mostre erro, não limpe dados.
3.  **Botão de Refresh:** O refresh manual deve tentar renovar a sessão. Se der timeout (>3s), deve executar `window.location.reload()` (Hard Reload) para limpar sockets travados.

## 5. MOTOR DE GAMIFICAÇÃO (A Liga dos Corretores)
- **Fonte da verdade de eventos:** Use a tabela `gamification_events`. A tabela `xp_logs` está obsoleta e **não deve ser usada** em novas implementações.
- **Pontuação atual:** O total de pontos do corretor fica salvo na coluna `xp_points` da tabela `profiles`.
- **Cálculo de pontos:** A pontuação usa multiplicadores contextuais, considerando o peso do imóvel e o score do lead antes de persistir o resultado.
- **Escudo Anti-Farming:** A função `addGamificationEvent` possui proteção contra repetições e limites de ações diárias. Não contorne essa regra no frontend nem crie atalhos paralelos de pontuação.
- **Ranking ao vivo:** O painel de TV (`AdminTV.tsx`) usa `Supabase Realtime` via `.channel()` para atualizar a classificação em tempo real.

## 6. CÉREBRO DE IA (Copilot & Agente Autônomo)
- **Copilot tático:** O CRM possui um Copilot que analisa dados em tempo real, incluindo tarefas, leads e notificações do sininho, para gerar insights táticos para corretores e gestores.
- **Fallback Determinístico:** Se a API do Google falhar, a função deve usar o "Cérebro Local" determinístico para manter a UI funcionando e evitar quebra de fluxo para o usuário.
- **Agente Autônomo:** O agente lê a timeline dos leads e cria tarefas automaticamente. Ao usar a SDK do Gemini para respostas estruturadas, é **OBRIGATÓRIO** configurar `responseMimeType: "application/json"` para garantir retorno em JSON válido.

## 7. CONSTRUTOR DE SITES E TEMPLATES
- **SaaS Multi-Tenant real:** O roteamento dos sites públicos usa o `TenantContext` para resolver subdomínios, incluindo `*.localhost` durante o desenvolvimento local.
- **Personalização visual:** As customizações dos clientes, como cores, textos e logos, são salvas como JSON na coluna `site_data` da tabela `companies`.

## 8. Banco de Dados (Supabase)
- **Tabelas Chave:** `properties` (imóveis), `leads` (clientes), `profiles` (extensão de usuários), `tasks` (tarefas).
- **RLS (Row Level Security):** Está ativo.
  - *Cuidado:* Evite criar políticas recursivas em `profiles` (ex: "admin vê admin"). Use funções `SECURITY DEFINER` para checar permissões.

## 9. Comandos
- `npm run dev`: Roda servidor local.
- `npm run build`: Gera build de produção (Vite).
- `npm run lint`: Verifica erros de TS/ESLint.

## 10. Known Issues (Problemas Conhecidos)
- **Vercel Deploy:** O Tailwind as vezes sofre purge excessivo. As cores devem estar na safelist ou usadas explicitamente.
- **Supabase Realtime:** Pode desconectar em conexões instáveis. O `App.tsx` não deve tentar reconectar manualmente agressivamente.
- **Sintoma:** Ao apertar F5 ou recarregar a página, a tela ficava em um "loop infinito" invisível, onde o `loading` travava em `true` eternamente e a aplicação não saía do lugar.
- **Causa (A Armadilha):** Navegadores rápidos como o Chrome executavam o `getSession()` e o evento inicial do `onAuthStateChange` no exato mesmo milissegundo. O motor do Supabase sofria um "engavetamento" (Deadlock) nas Promises ao tentar ler o Local Storage duas vezes simultaneamente.
- **A Regra de Ouro (A Solução):** O `AuthContext.tsx` possui uma trava de concorrência chamada `let isFirstListenerEvent = true`. Ela serve para IGNORAR o primeiro disparo automático do listener, permitindo que o `getSession()` trabalhe sozinho primeiro.
- **AVISO ESTRELA:** NUNCA, sob hipótese alguma, remova essa trava de concorrência do `AuthContext`. Se você remover, o Boss voltará!

## 11. Integração Financeira (Asaas + Supabase Edge Functions)
- **Sintoma:** Frontend (React) retorna o erro genérico `Failed to send a request to the Edge Function` ou `CORS error` ao tentar chamar a função de checkout via `supabase.functions.invoke()`.
- **Causa (A Máscara do Supabase):** A biblioteca `supabase-js` esconde os erros reais (como falhas de JWT no API Gateway ou erros 400 da API do Asaas) quando a requisição é interceptada. O navegador mascara como CORS.
- **A Solução:** Usar o `fetch` nativo no frontend para contornar o bloqueio da biblioteca e ler o JSON real do erro. Para garantir que a função seja alcançável sem bloqueios de preflight (OPTIONS), deve-se fazer o deploy com a flag `--no-verify-jwt` e realizar a autenticação e validação do usuário *dentro* da própria Edge Function, usando o `authHeader`.

- **Sintoma:** O Asaas retorna o erro `invalid_object` avisando que "é necessário preencher o CPF ou CNPJ do cliente" na hora de gerar a fatura (Checkout).
- **A Solução:** O endpoint `/payments` do Asaas exige documentação válida. No ambiente Sandbox, injetar um CPF gerado matematicamente válido para testes. Em produção, garantir que o formulário de cadastro da imobiliária exija e salve o CNPJ no banco de dados.

- **Sintoma:** O Webhook do Asaas é recebido e processado, mas o status do contrato na tabela `saas_contracts` continua como `pending`. Os logs da Edge Function acusam o erro `PostgREST; error=PGRST204` (Erro 400).
- **Causa:** O erro PGRST204 significa uma tentativa de fazer UPDATE em uma coluna que NÃO existe na tabela (ex: tentar atualizar `updated_at` se a tabela não tiver essa coluna criada). Além disso, requisições de webhooks (robôs externos) são bloqueadas pelo RLS (Row Level Security) padrão do Supabase se usarem a Anon Key.
- **A Solução:** Limpar a requisição enviando apenas as colunas que realmente existem (ex: `{ status: 'active' }`). Para garantir que o banco de dados aceite a atualização enviada pelo Webhook sem login humano, deve-se instanciar o cliente do Supabase *exclusivamente* com a `SUPABASE_SERVICE_ROLE_KEY` (Chave Mestra), que ignora o RLS e atualiza o contrato forçadamente.

## 🔮 Roadmap Financeiro Futuro (Módulo Banco Invisível)

Atualmente (Fase 1), o sistema utiliza o modelo BYOK (Bring Your Own Key), onde a imobiliária cola a própria chave da API (Asaas/Cora) e assume a responsabilidade fiscal.

Para a Fase 2 (Monetização Avançada), considere implementar o **Modelo de Subcontas (White-Label)** via Asaas:

- **Como funciona:** O SaaS atua como sub-adquirente. A imobiliária não cria conta no Asaas, ela faz o KYC dentro do nosso painel.
- **Vantagem:** Permite cobrar "Taxa de Software" (Split de Pagamento) em cada boleto pago pelo inquilino (Ex: Inquilino paga R$ 2.000 -> Asaas retém R$ 2 da taxa -> SaaS retém R$ 3 de lucro -> R$ 1.995 cai na subconta da imobiliária).
- **Aviso de Arquitetura:** Exigirá webhook complexo para split de pagamentos, fluxo de aprovação de documentos (KYC) e lidar com transferências/saques para a conta bancária final da imobiliária.

## 🚨 AVISOS CRÍTICOS E TROUBLESHOOTING (LEIA ANTES DE CODAR)

#### 1. Edge Functions vs AdBlockers (O Bug Silencioso)
**O Problema:** Nunca use `supabase.functions.invoke('nome-da-funcao')` para rotas financeiras (ex: rotas que contenham as palavras `subscription`, `charge`, `payment`). AdBlockers (como uBlock Origin) e escudos de navegadores (como Brave) bloqueiam essas requisições silenciosamente no front-end. A biblioteca `supabase-js` mascara esse bloqueio e retorna um erro genérico inútil: `Failed to send a request to the Edge Function`.

**A Solução:** Para chamadas críticas, **SEMPRE use `fetch` nativo**. Isso garante que, se houver falha, o payload do erro seja lido corretamente no `response.json()`.

```typescript
// ✅ PADRÃO OBRIGATÓRIO PARA EDGE FUNCTIONS FINANCEIRAS
const { data: { session } } = await supabase.auth.getSession();
const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-asaas-subscription`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
    'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
  },
  body: JSON.stringify({ ...payload })
});
if (!response.ok) throw new Error('Erro...');
```

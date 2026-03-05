# 💰 Gestão de Pagamentos - Integração Asaas

## Visão Geral

A aba "Gestão de Pagamentos" no painel Super Admin permite acompanhar em tempo real todas as faturas geradas via Asaas, cruzando os dados da API com as empresas cadastradas no Supabase.

## Arquitetura

### Backend (Edge Function)
- **Ficheiro:** `supabase/functions/list-asaas-payments/index.ts`
- **Função:** Busca os últimos 100 pagamentos no Asaas e cruza com os dados das empresas no Supabase
- **Autenticação:** Usa `SUPABASE_SERVICE_ROLE_KEY` para acesso total ao banco

### Frontend (React)
- **Ficheiro:** `src/pages/saas/SaasPayments.tsx`
- **Componente:** Interface moderna com tabela responsiva e badges de status
- **Ícones:** Usa o sistema de ícones centralizado (`Icons.tsx`)

## Fluxo de Dados

1. Frontend chama `supabase.functions.invoke('list-asaas-payments')`
2. Edge Function busca pagamentos na API do Asaas
3. Edge Function busca empresas no Supabase (tabela `companies`)
4. Cruza os dados usando `asaas_customer_id`
5. Retorna lista formatada com nome da empresa + dados do pagamento

## Status de Pagamento

| Status Asaas | Badge | Cor |
|-------------|-------|-----|
| `RECEIVED` / `CONFIRMED` | Pago | Verde |
| `PENDING` | Pendente | Amarelo |
| `OVERDUE` | Vencido | Vermelho |
| Outros | Status original | Cinza |

## Deploy

### 1. Deploy da Edge Function

```bash
npx supabase functions deploy list-asaas-payments --no-verify-jwt
```

**Importante:** A flag `--no-verify-jwt` é necessária para evitar bloqueios de CORS e permitir que a função gerencie a autenticação internamente.

### 2. Configurar Variáveis de Ambiente

Acesse o Supabase Dashboard:
1. Vá em **Project Settings** > **Edge Functions** > **Secrets**
2. Adicione as seguintes variáveis:

```
ASAAS_API_KEY=sua-chave-api-asaas-sandbox-ou-producao
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
```

### 3. Verificar Deploy

```bash
# Ver logs em tempo real
npx supabase functions logs list-asaas-payments --follow

# Testar a função
curl -X POST https://seu-projeto.supabase.co/functions/v1/list-asaas-payments \
  -H "Authorization: Bearer sua-anon-key"
```

## Requisitos no Banco de Dados

A tabela `companies` deve ter a coluna `asaas_customer_id`:

```sql
-- Verificar se a coluna existe
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'companies' 
AND column_name = 'asaas_customer_id';

-- Adicionar coluna se não existir
ALTER TABLE companies 
ADD COLUMN IF NOT EXISTS asaas_customer_id TEXT;
```

## Funcionalidades

- ✅ Listagem de todos os pagamentos do Asaas
- ✅ Cruzamento automático com empresas do Supabase
- ✅ Badges coloridos por status
- ✅ Formatação de moeda (BRL)
- ✅ Formatação de datas (DD/MM/YYYY)
- ✅ Link direto para fatura no Asaas
- ✅ Botão de atualização manual
- ✅ Loading state durante sincronização
- ✅ Suporte a tema claro/escuro

## Troubleshooting

### Erro: "Failed to invoke function"
- Verifique se a função foi deployada: `npx supabase functions list`
- Verifique os logs: `npx supabase functions logs list-asaas-payments`

### Erro: "Erro ao aceder à API do Asaas"
- Verifique se `ASAAS_API_KEY` está configurada corretamente
- Confirme que a chave é válida no ambiente (sandbox/produção)

### Empresas aparecem como "Cliente Desconhecido"
- Verifique se a coluna `asaas_customer_id` existe na tabela `companies`
- Confirme que os IDs do Asaas estão salvos corretamente no banco

### CORS Error
- Certifique-se de que deployou com `--no-verify-jwt`
- Verifique se os headers CORS estão corretos na Edge Function

## Próximos Passos

- [ ] Adicionar filtros por status
- [ ] Adicionar paginação
- [ ] Adicionar busca por empresa
- [ ] Adicionar exportação para CSV/Excel
- [ ] Adicionar gráficos de receita
- [ ] Adicionar notificações de pagamentos recebidos
- [ ] Adicionar webhook para atualização automática

## Referências

- [Documentação Asaas API](https://docs.asaas.com/reference/listar-cobrancas)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [Guia de Integração Financeira](./AGENTS.md#8-integração-financeira-asaas--supabase-edge-functions)

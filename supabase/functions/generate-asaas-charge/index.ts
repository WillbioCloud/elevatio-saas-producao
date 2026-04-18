import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getAsaasApiUrl } from '../_shared/billing-security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Trata a requisição de pré-voo (CORS) do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invoiceId } = await req.json()
    if (!invoiceId) throw new Error('ID da fatura não fornecido')

    // 2. Conectar ao Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 3. Buscar a Fatura e a Chave do Asaas
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('*, company:companies(payment_api_key)')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) throw new Error('Fatura não encontrada no banco de dados.')
    if (!invoice.company?.payment_api_key) throw new Error('A Imobiliária não configurou a chave da API do Asaas.')

    const asaasApiKey = invoice.company.payment_api_key
    const asaasBaseUrl = getAsaasApiUrl()

    // 4. Criar Cliente no Asaas
    const customerRes = await fetch(`${asaasBaseUrl}/customers`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': asaasApiKey },
      body: JSON.stringify({
        name: invoice.client_name,
        // Usa o documento da fatura. Se por algum motivo for vazio, usa o de teste apenas para não quebrar.
        cpfCnpj: invoice.client_document || '123456789',
      })
    })
    
    const customerData = await customerRes.json()
    if (!customerData.id) throw new Error('Erro Asaas (Cliente): ' + JSON.stringify(customerData))

    // 5. Gerar a Cobrança
    const paymentRes = await fetch(`${asaasBaseUrl}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'access_token': asaasApiKey },
      body: JSON.stringify({
        customer: customerData.id,
        billingType: 'UNDEFINED',
        value: invoice.amount,
        dueDate: invoice.due_date,
        description: invoice.description || `Cobrança - ${invoice.client_name}`,
      })
    })
    
    const paymentData = await paymentRes.json()
    if (!paymentData.id) throw new Error('Erro Asaas (Pagamento): ' + JSON.stringify(paymentData))

    // 6. Atualizar a nossa tabela com o link mágico
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({ 
        gateway_id: paymentData.id,
        payment_url: paymentData.invoiceUrl,
        status: 'pendente'
      })
      .eq('id', invoiceId)

    if (updateError) throw new Error('Erro ao salvar URL no banco.')

    return new Response(
      JSON.stringify({ success: true, payment_url: paymentData.invoiceUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    // Proteção de tipagem no catch para evitar crash no Deno
    console.error("Erro na Edge Function:", error);
    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno desconhecido no servidor.' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

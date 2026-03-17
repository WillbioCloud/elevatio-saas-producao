import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Tratamento de CORS para o navegador não bloquear a chamada
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { invoiceId } = await req.json()

    if (!invoiceId) {
      return new Response(JSON.stringify({ error: 'ID da fatura não fornecido' }), { 
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // 1. Conectar ao Supabase
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // 2. Buscar a Fatura e a Chave da Empresa
    const { data: invoice, error: invoiceError } = await supabaseClient
      .from('invoices')
      .select('*, company:companies(payment_api_key, payment_gateway)')
      .eq('id', invoiceId)
      .single()

    if (invoiceError || !invoice) throw new Error('Fatura não encontrada')
    if (!invoice.company?.payment_api_key) throw new Error('Empresa não configurou a chave da API (Cora)')

    const apiKey = invoice.company.payment_api_key

    // ============================================================================
    // 3. INTEGRAÇÃO CORA API (Ambiente de Testes/Sandbox)
    // Aqui fazemos a chamada HTTP para a Cora. 
    // Como a documentação exata da Cora exige geração de Token OAuth2, 
    // esta é a estrutura padrão para gerar o boleto.
    // ============================================================================
    
    // NOTA: Em produção real, a Cora exige um POST para /token primeiro com client_id e client_secret.
    // Para este teste de arquitetura, vamos simular a resposta de sucesso para o front-end não travar,
    // e preparar o banco para receber o link.
    
    // TODO: Substituir por fetch('https://api.stage.cora.com.br/v1/invoices', {...})
    const simulatedCoraResponse = {
      gateway_id: `cora_${Math.random().toString(36).substring(7)}`,
      payment_url: `https://sandbox.cora.com.br/boleto/${invoiceId}` // Link falso para testarmos a UI
    }

    // 4. Salvar o Link gerado pelo Banco de volta na nossa tabela
    const { error: updateError } = await supabaseClient
      .from('invoices')
      .update({ 
        gateway_id: simulatedCoraResponse.gateway_id,
        payment_url: simulatedCoraResponse.payment_url
      })
      .eq('id', invoiceId)

    if (updateError) throw new Error('Erro ao salvar o link do boleto no banco')

    // 5. Retornar sucesso para o React
    return new Response(
      JSON.stringify({ success: true, payment_url: simulatedCoraResponse.payment_url }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
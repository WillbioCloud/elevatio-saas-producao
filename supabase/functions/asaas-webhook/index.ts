import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const body = await req.json()
    console.log("🔔 Webhook Asaas recebido! Evento:", body.event)

    if (body.event === 'PAYMENT_RECEIVED' || body.event === 'PAYMENT_CONFIRMED') {
      const asaasCustomerId = body.payment.customer

      const supabaseAdmin = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // 1. Procurar a empresa
      const { data: companyData, error: companyErr } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('asaas_customer_id', asaasCustomerId)
        .single()

      if (companyErr || !companyData) {
        throw new Error(`Empresa com Asaas ID ${asaasCustomerId} não encontrada!`)
      }

      const companyId = companyData.id

      // 2. Atualizar o Contrato forçadamente (REMOVEMOS O UPDATED_AT)
      const { data: updatedContract, error: updateErr } = await supabaseAdmin
        .from('saas_contracts')
        .update({ status: 'active' }) // <-- AGORA SÓ ATUALIZA O STATUS
        .eq('company_id', companyId)
        .select() 

      if (updateErr) {
        throw new Error(`Erro ao forçar atualização no banco: ${updateErr.message}`)
      }

      console.log(`✅ SUCESSO REAL! Contrato ativado no banco:`, updatedContract)
    }

    return new Response(JSON.stringify({ received: true }), { 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200
    })

  } catch (error: any) {
    console.error("❌ ERRO FATAL NO WEBHOOK:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { 
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })
  }
})
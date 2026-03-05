import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, plan_name, billing_cycle, price } = await req.json()

    if (!company_id || !plan_name || !price) throw new Error("Dados incompletos para reativação.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: company, error: compError } = await supabaseAdmin
      .from('companies')
      .select('asaas_customer_id')
      .eq('id', company_id)
      .single()

    if (compError || !company?.asaas_customer_id) throw new Error("Cliente não encontrado no Asaas.")

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    // 1. Cria uma NOVA assinatura no Asaas
    const cycleAsaas = billing_cycle === 'yearly' ? 'YEARLY' : 'MONTHLY'
    const newSubRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'access_token': ASAAS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        customer: company.asaas_customer_id,
        billingType: 'CREDIT_CARD',
        value: price,
        nextDueDate: new Date().toISOString().split('T')[0], // Cobra hoje
        cycle: cycleAsaas,
        description: `Reativação: Assinatura Elevatio Vendas - Plano ${plan_name.toUpperCase()}`
      })
    })

    const newSubData = await newSubRes.json()
    if (!newSubRes.ok) throw new Error(`Erro no Asaas: ${newSubData.errors?.[0]?.description || 'Falha ao criar assinatura'}`)

    // 2. Atualiza o banco com o NOVO ID da assinatura e volta o status para active/pending
    await supabaseAdmin
      .from('companies')
      .update({ asaas_subscription_id: newSubData.id })
      .eq('id', company_id)

    await supabaseAdmin
      .from('saas_contracts')
      .update({
        status: 'pending', // Ficará active quando o webhook confirmar o pagamento
        plan_name: plan_name,
        billing_cycle: billing_cycle,
        canceled_at: null,
        cancel_reason: null,
        fidelity_end_date: null,
        has_fidelity: false
      })
      .eq('company_id', company_id)

    // 3. Pega o link de pagamento da primeira fatura gerada por essa nova assinatura
    const payRes = await fetch(`${ASAAS_URL}/payments?subscription=${newSubData.id}`, {
      method: 'GET',
      headers: { 'access_token': ASAAS_API_KEY! }
    })

    const payData = await payRes.json()
    const invoiceUrl = payData.data?.[0]?.invoiceUrl

    return new Response(JSON.stringify({ success: true, checkoutUrl: invoiceUrl }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

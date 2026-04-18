import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import {
  createSupabaseAdmin,
  getAsaasApiUrl,
  getErrorStatus,
  requireBillingCompanyAccess,
} from '../_shared/billing-security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, plan_name, billing_cycle, price } = await req.json()
    const companyId = normalizeString(company_id)
    const planName = normalizeString(plan_name)

    if (!companyId || !planName || !price) throw new Error("Dados incompletos para reativacao.")

    await requireBillingCompanyAccess(req, companyId)

    const supabaseAdmin = createSupabaseAdmin()

    const { data: company, error: compError } = await supabaseAdmin
      .from('companies')
      .select('asaas_customer_id')
      .eq('id', companyId)
      .single()

    if (compError || !company?.asaas_customer_id) throw new Error("Cliente nao encontrado no Asaas.")

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()

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
        nextDueDate: new Date().toISOString().split('T')[0],
        cycle: cycleAsaas,
        description: `Reativacao: Assinatura Elevatio Vendas - Plano ${planName.toUpperCase()}`
      })
    })

    const newSubData = await newSubRes.json()
    if (!newSubRes.ok) throw new Error(`Erro no Asaas: ${newSubData.errors?.[0]?.description || 'Falha ao criar assinatura'}`)

    await supabaseAdmin
      .from('companies')
      .update({ asaas_subscription_id: newSubData.id })
      .eq('id', companyId)

    await supabaseAdmin
      .from('saas_contracts')
      .update({
        status: 'pending',
        plan_name: planName,
        billing_cycle,
        canceled_at: null,
        cancel_reason: null,
        fidelity_end_date: null,
        has_fidelity: false
      })
      .eq('company_id', companyId)

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
      status: getErrorStatus(error),
    })
  }
})

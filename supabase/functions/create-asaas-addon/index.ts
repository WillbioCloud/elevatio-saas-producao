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
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

type AddonType = 'domain' | 'whatsapp'
type AddonCycle = 'MONTHLY' | 'YEARLY'

type RequestPayload = {
  companyId?: unknown
  company_id?: unknown
  customerId?: unknown
  customer_id?: unknown
  addonType?: unknown
  addon_type?: unknown
  price?: unknown
  cycle?: unknown
  description?: unknown
  credits?: unknown
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const normalizeNumber = (value: unknown) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

const parsePayload = async (req: Request) => {
  const body = await req.json().catch(() => ({})) as RequestPayload

  const companyId = normalizeString(body.companyId ?? body.company_id)
  const customerId = normalizeString(body.customerId ?? body.customer_id)
  const addonType = normalizeString(body.addonType ?? body.addon_type) as AddonType
  const price = normalizeNumber(body.price)
  const cycle = normalizeString(body.cycle).toUpperCase() as AddonCycle
  const description = normalizeString(body.description)
  const credits = Math.max(0, normalizeNumber(body.credits))

  if (!companyId) throw new Error('ID da empresa nao informado.')
  if (!addonType || !['domain', 'whatsapp'].includes(addonType)) {
    throw new Error('Tipo de adicional invalido.')
  }
  if (!Number.isFinite(price) || price <= 0) {
    throw new Error('Preco do adicional invalido.')
  }
  if (!cycle || !['MONTHLY', 'YEARLY'].includes(cycle)) {
    throw new Error('Ciclo do adicional invalido.')
  }
  if (!description) {
    throw new Error('Descricao do adicional nao informada.')
  }

  return {
    companyId,
    customerId,
    addonType,
    price,
    cycle,
    description,
    credits,
  }
}

const getAsaasErrorMessage = (payload: any, fallback: string) => {
  return payload?.errors?.[0]?.description
    || payload?.errors?.[0]?.message
    || payload?.message
    || payload?.error
    || fallback
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const {
      companyId,
      customerId,
      addonType,
      price,
      cycle,
      description,
      credits,
    } = await parsePayload(req)

    await requireBillingCompanyAccess(req, companyId)

    const supabaseClient = createSupabaseAdmin()

    const { data: companyRecord, error: companyError } = await supabaseClient
      .from('companies')
      .select('id, name, asaas_customer_id')
      .eq('id', companyId)
      .single()

    if (companyError || !companyRecord) {
      throw new Error(`Empresa nao encontrada: ${companyError?.message || 'registro ausente'}`)
    }

    const resolvedCustomerId = normalizeString(companyRecord.asaas_customer_id) || customerId
    if (!resolvedCustomerId) {
      throw new Error('Cliente financeiro nao encontrado para a empresa.')
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    if (!ASAAS_API_KEY) {
      throw new Error('ASAAS_API_KEY nao configurada.')
    }

    const ASAAS_URL = getAsaasApiUrl()
    const asaasHeaders = {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Elevatio-SaaS/1.0 (Supabase Edge Functions)',
    }

    const nextDueDate = new Date().toISOString().split('T')[0]

    const subscriptionRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify({
        customer: resolvedCustomerId,
        billingType: 'UNDEFINED',
        value: price,
        nextDueDate,
        cycle,
        description,
      }),
    })

    const subscriptionData = await subscriptionRes.json().catch(() => null)
    if (!subscriptionRes.ok || !subscriptionData?.id) {
      throw new Error(getAsaasErrorMessage(subscriptionData, 'Falha ao criar adicional no Asaas.'))
    }

    const pendingPaymentsRes = await fetch(
      `${ASAAS_URL}/payments?subscription=${subscriptionData.id}&status=PENDING`,
      {
        method: 'GET',
        headers: asaasHeaders,
      }
    )

    const pendingPaymentsData = await pendingPaymentsRes.json().catch(() => null)
    const firstPendingPayment = Array.isArray(pendingPaymentsData?.data)
      ? pendingPaymentsData.data[0]
      : null

    // --- Logica Supabase: Atualizar o Banco de Dados ---
    if (addonType === 'domain') {
      const { error: dbError } = await supabaseClient
        .from('companies')
        .update({ domain_status: 'pending' })
        .eq('id', companyId)

      if (dbError) throw new Error(`Erro ao atualizar dominio no banco: ${dbError.message}`)
    }
    else if (addonType === 'whatsapp' && credits > 0) {
      const { data: company, error: fetchError } = await supabaseClient
        .from('companies')
        .select('whatsapp_credits')
        .eq('id', companyId)
        .single()

      if (fetchError) throw new Error(`Erro ao buscar saldo de creditos: ${fetchError.message}`)

      const currentCredits = company.whatsapp_credits || 0
      const newBalance = currentCredits + credits

      const { error: updateError } = await supabaseClient
        .from('companies')
        .update({ whatsapp_credits: newBalance })
        .eq('id', companyId)

      if (updateError) throw new Error(`Erro ao creditar WhatsApp no banco: ${updateError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        addonType,
        subscriptionId: subscriptionData.id,
        paymentId: firstPendingPayment?.id ?? null,
        invoiceUrl: firstPendingPayment?.invoiceUrl ?? null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )
  } catch (error: any) {
    console.error('[create-asaas-addon] erro:', error)

    return new Response(
      JSON.stringify({ error: error?.message || 'Erro interno ao criar adicional.' }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: getErrorStatus(error),
      }
    )
  }
})

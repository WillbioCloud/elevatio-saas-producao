import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getAsaasApiUrl, getErrorStatus, requireBillingCompanyAccess } from '../_shared/billing-security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

type RequestPayload = {
  company_id?: unknown
  plan?: unknown
  cycle?: unknown
  coupon_id?: unknown
  coupon_code?: unknown
}

const normalizeString = (value: unknown) => {
  if (typeof value !== 'string') return ''
  return value.trim()
}

const normalizeWhatsappCredits = (value: unknown) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? Math.max(0, Math.trunc(numericValue)) : 0
}

const buildSubscriptionDiscount = (coupon: Record<string, any> | null, baseValue: number) => {
  if (!coupon) return null

  const couponType = String(coupon.discount_type ?? coupon.type ?? '').toLowerCase()
  const couponValue = Math.max(0, Number(coupon.discount_value ?? coupon.value ?? 0))

  if (couponType === 'percentage') {
    return { value: Math.min(100, couponValue), type: 'PERCENTAGE' as const }
  }

  if (couponType === 'free') {
    return { value: Math.max(0, Number(baseValue)), type: 'FIXED' as const }
  }

  if (couponType === 'fixed') {
    return { value: Math.min(Math.max(0, Number(baseValue)), couponValue), type: 'FIXED' as const }
  }

  return null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const reqText = await req.text()
    if (!reqText) throw new Error("A requisição do CRM veio vazia.")

    const { company_id, plan, cycle, coupon_id, coupon_code } = JSON.parse(reqText) as RequestPayload
    const companyId = normalizeString(company_id)
    const planName = normalizeString(plan)
    const billingCycle = normalizeString(cycle)
    const couponId = normalizeString(coupon_id)
    const couponCode = normalizeString(coupon_code).toUpperCase()

    if (!companyId || !planName) throw new Error("Faltam parâmetros obrigatórios.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { user, profile, isSuperAdmin } = await requireBillingCompanyAccess(req, companyId)

    let customerEmail = profile?.email || user.email || 'email@padrao.com'

    if (isSuperAdmin && profile?.company_id !== companyId) {
      const { data: companyProfile } = await supabaseAdmin
        .from('profiles')
        .select('email')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (companyProfile?.email) {
        customerEmail = companyProfile.email
      }
    }

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (companyError || !company) throw new Error('Empresa não encontrada no banco.')

    const { data: planRecord, error: planError } = await supabaseAdmin
      .from('saas_plans')
      .select('id, name, price_monthly, price_yearly, price, whatsapp_credits')
      .ilike('name', planName)
      .eq('active', true)
      .maybeSingle()

    if (planError) throw planError
    if (!planRecord) throw new Error('Plano inválido ou inativo.')

    const monthlyPlanPrice = Number(planRecord.price_monthly ?? planRecord.price ?? 0)
    const yearlyPlanPrice = Number(planRecord.price_yearly ?? 0)
    if (!Number.isFinite(monthlyPlanPrice) || monthlyPlanPrice < 0) {
      throw new Error('Plano inválido ou sem preço configurado.')
    }

    const isYearly = billingCycle === 'yearly'
    const planValue = isYearly
      ? Number.isFinite(yearlyPlanPrice) && yearlyPlanPrice > 0
        ? yearlyPlanPrice
        : monthlyPlanPrice * 12
      : monthlyPlanPrice
    const manualDiscountValue = Number(company.manual_discount_value ?? 0)
    const manualDiscountType = company.manual_discount_type
    const manualDiscountAmount = manualDiscountValue > 0
      ? Math.min(
          planValue,
          manualDiscountType === 'percentage'
            ? planValue * (manualDiscountValue / 100)
            : manualDiscountValue
        )
      : 0
    const finalPlanValue = Math.max(0, planValue - manualDiscountAmount)
    const asaasCycle = isYearly ? 'YEARLY' : 'MONTHLY'
    const planKey = String(planRecord.name ?? planName).toLowerCase()

    let couponRecord: Record<string, any> | null = null
    if (couponId || couponCode) {
      let couponQuery = supabaseAdmin
        .from('saas_coupons')
        .select('*')
        .eq('active', true)

      if (couponId) {
        couponQuery = couponQuery.eq('id', couponId)
      } else {
        couponQuery = couponQuery.eq('code', couponCode)
      }

      const { data: coupon } = await couponQuery.maybeSingle()

      if (!coupon) throw new Error('Cupom inválido ou inativo.')

      const maxUses = Number(coupon.max_uses ?? coupon.usage_limit ?? 0)
      if (maxUses > 0 && Number(coupon.used_count ?? coupon.current_uses ?? coupon.current_usages ?? 0) >= maxUses) {
        throw new Error('Cupom esgotado.')
      }

      couponRecord = coupon as Record<string, any>
    }

    const cleanDocument = company.document?.replace(/\D/g, '') || company.cpf_cnpj?.replace(/\D/g, '') || ''
    const cleanPhone = company.phone || ''
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()

    // ===========================================================
    // PATCH A: Reutilizar customer existente — evitar clientes fantasmas
    // Nunca criar um novo customer se já temos o ID salvo ou
    // se já existe um com o mesmo CNPJ no Asaas.
    // ===========================================================
    let customerId: string | null = company.asaas_customer_id || null

    if (!customerId && cleanDocument) {
      const searchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${cleanDocument}&limit=1`, {
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! }
      })
      if (searchRes.ok) {
        const searchData = await searchRes.json()
        if (searchData?.data?.length > 0) {
          customerId = searchData.data[0].id
          console.log(`[CHECKOUT] Customer existente encontrado no Asaas por CNPJ: ${customerId}`)
        }
      }
    }

    let customerData: Record<string, any> = { id: customerId }

    if (!customerId) {
      const customerPayload = {
        name: company.name,
        email: customerEmail,
        cpfCnpj: cleanDocument,
        phone: cleanPhone,
        mobilePhone: cleanPhone
      }

      const customerRes = await fetch(`${ASAAS_URL}/customers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! },
        body: JSON.stringify(customerPayload)
      })

      const customerText = await customerRes.text()
      try {
        customerData = JSON.parse(customerText)
      } catch (_error) {
        throw new Error(`Erro crítico na API Asaas (Cliente). Status: ${customerRes.status}. Resposta: ${customerText}`)
      }

      if (!customerRes.ok) throw new Error(`Erro ao criar cliente Asaas: ${customerData.errors?.[0]?.description || customerText}`)

      customerId = customerData.id
    }

    if (!customerId) throw new Error('Não foi possível obter ou criar o cliente no Asaas.')

    const subscriptionDiscount = buildSubscriptionDiscount(couponRecord, planValue)
    if (couponRecord && !subscriptionDiscount) throw new Error('Tipo de cupom inválido.')

    // ===========================================================
    // PATCH B: Limpeza de assinaturas e faturas antigas
    // Antes de criar a nova assinatura, limpamos assinaturas ativas
    // e faturas pendentes para não acumular cobranças duplicadas no cliente.
    // ===========================================================
    if (customerId) {
      // 1. Deletar faturas (payments) PENDENTES antigas
      const orphanPaymentsRes = await fetch(
        `${ASAAS_URL}/payments?customer=${customerId}&status=PENDING&limit=100`,
        { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! } }
      )
      if (orphanPaymentsRes.ok) {
        const orphanPaymentsData = await orphanPaymentsRes.json()
        if (Array.isArray(orphanPaymentsData?.data)) {
          for (const payment of orphanPaymentsData.data) {
            await fetch(`${ASAAS_URL}/payments/${payment.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! }
            })
            console.log(`[CHECKOUT] Fatura pendente antiga deletada: ${payment.id}`)
          }
        }
      }

      // 2. Deletar assinaturas (subscriptions) ATIVAS antigas
      const orphanSubsRes = await fetch(
        `${ASAAS_URL}/subscriptions?customer=${customerId}&status=ACTIVE&limit=100`,
        { headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! } }
      )
      if (orphanSubsRes.ok) {
        const orphanSubsData = await orphanSubsRes.json()
        if (Array.isArray(orphanSubsData?.data)) {
          for (const sub of orphanSubsData.data) {
            await fetch(`${ASAAS_URL}/subscriptions/${sub.id}`, {
              method: 'DELETE',
              headers: { 'Content-Type': 'application/json', 'access_token': ASAAS_API_KEY! }
            })
            console.log(`[CHECKOUT] Assinatura antiga deletada: ${sub.id}`)
          }
        }
      }
    }

    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + 7)

    const subscriptionPayload: Record<string, unknown> = {
      customer: customerId,
      billingType: 'UNDEFINED',
      value: finalPlanValue,
      nextDueDate: nextDueDate.toISOString().split('T')[0],
      cycle: asaasCycle,
      description: `Assinatura Elevatio CRM - Plano ${planKey.toUpperCase()} (${isYearly ? 'Anual' : 'Mensal'})`
    }

    if (subscriptionDiscount) {
      subscriptionPayload.discount = subscriptionDiscount
    }

    const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY!
      },
      body: JSON.stringify(subscriptionPayload)
    })

    const subText = await subRes.text()
    let subData
    try {
      subData = JSON.parse(subText)
    } catch (_error) {
      throw new Error(`Erro crítico na API Asaas (Assinatura). Status: ${subRes.status}. Resposta: ${subText}`)
    }

    if (!subRes.ok) throw new Error(`Erro ao criar assinatura Asaas: ${subData.errors?.[0]?.description || subText}`)

    const companyUpdate: Record<string, unknown> = {
      asaas_customer_id: customerId,
      asaas_subscription_id: subData.id
    }

    const { error: companyUpdateError } = await supabaseAdmin
      .from('companies')
      .update(companyUpdate)
      .eq('id', companyId)

    if (companyUpdateError) throw companyUpdateError

    const normalizedCompanyPlanStatus = normalizeString(company.plan_status).toLowerCase()
    const hasActiveTrialWindow = typeof company.trial_ends_at === 'string'
      && company.trial_ends_at
      && !Number.isNaN(new Date(company.trial_ends_at).getTime())
      && new Date(company.trial_ends_at) > new Date()
    const isInitialTrialProvisioning =
      !company.asaas_subscription_id
      && (
        normalizedCompanyPlanStatus === 'trial'
        || normalizedCompanyPlanStatus === 'trialing'
        || hasActiveTrialWindow
      )
    const currentWhatsappCredits = Number(company.whatsapp_credits ?? 0)
    const initialWhatsappCredits = normalizeWhatsappCredits(planRecord.whatsapp_credits)

    if (
      isInitialTrialProvisioning
      && (!Number.isFinite(currentWhatsappCredits) || currentWhatsappCredits <= 0)
    ) {
      const { error: whatsappCreditsError } = await supabaseAdmin
        .from('companies')
        .update({ whatsapp_credits: initialWhatsappCredits })
        .eq('id', companyId)

      if (whatsappCreditsError) throw whatsappCreditsError
    }

    if (couponRecord?.id) {
      const couponLinkUpdate: Record<string, unknown> = { applied_coupon_id: couponRecord.id }
      if (company.applied_coupon_id !== couponRecord.id || !company.coupon_start_date) {
        couponLinkUpdate.coupon_start_date = null
      }

      const { error: couponLinkError } = await supabaseAdmin
        .from('companies')
        .update(couponLinkUpdate)
        .eq('id', companyId)

      if (couponLinkError) throw couponLinkError
    } else if (company.applied_coupon_id && !company.coupon_start_date) {
      const { error: couponClearError } = await supabaseAdmin
        .from('companies')
        .update({ applied_coupon_id: null, coupon_start_date: null })
        .eq('id', companyId)

      if (couponClearError) throw couponClearError
    }

    return new Response(
      JSON.stringify({ success: true, asaas_customer: customerData.id, subscription_id: subData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('ERRO EDGE FUNCTION:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: getErrorStatus(error) }
    )
  }
})

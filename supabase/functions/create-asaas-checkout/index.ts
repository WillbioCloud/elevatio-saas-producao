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

    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    const token = authHeader?.replace(/^Bearer\s+/i, '').trim()
    await requireBillingCompanyAccess(req, companyId)
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Acesso negado: sessão inválida.')

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('email, company_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = profile?.role === 'super_admin'

    if (!isSuperAdmin && !profile?.company_id) {
      throw new Error('Acesso negado: empresa do usuário não encontrada.')
    }

    if (!isSuperAdmin && profile?.company_id !== companyId) {
      throw new Error('Acesso negado: empresa inválida.')
    }

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
      .select('id, name, price_monthly, price_yearly, price')
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
        : monthlyPlanPrice * 12 * 0.85
      : monthlyPlanPrice
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

    const customerPayload = {
      name: company.name,
      email: customerEmail,
      cpfCnpj: cleanDocument,
      phone: cleanPhone,
      mobilePhone: cleanPhone
    }

    const customerRes = await fetch(`${ASAAS_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY!
      },
      body: JSON.stringify(customerPayload)
    })

    const customerText = await customerRes.text()
    let customerData
    try {
      customerData = JSON.parse(customerText)
    } catch (_error) {
      throw new Error(`Erro crítico na API Asaas (Cliente). Status: ${customerRes.status}. Resposta: ${customerText}`)
    }

    if (!customerRes.ok) throw new Error(`Erro ao criar cliente Asaas: ${customerData.errors?.[0]?.description || customerText}`)

    const subscriptionDiscount = buildSubscriptionDiscount(couponRecord, planValue)
    if (couponRecord && !subscriptionDiscount) throw new Error('Tipo de cupom inválido.')

    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + 7)

    const subscriptionPayload: Record<string, unknown> = {
      customer: customerData.id,
      billingType: 'UNDEFINED',
      value: planValue,
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
      asaas_customer_id: customerData.id,
      asaas_subscription_id: subData.id
    }

    const { error: companyUpdateError } = await supabaseAdmin
      .from('companies')
      .update(companyUpdate)
      .eq('id', companyId)

    if (companyUpdateError) throw companyUpdateError

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

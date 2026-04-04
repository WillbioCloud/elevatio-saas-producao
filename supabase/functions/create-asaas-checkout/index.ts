import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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

  if (couponType === 'free_month') {
    return { value: Math.max(0, Number(baseValue)), type: 'FIXED' as const }
  }

  if (couponType === 'fixed') {
    return { value: Math.min(Math.max(0, Number(baseValue)), couponValue), type: 'FIXED' as const }
  }

  return null
}

const incrementCouponUsage = async (supabaseAdmin: ReturnType<typeof createClient>, couponId: string) => {
  const { data: couponData, error: couponError } = await supabaseAdmin
    .from('saas_coupons')
    .select('current_uses, current_usages, used_count, max_uses, usage_limit')
    .eq('id', couponId)
    .single()

  if (couponError) throw couponError
  if (!couponData) return

  const currentUses = Number(couponData.current_uses ?? couponData.current_usages ?? couponData.used_count ?? 0)
  const maxUses = Number(couponData.max_uses ?? couponData.usage_limit ?? 0)
  const newUses = currentUses + 1
  const isActive = maxUses > 0 ? newUses < maxUses : true

  let { error } = await supabaseAdmin
    .from('saas_coupons')
    .update({
      current_uses: newUses,
      active: isActive
    })
    .eq('id', couponId)

  if (error && /current_uses/i.test(error.message || '')) {
    const fallback = await supabaseAdmin
      .from('saas_coupons')
      .update({
        current_usages: newUses,
        active: isActive
      })
      .eq('id', couponId)

    error = fallback.error
  }

  if (error && /(current_usages|current_uses)/i.test(error.message || '')) {
    const fallback = await supabaseAdmin
      .from('saas_coupons')
      .update({
        used_count: newUses,
        active: isActive
      })
      .eq('id', couponId)

    error = fallback.error
  }

  if (error) throw error
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) throw new Error('Acesso negado: token ausente.')

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new Error('Acesso negado: token ausente.')

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

      const maxUses = coupon.max_uses ?? coupon.usage_limit
      if (typeof maxUses === 'number' && maxUses > 0 && Number(coupon.used_count ?? coupon.current_usages ?? 0) >= maxUses) {
        throw new Error('Cupom esgotado.')
      }

      couponRecord = coupon as Record<string, any>
    }

    const cleanDocument = company.document?.replace(/\D/g, '') || company.cpf_cnpj?.replace(/\D/g, '') || ''
    const cleanPhone = company.phone || ''
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

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

    const planPrices: Record<string, { monthly: number, yearly: number }> = {
      starter: { monthly: 54.90, yearly: 527.04 },
      basic: { monthly: 74.90, yearly: 719.04 },
      profissional: { monthly: 119.90, yearly: 1151.04 },
      professional: { monthly: 119.90, yearly: 1151.04 },
      business: { monthly: 179.90, yearly: 1727.04 },
      premium: { monthly: 249.90, yearly: 2399.04 },
      elite: { monthly: 349.90, yearly: 3359.04 }
    }

    const planKey = planName.toLowerCase()
    const selectedPlan = planPrices[planKey]
    if (!selectedPlan) throw new Error('Plano inválido.')

    const isYearly = billingCycle === 'yearly'
    const planValue = isYearly ? selectedPlan.yearly : selectedPlan.monthly
    const asaasCycle = isYearly ? 'YEARLY' : 'MONTHLY'
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

    await supabaseAdmin
      .from('companies')
      .update(companyUpdate)
      .eq('id', companyId)

    // Se a assinatura foi criada e tinha um cupom, registra o uso e vincula à empresa
    if (couponId) {
      // 1. Vincula o cupom à imobiliária
      await supabaseAdmin
        .from('companies')
        .update({
          applied_coupon_id: couponId,
          coupon_start_date: new Date().toISOString()
        })
        .eq('id', companyId)

      // 2. Busca o cupom para incrementar o uso
      await incrementCouponUsage(supabaseAdmin, couponId)
    } else if (couponRecord?.id) {
      await supabaseAdmin
        .from('companies')
        .update({
          applied_coupon_id: couponRecord.id,
          coupon_start_date: new Date().toISOString()
        })
        .eq('id', companyId)

      await incrementCouponUsage(supabaseAdmin, couponRecord.id)
    }

    return new Response(
      JSON.stringify({ success: true, asaas_customer: customerData.id, subscription_id: subData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )
  } catch (error: any) {
    console.error('ERRO EDGE FUNCTION:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

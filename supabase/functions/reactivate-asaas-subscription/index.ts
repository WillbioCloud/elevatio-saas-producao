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

const toPlanPrice = (value: unknown, fallback = 0) => {
  const numericValue = Number(value)
  return Number.isFinite(numericValue) ? numericValue : fallback
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

const hasCouponExpired = (couponStartDate: unknown, durationMonths: unknown) => {
  if (typeof couponStartDate !== 'string' || !couponStartDate) return false

  const duration = Number(durationMonths ?? 0)
  if (!Number.isFinite(duration) || duration <= 0) return false

  const startDate = new Date(couponStartDate)
  if (Number.isNaN(startDate.getTime())) return false

  const currentDate = new Date()
  const monthsPassed = (currentDate.getFullYear() - startDate.getFullYear()) * 12
    + (currentDate.getMonth() - startDate.getMonth())

  return monthsPassed >= duration
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, plan_name, billing_cycle } = await req.json()
    const companyId = normalizeString(company_id)
    const planIdentifier = normalizeString(plan_name)
    const normalizedBillingCycle = normalizeString(billing_cycle).toLowerCase()

    if (!companyId || !planIdentifier || !normalizedBillingCycle) {
      throw new Error("Dados incompletos para reativacao.")
    }

    if (normalizedBillingCycle !== 'monthly' && normalizedBillingCycle !== 'yearly') {
      throw new Error("Ciclo de cobranca invalido.")
    }

    await requireBillingCompanyAccess(req, companyId)

    const supabaseAdmin = createSupabaseAdmin()

    const { data: company, error: compError } = await supabaseAdmin
      .from('companies')
      .select('asaas_customer_id, manual_discount_value, manual_discount_type, applied_coupon_id, coupon_start_date')
      .eq('id', companyId)
      .single()

    if (compError || !company?.asaas_customer_id) throw new Error("Cliente nao encontrado no Asaas.")

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()
    const asaasHeaders = {
      'access_token': ASAAS_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Elevatio-SaaS/1.0 (Supabase Edge Functions)'
    }
    const planSelect = 'id, name, price_monthly, price_yearly, monthly_price, yearly_price, price'

    let planRecord: Record<string, any> | null = null

    const { data: planById, error: planByIdError } = await supabaseAdmin
      .from('saas_plans')
      .select(planSelect)
      .eq('id', planIdentifier)
      .eq('active', true)
      .maybeSingle()

    if (planByIdError) throw planByIdError
    if (planById) {
      planRecord = planById
    } else {
      const { data: planByName, error: planByNameError } = await supabaseAdmin
        .from('saas_plans')
        .select(planSelect)
        .ilike('name', planIdentifier)
        .eq('active', true)
        .maybeSingle()

      if (planByNameError) throw planByNameError
      planRecord = planByName
    }

    if (!planRecord) throw new Error("Plano invalido ou inativo.")

    const monthlyPrice = toPlanPrice(
      planRecord.price_monthly ?? planRecord.monthly_price ?? planRecord.price,
      NaN
    )
    const yearlyPrice = toPlanPrice(
      planRecord.price_yearly ?? planRecord.yearly_price,
      NaN
    )

    if (!Number.isFinite(monthlyPrice) || monthlyPrice < 0) {
      throw new Error("Plano invalido ou sem preco configurado.")
    }

    const cycleAsaas = normalizedBillingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY'
    const calculatedPrice = cycleAsaas === 'YEARLY'
      ? (Number.isFinite(yearlyPrice) && yearlyPrice > 0 ? yearlyPrice : monthlyPrice * 12)
      : monthlyPrice
    const planName = String(planRecord.name ?? planIdentifier)
    const manualDiscountValue = Number(company.manual_discount_value ?? 0)
    const manualDiscountType = company.manual_discount_type
    const manualDiscountAmount = manualDiscountValue > 0
      ? Math.min(
          calculatedPrice,
          manualDiscountType === 'percentage'
            ? calculatedPrice * (manualDiscountValue / 100)
            : manualDiscountValue
        )
      : 0
    const finalPrice = Math.max(0, calculatedPrice - manualDiscountAmount)

    const pendingPaymentsRes = await fetch(`${ASAAS_URL}/payments?customer=${company.asaas_customer_id}&status=PENDING&limit=100`, {
      method: 'GET',
      headers: asaasHeaders
    })
    const pendingPaymentsData = await pendingPaymentsRes.json()

    if (!pendingPaymentsRes.ok) {
      throw new Error(`Erro ao buscar faturas pendentes no Asaas: ${pendingPaymentsData.errors?.[0]?.description || 'Falha ao listar pagamentos'}`)
    }

    if (Array.isArray(pendingPaymentsData.data)) {
      for (const payment of pendingPaymentsData.data) {
        await fetch(`${ASAAS_URL}/payments/${payment.id}`, {
          method: 'DELETE',
          headers: asaasHeaders
        })
      }
    }

    let newSubPayload: any = {
      customer: company.asaas_customer_id,
      billingType: 'UNDEFINED',
      value: finalPrice,
      nextDueDate: new Date().toISOString().split('T')[0],
      cycle: cycleAsaas,
      description: `Reativacao: Assinatura Elevatio Vendas - Plano ${planName.toUpperCase()}`
    }

    if (company.applied_coupon_id) {
      const { data: activeCoupon } = await supabaseAdmin
        .from('saas_coupons')
        .select('*')
        .eq('id', company.applied_coupon_id)
        .maybeSingle()

      if (activeCoupon && !hasCouponExpired(company.coupon_start_date, activeCoupon.duration_months)) {
        const subDiscount = buildSubscriptionDiscount(activeCoupon, finalPrice)
        if (subDiscount) {
          newSubPayload.discount = subDiscount
        }
      }
    }

    const newSubRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: asaasHeaders,
      body: JSON.stringify(newSubPayload)
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
        plan_id: planRecord.id ?? null,
        billing_cycle: normalizedBillingCycle,
        canceled_at: null,
        cancel_reason: null,
        fidelity_end_date: null,
        has_fidelity: false,
        price: finalPrice,
        subscription_id: newSubData.id
      })
      .eq('company_id', companyId)

    const payRes = await fetch(`${ASAAS_URL}/payments?subscription=${newSubData.id}`, {
      method: 'GET',
      headers: asaasHeaders
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

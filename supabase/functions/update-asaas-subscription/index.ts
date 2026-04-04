import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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

const incrementCouponUsage = async (supabase: ReturnType<typeof createClient>, coupon: Record<string, any>) => {
  const nextUsageCount = Number(coupon.used_count ?? coupon.current_usages ?? 0) + 1

  let { error } = await supabase
    .from('saas_coupons')
    .update({ used_count: nextUsageCount })
    .eq('id', coupon.id)

  if (error && /used_count/i.test(error.message || '')) {
    const fallback = await supabase
      .from('saas_coupons')
      .update({ current_usages: nextUsageCount })
      .eq('id', coupon.id)

    error = fallback.error
  }

  if (error) throw error
}

serve(async (req) => {
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers')
    || 'authorization, x-client-info, apikey, content-type, accept, accept-encoding, x-supabase-api-version, x-region, prefer'

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': requestedHeaders,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  }

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) throw new Error('Acesso negado: token ausente.')

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new Error('Acesso negado: token ausente.')

    const {
      company_id,
      new_plan,
      billing_cycle,
      has_fidelity,
      addons,
      coupon_code,
      domain_secondary,
      total_price,
    } = await req.json()

    const companyId = normalizeString(company_id)
    const planName = normalizeString(new_plan)
    const billingCycle = normalizeString(billing_cycle)
    const couponCode = normalizeString(coupon_code).toUpperCase()
    const normalizedSecondaryDomain = normalizeString(domain_secondary).toLowerCase()
    const normalizedTotalPrice = Number.isFinite(Number(total_price)) ? Math.max(0, Number(total_price)) : null

    if (!companyId || !planName || !billingCycle) {
      throw new Error('Dados obrigatórios da assinatura não foram informados.')
    }

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) throw new Error('Acesso negado: sessão inválida.')

    const { data: authProfile } = await supabase
      .from('profiles')
      .select('email, full_name, phone, company_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = authProfile?.role === 'super_admin'
    if (!isSuperAdmin && !authProfile?.company_id) {
      throw new Error('Acesso negado: empresa do usuário não encontrada.')
    }

    if (!isSuperAdmin && authProfile?.company_id !== companyId) {
      throw new Error('Acesso negado: empresa inválida.')
    }

    let billingProfile = authProfile
    if (isSuperAdmin && authProfile?.company_id !== companyId) {
      const { data: companyProfile } = await supabase
        .from('profiles')
        .select('email, full_name, phone, company_id, role')
        .eq('company_id', companyId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle()

      if (companyProfile) {
        billingProfile = companyProfile
      }
    }

    const { data: contract } = await supabase
      .from('saas_contracts')
      .select('*')
      .eq('company_id', companyId)
      .single()

    const { data: company } = await supabase
      .from('companies')
      .select('*')
      .eq('id', companyId)
      .single()

    if (!company) throw new Error('Empresa não encontrada.')

    let customerId = company.asaas_customer_id
    let subscriptionId = contract?.subscription_id || company.asaas_subscription_id

    const { data: planRecord } = await supabase
      .from('saas_plans')
      .select('id, has_free_domain')
      .ilike('name', planName)
      .maybeSingle()

    const plan_id = planRecord?.id || null
    const has_free_domain = planRecord?.has_free_domain || false

    let couponRecord: Record<string, any> | null = null
    let shouldIncrementCouponUsage = false
    let shouldPersistCoupon = false
    let shouldClearCoupon = false

    if (couponCode) {
      const { data } = await supabase
        .from('saas_coupons')
        .select('*')
        .eq('code', couponCode)
        .eq('active', true)
        .maybeSingle()

      if (!data) throw new Error('Cupom inválido ou expirado.')

      const maxUses = data.max_uses ?? data.usage_limit
      if (typeof maxUses === 'number' && maxUses > 0 && Number(data.used_count ?? data.current_usages ?? 0) >= maxUses) {
        throw new Error('Cupom esgotado.')
      }

      couponRecord = data as Record<string, any>
      shouldPersistCoupon = true
      shouldIncrementCouponUsage = company.applied_coupon_id !== couponRecord.id
    } else if (company.applied_coupon_id) {
      const { data } = await supabase
        .from('saas_coupons')
        .select('*')
        .eq('id', company.applied_coupon_id)
        .maybeSingle()

      if (data) {
        if (hasCouponExpired(company.coupon_start_date, data.duration_months)) {
          shouldClearCoupon = true
        } else {
          couponRecord = data as Record<string, any>
        }
      } else {
        shouldClearCoupon = true
      }
    }

    if (!customerId) {
      const document = company.document?.replace(/\D/g, '') || company.cpf_cnpj?.replace(/\D/g, '') || ''
      if (document) {
        const searchRes = await fetch(`${ASAAS_URL}/customers?cpfCnpj=${document}`, {
          headers: { 'access_token': ASAAS_API_KEY }
        })
        const searchData = await searchRes.json()
        if (searchData.data && searchData.data.length > 0) customerId = searchData.data[0].id
      }

      if (!customerId) {
        const customerRes = await fetch(`${ASAAS_URL}/customers`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: company.name || billingProfile?.full_name || 'Empresa Sem Nome',
            email: billingProfile?.email || authProfile?.email || user.email || 'email@padrao.com',
            cpfCnpj: company.document || company.cpf_cnpj || '',
            phone: company.phone || billingProfile?.phone || ''
          })
        })

        const customerData = await customerRes.json()
        if (customerData.id) customerId = customerData.id
        else throw new Error('Falha criar cliente Asaas: ' + JSON.stringify(customerData.errors))
      }

      await supabase
        .from('companies')
        .update({ asaas_customer_id: customerId })
        .eq('id', companyId)
    }

    const plans = {
      starter: { price: 54.90 },
      basic: { price: 74.90 },
      profissional: { price: 119.90 },
      business: { price: 179.90 },
      premium: { price: 249.90 },
      elite: { price: 479.90 },
    }

    const planData = plans[planName.toLowerCase() as keyof typeof plans]
    if (!planData) throw new Error('Plano inválido')

    let basePrice = planData.price
    let finalHasFidelity = has_fidelity
    let fidelityEndDate = contract?.fidelity_end_date || null

    if (billingCycle === 'yearly') {
      basePrice = basePrice * 12 * 0.85
      finalHasFidelity = false
    } else if (has_fidelity) {
      basePrice = basePrice * 0.90
      if (!fidelityEndDate || new Date(fidelityEndDate) < new Date()) {
        const futureDate = new Date()
        futureDate.setFullYear(futureDate.getFullYear() + 1)
        fidelityEndDate = futureDate.toISOString()
      }
    }

    const manualDiscountValue = Number(company.manual_discount_value ?? 0)
    const manualDiscountType = company.manual_discount_type
    const manualDiscountAmount = manualDiscountValue > 0
      ? Math.min(
          basePrice,
          manualDiscountType === 'percentage'
            ? basePrice * (manualDiscountValue / 100)
            : manualDiscountValue
        )
      : 0

    const recurringPrice = Math.max(0, basePrice - manualDiscountAmount)
    const subscriptionDiscount = buildSubscriptionDiscount(couponRecord, recurringPrice)
    if (couponRecord && !subscriptionDiscount) throw new Error('Tipo de cupom inválido.')

    const couponDiscountAmount = couponRecord
      ? Math.min(
          recurringPrice,
          (couponRecord.discount_type ?? couponRecord.type) === 'percentage'
            ? recurringPrice * (Number(couponRecord.discount_value ?? couponRecord.value ?? 0) / 100)
            : (couponRecord.discount_type ?? couponRecord.type) === 'free_month'
              ? recurringPrice
              : Number(couponRecord.discount_value ?? couponRecord.value ?? 0)
        )
      : 0

    let domainPriceToCharge = 0
    let extraDescription = ""
    let domainStatusToSave = contract?.domain_status || 'pending'

    const isCom = (company.domain || '').endsWith('.com')
    const primaryPrice = isCom ? 73.00 : 53.00
    const secondaryPrice = normalizedSecondaryDomain
      ? (normalizedSecondaryDomain.endsWith('.com') ? 73.00 : 53.00)
      : (isCom ? 53.00 : 73.00)

    if (addons?.buyDomainBr && !(billingCycle === 'yearly' && has_free_domain)) {
      domainPriceToCharge += primaryPrice
      extraDescription += ` + Registro de Domínio Principal`
      domainStatusToSave = 'pending'
    } else if (billingCycle === 'yearly' && has_free_domain) {
      domainStatusToSave = 'pending'
    }

    if (addons?.buyDomainCom) {
      domainPriceToCharge += secondaryPrice
      extraDescription += ` + Domínio Alternativo (${normalizedSecondaryDomain || '.com'})`
      domainStatusToSave = 'pending'
    }

    const targetCycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY'
    const baseDescription = `Plano ${planName.toUpperCase()} - Elevatio Vendas (${targetCycle === 'YEARLY' ? 'Anual' : 'Mensal'})`
    let newSubscriptionId = subscriptionId

    if (subscriptionId) {
      const subGet = await fetch(`${ASAAS_URL}/subscriptions/${subscriptionId}`, {
        headers: { 'access_token': ASAAS_API_KEY }
      })
      const subData = await subGet.json()

      if (subData && !subData.errors) {
        if (subData.cycle !== targetCycle || subData.status === 'INACTIVE') {
          await fetch(`${ASAAS_URL}/subscriptions/${subscriptionId}`, {
            method: 'DELETE',
            headers: { 'access_token': ASAAS_API_KEY }
          })

          const createPayload: Record<string, unknown> = {
            customer: customerId,
            billingType: subData.billingType || 'UNDEFINED',
            nextDueDate: subData.nextDueDate,
            value: recurringPrice,
            cycle: targetCycle,
            description: baseDescription,
          }

          if (subscriptionDiscount) {
            createPayload.discount = subscriptionDiscount
          }

          const createRes = await fetch(`${ASAAS_URL}/subscriptions`, {
            method: 'POST',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(createPayload)
          })
          const createData = await createRes.json()
          if (!createData.errors) newSubscriptionId = createData.id
        } else {
          const updatePayload: Record<string, unknown> = {
            value: recurringPrice,
            cycle: targetCycle,
            description: baseDescription,
            updatePendingCharge: true,
            updatePendingPayments: true,
            discount: subscriptionDiscount ?? { value: 0, type: 'FIXED' },
          }

          await fetch(`${ASAAS_URL}/subscriptions/${subscriptionId}`, {
            method: 'PUT',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
          })
        }
      }
    } else {
      let nextDueDate = new Date()
      if (company.trial_ends_at && new Date(company.trial_ends_at) > new Date()) nextDueDate = new Date(company.trial_ends_at)
      else nextDueDate.setDate(nextDueDate.getDate() + 7)

      const createPayload: Record<string, unknown> = {
        customer: customerId,
        billingType: 'UNDEFINED',
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        value: recurringPrice,
        cycle: targetCycle,
        description: baseDescription,
      }

      if (subscriptionDiscount) {
        createPayload.discount = subscriptionDiscount
      }

      const createRes = await fetch(`${ASAAS_URL}/subscriptions`, {
        method: 'POST',
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify(createPayload)
      })
      const createData = await createRes.json()
      if (!createData.errors) newSubscriptionId = createData.id
    }

    let keptPaymentId = null
    if (newSubscriptionId) {
      const paymentsRes = await fetch(`${ASAAS_URL}/payments?subscription=${newSubscriptionId}&status=PENDING`, {
        headers: { 'access_token': ASAAS_API_KEY }
      })
      const paymentsData = await paymentsRes.json()

      if (paymentsData.data && paymentsData.data.length > 0) {
        const currentPayment = paymentsData.data.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0]
        keptPaymentId = currentPayment.id

        const finalPaymentValue = normalizedTotalPrice ?? Math.max(0, recurringPrice + domainPriceToCharge - couponDiscountAmount)
        const finalPaymentDesc = baseDescription + extraDescription

        await fetch(`${ASAAS_URL}/payments/${currentPayment.id}`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: finalPaymentValue, description: finalPaymentDesc })
        })
      }
    }

    if (customerId) {
      const allPaymentsRes = await fetch(`${ASAAS_URL}/payments?customer=${customerId}&status=PENDING`, {
        headers: { 'access_token': ASAAS_API_KEY }
      })
      const allPaymentsData = await allPaymentsRes.json()
      if (allPaymentsData?.data) {
        for (const payment of allPaymentsData.data) {
          if (payment.id !== keptPaymentId) {
            await fetch(`${ASAAS_URL}/payments/${payment.id}`, {
              method: 'DELETE',
              headers: { 'access_token': ASAAS_API_KEY }
            })
          }
        }
      }

      const allSubsRes = await fetch(`${ASAAS_URL}/subscriptions?customer=${customerId}&status=ACTIVE`, {
        headers: { 'access_token': ASAAS_API_KEY }
      })
      const allSubsData = await allSubsRes.json()
      if (allSubsData?.data) {
        for (const sub of allSubsData.data) {
          if (sub.id !== newSubscriptionId) {
            await fetch(`${ASAAS_URL}/subscriptions/${sub.id}`, {
              method: 'DELETE',
              headers: { 'access_token': ASAAS_API_KEY }
            })
          }
        }
      }
    }

    await supabase
      .from('saas_contracts')
      .update({
        plan_name: planName,
        plan_id,
        billing_cycle: billingCycle,
        has_fidelity: finalHasFidelity,
        fidelity_end_date: fidelityEndDate,
        subscription_id: newSubscriptionId,
        price: recurringPrice,
        domain_status: domainStatusToSave,
      })
      .eq('company_id', companyId)

    const companyUpdate: Record<string, unknown> = {
      plan: planName,
      asaas_subscription_id: newSubscriptionId,
    }

    if (normalizedSecondaryDomain) {
      companyUpdate.domain_secondary = normalizedSecondaryDomain
    }

    if (shouldPersistCoupon && couponRecord?.id) {
      companyUpdate.applied_coupon_id = couponRecord.id
      companyUpdate.coupon_start_date = company.applied_coupon_id === couponRecord.id && company.coupon_start_date
        ? company.coupon_start_date
        : new Date().toISOString()
    } else if (shouldClearCoupon) {
      companyUpdate.applied_coupon_id = null
      companyUpdate.coupon_start_date = null
    }

    await supabase
      .from('companies')
      .update(companyUpdate)
      .eq('id', companyId)

    if (shouldIncrementCouponUsage && couponRecord) {
      await incrementCouponUsage(supabase, couponRecord)
    }

    return new Response(JSON.stringify({ success: true, subscription_id: newSubscriptionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400
    })
  }
})

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getAsaasApiUrl, getErrorStatus, requireBillingCompanyAccess, createSupabaseAdmin } from '../_shared/billing-security.ts'

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
    const {
      company_id,
      new_plan,
      billing_cycle,
      has_fidelity,
      addons,
      coupon_code,
      domain_secondary,
    } = await req.json()

    const companyId = normalizeString(company_id)
    const planName = normalizeString(new_plan)
    const billingCycle = normalizeString(billing_cycle)
    const couponCode = normalizeString(coupon_code).toUpperCase()
    const normalizedSecondaryDomain = normalizeString(domain_secondary).toLowerCase()

    if (!companyId || !planName || !billingCycle) {
      throw new Error('Dados obrigatorios da assinatura nao foram informados.')
    }

    const { user, profile: authProfile, isSuperAdmin } = await requireBillingCompanyAccess(req, companyId)

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!
    const ASAAS_URL = getAsaasApiUrl()
    const asaasHeaders = {
      'access_token': ASAAS_API_KEY,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Elevatio-SaaS/1.0 (Supabase Edge Functions)'
    }

    const supabase = createSupabaseAdmin()

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

    if (!company) throw new Error('Empresa nao encontrada.')

    let customerId = company.asaas_customer_id
    let subscriptionId = contract?.subscription_id || company.asaas_subscription_id

    const { data: planRecord } = await supabase
      .from('saas_plans')
      .select('id, has_free_domain, price_monthly, price_yearly, price')
      .ilike('name', planName)
      .maybeSingle()

    const plan_id = planRecord?.id || null
    const has_free_domain = planRecord?.has_free_domain || false

    let couponRecord: Record<string, any> | null = null
    let shouldPersistCoupon = false
    let shouldClearCoupon = false

    if (couponCode) {
      const { data } = await supabase
        .from('saas_coupons')
        .select('*')
        .eq('code', couponCode)
        .eq('active', true)
        .maybeSingle()

      if (!data) throw new Error('Cupom invalido ou expirado.')

      const maxUses = Number(data.max_uses ?? data.usage_limit ?? 0)
      if (maxUses > 0 && Number(data.used_count ?? data.current_uses ?? data.current_usages ?? 0) >= maxUses) {
        throw new Error('Cupom esgotado.')
      }

      couponRecord = data as Record<string, any>
      shouldPersistCoupon = true
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
          headers: asaasHeaders
        })
        const searchData = await searchRes.json()
        if (searchData.data && searchData.data.length > 0) customerId = searchData.data[0].id
      }

      if (!customerId) {
        const customerRes = await fetch(`${ASAAS_URL}/customers`, {
          method: 'POST',
          headers: asaasHeaders,
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

    const monthlyPlanPrice = Number(planRecord?.price_monthly ?? planRecord?.price ?? 0)
    const yearlyPlanPrice = Number(planRecord?.price_yearly ?? 0)
    if (!planRecord || !Number.isFinite(monthlyPlanPrice) || monthlyPlanPrice < 0) {
      throw new Error('Plano invalido ou sem preco configurado.')
    }

    let basePrice = monthlyPlanPrice
    let finalHasFidelity = has_fidelity
    let fidelityEndDate = contract?.fidelity_end_date || null

    if (billingCycle === 'yearly') {
      basePrice = Number.isFinite(yearlyPlanPrice) && yearlyPlanPrice > 0
        ? yearlyPlanPrice
        : monthlyPlanPrice * 12
      finalHasFidelity = false
    } else if (has_fidelity) {
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
    if (couponRecord && !subscriptionDiscount) throw new Error('Tipo de cupom invalido.')

    let domainPriceToCharge = 0
    let extraDescription = ""
    let domainStatusToSave = contract?.domain_status || 'pending'

    const isCom = (company.domain || '').endsWith('.com')
    const primaryPrice = isCom ? 89.00 : 53.00
    const secondaryPrice = normalizedSecondaryDomain
      ? (normalizedSecondaryDomain.endsWith('.com') ? 89.00 : 53.00)
      : (isCom ? 53.00 : 89.00)

    if (addons?.buyDomainBr && !(billingCycle === 'yearly' && has_free_domain)) {
      domainPriceToCharge += primaryPrice
      extraDescription += ` + Registro de Dominio Principal`
      domainStatusToSave = 'pending'
    } else if (billingCycle === 'yearly' && has_free_domain) {
      domainStatusToSave = 'pending'
    }

    if (addons?.buyDomainCom) {
      domainPriceToCharge += secondaryPrice
      extraDescription += ` + Dominio Alternativo (${normalizedSecondaryDomain || '.com'})`
      domainStatusToSave = 'pending'
    }

    const targetCycle = billingCycle === 'yearly' ? 'YEARLY' : 'MONTHLY'
    const baseDescription = `Plano ${planName.toUpperCase()} - Elevatio Vendas (${targetCycle === 'YEARLY' ? 'Anual' : 'Mensal'})`
    let newSubscriptionId = subscriptionId
    let proRataChargeId = null

    if (subscriptionId) {
      const subGet = await fetch(`${ASAAS_URL}/subscriptions/${subscriptionId}`, {
        headers: asaasHeaders
      })
      const subData = await subGet.json()

      if (subData && !subData.errors) {
        const currentSubscriptionValue = Number(subData.value ?? 0)

        // Cobra a diferenca proporcional imediatamente quando o cliente faz upgrade no mesmo ciclo.
        if (
          subData.status === 'ACTIVE'
          && recurringPrice > currentSubscriptionValue
          && subData.cycle === targetCycle
        ) {
          const nextDueDate = new Date(subData.nextDueDate)
          const today = new Date()
          const timeDiff = nextDueDate.getTime() - today.getTime()
          const daysRemaining = Math.max(0, Math.ceil(timeDiff / (1000 * 3600 * 24)))

          const cycleDays = targetCycle === 'YEARLY' ? 365 : 30
          const oldDailyRate = currentSubscriptionValue / cycleDays
          const newDailyRate = recurringPrice / cycleDays
          const dailyDiff = newDailyRate - oldDailyRate
          const proRataValue = Math.floor(dailyDiff * daysRemaining * 100) / 100

          if (proRataValue >= 5.00) {
            const proRataPayload = {
              customer: customerId,
              billingType: subData.billingType || 'UNDEFINED',
              dueDate: today.toISOString().split('T')[0],
              value: proRataValue,
              description: `Diferenca proporcional (Upgrade) para o Plano ${planName.toUpperCase()} (${daysRemaining} dias restantes)`,
            }

            const prRes = await fetch(`${ASAAS_URL}/payments`, {
              method: 'POST',
              headers: asaasHeaders,
              body: JSON.stringify(proRataPayload)
            })
            const prData = await prRes.json()
            if (!prData.errors) proRataChargeId = prData.id
          }
        }

        if (subData.cycle !== targetCycle || subData.status === 'INACTIVE') {
          await fetch(`${ASAAS_URL}/subscriptions/${subscriptionId}`, {
            method: 'DELETE',
            headers: asaasHeaders
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
            headers: asaasHeaders,
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
            headers: asaasHeaders,
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
        headers: asaasHeaders,
        body: JSON.stringify(createPayload)
      })
      const createData = await createRes.json()
      if (!createData.errors) newSubscriptionId = createData.id
    }

    let keptPaymentId = null
    if (newSubscriptionId) {
      const paymentsRes = await fetch(`${ASAAS_URL}/payments?subscription=${newSubscriptionId}&status=PENDING`, { headers: asaasHeaders })
      const paymentsData = await paymentsRes.json()
      if (paymentsData.data && paymentsData.data.length > 0) {
        keptPaymentId = paymentsData.data.sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0].id
      }
    }

    if (keptPaymentId) {
      const updatePaymentPayload: any = {
        value: recurringPrice + domainPriceToCharge,
        description: extraDescription ? `${baseDescription}${extraDescription}` : baseDescription
      }
      
      if (subscriptionDiscount) {
        updatePaymentPayload.discount = subscriptionDiscount
      } else {
        updatePaymentPayload.discount = { value: 0, type: 'PERCENTAGE' }
      }

      await fetch(`${ASAAS_URL}/payments/${keptPaymentId}`, {
        method: 'PUT',
        headers: asaasHeaders,
        body: JSON.stringify(updatePaymentPayload)
      })
    }

    if (customerId) {
      // Pequeno delay para o Asaas gerar a fatura da sub
      await new Promise(resolve => setTimeout(resolve, 800))

      const allPaymentsRes = await fetch(`${ASAAS_URL}/payments?customer=${customerId}&status=PENDING&limit=100`, { headers: asaasHeaders })
      const allPaymentsData = await allPaymentsRes.json()

      if (allPaymentsData?.data) {
        for (const payment of allPaymentsData.data) {
          if (payment.id !== keptPaymentId && payment.id !== proRataChargeId) {
            await fetch(`${ASAAS_URL}/payments/${payment.id}`, { method: 'DELETE', headers: asaasHeaders })
          }
        }
      }

      const allSubsRes = await fetch(`${ASAAS_URL}/subscriptions?customer=${customerId}&status=ACTIVE`, {
        headers: asaasHeaders
      })
      const allSubsData = await allSubsRes.json()
      if (allSubsData?.data) {
        for (const sub of allSubsData.data) {
          if (sub.id !== newSubscriptionId) {
            await fetch(`${ASAAS_URL}/subscriptions/${sub.id}`, {
              method: 'DELETE',
              headers: asaasHeaders
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
      if (company.applied_coupon_id !== couponRecord.id || !company.coupon_start_date) {
        companyUpdate.coupon_start_date = null
      }
    } else if (shouldClearCoupon) {
      companyUpdate.applied_coupon_id = null
      companyUpdate.coupon_start_date = null
    }

    await supabase
      .from('companies')
      .update(companyUpdate)
      .eq('id', companyId)

    return new Response(JSON.stringify({ success: true, subscription_id: newSubscriptionId }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: getErrorStatus(error)
    })
  }
})

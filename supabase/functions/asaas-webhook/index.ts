import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getAsaasApiUrl } from '../_shared/billing-security.ts'

const jsonHeaders = { "Content-Type": "application/json" }

const ACTIVE_PAYMENT_EVENTS = new Set(['PAYMENT_RECEIVED', 'PAYMENT_CONFIRMED'])

const PLAN_STATUS_BY_EVENT: Record<string, string> = {
  PAYMENT_RECEIVED: 'active',
  PAYMENT_CONFIRMED: 'active',
  PAYMENT_OVERDUE: 'past_due',
  PAYMENT_CHARGEBACK_REQUESTED: 'past_due',
  PAYMENT_CHARGEBACK_DISPUTE: 'past_due',
  PAYMENT_RECEIVED_IN_CASH_UNDONE: 'past_due',
  PAYMENT_DELETED: 'canceled',
  PAYMENT_REFUNDED: 'canceled',
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

const normalizePaymentStatus = (event: string, payment: Record<string, any>) => {
  const status = String(payment.status ?? '').trim()
  if (status) return status.toUpperCase()

  if (event === 'PAYMENT_CONFIRMED') return 'CONFIRMED'
  if (event === 'PAYMENT_RECEIVED') return 'RECEIVED'
  if (event === 'PAYMENT_OVERDUE') return 'OVERDUE'
  if (event === 'PAYMENT_DELETED') return 'DELETED'
  if (event === 'PAYMENT_REFUNDED') return 'REFUNDED'

  return event.replace(/^PAYMENT_/, '')
}

const getReferenceMonth = (dueDate: unknown) => {
  if (typeof dueDate !== 'string' || dueDate.length < 7) return null
  return `${dueDate.slice(0, 7)}-01`
}

const upsertSaasPayment = async (
  supabaseAdmin: ReturnType<typeof createClient>,
  companyId: string,
  event: string,
  payment: Record<string, any>
) => {
  if (!payment.id) return

  const paidAt = payment.paymentDate
    ?? payment.confirmedDate
    ?? payment.clientPaymentDate
    ?? (ACTIVE_PAYMENT_EVENTS.has(event) ? new Date().toISOString() : null)

  const payload = {
    company_id: companyId,
    amount: Number(payment.value ?? payment.netValue ?? 0),
    status: normalizePaymentStatus(event, payment),
    asaas_payment_id: payment.id,
    reference_month: getReferenceMonth(payment.dueDate),
    due_date: payment.dueDate ?? null,
    paid_at: paidAt,
  }

  const { error } = await supabaseAdmin
    .from('saas_payments')
    .upsert(payload, {
      onConflict: 'asaas_payment_id',
      ignoreDuplicates: false
    })

  if (error) throw error
}

const incrementCouponUsage = async (supabaseAdmin: ReturnType<typeof createClient>, couponId: string) => {
  const { data: couponData, error: couponError } = await supabaseAdmin
    .from('saas_coupons')
    .select('*')
    .eq('id', couponId)
    .maybeSingle()

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
  try {
    const webhookSecret = Deno.env.get('ASAAS_WEBHOOK_SECRET')?.trim()
    const receivedToken = req.headers.get('asaas-access-token')?.trim()

    if (!webhookSecret || !receivedToken || receivedToken !== webhookSecret) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: jsonHeaders,
        status: 401
      })
    }

    const body = await req.json()
    const event = body.event
    const payment = body.payment

    if (!event || !payment) {
      return new Response("Ignorado: Sem dados de pagamento.", { status: 200 })
    }

    console.log(`Recebido evento do Asaas: ${event} para o cliente ${payment.customer}`)

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    if (payment?.id) {
      const incomingStatus = normalizePaymentStatus(event, payment)
      const { data: existingPayment } = await supabaseAdmin
        .from('saas_payments')
        .select('status')
        .eq('asaas_payment_id', payment.id)
        .maybeSingle()

      if (existingPayment && existingPayment.status === incomingStatus) {
        console.log(`[WEBHOOK] Evento duplicado ignorado: ${event} para pagamento ${payment.id}`)
        return new Response(JSON.stringify({ success: true, skipped: true }), {
          headers: jsonHeaders,
          status: 200
        })
      }
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()

    const { data: company } = await supabaseAdmin
      .from('companies')
      .select('id, applied_coupon_id, coupon_start_date, asaas_subscription_id, trial_ends_at')
      .eq('asaas_customer_id', payment.customer)
      .single()

    if (company) {
      await upsertSaasPayment(supabaseAdmin, company.id, event, payment)

      const nextPlanStatus = PLAN_STATUS_BY_EVENT[event]
      if (nextPlanStatus) {
        const companyStatusUpdate: Record<string, unknown> = { plan_status: nextPlanStatus }
        if (ACTIVE_PAYMENT_EVENTS.has(event)) {
          companyStatusUpdate.trial_ends_at = null
        }
        await supabaseAdmin.from('companies').update(companyStatusUpdate).eq('id', company.id)

        const contractStatusMap: Record<string, string> = {
          active: 'active',
          past_due: 'past_due',
          canceled: 'canceled',
        }
        const contractStatus = contractStatusMap[nextPlanStatus]

        if (contractStatus) {
          const contractUpdate: Record<string, unknown> = { status: contractStatus }

          if (contractStatus === 'active') {
            contractUpdate.canceled_at = null
            contractUpdate.cancel_reason = null
          } else if (contractStatus === 'canceled') {
            contractUpdate.canceled_at = new Date().toISOString()
            contractUpdate.cancel_reason = `Webhook Asaas: ${event}`
          }

          await supabaseAdmin
            .from('saas_contracts')
            .update(contractUpdate)
            .eq('company_id', company.id)

          console.log(`[WEBHOOK] Contrato da empresa ${company.id} -> ${contractStatus} (evento: ${event})`)
        }
      }
    }

    if (ACTIVE_PAYMENT_EVENTS.has(event) && company) {
      // ==========================================
      // ANCORA DE CICLO (PRIMEIRO PAGAMENTO)
      // Se o cliente pagou e ainda tinha trial_ends_at,
      // a proxima cobranca no Asaas tem que ser 1 mes/ano a partir de hoje.
      // ==========================================
      if (company.trial_ends_at && company.asaas_subscription_id) {
        try {
          const subRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
            headers: { 'access_token': ASAAS_API_KEY! }
          })
          const subData = await subRes.json()

          if (subData && !subData.errors && subData.status === 'ACTIVE') {
            const nextDate = new Date()
            if (subData.cycle === 'YEARLY') {
              nextDate.setFullYear(nextDate.getFullYear() + 1)
            } else {
              nextDate.setMonth(nextDate.getMonth() + 1)
            }

            await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
              method: 'PUT',
              headers: {
                'access_token': ASAAS_API_KEY!,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                nextDueDate: nextDate.toISOString().split('T')[0],
                updatePendingCharge: true
              })
            })
            console.log(`[WEBHOOK] Ciclo da assinatura ${company.asaas_subscription_id} ancorado a partir de hoje.`)
          }
        } catch (err) {
          console.error('[WEBHOOK] Erro ao ancorar o ciclo da assinatura:', err)
        }
      }

      if (company.applied_coupon_id) {
        const { data: coupon } = await supabaseAdmin
          .from('saas_coupons')
          .select('*')
          .eq('id', company.applied_coupon_id)
          .maybeSingle()

        if (coupon) {
          if (!company.coupon_start_date) {
            const confirmedAt = payment.paymentDate ?? payment.confirmedDate ?? new Date().toISOString()
            await incrementCouponUsage(supabaseAdmin, company.applied_coupon_id)
            await supabaseAdmin
              .from('companies')
              .update({ coupon_start_date: confirmedAt })
              .eq('id', company.id)
            company.coupon_start_date = confirmedAt
            console.log(`[WEBHOOK] Cupom ${company.applied_coupon_id} iniciado para empresa ${company.id}.`)
          }

          if (company.coupon_start_date && hasCouponExpired(company.coupon_start_date, coupon.duration_months)) {
            if (company.asaas_subscription_id && ASAAS_API_KEY) {
              const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
                method: 'PUT',
                headers: {
                  'access_token': ASAAS_API_KEY,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  discount: { value: 0, type: 'FIXED' },
                  updatePendingCharge: true,
                  updatePendingPayments: true
                })
              })

              if (!asaasRes.ok) {
                const errText = await asaasRes.text()
                console.error(`Erro ao remover desconto da assinatura Asaas: ${errText}`)
              }
            }

            await supabaseAdmin
              .from('companies')
              .update({ applied_coupon_id: null, coupon_start_date: null })
              .eq('id', company.id)

            console.log(`[WEBHOOK] Cupom recorrente expirado e removido da empresa ${company.id}.`)
          }
        }
      }

      console.log(`Empresa ${company.id} ativada com sucesso!`)
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: jsonHeaders,
      status: 200
    })
  } catch (error: any) {
    console.error("Erro no Webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { headers: jsonHeaders, status: 400 })
  }
})

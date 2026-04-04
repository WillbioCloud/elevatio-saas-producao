import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
  try {
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

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id, applied_coupon_id, coupon_start_date, asaas_subscription_id')
        .eq('asaas_customer_id', payment.customer)
        .single()

      if (company) {
        await supabaseAdmin
          .from('companies')
          .update({ plan_status: 'active', trial_ends_at: null })
          .eq('id', company.id)

        const { data: contractInfo } = await supabaseAdmin
          .from('saas_contracts')
          .select('billing_cycle')
          .eq('company_id', company.id)
          .single()

        const today = new Date()
        const nextRenewal = new Date(today)

        if (contractInfo?.billing_cycle === 'yearly') {
          nextRenewal.setFullYear(nextRenewal.getFullYear() + 1)
        } else {
          nextRenewal.setMonth(nextRenewal.getMonth() + 1)
        }

        await supabaseAdmin
          .from('saas_contracts')
          .update({
            status: 'active',
            start_date: today.toISOString(),
            end_date: nextRenewal.toISOString()
          })
          .eq('company_id', company.id)

        if (event === 'PAYMENT_RECEIVED' && company.applied_coupon_id && company.coupon_start_date) {
          const { data: coupon } = await supabaseAdmin
            .from('saas_coupons')
            .select('duration_months')
            .eq('id', company.applied_coupon_id)
            .maybeSingle()

          if (coupon && hasCouponExpired(company.coupon_start_date, coupon.duration_months)) {
            if (company.asaas_subscription_id) {
              const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
                method: 'PUT',
                headers: {
                  'access_token': ASAAS_API_KEY!,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                  discount: { value: 0, type: 'FIXED' },
                  updatePendingCharge: true,
                  updatePendingPayments: true
                })
              })

              const asaasText = await asaasRes.text()
              let asaasData: Record<string, any> | null = null
              if (asaasText) {
                try {
                  asaasData = JSON.parse(asaasText)
                } catch (_error) {
                  asaasData = null
                }
              }

              if (!asaasRes.ok) {
                throw new Error(`Erro ao remover desconto da assinatura Asaas: ${asaasData?.errors?.[0]?.description || asaasText}`)
              }
            }

            await supabaseAdmin
              .from('companies')
              .update({ applied_coupon_id: null, coupon_start_date: null })
              .eq('id', company.id)

            console.log(`Cupom recorrente removido da empresa ${company.id}.`)
          }
        }

        console.log(`Empresa ${company.id} ativada com sucesso!`)
      }
    }

    if (event === 'PAYMENT_OVERDUE') {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('asaas_customer_id', payment.customer)
        .single()

      if (company) {
        await supabaseAdmin
          .from('companies')
          .update({ plan_status: 'past_due' })
          .eq('id', company.id)

        console.log(`Empresa ${company.id} bloqueada por inadimplência.`)
      }
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
      status: 200
    })
  } catch (error: any) {
    console.error("Erro no Webhook:", error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})

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
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id, reason, other_reason } = await req.json()
    const companyId = normalizeString(company_id)

    if (!companyId) throw new Error("ID da empresa nao fornecido.")

    await requireBillingCompanyAccess(req, companyId)

    const supabaseAdmin = createSupabaseAdmin()

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('asaas_subscription_id')
      .eq('id', companyId)
      .single()

    if (companyError || !company?.asaas_subscription_id) {
      throw new Error('Assinatura nao encontrada no Asaas.')
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()

    const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
      method: 'DELETE',
      headers: { 'access_token': ASAAS_API_KEY! }
    })

    const asaasData = await asaasRes.json()

    if (!asaasRes.ok) {
      throw new Error(`Erro no Asaas: ${asaasData.errors?.[0]?.description || 'Falha ao cancelar'}`)
    }

    const finalReason = reason === 'Outro' ? `Outro: ${other_reason}` : reason

    const { error: contractUpdateError } = await supabaseAdmin
      .from('saas_contracts')
      .update({
        status: 'canceled',
        cancel_reason: finalReason,
        canceled_at: new Date().toISOString()
      })
      .eq('company_id', companyId)

    if (contractUpdateError) throw contractUpdateError

    const { error: companyUpdateError } = await supabaseAdmin
      .from('companies')
      .update({ plan_status: 'canceled' })
      .eq('id', companyId)

    if (companyUpdateError) throw companyUpdateError

    return new Response(
      JSON.stringify({ success: true }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: getErrorStatus(error),
      }
    )
  }
})

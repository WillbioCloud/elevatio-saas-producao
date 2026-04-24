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

const hasOpenInvoiceStatus = (status: unknown) => {
  const normalizedStatus = normalizeString(status).toUpperCase()
  return normalizedStatus === 'PENDING' || normalizedStatus === 'OVERDUE'
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id } = await req.json()
    const companyId = normalizeString(company_id)

    if (!companyId) throw new Error("ID da empresa nao informado.")

    await requireBillingCompanyAccess(req, companyId)

    const supabaseAdmin = createSupabaseAdmin()

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('asaas_customer_id')
      .eq('id', companyId)
      .single()

    if (companyError || !company?.asaas_customer_id) {
      throw new Error('Empresa nao possui um cadastro financeiro no Asaas.')
    }

    // ===========================================================
    // PATCH C: Verificar se a fatura já foi finalizada pelo backend
    // Previne race condition entre update-subscription e get-payment-link.
    // ===========================================================
    const { data: contract } = await supabaseAdmin
      .from('saas_contracts')
      .select('invoice_ready, kept_payment_id')
      .eq('company_id', companyId)
      .maybeSingle()

    if (contract && contract.invoice_ready === false) {
      return new Response(
        JSON.stringify({ retry: true, message: 'Fatura ainda está sendo processada. Tente novamente em instantes.' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 202 }
      )
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()
    const asaasHeaders = {
      'access_token': ASAAS_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Elevatio-SaaS/1.0 (Supabase Edge Functions)'
    }

    const payRes = await fetch(`${ASAAS_URL}/payments?customer=${company.asaas_customer_id}&status=PENDING&limit=100`, {
      method: 'GET',
      headers: asaasHeaders
    })

    const payData = await payRes.json()

    if (!payRes.ok) throw new Error(`Erro na API Asaas: ${payData.errors?.[0]?.description}`)

    const openInvoices = Array.isArray(payData.data)
      ? payData.data
        .filter((p: any) => hasOpenInvoiceStatus(p?.status))
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      : []

    if (openInvoices.length === 0) {
      throw new Error('Nenhuma fatura encontrada.')
    }

    // Prioridade 1: link direto pelo kept_payment_id gravado pelo update-subscription
    if (contract?.kept_payment_id) {
      const directPayRes = await fetch(`${ASAAS_URL}/payments/${contract.kept_payment_id}`, {
        method: 'GET',
        headers: asaasHeaders
      })
      if (directPayRes.ok) {
        const directPayData = await directPayRes.json()
        if (directPayData?.invoiceUrl && hasOpenInvoiceStatus(directPayData.status)) {
          return new Response(
            JSON.stringify({ success: true, checkoutUrl: directPayData.invoiceUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
          )
        }
      }
    }

    // Prioridade 2: Busca geral por faturas abertas vinculadas a assinatura
    const subInvoice = openInvoices.find((p: any) => p.subscription)
    const invoiceUrl = subInvoice ? subInvoice.invoiceUrl : openInvoices[0].invoiceUrl

    return new Response(
      JSON.stringify({ success: true, checkoutUrl: invoiceUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: getErrorStatus(error) }
    )
  }
})

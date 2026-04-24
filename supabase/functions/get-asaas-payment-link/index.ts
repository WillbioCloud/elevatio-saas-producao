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

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()
    const asaasHeaders = {
      'access_token': ASAAS_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Elevatio-SaaS/1.0 (Supabase Edge Functions)'
    }

    const payRes = await fetch(`${ASAAS_URL}/payments?customer=${company.asaas_customer_id}`, {
      method: 'GET',
      headers: asaasHeaders
    })

    const payData = await payRes.json()

    if (!payRes.ok) throw new Error(`Erro na API Asaas: ${payData.errors?.[0]?.description}`)

    const openInvoices = Array.isArray(payData.data)
      ? payData.data
        .filter((payment: any) => hasOpenInvoiceStatus(payment?.status))
        .sort((a: any, b: any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())
      : []

    if (openInvoices.length === 0) {
      throw new Error('Nenhuma fatura pendente ou vencida encontrada. O plano pode ja estar pago.')
    }

    const invoiceUrl = openInvoices[0].invoiceUrl

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

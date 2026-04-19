import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'
import { getAsaasApiUrl } from '../_shared/billing-security.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

type RequestPayload = {
  company_id?: unknown
  customer_id?: unknown
}

const normalizeCustomerId = (value: unknown) => {
  if (typeof value !== 'string') return null

  const normalized = value.trim()
  if (!normalized || normalized === 'undefined' || normalized === 'null') {
    return null
  }

  return normalized
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const authHeader = req.headers.get('Authorization') ?? req.headers.get('authorization')
    if (!authHeader) throw new Error('Acesso negado: token ausente.')

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new Error('Acesso negado: token ausente.')

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error('Acesso negado: sessao invalida.')

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = getAsaasApiUrl()

    const body: RequestPayload = await req.json().catch(() => ({}))
    const requestedCompanyId = typeof body.company_id === 'string' ? body.company_id.trim() : ''
    let customer_id = normalizeCustomerId(body.customer_id)

    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('company_id, role')
      .eq('id', user.id)
      .maybeSingle()

    const isSuperAdmin = profile?.role === 'super_admin'

    if (!isSuperAdmin && !profile?.company_id) {
      throw new Error('Acesso negado: empresa do usuario nao encontrada.')
    }

    if (!isSuperAdmin) {
      const { data: ownCompany, error: ownCompanyError } = await supabaseAdmin
        .from('companies')
        .select('id, asaas_customer_id')
        .eq('id', profile.company_id)
        .maybeSingle()

      if (ownCompanyError || !ownCompany?.asaas_customer_id) {
        throw new Error('Cliente Asaas da empresa nao encontrado.')
      }

      if (requestedCompanyId && requestedCompanyId !== ownCompany.id) {
        throw new Error('Acesso negado: empresa invalida.')
      }

      if (customer_id && customer_id !== ownCompany.asaas_customer_id) {
        throw new Error('Acesso negado: customer_id invalido.')
      }

      customer_id = ownCompany.asaas_customer_id
    }

    if (isSuperAdmin && requestedCompanyId && !customer_id) {
      const { data: scopedCompany, error: scopedCompanyError } = await supabaseAdmin
        .from('companies')
        .select('asaas_customer_id')
        .eq('id', requestedCompanyId)
        .maybeSingle()

      if (scopedCompanyError || !scopedCompany?.asaas_customer_id) {
        throw new Error('Cliente Asaas da empresa nao encontrado.')
      }

      customer_id = scopedCompany.asaas_customer_id
    }

    let endpoint = `${ASAAS_URL}/payments?limit=100`
    if (customer_id) {
      endpoint = `${ASAAS_URL}/payments?customer=${encodeURIComponent(customer_id)}&limit=100`
    }

    const asaasHeaders = {
      'access_token': ASAAS_API_KEY!,
      'Content-Type': 'application/json',
      'Accept': 'application/json',
      'User-Agent': 'Elevatio-SaaS/1.0 (Supabase Edge Functions)'
    }

    const payRes = await fetch(endpoint, {
      method: 'GET',
      headers: asaasHeaders,
    })

    const payData = await payRes.json()
    if (!payRes.ok) throw new Error('Erro ao acessar a API do Asaas')

    let rawPayments = payData.data || []

    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name, asaas_customer_id')
      .not('asaas_customer_id', 'is', null)

    const validSaasCustomerIds = companies?.map((company) => company.asaas_customer_id) || []

    if (customer_id) {
      rawPayments = rawPayments.filter((payment: any) => payment.customer === customer_id)
    } else {
      rawPayments = rawPayments.filter((payment: any) => validSaasCustomerIds.includes(payment.customer))
    }

    const payments = rawPayments.map((payment: any) => {
      const company = companies?.find((item) => item.asaas_customer_id === payment.customer)
      return {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        netValue: payment.netValue,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        invoiceUrl: payment.invoiceUrl,
        companyName: company ? company.name : 'Outros / Alugueis',
      }
    })

    return new Response(JSON.stringify({ success: true, data: payments, payments }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

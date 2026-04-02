import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

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
    if (!authHeader) throw new Error("Acesso negado: Token ausente.")

    const token = authHeader.replace(/^Bearer\s+/i, '').trim()
    if (!token) throw new Error("Acesso negado: Token ausente.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Validar a sessão do usuário
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
    if (authError || !user) throw new Error("Acesso negado: Sessão inválida.")

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

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
      throw new Error("Acesso negado: Empresa do usuário não encontrada.")
    }

    // 2. Para CRM normal, nunca confiamos no customer_id vindo do front-end.
    // Sempre reduzimos o escopo para a empresa do usuário autenticado.
    if (!isSuperAdmin) {
      const { data: ownCompany, error: ownCompanyError } = await supabaseAdmin
        .from('companies')
        .select('id, asaas_customer_id')
        .eq('id', profile.company_id)
        .maybeSingle()

      if (ownCompanyError || !ownCompany?.asaas_customer_id) {
        throw new Error("Cliente Asaas da empresa não encontrado.")
      }

      if (requestedCompanyId && requestedCompanyId !== ownCompany.id) {
        throw new Error("Acesso negado: empresa inválida.")
      }

      if (customer_id && customer_id !== ownCompany.asaas_customer_id) {
        throw new Error("Acesso negado: customer_id inválido.")
      }

      customer_id = ownCompany.asaas_customer_id
    }

    // 3. Para super admin, permitimos visão global ou filtro por empresa/cliente específico.
    if (isSuperAdmin && requestedCompanyId && !customer_id) {
      const { data: scopedCompany, error: scopedCompanyError } = await supabaseAdmin
        .from('companies')
        .select('asaas_customer_id')
        .eq('id', requestedCompanyId)
        .maybeSingle()

      if (scopedCompanyError || !scopedCompany?.asaas_customer_id) {
        throw new Error("Cliente Asaas da empresa não encontrado.")
      }

      customer_id = scopedCompany.asaas_customer_id
    }

    // 4. Pede as faturas para o Asaas (com ou sem filtro inicial)
    let endpoint = `${ASAAS_URL}/payments?limit=100`
    if (customer_id) {
      endpoint = `${ASAAS_URL}/payments?customer=${encodeURIComponent(customer_id)}&limit=100`
    }

    const payRes = await fetch(endpoint, {
      method: 'GET',
      headers: { 'access_token': ASAAS_API_KEY! }
    })

    const payData = await payRes.json()
    if (!payRes.ok) throw new Error("Erro ao acessar a API do Asaas")

    let rawPayments = payData.data || []

    // 5. FIREWALL MULTI-TENANT:
    // mesmo que o Asaas devolva dados extras, o CRM só recebe boletos
    // exatamente vinculados ao customer_id efetivamente autorizado.
    if (customer_id) {
      rawPayments = rawPayments.filter((payment: any) => payment.customer === customer_id)
    }

    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name, asaas_customer_id')
      .not('asaas_customer_id', 'is', null)

    const payments = rawPayments.map((payment: any) => {
      const company = companies?.find(c => c.asaas_customer_id === payment.customer)
      return {
        id: payment.id,
        status: payment.status,
        value: payment.value,
        netValue: payment.netValue,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        invoiceUrl: payment.invoiceUrl,
        companyName: company ? company.name : 'Outros / Aluguéis'
      }
    })

    return new Response(JSON.stringify({ success: true, data: payments, payments: payments }), {
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

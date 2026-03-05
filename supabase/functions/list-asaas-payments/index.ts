import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    // 1. Busca os últimos 100 pagamentos no Asaas
    const payRes = await fetch(`${ASAAS_URL}/payments?limit=100`, {
      method: 'GET',
      headers: { 'access_token': ASAAS_API_KEY! }
    })
    const payData = await payRes.json()
    if (!payRes.ok) throw new Error("Erro ao aceder à API do Asaas")

    // 2. Busca as empresas para cruzar os IDs com os nomes reais
    const { data: companies } = await supabaseAdmin
      .from('companies')
      .select('id, name, asaas_customer_id')
      .not('asaas_customer_id', 'is', null)

    // 3. Monta a resposta final
    const payments = (payData.data || []).map((payment: any) => {
      const company = companies?.find(c => c.asaas_customer_id === payment.customer)
      return {
        id: payment.id,
        status: payment.status, // RECEIVED, PENDING, OVERDUE, etc.
        value: payment.value,
        netValue: payment.netValue,
        dueDate: payment.dueDate,
        paymentDate: payment.paymentDate,
        invoiceUrl: payment.invoiceUrl,
        companyName: company ? company.name : 'Cliente Desconhecido (Fora do DB)'
      }
    })

    return new Response(JSON.stringify({ success: true, payments }), {
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

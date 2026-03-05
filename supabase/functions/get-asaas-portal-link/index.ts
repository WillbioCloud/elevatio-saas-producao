import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id } = await req.json()
    if (!company_id) throw new Error("ID da empresa não informado.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: company, error: compError } = await supabaseAdmin
      .from('companies')
      .select('asaas_customer_id')
      .eq('id', company_id)
      .single()

    if (compError || !company?.asaas_customer_id) {
      throw new Error("Cliente não possui cadastro no Asaas.")
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    // Busca a cobrança mais recente (independente do status) para servir de portal
    const payRes = await fetch(`${ASAAS_URL}/payments?customer=${company.asaas_customer_id}&limit=1`, {
      method: 'GET',
      headers: { 'access_token': ASAAS_API_KEY! }
    })

    const payData = await payRes.json()
    if (!payRes.ok) throw new Error(`Erro na API: ${payData.errors?.[0]?.description}`)

    if (!payData.data || payData.data.length === 0) {
      throw new Error("Nenhuma fatura encontrada para este cliente.")
    }

    const invoiceUrl = payData.data[0].invoiceUrl

    return new Response(JSON.stringify({ success: true, portalUrl: invoiceUrl }), {
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

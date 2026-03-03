import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id } = await req.json()
    if (!company_id) throw new Error("ID da empresa não informado.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Acha o ID do cliente Asaas salvo no seu banco
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('asaas_customer_id')
      .eq('id', company_id)
      .single()

    if (companyError || !company?.asaas_customer_id) {
        throw new Error('Empresa não possui um cadastro financeiro no Asaas.')
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3' // Mude para api.asaas.com/v3 para produção

    // 2. Busca pagamentos PENDENTES deste cliente no Asaas
    const payRes = await fetch(`${ASAAS_URL}/payments?customer=${company.asaas_customer_id}&status=PENDING`, {
      method: 'GET',
      headers: {
        'access_token': ASAAS_API_KEY!
      }
    })
    
    const payData = await payRes.json()

    if (!payRes.ok) throw new Error(`Erro na API Asaas: ${payData.errors?.[0]?.description}`)

    if (!payData.data || payData.data.length === 0) {
       throw new Error('Nenhuma fatura pendente encontrada. O plano pode já estar pago.')
    }

    // 3. Pega o link da fatura mais recente e devolve pro Front-end
    const invoiceUrl = payData.data[0].invoiceUrl

    return new Response(
      JSON.stringify({ success: true, checkoutUrl: invoiceUrl }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
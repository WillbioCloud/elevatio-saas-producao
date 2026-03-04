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
    const { company_id, reason, other_reason } = await req.json()
    
    if (!company_id) throw new Error("ID da empresa não fornecido.")

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('asaas_subscription_id')
      .eq('id', company_id)
      .single()

    if (companyError || !company?.asaas_subscription_id) {
      throw new Error('Assinatura não encontrada no Asaas.')
    }

    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    // 1. Cancela a assinatura no Asaas (Evita cobranças futuras)
    const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
      method: 'DELETE',
      headers: { 'access_token': ASAAS_API_KEY! }
    });

    const asaasData = await asaasRes.json();

    if (!asaasRes.ok) {
      throw new Error(`Erro no Asaas: ${asaasData.errors?.[0]?.description || 'Falha ao cancelar'}`);
    }

    // 2. Formata o motivo
    const finalReason = reason === 'Outro' ? `Outro: ${other_reason}` : reason;

    // 3. Atualiza o banco de dados (Muda para 'canceled' mas preserva a end_date para o cliente continuar usando)
    await supabaseAdmin
      .from('saas_contracts')
      .update({ 
        status: 'canceled', 
        cancel_reason: finalReason,
        canceled_at: new Date().toISOString()
      })
      .eq('company_id', company_id);

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
        status: 400,
      }
    )
  }
})

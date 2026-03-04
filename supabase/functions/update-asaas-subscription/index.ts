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
    const { company_id, new_plan, billing_cycle } = await req.json()
    
    if (!company_id || !new_plan || !billing_cycle) {
      throw new Error("Dados incompletos para atualização.")
    }

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 1. Busca os IDs do Asaas da empresa
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('asaas_subscription_id, asaas_customer_id')
      .eq('id', company_id)
      .single()

    if (companyError || !company?.asaas_subscription_id) {
      throw new Error('Empresa não possui uma assinatura ativa no Asaas. Pague a assinatura atual primeiro.')
    }

    // 2. Calcula o novo preço
    const planPrices: Record<string, { monthly: number, yearly: number }> = {
      starter: { monthly: 54.90, yearly: 527.04 },
      basic: { monthly: 74.90, yearly: 719.04 },
      profissional: { monthly: 119.90, yearly: 1151.04 },
      business: { monthly: 179.90, yearly: 1727.04 },
      premium: { monthly: 249.90, yearly: 2399.04 },
      elite: { monthly: 349.90, yearly: 3359.04 }
    };

    const planKey = new_plan.toLowerCase();
    const isYearly = billing_cycle === 'yearly';
    const planValue = isYearly ? planPrices[planKey].yearly : planPrices[planKey].monthly;
    const asaasCycle = isYearly ? 'YEARLY' : 'MONTHLY';

    // 3. Atualiza a assinatura no Asaas
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    const asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY!
      },
      body: JSON.stringify({
        value: planValue,
        cycle: asaasCycle,
        description: `Assinatura Elevatio CRM - Plano ${planKey.toUpperCase()} (${isYearly ? 'Anual' : 'Mensal'})`,
        updatePendingPayments: true // Atualiza faturas que já foram geradas mas ainda não pagas
      })
    });

    const asaasData = await asaasRes.json();

    if (!asaasRes.ok) {
      throw new Error(`Erro no Asaas: ${asaasData.errors?.[0]?.description || 'Erro desconhecido'}`);
    }

    // 4. Atualiza o banco de dados (companies e saas_contracts)
    const { error: compError } = await supabaseAdmin
      .from('companies')
      .update({ plan: planKey })
      .eq('id', company_id);

    if (compError) throw new Error(`Falha ao atualizar a empresa: ${compError.message}`);

    const { error: contractError } = await supabaseAdmin
      .from('saas_contracts')
      .update({ 
        plan_name: planKey, // Usamos apenas a coluna correta
        billing_cycle: billing_cycle
      })
      .eq('company_id', company_id);

    if (contractError) throw new Error(`Falha ao atualizar o contrato: ${contractError.message}`);

    return new Response(
      JSON.stringify({ success: true, plan: planKey }),
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

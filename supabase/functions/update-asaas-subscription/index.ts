import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id, new_plan, billing_cycle, has_fidelity } = await req.json()
    
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

    if (companyError) {
      throw new Error(`Erro ao buscar empresa: ${companyError.message}`)
    }

    if (!company?.asaas_customer_id) {
      throw new Error('Empresa sem customer_id no Asaas. Faça o setup de cobrança antes do upgrade.')
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
    const selectedPlan = planPrices[planKey]
    if (!selectedPlan) {
      throw new Error(`Plano inválido para upgrade: ${new_plan}`)
    }

    const planValue = isYearly ? selectedPlan.yearly : selectedPlan.monthly;
    const asaasCycle = isYearly ? 'YEARLY' : 'MONTHLY';

    // 3. Atualiza a assinatura no Asaas
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://sandbox.asaas.com/api/v3'

    let asaasRes: Response

    if (company.asaas_subscription_id) {
      asaasRes = await fetch(`${ASAAS_URL}/subscriptions/${company.asaas_subscription_id}`, {
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
    } else {
      // Fallback robusto: não existe assinatura anterior, então cria uma nova no Asaas
      asaasRes = await fetch(`${ASAAS_URL}/subscriptions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'access_token': ASAAS_API_KEY!
        },
        body: JSON.stringify({
          customer: company.asaas_customer_id,
          billingType: 'BOLETO',
          value: planValue,
          nextDueDate: new Date().toISOString().split('T')[0],
          cycle: asaasCycle,
          description: `Assinatura Elevatio CRM - Plano ${planKey.toUpperCase()} (${isYearly ? 'Anual' : 'Mensal'})`
        })
      });
    }

    const asaasData = await asaasRes.json();

    if (!asaasRes.ok) {
      throw new Error(`Erro no Asaas: ${asaasData.errors?.[0]?.description || 'Erro desconhecido'}`);
    }

    // Se criou assinatura nova, salva o ID para os próximos upgrades/cancelamentos
    if (!company.asaas_subscription_id && asaasData?.id) {
      const { error: saveSubError } = await supabaseAdmin
        .from('companies')
        .update({ asaas_subscription_id: asaasData.id })
        .eq('id', company_id)

      if (saveSubError) {
        throw new Error(`Falha ao salvar nova assinatura da empresa: ${saveSubError.message}`)
      }
    }

    // 4. Atualiza o banco de dados (companies e saas_contracts)
    const { error: compError } = await supabaseAdmin
      .from('companies')
      .update({ plan: planKey })
      .eq('id', company_id);

    if (compError) throw new Error(`Falha ao atualizar a empresa: ${compError.message}`);

    // Calcula a data de fim da fidelidade (1 ano a partir de hoje) se o cliente aceitou
    const fidelityEndDate = has_fidelity 
      ? new Date(new Date().setFullYear(new Date().getFullYear() + 1)).toISOString() 
      : null;

    const { data: currentContract } = await supabaseAdmin
      .from('saas_contracts')
      .select('id')
      .eq('company_id', company_id)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle()

    if (currentContract?.id) {
      const { error: contractError } = await supabaseAdmin
        .from('saas_contracts')
        .update({ 
          plan_name: planKey,
          billing_cycle: billing_cycle,
          has_fidelity: has_fidelity || false,
          fidelity_end_date: fidelityEndDate
        })
        .eq('id', currentContract.id);

      if (contractError) throw new Error(`Falha ao atualizar o contrato: ${contractError.message}`);
    } else {
      const startDate = new Date()
      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + 7)

      const { error: contractInsertError } = await supabaseAdmin
        .from('saas_contracts')
        .insert({
          company_id,
          plan_id: null,
          plan_name: planKey,
          status: 'pending',
          billing_cycle,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          has_fidelity: has_fidelity || false,
          fidelity_end_date: fidelityEndDate
        })

      if (contractInsertError) throw new Error(`Falha ao criar contrato base: ${contractInsertError.message}`);
    }

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

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, accept, accept-encoding',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { company_id, new_plan, billing_cycle, has_fidelity } = await req.json()
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: contract } = await supabase.from('saas_contracts').select('*').eq('company_id', company_id).single()
    const { data: company } = await supabase.from('companies').select('*').eq('id', company_id).single()
    const { data: profile } = await supabase.from('profiles').select('email, full_name, phone').eq('company_id', company_id).order('created_at', { ascending: true }).limit(1).single()

    let customerId = company?.asaas_customer_id;
    let subscriptionId = contract?.subscription_id || company?.asaas_subscription_id;

    const { data: planRecord } = await supabase.from('saas_plans').select('id').ilike('name', new_plan).maybeSingle();
    const plan_id = planRecord?.id || null;

    if (!customerId) {
      const document = company?.document?.replace(/\D/g, '') || company?.cpf_cnpj?.replace(/\D/g, '') || '';
      
      if (document) {
        const searchRes = await fetch(`https://sandbox.asaas.com/api/v3/customers?cpfCnpj=${document}`, {
          headers: { 'access_token': ASAAS_API_KEY }
        });
        const searchData = await searchRes.json();
        if (searchData.data && searchData.data.length > 0) customerId = searchData.data[0].id;
      }

      if (!customerId) {
        const customerRes = await fetch(`https://sandbox.asaas.com/api/v3/customers`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: company?.name || profile?.full_name || 'Empresa Sem Nome',
            email: profile?.email || 'email@padrao.com',
            cpfCnpj: company?.document || company?.cpf_cnpj || '',
            phone: company?.phone || profile?.phone || ''
          })
        });
        const customerData = await customerRes.json();
        if (customerData.id) customerId = customerData.id;
        else throw new Error('Falha ao criar cliente: ' + JSON.stringify(customerData.errors));
      }

      await supabase.from('companies').update({ asaas_customer_id: customerId }).eq('id', company_id);
    }

    // ✨ 3. REGRAS DE PREÇO E AMARRAÇÃO DE FIDELIDADE
    const plans = { starter: { price: 97.90 }, basic: { price: 197.90 }, profissional: { price: 349.90 }, business: { price: 549.90 }, premium: { price: 849.90 }, elite: { price: 1249.90 } }
    const planData = plans[new_plan.toLowerCase() as keyof typeof plans];
    if (!planData) throw new Error('Plano inválido');

    let price = planData.price;
    let finalHasFidelity = has_fidelity;
    let fidelityEndDate = null;

    if (billing_cycle === 'yearly') {
      price = price * 12 * 0.8; 
      finalHasFidelity = false; // O Anual já é uma fidelidade por natureza (paga 1 ano), não precisa da flag mensal
    } 
    else if (has_fidelity) {
      price = price * 0.9; 
      // Calcula o Fim da Fidelidade (Hoje + 12 Meses)
      const futureDate = new Date();
      futureDate.setFullYear(futureDate.getFullYear() + 1);
      fidelityEndDate = futureDate.toISOString();
    }

    const targetCycle = billing_cycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
    let newSubscriptionId = subscriptionId;

    if (subscriptionId) {
      const subGet = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, { headers: { 'access_token': ASAAS_API_KEY } });
      const subData = await subGet.json();

      if (subData && !subData.errors) {
        if (subData.cycle !== targetCycle || subData.status === 'INACTIVE') {
          await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, { method: 'DELETE', headers: { 'access_token': ASAAS_API_KEY } });
          const createRes = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions`, {
            method: 'POST',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              customer: customerId, billingType: subData.billingType || 'UNDEFINED',
              nextDueDate: subData.nextDueDate, value: price, cycle: targetCycle,
              description: `Plano ${new_plan.toUpperCase()} - Elevatio Vendas (${targetCycle})`
            })
          });
          const createData = await createRes.json();
          if (!createData.errors) newSubscriptionId = createData.id;
        } else {
          await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, {
            method: 'PUT',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: price, description: `Plano ${new_plan.toUpperCase()} - Elevatio Vendas (${targetCycle})`, updatePendingPayments: true })
          });
        }
      }
    } else {
      let nextDueDate = new Date();
      if (company?.trial_ends_at && new Date(company.trial_ends_at) > new Date()) nextDueDate = new Date(company.trial_ends_at);
      else nextDueDate.setDate(nextDueDate.getDate() + 7);

      const createRes = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions`, {
        method: 'POST',
        headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer: customerId, billingType: 'UNDEFINED',
          nextDueDate: nextDueDate.toISOString().split('T')[0], value: price, cycle: targetCycle,
          description: `Plano ${new_plan.toUpperCase()} - Elevatio Vendas (${targetCycle})`
        })
      });
      const createData = await createRes.json();
      if (!createData.errors) newSubscriptionId = createData.id;
    }

    // ✨ 4. GRAVA TUDO NO BANCO (Incluindo a data de fim da fidelidade!)
    await supabase.from('saas_contracts').update({
        plan_name: new_plan, 
        plan_id: plan_id, 
        billing_cycle: billing_cycle,
        has_fidelity: finalHasFidelity, 
        fidelity_end_date: fidelityEndDate, // Agora o contrato sabe quando acaba!
        subscription_id: newSubscriptionId, 
        price: price
    }).eq('company_id', company_id);

    await supabase.from('companies').update({
        plan: new_plan, asaas_subscription_id: newSubscriptionId
    }).eq('id', company_id);

    return new Response(JSON.stringify({ success: true, subscription_id: newSubscriptionId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })

  } catch (error: any) {
    console.error('Erro na função:', error)
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
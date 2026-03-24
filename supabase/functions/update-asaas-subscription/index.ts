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
    const { company_id, new_plan, billing_cycle, has_fidelity, addons } = await req.json()
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const { data: contract } = await supabase.from('saas_contracts').select('*').eq('company_id', company_id).single()
    const { data: company } = await supabase.from('companies').select('*').eq('id', company_id).single()
    const { data: profile } = await supabase.from('profiles').select('email, full_name, phone').eq('company_id', company_id).order('created_at', { ascending: true }).limit(1).single()

    let customerId = company?.asaas_customer_id;
    let subscriptionId = contract?.subscription_id || company?.asaas_subscription_id;

    const { data: planRecord } = await supabase.from('saas_plans').select('id, has_free_domain').ilike('name', new_plan).maybeSingle();
    const plan_id = planRecord?.id || null;
    const has_free_domain = planRecord?.has_free_domain || false;

    // --- CRIAÇÃO DO CLIENTE ASAAS (SE NÃO EXISTIR) ---
    if (!customerId) {
      const document = company?.document?.replace(/\D/g, '') || company?.cpf_cnpj?.replace(/\D/g, '') || '';
      if (document) {
        const searchRes = await fetch(`https://sandbox.asaas.com/api/v3/customers?cpfCnpj=${document}`, { headers: { 'access_token': ASAAS_API_KEY } });
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
        else throw new Error('Falha ao criar cliente no Asaas: ' + JSON.stringify(customerData.errors));
      }
      await supabase.from('companies').update({ asaas_customer_id: customerId }).eq('id', company_id);
    }

    // --- LÓGICA DE PREÇOS E DESCONTOS ---
    const plans = { starter: { price: 54.90 }, basic: { price: 74.90 }, profissional: { price: 119.90 }, business: { price: 179.90 }, premium: { price: 249.90 }, elite: { price: 479.90 } }
    const planData = plans[new_plan.toLowerCase() as keyof typeof plans];
    if (!planData) throw new Error('Plano inválido');

    let price = planData.price;
    let finalHasFidelity = has_fidelity;
    let fidelityEndDate = contract?.fidelity_end_date || null;

    if (billing_cycle === 'yearly') {
      price = price * 12 * 0.85; 
      finalHasFidelity = false; 
    } 
    else if (has_fidelity) {
      price = price * 0.90;
      if (!fidelityEndDate || new Date(fidelityEndDate) < new Date()) {
          const futureDate = new Date();
          futureDate.setFullYear(futureDate.getFullYear() + 1);
          fidelityEndDate = futureDate.toISOString();
      }
    }

    // --- LÓGICA DOS DOMÍNIOS (ORDER BUMP) ---
    let invoiceDescription = `Plano ${new_plan.toUpperCase()} - Elevatio Vendas (${billing_cycle === 'yearly' ? 'Anual' : 'Mensal'})`;
    let domainStatusToSave = contract?.domain_status || 'pending';
    let domainPriceToCharge = 0;
    
    // Calcula o preço dinâmico do domínio extra
    const isCom = (company?.domain || '').endsWith('.com');
    const primaryPrice = isCom ? 73.00 : 53.00;
    const secondaryPrice = isCom ? 53.00 : 73.00;

    // Se ele está comprando o BR e não tem direito a ele de graça
    if (addons?.buyDomainBr && !(billing_cycle === 'yearly' && has_free_domain)) {
        domainPriceToCharge += primaryPrice;
        invoiceDescription += ` + Registro de Domínio Principal`;
        domainStatusToSave = 'pending';
    }
    // Se ele tem de graça
    else if (billing_cycle === 'yearly' && has_free_domain) {
        domainStatusToSave = 'pending'; // Fica pendente até o Asaas confirmar o pagamento do anual
    }

    if (addons?.buyDomainCom) {
        domainPriceToCharge += secondaryPrice;
        invoiceDescription += ` + Registro de Domínio Alternativo (.com)`;
        domainStatusToSave = 'pending';
    }

    // Adiciona o valor dos domínios ao total da assinatura no Asaas
    price = price + domainPriceToCharge;
    
    const targetCycle = billing_cycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
    let newSubscriptionId = subscriptionId;

    // --- COMUNICAÇÃO COM ASAAS ---
    if (subscriptionId) {
      const subGet = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, { headers: { 'access_token': ASAAS_API_KEY } });
      const subData = await subGet.json();

      if (subData && !subData.errors) {
        if (subData.cycle !== targetCycle || subData.status === 'INACTIVE') {
          await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, { method: 'DELETE', headers: { 'access_token': ASAAS_API_KEY } });
          const createRes = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions`, {
            method: 'POST',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer: customerId, billingType: subData.billingType || 'UNDEFINED', nextDueDate: subData.nextDueDate, value: price, cycle: targetCycle, description: invoiceDescription })
          });
          const createData = await createRes.json();
          if (!createData.errors) newSubscriptionId = createData.id;
        } else {
          await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, {
            method: 'PUT',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ value: price, description: invoiceDescription, updatePendingPayments: true })
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
        body: JSON.stringify({ customer: customerId, billingType: 'UNDEFINED', nextDueDate: nextDueDate.toISOString().split('T')[0], value: price, cycle: targetCycle, description: invoiceDescription })
      });
      const createData = await createRes.json();
      if (!createData.errors) newSubscriptionId = createData.id;
    }

    // --- ATUALIZAÇÃO NO SUPABASE ---
    await supabase.from('saas_contracts').update({ 
        plan_name: new_plan, 
        plan_id: plan_id, 
        billing_cycle: billing_cycle, 
        has_fidelity: finalHasFidelity, 
        fidelity_end_date: fidelityEndDate, 
        subscription_id: newSubscriptionId, 
        price: planData.price, // Salvamos no banco o preço base sem o domínio para não confundir o UI
        domain_status: domainStatusToSave 
    }).eq('company_id', company_id);

    await supabase.from('companies').update({ plan: new_plan, asaas_subscription_id: newSubscriptionId }).eq('id', company_id);

    return new Response(JSON.stringify({ success: true, subscription_id: newSubscriptionId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})
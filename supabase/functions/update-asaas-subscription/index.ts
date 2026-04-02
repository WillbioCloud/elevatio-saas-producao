import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // TRUQUE PARA O SAFARI/IOS: Lemos os headers que o navegador pediu e devolvemos a mesma string
  const requestedHeaders = req.headers.get('Access-Control-Request-Headers') || 'authorization, x-client-info, apikey, content-type, accept, accept-encoding, x-supabase-api-version, x-region, prefer';
  
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': requestedHeaders,
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
  }

  // Se for a verificação de segurança (Preflight), libera imediatamente
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { company_id, new_plan, billing_cycle, has_fidelity, addons, coupon_code, domain_secondary, total_price } = await req.json()
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
    const normalizedSecondaryDomain = typeof domain_secondary === 'string' ? domain_secondary.toLowerCase().trim() : '';
    const normalizedTotalPrice = Number.isFinite(Number(total_price)) ? Math.max(0, Number(total_price)) : null;

    let couponRecord: Record<string, any> | null = null;
    if (coupon_code) {
      const { data } = await supabase
        .from('saas_coupons')
        .select('*')
        .eq('code', String(coupon_code).toUpperCase())
        .eq('active', true)
        .maybeSingle();

      if (!data) throw new Error('Cupom inválido ou expirado.');

      const maxUses = data.max_uses ?? data.usage_limit;
      if (typeof maxUses === 'number' && maxUses > 0 && Number(data.used_count ?? 0) >= maxUses) {
        throw new Error('Cupom esgotado.');
      }

      couponRecord = data as Record<string, any>;
    }

    // --- 1. CLIENTE ASAAS ---
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
        else throw new Error('Falha criar cliente Asaas: ' + JSON.stringify(customerData.errors));
      }
      await supabase.from('companies').update({ asaas_customer_id: customerId }).eq('id', company_id);
    }

    // --- 2. VALOR BASE DA MENSALIDADE/ANUIDADE ---
    const plans = { starter: { price: 54.90 }, basic: { price: 74.90 }, profissional: { price: 119.90 }, business: { price: 179.90 }, premium: { price: 249.90 }, elite: { price: 479.90 } }
    const planData = plans[new_plan.toLowerCase() as keyof typeof plans];
    if (!planData) throw new Error('Plano inválido');

    let basePrice = planData.price;
    let finalHasFidelity = has_fidelity;
    let fidelityEndDate = contract?.fidelity_end_date || null;

    if (billing_cycle === 'yearly') {
      basePrice = basePrice * 12 * 0.85;
      finalHasFidelity = false;
    }
    else if (has_fidelity) {
      basePrice = basePrice * 0.90;
      if (!fidelityEndDate || new Date(fidelityEndDate) < new Date()) {
          const futureDate = new Date();
          futureDate.setFullYear(futureDate.getFullYear() + 1);
          fidelityEndDate = futureDate.toISOString();
      }
    }

    const manualDiscountValue = Number(company?.manual_discount_value ?? 0);
    const manualDiscountType = company?.manual_discount_type;
    const manualDiscountAmount = manualDiscountValue > 0
      ? Math.min(
          basePrice,
          manualDiscountType === 'percentage'
            ? basePrice * (manualDiscountValue / 100)
            : manualDiscountValue
        )
      : 0;
    const recurringPrice = Math.max(0, basePrice - manualDiscountAmount);

    const couponDiscountAmount = couponRecord
      ? Math.min(
          recurringPrice,
          (couponRecord.discount_type ?? couponRecord.type) === 'percentage'
            ? recurringPrice * (Number(couponRecord.discount_value ?? couponRecord.value ?? 0) / 100)
            : (couponRecord.discount_type ?? couponRecord.type) === 'free_month'
              ? recurringPrice
              : Number(couponRecord.discount_value ?? couponRecord.value ?? 0)
        )
      : 0;

    // --- 3. VALOR DOS DOMÍNIOS (APENAS 1ª COBRANÇA) ---
    let domainPriceToCharge = 0;
    let extraDescription = "";
    let domainStatusToSave = contract?.domain_status || 'pending';
 
    const isCom = (company?.domain || '').endsWith('.com');
    const primaryPrice = isCom ? 73.00 : 53.00;
    const secondaryPrice = normalizedSecondaryDomain
      ? (normalizedSecondaryDomain.endsWith('.com') ? 73.00 : 53.00)
      : (isCom ? 53.00 : 73.00);

    if (addons?.buyDomainBr && !(billing_cycle === 'yearly' && has_free_domain)) {
        domainPriceToCharge += primaryPrice;
        extraDescription += ` + Registro de Domínio Principal`;
        domainStatusToSave = 'pending';
    } else if (billing_cycle === 'yearly' && has_free_domain) {
        domainStatusToSave = 'pending';
    }

    if (addons?.buyDomainCom) {
        domainPriceToCharge += secondaryPrice;
        extraDescription += ` + Domínio Alternativo (${normalizedSecondaryDomain || '.com'})`;
        domainStatusToSave = 'pending';
    }

    const targetCycle = billing_cycle === 'yearly' ? 'YEARLY' : 'MONTHLY';
    const baseDescription = `Plano ${new_plan.toUpperCase()} - Elevatio Vendas (${targetCycle === 'YEARLY' ? 'Anual' : 'Mensal'})`;
    let newSubscriptionId = subscriptionId;

    // --- 4. CRIAR/ATUALIZAR ASSINATURA (SÓ PLANO BASE) ---
    if (subscriptionId) {
      const subGet = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, { headers: { 'access_token': ASAAS_API_KEY } });
      const subData = await subGet.json();

      if (subData && !subData.errors) {
        if (subData.cycle !== targetCycle || subData.status === 'INACTIVE') {
          await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, { method: 'DELETE', headers: { 'access_token': ASAAS_API_KEY } });
          const createRes = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions`, {
            method: 'POST',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify({ customer: customerId, billingType: subData.billingType || 'UNDEFINED', nextDueDate: subData.nextDueDate, value: recurringPrice, cycle: targetCycle, description: baseDescription })
          });
          const createData = await createRes.json();
          if (!createData.errors) newSubscriptionId = createData.id;
        } else {
          const updatePayload: any = {
            value: recurringPrice,
            cycle: targetCycle,
            description: baseDescription,
            updatePendingCharge: true,
            updatePendingPayments: true,
          };

          await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${subscriptionId}`, {
            method: 'PUT',
            headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
            body: JSON.stringify(updatePayload)
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
        body: JSON.stringify({ customer: customerId, billingType: 'UNDEFINED', nextDueDate: nextDueDate.toISOString().split('T')[0], value: recurringPrice, cycle: targetCycle, description: baseDescription })
      });
      const createData = await createRes.json();
      if (!createData.errors) newSubscriptionId = createData.id;
    }

    // --- 5. ATUALIZAR BOLETO ATUAL (E INJETAR DOMÍNIOS) ---
    let keptPaymentId = null;
    if (newSubscriptionId) {
      const paymentsRes = await fetch(`https://sandbox.asaas.com/api/v3/payments?subscription=${newSubscriptionId}&status=PENDING`, { headers: { 'access_token': ASAAS_API_KEY } });
      const paymentsData = await paymentsRes.json();
 
      if (paymentsData.data && paymentsData.data.length > 0) {
        // Pega a fatura mais próxima do vencimento
        const currentPayment = paymentsData.data.sort((a:any, b:any) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];
        keptPaymentId = currentPayment.id;
        
        const finalPaymentValue = normalizedTotalPrice ?? Math.max(0, recurringPrice + domainPriceToCharge - couponDiscountAmount);
        const finalPaymentDesc = baseDescription + extraDescription;

        // Força a reescrita do valor e da descrição na fatura PRINCIPAL
        await fetch(`https://sandbox.asaas.com/api/v3/payments/${currentPayment.id}`, {
          method: 'POST',
          headers: { 'access_token': ASAAS_API_KEY, 'Content-Type': 'application/json' },
          body: JSON.stringify({ value: finalPaymentValue, description: finalPaymentDesc })
        });
      }
    }

    // --- 5.5 FAXINA ANTI-DUPLICAÇÃO (TIRA O AVISO CHATO DO ASAAS) ---
    if (customerId) {
      // 1. Varre e apaga TODAS as faturas pendentes que não sejam a fatura principal
      const allPaymentsRes = await fetch(`https://sandbox.asaas.com/api/v3/payments?customer=${customerId}&status=PENDING`, { headers: { 'access_token': ASAAS_API_KEY } });
      const allPaymentsData = await allPaymentsRes.json();
      if (allPaymentsData?.data) {
        for (const p of allPaymentsData.data) {
          if (p.id !== keptPaymentId) {
            await fetch(`https://sandbox.asaas.com/api/v3/payments/${p.id}`, { method: 'DELETE', headers: { 'access_token': ASAAS_API_KEY } });
          }
        }
      }

      // 2. Varre e apaga assinaturas antigas/órfãs do mesmo cliente
      const allSubsRes = await fetch(`https://sandbox.asaas.com/api/v3/subscriptions?customer=${customerId}&status=ACTIVE`, { headers: { 'access_token': ASAAS_API_KEY } });
      const allSubsData = await allSubsRes.json();
      if (allSubsData?.data) {
        for (const sub of allSubsData.data) {
          if (sub.id !== newSubscriptionId) {
            await fetch(`https://sandbox.asaas.com/api/v3/subscriptions/${sub.id}`, { method: 'DELETE', headers: { 'access_token': ASAAS_API_KEY } });
          }
        }
      }
    }

    // --- 6. ATUALIZAÇÃO NO SUPABASE ---
    await supabase.from('saas_contracts').update({
        plan_name: new_plan,
        plan_id: plan_id,
        billing_cycle: billing_cycle,
        has_fidelity: finalHasFidelity,
        fidelity_end_date: fidelityEndDate,
        subscription_id: newSubscriptionId,
        price: recurringPrice,
        domain_status: domainStatusToSave
    }).eq('company_id', company_id);

    const companyUpdate: Record<string, unknown> = {
      plan: new_plan,
      asaas_subscription_id: newSubscriptionId,
    };

    if (normalizedSecondaryDomain) {
      companyUpdate.domain_secondary = normalizedSecondaryDomain;
    }

    await supabase.from('companies').update(companyUpdate).eq('id', company_id);

    // --- 7. DAR BAIXA NO CUPOM ---
    if (coupon_code) {
      const { data: cupom } = await supabase.from('saas_coupons').select('id, current_usages').eq('code', coupon_code).single();
      if (cupom) {
        await supabase.from('saas_coupons').update({ 
          current_usages: (cupom.current_usages || 0) + 1 
        }).eq('id', cupom.id);
      }
    }

    return new Response(JSON.stringify({ success: true, subscription_id: newSubscriptionId }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 })
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 })
  }
})

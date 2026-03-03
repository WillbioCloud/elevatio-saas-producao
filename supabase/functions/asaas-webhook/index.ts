import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

serve(async (req) => {
  try {
    // 1. Pega a mensagem que o Asaas enviou
    const body = await req.json();
    const event = body.event; // Ex: PAYMENT_RECEIVED, PAYMENT_OVERDUE...
    const payment = body.payment; // Dados da fatura

    // Se não for um evento do Asaas, ignora
    if (!event || !payment) {
      return new Response("Ignorado: Sem dados de pagamento.", { status: 200 });
    }

    console.log(`Recebido evento do Asaas: ${event} para o cliente ${payment.customer}`);

    // 2. Conecta no Supabase como Super Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. O cliente PAGOU a fatura! (PIX, Boleto ou Cartão)
    if (event === 'PAYMENT_RECEIVED' || event === 'PAYMENT_CONFIRMED') {
      
      // Acha a empresa que tem esse ID do Asaas
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('asaas_customer_id', payment.customer)
        .single();

      if (company) {
        // Atualiza a Empresa para ATIVA
        await supabaseAdmin
          .from('companies')
          .update({ plan_status: 'active', trial_ends_at: null })
          .eq('id', company.id);

        const today = new Date();
        const nextRenewal = new Date(today);
        nextRenewal.setMonth(nextRenewal.getMonth() + 1);

        // Atualiza o Contrato para ATIVO e estende a data de vencimento
        await supabaseAdmin
          .from('saas_contracts')
          .update({ 
            status: 'active',
            start_date: today.toISOString(),
            end_date: nextRenewal.toISOString()
          })
          .eq('company_id', company.id);
          
        console.log(`Empresa ${company.id} ativada com sucesso!`);
      }
    }

    // 4. O cliente NÃO PAGOU e a fatura VENCEU
    if (event === 'PAYMENT_OVERDUE') {
      const { data: company } = await supabaseAdmin
        .from('companies')
        .select('id')
        .eq('asaas_customer_id', payment.customer)
        .single();

      if (company) {
        // Bloqueia a empresa por falta de pagamento
        await supabaseAdmin
          .from('companies')
          .update({ plan_status: 'past_due' })
          .eq('id', company.id);
          
        console.log(`Empresa ${company.id} bloqueada por inadimplência.`);
      }
    }

    return new Response(JSON.stringify({ success: true }), { 
      headers: { "Content-Type": "application/json" }, 
      status: 200 
    });

  } catch (error: any) {
    console.error("Erro no Webhook:", error.message);
    return new Response(JSON.stringify({ error: error.message }), { status: 400 });
  }
})
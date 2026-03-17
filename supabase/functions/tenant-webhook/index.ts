import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // 1. Receber a "ligação" (payload) do Asaas
    const payload = await req.json()

    // 2. Só nos interessa se o evento for de Pagamento Recebido ou Confirmado
    if (payload.event !== 'PAYMENT_RECEIVED' && payload.event !== 'PAYMENT_CONFIRMED') {
      return new Response(JSON.stringify({ message: 'Evento ignorado, não é um pagamento finalizado.' }), { status: 200 })
    }

    const gatewayId = payload.payment.id // O ID do pagamento lá no Asaas (ex: pay_123456)

    // 3. Conectar ao banco de dados com poderes de Admin (Service Role Key)
    // Usamos o Service Role Key porque quem está chamando essa função é o Asaas, e não um usuário logado.
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Procurar a fatura correspondente e pintá-la de VERDE (pago)
    const { error } = await supabaseAdmin
      .from('invoices')
      .update({ status: 'pago' })
      .eq('gateway_id', gatewayId)

    if (error) throw error

    // 5. Desligar o telefone avisando ao Asaas que deu tudo certo
    return new Response(JSON.stringify({ success: true, message: 'Fatura atualizada para PAGO!' }), { 
      status: 200, 
      headers: { 'Content-Type': 'application/json' } 
    })

  } catch (error: any) {
    console.error('Erro no Webhook:', error.message)
    return new Response(JSON.stringify({ error: error.message }), { status: 400 })
  }
})
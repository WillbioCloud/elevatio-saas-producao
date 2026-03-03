// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "@supabase/functions-js/edge-runtime.d.ts"

console.log("Hello from Functions!")

Deno.serve(async (req) => {
  const { name } = await req.json()
  const data = {
    message: `Hello ${name}!`,
  }

  return new Response(
    JSON.stringify(data),
    { headers: { "Content-Type": "application/json" } },
  )
})

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/create-asaas-checkout' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Responde ao navegador para evitar erro de CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 2. Pega os dados que o front-end mandou (Wizard)
    const { company_id, plan } = await req.json()
    if (!company_id || !plan) throw new Error("Faltam parâmetros obrigatórios.")

    // 3. Conecta no Supabase com poderes de Super Admin
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 4. Busca os dados da Imobiliária que acabou de ser criada
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single()

    if (companyError || !company) throw new Error('Empresa não encontrada no banco.')

    // Limpa o CPF/CNPJ para mandar pro Asaas
    const cleanDocument = company.document?.replace(/\D/g, '') || ''
    
    // Pega a chave que você acabou de criar lá no painel!
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    const ASAAS_URL = 'https://api.asaas.com/v3' // Use sandbox.asaas.com se a chave for de testes

    // 5. Manda o Asaas criar o cliente
    const customerRes = await fetch(`${ASAAS_URL}/customers`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY!
      },
      body: JSON.stringify({
        name: company.name,
        cpfCnpj: cleanDocument,
        phone: company.phone,
        mobilePhone: company.phone
      })
    })
    
    const customerData = await customerRes.json()
    if (!customerRes.ok) throw new Error(`Erro Asaas Cliente: ${customerData.errors?.[0]?.description || 'Erro Desconhecido'}`)

    // 6. Define o preço com base no plano escolhido
    const planPrices: Record<string, number> = {
      'starter': 54.90,
      'basic': 74.90,
      'profissional': 119.90,
      'professional': 119.90,
      'business': 179.90,
      'premium': 249.90,
      'elite': 349.90
    }
    const planValue = planPrices[plan.toLowerCase()] || 119.90

    // 7. Manda o Asaas criar a Assinatura (com 7 dias grátis)
    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + 7) 

    const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY!
      },
      body: JSON.stringify({
        customer: customerData.id,
        billingType: 'UNDEFINED', // O cliente escolhe depois se quer PIX, Boleto ou Cartão
        value: planValue,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        cycle: 'MONTHLY',
        description: `Assinatura Elevatio Vendas CRM - Plano ${plan.toUpperCase()}`
      })
    })

    const subData = await subRes.json()
    if (!subRes.ok) throw new Error(`Erro Asaas Assinatura: ${subData.errors?.[0]?.description || 'Erro Desconhecido'}`)

    // 8. Salva os IDs gerados pelo Asaas de volta no seu banco de dados
    await supabaseAdmin
      .from('companies')
      .update({
        asaas_customer_id: customerData.id,
        asaas_subscription_id: subData.id
      })
      .eq('id', company_id)

    return new Response(
      JSON.stringify({ success: true, asaas_customer: customerData.id }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Responde ao 'pre-flight' do navegador (CORS)
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Leitura segura do JSON do front-end
    const reqText = await req.text()
    if (!reqText) throw new Error("A requisição do CRM veio vazia.")
    
    const { company_id, plan } = JSON.parse(reqText)
    if (!company_id || !plan) throw new Error("Faltam parâmetros obrigatórios.")

    // 2. Inicializa o Supabase
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .select('*')
      .eq('id', company_id)
      .single()

    if (companyError || !company) throw new Error('Empresa não encontrada no banco.')

    const cleanDocument = company.document?.replace(/\D/g, '') || ''
    const ASAAS_API_KEY = Deno.env.get('ASAAS_API_KEY')
    
    // 🛑 ESCOLHA A URL CORRETA AQUI:
    // Se a chave for de teste, a URL TEM QUE SER sandbox.asaas.com
    // Se a chave for real/produção, a URL TEM QUE SER api.asaas.com
    const ASAAS_URL = 'https://sandbox.asaas.com/v3' // Mude para api.asaas.com/v3 se for chave real

    // 3. Cadastra o Cliente no Asaas (Com leitura segura)
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
    
    // Pega a resposta em TEXTO puro primeiro para evitar quebrar o servidor
    const customerText = await customerRes.text()
    let customerData
    try {
      customerData = JSON.parse(customerText)
    } catch (e) {
      throw new Error(`Erro Crítico na API Asaas (Cliente). Status: ${customerRes.status}. Resposta: ${customerText}`)
    }

    if (!customerRes.ok) throw new Error(`Erro ao criar cliente Asaas: ${customerData.errors?.[0]?.description || customerText}`)

    // 4. Preços dos Planos
    const planPrices: Record<string, number> = {
      'starter': 54.90, 'basic': 74.90, 'profissional': 119.90,
      'professional': 119.90, 'business': 179.90, 'premium': 249.90, 'elite': 349.90
    }
    const planValue = planPrices[plan.toLowerCase()] || 119.90

    const nextDueDate = new Date()
    nextDueDate.setDate(nextDueDate.getDate() + 7)

    // 5. Cria a Assinatura (Com leitura segura)
    const subRes = await fetch(`${ASAAS_URL}/subscriptions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'access_token': ASAAS_API_KEY!
      },
      body: JSON.stringify({
        customer: customerData.id,
        billingType: 'UNDEFINED',
        value: planValue,
        nextDueDate: nextDueDate.toISOString().split('T')[0],
        cycle: 'MONTHLY',
        description: `Assinatura Elevatio CRM - Plano ${plan.toUpperCase()}`
      })
    })

    const subText = await subRes.text()
    let subData
    try {
      subData = JSON.parse(subText)
    } catch (e) {
      throw new Error(`Erro Crítico na API Asaas (Assinatura). Status: ${subRes.status}. Resposta: ${subText}`)
    }

    if (!subRes.ok) throw new Error(`Erro ao criar assinatura Asaas: ${subData.errors?.[0]?.description || subText}`)

    // 6. Salva no Banco
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
    console.error('ERRO EDGE FUNCTION:', error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
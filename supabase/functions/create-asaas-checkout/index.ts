import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0"

// Cabeçalhos CORS para permitir que o navegador chame esta função
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Lida com a requisição de preflight (OPTIONS) do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 1. Extrair os dados enviados pelo SetupWizardModal
    const { name, email, cpfCnpj, phone, companyName, plan_name, template, domain } = await req.json()

    // 2. Inicializar o cliente Supabase usando o Token de quem fez a requisição (o cliente logado)
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Verificar se o utilizador está realmente autenticado
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      console.error("🚨 ERRO DE AUTH NO BACKEND:", userError)
      throw new Error(`Utilizador não autenticado no servidor: ${userError?.message || 'Sem sessão'}`)
    }

    // 3. Inicializar o cliente ADMIN (Service Role) para ultrapassar o RLS e poder criar a empresa
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // --- DAQUI PARA BAIXO É O MOTOR DE TRANSAÇÃO ---

    // A) Criar a Empresa na tabela `companies`
    const { data: company, error: companyError } = await supabaseAdmin
      .from('companies')
      .insert({
        name: companyName,
        slug: companyName.toLowerCase().replace(/[^a-z0-9]/g, '-'),
        domain: domain,
        template: template,
        cpf_cnpj: cpfCnpj,
        phone: phone,
        plan: plan_name || 'Starter',
        active: true // A empresa existe, mas o contrato dita se ele tem acesso financeiro
      })
      .select()
      .single()

    if (companyError) throw new Error(`Erro ao criar imobiliária: ${companyError.message}`)

    // B) Criar o Contrato SaaS na tabela `saas_contracts` (7 Dias de Trial - Pending)
    const startDate = new Date()
    const endDate = new Date()
    endDate.setDate(startDate.getDate() + 7) // Soma 7 dias

    const { error: contractError } = await supabaseAdmin
      .from('saas_contracts')
      .insert({
        company_id: company.id,
        plan_name: plan_name || 'Starter',
        status: 'pending', // Fica pendente até ele pagar a primeira fatura
        start_date: startDate.toISOString().split('T')[0],
        end_date: endDate.toISOString().split('T')[0]
      })

    if (contractError) throw new Error(`Erro ao criar contrato: ${contractError.message}`)

    // C) Atualizar o Profile do Utilizador (Vincular à empresa e ativar a conta)
    const { error: profileError } = await supabaseAdmin
      .from('profiles')
      .update({
        company_id: company.id,
        active: true, // Agora ele é um corretor/admin ativo dentro desta imobiliária
        role: 'admin' // O criador da empresa é sempre o Admin!
      })
      .eq('id', user.id)

    if (profileError) throw new Error(`Erro ao vincular perfil: ${profileError.message}`)

    // ==========================================================
    // D) INTEGRAÇÃO ASAAS (AQUI ENTRA A CHAMADA PARA O GATEWAY)
    // ==========================================================
    /* TODO: Aqui faremos o POST para a API do Asaas para:
      1. Criar o Customer (Cliente)
      2. Criar a Subscription (Assinatura com vencimento para daqui a 7 dias)
      3. Salvar o asaas_customer_id de volta na tabela companies.
    */
    
    // Retorno de Sucesso para o Front-end
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Imobiliária configurada com sucesso!',
        company_id: company.id 
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    console.error("ERRO NA EDGE FUNCTION:", error.message)
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})
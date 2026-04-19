import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Headers de CORS obrigatórios para requisições do navegador
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // 1. Responde ao preflight do navegador
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { domain } = await req.json()
    if (!domain) throw new Error('Dominio não fornecido.')

    const VERCEL_API_TOKEN = Deno.env.get('VERCEL_API_TOKEN')
    const VERCEL_PROJECT_ID = Deno.env.get('VERCEL_PROJECT_ID')
    const VERCEL_TEAM_ID = Deno.env.get('VERCEL_TEAM_ID') // Opcional

    if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
      throw new Error('Credenciais da Vercel ausentes no Supabase.')
    }

    let url = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains`
    // Se a conta for de Time, anexa o Team ID na URL
    if (VERCEL_TEAM_ID) {
      url += `?teamId=${VERCEL_TEAM_ID}`
    }

    console.log(`Enviando dominio ${domain} para a Vercel (Project: ${VERCEL_PROJECT_ID})...`)

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: domain }),
    })

    const data = await response.json()

    if (!response.ok) {
      console.error('Erro retornado pela Vercel:', data)
      throw new Error(data.error?.message || 'Falha na API da Vercel')
    }

    console.log('Dominio adicionado com sucesso:', data)

    return new Response(JSON.stringify({ success: true, data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    })
  } catch (error: any) {
    console.error('Erro na Edge Function:', error.message)
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    })
  }
})

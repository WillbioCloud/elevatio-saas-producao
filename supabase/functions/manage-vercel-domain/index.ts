import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

// Headers de CORS obrigatorios para requisicoes do navegador
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
    const { domain, action: rawAction } = await req.json()
    const action = typeof rawAction === 'string' && rawAction.trim()
      ? rawAction.trim().toLowerCase()
      : 'add'

    if (!domain) throw new Error('Dominio nao fornecido.')
    if (action !== 'add' && action !== 'remove') {
      throw new Error('Acao invalida. Use "add" ou "remove".')
    }

    const VERCEL_API_TOKEN = Deno.env.get('VERCEL_API_TOKEN')
    const VERCEL_PROJECT_ID = Deno.env.get('VERCEL_PROJECT_ID')
    const VERCEL_TEAM_ID = Deno.env.get('VERCEL_TEAM_ID') // Opcional

    if (!VERCEL_API_TOKEN || !VERCEL_PROJECT_ID) {
      throw new Error('Credenciais da Vercel ausentes no Supabase.')
    }

    const baseUrl = `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/domains`
    let url = action === 'remove'
      ? `${baseUrl}/${encodeURIComponent(domain)}`
      : baseUrl

    // Se a conta for de Time, anexa o Team ID na URL
    if (VERCEL_TEAM_ID) {
      url += `${url.includes('?') ? '&' : '?'}teamId=${VERCEL_TEAM_ID}`
    }

    console.log(`Executando a acao "${action}" para o dominio ${domain} na Vercel (Project: ${VERCEL_PROJECT_ID})...`)

    const requestInit: RequestInit = {
      method: action === 'remove' ? 'DELETE' : 'POST',
      headers: {
        'Authorization': `Bearer ${VERCEL_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
    }

    if (action === 'add') {
      requestInit.body = JSON.stringify({ name: domain })
    }

    const response = await fetch(url, requestInit)
    const responseText = await response.text()

    let data: unknown = null
    if (responseText) {
      try {
        data = JSON.parse(responseText)
      } catch (_parseError) {
        data = { raw: responseText }
      }
    }

    if (!response.ok) {
      console.error(`Erro retornado pela Vercel ao ${action === 'add' ? 'adicionar' : 'remover'} dominio:`, data)
      throw new Error((data as { error?: { message?: string } })?.error?.message || 'Falha na API da Vercel')
    }

    console.log(`Dominio ${action === 'add' ? 'adicionado' : 'removido'} com sucesso:`, data)

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

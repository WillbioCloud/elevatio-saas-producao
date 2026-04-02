import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-application-name',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const body = await req.json().catch(() => ({}))
    const requestedDomain = body.domain || body.subdomain

    if (!requestedDomain) throw new Error("Domínio não informado na requisição.")

    const cleanDomain = requestedDomain.toLowerCase().trim().replace(/^https?:\/\//, '').replace(/\/$/, '')

    // 1. VERIFICAÇÃO INTERNA (Seus clientes atuais)
    const { data: localData, error: localError } = await supabaseAdmin
      .from('companies')
      .select('id')
      .or(`domain.eq.${cleanDomain},subdomain.eq.${cleanDomain},domain_secondary.eq.${cleanDomain}`)
      .limit(1)

    if (localError) throw localError

    if (localData && localData.length > 0) {
      return new Response(
        JSON.stringify({ available: false, domain: cleanDomain, reason: 'Em uso no sistema' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // 2. VERIFICAÇÃO GLOBAL DA INTERNET (DNS + WHOIS)
    let isGloballyAvailable = true;

    if (cleanDomain.includes('.')) {
      try {
        // ETAPA A: Checagem infalível de DNS no Google (Fura bloqueios de Firewall)
        // Status 0 = NOERROR (Domínio existe na internet). Status 3 = NXDOMAIN (Não existe).
        const dnsRes = await fetch(`https://dns.google/resolve?name=${cleanDomain}&type=SOA`);
        const dnsData = await dnsRes.json();

        if (dnsData.Status === 0) {
          isGloballyAvailable = false; // Google confirmou que tem dono
        } 
        else if (dnsData.Status === 3) {
          // ETAPA B: Dupla Verificação (RDAP)
          // Se não tem DNS, pode ser um domínio congelado por falta de pagamento. Vamos checar o WHOIS.
          // Disfarçamos a Edge Function como se fosse o Chrome do Windows para o Registro.br não bloquear
          const headers = { 
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'application/rdap+json'
          };

          if (cleanDomain.endsWith('.br')) {
            const rdapRes = await fetch(`https://rdap.registro.br/domain/${cleanDomain}`, { headers });
            if (rdapRes.status === 200) isGloballyAvailable = false; // Achou o registro
            
          } else if (cleanDomain.endsWith('.com')) {
            const rdapRes = await fetch(`https://rdap.verisign.com/com/v1/domain/${cleanDomain}`, { headers });
            if (rdapRes.status === 200) isGloballyAvailable = false;
          }
        }
      } catch (externalError) {
        console.error("Falha ao checar API externa:", externalError);
      }
    }

    return new Response(
      JSON.stringify({ available: isGloballyAvailable, domain: cleanDomain }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
    )
  }
})

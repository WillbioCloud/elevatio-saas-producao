import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

serve(async (req) => {
  // Truque de CORS dinâmico para não bloquear no Safari/Aba Anônima
  const requestedHeaders =
    req.headers.get("Access-Control-Request-Headers") ||
    "authorization, x-client-info, apikey, content-type, accept";
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": requestedHeaders,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { domain } = await req.json();
    if (!domain) throw new Error("Domínio não informado");

    let isAvailable = false;
    const cleanDomain = domain.toLowerCase().trim();

    // Verificação oficial no Registro.br (.br)
    if (cleanDomain.endsWith(".br")) {
      const res = await fetch(`https://rdap.registro.br/domain/${cleanDomain}`);
      // Se retornar 404, não tem dono = Disponível!
      isAvailable = res.status === 404;
    }
    // Verificação oficial internacional (.com, .net, etc)
    else {
      const res = await fetch(`https://rdap.verisign.com/com/v1/domain/${cleanDomain}`);
      isAvailable = res.status === 404;
    }

    return new Response(JSON.stringify({ available: isAvailable, domain: cleanDomain }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error: any) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});

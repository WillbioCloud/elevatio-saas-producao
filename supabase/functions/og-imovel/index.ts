import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1"

serve(async (req) => {
  const url = new URL(req.url);
  const propertyId = url.searchParams.get('id');
  const tenantUrl = url.searchParams.get('tenant_url') || 'https://seusite.com';

  if (!propertyId) {
    return new Response("ID do imóvel não fornecido", { status: 400 });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  const { data: property } = await supabase
    .from('properties')
    .select('id, slug, title, description, images')
    .eq('id', propertyId)
    .single();

  if (!property) {
    return new Response("Imóvel não encontrado", { status: 404 });
  }

  const ogImage = property.images?.[0] || `${tenantUrl}/fallback-image.jpg`;
  const cleanDescription = property.description?.replace(/<[^>]+>/g, '').substring(0, 150) + '...';
  const realPropertyUrl = `${tenantUrl}/imovel/${property.slug || property.id}`;

  // ─── O CÉREBRO: CHECAGEM DE BOT VS HUMANO ──────────────────────
  const userAgent = req.headers.get('user-agent') || '';
  const isBot = /bot|facebook|whatsapp|telegram|twitter|linkedin|skype/i.test(userAgent);

  // SE FOR UM HUMANO (Clicou no link do WhatsApp)
  if (!isBot) {
    // Faz um redirecionamento de servidor (HTTP 302). 
    // O navegador vai para a URL do site instantaneamente, sem baixar nenhum HTML.
    return Response.redirect(realPropertyUrl, 302);
  }

  // SE FOR UM ROBÔ (WhatsApp lendo o link para gerar a prévia)
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${property.title}</title>
  <meta property="og:type" content="website">
  <meta property="og:url" content="${realPropertyUrl}">
  <meta property="og:title" content="${property.title}">
  <meta property="og:description" content="${cleanDescription}">
  <meta property="og:image" content="${ogImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="twitter:card" content="summary_large_image">
  <meta property="twitter:title" content="${property.title}">
  <meta property="twitter:description" content="${cleanDescription}">
  <meta property="twitter:image" content="${ogImage}">
</head>
<body></body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8"
    },
  });
});
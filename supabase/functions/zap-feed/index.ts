import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const url = new URL(req.url)
  const subdomain = url.searchParams.get('subdomain')

  if (!subdomain) {
    return new Response("Erro: Informe o subdomínio da imobiliária (?subdomain=nome)", { status: 400 })
  }

  // Conecta ao banco de dados usando as variáveis de ambiente automáticas do Supabase
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_ANON_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  // 1. Descobre quem é a imobiliária
  const { data: company, error: companyError } = await supabase
    .from('companies')
    .select('id, name')
    .eq('subdomain', subdomain)
    .single()

  if (companyError || !company) {
    return new Response("Imobiliária não encontrada", { status: 404 })
  }

  // 2. Busca apenas os imóveis ATIVOS dessa imobiliária
  const { data: properties, error: propertiesError } = await supabase
    .from('properties')
    .select('*')
    .eq('company_id', company.id)
    .eq('status', 'ativo')

  if (propertiesError) {
    return new Response("Erro ao buscar imóveis", { status: 500 })
  }

  // 3. Monta o XML
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n`;
  xml += `  <Imoveis>\n`;

  properties.forEach(prop => {
    let tipoImovel = 'Casa';
    if (prop.type?.toLowerCase().includes('apartamento')) tipoImovel = 'Apartamento';
    if (prop.type?.toLowerCase().includes('terreno') || prop.type?.toLowerCase().includes('lote')) tipoImovel = 'Terreno';
    if (prop.type?.toLowerCase().includes('comercial') || prop.type?.toLowerCase().includes('sala')) tipoImovel = 'Comercial/Industrial';

    xml += `    <Imovel>\n`;
    xml += `      <CodigoImovel>${prop.id}</CodigoImovel>\n`;
    xml += `      <TipoImovel>${tipoImovel}</TipoImovel>\n`;
    xml += `      <SubTipoImovel>${tipoImovel} Padrão</SubTipoImovel>\n`;
    xml += `      <TituloImovel><![CDATA[${prop.title || ''}]]></TituloImovel>\n`;
    xml += `      <Observacao><![CDATA[${prop.description || ''}]]></Observacao>\n`;
    
    if (prop.transaction_type === 'venda' || prop.transaction_type === 'venda_aluguel') {
      xml += `      <PrecoVenda>${prop.price}</PrecoVenda>\n`;
    }
    if (prop.transaction_type === 'aluguel' || prop.transaction_type === 'venda_aluguel') {
      xml += `      <PrecoLocacao>${prop.price}</PrecoLocacao>\n`;
    }
    if (prop.condo_fee) xml += `      <PrecoCondominio>${prop.condo_fee}</PrecoCondominio>\n`;
    if (prop.iptu) xml += `      <PrecoIptu>${prop.iptu}</PrecoIptu>\n`;

    xml += `      <Cidade><![CDATA[${prop.city || ''}]]></Cidade>\n`;
    xml += `      <Estado><![CDATA[${prop.state || ''}]]></Estado>\n`;
    xml += `      <Bairro><![CDATA[${prop.neighborhood || ''}]]></Bairro>\n`;

    xml += `      <QtdDormitorios>${prop.bedrooms || 0}</QtdDormitorios>\n`;
    xml += `      <QtdBanheiros>${prop.bathrooms || 0}</QtdBanheiros>\n`;
    xml += `      <QtdVagas>${prop.garage_spots || 0}</QtdVagas>\n`;
    xml += `      <AreaUtil>${prop.area || 0}</AreaUtil>\n`;
    xml += `      <AreaTotal>${prop.area || 0}</AreaTotal>\n`;

    if (prop.images && prop.images.length > 0) {
      xml += `      <Fotos>\n`;
      prop.images.forEach((img: string, index: number) => {
        xml += `        <Foto>\n`;
        xml += `          <NomeArquivo><![CDATA[Foto ${index + 1}]]></NomeArquivo>\n`;
        xml += `          <URLArquivo><![CDATA[${img}]]></URLArquivo>\n`;
        xml += `          <Principal>${index === 0 ? '1' : '0'}</Principal>\n`;
        xml += `        </Foto>\n`;
      });
      xml += `      </Fotos>\n`;
    }

    xml += `    </Imovel>\n`;
  });

  xml += `  </Imoveis>\n`;
  xml += `</Carga>`;

  // Retorna o XML garantindo que o navegador e os robôs saibam que é um ficheiro XML puro
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Access-Control-Allow-Origin": "*"
    }
  })
})
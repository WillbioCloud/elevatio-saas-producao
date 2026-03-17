import { Property } from '../types';

export const generateZapXML = (properties: Property[], companyName: string): string => {
  let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
  xml += `<Carga xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema">\n`;
  xml += `  <Imoveis>\n`;

  properties.filter(p => p.status?.toLowerCase() === 'ativo').forEach(prop => {
    let tipoImovel = 'Casa';
    const typeStr = (prop.type as string).toLowerCase();
    if (typeStr.includes('apartamento')) tipoImovel = 'Apartamento';
    if (typeStr.includes('terreno') || typeStr.includes('lote')) tipoImovel = 'Terreno';
    if (typeStr.includes('comercial') || typeStr.includes('sala')) tipoImovel = 'Comercial/Industrial';

    const city = prop.city ?? prop.location?.city ?? '';
    const state = prop.state ?? prop.location?.state ?? '';
    const neighborhood = prop.neighborhood ?? prop.location?.neighborhood ?? '';

    xml += `    <Imovel>\n`;
    xml += `      <CodigoImovel>${prop.id}</CodigoImovel>\n`;
    xml += `      <TipoImovel>${tipoImovel}</TipoImovel>\n`;
    xml += `      <SubTipoImovel>${tipoImovel} Padrão</SubTipoImovel>\n`;
    xml += `      <TituloImovel><![CDATA[${prop.title}]]></TituloImovel>\n`;
    xml += `      <Observacao><![CDATA[${prop.description}]]></Observacao>\n`;

    // Preços baseados em listing_type
    if (prop.listing_type === 'sale' || !prop.listing_type) {
      xml += `      <PrecoVenda>${prop.price}</PrecoVenda>\n`;
    }
    if (prop.listing_type === 'rent') {
      xml += `      <PrecoLocacao>${prop.price}</PrecoLocacao>\n`;
    }
    if (prop.condominium) xml += `      <PrecoCondominio>${prop.condominium}</PrecoCondominio>\n`;
    if (prop.iptu) xml += `      <PrecoIptu>${prop.iptu}</PrecoIptu>\n`;

    // Localização
    xml += `      <Cidade><![CDATA[${city}]]></Cidade>\n`;
    xml += `      <Estado><![CDATA[${state}]]></Estado>\n`;
    xml += `      <Bairro><![CDATA[${neighborhood}]]></Bairro>\n`;

    // Características
    xml += `      <QtdDormitorios>${prop.bedrooms || 0}</QtdDormitorios>\n`;
    xml += `      <QtdBanheiros>${prop.bathrooms || 0}</QtdBanheiros>\n`;
    xml += `      <QtdVagas>${prop.garage || 0}</QtdVagas>\n`;
    xml += `      <AreaUtil>${prop.area || 0}</AreaUtil>\n`;
    xml += `      <AreaTotal>${prop.built_area || prop.area || 0}</AreaTotal>\n`;

    // Imagens
    if (prop.images && prop.images.length > 0) {
      xml += `      <Fotos>\n`;
      prop.images.forEach((img, index) => {
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
  return xml;
};

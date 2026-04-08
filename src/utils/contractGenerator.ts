// Conversor de imagem para contornar CORS e incompatibilidade de WebP no jsPDF
const fetchImageAsBase64PNG = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx?.drawImage(img, 0, 0);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => reject(new Error('Falha ao converter imagem'));
    img.src = url;
  });
};

const escapeSignatureStampHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const normalizeSignatureKey = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');

const humanizeSignatureKey = (value: string) =>
  value
    .split('_')
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Signatario';

const resolveSignatureRoleKey = (value: string) => {
  const normalizedRole = normalizeSignatureKey(value);

  if (
    normalizedRole.includes('proprietario') ||
    normalizedRole.includes('vendedor') ||
    normalizedRole.includes('locador') ||
    normalizedRole.includes('dono')
  ) {
    return 'proprietario';
  }

  if (
    normalizedRole.includes('inquilino') ||
    normalizedRole.includes('locatario') ||
    normalizedRole.includes('comprador') ||
    normalizedRole.includes('cliente')
  ) {
    return 'cliente';
  }

  if (
    normalizedRole.includes('imobiliaria') ||
    normalizedRole.includes('corretor') ||
    normalizedRole.includes('administrador') ||
    normalizedRole.includes('administradora') ||
    normalizedRole.includes('admin')
  ) {
    return 'imobiliaria';
  }

  if (normalizedRole.includes('fiador')) {
    return 'fiador';
  }

  if (normalizedRole.includes('testemunha')) {
    return 'testemunha';
  }

  return normalizedRole;
};

const SIGNATURE_ROLE_ALIASES: Record<string, string[]> = {
  inquilino: ['inquilino', 'locatario', 'cliente', 'comprador'],
  locatario: ['locatario', 'cliente'],
  cliente: ['cliente', 'inquilino', 'locatario', 'comprador'],
  comprador: ['comprador', 'cliente'],
  vendedor: ['vendedor', 'proprietario', 'locador'],
  proprietario: ['proprietario', 'vendedor', 'locador', 'dono'],
  locador: ['locador', 'proprietario', 'vendedor'],
  dono: ['dono', 'proprietario', 'vendedor', 'locador'],
  fiador: ['fiador'],
  testemunha: ['testemunha'],
  corretor: ['corretor', 'imobiliaria', 'administrador', 'administradora', 'admin'],
  imobiliaria: ['imobiliaria', 'corretor', 'administrador', 'administradora', 'admin'],
  administrador: ['administrador', 'administradora', 'imobiliaria', 'corretor', 'admin'],
  administradora: ['administradora', 'administrador', 'imobiliaria', 'corretor'],
  admin: ['admin', 'administrador', 'administradora', 'imobiliaria', 'corretor'],
};

type SignatureStampEntry = {
  signer_name?: string | null;
  signer_role?: string | null;
  signer_document?: string | null;
  signer_ip?: string | null;
  ip_address?: string | null;
  signed_at?: string | null;
  signature_image?: string | null;
};

type SignatureStampDocumentMap = Record<string, string | null | undefined>;

export const generateSignatureStampHtml = (
  signatureImage: string | null,
  name: string,
  role: string,
  cpf: string = 'Não informado',
  signedAt: string | null,
  ip: string = 'IP não registrado'
) => {
  const safeName = escapeSignatureStampHtml(name || 'Signatario');
  const safeRole = escapeSignatureStampHtml(role || 'Parte');
  const safeCpf = escapeSignatureStampHtml(cpf || 'Não informado');
  const safeIp = escapeSignatureStampHtml(ip || 'IP não registrado');

  if (!signatureImage || !signedAt) {
    return `<div style="padding: 20px; border: 1px dashed #cbd5e1; border-radius: 8px; color: #64748b; text-align: center; font-size: 12px; font-family: sans-serif;">Aguardando assinatura digital de<br/><strong>${safeName}</strong> (${safeRole})</div>`;
  }

  const signedAtDate = new Date(signedAt);
  const dataFormatada = Number.isNaN(signedAtDate.getTime())
    ? escapeSignatureStampHtml(signedAt)
    : signedAtDate.toLocaleString('pt-BR');

  return `
    <div style="display: flex; align-items: center; justify-content: center; page-break-inside: avoid; margin: 0 auto; font-family: Arial, Helvetica, sans-serif; text-align: left; width: fit-content;">
      <div style="width: 120px; height: 50px; display: flex; align-items: center; justify-content: flex-end; padding-right: 10px;">
        <img src="${signatureImage}" style="max-width: 100%; max-height: 100%; object-fit: contain; mix-blend-multiply;" alt="Assinatura" />
      </div>
      
      <div style="display: flex; flex-direction: column; justify-content: center; padding-left: 10px; line-height: 1.2;">
        <span style="font-size: 9px; color: #111827; margin: 0;">${safeName}</span>
        <span style="font-size: 9px; color: #4b5563; margin: 2px 0 0 0;">${safeRole}${safeCpf !== 'Não informado' ? ` | CPF: ${safeCpf}` : ''}</span>
        <span style="font-size: 8px; color: #6b7280; margin: 2px 0 0 0;">Data: ${dataFormatada}</span>
        <span style="font-size: 8px; color: #6b7280; margin: 2px 0 0 0;">IP: ${safeIp}</span>
      </div>
    </div>
  `;
};

const getSignatureCandidatesForPlaceholder = (
  placeholderRole: string,
  signatures: SignatureStampEntry[]
) => {
  const normalizedRole = normalizeSignatureKey(placeholderRole);
  const match = normalizedRole.match(/^(.*?)(?:_(\d+))?$/);
  const baseRole = match?.[1] || normalizedRole;
  const resolvedBaseRole = resolveSignatureRoleKey(baseRole);
  const requestedIndex = match?.[2] ? Math.max(Number(match[2]) - 1, 0) : 0;
  const aliasSet = new Set([
    baseRole,
    resolvedBaseRole,
    ...(SIGNATURE_ROLE_ALIASES[baseRole] || []),
    ...(SIGNATURE_ROLE_ALIASES[resolvedBaseRole] || []),
  ]);
  const matchingSignatures = signatures.filter((signature) =>
    aliasSet.has(normalizeSignatureKey(signature.signer_role || '')) ||
    aliasSet.has(resolveSignatureRoleKey(signature.signer_role || ''))
  );

  return {
    baseRole,
    resolvedBaseRole,
    requestedIndex,
    matchingSignatures,
  };
};

export const injectSignatureStamps = async (
  html: string,
  signatures: SignatureStampEntry[] = [],
  documentsOrAdminSignatureUrl: SignatureStampDocumentMap | string = {},
  adminSignatureUrl?: string
) => {
  const documents =
    typeof documentsOrAdminSignatureUrl === 'string' ? {} : documentsOrAdminSignatureUrl;
  const resolvedAdminSignatureUrl =
    typeof documentsOrAdminSignatureUrl === 'string'
      ? documentsOrAdminSignatureUrl
      : adminSignatureUrl;

  if (!/\{\{ASSINATURA_[^}]+\}\}/i.test(html)) {
    return html;
  }

  let finalHtml = html.replace(/\{\{ASSINATURA_([^}]+)\}\}/gi, (fullMatch, placeholderRole: string) => {
    const { baseRole, resolvedBaseRole, requestedIndex, matchingSignatures } = getSignatureCandidatesForPlaceholder(
      placeholderRole,
      signatures
    );
    const signature = matchingSignatures[requestedIndex] || matchingSignatures[0] || null;
    if (!signature?.signature_image || !signature?.signed_at) {
      // Preserva a tag da imobiliaria para o fallback estatico no passo final.
      if (resolvedBaseRole === 'imobiliaria') {
        return fullMatch;
      }

      return '';
    }

    const aliasFallback =
      (SIGNATURE_ROLE_ALIASES[baseRole] || [])[0] ||
      (SIGNATURE_ROLE_ALIASES[resolvedBaseRole] || [])[0] ||
      '';
    const documentValue =
      signature?.signer_document ||
      documents[baseRole] ||
      documents[resolvedBaseRole] ||
      documents[aliasFallback] ||
      'Não informado';
    const fallbackLabel = humanizeSignatureKey(baseRole);

    return generateSignatureStampHtml(
      signature?.signature_image || null,
      signature?.signer_name || fallbackLabel,
      signature?.signer_role || fallbackLabel,
      documentValue || 'Não informado',
      signature?.signed_at || null,
      signature?.signer_ip || signature?.ip_address || 'IP não registrado'
    );
  });

  const remainingTags = [
    '{{ASSINATURA_PROPRIETARIO}}',
    '{{ASSINATURA_INQUILINO}}',
    '{{ASSINATURA_COMPRADOR}}',
    '{{ASSINATURA_IMOBILIARIA}}',
    '{{ASSINATURA_FIADOR}}',
    '{{ASSINATURA_TESTEMUNHA_1}}',
    '{{ASSINATURA_TESTEMUNHA_2}}',
  ];

  remainingTags.forEach((tag) => {
    if (finalHtml.includes(tag)) {
      if (tag === '{{ASSINATURA_IMOBILIARIA}}' && resolvedAdminSignatureUrl) {
        // Substituicao segura sem Regex
        const staticImage = `<img src="${resolvedAdminSignatureUrl}" style="max-height: 55px; max-width: 180px; object-fit: contain; mix-blend-multiply;" alt="Assinatura Imobiliária" />`;
        finalHtml = finalHtml.split(tag).join(staticImage);
      } else {
        // Limpa a tag com seguranca
        finalHtml = finalHtml.split(tag).join('');
      }
    }
  });

  return finalHtml;
};

const parseCurrencyNumber = (value: unknown): number => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }

  if (typeof value === 'string') {
    const normalized = value
      .trim()
      .replace(/\s/g, '')
      .replace(/[R$r$]/g, '')
      .replace(/\.(?=\d{3}(\D|$))/g, '')
      .replace(',', '.')
      .replace(/[^\d.-]/g, '');

    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  return 0;
};

const joinPtBr = (parts: string[]) => {
  const filtered = parts.filter(Boolean);
  if (filtered.length <= 1) return filtered[0] || '';
  return `${filtered.slice(0, -1).join(', ')} e ${filtered[filtered.length - 1]}`;
};

const numberToWordsPtBr = (value: number): string => {
  const safeValue = Math.floor(Math.abs(value));
  if (safeValue === 0) return 'zero';

  const units = ['zero', 'um', 'dois', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove'];
  const teens = ['dez', 'onze', 'doze', 'treze', 'quatorze', 'quinze', 'dezesseis', 'dezessete', 'dezoito', 'dezenove'];
  const tens = ['', '', 'vinte', 'trinta', 'quarenta', 'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa'];
  const hundreds = ['', 'cento', 'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos', 'oitocentos', 'novecentos'];
  const scales = [
    { singular: '', plural: '' },
    { singular: 'mil', plural: 'mil' },
    { singular: 'milhao', plural: 'milhoes' },
    { singular: 'bilhao', plural: 'bilhoes' },
    { singular: 'trilhao', plural: 'trilhoes' },
  ];

  const convertHundreds = (chunk: number): string => {
    if (chunk === 0) return '';
    if (chunk === 100) return 'cem';

    const parts: string[] = [];
    const hundred = Math.floor(chunk / 100);
    const remainder = chunk % 100;

    if (hundred > 0) {
      parts.push(hundreds[hundred]);
    }

    if (remainder > 0) {
      if (remainder < 10) {
        parts.push(units[remainder]);
      } else if (remainder < 20) {
        parts.push(teens[remainder - 10]);
      } else {
        const ten = Math.floor(remainder / 10);
        const unit = remainder % 10;
        parts.push(unit ? `${tens[ten]} e ${units[unit]}` : tens[ten]);
      }
    }

    return parts.join(' e ');
  };

  const chunks: number[] = [];
  let remaining = safeValue;

  while (remaining > 0) {
    chunks.unshift(remaining % 1000);
    remaining = Math.floor(remaining / 1000);
  }

  const parts = chunks.reduce<string[]>((acc, chunk, index) => {
    if (!chunk) return acc;

    const scaleIndex = chunks.length - 1 - index;
    const chunkText = convertHundreds(chunk);

    if (scaleIndex === 0) {
      acc.push(chunkText);
      return acc;
    }

    if (scaleIndex === 1) {
      acc.push(chunk === 1 ? 'mil' : `${chunkText} mil`);
      return acc;
    }

    const scale = scales[scaleIndex] || scales[scales.length - 1];
    acc.push(`${chunk === 1 ? 'um' : chunkText} ${chunk === 1 ? scale.singular : scale.plural}`);
    return acc;
  }, []);

  return joinPtBr(parts);
};

const currencyToWordsPtBr = (value: unknown): string => {
  const amount = parseCurrencyNumber(value);

  if (!amount) {
    return 'zero real';
  }

  const integerPart = Math.floor(amount);
  const centsPart = Math.round((amount - integerPart) * 100);
  const textParts: string[] = [];

  if (integerPart > 0) {
    textParts.push(`${numberToWordsPtBr(integerPart)} ${integerPart === 1 ? 'real' : 'reais'}`);
  }

  if (centsPart > 0) {
    textParts.push(`${numberToWordsPtBr(centsPart)} ${centsPart === 1 ? 'centavo' : 'centavos'}`);
  }

  return joinPtBr(textParts);
};

const formatLongDatePtBr = (value: string | Date) => {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '___ de __________ de _____';

  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(date);
};

const formatPercentagePtBr = (value: unknown, fallback = 0) => {
  const parsed = parseCurrencyNumber(value);
  const resolved = parsed > 0 ? parsed : fallback;

  return new Intl.NumberFormat('pt-BR', {
    minimumFractionDigits: Number.isInteger(resolved) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(resolved);
};

export const buildContractHtml = async (
  type: string,
  data: any,
  tenant: any,
  companyLogo?: string,
  brokerDisplayName: string = 'Imobiliária',
  brokerDisplayDoc: string = '',
  brokerDisplayCreci: string = '',
  companyName: string = '',
  customTemplateContent?: string
) => {
  const agencySignatureUrl = tenant?.admin_signature_url || '';

  // Função auxiliar para evitar "undefined" e permitir múltiplos fallbacks
  const val = (...values: any[]) => {
    const fallback = '______________________';

    for (const value of values) {
      if (typeof value === 'string') {
        if (value.trim() !== '') {
          return value;
        }
        continue;
      }

      if (value !== undefined && value !== null && value !== '') {
        return value;
      }
    }

    return fallback;
  };

  // 1. Gera a data formatada em português
  const dateObj = data.created_at ? new Date(data.created_at) : new Date();
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  const dataFormatada = `${dateObj.getDate()} de ${meses[dateObj.getMonth()]} de ${dateObj.getFullYear()}`;

  // 2. Define o local da assinatura (Prioriza a cidade do Imóvel, fallback para a cidade da Imobiliária)
  const cityLocation = val(data.property_city, data.property?.city, tenant?.city, 'Cidade');
  const stateLocation = val(data.property_state, data.property?.state, tenant?.state, 'UF');

  // Converte a logo para Base64/PNG para evitar CORS e incompatibilidade de formato
  let logoSrc = tenant?.logo_url || '/img/Logo-contrato.png';
  const logoToConvert = companyLogo || tenant?.logo_url;
  if (logoToConvert) {
    try {
      logoSrc = await fetchImageAsBase64PNG(logoToConvert);
    } catch (e) {
      console.warn('Erro ao converter logo, usando URL original', e);
      logoSrc = logoToConvert;
    }
  }

  let adminSignatureSrc = '';
  if (tenant?.admin_signature_url) {
    try {
      adminSignatureSrc = await fetchImageAsBase64PNG(tenant.admin_signature_url);
    } catch (e) {
      console.warn('Erro ao converter assinatura, usando URL original', e);
      adminSignatureSrc = tenant.admin_signature_url;
    }
  }

  // Estilos CSS para simular uma folha A4 e formatação jurídica
  const styles = `<style>
    @import url('https://fonts.googleapis.com/css2?family=Merriweather:ital,wght@0,300;0,400;0,700;1,400&family=Roboto:wght@400;700&display=swap');
    
    /* Configuração global da página física para o navegador */
    @page {
      size: A4;
      margin: 15mm 20mm; /* Força o navegador a usar essa margem segura */
    }
    
    body {
      font-family: 'Merriweather', serif;
      color: #000;
      line-height: 1.6;
      margin: 0;
      padding: 0;
      background: #f0f0f0;
    }
    
    /* Visualização na Tela (Preview do Contrato) */
    .a4-page {
      width: 210mm;
      min-height: 297mm;
      padding: 15mm 20mm; /* Simula a margem na tela */
      margin: 10mm auto;
      border: 1px #D3D3D3 solid;
      border-radius: 5px;
      background: white;
      box-shadow: 0 0 5px rgba(0, 0, 0, 0.1);
      box-sizing: border-box;
    }
    
    .header {
      margin-bottom: 0.5cm;
      border-bottom: 1px solid #000;
      padding-bottom: 0.3cm;
      font-family: 'Roboto', sans-serif;
      display: flex;
      flex-direction: row;
      align-items: center;
      justify-content: space-between;
    }
    
    .header-text {
      text-align: right;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    
    .logo {
      height: 1.4cm;
      max-width: 2.43cm;
      object-fit: contain;
      margin: 0;
    }
    
    h1 {
      font-size: 18px;
      text-transform: uppercase;
      text-align: center;
      margin: 20px 0;
    }
    
    h2 {
      font-size: 14px;
      font-weight: bold;
      margin-top: 25px;
      margin-bottom: 10px;
    }
    
    p {
      font-size: 12px;
      text-align: justify;
      margin-bottom: 10px;
    }
    
    .signatures {
      margin-top: 50px;
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 40px;
    }

    .signature-block {
      margin-top: 40px;
      page-break-inside: avoid;
      text-align: center;
    }

    .signature-block .signature-line {
      margin-top: 6px;
    }

    .signature-image {
      display: block;
      max-height: 72px;
      max-width: 220px;
      margin: 0 auto;
      object-fit: contain;
    }
    
    .signature-line {
      border-top: 1px solid #000;
      text-align: center;
      padding-top: 5px;
      font-size: 12px;
      margin-top: 40px;
      page-break-inside: avoid; /* Evita que a assinatura seja cortada no meio entre duas páginas */
    }
    
    /* Comportamento real de Impressão */
    @media print {
      body { 
        background: white; 
        margin: 0;
        -webkit-print-color-adjust: exact; /* Força a manter as cores originais da logo */
        print-color-adjust: exact;
      }
      .a4-page { 
        margin: 0; 
        padding: 0; /* Zeramos o padding aqui para que apenas o margin do @page atue! */
        border: none; 
        border-radius: 0; 
        width: 100%; 
        min-height: auto; 
        box-shadow: none; 
        background: transparent; 
        page-break-after: always;
      }
      
      /* Opcional: Evitar que títulos fiquem isolados no final de uma página */
      h2 {
        page-break-after: avoid;
      }
      
      /* Repetir cabeçalho em todas as páginas */
      thead {
        display: table-header-group;
      }
      
      tbody {
        display: table-row-group;
      }
    }
    
    /* Estilos para a tabela de estrutura */
    table {
      width: 100%;
      border-collapse: collapse;
      border-spacing: 0;
    }
    
    th, td {
      padding: 0;
      text-align: left;
      vertical-align: top;
    }
  </style>`;

  // Preenchimento automático de profissão padrão (Autônomo) para campos vazios
  const defaultProf = 'Autônomo';
  const profFields = ['buyer_profession', 'seller_profession', 'landlord_profession', 'tenant_profession', 'buyer_spouse_profession', 'seller_spouse_profession', 'guarantor_profession', 'landlord_spouse_profession', 'tenant_spouse_profession'];
  profFields.forEach(field => {
    if (!data[field] || String(data[field]).trim() === '') {
      data[field] = defaultProf;
    }
  });

  // Função auxiliar para imprimir dados do cônjuge
  const spouseText = (name: string, doc: string, rg: string, prof: string) => 
    name ? `, juntamente com seu cônjuge/companheiro(a): <strong>${name}</strong>, portador(a) do RG nº ${val(rg)} e CPF nº ${val(doc)}, Profissão: ${val(prof)}` : '';

  // Extrai o siteData para acessar os dados da Empresa/Sede
  const siteData = typeof tenant?.site_data === 'string' ? JSON.parse(tenant.site_data) : tenant?.site_data || {};

  // Lógica de Fallback Inteligente (Sede > Perfil Corretor > Tenant Base)
  const resolvedBrokerDisplayName =
    siteData.corporate_name || brokerDisplayName || tenant?.name || 'Corretor / Imobiliária';
  const finalDocument = siteData.cnpj || brokerDisplayDoc;
  const resolvedBrokerDisplayDoc = finalDocument ? `CPF/CNPJ: ${finalDocument}` : 'CPF/CNPJ: Não informado';
  const finalCreci = siteData.creci || brokerDisplayCreci;
  const resolvedBrokerDisplayCreci = finalCreci ? `CRECI: ${finalCreci}` : '';

  // Montagem do Endereço e Contatos da Sede
  let companyFullAddress = '__________________________________________________________________';
  if (siteData.address?.street) {
    companyFullAddress = `${siteData.address.street}, ${siteData.address.number || 's/n'}${siteData.address.neighborhood ? ' - ' + siteData.address.neighborhood : ''}, ${siteData.address.city || ''}/${siteData.address.state || ''}`;
  }
  const companyPhone = siteData.contact_phone || tenant?.phone || '________________';
  const companyEmail = siteData.contact_email || (tenant?.subdomain ? `contato@${tenant.subdomain}.com.br` : '________________');
  const propertyAddress =
    data.property_address ||
    `${data.property?.street || '_________________'}, ${data.property?.number || 's/n'} - ${data.property?.neighborhood || '_________________'}, ${data.property?.city || '________'}/${data.property?.state || '___'}`;
  const dealValue = data.sale_total_value || data.total_value || data.rent_value || 0;
  const adminSignatureMarkup = adminSignatureSrc
    ? `<img src="${adminSignatureSrc}" alt="Assinatura da imobiliaria" class="signature-image" />`
    : '';

  // Bloco HTML reutilizável para a assinatura do intermediador
  const brokerSignature = (roleLabel: string) => `
    <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
      <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
        ${agencySignatureUrl
          ? `<img src="${agencySignatureUrl}" style="max-height: 55px; max-width: 180px; object-fit: contain; mix-blend-multiply;" alt="Assinatura Imobiliária" />`
          : '{{ASSINATURA_IMOBILIARIA}}'}
      </div>
      __________________________________________________<br/>
      <strong style="font-size: 11px; color: #000;">${resolvedBrokerDisplayName}</strong><br/>
      <span style="font-size: 11px; color: #000;">${resolvedBrokerDisplayDoc}</span><br/>
      <span style="font-size: 11px; color: #000;">${resolvedBrokerDisplayCreci ? resolvedBrokerDisplayCreci : 'CRECI: ________________' }</span><br/>
      <span style="font-size: 11px; color: #000;">${roleLabel}</span>
    </div>
  `;

  // Conteúdo dinâmico dependendo do tipo de contrato
  let contractContent = '';

  // LÓGICA DO CONTRATO CUSTOMIZADO (ENGINE DE SHORTCODES)
  if (type.startsWith('custom_') && customTemplateContent) {
    const formatCurrency = (v: unknown) => new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseCurrencyNumber(v));
    const leaseDuration = data.lease_duration || data.installments_count || '____________________';
    const dueDateLabel = data.due_day ? `dia ${data.due_day}` : '____________________';

    let parsedContent = customTemplateContent
      // DADOS DA IMOBILIÁRIA / CORRETOR
      .replace(/\{\{IMOBILIARIA_NOME\}\}/g, siteData.corporate_name || tenant?.name || '____________________')
      .replace(/\{\{IMOBILIARIA_CNPJ\}\}/g, finalDocument || '____________________')
      .replace(/\{\{IMOBILIARIA_ENDERECO\}\}/g, companyFullAddress)
      .replace(/\{\{IMOBILIARIA_ASSINATURA\}\}/g, adminSignatureMarkup)
      .replace(/\{\{CORRETOR_NOME\}\}/g, resolvedBrokerDisplayName)
      .replace(/\{\{CORRETOR_CPF\}\}/g, finalDocument || '____________________')
      .replace(/\{\{CORRETOR_CRECI\}\}/g, finalCreci || '____________________')
      // DADOS DO IMÓVEL
      .replace(/\{\{IMOVEL_TITULO\}\}/g, data.property?.title || '____________________')
      .replace(/\{\{IMOVEL_ENDERECO\}\}/g, propertyAddress)
      .replace(/\{\{IMOVEL_MATRICULA\}\}/g, data.property?.registration_number || data.property?.iptu_number || '____________________')
      // DADOS DO LOCATÁRIO / COMPRADOR (CLIENTE PRINCIPAL)
      .replace(/\{\{LOCATARIO_NOME\}\}/g, data.tenant_name || data.buyer_name || data.lead?.name || '____________________')
      .replace(/\{\{LOCATARIO_CPF\}\}/g, data.tenant_document || data.buyer_document || '____________________')
      .replace(/\{\{LOCATARIO_RG\}\}/g, data.tenant_rg || data.buyer_rg || '____________________')
      .replace(/\{\{LOCATARIO_PROFISSAO\}\}/g, data.tenant_profession || data.buyer_profession || 'Autônomo')
      .replace(/\{\{LOCATARIO_ESTADO_CIVIL\}\}/g, data.tenant_marital_status || data.buyer_marital_status || '____________________')
      .replace(/\{\{LOCATARIO_ENDERECO\}\}/g, data.tenant_address || data.buyer_address || '____________________')
      .replace(/\{\{LOCATARIO_EMAIL\}\}/g, data.lead?.email || '____________________')
      .replace(/\{\{LOCATARIO_TELEFONE\}\}/g, data.lead?.phone || '____________________')
      .replace(/\{\{LOCATARIO_CONJUGE_NOME\}\}/g, data.tenant_spouse_name || data.buyer_spouse_name || '____________________')
      .replace(/\{\{LOCATARIO_CONJUGE_CPF\}\}/g, data.tenant_spouse_document || data.buyer_spouse_document || '____________________')
      .replace(/\{\{LOCATARIO_CONJUGE_PROFISSAO\}\}/g, data.tenant_spouse_profession || data.buyer_spouse_profession || 'Autônomo')
      // Aliases de compatibilidade (CLIENTE = LOCATÁRIO)
      .replace(/\{\{CLIENTE_NOME\}\}/g, data.tenant_name || data.buyer_name || data.lead?.name || '____________________')
      .replace(/\{\{CLIENTE_CPF\}\}/g, data.tenant_document || data.buyer_document || '____________________')
      .replace(/\{\{CLIENTE_RG\}\}/g, data.tenant_rg || data.buyer_rg || '____________________')
      .replace(/\{\{CLIENTE_NACIONALIDADE\}\}/g, data.tenant_nationality || data.buyer_nationality || '____________________')
      .replace(/\{\{CLIENTE_PROFISSAO\}\}/g, data.tenant_profession || data.buyer_profession || 'Autônomo')
      .replace(/\{\{CLIENTE_ESTADO_CIVIL\}\}/g, data.tenant_marital_status || data.buyer_marital_status || '____________________')
      .replace(/\{\{CLIENTE_ENDERECO\}\}/g, data.tenant_address || data.buyer_address || '____________________')
      .replace(/\{\{CLIENTE_EMAIL\}\}/g, data.lead?.email || '____________________')
      .replace(/\{\{CLIENTE_TELEFONE\}\}/g, data.lead?.phone || '____________________')
      // DADOS DO LOCADOR / PROPRIETÁRIO (VENDEDOR)
      .replace(/\{\{LOCADOR_NOME\}\}/g, data.landlord_name || data.seller_name || data.property?.owner_name || '____________________')
      .replace(/\{\{LOCADOR_CPF\}\}/g, data.landlord_document || data.seller_document || data.property?.owner_document || '____________________')
      .replace(/\{\{LOCADOR_RG\}\}/g, data.landlord_rg || data.seller_rg || '____________________')
      .replace(/\{\{LOCADOR_PROFISSAO\}\}/g, data.landlord_profession || data.seller_profession || 'Autônomo')
      .replace(/\{\{LOCADOR_ESTADO_CIVIL\}\}/g, data.landlord_marital_status || data.seller_marital_status || '____________________')
      .replace(/\{\{LOCADOR_ENDERECO\}\}/g, data.landlord_address || data.seller_address || '____________________')
      .replace(/\{\{LOCADOR_CONJUGE_NOME\}\}/g, data.landlord_spouse_name || data.seller_spouse_name || '____________________')
      .replace(/\{\{LOCADOR_CONJUGE_CPF\}\}/g, data.landlord_spouse_document || data.seller_spouse_document || '____________________')
      .replace(/\{\{LOCADOR_CONJUGE_PROFISSAO\}\}/g, data.landlord_spouse_profession || data.seller_spouse_profession || 'Autônomo')
      // Aliases de compatibilidade (PROPRIETÁRIO = LOCADOR)
      .replace(/\{\{PROPRIETARIO_NOME\}\}/g, data.landlord_name || data.seller_name || data.property?.owner_name || '____________________')
      .replace(/\{\{PROPRIETARIO_CPF\}\}/g, data.landlord_document || data.seller_document || data.property?.owner_document || '____________________')
      .replace(/\{\{PROPRIETARIO_RG\}\}/g, data.landlord_rg || data.seller_rg || '____________________')
      .replace(/\{\{PROPRIETARIO_PROFISSAO\}\}/g, data.landlord_profession || data.seller_profession || 'Autônomo')
      .replace(/\{\{PROPRIETARIO_ESTADO_CIVIL\}\}/g, data.landlord_marital_status || data.seller_marital_status || '____________________')
      .replace(/\{\{PROPRIETARIO_ENDERECO\}\}/g, data.landlord_address || data.seller_address || '____________________')
      // DADOS DO FIADOR (SE HOUVER)
      .replace(/\{\{FIADOR_NOME\}\}/g, data.guarantor_name || '____________________')
      .replace(/\{\{FIADOR_CPF\}\}/g, data.guarantor_document || '____________________')
      .replace(/\{\{FIADOR_RG\}\}/g, data.guarantor_rg || '____________________')
      .replace(/\{\{FIADOR_PROFISSAO\}\}/g, data.guarantor_profession || 'Autônomo')
      .replace(/\{\{FIADOR_ESTADO_CIVIL\}\}/g, data.guarantor_marital_status || '____________________')
      .replace(/\{\{FIADOR_ENDERECO\}\}/g, data.guarantor_address || '____________________')
      // VALORES E CONDIÇÕES
      .replace(/\{\{VALOR_NEGOCIADO\}\}/g, formatCurrency(dealValue))
      .replace(/\{\{VALOR_TOTAL\}\}/g, formatCurrency(dealValue))
      .replace(/\{\{VALOR_TOTAL_EXTENSO\}\}/g, currencyToWordsPtBr(dealValue))
      .replace(/\{\{VALOR_SINAL\}\}/g, formatCurrency(data.sale_down_payment))
      .replace(/\{\{VALOR_FINANCIAMENTO\}\}/g, formatCurrency(data.sale_financing_value))
      .replace(/\{\{VALOR_FGTS\}\}/g, formatCurrency(data.sale_consortium_value))
      .replace(/\{\{VALOR_PERMUTA\}\}/g, formatCurrency(data.permutation_value))
      .replace(/\{\{QTD_PARCELAS\}\}/g, data.installments_count || '0')
      .replace(/\{\{DATA_VENCIMENTO\}\}/g, dueDateLabel)
      .replace(/\{\{PRAZO_MESES\}\}/g, String(leaseDuration))
      .replace(/\{\{DATA_ATUAL\}\}/g, formatLongDatePtBr(new Date()));

    // As tags {{ASSINATURA_*}} sao injectadas no PDF final, quando temos acesso a contract_signatures.
    contractContent = `<div style="text-align: justify; line-height: 1.6; font-size: 14px;">${parsedContent.replace(/\n/g, '<br/>')}</div>`;
  } else if (type === 'sale_standard') {
    contractContent = `
      <h1>CONTRATO DE COMPRA E VENDA DE IMÓVEL A PRAZO</h1>
      
      <p>Por este instrumento particular, as partes qualificadas na Cláusula 1ª resolvem, por livre e espontânea vontade, firmar o presente contrato de compra e venda do imóvel descrito na cláusula 2ª, conforme os termos, preço e condições estabelecidos nas cláusulas seguintes:</p>
      
      <h2>Cláusula 1ª - Identificação das partes</h2>
      <p><strong>1) De um lado como comprador(es):</strong><br/>
      a) Nome: <strong>${val(data.buyer_name)}</strong>;<br/>
      b) CPF/CNPJ: <strong>${val(data.buyer_document)}</strong>;<br/>
      c) Profissão: ${val(data.buyer_profession)};<br/>
      d) Estado civil: ${val(data.buyer_marital_status)};<br/>
      e) Endereço: ${val(data.buyer_address)};<br/>
      f) Telefones: ${val(data.buyer_phone)};<br/>
      g) E-mail: ${val(data.buyer_email)}.${spouseText(data.buyer_spouse_name, data.buyer_spouse_document, data.buyer_spouse_rg || '', data.buyer_spouse_profession)}</p>
      
      <p><strong>2) E de outro lado, como vendedor(es):</strong><br/>
      a) Nome: <strong>${val(data.seller_name)}</strong>;<br/>
      b) CPF/CNPJ: <strong>${val(data.seller_document)}</strong>;<br/>
      c) Profissão: ${val(data.seller_profession)};<br/>
      d) Estado civil: ${val(data.seller_marital_status)};<br/>
      e) Endereço: ${val(data.seller_address)};<br/>
      f) Telefones: ${val(data.seller_phone)}.${spouseText(data.seller_spouse_name, data.seller_spouse_document, data.seller_spouse_rg || '', data.seller_spouse_profession)}</p>
      
      <h2>Cláusula 2ª – Objeto do contrato</h2>
      <p>1) O presente contrato tem por finalidade a compra e a venda "ad corpus" do imóvel descrito a seguir, de propriedade do(s) vendedor(es):<br/>
      a) Endereço: <strong>${val(data.property_address)}</strong>;<br/>
      b) Descrição do imóvel: <strong>${val(data.property_description)}</strong>.</p>
      
      <p>2) O(s) vendedor(es) declara(m) que são proprietários e possuidores a justo título do imóvel acima descrito, que ele está livre e desembaraçado de qualquer ônus, gravame, ações reais, pessoais reipersecutórias, dívidas, hipotecas, impostos ou taxas em atraso, restrições e outros.</p>
      
      <h2>Cláusula 3ª – Preço do imóvel e condições de pagamento</h2>
      <p>1) A transação objeto deste instrumento contratual tem preço total de <strong>R$ ${val(data.total_value)}</strong>.</p>
      
      <p>2) O preço será pago da seguinte forma:<br/>
      a) Sinal, princípio de pagamento ou arras de <strong>R$ ${val(data.down_payment)}</strong>, pagos no ato da assinatura do presente contrato.<br/>
      b) O saldo remanescente será pago conforme as condições de parcelamento ou financiamento aprovadas e combinadas entre as partes.</p>
      
      <h2>Cláusula 4ª – Honorários do corretor de imóveis</h2>
      <p>1) O presente negócio foi intermediado pelo corretor de imóveis responsável pela empresa <strong>${val(companyName || tenant?.name, '______________________')}</strong>, regularmente inscrito no CRECI, que apresentou os dados rigorosamente certos, não omitindo nenhum detalhe de desabono à negociação de que teve conhecimento.</p>
      
      <h2>Cláusula 5ª – Posse do imóvel</h2>
      <p>1) A posse do imóvel objeto deste contrato neste ato é transmitida pelo(s) vendedor(es) ao(s) comprador(es) com a entrega das chaves.</p>
      
      <h2>Cláusula 6ª – Despesas, impostos e taxas</h2>
      <p>1) Caberá ao(s) vendedor(es) o pagamento de todos os impostos, taxas, contribuições, despesas de condomínio, foros e outras despesas que incidam ou venham a incidir sobre o imóvel até a data da transmissão da posse.<br/>
      2) Caberá ao(s) comprador(es) o pagamento das despesas com a lavratura da escritura, ITBI, laudêmios e o registro de imóveis.</p>
      
      <h2>Cláusula 7ª – Documentação</h2>
      <p>1) O(s) vendedor(es) entregam, neste ato, todos os documentos e certidões exigidos por lei para a lavratura da escritura pública.</p>
      
      <h2>Cláusula 8ª – Declarações</h2>
      <p>1) O(s) comprador(es) declara(m) ter vistoriado o imóvel, aceitando-o no estado de conservação em que se encontra.</p>
      
      <h2>Cláusula 9ª – Cláusula Penal (Multa)</h2>
      <p>1) A infração de qualquer cláusula deste contrato sujeitará a parte infratora a uma multa de 10% (dez por cento) sobre o valor total da negociação, em favor da parte inocente, independentemente de perdas e danos.</p>
      
      <h2>Cláusula 10ª – Evicção de direitos</h2>
      <p>1) O(s) vendedor(es) responde(m), na forma da lei, pelos riscos de evicção de direitos.</p>
      
      <h2>Cláusula 11ª e 12ª – Irrevogabilidade e Sucessão</h2>
      <p>1) O presente contrato é celebrado sob a condição expressa de irrevogabilidade e irretratabilidade, ressalvando a inadimplência do(s) comprador(es), e vincula herdeiros e sucessores. Para tal as partes renunciam expressamente à faculdade de arrependimento prevista no art. 420 do Código Civil.</p>
      
      <h2>Cláusula 13ª – Eleição do foro</h2>
      <p>1) Todas as questões eventualmente oriundas do presente contrato, serão resolvidas, de forma definitiva via conciliatória ou arbitral, na 8ª Corte de Conciliação e Arbitragem de Goiânia (8ª CCA), com sede na Rua 56, Qd CH Lt 07, Jardim Goiás, Goiânia - GO, consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.</p>
      
      <h2>Cláusula 14ª - Fechamento</h2>
      <p style="margin-top: 40px; margin-bottom: 30px; text-align: center; line-height: 1.6;">
        Por estarem assim justos e contratados, firmam o presente em 02 (duas) vias de igual teor e forma, juntamente com as testemunhas abaixo.<br/>
        <strong>${cityLocation} - ${stateLocation}, ${dataFormatada}.</strong>
      </p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_COMPRADOR}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.buyer_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Comprador(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.seller_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Vendedor(a)</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        ${brokerSignature('Intermediador')}
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_1}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
    `;
  } else if (type === 'rent_guarantor') {
    contractContent = `
      <h1>CONTRATO DE LOCAÇÃO RESIDENCIAL COM FIADOR</h1>
      
      <h2>IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>
      
      <p><strong>LOCADOR:</strong> <strong>${val(data.landlord_name)}</strong>, ${val(data.landlord_nationality, 'brasileiro(a)')}, ${val(data.landlord_marital_status)}, ${val(data.landlord_profession)}, portador(a) da cédula de identidade RG nº ${val(data.landlord_rg)} e CPF nº ${val(data.landlord_document)}${spouseText(data.landlord_spouse_name, data.landlord_spouse_document, data.landlord_spouse_rg, data.landlord_spouse_profession)}, residente e domiciliado(a) à ${val(data.landlord_address)}.</p>
      
      <p><strong>LOCATÁRIO:</strong> <strong>${val(data.tenant_name)}</strong>, ${val(data.tenant_nationality, 'brasileiro(a)')}, ${val(data.tenant_marital_status)}, ${val(data.tenant_profession)}, portador(a) da cédula de identidade RG nº ${val(data.tenant_rg)} e CPF nº ${val(data.tenant_document)}${spouseText(data.tenant_spouse_name, data.tenant_spouse_document, data.tenant_spouse_rg, data.tenant_spouse_profession)}, residente e domiciliado(a) à ${val(data.tenant_address)}.</p>
      
      <p><strong>FIADOR(ES):</strong> <strong>${val(data.guarantor_name, '_________________________________')}</strong>, CPF nº <strong>${val(data.guarantor_document, '_________________')}</strong>, Profissão: ${val(data.guarantor_profession)}, residente e domiciliado(a) em ________________________________________________.</p>
      
      <p><strong>REPRESENTANTE DO LOCADOR / ADMINISTRADOR:</strong> <strong>${resolvedBrokerDisplayName}</strong>, corretor(a) de imóveis, inscrito(a) no CPF nº ${resolvedBrokerDisplayDoc.replace('CPF/CNPJ: ', '')}${resolvedBrokerDisplayCreci ? ` e ${resolvedBrokerDisplayCreci}` : ''}, atuando neste ato como administrador do imóvel e representante legal do locador.</p>
      
      <p><em>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Locação Residencial com Fiador, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente.</em></p>
      
      <h2>Cláusula 1ª – DO OBJETO DA LOCAÇÃO</h2>
      <p>O presente contrato tem como OBJETO o imóvel de propriedade do LOCADOR, situado na <strong>${val(data.property_address)}</strong>.</p>
      
      <h2>Cláusula 2ª – DO PRAZO</h2>
      <p>A presente locação terá o lapso temporal de validade de <strong>${val(data.lease_duration)} meses</strong>, a iniciar-se no dia ${val(data.start_date)} e findar-se no dia ${val(data.end_date)}, data a qual o imóvel deverá ser devolvido nas condições previstas na Cláusula 13ª, efetivando-se com a entrega das chaves, independentemente de aviso ou qualquer outra medida judicial ou extrajudicial.</p>
      
      <h2>Cláusula 3ª – DO VALOR DO ALUGUEL, DESPESAS E TRIBUTOS</h2>
      <p>Como aluguel mensal, o LOCATÁRIO se obrigará a pagar o valor de <strong>R$ ${val(data.rent_value)}</strong>, a ser efetuado diretamente à administradora do imóvel, ou mediante depósito bancário, até o dia <strong>${val(data.due_day)}</strong> de cada mês subsequente ao vencido.</p>
      
      <h2>Cláusula 4ª a 6ª – ATRASOS, MULTA E REAJUSTE</h2>
      <p>Em caso de atraso no pagamento dos aluguéis e encargos, incidirá multa penal de 10% (dez por cento) sobre o valor do débito, acrescido de juros de mora de 1% (um por cento) ao mês e correção monetária.<br/>
      O valor do aluguel será reajustado anualmente, ou no menor período fixado por lei, tendo como base o índice do IGP-M/FGV ou IPCA, acumulado no período.</p>
      
      <h2>Cláusula 7ª a 10ª – DESTINAÇÃO E SUBLOCAÇÃO</h2>
      <p>A presente locação destina-se exclusivamente ao uso <strong>RESIDENCIAL</strong> do LOCATÁRIO e de sua família, restando proibido sublocar, ceder ou emprestar o imóvel, no todo ou em parte, sem prévia e expressa anuência, por escrito, do LOCADOR.</p>
      
      <h2>Cláusula 11ª a 15ª – CONSERVAÇÃO E VISTORIA</h2>
      <p>O LOCATÁRIO declara receber o imóvel em perfeito estado de conservação e limpeza, com as instalações elétricas, hidráulicas e sanitárias em perfeito funcionamento, obrigando-se a restituí-lo no mesmo estado em que o recebe.<br/>
      Quaisquer modificações ou benfeitorias, sejam elas úteis, necessárias ou voluptuárias, dependerão de aprovação prévia e escrita do LOCADOR e, uma vez realizadas, incorporar-se-ão ao imóvel, não cabendo ao LOCATÁRIO qualquer direito de retenção ou indenização.</p>
      
      <h2>Cláusula 16ª a 19ª – TAXAS, IMPOSTOS E SEGURO</h2>
      <p>Todas as despesas incidentes sobre o imóvel, tais como consumo de água, luz, telefone, gás, taxas condominiais, bem como o IPTU (Imposto Predial e Territorial Urbano), ficarão a cargo do LOCATÁRIO durante todo o período em que permanecer no imóvel.<br/>
      Fica o LOCATÁRIO obrigado a contratar, no prazo de 30 dias, seguro contra incêndio do imóvel locado.</p>
      
      <h2>Cláusula 20ª a 23ª – PREFERÊNCIA E DESAPROPRIAÇÃO</h2>
      <p>Caso o LOCADOR decida vender o imóvel objeto deste contrato, deverá oferecer primeiramente ao LOCATÁRIO, por escrito, assegurando-lhe o direito de preferência. Em caso de desapropriação pelo Poder Público, o LOCADOR e a Administradora ficarão desobrigados de todas as cláusulas deste contrato.</p>
      
      <h2>Cláusula 24ª e 25ª – DA INFRAÇÃO CONTRATUAL</h2>
      <p>A infração de qualquer das cláusulas do presente contrato sujeitará o infrator à multa equivalente a 03 (três) vezes o valor do aluguel vigente à época da infração, cobrável por via executiva, sem prejuízo da rescisão do contrato e despejo.</p>
      
      <h2>Cláusula 26ª a 29ª – DA GARANTIA E DOS FIADORES</h2>
      <p>Assina(m) o presente contrato, na qualidade de FIADOR(ES) e principal(is) pagador(es), solidariamente responsável(is) com o LOCATÁRIO pelo fiel cumprimento de todas as cláusulas e obrigações, o(s) fiador(es) qualificado(s) no preâmbulo deste instrumento.<br/>
      A responsabilidade do(s) FIADOR(ES) estende-se até a efetiva devolução do imóvel e entrega das chaves, renunciando expressamente aos benefícios de ordem e direitos previstos nos artigos 827, 835 e 838 do Código Civil.</p>
      
      <h2>Cláusula 30ª e 31ª – REGISTRO E FORO</h2>
      <p>Este contrato deve ser levado a registro público no cartório competente. O presente contrato passa a vigorar entre as partes a partir da assinatura do mesmo.<br/>
      Todas as questões eventualmente oriundas do presente contrato, serão resolvidas, de forma definitiva via conciliatória ou arbitral, na 8ª Corte de Conciliação e Arbitragem de Goiânia (8ª CCA), com sede na Rua 56, Jardim Goiás, nº 390, Goiânia - GO, consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.</p>
      
      <p>Por estarem, assim justos e contratados, firmam o presente instrumento, em vias de igual teor, juntamente com 2 (duas) testemunhas.</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.landlord_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Locador(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_INQUILINO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.tenant_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Locatário(a)</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_FIADOR}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.guarantor_name, '_________________________________')}</strong><br/>
          <span style="font-size: 14px; color: #000;">Fiador(a) Principal</span>
        </div>
        ${brokerSignature('Administrador do Imóvel')}
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_1}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_2}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
    `;
  } else if (type === 'proposal_buy') {
    contractContent = `
      <h1>PROPOSTA DE COMPRA DE IMÓVEL</h1>
      
      <p>Por este instrumento particular, a pessoa qualificada na Cláusula 1ª resolve, por livre e espontânea vontade, propor à imobiliária/corretor <strong>${val(companyName || tenant?.name, '______________________')}</strong> a compra do imóvel descrito na Cláusula 2ª pelo preço e condições aqui estabelecidos:</p>
      
      <h2>Cláusula 1ª - Identificação do proponente:</h2>
      <p>
      a) Nome: <strong>${val(data.buyer_name)}</strong>;<br/>
      b) CPF: <strong>${val(data.buyer_document)}</strong>;<br/>
      c) Profissão: ${val(data.buyer_profession)};<br/>
      d) Estado civil: ${val(data.buyer_marital_status)};<br/>
      e) Endereço: ${val(data.buyer_address)};<br/>
      f) Telefones: ${val(data.buyer_phone)};<br/>
      g) E-mail: ${val(data.buyer_email)}.${spouseText(data.buyer_spouse_name, data.buyer_spouse_document, data.buyer_spouse_rg || '', data.buyer_spouse_profession)}
      </p>
      
      <h2>Cláusula 2ª – Identificação do imóvel:</h2>
      <p>
      a) Matrícula: _____________________________;<br/>
      b) Cartório: _____________________________;<br/>
      c) Inscrição municipal (IPTU/ITU/ITR): _____________________________;<br/>
      d) Endereço: <strong>${val(data.property_address)}</strong>;<br/>
      e) Descrição do imóvel: <strong>${val(data.property_description)}</strong>.
      </p>
      
      <h2>Cláusula 3ª – Preço do imóvel e condições de pagamento:</h2>
      <p>
      1) O proponente oferece pagar pelo imóvel acima descrito o preço total de <strong>R$ ${val(data.total_value)}</strong>.<br/>
      2) A forma de pagamento será a seguinte:<br/>
      a) Sinal, princípio de pagamento ou arras de <strong>R$ ${val(data.down_payment)}</strong>, a ser depositado na seguinte conta: ______________________________________________________________.<br/>
      b) O saldo restante será pago conforme aprovado e acordado posteriormente em contrato de compra e venda definitivo.
      </p>
      
      <h2>Cláusula 4ª – Prazo da proposta e validade:</h2>
      <p>
      1) A presente proposta é irrevogável e irretratável.<br/>
      2) O proponente manterá a presente proposta por prazo de <strong>05 (cinco) dias úteis</strong> da data de assinatura deste instrumento. Caso não seja aceita ou o proprietário não se manifeste no prazo estipulado, a mesma ficará sem nenhum efeito.
      </p>
      
      <h2>Cláusula 5ª – Honorários do corretor de imóveis:</h2>
      <p>
      1) Em caso de desistência, arrependimento ou recusa imotivada do proponente em assinar o contrato principal de compra e venda após a aceitação desta proposta pelo proprietário/vendedor, o proponente obriga-se a pagar uma multa equivalente a 10% (dez por cento) do valor total da proposta, a qual será revertida, com exclusividade, em favor do corretor de imóveis credenciado.<br/>
      2) Em caso de distrato por iniciativa do proponente após assinatura do contrato principal de compra e venda, o proponente assume, desde logo, para si, integralmente, o pagamento imediato dos honorários profissionais do corretor de imóveis, no mesmo percentual estabelecido no contrato de intermediação, nos moldes estabelecidos no art. 725 do Código Civil.
      </p>
      
      <h2>Cláusula 6ª – Eleição do foro:</h2>
      <p>
      1) Todas as questões eventualmente oriundas do presente contrato, serão resolvidas, de forma definitiva via conciliatória ou arbitral, na 8ª Câmara de Conciliação e Arbitragem de Goiânia (8ª CCA), com sede à Rua 56, Qd CH Lt 07, Jardim Goiás, Goiânia - GO, consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.
      </p>
      
      <h2>Cláusula 7ª – Local e assinatura do proponente e do corretor de imóveis:</h2>
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_COMPRADOR}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.buyer_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Proponente (Comprador)</span>
        </div>
        ${brokerSignature('Corretor de Imóveis')}
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_1}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_2}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
      
      <div style="margin-top: 50px; border-top: 2px dashed #000; padding-top: 30px; page-break-inside: avoid;">
        <h1 style="text-align: center;">ACEITE DA PROPOSTA</h1>
        
        <h2>Cláusula 8ª – Aceite do(s) proprietário(s)/vendedor(es):</h2>
        <p>1) O(s) proprietário(s)/vendedor(es) aceita(m) a proposta conforme formulada e aguarda(m) o proponente para assinatura do contrato definitivo conforme o prazo estabelecido.<br/>
        2) O(s) proprietário(s)/vendedor(es) autorizam o corretor de imóveis a receber e dar recibo do sinal ou princípio de pagamento constante na alínea "a" do item 2 da Cláusula 3ª acima.</p>
        
        <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
        
        <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
          <div class="signature-line" style="display: table-cell; width: 100%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
            <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
              {{ASSINATURA_PROPRIETARIO}}
            </div>
            _________________________________________________<br/>
            <strong style="font-size: 14px; color: #000;">${val(data.seller_name)}</strong><br/>
            <span style="font-size: 14px; color: #000;">Proprietário (Vendedor)</span>
          </div>
        </div>
      </div>
    `;
  } else if (type === 'intermed_sale' || type === 'intermediacao') {
    const isRentIntermediation =
      data.listing_type === 'rent' ||
      data.listingType === 'rent' ||
      data.listing_mode === 'rent';

    // Se o sistema tentar gerar uma intermediação de locação por aqui, redireciona para o modelo correto
    if (isRentIntermediation) {
      return buildContractHtml('intermed_rent', data, tenant, companyLogo, brokerDisplayName, brokerDisplayDoc, brokerDisplayCreci, companyName, customTemplateContent);
    }

    if (type === 'intermediacao') {
      // Detecta automaticamente se o contrato tem exclusividade
      const isExclusive =
        data.has_exclusivity === true ||
        data.has_exclusivity === 'true' ||
        data.has_exclusivity === 'Sim';

      const joinFilled = (...parts: unknown[]) =>
        parts
          .map((part) => {
            if (typeof part === 'string') return part.trim();
            if (part === undefined || part === null) return '';
            return String(part).trim();
          })
          .filter(Boolean)
          .join(', ');

      const ownerName = val(data.owner_name, data.seller_name, data.landlord_name, data.property?.owner_name);
      const ownerNationality = val(data.owner_nationality, data.seller_nationality, 'brasileiro(a)');
      const ownerProfession = val(data.owner_profession, data.seller_profession);
      const ownerMaritalStatus = val(data.owner_marital_status, data.seller_marital_status);
      const ownerRg = val(data.owner_rg, data.seller_rg);
      const ownerCpf = val(
        data.owner_cpf,
        data.owner_document,
        data.seller_cpf,
        data.seller_document,
        data.property?.owner_cpf,
        data.property?.owner_document
      );
      const ownerAddress = val(
        data.owner_address,
        data.seller_address,
        joinFilled(
          data.owner_address || data.seller_address,
          data.owner_number || data.seller_number,
          data.owner_neighborhood || data.seller_neighborhood,
          [data.owner_city || data.seller_city, data.owner_state || data.seller_state].filter(Boolean).join(' - ')
        )
      );
      const propertyLocationLine = val(
        data.property_address,
        joinFilled(
          data.property?.street,
          data.property_number || data.property?.number,
          data.property_neighborhood || data.property?.neighborhood,
          [data.property_city || data.property?.city, data.property_state || data.property?.state].filter(Boolean).join(' - ')
        ),
        propertyAddress
      );
      const propertyRegistration = val(
        data.property_registration,
        data.property?.registration_number,
        data.property?.iptu_number,
        '__________________'
      );
      const transactionValue = val(
        data.transaction_value,
        data.property_price,
        data.total_value,
        data.sale_total_value,
        data.property?.price
      );
      const brokerDocumentValue = finalDocument || brokerDisplayDoc || '______________________';
      const brokerCreciValue = finalCreci || brokerDisplayCreci || '______________________';

      contractContent = `
        <h2 style="text-align: center; font-size: 16px; margin-bottom: 30px; color: #1e293b;">
          CONTRATO DE INTERMEDIAÇÃO IMOBILIÁRIA ${isExclusive ? 'COM EXCLUSIVIDADE' : 'SEM EXCLUSIVIDADE'}
        </h2>

        <p style="margin-bottom: 25px; line-height: 1.6; text-align: justify;">
          <strong>Por este instrumento particular, as partes qualificadas resolvem firmar o presente contrato de intermediação imobiliária, conforme as cláusulas seguintes:</strong>
        </p>

        <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">I - DO CONTRATANTE (PROPRIETÁRIO)</h3>
        <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
          <strong>Nome:</strong> ${ownerName}<br/>
          <strong>Nacionalidade / Profissão:</strong> ${ownerNationality} / ${ownerProfession}<br/>
          <strong>Estado Civil:</strong> ${ownerMaritalStatus}<br/>
          <strong>Documentos:</strong> RG nº ${ownerRg} | CPF/CNPJ nº ${ownerCpf}<br/>
          <strong>Endereço:</strong> ${ownerAddress}
        </p>

        <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">II - DO CONTRATADO (CORRETOR/IMOBILIÁRIA)</h3>
        <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
          <strong>Nome:</strong> ${resolvedBrokerDisplayName}<br/>
          <strong>Documento:</strong> ${brokerDocumentValue}<br/>
          <strong>CRECI:</strong> ${brokerCreciValue}
        </p>

        <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">III - DO IMÓVEL</h3>
        <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
          <strong>Endereço:</strong> ${propertyLocationLine}<br/>
          <strong>Matrícula:</strong> ${propertyRegistration}
        </p>

        <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">IV - DOS HONORÁRIOS E AUTORIZAÇÃO</h3>
        <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
          <strong>Cláusula 1ª:</strong> O CONTRATANTE autoriza o CONTRATADO a promover a intermediação da venda do imóvel descrito acima, pelo valor de <strong>${transactionValue}</strong>.<br/>
          <strong>Cláusula 2ª:</strong> Sendo concretizada a venda, o CONTRATANTE pagará ao CONTRATADO a título de honorários de corretagem o valor equivalente a <strong>${val(data.commission_percentage, '5')}%</strong> sobre o valor total da negociação.
        </p>

        <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">V - DA ${isExclusive ? 'EXCLUSIVIDADE' : 'NÃO EXCLUSIVIDADE'}</h3>
        <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
          ${isExclusive
            ? `<strong>Cláusula 3ª:</strong> A presente autorização é concedida <strong>COM EXCLUSIVIDADE</strong>. O CONTRATANTE obriga-se a não tratar da venda diretamente ou por intermédio de outrem. O CONTRATADO fará jus à remuneração integral caso o negócio se realize durante o prazo de vigência deste contrato, inclusive se realizado diretamente pelo CONTRATANTE, nos exatos termos do Art. 726 do Código Civil Brasileiro.`
            : `<strong>Cláusula 3ª:</strong> A presente autorização é concedida <strong>SEM EXCLUSIVIDADE</strong>. O CONTRATANTE reserva-se o direito de autorizar outros profissionais a intermediar o mesmo imóvel, bem como realizar a venda diretamente. A remuneração será devida ao CONTRATADO apenas se este for o responsável direto pela apresentação do comprador que vier a concretizar o negócio.`
          }
        </p>

        <p style="margin-top: 40px; margin-bottom: 30px; text-align: center; line-height: 1.6;">
          Por estarem assim justos e contratados, firmam o presente em 02 (duas) vias de igual teor e forma, juntamente com as testemunhas abaixo.<br/>
          <strong>${cityLocation} - ${stateLocation}, ${dataFormatada}.</strong>
        </p>

        <div class="signatures" style="display: table; width: 100%; margin-top: 40px; page-break-inside: avoid; table-layout: fixed;">
          <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
            <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
              {{ASSINATURA_PROPRIETARIO}}
            </div>
            _________________________________________________<br/>
            <strong style="font-size: 14px; color: #000;">${ownerName}</strong><br/>
            <span style="font-size: 14px; color: #000;">Contratante (Proprietário)</span>
          </div>
          ${brokerSignature('Contratado (Corretor/Imobiliária)')}
        </div>

        <div class="signatures" style="display: table; width: 100%; margin-top: 40px; page-break-inside: avoid; table-layout: fixed;">
          <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
            <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
              {{ASSINATURA_TESTEMUNHA_1}}
            </div>
            _________________________________________________<br/>
            <strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/>
            <span style="font-size: 14px; color: #000;">CPF:</span>
          </div>
          <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
            <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
              {{ASSINATURA_TESTEMUNHA_2}}
            </div>
            _________________________________________________<br/>
            <strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/>
            <span style="font-size: 14px; color: #000;">CPF:</span>
          </div>
        </div>
      `;
    } else {
      const exclusivityText = data.has_exclusivity === false
        ? '2) Por se tratar de contrato sem exclusividade, o contratante poderá negociar o imóvel por outros meios, sem prejuízo da remuneração do contratado caso o negócio seja concluído com interessado por ele apresentado.<br/>3) O prazo poderá ser estendido caso as partes assinem termo aditivo de prorrogação.'
        : '2) Durante a vigência da cláusula de exclusividade, a intermediação ficará atribuída ao contratado.<br/>3) O prazo poderá ser estendido caso as partes assinem termo aditivo de prorrogação.';

      contractContent = `
        <h1>CONTRATO DE AUTORIZAÇÃO DE INTERMEDIAÇÃO PARA VENDA DE IMÓVEL</h1>
        
        <p>Por este instrumento particular, as partes qualificadas na Cláusula 1ª resolvem, por livre e espontânea vontade, firmar o presente contrato de intermediação para fins de venda de imóvel conforme os termos e condições estabelecidos nas cláusulas seguintes:</p>
        
        <h2>Cláusula 1ª - Identificação das partes</h2>
        <p><strong>1) De um lado como contratante (Proprietário):</strong><br/>
        a) Nome: <strong>${val(data.seller_name)}</strong>;<br/>
        b) CPF/CNPJ: <strong>${val(data.seller_document)}</strong>;<br/>
        c) Profissão: ${val(data.seller_profession)};<br/>
        d) Estado civil: ${val(data.seller_marital_status)};<br/>
        e) Endereço: ${val(data.seller_address)};<br/>
        f) Telefones: ${val(data.seller_phone)}.${spouseText(data.seller_spouse_name, data.seller_spouse_document, data.seller_spouse_rg || '', data.seller_spouse_profession)}
        </p>
        
        <p><strong>1.2) E de outro lado, como contratado, o corretor de imóveis:</strong><br/>
        a) Nome: <strong>${resolvedBrokerDisplayName}</strong>;<br/>
        b) ${resolvedBrokerDisplayDoc};<br/>
        c) ${resolvedBrokerDisplayCreci || 'Inscrição no CRECI: ________________'};<br/>
        d) Endereço: ${companyFullAddress};<br/>
        e) Telefones: ${companyPhone};<br/>
        f) E-mail: ${companyEmail}.
        </p>
        
        <h2>Cláusula 2ª - Objeto do contrato</h2>
        <p>1) O presente contrato tem por finalidade a contratação dos serviços profissionais de intermediação, por parte do contratado, para fins de venda do imóvel de propriedade do contratante com as seguintes características:<br/>
        a) Localização: <strong>${val(data.property_address)}</strong>;<br/>
        b) Descrição do imóvel: <strong>${val(data.property_description)}</strong>.</p>
        
        <p>2) O(s) contratante(s) declara(m) que são proprietários e possuidores a justo título do imóvel acima descrito, que ele está livre e desembaraçado de qualquer ônus, gravame, ações reais, pessoais reipersecutórias, dívidas, hipotecas, impostos ou taxas em atraso, restrições e outros.</p>
        
        <h2>Cláusula 3ª - Preço do imóvel e condições de negociação</h2>
        <p>1) A transação objeto deste instrumento contratual deverá ser concretizada pelo valor de <strong>R$ ${val(data.total_value)}</strong>.<br/>
        2) Independentemente do preço, a contratada poderá apresentar qualquer proposta para estudo do(s) contratante(s).</p>
        
        <h2>Cláusula 4ª - Honorários profissionais do corretor de imóveis</h2>
        <p>1) Fica pactuado que, ocorrendo a venda do imóvel descrito na Cláusula 2ª, o contratante pagará ao contratado, a título de honorários de corretagem, o percentual de <strong>${val(data.commission_percentage, '5')}%</strong> a ser calculado sobre o valor total da venda.<br/>
        2) O pagamento dos honorários de corretagem será feito no ato do recebimento do sinal, ou na assinatura do contrato de promessa de compra e venda, ou na escritura definitiva, o que ocorrer primeiro.<br/>
        3) O contratante se obriga a pagar os honorários mesmo se a venda se realizar após o vencimento do presente contrato, caso o comprador tenha sido apresentado pelo contratado durante a vigência deste instrumento, conforme art. 727 do Código Civil.</p>
        
        <h2>Cláusula 5ª - Placas e anúncios</h2>
        <p>1) Fica o contratado autorizado a colocar placa de "VENDE", faixas, cartazes e outros meios de divulgação no imóvel objeto deste contrato, visando facilitar a sua comercialização.</p>
        
        <h2>Cláusula 6ª - Prazo de vigência e exclusividade</h2>
        <p>1) O presente contrato é assinado em caráter irrevogável, vincula herdeiros e sucessores do contratante, possui <strong>${data.has_exclusivity ? 'CLÁUSULA DE EXCLUSIVIDADE' : 'NÃO EXCLUSIVIDADE'}</strong> para a intermediação, e tem vigência de <strong>120 (cento e vinte) dias</strong> contados da sua assinatura.<br/>
        ${exclusivityText}</p>
        
        <h2>Cláusula 7ª - Eleição do foro</h2>
        <p>1) Todas as questões eventualmente oriundas do presente contrato serão resolvidas, de forma definitiva via conciliatória ou arbitral, na 8ª Corte de Conciliação e Arbitragem de Goiânia (8ª CCA), com sede na Rua 56, Qd CH Lt 07, Jardim Goiás, Goiânia - GO consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.</p>
        
        <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
        
        <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
          <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
            <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
              {{ASSINATURA_PROPRIETARIO}}
            </div>
            _________________________________________________<br/>
            <strong style="font-size: 11px; color: #000;">${val(data.seller_name)}</strong><br/>
            <span style="font-size: 11px; color: #000;">Contratante (Proprietário/Vendedor)</span>
          </div>
          ${brokerSignature('Contratado (Corretor)')}
        </div>
      `;
    }
  } else if (type === 'intermed_rent') {
    // === MODELO: INTERMEDIAÇÃO DE LOCAÇÃO ===
    const exclusivityText = data.has_exclusivity === false
      ? '2) Por se tratar de contrato sem exclusividade, o contratante poderá negociar o imóvel por outros meios, sem prejuízo da remuneração do contratado caso o negócio seja concluído com interessado por ele apresentado.<br/>3) O prazo poderá ser estendido caso as partes assinem termo aditivo de prorrogação.'
      : '2) Durante a vigência da cláusula de exclusividade, a intermediação ficará atribuída ao contratado.<br/>3) O prazo poderá ser estendido caso as partes assinem termo aditivo de prorrogação.';

    // Na locação, a comissão geralmente é o 1º aluguel ou um percentual. O sistema salva o percentual.
    const comissaoTexto = data.commission_percentage
      ? `o percentual de <strong>${formatPercentagePtBr(data.commission_percentage, 100)}%</strong> sobre o valor do 1º (primeiro) aluguel integral`
      : `o valor equivalente a <strong>01 (um) aluguel integral</strong>`;

    contractContent = `
      <h1>CONTRATO DE AUTORIZAÇÃO DE INTERMEDIAÇÃO PARA LOCAÇÃO DE IMÓVEL</h1>
      
      <p>Por este instrumento particular, as partes qualificadas na Cláusula 1ª resolvem, por livre e espontânea vontade, firmar o presente contrato de intermediação para fins de locação de imóvel conforme os termos e condições estabelecidos nas cláusulas seguintes:</p>
      
      <h2>Cláusula 1ª - Identificação das partes</h2>
      <p><strong>1) De um lado como contratante (Locador):</strong><br/>
      a) Nome: <strong>${val(data.seller_name)}</strong>;<br/>
      b) CPF/CNPJ: <strong>${val(data.seller_document)}</strong>;<br/>
      c) Profissão: ${val(data.seller_profession)};<br/>
      d) Estado civil: ${val(data.seller_marital_status)};<br/>
      e) Endereço: ${val(data.seller_address)};<br/>
      f) Telefones: ${val(data.seller_phone)}.${spouseText(data.seller_spouse_name, data.seller_spouse_document, data.seller_spouse_rg || '', data.seller_spouse_profession)}
      </p>
      
      <p><strong>1.2) E de outro lado, como contratado, a Administradora/Corretor:</strong><br/>
      a) Nome: <strong>${resolvedBrokerDisplayName}</strong>;<br/>
      b) ${resolvedBrokerDisplayDoc};<br/>
      c) ${resolvedBrokerDisplayCreci || 'Inscrição no CRECI: ________________'};<br/>
      d) Endereço: ${companyFullAddress};<br/>
      e) Telefones: ${companyPhone};<br/>
      f) E-mail: ${companyEmail}.
      </p>
      
      <h2>Cláusula 2ª - Objeto do contrato</h2>
      <p>1) O presente contrato tem por finalidade a contratação dos serviços profissionais de intermediação, por parte do contratado, para fins de locação do imóvel de propriedade do contratante com as seguintes características:<br/>
      a) Localização: <strong>${val(data.property_address)}</strong>;<br/>
      b) Descrição do imóvel: <strong>${val(data.property_description)}</strong>.</p>
      
      <p>2) O(s) contratante(s) declara(m) que são proprietários e possuidores a justo título do imóvel acima descrito, que ele está livre e desembaraçado para locação.</p>
      
      <h2>Cláusula 3ª - Preço do imóvel e condições</h2>
      <p>1) O valor pretendido para a locação do imóvel objeto deste instrumento é de <strong>R$ ${val(data.total_value)}</strong> mensais.<br/>
      2) Independentemente do valor pretendido, a contratada poderá apresentar propostas para estudo do(s) contratante(s).</p>
      
      <h2>Cláusula 4ª - Honorários profissionais</h2>
      <p>1) Fica pactuado que, ocorrendo a locação do imóvel descrito na Cláusula 2ª, o contratante pagará ao contratado, a título de honorários de intermediação, ${comissaoTexto}.<br/>
      2) O pagamento dos honorários ocorrerá no ato da formalização da locação e assinatura do contrato de locação, podendo o contratado reter tal valor do primeiro recebimento de aluguel.<br/>
      3) Em caso de administração continuada, a taxa de administração mensal, se houver, será objeto de aditivo ou contrato de administração específico.</p>
      
      <h2>Cláusula 5ª - Placas e anúncios</h2>
      <p>1) Fica o contratado autorizado a colocar placa de "ALUGA", faixas, cartazes e outros meios de divulgação no imóvel objeto deste contrato.</p>
      
      <h2>Cláusula 6ª - Prazo de vigência e exclusividade</h2>
      <p>1) O presente contrato possui <strong>${data.has_exclusivity ? 'CLÁUSULA DE EXCLUSIVIDADE' : 'NÃO EXCLUSIVIDADE'}</strong> para a intermediação, e tem vigência de <strong>120 (cento e vinte) dias</strong> contados da sua assinatura.<br/>
      ${exclusivityText}</p>
      
      <h2>Cláusula 7ª - Eleição do foro</h2>
      <p>1) Todas as questões eventualmente oriundas do presente contrato serão resolvidas na 8ª Corte de Conciliação e Arbitragem de Goiânia (8ª CCA).</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 11px; color: #000;">${val(data.seller_name)}</strong><br/>
          <span style="font-size: 11px; color: #000;">Contratante (Locador)</span>
        </div>
        ${brokerSignature('Administrador / Corretor')}
      </div>
    `;
  } else if (type === 'sale_cash') {
    contractContent = `
      <h2 style="text-align: center; font-size: 16px; margin-bottom: 30px; color: #1e293b;">
        INSTRUMENTO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL (À VISTA)
      </h2>

      <p style="margin-bottom: 25px; line-height: 1.6; text-align: justify;">
        <strong>Pelo presente instrumento particular, as partes abaixo qualificadas celebram entre si o presente Contrato de Promessa de Compra e Venda, mediante as cláusulas e condições seguintes:</strong>
      </p>

      <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">I - DOS PROMITENTES VENDEDORES</h3>
      <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
        <strong>Vendedor(a):</strong> ${val(data.seller_name)}, ${val(data.seller_nationality, 'brasileiro(a)')}, ${val(data.seller_profession)}, estado civil: ${val(data.seller_marital_status)}, portador(a) do RG nº ${val(data.seller_rg)} e inscrito(a) no CPF sob o nº ${val(data.seller_cpf || data.seller_document || data.property?.owner_cpf || data.property?.owner_document)}, residente e domiciliado(a) na ${val(data.seller_address)}, ${val(data.seller_number)}, ${val(data.seller_neighborhood)}, ${val(data.seller_city)} - ${val(data.seller_state)}, CEP: ${val(data.seller_zipcode || data.seller_zip_code)}.
        ${data.seller_spouse_name ? `<br/><strong>Cônjuge:</strong> ${val(data.seller_spouse_name)}, ${val(data.seller_spouse_nationality, 'brasileiro(a)')}, ${val(data.seller_spouse_profession)}, portador(a) do RG nº ${val(data.seller_spouse_rg)} e inscrito(a) no CPF sob o nº ${val(data.seller_spouse_cpf || data.seller_spouse_document)}.` : ''}
      </p>

      <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">II - DOS PROMITENTES COMPRADORES</h3>
      <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
        <strong>Comprador(a):</strong> ${val(data.buyer_name)}, ${val(data.buyer_nationality, 'brasileiro(a)')}, ${val(data.buyer_profession)}, estado civil: ${val(data.buyer_marital_status)}, portador(a) do RG nº ${val(data.buyer_rg)} e inscrito(a) no CPF sob o nº ${val(data.buyer_cpf || data.buyer_document)}, residente e domiciliado(a) na ${val(data.buyer_address)}, ${val(data.buyer_number)}, ${val(data.buyer_neighborhood)}, ${val(data.buyer_city)} - ${val(data.buyer_state)}, CEP: ${val(data.buyer_zipcode || data.buyer_zip_code)}.
        ${data.buyer_spouse_name ? `<br/><strong>Cônjuge:</strong> ${val(data.buyer_spouse_name)}, ${val(data.buyer_spouse_nationality, 'brasileiro(a)')}, ${val(data.buyer_spouse_profession)}, portador(a) do RG nº ${val(data.buyer_spouse_rg)} e inscrito(a) no CPF sob o nº ${val(data.buyer_spouse_cpf || data.buyer_spouse_document)}.` : ''}
      </p>

      <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">III - DO IMÓVEL</h3>
      <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
        <strong>Cláusula 1ª:</strong> O objeto do presente contrato é um(a) <strong>${val(data.property_type || data.property?.property_type || data.property?.type)}</strong>, localizado(a) na ${val(data.property_address || data.property?.street || data.property?.address)}, ${val(data.property_number || data.property?.number)}, ${val(data.property_neighborhood || data.property?.neighborhood)}, na cidade de ${val(data.property_city || data.property?.city)} - ${val(data.property_state || data.property?.state)}, CEP: ${val(data.property_zipcode || data.property_zip_code || data.property?.zip_code)}.<br/>
        <strong>Parágrafo Único:</strong> O imóvel encontra-se matriculado sob o nº <strong>${val(data.property_registration || data.property?.registration_number || data.property?.iptu_number)}</strong> no <strong>${val(data.property_registry || data.property_registry_office)}</strong> Cartório de Registro de Imóveis, livre e desembaraçado de quaisquer ônus, litígios ou dívidas.
      </p>

      <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">IV - DO VALOR E FORMA DE PAGAMENTO</h3>
      <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
        <strong>Cláusula 2ª:</strong> O preço certo e ajustado para a presente venda e compra é de <strong>${val(data.transaction_value || data.sale_total_value || data.total_value)}</strong>, que será pago da seguinte forma:<br/>
        <strong>Parágrafo Único - Pagamento à vista:</strong> O pagamento será realizado em moeda corrente nacional, em parcela única (à vista), através de transferência bancária (TED/PIX) ou cheque administrativo, no momento da assinatura da escritura pública de compra e venda ou conforme acordado entre as partes.
      </p>
      
      <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">V - DA POSSE E ESCRITURA</h3>
      <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
        <strong>Cláusula 3ª:</strong> A posse do imóvel será transferida aos COMPRADORES no momento da quitação integral do valor acordado e assinatura da Escritura Pública, devendo os VENDEDORES entregarem o imóvel livre de pessoas e coisas.<br/>
        <strong>Cláusula 4ª:</strong> Todas as despesas inerentes à transferência de propriedade, incluindo ITBI, custas de cartório de notas e registro de imóveis, correrão por conta exclusiva dos COMPRADORES.
      </p>

      <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">VI - DA INTERMEDIAÇÃO</h3>
      <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
        <strong>Cláusula 5ª:</strong> As partes declaram que a presente transação foi intermediada por <strong>${resolvedBrokerDisplayName}</strong>, ${resolvedBrokerDisplayDoc}, ${resolvedBrokerDisplayCreci || 'CRECI: ________________'}, fazendo jus aos honorários de corretagem pactuados em instrumento apartado.
      </p>

      <h3 style="font-size: 14px; margin-top: 25px; margin-bottom: 10px; color: #334155; border-bottom: 1px solid #e2e8f0; padding-bottom: 5px;">VII - DO FORO</h3>
      <p style="margin-bottom: 20px; line-height: 1.6; text-align: justify;">
        <strong>Cláusula 6ª:</strong> As partes elegem o foro da Comarca de ${val(data.property_city || data.property?.city)} - ${val(data.property_state || data.property?.state)} para dirimir quaisquer dúvidas oriundas deste contrato, renunciando a qualquer outro por mais privilegiado que seja.
      </p>

      <p style="margin-top: 40px; margin-bottom: 30px; text-align: center; line-height: 1.6;">
        Por estarem assim justos e contratados, firmam o presente em 02 (duas) vias de igual teor e forma, juntamente com as testemunhas abaixo.<br/>
        <strong>${cityLocation} - ${stateLocation}, ${dataFormatada}.</strong>
      </p>

      <div class="signatures" style="display: table; width: 100%; margin-top: 40px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.seller_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Vendedor(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_COMPRADOR}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.buyer_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Comprador(a)</span>
        </div>
      </div>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 40px; page-break-inside: avoid; table-layout: fixed;">
        ${brokerSignature('Intermediador')}
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_1}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
    `;
  } else if (type === 'permuta') {
    contractContent = `
      <h1>CONTRATO DE PERMUTA</h1>
      
      <p>Por este instrumento particular, as pessoas qualificadas na Cláusula 1ª resolvem, por livre e espontânea vontade, firmar o presente contrato de permuta dos imóveis descritos na cláusula 2ª, conforme os termos, preço e condições estabelecidos nas cláusulas seguintes.</p>
      
      <h2>Cláusula 1ª - Identificação das partes:</h2>
      <p><strong>1) De um lado como primeiro(s) permutante(s) (Proprietário do Imóvel 1):</strong><br/>
      a) Nome: <strong>${val(data.seller_name)}</strong>;<br/>
      b) CPF/CNPJ: <strong>${val(data.seller_document)}</strong>;<br/>
      c) Profissão: ${val(data.seller_profession)};<br/>
      d) Estado civil: ${val(data.seller_marital_status)};<br/>
      e) Endereço: ${val(data.seller_address)};<br/>
      f) Telefones: ${val(data.seller_phone)}.${spouseText(data.seller_spouse_name, data.seller_spouse_document, data.seller_spouse_rg || '', data.seller_spouse_profession)}
      </p>
      
      <p><strong>1.2) E de outro lado, como segundo(s) permutante(s) (Proprietário do Imóvel 2):</strong><br/>
      a) Nome: <strong>${val(data.buyer_name)}</strong>;<br/>
      b) CPF/CNPJ: <strong>${val(data.buyer_document)}</strong>;<br/>
      c) Profissão: ${val(data.buyer_profession)};<br/>
      d) Estado civil: ${val(data.buyer_marital_status)};<br/>
      e) Endereço: ${val(data.buyer_address)};<br/>
      f) Telefones: ${val(data.buyer_phone)}.${spouseText(data.buyer_spouse_name, data.buyer_spouse_document, data.buyer_spouse_rg || '', data.buyer_spouse_profession)}
      </p>
      
      <p><em>2) As partes permutantes declaram, sob as penas da lei, que são verazes as indicações sobre suas identidade, estado civil, nacionalidades, profissões, endereços, cadastros fiscais e econômico-financeiros.</em></p>
      
      <h2>Cláusula 2ª – Objeto do contrato</h2>
      <p>1) O presente contrato tem por finalidade a permuta ad corpus dos imóveis a seguir descritos:</p>
      
      <p><strong>I) De propriedade do(s) primeiro(s) permutante(s) o imóvel com as seguintes características:</strong><br/>
      a) Matrícula: _____________________________;<br/>
      b) Cartório: _____________________________;<br/>
      c) Título aquisitivo: _____________________________;<br/>
      d) Inscrição municipal (IPTU/ITU/ITR): _____________________________;<br/>
      e) Endereço: <strong>${val(data.property_address)}</strong>;<br/>
      f) Descrição do imóvel: <strong>${val(data.property_description)}</strong>.</p>
      
      <p><strong>II) De propriedade do(s) segundo(s) permutante(s) o imóvel com as seguintes características:</strong><br/>
      a) Matrícula: _____________________________;<br/>
      b) Cartório: _____________________________;<br/>
      c) Título aquisitivo: _____________________________;<br/>
      d) Inscrição municipal (IPTU/ITU/ITR): _____________________________;<br/>
      e) Endereço: <strong>${val(data.permuta_address)}</strong>;<br/>
      f) Descrição do imóvel: <strong>${val(data.permuta_description)}</strong>.</p>
      
      <p>2) As partes permutantes declaram, em relação aos seus imóveis, que:<br/>
      a) São respectivamente proprietários e possuidores a justo título dos imóveis descritos nos itens I e II da cláusula 2ª e que eles estão livres e desembaraçados de qualquer ônus ou gravame, judicial ou extrajudicial, inclusive de natureza tributária;<br/>
      b) Não têm contra si qualquer débito, protesto ou ação cível, criminal ou trabalhista cuja garantia possa vir a ser o imóvel acima descrito;<br/>
      c) Inexiste a seus encargos responsabilidade oriunda de tutela, curatela ou testamentária.</p>
      
      <h2>Cláusula 3ª – Preço do imóvel</h2>
      <p>1) Os imóveis descritos nos itens I e II da cláusula 2ª têm o preço, cada qual, de <strong>R$ ${val(data.total_value)}</strong>, sendo este o valor do negócio.</p>
      
      <h2>Cláusula 4ª – Honorários do corretor de imóveis</h2>
      <p>1) O presente negócio foi intermediado pelo corretor de imóveis <strong>${resolvedBrokerDisplayName}</strong>, que apresentou, ao oferecer o imóvel, dados rigorosamente certos, não omitiu detalhes que o depreciem, e informou às partes dos riscos e demais circunstâncias que pudessem influenciar o negócio.<br/>
      2) As partes permutantes declaram que previamente examinaram e verificaram as procurações, o título aquisitivo, a escritura e as certidões registrais do imóvel objeto do presente contrato e isentam o corretor de imóveis acerca da veracidade desses documentos.<br/>
      3) Pelos serviços de intermediação cada qual das partes permutantes pagará ao corretor de imóveis o importe de R$ __________________, no ato da assinatura do presente contrato.<br/>
      4) O arrependimento posterior de qualquer das partes permutantes não implica na devolução dos honorários profissionais.<br/>
      5) A responsabilidade do corretor de imóveis limita-se à intermediação da presente transação, excluindo de si todas e quaisquer obrigações assumidas pelas partes.</p>
      
      <h2>Cláusula 5ª – Certidões negativas e lavratura da escritura</h2>
      <p>1) As partes permutantes, neste ato, entregam uma para a outra os documentos e certidões reais e pessoais necessários à lavratura da escritura pública de permuta, que deverá ser lavrada no prazo máximo de ______ dias.<br/>
      2) A inadimplência de qualquer das partes permutantes em promover a lavratura da escritura pública de permuta no prazo pactuado isenta a outra da obrigação de apresentação de novas certidões ou do seu teor.<br/>
      3) A inadimplência de qualquer das partes permutantes na outorga da escritura pública de permuta ensejará o direito da outra parte em requerer a adjudicação compulsória do imóvel, sem prejuízo da cláusula penal e perdas e danos.</p>
      
      <h2>Cláusula 6ª – Despesas com a transmissão imobiliária</h2>
      <p>1) Cada qual das partes permutantes arcará com as despesas para apresentação das respectivas certidões reais e pessoais necessárias à lavratura da escritura pública de permuta.<br/>
      2) Cada qual das partes permutantes arcará com os impostos, taxas, emolumentos notariais e registrais, despachantes, bem assim outras que vierem a ser necessárias para lavratura da escritura de permuta e posterior registro cartorial.</p>
      
      <h2>Cláusula 7ª a 10ª – Disposições gerais e Rescisão</h2>
      <p>1) O(s) adquirente(s) poderão ceder ou transferir os direitos decorrentes deste contrato, independentemente de anuência da outra parte, ficando cedentes e cessionários solidários.<br/>
      2) Cada qual das partes permutantes arcará com as despesas de energia e água lançadas até a data de entrega do imóvel dado em permuta, obrigando-se a transferir a titularidade em até 60 dias.<br/>
      3) As partes declaram que vistoriaram os imóveis, aceitando-os no estado em que se encontram, sendo a posse transmitida neste ato com a entrega das chaves.<br/>
      4) O presente contrato é celebrado sob a condição expressa de irrevogabilidade e irretratabilidade. Para tal as partes permutantes renunciam expressamente à faculdade de arrependimento prevista no art. 420 do Código Civil.</p>
      
      <h2>Cláusula 11ª – Cláusula Penal</h2>
      <p>1) Será devido pela parte permutante que infringir qualquer das obrigações estabelecidas neste contrato multa de <strong>20% (vinte por cento)</strong> sobre o preço do contrato a ser pago à parte permutante inocente, sem prejuízo de perdas e danos.</p>
      
      <h2>Cláusula 12ª e 13ª – Foro e Fechamento</h2>
      <p>1) Todas as questões eventualmente oriundas do presente contrato, serão resolvidas, de forma definitiva via conciliatória ou arbitral, na 8ª Corte de Conciliação e Arbitragem de Goiânia (8ª CCA), com sede na Rua 56, Qd CH Lt 07, Goiânia - GO consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.<br/>
      2) As partes permutantes assinam abaixo, juntamente com 02 (duas) testemunhas, em 03 (três) vias de igual teor.</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.seller_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Primeiro Permutante</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_COMPRADOR}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.buyer_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Segundo Permutante</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        ${brokerSignature('Intermediador')}
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_1}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 100%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_2}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
    `;
  } else if (type === 'rent_noguarantee') {
    contractContent = `
      <h1>CONTRATO DE LOCAÇÃO RESIDENCIAL SEM GARANTIA</h1>
      
      <h2>IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>
      
      <p><strong>LOCADOR:</strong> <strong>${val(data.landlord_name)}</strong>, ${val(data.landlord_nationality, 'brasileiro(a)')}, ${val(data.landlord_marital_status)}, ${val(data.landlord_profession)}, portador(a) da cédula de identidade RG nº ${val(data.landlord_rg)} e CPF nº ${val(data.landlord_document)}${spouseText(data.landlord_spouse_name, data.landlord_spouse_document, data.landlord_spouse_rg, data.landlord_spouse_profession)}, residente e domiciliado(a) à ${val(data.landlord_address)}.</p>
      
      <p><strong>LOCATÁRIO:</strong> <strong>${val(data.tenant_name)}</strong>, ${val(data.tenant_nationality, 'brasileiro(a)')}, ${val(data.tenant_marital_status)}, ${val(data.tenant_profession)}, portador(a) da cédula de identidade RG nº ${val(data.tenant_rg)} e CPF nº ${val(data.tenant_document)}${spouseText(data.tenant_spouse_name, data.tenant_spouse_document, data.tenant_spouse_rg, data.tenant_spouse_profession)}, residente e domiciliado(a) à ${val(data.tenant_address)}.</p>
      
      <p><strong>REPRESENTANTE DO LOCADOR / ADMINISTRADOR:</strong> <strong>${resolvedBrokerDisplayName}</strong>, corretor(a) de imóveis, inscrito(a) no CPF nº ${resolvedBrokerDisplayDoc.replace('CPF/CNPJ: ', '')}${resolvedBrokerDisplayCreci ? ` e ${resolvedBrokerDisplayCreci}` : ''}, atuando neste ato como administrador do imóvel e representante legal do locador.</p>
      
      <p><em>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Locação Residencial sem garantia locatícia, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente.</em></p>
      
      <h2>DO OBJETO DO CONTRATO E UTILIZAÇÃO</h2>
      <p>Cláusula 1ª. O presente tem como OBJETO o imóvel de propriedade do LOCADOR, situado na <strong>${val(data.property_address)}</strong>, livre de ônus ou quaisquer dívidas.<br/>
      Parágrafo único: O imóvel entregue na data da assinatura deste contrato, pelo LOCADOR ao LOCATÁRIO, possui as características contidas no auto de vistoria anexo, que desde já aceitam expressamente.</p>
      
      <p>Cláusula 2ª. A presente LOCAÇÃO destina-se restritivamente ao uso do imóvel para fins residenciais, restando proibido ao LOCATÁRIO sublocá-lo ou usá-lo de forma diferente do previsto, salvo autorização expressa do LOCADOR.</p>
      
      <h2>DAS CONDIÇÕES DO IMÓVEL, BENFEITORIAS E CONSTRUÇÕES</h2>
      <p>Cláusula 3ª. O imóvel objeto deste contrato será entregue nas condições descritas no auto de vistoria, ou seja, com instalações elétricas e hidráulicas em perfeito funcionamento, com todos os cômodos e paredes pintados, devendo o LOCATÁRIO mantê-lo desta forma. Fica acordado que o imóvel será devolvido nas mesmas condições previstas no auto de vistoria, e com todos os tributos e despesas pagas.</p>
      
      <p>Cláusula 4ª. Qualquer benfeitoria ou construção deverá, de imediato, ser submetida a autorização expressa do LOCADOR. Vindo a ser feita benfeitoria, faculta ao LOCADOR aceitá-la ou não. As benfeitorias, consertos ou reparos farão parte integrante do imóvel, não assistindo ao LOCATÁRIO o direito de retenção ou indenização.</p>
      
      <h2>DA DEVOLUÇÃO DO IMÓVEL E DO CONDOMÍNIO</h2>
      <p>Cláusula 5ª. O LOCATÁRIO restituirá o imóvel locado nas mesmas condições as quais o recebeu, salvo as deteriorações decorrentes do uso normal e habitual do imóvel.<br/>
      Parágrafo único. Os autos de vistoria inicial e final conterão assinatura de duas testemunhas e dos contratantes.</p>
      
      <p>Cláusula 6ª. Fica desde já ciente o LOCATÁRIO que, em caso de imóvel onde haja condomínio, restará o mesmo obrigado por todas as cláusulas constantes na Convenção e no Regulamento Interno existente.</p>
      
      <h2>DO DIREITO DE PREFERÊNCIA E VISTORIAS</h2>
      <p>Cláusula 7ª. Caso o LOCADOR manifeste vontade de vender o imóvel, deverá propor por escrito ao LOCATÁRIO que se obrigará a emitir a resposta em 30 (trinta) dias.</p>
      
      <p>Cláusula 8ª e 9ª. O LOCATÁRIO permitirá ao LOCADOR realizar vistorias no imóvel em dia e hora a serem combinados. Constatando-se algum vício que afete a estrutura física do imóvel, ficará compelido o LOCATÁRIO a realizar o conserto. Não se manifestando, o LOCATÁRIO permitirá desde logo ao LOCADOR vistoriar o imóvel com possíveis pretendentes.</p>
      
      <h2>DOS ATOS DE INFORMAÇÃO E SEGURO CONTRA INCÊNDIO</h2>
      <p>Cláusula 10ª. As partes integrantes deste contrato ficam acordadas a se comunicarem somente por escrito.</p>
      
      <p>Cláusula 11ª e 12ª. O LOCATÁRIO fica desde já obrigado a fazer seguro contra incêndios do imóvel locado. Qualquer acidente que ocorra no imóvel por culpa ou dolo do LOCATÁRIO, o mesmo ficará obrigado a pagar todas as despesas por danos causados.</p>
      
      <h2>DO VALOR DO ALUGUEL, REAJUSTE, DESPESAS E TRIBUTOS</h2>
      <p>Cláusula 13ª. Como aluguel mensal, o LOCATÁRIO se obrigará a pagar o valor de <strong>R$ ${val(data.rent_value)}</strong>, a ser efetuado diretamente ao LOCADOR ou seu procurador, até o dia <strong>${val(data.due_day)}</strong> de cada mês subsequente ao vencido.</p>
      
      <p>Cláusula 14ª e 15ª. Fica obrigado o LOCADOR a emitir recibo da quantia paga. O valor do aluguel será reajustado anualmente, tendo como base os índices previstos (IPCA, IGPM, etc).</p>
      
      <p>Cláusula 16ª e 17ª. Faculta ao LOCADOR cobrar do LOCATÁRIO o(s) aluguel(éis) e tributo(s) vencido(s). Todas as despesas diretamente ligadas à conservação do imóvel, água, luz, gás, telefone, condomínio e tributos, ficarão sob a responsabilidade do LOCATÁRIO.</p>
      
      <h2>DA MULTA, ATRASO, DESCONTO E TOLERÂNCIA</h2>
      <p>Cláusula 18ª e 19ª. O LOCATÁRIO, não vindo a efetuar o pagamento do aluguel até a data estipulada, fica obrigado a pagar multa de mora de 10% (dez por cento) sobre o valor do aluguel, juros de mora de 1% (um por cento) ao mês e correção monetária.</p>
      
      <p>Cláusula 20ª e 21ª. O LOCATÁRIO terá desconto de R$ _________________ caso pague o valor do aluguel até o 1º dia útil do mês subsequente. Terá um prazo de tolerância para efetuar o pagamento do aluguel até o 2º (segundo) dia útil após o vencimento.</p>
      
      <h2>DA MULTA POR INFRAÇÃO E RESCISÃO CONTRATUAL</h2>
      <p>Cláusula 22ª. As partes estipulam o pagamento da multa no valor de 03 (três) aluguéis vigentes à época da ocorrência àquele que venha a infringir quaisquer das cláusulas contidas neste contrato.</p>
      
      <p>Cláusula 23ª e 24ª. Ocorrerá a rescisão do presente contrato quando ocorrer sinistro, incêndio ou desapropriação do imóvel. Caso o imóvel seja utilizado de forma diversa da locação residencial, restará facultado ao LOCADOR rescindir o presente contrato de plano.</p>
      
      <h2>DO PRAZO DE LOCAÇÃO E PRORROGAÇÃO</h2>
      <p>Cláusula 25ª. A presente locação terá o lapso temporal de validade de <strong>${val(data.lease_duration)} meses</strong>, a iniciar-se no dia ${val(data.start_date)} e findar-se no dia ${val(data.end_date)}, efetivando-se com a entrega das chaves.</p>
      
      <p>Cláusula 26ª a 28ª. Ultrapassando o contrato a data prevista, tornando-se contrato por tempo indeterminado, poderá o LOCADOR rescindi-lo a qualquer tempo, com notificação de 30 dias. Os herdeiros e sucessores se obrigam ao inteiro teor deste contrato.</p>
      
      <h2>DO FORO</h2>
      <p>Cláusula 29ª. O presente contrato passa a vigorar a partir da assinatura. Todas as questões eventualmente oriundas do presente contrato serão resolvidas, de forma definitiva via conciliatória ou arbitral, na 8ª Corte de Conciliação e Arbitragem de Goiânia (8ª CCA), com sede na Rua 56, nº 390, Jardim Goiás, Goiânia – GO, consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.landlord_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Locador(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_INQUILINO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.tenant_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Locatário(a)</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        ${brokerSignature('Administrador do Imóvel')}
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_1}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
    `;
  } else if (type === 'rent_commercial') {
    contractContent = `
      <h1>CONTRATO DE LOCAÇÃO COMERCIAL</h1>
      
      <p><strong>LOCADOR(A):</strong> ${val(data.landlord_name)}<br/>
      <strong>LOCATÁRIO(A):</strong> ${val(data.tenant_name)}<br/>
      <strong>FIADOR(A):</strong> ${val(data.guarantor_name, '_________________________________')}<br/>
      <strong>IMÓVEL:</strong> ${val(data.property_address)}<br/>
      <strong>PRAZO:</strong> ${val(data.lease_duration)} meses<br/>
      <strong>INÍCIO DA LOCAÇÃO:</strong> ${val(data.start_date)}<br/>
      <strong>TÉRMINO DA LOCAÇÃO:</strong> ${val(data.end_date)}<br/>
      <strong>VALOR MENSAL:</strong> R$ ${val(data.rent_value)}<br/>
      <strong>REAJUSTE:</strong> ANUAL (IPCA)<br/>
      <strong>DESTINAÇÃO:</strong> COMERCIAL</p>
      
      <p>Pelo presente instrumento, e na melhor forma de direito, as partes contratantes abaixo qualificadas e designadas, tem entre si justo e contratado conforme segue:</p>
      
      <h2>I – DAS PARTES CONTRATANTES:</h2>
      <p>I.1) <strong>Locador(a):</strong> <strong>${val(data.landlord_name)}</strong>, ${val(data.landlord_nationality, 'brasileiro(a)')}, ${val(data.landlord_marital_status)}, ${val(data.landlord_profession)}, portador(a) da cédula de identidade RG nº ${val(data.landlord_rg)} e CPF nº ${val(data.landlord_document)}${spouseText(data.landlord_spouse_name, data.landlord_spouse_document, data.landlord_spouse_rg, data.landlord_spouse_profession)}, residente e domiciliado(a) à ${val(data.landlord_address)}.</p>
      
      <p>I.2) <strong>Locatário(a):</strong> <strong>${val(data.tenant_name)}</strong>, ${val(data.tenant_nationality, 'brasileiro(a)')}, ${val(data.tenant_marital_status)}, ${val(data.tenant_profession)}, portador(a) da cédula de identidade RG nº ${val(data.tenant_rg)} e CPF nº ${val(data.tenant_document)}${spouseText(data.tenant_spouse_name, data.tenant_spouse_document, data.tenant_spouse_rg, data.tenant_spouse_profession)}, residente e domiciliado(a) à ${val(data.tenant_address)}.</p>
      
      <h2>II – DO IMÓVEL:</h2>
      <p>II.1) O imóvel objeto da presente locação situa-se na <strong>${val(data.property_address)}</strong>.</p>
      
      <h2>III – DO PRAZO:</h2>
      <p>III.1) O presente contrato tem o prazo de <strong>${val(data.lease_duration)} meses</strong>, com início em ${val(data.start_date)} e término em ${val(data.end_date)}.</p>
      
      <p>III.2) Findo o presente contrato, obriga-se a Locatária a restituir o imóvel desimpedido de pessoas e de coisas, independente de qualquer aviso ou notificação, ou ainda de interpelação de qualquer espécie.</p>
      
      <h2>IV – DO ALUGUEL:</h2>
      <p>IV.1) O aluguel é livremente ajustado entre as partes em <strong>R$ ${val(data.rent_value)}</strong> mensais, para os 12 (doze) primeiros meses de locação respeitada as cláusulas subsequentes.</p>
      
      <p>IV.2) O índice de reajuste utilizado é o IPCA - Índice Nacional de Preços ao Consumidor Amplo (IBGE), ou outro que venha a substituí-lo, na menor periodicidade permitida em lei, ou seja, a cada 12 meses de locação.</p>
      
      <p>IV.3) O aluguel deverá ser pago até o dia <strong>${val(data.due_day)}</strong> de cada mês subsequente ao vencido, devendo os pagamentos ser efetuados via transferência bancária ou em local indicado pela Administradora.</p>
      
      <p>IV.4) O atraso no pagamento do aluguel ou de qualquer outro encargo da locação implicará na incidência de multa penal de 10% (dez por cento) sobre o valor total do débito, acrescido de juros de mora de 1% (um por cento) ao mês e correção monetária.</p>
      
      <h2>V – DOS ENCARGOS DA LOCAÇÃO:</h2>
      <p>V.1) Além do aluguel, caberá à Locatária o pagamento de todos os impostos, taxas, tarifas de água, luz, gás, telefone, bem como as despesas ordinárias de condomínio (se houver), que recaiam ou venham a recair sobre o imóvel locado, durante o prazo da locação.</p>
      
      <p>V.2) A Locatária obriga-se a apresentar ao Locador ou Administradora, quando solicitado, os comprovantes de pagamento dos encargos previstos no item anterior.</p>
      
      <h2>VI – DA CONSERVAÇÃO E REPAROS:</h2>
      <p>VI.1) A Locatária declara receber o imóvel em perfeito estado de conservação, pintura e funcionamento, conforme termo de vistoria, obrigando-se a mantê-lo e restituí-lo nas mesmas condições.</p>
      
      <p>VI.2) A manutenção e conservação do imóvel, suas instalações e equipamentos, serão de exclusiva responsabilidade da Locatária.</p>
      
      <p>VI.3) Fica expressamente vedado à Locatária realizar quaisquer obras, modificações ou benfeitorias no imóvel sem o prévio e expresso consentimento por escrito do Locador. As benfeitorias, sejam úteis, necessárias ou voluptuárias, incorporar-se-ão ao imóvel, não assistindo à Locatária direito a retenção ou indenização.</p>
      
      <h2>VII – DA VISTORIA:</h2>
      <p>VII.1) O Locador ou seu representante legal poderá vistoriar o imóvel, em dia e hora previamente ajustados com a Locatária, com antecedência mínima de 24 (vinte e quatro) horas.</p>
      
      <h2>VIII – DOS FIADORES:</h2>
      <p>VIII.1) Assina(m) o presente contrato, na qualidade de fiador(es) e principal(is) pagador(es), solidariamente responsável(is) com a Locatária pelo exato cumprimento de todas as obrigações: <strong>${val(data.guarantor_name, '_________________________________')}</strong>, CPF nº <strong>${val(data.guarantor_document, '_________________')}</strong>.</p>
      
      <p>VIII.2) A responsabilidade do(s) fiador(es) estende-se até a efetiva entrega das chaves do imóvel, renunciando expressamente aos benefícios de ordem e direitos previstos nos artigos 827, 835 e 838 do Código Civil Brasileiro.</p>
      
      <h2>IX – DA RESCISÃO E MULTA:</h2>
      <p>IX.1) A infração a qualquer das cláusulas do presente contrato ensejará a sua imediata rescisão, sujeitando a parte infratora ao pagamento de multa equivalente a 03 (três) vezes o valor do aluguel vigente à época da infração.</p>
      
      <h2>X – DAS DISPOSIÇÕES GERAIS:</h2>
      <p>X.1) Qualquer comunicação entre as partes deverá ser feita por escrito, mediante protocolo ou correspondência com aviso de recebimento.</p>
      
      <p>X.2) A tolerância de qualquer das partes quanto ao descumprimento de obrigações pela outra parte não constituirá novação ou renúncia a direitos.</p>
      
      <p>X.3) A responsabilidade pela obtenção de alvarás de funcionamento, laudos do Corpo de Bombeiros e demais licenças exigidas pelo Poder Público, bem como as adaptações exigidas para o exercício da atividade comercial, será de responsabilidade única da Locatária.</p>
      
      <p>X.4) Este contrato obriga as partes, herdeiros e sucessores.</p>
      
      <p>X.5) Na hipótese de ação de despejo por falta de pagamento ou qualquer outra que o Locador venha a ajuizar em face da Locatária fica ajustado entre as partes que os honorários do advogado do Locador serão de 20% (vinte por cento) sobre o valor da causa.</p>
      
      <p>X.6) Todas as questões eventualmente oriundas do presente contrato, serão resolvidas, de forma definitiva via conciliatória ou arbitral, na 8ª Corte de Conciliação e Arbitragem de Goiânia (8ª CCA), com sede na Rua 56, nº 390, Jardim Goiás, Goiânia – GO, consoante os preceitos ditados pela Lei nº 9.307 de 23/09/1996.</p>
      
      <p>E por estarem assim, justos e contratados, ratificam todas as cláusulas e dizeres constantes no presente instrumento, lidos, discutidos e entendidos, assinando-os em 02 (duas) vias de igual teor, na presença de duas testemunhas.</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.landlord_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Locador(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_INQUILINO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.tenant_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Locatário(a)</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_FIADOR}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.guarantor_name, '_________________________________')}</strong><br/>
          <span style="font-size: 14px; color: #000;">Fiador(a) Principal</span>
        </div>
        ${brokerSignature('Administrador do Imóvel')}
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_1}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_TESTEMUNHA_2}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/>
          <span style="font-size: 14px; color: #000;">CPF:</span>
        </div>
      </div>
    `;
  } else if (type === 'keys_receipt') {
    contractContent = `
      <h1>RECIBO DE CHAVES E RESCISÃO PROVISÓRIA</h1>
      
      <p style="margin-top: 30px;">Fica rescindido provisoriamente nesta data o contrato de locação do imóvel localizado em:</p>
      
      <p><strong>${val(data.property_address)}</strong></p>
      
      <p>Tendo como Locatário(a) o(a) Sr(a). <strong>${val(data.tenant_name, data.buyer_name)}</strong>, que neste ato realiza a entrega das chaves do referido imóvel.</p>
      
      <p>Fica pendente para a emissão da rescisão definitiva a conferência da vistoria final de desocupação, bem como a comprovação de quitação e corte simbólico (ou transferência de titularidade) de energia elétrica, água/esgoto e condomínio, além da quitação de eventuais aluguéis residuais ou multas contratuais estipuladas pendentes.</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_IMOBILIARIA}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(tenant?.name)} / Locador</strong><br/>
          <span style="font-size: 14px; color: #000;">Recebedor das Chaves</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_INQUILINO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.tenant_name, data.buyer_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Locatário(a)</span>
        </div>
      </div>
    `;
  } else if (type === 'inspection') {
    contractContent = `
      <h1>AUTO DE VISTORIA DE IMÓVEL</h1>
      
      <p>Parte integrante do contrato de locação/venda do imóvel situado em: <strong>${val(data.property_address)}</strong></p>
      
      <p>Locador/Vendedor: <strong>${val(data.seller_name, data.landlord_name)}</strong></p>
      
      <p>Locatário/Comprador: <strong>${val(data.buyer_name, data.tenant_name)}</strong></p>
      
      <h2>1. ESTADO GERAL DO IMÓVEL</h2>
      <p>O imóvel encontra-se em perfeito estado de conservação, com pintura nova, instalações elétricas e hidráulicas funcionando perfeitamente, sem vazamentos, goteiras ou infiltrações visíveis nesta data.</p>
      
      <h2>2. DETALHAMENTO DOS CÔMODOS</h2>
      <p><em>(Preencher manualmente as ressalvas ou anexar relatório fotográfico complementar)</em></p>
      
      <p>Pintura e Paredes: _________________________________________________________________</p>
      
      <p>Pisos e Rodapés: __________________________________________________________________</p>
      
      <p>Portas, Fechaduras e Janelas: _______________________________________________________</p>
      
      <p>Instalações Elétricas / Hidráulicas: ____________________________________________________</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_PROPRIETARIO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.seller_name, data.landlord_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Proprietário</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_INQUILINO}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.buyer_name, data.tenant_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Inquilino/Comprador</span>
        </div>
      </div>
    `;
  } else if (type === 'visit_control') {
    contractContent = `
      <h1>FICHA DE CONTROLE DE VISITAS</h1>
      
      <p>Imobiliária/Corretor: <strong>${val(tenant?.name)}</strong></p>
      
      <h2>DADOS DO IMÓVEL VISITADO</h2>
      <p>Endereço: <strong>${val(data.property_address)}</strong></p>
      
      <p>Descrição: ${val(data.property_description)}</p>
      
      <h2>DADOS DO CLIENTE VISITANTE</h2>
      <p>Nome: <strong>${val(data.buyer_name, data.tenant_name)}</strong></p>
      
      <p>Telefone: ${val(data.buyer_phone, data.tenant_phone)}</p>
      
      <p>CPF: ${val(data.buyer_document, data.tenant_document)}</p>
      
      <h2>TERMO DE RECONHECIMENTO</h2>
      <p>Declaro, para todos os fins de direito e de fato, que visitei o imóvel acima descrito nesta data, acompanhado pelo corretor de imóveis desta empresa. Comprometo-me a realizar qualquer tratativa de compra, locação ou proposta deste imóvel única e exclusivamente através desta imobiliária, reconhecendo e respeitando o seu trabalho de corretagem e angariação.</p>
      
      <p style="margin-top: 40px; text-align: right;">Local e data: ______________________, _____ de ______________ de _______.</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_COMPRADOR}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(data.buyer_name, data.tenant_name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Assinatura do Cliente</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
            {{ASSINATURA_IMOBILIARIA}}
          </div>
          _________________________________________________<br/>
          <strong style="font-size: 14px; color: #000;">${val(tenant?.name)}</strong><br/>
          <span style="font-size: 14px; color: #000;">Corretor Responsável</span>
        </div>
      </div>
    `;
  } else {
    contractContent = `
      <h1>Documento em construção</h1>
      <p>O modelo ${type} está a ser configurado no sistema.</p>
    `;
  }

  // Renderiza o HTML final na nova janela com cabeçalho de repetição (thead)
  const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>Contrato - ${val(companyName || tenant?.name)}</title>
  ${styles}
</head>
<body>
  <div class="a4-page">
    <table>
      <thead>
        <tr>
          <td>
            <div class="header">
              <div>
                <img src="${logoSrc}" class="logo" alt="Logo" />
              </div>
              <div class="header-text">
                <div style="font-size: 14px; font-weight: bold; text-transform: uppercase; margin-bottom: 2px; color: ${tenant?.site_data?.primaryColor || '#000'}">${val(companyName || tenant?.name, 'Imobiliária')}</div>
                <div style="font-size: 10px; color: #666;">Tel: ${val(tenant?.phone)} | Email: contato@${val(tenant?.subdomain)}.com.br</div>
              </div>
            </div>
          </td>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td>
            ${contractContent}
          </td>
        </tr>
      </tbody>
    </table>
  </div>
  <script>
    // Aguarda o carregamento completo (incluindo a imagem da logomarca) antes de abrir a impressão
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 800);
    };
    
    // Fallback de segurança caso a imagem demore muito
    setTimeout(function() {
      if (!window.printed) {
        window.printed = true;
        window.print();
      }
    }, 3000);
  </script>
</body>
</html>`;

  return html;
};

type SignatureManifestCompany = {
  admin_signature_url?: string | null;
  name?: string | null;
};

type SignatureManifestEntry = {
  signer_name?: string | null;
  signer_role?: string | null;
  signer_email?: string | null;
  ip_address?: string | null;
  signed_at?: string | null;
  token?: string | null;
  signature_image?: string | null;
};

export const appendSignatureManifest = (
  originalHtml: string,
  company: SignatureManifestCompany | null | undefined,
  signatures: SignatureManifestEntry[] = []
): string => {
  if (!company?.admin_signature_url && signatures.length === 0) {
    return originalHtml;
  }

  const manifestHtml = `
    <div style="page-break-before: always; padding: 40px; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b;">
      <h2 style="text-align: center; font-size: 22px; border-bottom: 2px solid #e2e8f0; padding-bottom: 12px; margin-bottom: 30px; font-weight: bold;">
        Manifesto de Assinaturas Eletronicas
      </h2>

      ${company?.admin_signature_url ? `
        <div style="margin-bottom: 40px;">
          <h3 style="font-size: 15px; margin-bottom: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Representante Legal / Imobiliaria</h3>
          <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background-color: #f8fafc;">
            <img src="${company.admin_signature_url}" style="max-height: 80px; display: block; margin-bottom: 10px;" alt="Assinatura Imobiliaria" />
            <p style="margin: 0; font-size: 14px; font-weight: bold;">${company.name || 'Imobiliaria'}</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #64748b;">Assinatura Digital do Responsavel</p>
          </div>
        </div>
      ` : ''}

      ${signatures.length > 0 ? `
        <h3 style="font-size: 15px; margin-bottom: 12px; color: #475569; text-transform: uppercase; letter-spacing: 0.05em;">Signatarios (Partes Envolvidas)</h3>
        <div style="display: flex; flex-direction: column; gap: 20px;">
          ${signatures.map((sig) => `
            <div style="border: 1px solid #e2e8f0; padding: 20px; border-radius: 8px; background-color: #f8fafc;">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 16px;">
                <div>
                  <p style="margin: 0; font-size: 14px; font-weight: bold; color: #0f172a;">
                    ${sig.signer_name || 'Signatario'}
                    <span style="font-size: 10px; font-weight: 600; background: #e2e8f0; color: #475569; padding: 2px 6px; border-radius: 4px; margin-left: 8px; text-transform: uppercase;">${sig.signer_role || 'Parte'}</span>
                  </p>
                  <p style="margin: 6px 0 2px; font-size: 12px; color: #64748b;"><b>E-mail:</b> ${sig.signer_email || 'Nao informado'}</p>
                  <p style="margin: 2px 0; font-size: 12px; color: #64748b;"><b>Endereco IP:</b> ${sig.ip_address || 'Nao registado'}</p>
                  <p style="margin: 2px 0; font-size: 12px; color: #64748b;"><b>Data/Hora:</b> ${sig.signed_at ? new Date(sig.signed_at).toLocaleString('pt-PT') : 'Pendente'}</p>
                  <p style="margin: 6px 0 0; font-size: 10px; color: #94a3b8; font-family: monospace;">Hash Autenticador: ${sig.token || 'Nao disponivel'}</p>
                </div>
                ${sig.signature_image ? `
                  <div style="text-align: right;">
                    <img src="${sig.signature_image}" style="max-height: 70px; max-width: 150px; object-fit: contain; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;" alt="Assinatura" />
                    <p style="margin: 4px 0 0; font-size: 10px; color: #10b981; font-weight: bold;">Assinado Eletronicamente</p>
                  </div>
                ` : `
                  <div style="padding: 8px 12px; background: #fffbeb; color: #b45309; font-size: 12px; border-radius: 6px; border: 1px solid #fde68a; font-weight: 500;">
                    Aguardando Assinatura
                  </div>
                `}
              </div>
            </div>
          `).join('')}
        </div>
      ` : ''}

      <div style="margin-top: 50px; text-align: center; font-size: 11px; color: #94a3b8; border-top: 1px dashed #e2e8f0; padding-top: 20px;">
        Documento gerado, processado e validado juridicamente pela plataforma <b>Elevatio Vendas</b>.<br/>
        A assinatura eletronica possui validade legal nos termos da legislacao em vigor.
      </div>
    </div>
  `;

  if (/<\/body>/i.test(originalHtml)) {
    return originalHtml.replace(/<\/body>/i, `${manifestHtml}\n</body>`);
  }

  return originalHtml + manifestHtml;
};

export const generateContract = async (type: string, data: any, tenant: any, company_logo?: string, broker_name?: string, broker_document?: string, broker_creci?: string, company_name?: string, customTemplateContent?: string) => {
  const html = await buildContractHtml(
    type,
    data,
    tenant,
    company_logo,
    broker_name,
    broker_document,
    broker_creci,
    company_name,
    customTemplateContent
  );

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita os pop-ups para gerar o contrato.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
};

// ========== GERADOR DE HEADERS CUSTOMIZÁVEIS ==========
export type HeaderVariant = 'logo_only' | 'logo_name' | 'logo_phone' | 'logo_name_phone' | 'full_header';

export const buildContractHeader = (variant: HeaderVariant, tenant: any, logoUrl?: string) => {
  const tName = tenant?.corporate_name || tenant?.trade_name || tenant?.company_name || tenant?.name || '';
  const tPhone = tenant?.whatsapp || tenant?.phone;
  const logoHtml = logoUrl ? `<img src="${logoUrl}" style="max-height: 60px; object-fit: contain;" />` : '';
  const nameHtml = tName ? `<h2 style="margin: 0; font-size: 18px; color: #1e293b;">${tName}</h2>` : '';
  const phoneHtml = tPhone ? `<p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">📞 ${tPhone}</p>` : '';
  const emailHtml = tenant?.email ? `<p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">✉️ ${tenant.email}</p>` : '';
  const addressHtml = tenant?.address ? `<p style="margin: 4px 0 0; font-size: 12px; color: #64748b;">📍 ${tenant.address}</p>` : '';

  let rightContent = '';
  if (variant === 'logo_name') rightContent = `${nameHtml}`;
  if (variant === 'logo_phone') rightContent = `${phoneHtml}`;
  if (variant === 'logo_name_phone') rightContent = `${nameHtml}${phoneHtml}`;
  if (variant === 'full_header') rightContent = `${nameHtml}${phoneHtml}${emailHtml}${addressHtml}`;

  return `<div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #f1f5f9; padding-bottom: 20px; margin-bottom: 30px;"><div>${logoHtml}</div><div style="text-align: right;">${rightContent}</div></div>`;
};

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

  if (normalizedRole.includes('conjuge') && normalizedRole.includes('fiador')) {
    return 'conjuge_fiador';
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
  conjuge_fiador: ['conjuge_fiador', 'conjuge_do_fiador', 'esposa_fiador', 'esposo_fiador', 'outorga_uxoria'],
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
    '{{ASSINATURA_CONJUGE_FIADOR}}',
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
      border-bottom: none;
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
      border-top: none !important; /* Força a remoção da linha preta */
      text-align: center;
      padding-top: 10px;
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
  const profFields = ['buyer_profession', 'seller_profession', 'landlord_profession', 'tenant_profession', 'buyer_spouse_profession', 'seller_spouse_profession', 'guarantor_profession', 'guarantor_spouse_profession', 'landlord_spouse_profession', 'tenant_spouse_profession'];
  profFields.forEach(field => {
    if (!data[field] || String(data[field]).trim() === '') {
      data[field] = defaultProf;
    }
  });

  // Função auxiliar para imprimir dados do cônjuge
  const spouseText = (name?: string, doc?: string, rg?: string, prof?: string) => {
    if (!name || name.trim() === '') return '';
    const docText = doc ? ` e CPF nº ${doc}` : '';
    const rgText = rg ? `, RG nº ${rg}` : '';
    const profText = prof ? `, ${prof}` : '';
    return `, e seu cônjuge ${name}${profText}${rgText}${docText}`;
  };

  // Extrai o siteData para acessar os dados da Empresa/Sede
  const siteData = typeof tenant?.site_data === 'string' ? JSON.parse(tenant.site_data) : tenant?.site_data || {};

  // Lógica de Fallback Inteligente (Sede > Perfil Corretor > Tenant Base)
  const isImob = data.representation_type === 'imobiliaria';
  
  const resolvedBrokerDisplayName = isImob
    ? (data.broker_name || siteData.corporate_name || tenant?.corporate_name || tenant?.name || companyName || 'Imobiliária')
    : (data.broker_name || brokerDisplayName || siteData.corporate_name || tenant?.name || 'Corretor');

  const finalDocument = isImob
    ? (data.broker_document || siteData.cnpj || tenant?.cnpj || tenant?.document || tenant?.cpf)
    : (data.broker_document || brokerDisplayDoc || siteData.cnpj || tenant?.document);
  const resolvedBrokerDisplayDoc = finalDocument ? `CPF/CNPJ: ${finalDocument}` : 'CPF/CNPJ: Não informado';

  const finalCreci = isImob
    ? (data.broker_creci || siteData.creci || tenant?.creci)
    : (data.broker_creci || brokerDisplayCreci || siteData.creci || tenant?.creci);
  const resolvedBrokerDisplayCreci = finalCreci ? `CRECI: ${finalCreci}` : '';

  // Montagem do Endereço e Contatos da Sede
  let companyFullAddress = '';
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
  const brokerSignature = (roleLabel: string, width: string = '50%') => `
    <div class="signature-line" style="display: table-cell; width: ${width}; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
      <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">
        {{ASSINATURA_IMOBILIARIA}}
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
      
      // LÓGICA DE REPRESENTAÇÃO JURÍDICA (Corretor vs. Imobiliária)
      .replace(/\{\{REPRESENTANTE_NOME\}\}/g, resolvedBrokerDisplayName || '____________________')
      .replace(/\{\{REPRESENTANTE_DOCUMENTO\}\}/g, finalDocument || '____________________')
      .replace(/\{\{REPRESENTANTE_CRECI\}\}/g, finalCreci || '____________________')
      
      // DADOS DO IMÓVEL
      .replace(/\{\{IMOVEL_TITULO\}\}/g, data.property?.title || '____________________')
      .replace(/\{\{IMOVEL_ENDERECO\}\}/g, propertyAddress)
      .replace(/\{\{IMOVEL_MATRICULA\}\}/g, data.property?.registration_number || data.property?.iptu_number || '____________________')
      
      // DADOS DO INQUILINO (LOCATÁRIO) - BLINDAGEM COMPLETA
      .replace(/\{\{INQUILINO_NOME\}\}/g, data.tenant_name || '____________________')
      .replace(/\{\{INQUILINO_DOCUMENTO\}\}/g, data.tenant_document || '____________________')
      .replace(/\{\{INQUILINO_RG\}\}/g, data.tenant_rg || '____________________')
      .replace(/\{\{INQUILINO_NACIONALIDADE\}\}/g, data.tenant_nationality || 'brasileiro(a)')
      .replace(/\{\{INQUILINO_PROFISSAO\}\}/g, data.tenant_profession || 'Autônomo')
      .replace(/\{\{INQUILINO_ESTADO_CIVIL\}\}/g, data.tenant_marital_status || '____________________')
      .replace(/\{\{INQUILINO_ENDERECO\}\}/g, data.tenant_address || '____________________')
      .replace(/\{\{INQUILINO_CONJUGE\}\}/g, data.tenant_spouse_name || 'N/A')
      .replace(/\{\{INQUILINO_CONJUGE_CPF\}\}/g, data.tenant_spouse_document || '____________________')
      .replace(/\{\{INQUILINO_CONJUGE_RG\}\}/g, data.tenant_spouse_rg || '____________________')
      .replace(/\{\{INQUILINO_CONJUGE_PROFISSAO\}\}/g, data.tenant_spouse_profession || 'Autônomo')
      
      // DADOS DO FIADOR (SE HOUVER)
      .replace(/\{\{FIADOR_NOME\}\}/g, data.guarantor_name || '____________________')
      .replace(/\{\{FIADOR_DOCUMENTO\}\}/g, data.guarantor_document || '____________________')
      .replace(/\{\{FIADOR_RG\}\}/g, data.guarantor_rg || '____________________')
      .replace(/\{\{FIADOR_PROFISSAO\}\}/g, data.guarantor_profession || 'Autônomo')
      .replace(/\{\{FIADOR_ESTADO_CIVIL\}\}/g, data.guarantor_marital_status || '____________________')
      .replace(/\{\{FIADOR_ENDERECO\}\}/g, data.guarantor_address || '____________________')
      
      // DADOS DO LOCATÁRIO / COMPRADOR (CLIENTE PRINCIPAL) - Aliases
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
      
      // VALORES E CONDIÇÕES
      .replace(/\{\{VALOR_NEGOCIADO\}\}/g, formatCurrency(dealValue))
      .replace(/\{\{VALOR_TOTAL\}\}/g, formatCurrency(dealValue))
      .replace(/\{\{VALOR_TOTAL_EXTENSO\}\}/g, currencyToWordsPtBr(dealValue))
      .replace(/\{\{VALOR_ALUGUEL\}\}/g, formatCurrency(data.rent_value || dealValue))
      .replace(/\{\{VALOR_SINAL\}\}/g, formatCurrency(data.sale_down_payment))
      .replace(/\{\{VALOR_FINANCIAMENTO\}\}/g, formatCurrency(data.sale_financing_value))
      .replace(/\{\{VALOR_FGTS\}\}/g, formatCurrency(data.sale_consortium_value))
      .replace(/\{\{VALOR_PERMUTA\}\}/g, formatCurrency(data.permutation_value))
      .replace(/\{\{QTD_PARCELAS\}\}/g, data.installments_count || '0')
      .replace(/\{\{DATA_VENCIMENTO\}\}/g, dueDateLabel)
      .replace(/\{\{PRAZO_MESES\}\}/g, String(leaseDuration))
      .replace(/\{\{DATA_ATUAL\}\}/g, formatLongDatePtBr(new Date()))
      .replace(/\{\{LOCAL_DATA\}\}/g, `${cityLocation}, ${formatLongDatePtBr(new Date())}`);

    parsedContent = parsedContent.replace(/\{\{cidade\}\}/g, cityLocation);
    parsedContent = parsedContent.replace(/\{\{estado\}\}/g, stateLocation);
    parsedContent = parsedContent.replace(/\{\{uf\}\}/g, stateLocation);
    parsedContent = parsedContent.replace(/\{\{data_atual\}\}/g, formatLongDatePtBr(new Date()));
    parsedContent = parsedContent.replace(/\{\{dia_atual\}\}/g, String(new Date().getDate()).padStart(2, '0'));
    parsedContent = parsedContent.replace(/\{\{mes_atual\}\}/g, new Date().toLocaleString('pt-BR', { month: 'long' }));
    parsedContent = parsedContent.replace(/\{\{ano_atual\}\}/g, String(new Date().getFullYear()));
    parsedContent = parsedContent.replace(/\{\{local_data\}\}/g, `${cityLocation}, ${formatLongDatePtBr(new Date())}`);

    // As tags {{ASSINATURA_*}} sao injectadas no PDF final, quando temos acesso a contract_signatures.
    contractContent = `<div style="text-align: justify; line-height: 1.6; font-size: 14px;">${parsedContent.replace(/\n/g, '<br/>')}</div>`;
  } else if (type === 'sale_standard') {
    contractContent = `
      <h2 style="text-align: center; color: #1e293b;">CONTRATO DE COMPRA E VENDA DE IMÓVEL A PRAZO (COM ALIENAÇÃO FIDUCIÁRIA)</h2>
      <h3 style="color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">IDENTIFICAÇÃO DAS PARTES</h3>
      <p><strong>VENDEDOR(A) / CREDOR(A) FIDUCIÁRIO(A):</strong> ${val(data.seller_name)}, documento nº ${val(data.seller_document)}, residente e domiciliado(a) na {{vendedor_endereco}}.</p>
      <p><strong>COMPRADOR(A) / DEVEDOR(A) FIDUCIANTE:</strong> ${val(data.buyer_name)}, documento nº ${val(data.buyer_document)}, residente e domiciliado(a) na {{comprador_endereco}}.</p>
      <h3 style="color: #334155;">CLÁUSULA PRIMEIRA E SEGUNDA - DO OBJETO E PAGAMENTO</h3>
      <p><strong>1.1.</strong> O objeto deste contrato é o imóvel situado na <strong>${val(data.property_address)}</strong>.</p>
      <p><strong>2.1.</strong> O preço total para a venda do imóvel é de <strong>R$ ${val(data.sale_total_value, data.total_value)}</strong>, pago da seguinte forma:</p>
      <p><strong>2.1.1. SINAL:</strong> O valor de <strong>R$ ${val(data.sale_down_payment, data.down_payment)}</strong>, pago neste ato pelo COMPRADOR(A).</p>
      <p><strong>2.1.2. SALDO DEVEDOR:</strong> O saldo remanescente, no valor de <strong>R$ ${val(data.sale_financing_value)}</strong>, financiado ou parcelado entre as partes.</p>
      <h3 style="color: #334155;">CLÁUSULA TERCEIRA - DA GARANTIA E FORO</h3>
      <p><strong>3.1.</strong> Para garantia do pagamento, o COMPRADOR(A), aliena fiduciariamente ao VENDEDOR(A) o próprio imóvel (Lei nº 9.514/97).</p>
      <p><strong>3.2.</strong> Fica eleito o foro da <strong>{{foro_comarca}}</strong> para dirimir litígios decorrentes deste contrato.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">DAS DISPOSIÇÕES GERAIS, LGPD E ASSINATURA ELETRÔNICA</h3>
      <p style="text-align: justify;"><strong>1.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento, equiparando-as a assinaturas de próprio punho (Art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="text-align: justify;"><strong>2.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual e proteção do crédito, nos termos da LGPD (Lei nº 13.709/2018).</p>
      ${type.startsWith('rent') ? '<p style="text-align: justify;"><strong>3.</strong> A multa rescisória será sempre cobrada de forma estritamente proporcional ao tempo restante de contrato, conforme determina o Art. 4º da Lei nº 8.245/91.</p>' : ''}
      <p style="margin-top: 30px; text-align: center;">{{local_data}}</p>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.seller_name)}</strong><br/><span style="font-size: 14px; color: #000;">Credor Fiduciário</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_COMPRADOR}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.buyer_name)}</strong><br/><span style="font-size: 14px; color: #000;">Devedor Fiduciante</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
      </div>
    `;
  } else if (type === 'rent_guarantor') {
    contractContent = `
      <h1>CONTRATO DE LOCAÇÃO RESIDENCIAL COM FIADOR</h1>

      <h2>IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>

      <p><strong>LOCADOR:</strong> <strong>${val(data.owner_name, data.landlord_name)}</strong>, ${val(data.landlord_nationality, 'brasileiro(a)')}, ${val(data.landlord_marital_status)}, ${val(data.landlord_profession)}, portador(a) da cédula de identidade RG nº ${val(data.landlord_rg)} e CPF nº ${val(data.owner_document, data.landlord_document)}${spouseText(data.landlord_spouse_name, data.landlord_spouse_document, data.landlord_spouse_rg || '', data.landlord_spouse_profession)}, residente e domiciliado(a) à {{locador_endereco}}.</p>

      <p><strong>LOCATÁRIO:</strong> <strong>${val(data.tenant_name)}</strong>, ${val(data.tenant_nationality, 'brasileiro(a)')}, ${val(data.tenant_marital_status)}, ${val(data.tenant_profession)}, portador(a) da cédula de identidade RG nº ${val(data.tenant_rg)} e CPF nº ${val(data.tenant_document)}${spouseText(data.tenant_spouse_name, data.tenant_spouse_document, data.tenant_spouse_rg || '', data.tenant_spouse_profession)}, residente e domiciliado(a) à {{locatario_endereco}}.</p>

      <p><strong>FIADOR(ES):</strong> <strong>${val(data.guarantor_name, '____________________')}</strong>, ${val(data.guarantor_nationality, 'brasileiro(a)')}, ${val(data.guarantor_marital_status, 'Estado Civil')}, ${val(data.guarantor_profession, 'Profissão')}, portador(a) da cédula de identidade RG nº ${val(data.guarantor_rg)} e CPF nº ${val(data.guarantor_document, '______________')}${spouseText(data.guarantor_spouse_name, data.guarantor_spouse_document, data.guarantor_spouse_rg || '', data.guarantor_spouse_profession)}, residente e domiciliado(a) à {{fiador_endereco}}.</p>

      <p><em>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Locação Residencial com Fiador, que se regerá pelas cláusulas seguintes e pelas condições de preço, forma e termo de pagamento descritas no presente.</em></p>

      <h2>Cláusula 1ª – DO OBJETO DA LOCAÇÃO</h2>
      <p>O presente contrato tem como OBJETO o imóvel de propriedade do LOCADOR, situado na <strong>${val(data.property_address)}</strong>, livre de ônus ou quaisquer dívidas.<br/>
      Parágrafo único: O imóvel é entregue na data da assinatura deste contrato nas condições descritas no auto de vistoria anexo, que desde já as partes aceitam expressamente.</p>

      <h2>Cláusula 2ª – DO PRAZO</h2>
      <p>A presente locação terá o lapso temporal de validade de <strong>${val(data.lease_duration)} meses</strong>, a iniciar-se na data da assinatura deste, data a qual o imóvel deverá ser devolvido nas condições previstas, efetivando-se com a entrega das chaves, independentemente de aviso ou qualquer outra medida judicial ou extrajudicial.</p>

      <h2>Cláusula 3ª – DO VALOR DO ALUGUEL, DESPESAS E TRIBUTOS</h2>
      <p>Como aluguel mensal, o LOCATÁRIO se obrigará a pagar o valor de <strong>R$ ${val(data.rent_value)}</strong>, a ser efetuado diretamente à administradora do imóvel ou mediante depósito bancário, até o dia <strong>{{dia_vencimento}}</strong> de cada mês subsequente ao vencido.<br/>
      Parágrafo 1º: Fica estipulado um desconto de pontualidade no valor de <strong>{{desconto_pontualidade}}</strong> se o pagamento for efetuado até a data de vencimento.<br/>
      Parágrafo 2º: Todas as despesas de água, luz, gás, telefone, taxas condominiais e IPTU ficarão a cargo do LOCATÁRIO durante todo o período de locação.<br/>
      <strong>Parágrafo 3º – TRANSFERÊNCIA DE TITULARIDADE:</strong> O(A) LOCATÁRIO(A) obriga-se a transferir para o seu CPF/CNPJ, no prazo improrrogável de 05 (cinco) dias úteis contados da assinatura deste, a titularidade das contas de consumo (energia elétrica, água/esgoto e gás) junto às concessionárias locais. O descumprimento sujeita o infrator à multa contratual, respondendo integralmente por perdas e danos caso o LOCADOR sofra qualquer restrição de crédito (SPC/Serasa) decorrente de faturas não pagas.</p>

      <h2>Cláusula 4ª – DA FIANÇA</h2>
      <p>Assinam o presente contrato, na qualidade de FIADORES e principais pagadores, solidariamente responsáveis com o LOCATÁRIO pelo exato cumprimento de todas as obrigações contratuais, as pessoas qualificadas no preâmbulo, os quais renunciam expressamente aos benefícios de ordem e de divisão previstos nos artigos 827, 828, 835 e 838 do Código Civil Brasileiro, bem como ao artigo 262 do Código de Processo Civil.<br/>
      Parágrafo único: A responsabilidade dos fiadores perdurará até a entrega real e efetiva das chaves do imóvel, mesmo em caso de prorrogação da locação por prazo indeterminado, na forma do Artigo 39 da Lei 8.245/91.</p>

      <h2>Cláusula 5ª – MULTAS, REAJUSTE E MORA</h2>
      <p>Em caso de atraso no pagamento dos aluguéis e encargos, perderá o direito ao desconto de pontualidade e incidirá multa penal de 10% (dez por cento) sobre o valor do débito, acrescido de juros de mora de 1% (um por cento) ao mês e correção monetária.<br/>
      O valor do aluguel será reajustado anualmente, ou no menor período fixado por lei, tendo como base o índice do IGP-M/FGV ou IPCA, acumulado no período.</p>

      <h2>Cláusula 6ª – DESTINAÇÃO E SUBLOCAÇÃO</h2>
      <p>A presente locação destina-se exclusivamente ao uso <strong>RESIDENCIAL</strong> do LOCATÁRIO e de sua família, restando expressamente proibido sublocar, ceder ou emprestar o imóvel, no todo ou em parte, sem prévia e expressa anuência por escrito do LOCADOR.</p>

      <h2>Cláusula 7ª – DA INFRAÇÃO CONTRATUAL E RESCISÃO</h2>
      <p>A infração de qualquer das cláusulas do presente contrato sujeitará o infrator à multa equivalente a 03 (três) vezes o valor do aluguel vigente à época da infração, cobrável por via executiva, sem prejuízo da rescisão do contrato e despejo.</p>

      <h2>Cláusula 8ª – FORO</h2>
      <p>Fica eleito o foro da <strong>{{foro_comarca}}</strong> para dirimir quaisquer dúvidas oriundas do presente contrato, renunciando a qualquer outro por mais privilegiado que seja.</p>

      <p>Por estarem, assim justos e contratados, firmam o presente instrumento em vias de igual teor, juntamente com as testemunhas.</p>

      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">DAS DISPOSIÇÕES GERAIS, LGPD E ASSINATURA ELETRÔNICA</h3>
      <p style="text-align: justify;"><strong>1.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento, equiparando-as a assinaturas de próprio punho (Art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="text-align: justify;"><strong>2.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual e proteção do crédito, nos termos da LGPD (Lei nº 13.709/2018).</p>
      ${type.startsWith('rent') ? '<p style="text-align: justify;"><strong>3.</strong> A multa rescisória será sempre cobrada de forma estritamente proporcional ao tempo restante de contrato, conforme determina o Art. 4º da Lei nº 8.245/91.</p>' : ''}
      <p style="margin-top: 40px; text-align: right;">{{local_data}}</p>

      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.owner_name, data.landlord_name)}</strong><br/>Locador(a)
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_INQUILINO}}</div>
          _________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.tenant_name)}</strong><br/>Locatário(a)
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: ${data.guarantor_marital_status === 'Casado(a)' || data.guarantor_marital_status === 'União Estável' ? '50%' : '100%'}; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_FIADOR}}</div>
          _________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.guarantor_name, 'Fiador')}</strong><br/>Fiador(a)
        </div>
        ${(data.guarantor_marital_status === 'Casado(a)' || data.guarantor_marital_status === 'União Estável') ? `
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_CONJUGE_FIADOR}}</div>
          _________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.guarantor_spouse_name, 'Cônjuge do Fiador')}</strong><br/>Cônjuge do Fiador(a)
        </div>
        ` : ''}
      </div>
    `;
  } else if (type === 'rent_deposit') {
    contractContent = `
      <h2 style="text-align: center; color: #1e293b; font-size: 18px; margin-bottom: 20px;">CONTRATO DE LOCAÇÃO RESIDENCIAL COM GARANTIA DE CAUÇÃO</h2>
      <h3 style="color: #334155; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">IDENTIFICAÇÃO DAS PARTES</h3>
      <p style="text-align: justify;"><strong>LOCADOR(A):</strong> ${val(data.owner_name, data.landlord_name)}, portador(a) da Cédula de Identidade e inscrito(a) no CPF/MF sob o nº ${val(data.owner_document, data.landlord_document)}, residente e domiciliado(a) na {{locador_endereco}}.</p>
      <p style="text-align: justify;"><strong>LOCATÁRIO(A):</strong> ${val(data.tenant_name)}, portador(a) da Cédula de Identidade e inscrito(a) no CPF/MF sob o nº ${val(data.tenant_document)}, residente e domiciliado(a) na {{locatario_endereco}}.</p>
      <p style="text-align: justify; margin-top: 15px;">As partes acima qualificadas celebram o presente Contrato de Locação para fins residenciais, regido pela Lei nº 8.245/91 e pelas seguintes cláusulas.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA PRIMEIRA - DO OBJETO</h3>
      <p style="text-align: justify;"><strong>1.1.</strong> O objeto deste contrato é a locação do imóvel residencial de propriedade do(a) LOCADOR(A), situado na <strong>${val(data.property_address)}</strong>.</p>
      <p style="text-align: justify;"><strong>1.2.</strong> O(A) LOCATÁRIO(A) declara ter vistoriado o imóvel e recebê-lo no estado em que se encontra, conforme Termo de Vistoria em anexo, que passa a fazer parte integrante deste contrato.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA SEGUNDA - DO PRAZO</h3>
      <p style="text-align: justify;"><strong>2.1.</strong> O prazo da locação é de <strong>${val(data.lease_duration)} meses</strong>, iniciando-se na data da assinatura deste, independentemente de aviso ou notificação.</p>
      <p style="text-align: justify;"><strong>2.2.</strong> Se o(a) LOCATÁRIO(A) permanecer no imóvel por mais de 30 dias após o fim do prazo, sem oposição do(a) LOCADOR(A), a locação ficará prorrogada por prazo indeterminado, mantidas todas as demais cláusulas deste contrato.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA TERCEIRA - DO ALUGUEL E ENCARGOS</h3>
      <p style="text-align: justify;"><strong>3.1.</strong> O valor do aluguel mensal é de <strong>R$ ${val(data.rent_value)}</strong>, a ser pago até o dia <strong>{{dia_vencimento}}</strong> do mês subsequente ao vencido.</p>
      <p style="text-align: justify;"><strong>3.2.</strong> Fica estipulado um <strong>desconto de pontualidade no valor de {{desconto_pontualidade}}</strong> para pagamentos efetuados rigorosamente até a data de vencimento. O atraso no pagamento implicará na perda deste desconto, além de multa de 10% (dez por cento) sobre o débito, juros de mora de 1% (um por cento) ao mês e correção monetária.</p>
      <p style="text-align: justify;"><strong>3.3.</strong> Além do aluguel, é de responsabilidade do(a) LOCATÁRIO(A) o pagamento pontual do Imposto Predial e Territorial Urbano (IPTU), da taxa de condomínio, do seguro contra incêndio e das contas de consumo.</p>
      <p style="text-align: justify;"><strong>3.4. TRANSFERÊNCIA DE TITULARIDADE:</strong> O(A) LOCATÁRIO(A) obriga-se a transferir para o seu CPF/CNPJ, no prazo improrrogável de 05 (cinco) dias úteis contados da assinatura deste, a titularidade das contas de consumo (energia elétrica, água/esgoto e gás) junto às concessionárias locais. O descumprimento sujeita o infrator à multa contratual, respondendo integralmente por perdas e danos caso o LOCADOR sofra qualquer restrição de crédito (SPC/Serasa) decorrente de faturas não pagas.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA QUARTA - DA GARANTIA (CAUÇÃO EM DINHEIRO)</h3>
      <p style="text-align: justify;"><strong>4.1.</strong> Para garantir o fiel cumprimento de todas as obrigações contratuais, o(a) LOCATÁRIO(A) compromete-se a pagar ao(à) LOCADOR(A), a título de caução em dinheiro, a quantia de <strong>${val(data.valor_caucao, '_____________')}</strong>, diluída e cobrada em <strong>${val(data.parcelas_caucao, '1')}</strong> parcela(s) iniciais, nos termos do Art. 37, I, e Art. 38, § 2º, da Lei nº 8.245/91.</p>
      <p style="text-align: justify;"><strong>4.2.</strong> O(A) LOCADOR(A) se obriga a depositar o valor recebido em caderneta de poupança, mantendo-o assim durante todo o período da locação.</p>
      <p style="text-align: justify;"><strong>4.3.</strong> Ao final da locação, uma vez cumpridas todas as obrigações pelo(a) LOCATÁRIO(A) e após a desocupação e vistoria final do imóvel, a quantia depositada, acrescida de todos os rendimentos da caderneta de poupança, será integralmente restituída ao(à) LOCATÁRIO(A).</p>
      <p style="text-align: justify;"><strong>4.4.</strong> Caso se verifique, ao final do contrato, a existência de débitos de aluguéis, encargos ou danos ao imóvel não reparados pelo(a) LOCATÁRIO(A), o(a) LOCADOR(A) fica autorizado(a) a utilizar o montante da caução (principal + rendimentos) para quitar tais valores.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA QUINTA - DOS DEVERES DAS PARTES E BENFEITORIAS</h3>
      <p style="text-align: justify;"><strong>5.1.</strong> Toda e qualquer benfeitoria a ser realizada no imóvel, seja ela útil ou voluptuária, dependerá de autorização prévia e por escrito do(a) LOCADOR(A). As benfeitorias autorizadas, de qualquer natureza, não gerarão direito a indenização ou retenção, incorporando-se ao imóvel ao final da locação.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA SEXTA - DA RESCISÃO E DO FORO</h3>
      <p style="text-align: justify;"><strong>6.1.</strong> A infração de qualquer cláusula deste contrato sujeita a parte infratora ao pagamento de multa correspondente a 3 (três) aluguéis vigentes.</p>
      <p style="text-align: justify;"><strong>6.2.</strong> Fica eleito o foro da <strong>{{foro_comarca}}</strong>, local do imóvel, para dirimir quaisquer litígios decorrentes deste contrato.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">DAS DISPOSIÇÕES GERAIS, LGPD E ASSINATURA ELETRÔNICA</h3>
      <p style="text-align: justify;"><strong>1.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento, equiparando-as a assinaturas de próprio punho (Art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="text-align: justify;"><strong>2.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual e proteção do crédito, nos termos da LGPD (Lei nº 13.709/2018).</p>
      ${type.startsWith('rent') ? '<p style="text-align: justify;"><strong>3.</strong> A multa rescisória será sempre cobrada de forma estritamente proporcional ao tempo restante de contrato, conforme determina o Art. 4º da Lei nº 8.245/91.</p>' : ''}
      <p style="margin-top: 30px; text-align: center;">{{local_data}}</p>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong>${val(data.owner_name, data.landlord_name)}</strong><br/>Locador(a)
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_INQUILINO}}</div>
          _________________________________________________<br/><strong>${val(data.tenant_name)}</strong><br/>Locatário(a)
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
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
  } else if (type === 'intermed_sale') {
    return buildContractHtml('intermediacao', data, tenant, companyLogo, brokerDisplayName, brokerDisplayDoc, brokerDisplayCreci, companyName, customTemplateContent);
  } else if (type === 'intermediacao') {
    const isRentIntermediation =
      data.listing_type === 'rent' ||
      data.listingType === 'rent' ||
      data.listing_mode === 'rent';

    // Se o sistema tentar gerar uma intermediação de locação por aqui, redireciona para o modelo correto
    if (isRentIntermediation) {
      return buildContractHtml('intermed_rent', data, tenant, companyLogo, brokerDisplayName, brokerDisplayDoc, brokerDisplayCreci, companyName, customTemplateContent);
    }

    contractContent = `
      <h2 style="text-align: center; color: #1e293b; font-size: 18px; margin-bottom: 20px; font-weight: bold;">CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INTERMEDIAÇÃO IMOBILIÁRIA (VENDA)</h2>
      
      <h3 style="color: #334155; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">I. IDENTIFICAÇÃO DAS PARTES</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>CONTRATANTE (PROPRIETÁRIO):</strong> ${val(data.owner_name)}, documento nº ${val(data.owner_document)}, residente e domiciliado(a) na ${val(data.owner_address)}.</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>CONTRATADO(A) (INTERMEDIADOR):</strong> ${resolvedBrokerDisplayName}, ${resolvedBrokerDisplayDoc}, ${resolvedBrokerDisplayCreci}.</p>
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">II. DO OBJETO E CONDIÇÕES DE VENDA</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>1.</strong> O CONTRATANTE autoriza o CONTRATADO a promover a venda do imóvel situado na <strong>${val(data.property_address)}</strong> (${val(data.property_description)}).</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>2.</strong> O imóvel será ofertado pelo valor de <strong>R$ ${val(data.sale_total_value, data.price)}</strong>. Quaisquer alterações no valor deverão ser comunicadas expressamente.</p>
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">III. DA EXCLUSIVIDADE E PRAZO</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>3.</strong> O presente contrato possui prazo de validade de <strong>${val(data.validity_days, '90')} dias</strong> a contar de sua assinatura${data.has_exclusivity ? ', sendo outorgada exclusividade na intermediação ao CONTRATADO, nos termos do Art. 726 do Código Civil' : ', sem exclusividade de venda'}.</p>
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">IV. DA REMUNERAÇÃO (COMISSÃO)</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>4.</strong> A título de remuneração pelos serviços prestados, o CONTRATANTE pagará ao CONTRATADO a comissão de <strong>${val(data.commission_percentage, '6')}% (por cento)</strong> calculada sobre o valor total da venda, devida no ato do recebimento do sinal ou assinatura da promessa de compra e venda.</p>
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">V. DAS DISPOSIÇÕES GERAIS E LGPD</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>5.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento (MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>6.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual, nos termos da LGPD (Lei nº 13.709/2018).</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>7.</strong> Fica eleito o foro da <strong>{{foro_comarca}}</strong> para dirimir quaisquer litígios decorrentes deste contrato.</p>
      
      <p style="font-size: 14px; margin-top: 30px; text-align: center;">{{local_data}}</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.owner_name)}</strong><br/>Proprietário(a)
        </div>
        ${brokerSignature('Intermediador')}
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong>
        </div>
      </div>
    `;
  } else if (type === 'intermed_rent') {
    const isAdministration = parseFloat(String(data.admin_fee_percentage || '0')) > 0;
    const title = isAdministration ? 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INTERMEDIAÇÃO E ADMINISTRAÇÃO DE IMÓVEL' : 'CONTRATO DE PRESTAÇÃO DE SERVIÇOS DE INTERMEDIAÇÃO IMOBILIÁRIA (LOCAÇÃO)';

    contractContent = `
      <h2 style="text-align: center; color: #1e293b; font-size: 18px; margin-bottom: 20px; font-weight: bold;">${title}</h2>
      
      <h3 style="color: #334155; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">I. IDENTIFICAÇÃO DAS PARTES</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>CONTRATANTE (PROPRIETÁRIO):</strong> ${val(data.owner_name)}, documento nº ${val(data.owner_document)}, residente e domiciliado(a) na ${val(data.owner_address)}.</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>CONTRATADO(A) (${isAdministration ? 'ADMINISTRADOR' : 'INTERMEDIADOR'}):</strong> ${resolvedBrokerDisplayName}, ${resolvedBrokerDisplayDoc}, ${resolvedBrokerDisplayCreci}.</p>
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">II. DO OBJETO E PRAZO</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>1.</strong> O CONTRATANTE autoriza o CONTRATADO a promover a locação do imóvel situado na <strong>${val(data.property_address)}</strong> (${val(data.property_description)}).</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>2.</strong> O imóvel será ofertado pelo valor inicial de <strong>R$ ${val(data.rent_value, data.price)}</strong>.</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>3.</strong> O prazo de validade deste contrato é de <strong>${data.validity_days === 'indeterminado' ? 'Prazo Indeterminado' : `${data.validity_days} dias`}</strong>.</p>
      ${data.has_exclusivity 
        ? `<p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>3.1. COM EXCLUSIVIDADE:</strong> Fica outorgada exclusividade na intermediação, nos termos do Art. 726 do Código Civil Brasileiro.</p>`
        : `<p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>3.1. SEM EXCLUSIVIDADE:</strong> Este contrato é pactuado sem exclusividade de intermediação.</p>`
      }

      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">III. DA REMUNERAÇÃO</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>4. (Intermediação Inicial):</strong> O CONTRATANTE pagará o equivalente a <strong>${val(data.commission_percentage, '100')}% do valor do primeiro aluguel integral</strong>, no ato da assinatura do contrato de locação.</p>
      ${isAdministration ? `
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>5. (Administração Mensal):</strong> A título de honorários de administração, o CONTRATADO reterá mensalmente <strong>${data.admin_fee_percentage}%</strong> sobre o valor dos aluguéis e encargos efetivamente recebidos.</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>5.1.</strong> O repasse líquido ao CONTRATANTE ocorrerá todo <strong>dia ${data.transfer_day || '10'}</strong> do mês subsequente ao vencido.</p>
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">IV. DOS PODERES E OBRIGAÇÕES DA ADMINISTRAÇÃO</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>6.</strong> O CONTRATANTE outorga poderes ao CONTRATADO para assinar contratos, emitir recibos, contratar vistorias, fixar reajustes, realizar cobranças extrajudiciais e representar perante o inquilino.</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>7. (Isenção de Inadimplência):</strong> A responsabilidade do CONTRATADO é de meio e não de resultado. Em hipótese alguma o CONTRATADO será responsabilizado civil ou financeiramente pela falta de pagamento dos aluguéis e encargos por parte do inquilino, não lhe cabendo o dever de adiantar receitas.</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>8. (Segurança):</strong> O CONTRATADO não se responsabiliza pela segurança, conservação ou vigilância do imóvel contra furtos ou invasões quando o mesmo estiver desocupado.</p>

      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">V. DAS OBRIGAÇÕES DO PROPRIETÁRIO</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>9. (Contato Indireto):</strong> Obriga-se o CONTRATANTE a não manter contato ou entendimento direto com o inquilino ou fiadores, devendo toda comunicação ser intermediada pelo CONTRATADO.</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>10. (Reparos e Manutenção):</strong> O CONTRATANTE compromete-se a autorizar e custear reparos estruturais de sua responsabilidade. Caso não responda a solicitações de urgência no prazo de 48 (quarenta e oito) horas, fica o CONTRATADO autorizado a providenciar o conserto para evitar degradação do bem, descontando os custos comprovados nos repasses subsequentes.</p>
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">VI. DA RESCISÃO E MULTA</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>11.</strong> Caso a administração seja rescindida pelo CONTRATANTE sem justa causa antes do término da locação ativa, este pagará, a título de multa compensatória (Art. 603 do Código Civil), o valor correspondente à metade da taxa de administração que seria devida até o término estipulado no contrato de locação do inquilino.</p>
      ` : ''}
      
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">${isAdministration ? 'VII' : 'IV'}. DAS DISPOSIÇÕES GERAIS E LGPD</h3>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>${isAdministration ? '12' : '5'}.</strong> As partes reconhecem a validade das assinaturas eletrônicas aqui apostas (MP nº 2.200-2/2001 e Lei 14.063/2020).</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>${isAdministration ? '13' : '6'}.</strong> Fica autorizado o tratamento de dados pessoais estritamente para a finalidade de execução contratual (Lei nº 13.709/2018 - LGPD).</p>
      <p style="font-size: 14px; text-align: justify; line-height: 1.6;"><strong>${isAdministration ? '14' : '7'}.</strong> Fica eleito o foro da <strong>{{foro_comarca}}</strong> para dirimir controvérsias.</p>
      
      <p style="font-size: 14px; margin-top: 30px; text-align: center;">{{local_data}}</p>
      
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.owner_name)}</strong><br/>Proprietário(a)
        </div>
        ${brokerSignature(isAdministration ? 'Administrador' : 'Intermediador')}
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong>
        </div>
      </div>
    `;
  } else if (type === 'sale_cash') {
    contractContent = `
      <h2 style="text-align: center; color: #1e293b;">CONTRATO PARTICULAR DE PROMESSA DE COMPRA E VENDA DE IMÓVEL (À VISTA)</h2>
      <h3 style="color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">IDENTIFICAÇÃO DAS PARTES</h3>
      <p><strong>PROMITENTE VENDEDOR(A):</strong> ${val(data.seller_name)}, portador(a) do documento nº ${val(data.seller_document)}, residente e domiciliado(a) na {{vendedor_endereco}}, doravante denominado simplesmente VENDEDOR.</p>
      <p><strong>PROMITENTE COMPRADOR(A):</strong> ${val(data.buyer_name)}, portador(a) do documento nº ${val(data.buyer_document)}, residente e domiciliado(a) na {{comprador_endereco}}, doravante denominado simplesmente COMPRADOR.</p>
      <p>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato Particular de Promessa de Compra e Venda de Imóvel, que se regerá pelas cláusulas seguintes:</p>
      <h3 style="color: #334155;">CLÁUSULA PRIMEIRA - DO OBJETO</h3>
      <p><strong>1.1.</strong> O VENDEDOR promete vender ao COMPRADOR o imóvel situado na <strong>${val(data.property_address)}</strong> (${val(data.property_description, data.property?.title)}).</p>
      <h3 style="color: #334155;">CLÁUSULA SEGUNDA - DO PREÇO E DA FORMA DE PAGAMENTO</h3>
      <p><strong>2.1.</strong> O preço total e certo para a venda do imóvel é de <strong>R$ ${val(data.sale_total_value, data.total_value)}</strong>.</p>
      <p><strong>2.2. SINAL (ARRAS):</strong> A título de sinal, o COMPRADOR paga neste ato o valor de <strong>R$ ${val(data.sale_down_payment, data.down_payment)}</strong>.</p>
      <p><strong>2.3. SALDO REMANESCENTE:</strong> O saldo remanescente será pago à vista no ato da assinatura da Escritura Pública de Compra e Venda.</p>
      <h3 style="color: #334155;">CLÁUSULA TERCEIRA - DA IRRETRATABILIDADE E DO FORO</h3>
      <p><strong>3.1.</strong> O presente contrato é celebrado em caráter irrevogável e irretratável. O descumprimento de qualquer cláusula sujeita a parte infratora à multa de 20% sobre o valor da transação.</p>
      <p><strong>3.2.</strong> Para dirimir quaisquer controvérsias, as partes elegem o foro da <strong>{{foro_comarca}}</strong>.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">DAS DISPOSIÇÕES GERAIS, LGPD E ASSINATURA ELETRÔNICA</h3>
      <p style="text-align: justify;"><strong>1.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento, equiparando-as a assinaturas de próprio punho (Art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="text-align: justify;"><strong>2.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual e proteção do crédito, nos termos da LGPD (Lei nº 13.709/2018).</p>
      ${type.startsWith('rent') ? '<p style="text-align: justify;"><strong>3.</strong> A multa rescisória será sempre cobrada de forma estritamente proporcional ao tempo restante de contrato, conforme determina o Art. 4º da Lei nº 8.245/91.</p>' : ''}
      <p style="margin-top: 30px; text-align: center;">{{local_data}}</p>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.seller_name)}</strong><br/><span style="font-size: 14px; color: #000;">Vendedor(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_COMPRADOR}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.buyer_name)}</strong><br/><span style="font-size: 14px; color: #000;">Comprador(a)</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
      </div>
    `;
  } else if (type === 'permuta') {
    contractContent = `
      <h2 style="text-align: center; color: #1e293b;">CONTRATO PARTICULAR DE PERMUTA DE IMÓVEIS (COM TORNA)</h2>
      <h3 style="color: #334155; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">IDENTIFICAÇÃO DAS PARTES</h3>
      <p><strong>PRIMEIRO(A) PERMUTANTE:</strong> ${val(data.seller_name)}, documento nº ${val(data.seller_document)}, residente na {{vendedor_endereco}}.</p>
      <p><strong>SEGUNDO(A) PERMUTANTE:</strong> ${val(data.buyer_name)}, documento nº ${val(data.buyer_document)}, residente na {{comprador_endereco}}.</p>
      <h3 style="color: #334155;">CLÁUSULA PRIMEIRA E SEGUNDA - DOS IMÓVEIS E DA TORNA</h3>
      <p><strong>1.1. IMÓVEL A (Do Primeiro Permutante):</strong> ${val(data.property_description, data.property?.title)}, situado na ${val(data.property_address)}.</p>
      <p><strong>1.2. IMÓVEL B (Do Segundo Permutante):</strong> Conforme acordado e vistoriado.</p>
      <p><strong>2.1.</strong> O IMÓVEL A é avaliado no valor de <strong>R$ ${val(data.sale_total_value, data.total_value)}</strong>. O IMÓVEL B entra como parte do pagamento no valor de <strong>R$ ${val(data.permutation_value)}</strong>.</p>
      <h3 style="color: #334155;">CLÁUSULA TERCEIRA - DO FORO</h3>
      <p><strong>3.1.</strong> As partes elegem o foro da <strong>{{foro_comarca}}</strong> para dirimir quaisquer dúvidas oriundas deste contrato.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">DAS DISPOSIÇÕES GERAIS, LGPD E ASSINATURA ELETRÔNICA</h3>
      <p style="text-align: justify;"><strong>1.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento, equiparando-as a assinaturas de próprio punho (Art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="text-align: justify;"><strong>2.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual e proteção do crédito, nos termos da LGPD (Lei nº 13.709/2018).</p>
      ${type.startsWith('rent') ? '<p style="text-align: justify;"><strong>3.</strong> A multa rescisória será sempre cobrada de forma estritamente proporcional ao tempo restante de contrato, conforme determina o Art. 4º da Lei nº 8.245/91.</p>' : ''}
      <p style="margin-top: 30px; text-align: center;">{{local_data}}</p>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.seller_name)}</strong><br/><span style="font-size: 14px; color: #000;">Primeiro Permutante</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_COMPRADOR}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.buyer_name)}</strong><br/><span style="font-size: 14px; color: #000;">Segundo Permutante</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
      </div>
    `;
  } else if (type === 'rent_noguarantee') {
    contractContent = `
      <h1>CONTRATO DE LOCAÇÃO RESIDENCIAL SEM GARANTIA</h1>

      <h2>IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>

      <p><strong>LOCADOR:</strong> <strong>${val(data.owner_name, data.landlord_name)}</strong>, ${val(data.landlord_nationality, 'brasileiro(a)')}, ${val(data.landlord_marital_status)}, ${val(data.landlord_profession)}, portador(a) da cédula de identidade RG nº ${val(data.landlord_rg)} e CPF nº ${val(data.owner_document, data.landlord_document)}${spouseText(data.landlord_spouse_name, data.landlord_spouse_document, data.landlord_spouse_rg || '', data.landlord_spouse_profession)}, residente e domiciliado(a) à {{locador_endereco}}.</p>

      <p><strong>LOCATÁRIO:</strong> <strong>${val(data.tenant_name)}</strong>, ${val(data.tenant_nationality, 'brasileiro(a)')}, ${val(data.tenant_marital_status)}, ${val(data.tenant_profession)}, portador(a) da cédula de identidade RG nº ${val(data.tenant_rg)} e CPF nº ${val(data.tenant_document)}${spouseText(data.tenant_spouse_name, data.tenant_spouse_document, data.tenant_spouse_rg || '', data.tenant_spouse_profession)}, residente e domiciliado(a) à {{locatario_endereco}}.</p>

      <p><em>As partes acima identificadas têm, entre si, justo e acertado o presente Contrato de Locação Residencial Sem Garantia, que se regerá pelas cláusulas seguintes e pelas condições descritas no presente.</em></p>

      <h2>Cláusula 1ª – DO OBJETO DA LOCAÇÃO</h2>
      <p>O presente contrato tem como OBJETO o imóvel de propriedade do LOCADOR, situado na <strong>${val(data.property_address)}</strong>, livre de ônus ou quaisquer dívidas.<br/>
      Parágrafo único: O imóvel é entregue na data da assinatura deste contrato nas condições descritas no auto de vistoria anexo.</p>

      <h2>Cláusula 2ª – DO PRAZO E ALUGUEL</h2>
      <p>A presente locação terá o lapso temporal de validade de <strong>${val(data.lease_duration)} meses</strong>, a iniciar-se na data de assinatura deste contrato.<br/>
      Como aluguel mensal, o LOCATÁRIO se obrigará a pagar o valor de <strong>R$ ${val(data.rent_value)}</strong>, até o dia <strong>{{dia_vencimento}}</strong> de cada mês. Fica estipulado um desconto de pontualidade no valor de <strong>{{desconto_pontualidade}}</strong> se o pagamento for efetuado no prazo.</p>

      <h2>Cláusula 3ª – DA AUSÊNCIA DE GARANTIA E DO DESPEJO SUMÁRIO</h2>
      <p>O presente contrato é firmado <strong>SEM NENHUMA GARANTIA LOCATÍCIA</strong>, dispensando-se o LOCATÁRIO da apresentação de fiador, seguro-fiança, caução ou qualquer outra modalidade prevista no art. 37 da Lei nº 8.245/91.<br/>
      Parágrafo único: Face à total ausência de garantia, o LOCATÁRIO declara-se ciente de que, em caso de inadimplência no pagamento do aluguel ou encargos, o LOCADOR poderá ajuizar ação de despejo com pedido de liminar para desocupação em 15 (quinze) dias, independentemente da audiência da parte contrária, mediante o depósito caução previsto no inciso IX do § 1º do art. 59 da Lei nº 8.245/91.</p>

      <h2>Cláusula 4ª – DA RESCISÃO E DO FORO</h2>
      <p>A infração de qualquer das cláusulas sujeitará o infrator à multa de 03 (três) vezes o valor do aluguel.<br/>
      As partes elegem o foro da <strong>{{foro_comarca}}</strong> para dirimir litígios decorrentes deste contrato.</p>

      <p style="margin-top: 40px; text-align: right;">{{local_data}}</p>

      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.owner_name, data.landlord_name)}</strong><br/><span style="font-size: 14px; color: #000;">Locador(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_INQUILINO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.tenant_name)}</strong><br/><span style="font-size: 14px; color: #000;">Locatário(a)</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
      </div>
    `;
    contractContent = `
      <h2 style="text-align: center; color: #1e293b; font-size: 18px; margin-bottom: 20px;">CONTRATO DE LOCAÇÃO RESIDENCIAL SEM GARANTIA</h2>
      <h3 style="color: #334155; font-size: 14px; border-bottom: 1px solid #cbd5e1; padding-bottom: 5px;">IDENTIFICAÇÃO DAS PARTES</h3>
      <p style="text-align: justify;"><strong>LOCADOR(A):</strong> ${val(data.owner_name, data.landlord_name)}, portador(a) da Cédula de Identidade e inscrito(a) no CPF/MF sob o nº ${val(data.owner_document, data.landlord_document)}, residente e domiciliado(a) na {{locador_endereco}}.</p>
      <p style="text-align: justify;"><strong>LOCATÁRIO(A):</strong> ${val(data.tenant_name)}, portador(a) da Cédula de Identidade e inscrito(a) no CPF/MF sob o nº ${val(data.tenant_document)}, residente e domiciliado(a) na {{locatario_endereco}}.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA PRIMEIRA - DO OBJETO</h3>
      <p style="text-align: justify;"><strong>1.1.</strong> O objeto deste contrato é a locação do imóvel residencial de propriedade do(a) LOCADOR(A), situado na <strong>${val(data.property_address)}</strong>.</p>
      <p style="text-align: justify;"><strong>1.2.</strong> O(A) LOCATÁRIO(A) declara ter vistoriado o imóvel e recebê-lo no estado em que se encontra, conforme Termo de Vistoria em anexo.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA SEGUNDA - DO PRAZO</h3>
      <p style="text-align: justify;"><strong>2.1.</strong> O prazo da locação é de <strong>${val(data.lease_duration)} meses</strong>, iniciando-se na data da assinatura deste.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA TERCEIRA - DO ALUGUEL E ENCARGOS</h3>
      <p style="text-align: justify;"><strong>3.1.</strong> O valor do aluguel mensal é de <strong>R$ ${val(data.rent_value)}</strong>, a ser pago até o dia <strong>{{dia_vencimento}}</strong> do mês subsequente ao vencido.</p>
      <p style="text-align: justify;"><strong>3.2.</strong> Fica estipulado um <strong>desconto de pontualidade no valor de {{desconto_pontualidade}}</strong> para pagamentos efetuados rigorosamente até a data de vencimento. O atraso implicará na perda do desconto, multa de 10% (dez por cento) sobre o débito e juros de 1% (um por cento) ao mês.</p>
      <p style="text-align: justify;"><strong>3.3.</strong> Além do aluguel, é de responsabilidade do(a) LOCATÁRIO(A) o pagamento pontual do IPTU, da taxa de condomínio e contas de consumo.</p>
      <p style="text-align: justify;"><strong>3.4. TRANSFERÊNCIA DE TITULARIDADE:</strong> O(A) LOCATÁRIO(A) obriga-se a transferir para o seu CPF/CNPJ, no prazo improrrogável de 05 (cinco) dias úteis contados da assinatura deste, a titularidade das contas de consumo (energia elétrica, água/esgoto e gás) junto às concessionárias locais. O descumprimento sujeita o infrator à multa contratual, respondendo integralmente por perdas e danos caso o LOCADOR sofra qualquer restrição de crédito (SPC/Serasa) decorrente de faturas não pagas.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA QUARTA - DA AUSÊNCIA DE GARANTIA E DESPEJO</h3>
      <p style="text-align: justify;"><strong>4.1.</strong> As partes acordam que o presente contrato é firmado SEM a exigência de qualquer das modalidades de garantia previstas no art. 37 da Lei nº 8.245/91.</p>
      <p style="text-align: justify;"><strong>4.2.</strong> Em face da ausência de garantia, fica ressalvado ao(à) LOCADOR(A) o direito de exigir o pagamento do aluguel e encargos de forma antecipada, até o sexto dia útil do mês vincendo (art. 42 da Lei do Inquilinato).</p>
      <p style="text-align: justify;"><strong>4.3.</strong> Em caso de falta de pagamento, o(a) LOCADOR(A) poderá ajuizar ação de despejo com pedido de concessão de medida liminar para desocupação em 15 (quinze) dias, independentemente de audiência da parte contrária, conforme previsto no art. 59, § 1º, inciso IX, da Lei nº 8.245/91.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">CLÁUSULA QUINTA - DA RESCISÃO E DO FORO</h3>
      <p style="text-align: justify;"><strong>5.1.</strong> A infração de qualquer cláusula sujeita a parte infratora ao pagamento de multa correspondente a 3 (três) aluguéis vigentes.</p>
      <p style="text-align: justify;"><strong>5.2.</strong> Fica eleito o foro da <strong>{{foro_comarca}}</strong> para dirimir quaisquer litígios decorrentes deste contrato.</p>
      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">DAS DISPOSIÇÕES GERAIS, LGPD E ASSINATURA ELETRÔNICA</h3>
      <p style="text-align: justify;"><strong>1.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento, equiparando-as a assinaturas de próprio punho (Art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="text-align: justify;"><strong>2.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual e proteção do crédito, nos termos da LGPD (Lei nº 13.709/2018).</p>
      ${type.startsWith('rent') ? '<p style="text-align: justify;"><strong>3.</strong> A multa rescisória será sempre cobrada de forma estritamente proporcional ao tempo restante de contrato, conforme determina o Art. 4º da Lei nº 8.245/91.</p>' : ''}
      <p style="margin-top: 30px; text-align: center;">{{local_data}}</p>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong>${val(data.owner_name, data.landlord_name)}</strong><br/>Locador(a)
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_INQUILINO}}</div>
          _________________________________________________<br/><strong>${val(data.tenant_name)}</strong><br/>Locatário(a)
        </div>
      </div>
    `;
  } else if (type === 'rent_commercial') {
    contractContent = `
      <h1>CONTRATO DE LOCAÇÃO NÃO RESIDENCIAL (COMERCIAL)</h1>

      <h2>IDENTIFICAÇÃO DAS PARTES CONTRATANTES</h2>

      <p><strong>LOCADOR:</strong> <strong>${val(data.owner_name, data.landlord_name)}</strong>, ${val(data.landlord_nationality, 'brasileiro(a)')}, ${val(data.landlord_marital_status)}, ${val(data.landlord_profession)}, portador(a) da cédula de identidade RG nº ${val(data.landlord_rg)} e CPF nº ${val(data.owner_document, data.landlord_document)}${spouseText(data.landlord_spouse_name, data.landlord_spouse_document, data.landlord_spouse_rg || '', data.landlord_spouse_profession)}, residente e domiciliado(a) à {{locador_endereco}}.</p>

      <p><strong>LOCATÁRIO:</strong> <strong>${val(data.tenant_name)}</strong>, ${val(data.tenant_nationality, 'brasileiro(a)')}, ${val(data.tenant_marital_status)}, ${val(data.tenant_profession)}, portador(a) da cédula de identidade RG nº ${val(data.tenant_rg)} e CNPJ/CPF nº ${val(data.tenant_document)}${spouseText(data.tenant_spouse_name, data.tenant_spouse_document, data.tenant_spouse_rg || '', data.tenant_spouse_profession)}, estabelecido à {{locatario_endereco}}.</p>

      <h2>Cláusula 1ª – DO OBJETO E DA DESTINAÇÃO</h2>
      <p>O presente contrato tem como OBJETO o imóvel comercial situado na <strong>${val(data.property_address)}</strong>.<br/>
      O imóvel destina-se única e exclusivamente à exploração de <strong>atividade comercial</strong>, sendo terminantemente proibida a sua destinação para fins residenciais ou alteração de ramo sem consentimento prévio, sob pena de rescisão contratual.</p>

      <h2>Cláusula 2ª – DO PRAZO E DA AÇÃO RENOVATÓRIA</h2>
      <p>O prazo da locação é de <strong>${val(data.lease_duration)} meses</strong>.<br/>
      Parágrafo único: Caso a soma dos prazos ininterruptos dos contratos atinja 5 (cinco) anos, e o LOCATÁRIO exerça o mesmo ramo há pelo menos 3 (três) anos, ficará resguardado o direito à ação renovatória, respeitados os prazos decadenciais previstos no art. 51, § 5º, da Lei 8.245/91.</p>

      <h2>Cláusula 3ª – DO ALUGUEL E DESCONTO</h2>
      <p>O aluguel mensal é de <strong>R$ ${val(data.rent_value)}</strong>, pago até o dia <strong>{{dia_vencimento}}</strong>, com desconto de <strong>{{desconto_pontualidade}}</strong> se pago pontualmente.<br/>
      <strong>Parágrafo Único – TRANSFERÊNCIA DE TITULARIDADE:</strong> O(A) LOCATÁRIO(A) obriga-se a transferir para o seu CPF/CNPJ, no prazo improrrogável de 05 (cinco) dias úteis contados da assinatura deste, a titularidade das contas de consumo (energia elétrica, água/esgoto e gás) junto às concessionárias locais. O descumprimento sujeita o infrator à multa contratual, respondendo integralmente por perdas e danos caso o LOCADOR sofra qualquer restrição de crédito (SPC/Serasa) decorrente de faturas não pagas.</p>

      <h2>Cláusula 4ª – DAS BENFEITORIAS E DA RENÚNCIA DE RETENÇÃO</h2>
      <p>O LOCATÁRIO não poderá realizar obras ou benfeitorias sem autorização expressa do LOCADOR.<br/>
      Parágrafo único: O LOCATÁRIO renuncia expressamente ao direito de retenção ou indenização por quaisquer benfeitorias realizadas (úteis, necessárias ou voluptuárias), as quais ficarão incorporadas ao imóvel, em estrita obediência à <strong>Súmula 335 do Superior Tribunal de Justiça (STJ)</strong>.</p>

      <h2>Cláusula 5ª – DO FORO</h2>
      <p>As partes elegem o foro da <strong>{{foro_comarca}}</strong> para dirimir quaisquer dúvidas decorrentes deste contrato.</p>

      <h3 style="color: #334155; font-size: 14px; margin-top: 20px;">DAS DISPOSIÇÕES GERAIS, LGPD E ASSINATURA ELETRÔNICA</h3>
      <p style="text-align: justify;"><strong>1.</strong> As partes reconhecem como válidas e eficazes as assinaturas eletrônicas lançadas neste instrumento, equiparando-as a assinaturas de próprio punho (Art. 10, § 2º, da MP nº 2.200-2/2001 e Lei nº 14.063/2020).</p>
      <p style="text-align: justify;"><strong>2.</strong> As partes autorizam o tratamento de seus dados pessoais constantes neste instrumento estritamente para a finalidade de execução contratual e proteção do crédito, nos termos da LGPD (Lei nº 13.709/2018).</p>
      ${type.startsWith('rent') ? '<p style="text-align: justify;"><strong>3.</strong> A multa rescisória será sempre cobrada de forma estritamente proporcional ao tempo restante de contrato, conforme determina o Art. 4º da Lei nº 8.245/91.</p>' : ''}
      <p style="margin-top: 40px; text-align: right;">{{local_data}}</p>

      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_PROPRIETARIO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.owner_name, data.landlord_name)}</strong><br/><span style="font-size: 14px; color: #000;">Locador(a)</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_INQUILINO}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">${val(data.tenant_name)}</strong><br/><span style="font-size: 14px; color: #000;">Locatário(a) / Empresa</span>
        </div>
      </div>
      <div class="signatures" style="display: table; width: 100%; margin-top: 50px; page-break-inside: avoid; table-layout: fixed;">
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_1}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 1</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
        </div>
        <div class="signature-line" style="display: table-cell; width: 50%; text-align: center; vertical-align: top; padding: 0 10px; border-top: none; padding-top: 0; margin-top: 0;">
          <div style="min-height: 55px; display: flex; align-items: flex-end; justify-content: center; margin-bottom: 5px;">{{ASSINATURA_TESTEMUNHA_2}}</div>
          _________________________________________________<br/><strong style="font-size: 14px; color: #000;">Testemunha 2</strong><br/><span style="font-size: 14px; color: #000;">CPF: ___________________</span>
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
  let html = `<!DOCTYPE html>
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
            ${buildContractHeader(data.header_variant || 'full_header', tenant, logoSrc)}
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

  // --- MOTOR DE SUBSTITUIÇÃO GLOBAL (ENDEREÇOS, DATAS E FINANCEIRO) ---
  html = html.replace(/\{\{vendedor_endereco\}\}/g, data.owner_address || data.seller_address || '_______________________');
  html = html.replace(/\{\{locador_endereco\}\}/g, data.owner_address || data.landlord_address || '_______________________');
  html = html.replace(/\{\{comprador_endereco\}\}/g, data.buyer_address || data.tenant_address || '_______________________');
  html = html.replace(/\{\{inquilino_endereco\}\}/g, data.tenant_address || '_______________________');
  html = html.replace(/\{\{locatario_endereco\}\}/g, data.tenant_address || '_______________________');
  html = html.replace(/\{\{fiador_endereco\}\}/g, data.guarantor_address || '_______________________');

  const dayDue = data.due_day || '05';
  html = html.replace(/\{\{dia_vencimento\}\}/g, dayDue);
  html = html.replace(/\{\{data_vencimento\}\}/g, dayDue);
  html = html.replace(/\{\{vencimento\}\}/g, dayDue);

  const discountValue = data.punctuality_discount ? Number(data.punctuality_discount) : 0;
  const formattedDiscount = discountValue > 0 ? discountValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : '_______________';
  html = html.replace(/\{\{desconto_pontualidade\}\}/g, formattedDiscount);
  html = html.replace(/\{\{desconto\}\}/g, formattedDiscount);
  html = html.replace(/\{\{valor_desconto\}\}/g, formattedDiscount);

  const today = new Date();
  const day = String(today.getDate()).padStart(2, '0');
  const monthStr = today.toLocaleString('pt-BR', { month: 'long' });
  const year = String(today.getFullYear());
  const formattedFullDate = `${day} de ${monthStr} de ${year}`;

  html = html.replace(/\{\{cidade\}\}/g, cityLocation);
  html = html.replace(/\{\{estado\}\}/g, stateLocation);
  html = html.replace(/\{\{uf\}\}/g, stateLocation);
  html = html.replace(/\{\{data_atual\}\}/g, formattedFullDate);
  html = html.replace(/\{\{dia_atual\}\}/g, day);
  html = html.replace(/\{\{mes_atual\}\}/g, monthStr);
  html = html.replace(/\{\{ano_atual\}\}/g, year);
  html = html.replace(/\{\{local_data\}\}/g, `${cityLocation} - ${stateLocation}, ${formattedFullDate}`);

  const foroText = `Comarca de ${cityLocation} - ${stateLocation}`;
  html = html.replace(/\{\{foro_comarca\}\}/g, foroText);

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

export const generateContract = async (type: string, data: any, tenant: any, companyLogo?: string, broker_name?: string, broker_document?: string, broker_creci?: string, company_name?: string, customTemplateContent?: string) => {
  let html = await buildContractHtml(
    type,
    data,
    tenant,
    companyLogo,
    broker_name,
    broker_document,
    broker_creci,
    company_name,
    customTemplateContent
  );

  // Limpeza das tags APENAS para a tela de pré-visualização (não afeta o salvamento no banco)
  const signatureTags = [
    '{{ASSINATURA_PROPRIETARIO}}',
    '{{ASSINATURA_INQUILINO}}',
    '{{ASSINATURA_COMPRADOR}}',
    '{{ASSINATURA_IMOBILIARIA}}',
    '{{ASSINATURA_FIADOR}}',
    '{{ASSINATURA_CONJUGE_FIADOR}}',
    '{{ASSINATURA_TESTEMUNHA_1}}',
    '{{ASSINATURA_TESTEMUNHA_2}}'
  ];
  signatureTags.forEach(tag => {
    html = html.split(tag).join('');
  });

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Por favor, permita os pop-ups para gerar o contrato.');
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();
};

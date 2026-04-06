import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactCrop, { type Crop } from 'react-image-crop';
import 'react-image-crop/dist/ReactCrop.css';
import SignaturePad from 'react-signature-canvas';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';

interface SignatureCompany {
  name: string | null;
}

interface ContractRecord {
  id: string;
  content: string | null;
  html_content: string | null;
  contract_data: Record<string, unknown> | null;
}

interface SignatureDocumentData {
  id: string;
  contract_id: string | null;
  status: 'pending' | 'signed' | 'rejected';
  signer_name: string;
  signer_role: string | null;
  signed_at: string | null;
  signature_image: string | null;
  companies: SignatureCompany | null;
  contract: ContractRecord | null;
}

type Step = 'preview' | 'signing' | 'completed';
type SignTab = 'draw' | 'type' | 'upload';

const TYPED_CANVAS_WIDTH = 1200;
const TYPED_CANVAS_HEIGHT = 360;

const CONTRACT_FALLBACK_HTML = `
  <div style="display:flex;min-height:760px;align-items:center;justify-content:center;color:#64748b;text-align:center;font-family:DM Sans, sans-serif;">
    <div>
      <p style="margin:0;font-size:18px;font-weight:700;color:#0f172a;">PrÃ©-visualizaÃ§Ã£o indisponÃ­vel</p>
      <p style="margin:12px 0 0;max-width:360px;line-height:1.7;">NÃ£o foi possÃ­vel carregar o conteÃºdo do contrato para esta assinatura.</p>
    </div>
  </div>
`;

const FONT_OPTIONS = [
  {
    id: 'font-dancing',
    label: 'Dancing',
    className: 'font-dancing',
    canvasFamily: '"Dancing Script", cursive',
  },
  {
    id: 'font-chilanka',
    label: 'Chilanka',
    className: 'font-chilanka',
    canvasFamily: '"Chilanka", cursive',
  },
  {
    id: 'font-grand',
    label: 'Grand',
    className: 'font-grand',
    canvasFamily: '"Grand Hotel", cursive',
  },
  {
    id: 'font-inter',
    label: 'Inter',
    className: 'font-inter',
    canvasFamily: '"Inter", sans-serif',
  },
  {
    id: 'font-satisfy',
    label: 'Satisfy',
    className: 'font-satisfy',
    canvasFamily: '"Satisfy", cursive',
  },
] as const;

const SIGN_TABS: Array<{ id: SignTab; label: string; icon: React.ComponentType<{ className?: string; size?: number }> }> = [
  { id: 'draw', label: 'Desenhar', icon: Icons.PenTool },
  { id: 'type', label: 'Digitar', icon: Icons.Edit2 },
  { id: 'upload', label: 'Upload / CÃ¢mera', icon: Icons.Upload },
];

const escapeHtml = (value: string) =>
  value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');


const readContractDataString = (contract: ContractRecord | null, key: string) => {
  const value = contract?.contract_data?.[key];
  return typeof value === 'string' ? value : '';
};

const normalizeContractMarkup = (markup: string) => {
  const trimmed = markup.trim();

  if (!trimmed) {
    return CONTRACT_FALLBACK_HTML;
  }

  const styleBlocks = Array.from(trimmed.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/gi))
    .map((match) => match[1])
    .filter(Boolean)
    .join('\n');

  const bodyMatch = trimmed.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const innerMarkup = bodyMatch?.[1]?.trim() || trimmed;
  const hasHtmlTags = /<\/?[a-z][\s\S]*>/i.test(innerMarkup);

  if (hasHtmlTags) {
    return styleBlocks ? `<style>${styleBlocks}</style>${innerMarkup}` : innerMarkup;
  }

  return `
    <div style="white-space:pre-wrap;color:#0f172a;line-height:1.8;font-family:DM Sans, sans-serif;">
      ${escapeHtml(innerMarkup)}
    </div>
  `;
};

const buildContractPreviewHtml = (contract: ContractRecord | null) => {
  const candidates = [
    contract?.html_content ?? '',
    contract?.content ?? '',
    readContractDataString(contract, 'template_content'),
  ];

  const content = candidates.find((candidate) => candidate.trim().length > 0);
  return content ? normalizeContractMarkup(content) : CONTRACT_FALLBACK_HTML;
};

const readFileAsDataUrl = (file: File) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }

      reject(new Error('NÃ£o foi possÃ­vel ler a imagem selecionada.'));
    };

    reader.onerror = () => reject(new Error('NÃ£o foi possÃ­vel ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });


export default function SignDocument() {
  const { token } = useParams<{ token: string }>();

  const [data, setData] = useState<SignatureDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [submissionError, setSubmissionError] = useState('');
  const [isSigning, setIsSigning] = useState(false);
  const [ipAddress, setIpAddress] = useState('IP Desconhecido');
  const [step, setStep] = useState<Step>('preview');
  const [signTab, setSignTab] = useState<SignTab>('draw');
  const [showQrCode, setShowQrCode] = useState(false);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [typedName, setTypedName] = useState('');
  const [selectedFont, setSelectedFont] = useState<(typeof FONT_OPTIONS)[number]['id']>('font-dancing');
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadFileName, setUploadFileName] = useState('');
  const [crop, setCrop] = useState<Crop>();
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const signaturePadRef = useRef<SignaturePad | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const imageRef = useRef<HTMLImageElement | null>(null);

  const activeFont = useMemo(
    () => FONT_OPTIONS.find((option) => option.id === selectedFont) ?? FONT_OPTIONS[0],
    [selectedFont]
  );

  const contractHtml = useMemo(() => buildContractPreviewHtml(data?.contract ?? null), [data?.contract]);

  const signedAtLabel = useMemo(() => {
    if (!data?.signed_at) {
      return '';
    }

    try {
      return new Date(data.signed_at).toLocaleString('pt-BR');
    } catch {
      return data.signed_at;
    }
  }, [data?.signed_at]);

  const qrCodeUrl =
    typeof window !== 'undefined'
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.href)}`
      : '';

  const fetchIp = async () => {
    try {
      const response = await fetch('https://api.ipify.org?format=json');
      const json = (await response.json()) as { ip?: string };
      setIpAddress(json.ip ?? 'IP Desconhecido');
    } catch {
      setIpAddress('IP Desconhecido');
    }
  };

  const fetchData = async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      // 1. Busca primeiro os dados da assinatura usando o token
      const { data: signatureData, error: sigError } = await supabase
        .from('contract_signatures')
        .select('*')
        .eq('token', token)
        .single();

      if (sigError || !signatureData) throw sigError;

      // 2. Com o ID do contrato em mÃ£os, busca o contrato e os dados da empresa
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .select('*, companies(*)')
        .eq('id', signatureData.contract_id)
        .single();

      if (contractError) throw contractError;

      // 3. Junta tudo no estado
      setData({
        ...signatureData,
        contract: contractData,
        companies: contractData?.companies || null
      });
    } catch (error) {
      console.error('Erro ao carregar assinatura:', error);
      setData(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void fetchData();
    void fetchIp();
  }, [token]);

  useEffect(() => {
    if (isCameraOpen) {
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: 'environment' } })
        .then((stream) => {
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        })
        .catch(() => {
          alert('CÃ¢mera indisponÃ­vel. Requer HTTPS (ngrok) no celular.');
        });
    } else {
      const stream = videoRef.current?.srcObject as MediaStream | null;
      stream?.getTracks().forEach((track) => track.stop());
      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }
    }
  }, [isCameraOpen]);

  const capturePhoto = () => {
    if (!videoRef.current) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    setUploadPreview(null);
    setCrop(undefined);
    setImageToCrop(canvas.toDataURL('image/png'));
    setUploadFileName('captura-camera.png');
    setSubmissionError('');
    setSignTab('upload');
    setIsCameraOpen(false);
  };

  const clearDrawSignature = () => {
    signaturePadRef.current?.clear();
    setHasDrawn(false);
  };

  const clearUploadPreview = () => {
    setUploadPreview(null);
    setImageToCrop(null);
    setCrop(undefined);
    setUploadFileName('');

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };


  const handleUploadSelection = async (file?: File) => {
    if (!file) return;

    setSubmissionError('');
    setSignTab('upload');
    setUploadPreview(null);
    setCrop(undefined);

    try {
      const source = await readFileAsDataUrl(file);
      setImageToCrop(source);
      setUploadFileName(file.name);
    } catch (error) {
      console.error('Erro ao ler assinatura enviada:', error);
      clearUploadPreview();
      setSubmissionError('Falha ao ler a imagem.');
    }
  };

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    await handleUploadSelection(event.target.files?.[0]);
  };

  const getCroppedImage = () => {
    if (!imageRef.current || !crop?.width || !crop?.height) {
      setSubmissionError('Selecione a área da assinatura antes de confirmar.');
      return;
    }

    const canvas = document.createElement('canvas');
    const scaleX = imageRef.current.naturalWidth / imageRef.current.width;
    const scaleY = imageRef.current.naturalHeight / imageRef.current.height;
    const outputWidth = Math.max(1, Math.round(crop.width * scaleX));
    const outputHeight = Math.max(1, Math.round(crop.height * scaleY));

    canvas.width = outputWidth;
    canvas.height = outputHeight;

    const ctx = canvas.getContext('2d');

    if (!ctx) {
      setSubmissionError('Falha ao preparar o recorte da assinatura.');
      return;
    }

    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(
      imageRef.current,
      crop.x * scaleX,
      crop.y * scaleY,
      crop.width * scaleX,
      crop.height * scaleY,
      0,
      0,
      outputWidth,
      outputHeight
    );

    const base64Image = canvas.toDataURL('image/png');
    setUploadPreview(base64Image);
    setImageToCrop(null);
    setCrop(undefined);
    setSubmissionError('');
  };

  const generateTypedSignatureImage = async () => {
    const value = typedName.trim();

    if (!value) {
      return '';
    }

    if (document.fonts?.load) {
      try {
        await document.fonts.load(`700 72px ${activeFont.canvasFamily}`);
      } catch {
        // Segue com o fallback do navegador caso a fonte ainda nÃ£o tenha carregado.
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = TYPED_CANVAS_WIDTH;
    canvas.height = TYPED_CANVAS_HEIGHT;

    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('NÃ£o foi possÃ­vel renderizar a assinatura digitada.');
    }

    let fontSize = 142;
    const maxWidth = canvas.width - 140;

    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillStyle = '#0f172a';

    while (fontSize > 72) {
      context.font = `700 ${fontSize}px ${activeFont.canvasFamily}`;

      if (context.measureText(value).width <= maxWidth) {
        break;
      }

      fontSize -= 6;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.font = `700 ${fontSize}px ${activeFont.canvasFamily}`;
    context.fillText(value, canvas.width / 2, canvas.height / 2 + fontSize * 0.06);

    return canvas.toDataURL('image/png');
  };

  const getSignatureBase64 = async () => {
    if (signTab === 'draw') {
      if (!signaturePadRef.current || signaturePadRef.current.isEmpty()) {
        return '';
      }

      return signaturePadRef.current.getCanvas().toDataURL('image/png');
    }

    if (signTab === 'type') {
      return generateTypedSignatureImage();
    }

    return uploadPreview ?? '';
  };

  const handleConfirmSignature = async () => {
    if (!token || !data) {
      return;
    }

    setSubmissionError('');

    const signatureImage = await getSignatureBase64();

    if (!signatureImage) {
      setSubmissionError('Escolha ou gere uma assinatura antes de concluir.');
      return;
    }

    setIsSigning(true);

    try {
      const signedAt = new Date().toISOString();
      const { error } = await supabase
        .from('contract_signatures')
        .update({
          status: 'signed',
          signed_at: signedAt,
          ip_address: ipAddress || 'IP Desconhecido',
          user_agent: navigator.userAgent,
          signature_image: signatureImage,
        })
        .eq('token', token)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      setData((current) =>
        current
          ? {
              ...current,
              status: 'signed',
              signed_at: signedAt,
              signature_image: signatureImage,
            }
          : current
      );
      setStep('completed');
    } catch (error) {
      console.error('Erro ao concluir assinatura:', error);
      setSubmissionError('NÃ£o foi possÃ­vel concluir a assinatura. Tente novamente.');
    } finally {
      setIsSigning(false);
    }
  };

  const canConfirm =
    !isSigning &&
    ((signTab === 'draw' && hasDrawn) ||
      (signTab === 'type' && typedName.trim().length >= 3) ||
      (signTab === 'upload' && Boolean(uploadPreview)));

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100">
        <Icons.Loader2 className="animate-spin text-slate-500" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4">
        <div className="w-full max-w-md rounded-[28px] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/70">
          <h1 className="text-2xl font-semibold text-slate-900">Link indisponÃ­vel</h1>
          <p className="mt-3 text-sm leading-7 text-slate-500">Documento nÃ£o encontrado.</p>
        </div>
      </div>
    );
  }

  if (step === 'completed') {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#f1f5f9_100%)] px-4 py-10">
        <div className="mx-auto max-w-3xl">
          <div className="rounded-[32px] border border-white/70 bg-white/90 p-8 shadow-[0_30px_80px_-36px_rgba(15,23,42,0.35)] backdrop-blur">
            <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
              <Icons.CheckCircle2 size={38} />
            </div>
            <div className="mt-6 text-center">
              <h1 className="text-3xl font-semibold tracking-tight text-slate-950">Sua assinatura foi registrada</h1>
              <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-slate-500">
                O aceite foi anexado ao documento. {signedAtLabel ? `Registro concluÃ­do em ${signedAtLabel}.` : ''}
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (step === 'signing') {
    return (
      <>
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(15,23,42,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-6xl">
          <div className="mb-5 flex flex-col gap-4 rounded-[28px] border border-white/70 bg-white/85 p-5 shadow-[0_24px_80px_-34px_rgba(15,23,42,0.28)] backdrop-blur sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-600">
                Etapa 2 de 2
              </p>
              <h1 className="mt-2 text-3xl font-semibold tracking-tight text-slate-950">Escolha como deseja assinar</h1>
            </div>

            <button
              type="button"
              onClick={() => {
                setIsCameraOpen(false);
                setShowQrCode(false);
                setStep('preview');
              }}
              className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              <Icons.ArrowLeft size={16} />
              Voltar ao documento
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1.15fr)_380px]">
            <section className="rounded-[32px] border border-white/80 bg-white/90 p-4 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)] backdrop-blur sm:p-6">
              <div className="grid gap-3 sm:grid-cols-3">
                {SIGN_TABS.map((tab) => {
                  const Icon = tab.icon;
                  const active = signTab === tab.id;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setSignTab(tab.id);
                        setSubmissionError('');
                      }}
                      className={`flex items-center justify-center gap-3 rounded-[20px] border px-4 py-3 transition-all ${
                        active
                          ? 'border-slate-950 bg-slate-950 text-white shadow-lg'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                      }`}
                    >
                      <Icon size={18} />
                      <span className="text-sm font-bold">{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              {signTab === 'draw' ? (
                <div className="mt-6 space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-sm font-semibold text-slate-950">Desenhe sua assinatura abaixo</p>
                    <button
                      type="button"
                      onClick={clearDrawSignature}
                      className="text-sm font-semibold text-slate-500 hover:text-slate-800"
                    >
                      Limpar Pad
                    </button>
                  </div>

                  <div className="overflow-hidden rounded-[28px] border border-slate-300 bg-slate-100 p-1 sm:p-3">
                    <div className="overflow-hidden rounded-[24px] border border-dashed border-slate-300 bg-white">
                      <SignaturePad
                        ref={signaturePadRef}
                        penColor="#0f172a"
                        onEnd={() => setHasDrawn(!(signaturePadRef.current?.isEmpty() ?? true))}
                        canvasProps={{
                          className: 'w-full h-[220px] sm:h-[290px] bg-white rounded-[24px] touch-none cursor-crosshair',
                        }}
                      />
                    </div>
                  </div>

                  <div className="flex justify-center">
                    <button
                      type="button"
                      onClick={() => setShowQrCode(true)}
                      className="flex items-center gap-2 text-sm font-semibold text-slate-600 hover:text-slate-900"
                    >
                      <Icons.QrCode size={16} /> Assinar pelo Celular
                    </button>
                  </div>
                  </div>
                  ) : null}

              {signTab === 'type' ? (
                <div className="mt-6 space-y-5">
                  <input
                    type="text"
                    value={typedName}
                    onChange={(event) => {
                      setTypedName(event.target.value);
                      setSubmissionError('');
                    }}
                    placeholder="Digite seu nome completo..."
                    className="h-14 w-full rounded-2xl border border-slate-200 bg-white px-4 text-base font-semibold text-slate-900 outline-none transition focus:border-emerald-300 focus:ring-4 focus:ring-emerald-100"
                  />

                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                    {FONT_OPTIONS.map((option) => {
                      const active = selectedFont === option.id;

                      return (
                        <button
                          key={option.id}
                          type="button"
                          onClick={() => setSelectedFont(option.id)}
                          className={`rounded-[20px] border p-2 transition-all ${
                            active
                              ? 'border-emerald-300 bg-emerald-50'
                              : 'border-slate-200 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className={`flex min-h-[60px] items-center justify-center rounded-[14px] px-2 text-center text-3xl text-slate-900 ${option.className}`}>
                            {typedName.trim() || 'Seu nome'}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {signTab === 'upload' ? (
                <div className="mt-6 space-y-5">
                  {!imageToCrop && !uploadPreview ? <div className="grid gap-3 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex h-14 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icons.Image size={18} /> Buscar Arquivo
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsCameraOpen(true)}
                      className="flex h-14 items-center justify-center gap-2 rounded-[20px] border border-slate-200 bg-white text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <Icons.Camera size={18} /> Tirar Foto
                    </button>
                  </div> : null}

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleFileChange}
                  />

                  {imageToCrop ? (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <p className="mb-4 text-center text-sm font-semibold text-slate-950">
                        Recorte apenas a sua assinatura
                      </p>
                      {uploadFileName ? (
                        <p className="mb-4 text-center text-xs font-medium text-slate-500">{uploadFileName}</p>
                      ) : null}
                      <div className="flex justify-center overflow-hidden rounded-xl border border-dashed border-slate-300 bg-white p-2">
                        <ReactCrop crop={crop} onChange={(nextCrop) => setCrop(nextCrop)} className="max-h-[300px]">
                          <img
                            ref={imageRef}
                            src={imageToCrop}
                            alt="Recortar"
                            className="max-h-[300px] w-auto object-contain"
                            onLoad={(event) => {
                              const { width, height } = event.currentTarget;
                              setCrop({
                                unit: 'px',
                                x: width * 0.1,
                                y: height * 0.1,
                                width: width * 0.8,
                                height: height * 0.8,
                              });
                            }}
                          />
                        </ReactCrop>
                      </div>
                      <div className="mt-4 flex gap-3">
                        <button
                          type="button"
                          onClick={clearUploadPreview}
                          className="flex-1 rounded-xl bg-slate-200 py-3 text-sm font-bold text-slate-700"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={getCroppedImage}
                          className="flex-1 rounded-xl bg-emerald-500 py-3 text-sm font-bold text-white shadow-md"
                        >
                          Confirmar Recorte
                        </button>
                      </div>
                    </div>
                  ) : null}

                  {uploadPreview && !imageToCrop ? (
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                      <div className="mb-4 flex items-center justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-950">Sua Assinatura</p>
                          {uploadFileName ? (
                            <p className="mt-1 text-xs font-medium text-slate-500">{uploadFileName}</p>
                          ) : null}
                        </div>
                        <button
                          type="button"
                          onClick={clearUploadPreview}
                          className="text-sm font-semibold text-rose-500 hover:text-rose-700"
                        >
                          Remover
                        </button>
                      </div>

                      <div className="flex h-[180px] items-center justify-center rounded-[20px] border border-slate-200 bg-white p-4 shadow-sm">
                        <img
                          src={uploadPreview}
                          alt="Enviada"
                          className="max-h-full w-auto object-contain mix-blend-multiply"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              ) : null}
            </section>

            <aside className="flex flex-col justify-between rounded-[32px] border border-white/80 bg-white/90 p-6 shadow-[0_30px_90px_-40px_rgba(15,23,42,0.35)] backdrop-blur lg:sticky lg:top-6">
              <div>
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">SignatÃ¡rio</p>
                  <p className="mt-3 text-lg font-semibold text-slate-950">{data.signer_name}</p>
                  <p className="mt-1 text-sm text-slate-500">{data.signer_role || 'Assinatura digital'}</p>
                </div>
              </div>

              <div>
                {submissionError ? (
                  <div className="mb-4 rounded-[20px] bg-red-50 p-4 text-sm font-semibold text-red-600">{submissionError}</div>
                ) : null}
                <button
                  type="button"
                  onClick={() => void handleConfirmSignature()}
                  disabled={!canConfirm}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-4 text-base font-bold text-white shadow-lg shadow-emerald-300/40 transition hover:bg-emerald-600 disabled:opacity-50 disabled:shadow-none"
                >
                  {isSigning ? <Icons.Loader2 className="animate-spin" size={18} /> : 'Confirmar Assinatura'}
                </button>
              </div>
            </aside>
          </div>
        </div>
        </div>

        {showQrCode ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-sm rounded-3xl bg-white p-8 text-center animate-in zoom-in-95">
              <button
                type="button"
                onClick={() => setShowQrCode(false)}
                className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
              >
                <Icons.X size={24} />
              </button>
              <h3 className="mb-2 text-xl font-bold text-slate-900">Assinar no Celular</h3>
              <p className="mb-6 text-sm text-slate-500">Aponte a cÃ¢mera do seu celular para o cÃ³digo abaixo.</p>
              <img src={qrCodeUrl} alt="QR" className="mx-auto rounded-xl border border-slate-200 p-2 shadow-sm" />
            </div>
          </div>
        ) : null}

        {isCameraOpen ? (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/90 p-4 backdrop-blur-sm">
            <div className="relative w-full max-w-lg overflow-hidden rounded-3xl bg-black shadow-2xl animate-in zoom-in-95">
              <div className="relative aspect-[3/4] bg-slate-800 sm:aspect-video">
                <video ref={videoRef} autoPlay playsInline muted className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => setIsCameraOpen(false)}
                  className="absolute right-4 top-4 rounded-full bg-black/50 p-2 text-white transition hover:bg-black"
                >
                  <Icons.X size={20} />
                </button>
              </div>
              <div className="flex flex-col gap-3 bg-white p-6">
                <button
                  type="button"
                  onClick={capturePhoto}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-emerald-500 text-lg font-bold text-white transition hover:bg-emerald-600"
                >
                  <Icons.Camera size={20} /> Tirar Foto
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsCameraOpen(false);
                    setShowQrCode(true);
                  }}
                  className="flex h-14 w-full items-center justify-center gap-2 rounded-xl bg-slate-100 font-bold text-slate-700 transition hover:bg-slate-200"
                >
                  <Icons.QrCode size={20} /> Continuar no Celular
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.08),_transparent_35%),linear-gradient(180deg,#f8fafc_0%,#eef2f7_100%)]">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-white/70 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-600">
              Etapa 1 de 2
            </p>
            <h1 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
              Revise o documento abaixo
            </h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 pb-40 pt-28 sm:px-6 lg:px-8">
        <div className="rounded-[32px] border border-white/70 bg-white/80 p-4 shadow-[0_30px_90px_-42px_rgba(15,23,42,0.28)] backdrop-blur sm:p-6">
          <div className="mx-auto max-w-[840px] rounded-[28px] border border-slate-200 bg-slate-100/80 p-3 sm:p-5">
            <div className="mx-auto min-h-[1123px] w-full max-w-[794px] rounded-sm bg-white p-6 shadow-[0_30px_70px_-36px_rgba(15,23,42,0.35)] sm:p-10">
              <div
                className="contract-preview text-slate-900"
                dangerouslySetInnerHTML={{ __html: contractHtml }}
              />
            </div>
          </div>
        </div>
      </main>

      <footer className="fixed inset-x-0 bottom-0 z-20 border-t border-white/70 bg-white/92 backdrop-blur">
        <div className="mx-auto flex max-w-6xl flex-col gap-4 px-4 py-4 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:px-8">
          <div>
            <p className="text-sm font-semibold text-slate-950">{data.companies?.name || 'TR ImÃ³veis'}</p>
            <p className="mt-1 text-sm text-slate-500">
              Revise o conteÃºdo e avance para a etapa de assinatura.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setStep('signing')}
            className="flex h-14 w-full items-center justify-center gap-2 rounded-2xl bg-emerald-500 px-6 text-base font-bold text-white shadow-lg transition hover:bg-emerald-600 lg:w-auto"
          >
            Assinar Documento <Icons.ArrowRight size={18} />
          </button>
        </div>
      </footer>
    </div>
  );
}




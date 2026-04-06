import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';

interface SignatureCompany {
  name: string;
}

interface SignatureDocumentData {
  id: string;
  status: 'pending' | 'signed' | 'rejected';
  signer_name: string;
  signature_image: string | null;
  companies: SignatureCompany | null;
}

const CANVAS_WIDTH = 400;
const CANVAS_HEIGHT = 200;

export default function SignDocument() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SignatureDocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSigning, setIsSigning] = useState(false);
  const [ipAddress, setIpAddress] = useState<string>('');

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

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
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: signatureData, error } = await supabase
        .from('contract_signatures')
        .select('id, status, signer_name, signature_image, companies(name)')
        .eq('token', token)
        .maybeSingle();

      if (error) {
        throw error;
      }

      setData((signatureData as SignatureDocumentData | null) ?? null);
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
    if (canvasRef.current && data?.status === 'pending') {
      const context = canvasRef.current.getContext('2d');

      if (context) {
        context.strokeStyle = '#0f172a';
        context.lineWidth = 3;
        context.lineCap = 'round';
        context.lineJoin = 'round';
      }
    }
  }, [data]);

  const getCanvasPoint = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return null;
    }

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    const point = getCanvasPoint(event);

    if (!context || !point) {
      return;
    }

    context.beginPath();
    context.moveTo(point.x, point.y);
    setIsDrawing(true);
    canvas.setPointerCapture(event.pointerId);
  };

  const draw = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }

    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');
    const point = getCanvasPoint(event);

    if (!context || !point) {
      return;
    }

    context.lineTo(point.x, point.y);
    context.stroke();
    setHasDrawn(true);
  };

  const stopDrawing = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) {
      return;
    }

    const canvas = canvasRef.current;

    setIsDrawing(false);

    if (canvas?.hasPointerCapture(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;

    if (!canvas) {
      return;
    }

    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleSign = async () => {
    if (!token || !data || !hasDrawn || !canvasRef.current) {
      return;
    }

    setIsSigning(true);

    try {
      const signatureImage = canvasRef.current.toDataURL('image/png');

      const { error } = await supabase
        .from('contract_signatures')
        .update({
          status: 'signed',
          signed_at: new Date().toISOString(),
          ip_address: ipAddress || 'IP Desconhecido',
          user_agent: navigator.userAgent,
          signature_image: signatureImage,
        })
        .eq('token', token)
        .eq('status', 'pending');

      if (error) {
        throw error;
      }

      await fetchData();
    } catch (error) {
      console.error('Erro ao processar assinatura:', error);
      alert('Erro ao processar assinatura.');
    } finally {
      setIsSigning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <Icons.Loader2 className="animate-spin text-slate-400" size={32} />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
        Link invalido.
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 p-4 font-['DM_Sans'] antialiased">
      <div className="flex w-full max-w-md flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-100 p-6 text-center">
          <h2 className="text-xl font-semibold text-slate-900">Assinatura Digital</h2>
          <p className="mt-1 text-sm text-slate-500">{data.companies?.name}</p>
        </div>

        <div className="space-y-6 p-6">
          {data.status === 'signed' ? (
            <div className="py-6 text-center">
              <Icons.CheckCircle2 className="mx-auto mb-4 text-emerald-500" size={48} />
              <h3 className="text-xl font-bold text-slate-900">Assinado com Sucesso</h3>
              <p className="mt-2 text-sm text-slate-500">Sua assinatura foi registrada.</p>
              {data.signature_image && (
                <img
                  src={data.signature_image}
                  alt="Sua assinatura"
                  className="mx-auto mt-6 h-24 border-b-2 border-slate-200"
                />
              )}
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">Signatario:</span>
                <span className="font-bold text-slate-900">{data.signer_name}</span>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-bold text-slate-700">
                    Desenhe sua assinatura abaixo:
                  </label>
                  <button
                    type="button"
                    onClick={clearCanvas}
                    className="text-xs font-bold text-brand-600 transition-colors hover:text-brand-700"
                  >
                    Limpar
                  </button>
                </div>

                <div className="touch-none overflow-hidden rounded-xl border-2 border-dashed border-slate-300 bg-slate-50">
                  <canvas
                    ref={canvasRef}
                    width={CANVAS_WIDTH}
                    height={CANVAS_HEIGHT}
                    className="h-[200px] w-full cursor-crosshair"
                    onPointerDown={startDrawing}
                    onPointerMove={draw}
                    onPointerUp={stopDrawing}
                    onPointerLeave={stopDrawing}
                    onPointerCancel={stopDrawing}
                  />
                </div>
              </div>

              <div className="text-center font-mono text-xs text-slate-400">
                IP Registrado: {ipAddress || 'IP Desconhecido'}
              </div>

              <button
                type="button"
                onClick={handleSign}
                disabled={!hasDrawn || isSigning}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 font-bold text-white transition-colors disabled:opacity-50"
              >
                {isSigning ? (
                  <Icons.Loader2 className="animate-spin" size={18} />
                ) : (
                  'Confirmar Assinatura'
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

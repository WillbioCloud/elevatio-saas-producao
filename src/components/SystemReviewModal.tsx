import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, MessageSquareQuote, Send, Sparkles, Star } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/contexts/ToastContext';
import { supabase } from '@/lib/supabase';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

type SystemReviewModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const RATING_LABELS: Record<number, { title: string; helper: string }> = {
  1: {
    title: 'A experiencia ficou aquem',
    helper: 'Conta pra gente o que te frustrou para corrigirmos rapido.',
  },
  2: {
    title: 'Ainda ha atritos',
    helper: 'Seu contexto ajuda a priorizar ajustes com mais clareza.',
  },
  3: {
    title: 'Estamos no caminho',
    helper: 'O que falta para a plataforma ficar realmente redonda?',
  },
  4: {
    title: 'Que bom ver isso',
    helper: 'Seu depoimento mostra o que ja esta funcionando bem.',
  },
  5: {
    title: 'Uau, isso nos move',
    helper: 'Queremos ampliar exatamente esse sentimento no produto inteiro.',
  },
};

const STAR_OPTIONS = [1, 2, 3, 4, 5];

export default function SystemReviewModal({ isOpen, onClose }: SystemReviewModalProps) {
  const { user } = useAuth();
  const { addToast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const role = user?.role ?? (user?.user_metadata as Record<string, unknown> | undefined)?.role;

  useEffect(() => {
    if (!isOpen) return;

    setRating(0);
    setHoveredRating(0);
    setComment('');
    setIsSubmitting(false);
  }, [isOpen]);

  const activeRating = hoveredRating || rating;
  const activeLabel = useMemo(
    () =>
      activeRating > 0
        ? RATING_LABELS[activeRating]
        : {
            title: 'Escolha uma nota de 1 a 5 estrelas',
            helper: 'Leva menos de um minuto e influencia diretamente nossa evolucao.',
          },
    [activeRating]
  );

  const handleSubmit = async () => {
    if (!user || role !== 'owner' || !rating || isSubmitting) return;

    setIsSubmitting(true);

    try {
      const sanitizedComment = comment.trim();
      const { error } = await supabase.from('system_reviews').insert({
        user_id: user?.id,
        company_id: user?.company_id,
        rating: rating,
        comment: sanitizedComment || null,
        is_public: false,
      });

      if (error) throw error;

      addToast('Obrigado! Sua avaliacao ja foi registrada.', 'success');
      onClose();
    } catch (error) {
      console.error('Erro ao salvar avaliacao do sistema:', error);
      addToast('Nao foi possivel enviar sua avaliacao agora.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen && !isSubmitting) {
          onClose();
        }
      }}
    >
      <DialogContent
        className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-4xl [&>button]:hidden"
        onEscapeKeyDown={(event) => event.preventDefault()}
        onPointerDownOutside={(event) => event.preventDefault()}
      >
        <div className="relative overflow-hidden rounded-[32px] border border-white/10 bg-slate-950 text-white shadow-[0_40px_120px_rgba(15,23,42,0.65)]">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(59,130,246,0.28),_transparent_38%),radial-gradient(circle_at_bottom_right,_rgba(20,184,166,0.24),_transparent_34%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(2,6,23,0.96))]" />
          <div className="absolute -left-24 top-10 h-56 w-56 rounded-full bg-cyan-400/20 blur-3xl" />
          <div className="absolute -right-20 bottom-0 h-64 w-64 rounded-full bg-emerald-400/10 blur-3xl" />

          <div className="relative grid gap-0 lg:grid-cols-[1.1fr_1fr]">
            <div className="border-b border-white/10 p-8 lg:border-b-0 lg:border-r lg:p-10">
              <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/20 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.25em] text-cyan-200">
                <Sparkles className="h-4 w-4" />
                Elevatio Pulse
              </div>

              <div className="mt-6 max-w-xl">
                <DialogTitle className="text-3xl font-black leading-tight text-white sm:text-4xl">
                  Como esta sendo sua jornada no Elevatio?
                </DialogTitle>
                <DialogDescription className="mt-4 max-w-lg text-base leading-relaxed text-slate-300">
                  Sua opiniao ajuda a moldar o futuro da nossa plataforma.
                </DialogDescription>
              </div>

              <div className="mt-8 rounded-[28px] border border-white/10 bg-white/5 p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-400/10 text-amber-300">
                    <MessageSquareQuote className="h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-200">
                      {user?.company?.name ? `Time ${user.company.name}` : 'Sua operacao'}
                    </p>
                    <p className="text-sm text-slate-400">
                      Um feedback honesto nos ajuda a evoluir mais rapido e melhor.
                    </p>
                  </div>
                </div>

                <div className="mt-6 flex items-center gap-4">
                  <div className="text-5xl font-black text-white">
                    {activeRating || '...'}
                  </div>
                  <div className="min-h-[56px]">
                    <p className="text-lg font-semibold text-white">{activeLabel.title}</p>
                    <p className="mt-1 max-w-sm text-sm leading-relaxed text-slate-400">
                      {activeLabel.helper}
                    </p>
                  </div>
                </div>

                <div className="mt-8 grid grid-cols-5 gap-2 text-xs text-slate-400 sm:gap-3">
                  {STAR_OPTIONS.map((value) => (
                    <div
                      key={value}
                      className={cn(
                        'flex h-14 flex-col items-center justify-center rounded-2xl border transition-colors',
                        activeRating >= value
                          ? 'border-amber-300/40 bg-amber-400/10'
                          : 'border-white/10 bg-white/5'
                      )}
                    >
                      <div className="flex flex-wrap justify-center gap-0.5 px-1">
                        {[...Array(value)].map((_, i) => (
                          <Star
                            key={i}
                            size={10}
                            className={cn(
                              'transition-colors',
                              activeRating >= value ? 'fill-amber-400 text-amber-400' : 'fill-slate-600/40 text-transparent'
                            )}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-8 lg:p-10">
              <div>
                <Label className="text-sm font-semibold text-slate-200">Sua nota</Label>
                <div
                  className="mt-4 flex w-full gap-2 sm:gap-3"
                  onMouseLeave={() => setHoveredRating(0)}
                >
                  {STAR_OPTIONS.map((value) => {
                    const isActive = activeRating >= value;

                    return (
                      <button
                        key={value}
                        type="button"
                        aria-label={`Dar nota ${value}`}
                        onClick={() => setRating(value)}
                        onMouseEnter={() => setHoveredRating(value)}
                        className={cn(
                          'group flex h-16 flex-1 min-w-0 items-center justify-center rounded-2xl border transition-all duration-200',
                          isActive
                            ? 'border-amber-300/50 bg-amber-400/15 text-amber-300 shadow-[0_18px_40px_rgba(251,191,36,0.12)]'
                            : 'border-white/10 bg-white/5 text-slate-500 hover:border-white/20 hover:bg-white/10 hover:text-slate-200'
                        )}
                      >
                        <Star
                          className={cn(
                            'h-8 w-8 transition-transform duration-200 group-hover:scale-110',
                            isActive && 'fill-current'
                          )}
                        />
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="mt-8">
                <div className="flex items-center justify-between gap-4">
                  <Label htmlFor="system-review-comment" className="text-sm font-semibold text-slate-200">
                    Seu depoimento
                  </Label>
                  <span className="text-xs text-slate-500">{comment.length}/500</span>
                </div>
                <Textarea
                  id="system-review-comment"
                  value={comment}
                  onChange={(event) => setComment(event.target.value.slice(0, 500))}
                  placeholder="O que mais encantou? Onde ainda podemos simplificar? Seu contexto vale ouro."
                  className="mt-3 min-h-[180px] rounded-[24px] border-white/10 bg-white/5 px-5 py-4 text-sm leading-relaxed text-white placeholder:text-slate-500 focus-visible:ring-cyan-300 dark:border-white/10 dark:bg-white/5 dark:text-white"
                />
              </div>

              <div className="mt-8 rounded-[24px] border border-dashed border-white/10 bg-white/5 p-4 text-sm leading-relaxed text-slate-400">
                Se ainda nao der para avaliar agora, tudo bem. Vamos te lembrar novamente no proximo login ate registrar sua nota.
              </div>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="h-12 flex-1 rounded-2xl border-white/15 bg-white/5 text-slate-200 hover:bg-white/10 hover:text-white"
                >
                  Lembrar depois
                </Button>
                <Button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!rating || isSubmitting}
                  className="h-12 flex-1 rounded-2xl bg-cyan-400 text-slate-950 shadow-[0_18px_40px_rgba(34,211,238,0.2)] hover:bg-cyan-300"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Enviando avaliacao...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Enviar avaliacao
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

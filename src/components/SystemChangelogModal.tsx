import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { Icons } from './Icons';

type ChangelogType = 'new' | 'improvement' | 'fix';

type ChangelogItem = {
  version: string;
  date: string;
  title: string;
  type: ChangelogType;
  description: string;
};

type SystemChangelogModalProps = {
  isOpen: boolean;
  onClose: () => void;
};

const CHANGELOG: ChangelogItem[] = [
  {
    version: 'v1.0.0',
    date: '19/04/2026',
    title: 'Lancamento Oficial Elevatio',
    type: 'new',
    description:
      'Bem-vindo ao Elevatio Vendas. Lancamos o CRM completo, Construtor de Sites, funil comercial, contratos e fluxo automatizado de pagamentos.',
  },
  {
    version: 'v0.9.5',
    date: '18/04/2026',
    title: 'Onboarding mais fluido',
    type: 'improvement',
    description:
      'A configuracao inicial agora salva o dominio de producao e aciona a automacao de infraestrutura quando o cliente usa dominio proprio.',
  },
  {
    version: 'v0.9.4',
    date: '17/04/2026',
    title: 'Ajustes de estabilidade financeira',
    type: 'fix',
    description:
      'Melhoramos a conciliacao de webhooks e preservamos as datas do ciclo contratual durante eventos de pagamento recorrente.',
  },
];

const TYPE_META: Record<
  ChangelogType,
  {
    label: string;
    badgeClass: string;
    iconClass: string;
    Icon: typeof Icons.Sparkles;
  }
> = {
  new: {
    label: 'Novo',
    badgeClass: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    iconClass: 'bg-emerald-500 text-white',
    Icon: Icons.Sparkles,
  },
  improvement: {
    label: 'Melhoria',
    badgeClass: 'border-sky-200 bg-sky-50 text-sky-700',
    iconClass: 'bg-sky-500 text-white',
    Icon: Icons.Zap,
  },
  fix: {
    label: 'Correcao',
    badgeClass: 'border-amber-200 bg-amber-50 text-amber-700',
    iconClass: 'bg-amber-500 text-white',
    Icon: Icons.Wrench,
  },
};

export default function SystemChangelogModal({ isOpen, onClose }: SystemChangelogModalProps) {
  return (
    <Dialog
      open={isOpen}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) onClose();
      }}
    >
      <DialogContent className="overflow-hidden border-none bg-transparent p-0 shadow-none sm:max-w-2xl [&>button]:hidden">
        <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white text-slate-900 shadow-2xl dark:border-slate-800 dark:bg-slate-950 dark:text-white">
          <div className="border-b border-slate-200 bg-slate-950 px-6 py-6 text-white dark:border-slate-800">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="mb-3 inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/10 px-3 py-1.5 text-xs font-black uppercase tracking-widest text-sky-100">
                  <Icons.Sparkles size={14} />
                  Produto
                </div>
                <DialogTitle className="text-2xl font-black font-sans tracking-tight sm:text-3xl">
                  Atualizacoes do Elevatio
                </DialogTitle>
                <DialogDescription className="mt-2 max-w-lg text-sm leading-relaxed text-slate-300">
                  Melhorias, correcoes e lancamentos para acompanhar a evolucao do CRM.
                </DialogDescription>
              </div>

              <button
                type="button"
                onClick={onClose}
                aria-label="Fechar atualizacoes"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/5 text-slate-300 transition-colors hover:bg-white/10 hover:text-white"
              >
                <Icons.X size={18} />
              </button>
            </div>
          </div>

          <div className="max-h-[70vh] overflow-y-auto px-6 py-6">
            <div className="relative">
              <div className="absolute bottom-8 left-5 top-4 w-px bg-slate-200 dark:bg-slate-800" />

              <div className="space-y-4">
                {CHANGELOG.map((item) => {
                  const meta = TYPE_META[item.type];
                  const Icon = meta.Icon;

                  return (
                    <article key={`${item.version}-${item.title}`} className="relative pl-14">
                      <div
                        className={cn(
                          'absolute left-0 top-4 z-10 flex h-10 w-10 items-center justify-center rounded-lg shadow-sm ring-4 ring-white dark:ring-slate-950',
                          meta.iconClass
                        )}
                      >
                        <Icon size={18} />
                      </div>

                      <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition-colors hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900/70 dark:hover:border-slate-700">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex items-center rounded-md border px-2 py-1 text-[11px] font-black uppercase tracking-wider',
                              meta.badgeClass
                            )}
                          >
                            {meta.label}
                          </span>
                          <span className="text-xs font-black text-slate-500 dark:text-slate-400">
                            {item.version}
                          </span>
                          <span className="text-xs text-slate-400">-</span>
                          <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                            {item.date}
                          </span>
                        </div>

                        <h3 className="mt-3 text-base font-black text-slate-950 dark:text-white">
                          {item.title}
                        </h3>
                        <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                          {item.description}
                        </p>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

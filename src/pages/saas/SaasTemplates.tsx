import React, { useState } from 'react';
import { Icons } from '../../components/Icons';
import { templatesList, type TemplateStatus } from '../../templates/templateRegistry';

const statusConfig: Record<
  TemplateStatus,
  {
    label: string;
    chipClassName: string;
    Icon: typeof Icons.CheckCircle2;
  }
> = {
  disponivel: {
    label: 'Ativo',
    chipClassName:
      'bg-green-50 text-green-600 dark:bg-green-900/30 dark:text-green-400',
    Icon: Icons.CheckCircle2,
  },
  em_breve: {
    label: 'Em breve',
    chipClassName:
      'bg-amber-50 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
    Icon: Icons.Clock,
  },
  manutencao: {
    label: 'Manutenção',
    chipClassName: 'bg-rose-50 text-rose-600 dark:bg-rose-900/30 dark:text-rose-400',
    Icon: Icons.AlertTriangle,
  },
};

export default function SaasTemplates() {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredTemplates = templatesList.filter(
    (template) =>
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-2xl font-black text-slate-800 dark:text-white">
            Gestão de Templates
          </h1>
          <p className="mt-1 text-slate-500 dark:text-slate-400">
            Controle os temas disponíveis para as imobiliárias do SaaS.
          </p>
        </div>

        <div className="relative w-full sm:w-auto">
          <Icons.Search
            className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            size={18}
          />
          <input
            type="text"
            placeholder="Buscar template..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-10 pr-4 focus:ring-2 focus:ring-brand-500 dark:border-slate-700 dark:bg-slate-800 sm:w-64"
          />
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-6 py-16 text-center dark:border-slate-700 dark:bg-slate-900/60">
          <Icons.Search size={28} className="mx-auto text-slate-300 dark:text-slate-600" />
          <h2 className="mt-4 text-lg font-bold text-slate-800 dark:text-white">
            Nenhum template encontrado
          </h2>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Ajuste a busca para encontrar um tema pelo nome ou ID técnico.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredTemplates.map((template) => {
            const status = statusConfig[template.status];

            return (
              <div
                key={template.id}
                className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md dark:border-slate-700 dark:bg-slate-800"
              >
                <div className="group relative flex aspect-video items-center justify-center border-b border-slate-200 bg-slate-100 dark:border-slate-700 dark:bg-slate-900">
                  <Icons.Layout
                    size={48}
                    className="text-slate-300 transition-transform group-hover:scale-110 dark:text-slate-700"
                  />
                  <div className="absolute inset-0 bg-brand-600/0 transition-colors group-hover:bg-brand-600/10" />
                </div>

                <div className="p-5">
                  <div className="mb-2 flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold text-slate-800 dark:text-white">{template.name}</h3>
                      <code className="rounded bg-brand-50 px-2 py-0.5 text-xs text-brand-600 dark:bg-brand-900/30 dark:text-brand-400">
                        ID: {template.id}
                      </code>
                    </div>

                    <div
                      className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium ${status.chipClassName}`}
                    >
                      <status.Icon size={14} />
                      {status.label}
                    </div>
                  </div>

                  <p className="mt-3 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {template.description || 'Template otimizado para alta conversão.'}
                  </p>

                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-700">
                    <span className="text-xs font-medium text-slate-500">
                      {template.id === 'modern' ? 'Padrão do Sistema' : 'Template Premium'}
                    </span>
                    <button
                      type="button"
                      className="flex items-center gap-1 text-sm font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
                    >
                      <Icons.Settings size={16} /> Configurar
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

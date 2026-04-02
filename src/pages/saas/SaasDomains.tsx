import React, { useEffect, useState } from 'react';
import { Icons } from '../../components/Icons';
import { supabase } from '../../lib/supabase';

export default function SaasDomains() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchDomains();
  }, []);

  const fetchDomains = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('companies')
        .select('id, name, subdomain, domain, domain_secondary, domain_status, domain_secondary_status, created_at')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCompanies(data || []);
    } catch (err) {
      console.error('Erro ao buscar domínios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getDomainStatusClasses = (status: string | null) => {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'error' || status === 'expired') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (status === 'idle') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse';
  };

  const getDomainStatusLabel = (status: string | null) => {
    if (status === 'active') return 'Configurado';
    if (status === 'error') return 'Erro DNS';
    if (status === 'expired') return 'Expirado';
    if (status === 'idle') return 'Ocioso';
    return 'Pendente';
  };

  return (
    <div className="font-['DM_Sans'] animate-in fade-in duration-300">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Gestão de Domínios</h1>
          <p className="mt-1 text-slate-500">Administre os domínios próprios e subdomínios dos seus clientes.</p>
        </div>
        <button
          onClick={fetchDomains}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm transition-colors hover:bg-slate-50"
        >
          <Icons.RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center rounded-[24px] border border-slate-200 bg-white py-20">
          <Icons.Loader2 className="mb-4 h-10 w-10 animate-spin text-[#1a56db]" />
          <p className="font-bold text-slate-700">Carregando domínios...</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50/70">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Imobiliária</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Subdomínio (Grátis)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Domínio Próprio (Pago)</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Domínio Secundário</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => {
                return (
                  <tr key={company.id} className="group transition-colors hover:bg-slate-50/80">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{company.name}</p>
                      <p className="mt-0.5 text-xs text-slate-400">Criado em {new Date(company.created_at).toLocaleDateString()}</p>
                    </td>

                    <td className="px-6 py-4">
                      {company.subdomain ? (
                        <div className="flex items-center gap-2">
                          <Icons.Link size={14} className="text-slate-400" />
                          <span className="text-sm font-medium text-slate-600">
                            {company.subdomain}.elevatiovendas.com.br
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm italic text-slate-400">Não configurado</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {company.domain ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Icons.Globe size={14} className="text-[#1a56db]" />
                            <span className="text-sm font-bold text-[#1a56db]">
                              {company.domain}
                            </span>
                          </div>
                          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getDomainStatusClasses(company.domain_status)}`}>
                            {getDomainStatusLabel(company.domain_status)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      {company.domain_secondary ? (
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <Icons.Globe size={14} className="text-[#1a56db]" />
                            <span className="text-sm font-bold text-[#1a56db]">
                              {company.domain_secondary}
                            </span>
                          </div>
                          <span className={`inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-bold ${getDomainStatusClasses(company.domain_secondary_status)}`}>
                            {getDomainStatusLabel(company.domain_secondary_status)}
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-slate-400">-</span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        disabled={!company.domain && !company.domain_secondary}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-white transition-colors hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
                      >
                        <Icons.Settings size={14} /> Configurar DNS
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../../components/Icons';
import { supabase } from '../../lib/supabase';

export default function SaasDomains() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<any | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

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
      
      // Se tiver uma empresa selecionada, atualiza os dados dela na gaveta
      if (selectedCompany) {
        const updated = data?.find(c => c.id === selectedCompany.id);
        if (updated) setSelectedCompany(updated);
      }
    } catch (err) {
      console.error('Erro ao buscar domínios:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const updateDomainStatus = async (companyId: string, type: 'primary' | 'secondary', newStatus: string) => {
    setIsUpdating(true);
    try {
      const field = type === 'primary' ? 'domain_status' : 'domain_secondary_status';
      const { error } = await supabase
        .from('companies')
        .update({ [field]: newStatus })
        .eq('id', companyId);

      if (error) throw error;
      
      // Recarrega a tabela para refletir a mudança
      await fetchDomains();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      alert('Erro ao atualizar o status do domínio.');
    } finally {
      setIsUpdating(false);
    }
  };

  const getDomainStatusClasses = (status: string | null) => {
    if (status === 'active') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
    if (status === 'error') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    if (status === 'idle') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
    return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse';
  };

  const getDomainStatusLabel = (status: string | null) => {
    if (status === 'active') return 'Ativo';
    if (status === 'error') return 'Erro DNS';
    if (status === 'idle') return 'Ocioso';
    return 'Pendente';
  };

  return (
    <div className="font-['DM_Sans'] animate-in fade-in duration-300">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-800 dark:text-white">Gestão de Domínios</h1>
          <p className="mt-1 text-slate-500">Administre e ative os domínios próprios dos seus clientes.</p>
        </div>
        <button
          onClick={fetchDomains}
          className="flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-bold text-slate-600 shadow-sm border border-slate-200 hover:bg-slate-50 transition-colors"
        >
          <Icons.RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Atualizar
        </button>
      </div>

      {isLoading && companies.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[24px] border border-slate-200">
          <Icons.Loader2 className="w-10 h-10 text-[#1a56db] animate-spin mb-4" />
          <p className="font-bold text-slate-700">Carregando domínios...</p>
        </div>
      ) : (
        <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <table className="w-full text-left">
            <thead className="border-b border-slate-200 bg-slate-50/70">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Imobiliária</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Subdomínio</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Domínios Adicionais</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.18em] text-slate-400">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {companies.map((company) => {
                const hasCustomDomains = company.domain || company.domain_secondary;
                return (
                  <tr key={company.id} className="transition-colors hover:bg-slate-50/80 group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-slate-800">{company.name}</p>
                      <p className="text-xs text-slate-400 mt-0.5">Criado em {new Date(company.created_at).toLocaleDateString()}</p>
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
                        <span className="text-sm text-slate-400 italic">Não configurado</span>
                      )}
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {company.domain && (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-2 w-2 rounded-full ${company.domain_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            <span className="text-sm font-bold text-slate-700">{company.domain}</span>
                          </div>
                        )}
                        {company.domain_secondary && (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-2 w-2 rounded-full ${company.domain_secondary_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`}></span>
                            <span className="text-sm font-bold text-slate-700">{company.domain_secondary}</span>
                          </div>
                        )}
                        {!hasCustomDomains && <span className="text-sm text-slate-400">-</span>}
                      </div>
                    </td>

                    <td className="px-6 py-4 text-right">
                      <button
                        disabled={!hasCustomDomains}
                        onClick={() => setSelectedCompany(company)}
                        className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-white transition-all hover:bg-slate-800 hover:shadow-md disabled:opacity-30 disabled:cursor-not-allowed"
                      >
                        <Icons.Settings size={14} /> Gerir DNS
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* MODAL DE CONTROLE DE DNS (PORTAL) */}
      {selectedCompany && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end font-['DM_Sans']">
          <div 
            className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm animate-in fade-in duration-300" 
            onClick={() => setSelectedCompany(null)} 
          />

          <div className="relative w-full max-w-md h-screen bg-white dark:bg-slate-900 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50">
              <div>
                <h2 className="text-lg font-black text-slate-800">Controle de Domínios</h2>
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">{selectedCompany.name}</p>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="p-2 text-slate-400 hover:text-slate-600 rounded-full">
                <Icons.X size={20} />
              </button>
            </div>

            {/* Corpo */}
            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              
              {/* Box de Instruções DNS */}
              <div className="bg-blue-50 border border-blue-100 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-blue-800">
                  <Icons.Info size={16} />
                  <h4 className="text-sm font-bold">Instruções de Apontamento</h4>
                </div>
                <p className="text-xs text-blue-600 mb-3">Para ativar um domínio, configure os seguintes registros no provedor do cliente (Registro.br, Cloudflare, etc):</p>
                <div className="space-y-2 text-xs font-mono bg-white p-3 rounded border border-blue-100">
                  <div className="flex justify-between"><span className="font-bold">Tipo: A</span> <span>Nome: @</span> <span>Valor: 76.76.21.21</span></div>
                  <div className="flex justify-between"><span className="font-bold">Tipo: CNAME</span> <span>Nome: www</span> <span>Valor: cname.vercel-dns.com</span></div>
                </div>
              </div>

              {/* Domínio Principal */}
              {selectedCompany.domain && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Domínio Principal</p>
                      <p className="text-base font-black text-slate-800">{selectedCompany.domain}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${getDomainStatusClasses(selectedCompany.domain_status)}`}>
                      {getDomainStatusLabel(selectedCompany.domain_status)}
                    </span>
                  </div>
                  
                  <div className="p-4 bg-white space-y-3">
                    <p className="text-xs font-bold text-slate-500">Alterar Status:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => updateDomainStatus(selectedCompany.id, 'primary', 'active')}
                        disabled={isUpdating || selectedCompany.domain_status === 'active'}
                        className="py-2 text-xs font-bold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Marcar como Ativo
                      </button>
                      <button 
                        onClick={() => updateDomainStatus(selectedCompany.id, 'primary', 'error')}
                        disabled={isUpdating || selectedCompany.domain_status === 'error'}
                        className="py-2 text-xs font-bold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Sinalizar Erro
                      </button>
                      <button 
                        onClick={() => updateDomainStatus(selectedCompany.id, 'primary', 'pending')}
                        disabled={isUpdating || selectedCompany.domain_status === 'pending'}
                        className="col-span-2 py-2 text-xs font-bold rounded-lg border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50"
                      >
                        Voltar para Pendente
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Domínio Secundário */}
              {selectedCompany.domain_secondary && (
                <div className="border border-slate-200 rounded-2xl overflow-hidden">
                  <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Domínio Secundário (Upsell)</p>
                      <p className="text-base font-black text-slate-800">{selectedCompany.domain_secondary}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${getDomainStatusClasses(selectedCompany.domain_secondary_status)}`}>
                      {getDomainStatusLabel(selectedCompany.domain_secondary_status)}
                    </span>
                  </div>
                  
                  <div className="p-4 bg-white space-y-3">
                    <p className="text-xs font-bold text-slate-500">Alterar Status:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <button 
                        onClick={() => updateDomainStatus(selectedCompany.id, 'secondary', 'active')}
                        disabled={isUpdating || selectedCompany.domain_secondary_status === 'active'}
                        className="py-2 text-xs font-bold rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                      >
                        Marcar como Ativo
                      </button>
                      <button 
                        onClick={() => updateDomainStatus(selectedCompany.id, 'secondary', 'error')}
                        disabled={isUpdating || selectedCompany.domain_secondary_status === 'error'}
                        className="py-2 text-xs font-bold rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-50"
                      >
                        Sinalizar Erro
                      </button>
                      <button 
                        onClick={() => updateDomainStatus(selectedCompany.id, 'secondary', 'idle')}
                        disabled={isUpdating || selectedCompany.domain_secondary_status === 'idle'}
                        className="col-span-2 py-2 text-xs font-bold rounded-lg border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 disabled:opacity-50"
                      >
                        Marcar como Ocioso
                      </button>
                    </div>
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}

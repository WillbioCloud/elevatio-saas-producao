import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icons } from '../../components/Icons';
import { supabase } from '../../lib/supabase';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '../../../components/ui/skeleton';
import { cn } from '@/lib/utils';

type DomainStatus = 'pending' | 'active' | 'error' | 'idle' | 'expired' | null;

interface Company {
  id: string;
  name: string;
  subdomain: string | null;
  domain: string | null;
  domain_secondary: string | null;
  domain_status: DomainStatus;
  domain_secondary_status: DomainStatus;
  created_at: string;
}

const getDomainStatusClasses = (status: DomainStatus) => {
  if (status === 'active') return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400';
  if (status === 'error') return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
  if (status === 'expired') return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400';
  if (status === 'idle') return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400';
  return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400 animate-pulse';
};

const getDomainStatusLabel = (status: DomainStatus) => {
  if (status === 'active') return 'Ativo';
  if (status === 'error') return 'Erro DNS';
  if (status === 'expired') return 'Expirado';
  if (status === 'idle') return 'Ocioso';
  return 'Pendente';
};

export default function SaasDomains() {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
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
      await fetchDomains();
    } catch (err) {
      console.error('Erro ao atualizar status:', err);
      alert('Erro ao atualizar o status do domínio.');
    } finally {
      setIsUpdating(false);
    }
  };

  if (isLoading && companies.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-black text-foreground">Gestão de Domínios</h1>
          <p className="mt-1 text-muted-foreground">Administre e ative os domínios próprios dos seus clientes.</p>
        </div>
        <Button
          variant="outline"
          onClick={fetchDomains}
          className="gap-2"
        >
          <Icons.RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          Atualizar
        </Button>
      </div>

      <Card className="border-border/50 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b border-border bg-muted/30">
              <tr>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Imobiliária</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Subdomínio</th>
                <th className="px-6 py-4 text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Domínios Adicionais</th>
                <th className="px-6 py-4 text-right text-xs font-bold uppercase tracking-[0.18em] text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {companies.map((company) => {
                const hasCustomDomains = company.domain || company.domain_secondary;
                return (
                  <tr key={company.id} className="transition-colors hover:bg-muted/30 group">
                    <td className="px-6 py-4">
                      <p className="font-bold text-foreground">{company.name}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        Criado em {new Date(company.created_at).toLocaleDateString()}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      {company.subdomain ? (
                        <div className="flex items-center gap-2">
                          <Icons.Link size={14} className="text-muted-foreground" />
                          <span className="text-sm font-medium">
                            {company.subdomain}.elevatiovendas.com.br
                          </span>
                        </div>
                      ) : (
                        <span className="text-sm text-muted-foreground italic">Não configurado</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-col gap-2">
                        {company.domain && (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-2 w-2 rounded-full ${company.domain_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="text-sm font-bold">{company.domain}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-2 py-0", getDomainStatusClasses(company.domain_status))}>
                              {getDomainStatusLabel(company.domain_status)}
                            </Badge>
                          </div>
                        )}
                        {company.domain_secondary && (
                          <div className="flex items-center gap-2">
                            <span className={`inline-flex h-2 w-2 rounded-full ${company.domain_secondary_status === 'active' ? 'bg-emerald-500' : 'bg-amber-500'}`} />
                            <span className="text-sm font-bold">{company.domain_secondary}</span>
                            <Badge variant="outline" className={cn("text-[10px] px-2 py-0", getDomainStatusClasses(company.domain_secondary_status))}>
                              {getDomainStatusLabel(company.domain_secondary_status)}
                            </Badge>
                          </div>
                        )}
                        {!hasCustomDomains && <span className="text-sm text-muted-foreground">-</span>}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        disabled={!hasCustomDomains}
                        onClick={() => setSelectedCompany(company)}
                        variant="default"
                        size="sm"
                        className="gap-2 shadow-sm"
                      >
                        <Icons.Settings size={14} /> Gerir DNS
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal de Controle de DNS (Portal) */}
      {selectedCompany && createPortal(
        <div className="fixed inset-0 z-[99999] flex justify-end">
          <div
            className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-in fade-in duration-300"
            onClick={() => setSelectedCompany(null)}
          />
          <div className="relative w-full max-w-md h-screen bg-card shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">
            <div className="flex items-center justify-between p-6 border-b border-border bg-muted/20">
              <div>
                <h2 className="text-lg font-black">Controle de Domínios</h2>
                <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{selectedCompany.name}</p>
              </div>
              <button onClick={() => setSelectedCompany(null)} className="p-2 text-muted-foreground hover:text-foreground rounded-full">
                <Icons.X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-6">
              {/* Box de Instruções DNS */}
              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-800/30 p-4 rounded-xl">
                <div className="flex items-center gap-2 mb-2 text-blue-800 dark:text-blue-300">
                  <Icons.Info size={16} />
                  <h4 className="text-sm font-bold">Instruções de Apontamento</h4>
                </div>
                <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
                  Para ativar um domínio, configure os seguintes registros no provedor do cliente (Registro.br, Cloudflare, etc):
                </p>
                <div className="space-y-2 text-xs font-mono bg-white dark:bg-slate-950 p-3 rounded border border-blue-100 dark:border-blue-800/30">
                  <div className="flex justify-between"><span className="font-bold">Tipo: A</span> <span>Nome: @</span> <span>Valor: 76.76.21.21</span></div>
                  <div className="flex justify-between"><span className="font-bold">Tipo: CNAME</span> <span>Nome: www</span> <span>Valor: cname.vercel-dns.com</span></div>
                </div>
              </div>

              {/* Domínio Principal */}
              {selectedCompany.domain && (
                <div className="border border-border rounded-2xl overflow-hidden">
                  <div className="bg-muted/30 p-4 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Domínio Principal</p>
                      <p className="text-base font-black text-foreground">{selectedCompany.domain}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${getDomainStatusClasses(selectedCompany.domain_status)}`}>
                      {getDomainStatusLabel(selectedCompany.domain_status)}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground">Alterar Status:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateDomainStatus(selectedCompany.id, 'primary', 'active')}
                        disabled={isUpdating || selectedCompany.domain_status === 'active'}
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      >
                        Marcar como Ativo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateDomainStatus(selectedCompany.id, 'primary', 'error')}
                        disabled={isUpdating || selectedCompany.domain_status === 'error'}
                        className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                      >
                        Sinalizar Erro
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateDomainStatus(selectedCompany.id, 'primary', 'pending')}
                        disabled={isUpdating || selectedCompany.domain_status === 'pending'}
                        className="col-span-2 bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100 dark:bg-amber-950/30 dark:text-amber-400 dark:border-amber-800"
                      >
                        Voltar para Pendente
                      </Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Domínio Secundário */}
              {selectedCompany.domain_secondary && (
                <div className="border border-border rounded-2xl overflow-hidden">
                  <div className="bg-muted/30 p-4 border-b border-border flex items-center justify-between">
                    <div>
                      <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Domínio Secundário (Upsell)</p>
                      <p className="text-base font-black text-foreground">{selectedCompany.domain_secondary}</p>
                    </div>
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${getDomainStatusClasses(selectedCompany.domain_secondary_status)}`}>
                      {getDomainStatusLabel(selectedCompany.domain_secondary_status)}
                    </span>
                  </div>
                  <div className="p-4 space-y-3">
                    <p className="text-xs font-bold text-muted-foreground">Alterar Status:</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateDomainStatus(selectedCompany.id, 'secondary', 'active')}
                        disabled={isUpdating || selectedCompany.domain_secondary_status === 'active'}
                        className="bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100 dark:bg-emerald-950/30 dark:text-emerald-400 dark:border-emerald-800"
                      >
                        Marcar como Ativo
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateDomainStatus(selectedCompany.id, 'secondary', 'error')}
                        disabled={isUpdating || selectedCompany.domain_secondary_status === 'error'}
                        className="bg-red-50 text-red-700 border-red-200 hover:bg-red-100 dark:bg-red-950/30 dark:text-red-400 dark:border-red-800"
                      >
                        Sinalizar Erro
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => updateDomainStatus(selectedCompany.id, 'secondary', 'idle')}
                        disabled={isUpdating || selectedCompany.domain_secondary_status === 'idle'}
                        className="col-span-2 bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700"
                      >
                        Marcar como Ocioso
                      </Button>
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
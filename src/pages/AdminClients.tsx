import React, { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';

export default function AdminClients() {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchClients();
  }, []);

  const fetchClients = async () => {
    try {
      // Busca leads que têm contratos associados (Inner Join)
      const { data, error } = await supabase
        .from('leads')
        .select(`
          id, name, email, phone, cpf, asaas_customer_id,
          contracts!inner(id, type, status, property_id, properties(title))
        `)
        .order('name');

      if (error) throw error;

      setClients(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-8">
        <h1 className="flex items-center gap-3 text-3xl font-black text-slate-900 dark:text-white">
          <Icons.Users className="text-brand-500" size={32} /> Carteira de Clientes
        </h1>
        <p className="mt-2 text-slate-500">Lista exclusiva de clientes com contratos ativos ou finalizados.</p>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <Icons.Loader2 className="animate-spin text-brand-500" size={40} />
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm dark:border-dark-border dark:bg-dark-card">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-dark-border dark:bg-white/5">
                  <th className="p-4 text-xs font-bold uppercase text-slate-500">Cliente</th>
                  <th className="p-4 text-xs font-bold uppercase text-slate-500">Contactos</th>
                  <th className="p-4 text-xs font-bold uppercase text-slate-500">Contratos Associados</th>
                  <th className="p-4 text-right text-xs font-bold uppercase text-slate-500">Acções</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-dark-border">
                {clients.map((client) => (
                  <tr key={client.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-white/5">
                    <td className="p-4">
                      <p className="font-bold text-slate-900 dark:text-white">{client.name}</p>
                      <p className="mt-1 text-xs text-slate-500">CPF/CNPJ: {client.cpf || 'Não informado'}</p>
                      {client.asaas_customer_id && (
                        <span className="mt-2 inline-flex items-center gap-1 rounded border border-indigo-100 bg-indigo-50 px-2 py-0.5 text-[10px] font-bold text-indigo-600 dark:border-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400">
                          <Icons.CreditCard size={10} /> Sincronizado Asaas
                        </span>
                      )}
                    </td>
                    <td className="p-4">
                      <p className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Icons.Phone size={14} className="text-slate-400" /> {client.phone}
                      </p>
                      <p className="mt-1 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                        <Icons.Mail size={14} className="text-slate-400" /> {client.email}
                      </p>
                    </td>
                    <td className="p-4">
                      <div className="space-y-2">
                        {client.contracts?.map((c: any) => (
                          <div key={c.id} className="flex items-center gap-2 text-sm">
                            <span className={`h-2 w-2 rounded-full ${c.status === 'active' ? 'bg-emerald-500' : 'bg-slate-400'}`}></span>
                            <span className="line-clamp-1 font-medium text-slate-700 dark:text-slate-300">
                              {c.properties?.title || 'Imóvel Excluído'}
                            </span>
                          </div>
                        ))}
                      </div>
                    </td>
                    <td className="p-4 text-right">
                      <button className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-bold text-slate-700 transition-colors hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700">
                        Ver Perfil
                      </button>
                    </td>
                  </tr>
                ))}
                {clients.length === 0 && (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-slate-500">
                      Nenhum cliente com contrato fechado ainda.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

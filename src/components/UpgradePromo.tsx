import React, { useState } from 'react';
import { Icons } from './Icons';
import { useTenant } from '../contexts/TenantContext';
import { useNavigate } from 'react-router-dom';

export default function UpgradePromo() {
  const { tenant } = useTenant();
  const navigate = useNavigate();
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible || !tenant) return null;

  const contract = tenant as any;

  // Se for ativo ou trial, não mostra banner de alerta
  if (contract?.status === 'active' || contract?.status === 'trial') return null;

  // CENÁRIO 1: Inadimplente (Fatura Atrasada)
  if (contract?.status === 'past_due') {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-8 rounded-r-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-red-100 dark:bg-red-900/50 p-2 rounded-lg shrink-0 mt-1 md:mt-0">
            <Icons.AlertCircle className="text-red-600 dark:text-red-400" size={24} />
          </div>
          <div>
            <h4 className="text-red-800 dark:text-red-300 font-bold">Pagamento Pendente</h4>
            <p className="text-sm text-red-600 dark:text-red-400 mt-0.5">
              Não conseguimos processar o pagamento da sua assinatura. Regularize agora para evitar a suspensão do acesso.
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={() => navigate('/admin/config')}
            className="flex-1 md:flex-none bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
          >
            Regularizar
          </button>
        </div>
      </div>
    );
  }

  // CENÁRIO 2: Cancelado mas no Grace Period
  if (contract?.status === 'canceled') {
    return (
      <div className="bg-amber-50 dark:bg-amber-900/20 border-l-4 border-amber-500 p-4 mb-8 rounded-r-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-fade-in shadow-sm">
        <div className="flex items-start gap-3">
          <div className="bg-amber-100 dark:bg-amber-900/50 p-2 rounded-lg shrink-0 mt-1 md:mt-0">
            <Icons.Info className="text-amber-600 dark:text-amber-400" size={24} />
          </div>
          <div>
            <h4 className="text-amber-800 dark:text-amber-300 font-bold">Assinatura Cancelada</h4>
            <p className="text-sm text-amber-700 dark:text-amber-400 mt-0.5">
              Você tem acesso garantido até <strong className="font-bold">{contract?.end_date ? new Date(contract.end_date).toLocaleDateString('pt-BR') : 'o final do ciclo'}</strong>. Sentiu saudade?
            </p>
          </div>
        </div>
        <div className="flex gap-2 w-full md:w-auto shrink-0">
          <button
            onClick={() => navigate('/admin/config')}
            className="flex-1 md:flex-none bg-amber-500 hover:bg-amber-600 text-white px-6 py-2.5 rounded-xl text-sm font-bold transition-colors whitespace-nowrap"
          >
            Reativar Plano
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-2 text-amber-500 hover:bg-amber-100 dark:hover:bg-amber-900/50 rounded-lg transition-colors"
          >
            <Icons.X size={20} />
          </button>
        </div>
      </div>
    );
  }

  return null;
}

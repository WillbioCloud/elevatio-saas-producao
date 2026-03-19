import React from 'react';

interface FidelityTermsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAccept: () => void;
  companyName: string;
  ownerName: string;
  document: string;
}

const FidelityTermsModal: React.FC<FidelityTermsModalProps> = ({
  isOpen,
  onClose,
  onAccept,
  companyName,
  ownerName,
  document,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
      <div className="w-full max-w-3xl bg-white dark:bg-dark-card border border-slate-200 dark:border-dark-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-200 dark:border-dark-border">
          <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">
            TERMO DE ADESÃO COM CLÁUSULA DE FIDELIDADE
          </h3>
        </div>

        <div className="px-6 py-5 max-h-[65vh] overflow-y-auto space-y-4 text-sm leading-relaxed text-slate-700 dark:text-slate-300">
          <p><strong>CONTRATADA:</strong> Elevatio Vendas SaaS.</p>
          <p>
            <strong>CONTRATANTE:</strong> {companyName || 'Não informado'}, inscrita no CPF/CNPJ{' '}
            {document || 'Não informado'}, neste ato representada por {ownerName || 'Não informado'}.
          </p>

          <p>
            <strong>Cláusula 1.</strong> O presente termo estabelece a concessão de 10% de desconto na
            mensalidade do plano escolhido, mediante a permanência mínima obrigatória de 12 (doze) meses.
          </p>

          <p>
            <strong>Cláusula 2.</strong> Em caso de cancelamento antecipado, será cobrada uma multa
            rescisória equivalente a 30% (trinta por cento) do valor correspondente aos meses restantes
            para o término do período de fidelidade.
          </p>

          <p>
            <strong>Cláusula 3.</strong> O aceite eletrônico deste termo possui validade jurídica
            equivalente a uma assinatura física.
          </p>
        </div>

        <div className="px-6 py-4 border-t border-slate-200 dark:border-dark-border bg-slate-50/80 dark:bg-slate-900/30 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl font-bold bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-100 transition-colors"
          >
            Cancelar
          </button>
          <button
            onClick={onAccept}
            className="px-4 py-2.5 rounded-xl font-bold bg-brand-600 hover:bg-brand-700 text-white transition-colors"
          >
            Li e Aceito os Termos
          </button>
        </div>
      </div>
    </div>
  );
};

export default FidelityTermsModal;
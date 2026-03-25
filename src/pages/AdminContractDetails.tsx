import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';
import { useToast } from '../contexts/ToastContext';

const AdminContractDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToast } = useToast();
  
  const [contract, setContract] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [isGeneratingInvoices, setIsGeneratingInvoices] = useState(false);
  
  const [activeTab, setActiveTab] = useState<'finance' | 'vistoria'>('finance');
  const [vistoriaList, setVistoriaList] = useState<any[]>([]);
  const [savingVistoria, setSavingVistoria] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const [keysStatus, setKeysStatus] = useState('na_imobiliaria');
  const [keysNotes, setKeysNotes] = useState('');
  const [isUpdatingKeys, setIsUpdatingKeys] = useState(false);

  const handleFinalizeContract = async () => {
    if (!window.confirm('CUIDADO: Tem certeza que deseja encerrar/dar baixa neste contrato? O imóvel associado será marcado como "Inativo" e oculto do sistema.')) return;

    setFinalizing(true);
    try {
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .update({ status: 'archived' })
        .eq('id', id)
        .select();

      if (contractError) throw contractError;
      if (!contractData || contractData.length === 0) throw new Error('Acesso negado: O contrato não pôde ser atualizado. Verifique as permissões (RLS).');

      if (contract.property_id) {
        const { error: propError } = await supabase
          .from('properties')
          .delete()
          .eq('id', contract.property_id);

        if (propError) throw new Error('Erro ao deletar imóvel do banco: ' + propError.message);
      }

      alert('Contrato e Imóvel finalizados com sucesso!');
      fetchContractData();
      navigate('/admin/contratos');
    } catch (error: any) {
      alert('Erro ao finalizar: ' + error.message);
    } finally {
      setFinalizing(false);
    }
  };

  const fetchContractData = async () => {
    setLoading(true);
    
    let contractQuery = supabase
      .from('contracts')
      .select('*, lead:leads(name, phone, email), property:properties(title), broker:profiles(name)')
      .eq('id', id);
    
    // Multi-Tenant: Filtra por company_id se não for admin
    if (user?.role !== 'admin' && user?.company_id) {
      contractQuery = contractQuery.eq('company_id', user.company_id);
    }
    
    const { data: contractData } = await contractQuery.single();

    if (contractData) {
      setContract(contractData);
      setVistoriaList(contractData.vistoria_items || []);
      setKeysStatus(contractData.keys_status || 'na_imobiliaria');
      setKeysNotes(contractData.keys_notes || '');
    }

    let installmentsQuery = supabase
      .from('installments')
      .select('*')
      .eq('contract_id', id)
      .order('due_date', { ascending: true });
    
    if (user?.role !== 'admin' && user?.company_id) {
      installmentsQuery = installmentsQuery.eq('company_id', user.company_id);
    }

    const { data: installmentsData } = await installmentsQuery;

    if (installmentsData) setInstallments(installmentsData);
    setLoading(false);
  };

  useEffect(() => {
    if (id) fetchContractData();
  }, [id]);

  const handleGenerateInstallment = async () => {
    const value = prompt('Qual o valor da parcela? (Ex: 1500)');
    if (!value) return;
    
    const dueDate = prompt('Qual a data de vencimento? (Formato: AAAA-MM-DD)');
    if (!dueDate) return;

    setGenerating(true);
    const { error } = await supabase.from('installments').insert([{
      contract_id: id,
      company_id: user?.company_id,
      type: contract?.type === 'rent' ? 'rent_monthly' : 'monthly',
      amount: Number(value),
      due_date: dueDate,
      status: 'pending',
      installment_number: installments.length + 1
    }]);

    if (error) alert('Erro ao gerar parcela: ' + error.message);
    else fetchContractData();
    setGenerating(false);
  };

  const handleMarkAsPaid = async (instId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'paid' ? 'pending' : 'paid';
    const paidDate = newStatus === 'paid' ? new Date().toISOString().split('T')[0] : null;

    const { error } = await supabase
      .from('installments')
      .update({ status: newStatus, paid_date: paidDate })
      .eq('id', instId);

    if (!error) fetchContractData();
  };

  const handleSendWhatsAppReminder = (inst: any) => {
    if (!contract?.lead?.phone) {
      alert('O cliente não possui um telefone válido cadastrado.');
      return;
    }

    const cleanPhone = contract.lead.phone.replace(/\D/g, '');
    const firstName = contract.lead.name?.split(' ')[0] || 'Cliente';
    const valueFormatted = Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
    const dateFormatted = new Date(inst.due_date).toLocaleDateString('pt-BR');

    const isOverdue = new Date(inst.due_date) < new Date() && inst.status !== 'paid';

    let text = '';
    if (isOverdue) {
      text = `Olá ${firstName}, tudo bem? Aqui é da imobiliária. Consta em nosso sistema uma parcela em aberto no valor de *${valueFormatted}*, referente ao imóvel *${contract.property?.title}*, com vencimento original em *${dateFormatted}*. Como podemos ajudar para regularizar?`;
    } else {
      text = `Olá ${firstName}, tudo bem? Aqui é da imobiliária. Passando para lembrar que a parcela de *${valueFormatted}* referente ao imóvel *${contract.property?.title}* vence no dia *${dateFormatted}*. Se já efetuou o pagamento, por favor, desconsidere esta mensagem!`;
    }

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const updateVistoriaItem = (index: number, field: string, value: any) => {
    const newList = [...vistoriaList];
    newList[index] = { ...newList[index], [field]: value };
    setVistoriaList(newList);
  };

  const handleSaveVistoria = async () => {
    setSavingVistoria(true);
    const { error } = await supabase
      .from('contracts')
      .update({ vistoria_items: vistoriaList })
      .eq('id', id);

    if (error) alert('Erro ao salvar vistoria.');
    else alert('Vistoria salva com sucesso!');
    setSavingVistoria(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Icons.Loader2 className="animate-spin text-brand-500" size={40} /></div>;
  if (!contract) return <div className="p-10 text-center text-slate-500 dark:text-slate-400">Contrato não encontrado.</div>;

  const isRent = contract.type === 'rent';
  const isCash = contract.sale_is_cash;

  const totalRepairCost = vistoriaList.reduce((acc, item) => acc + (Number(item.repair_cost) || 0), 0);
  const totalPaid = installments.filter(i => i.status === 'paid').reduce((acc, i) => acc + Number(i.amount), 0);
  const pendingInstallments = installments.filter(i => i.status !== 'paid');
  const remainingBalance = pendingInstallments.reduce((acc, i) => acc + Number(i.amount), 0);
  const remainingCount = pendingInstallments.length;

  const handleGenerateInvoices = async () => {
    // A duração real é a quantidade de parcelas já geradas
    const duration = installments.length;

    if (!contract || contract.type !== 'rent' || duration === 0) {
      alert('Contrato inválido ou sem parcelas geradas para converter em faturas.');
      return;
    }

    setIsGeneratingInvoices(true);
    try {
      // Mapeia as parcelas já existentes e transforma em Faturas (Invoices)
      const invoicesToInsert = installments.map((inst, index) => {
        return {
          company_id: contract.company_id,
          property_id: contract.property_id,
          contract_id: contract.id,
          client_name: contract.lead?.name || 'Inquilino',
          description: `Aluguel - Parcela ${index + 1}/${duration}`,
          amount: inst.amount,
          due_date: inst.due_date,
          status: 'pendente',
        };
      });

      const { error } = await supabase.from('invoices').insert(invoicesToInsert);
      if (error) {
        console.error("Erro do Supabase:", error);
        throw new Error(error.message);
      }

      alert(`${duration} faturas geradas com sucesso no Financeiro!`);
    } catch (error: any) {
      console.error('Erro ao gerar faturas:', error);
      alert('Erro ao gerar faturas: ' + error.message);
    } finally {
      setIsGeneratingInvoices(false);
    }
  };

  const handleUpdateKeys = async () => {
    setIsUpdatingKeys(true);
    try {
      const { error } = await supabase
        .from('contracts')
        .update({ keys_status: keysStatus, keys_notes: keysNotes })
        .eq('id', contract.id);
      if (error) throw error;
      addToast('Status das chaves atualizado com sucesso!', 'success');
    } catch (error: any) {
      console.error('Erro ao atualizar chaves:', error);
      addToast('Erro ao atualizar as chaves.', 'error');
    } finally {
      setIsUpdatingKeys(false);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-full border border-slate-200/60 dark:border-white/5 hover:bg-slate-50 dark:hover:bg-white/5 text-slate-500 dark:text-slate-400 transition-colors shadow-sm" title="Voltar para a tela anterior">
            <Icons.ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-serif font-bold tracking-tight text-slate-800 dark:text-white">
                Contrato #{contract.id.split('-')[0].toUpperCase()}
              </h1>
              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${isRent ? 'bg-indigo-100 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-400' : 'bg-brand-100 dark:bg-brand-500/10 text-brand-700 dark:text-brand-400'}`}>
                {isRent ? 'Locação' : 'Venda'} {isCash && '- À VISTA'}
              </span>
              {contract.status === 'archived' && (
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-slate-100 dark:bg-white/5 text-slate-500 dark:text-slate-400">
                  Encerrado
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Imóvel: {contract.property?.title}</p>
          </div>
        </div>

        {contract.status !== 'archived' && (
          <button
            onClick={handleFinalizeContract}
            disabled={finalizing}
            className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-colors flex items-center gap-2 disabled:opacity-50"
            title="Encerrar contrato e inativar o imóvel"
          >
            {finalizing ? <Icons.Loader2 size={16} className="animate-spin" /> : <Icons.CheckCircle size={16} />}
            Dar Baixa no Contrato
          </button>
        )}
      </div>

      {/* INTEGRAÇÃO FINANCEIRA */}
      {contract.type === 'rent' && (
        <div className="bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/20 rounded-2xl p-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div>
            <h3 className="text-lg font-bold text-emerald-800 dark:text-emerald-400 flex items-center gap-2">
              <Icons.Wallet size={20} /> Integração Financeira
            </h3>
            <p className="text-sm text-emerald-600 dark:text-emerald-500 mt-1">
              Gere as cobranças mensais deste contrato automaticamente no painel Financeiro.
            </p>
          </div>
          <button
            onClick={handleGenerateInvoices}
            disabled={isGeneratingInvoices || installments.length === 0}
            className="w-full flex items-center justify-center gap-2 px-4 py-4 bg-gradient-to-r from-brand-600 to-indigo-600 hover:from-brand-500 hover:to-indigo-500 text-white rounded-2xl font-bold transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
          >
            {isGeneratingInvoices ? <Icons.Loader2 size={20} className="animate-spin" /> : <Icons.Receipt size={20} />}
            {isGeneratingInvoices ? 'Processando Faturas...' : `Sincronizar ${installments.length} Faturas com o Financeiro`}
          </button>
        </div>
      )}

      {/* CARDS DE RESUMO GERAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Cliente e Prazos */}
        <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-400 dark:text-slate-500">
              <Icons.User size={16} /> <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase">Cliente</h3>
            </div>
            <p className="font-bold font-serif text-lg text-slate-800 dark:text-white">{contract.lead?.name}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{contract.lead?.phone}</p>
          </div>
          <div className="pt-4 border-t border-slate-100 dark:border-white/5 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Início</p>
              <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
            </div>
            {contract.end_date && (
              <div className="text-right">
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Vencimento</p>
                <p className="font-bold text-slate-700 dark:text-slate-300">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card Financeiro Principal */}
        <div className="lg:col-span-2 bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl p-6 rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none">
          <div className="flex items-center gap-2 mb-4 text-slate-400 dark:text-slate-500">
            <Icons.DollarSign size={16} /> <h3 className="font-bold text-slate-700 dark:text-slate-300 text-sm uppercase">Extrato do Contrato</h3>
          </div>
          
          {isRent ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Aluguel Base</p>
                <p className="font-bold font-serif text-xl text-indigo-600 dark:text-indigo-400">{Number(contract.rent_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Condomínio</p>
                <p className="font-bold font-serif text-lg text-slate-700 dark:text-slate-300">{Number(contract.condo_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">IPTU</p>
                <p className="font-bold font-serif text-lg text-slate-700 dark:text-slate-300">{Number(contract.iptu_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Garantia</p>
                <p className="font-bold text-sm text-slate-700 dark:text-slate-300 mt-1 uppercase">{String(contract.rent_guarantee_type).replace('_', ' ')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-slate-100 dark:border-white/5 pb-4">
                <div>
                  <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Valor Total do Imóvel</p>
                  <p className="font-bold font-serif text-3xl text-emerald-600 dark:text-emerald-400">{Number(contract.sale_total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                {isCash ? (
                  <div className="text-right">
                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-end"><Icons.CheckCircle size={14}/> Pago à vista</p>
                    <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{contract.sale_payment_method}</p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-xs text-slate-400 dark:text-slate-500 uppercase">Saldo Devedor (Faltante)</p>
                    <p className="font-bold font-serif text-2xl text-amber-500">{remainingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-medium mt-1">Faltam {remainingCount} parcela(s)</p>
                  </div>
                )}
              </div>
              
              {!isCash && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50/50 dark:bg-white/[0.02] p-4 rounded-xl">
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Sinal / Entrada</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.sale_down_payment || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Financiamento</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.sale_financing_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Consórcio</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.sale_consortium_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold">Permuta</p>
                    <p className="font-bold font-serif text-slate-700 dark:text-slate-300">{Number(contract.permutation_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS (RECEBÍVEIS X VISTORIA) */}
      <div className="flex gap-6 border-b border-slate-200/60 dark:border-white/5">
        <button
          onClick={() => setActiveTab('finance')}
          className={`pb-4 px-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
            activeTab === 'finance' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
          }`}
        >
          <Icons.List size={18} /> Parcelas e Recebíveis
        </button>
        {isRent && (
          <button
            onClick={() => setActiveTab('vistoria')}
            className={`pb-4 px-2 text-sm font-bold transition-all border-b-2 flex items-center gap-2 ${
              activeTab === 'vistoria' ? 'border-brand-500 text-brand-600 dark:text-brand-400' : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300'
            }`}
          >
            <Icons.CheckSquare size={18} /> Vistoria e Avarias
          </button>
        )}
      </div>

      {/* ABA: FINANCEIRO */}
      {activeTab === 'finance' && (
        <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 flex justify-between items-center bg-slate-50/50 dark:bg-white/[0.02]">
            <div>
              <h2 className="text-lg font-bold font-serif text-slate-800 dark:text-white flex items-center gap-2">Cronograma de Pagamentos</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400">Valor total já recebido: <strong className="text-emerald-600 dark:text-emerald-400">{totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
            </div>
            <button 
              onClick={handleGenerateInstallment}
              disabled={generating}
              className="bg-slate-900 dark:bg-white/10 hover:bg-slate-800 dark:hover:bg-white/20 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
              <Icons.Plus size={16} /> Nova Parcela/Boleto
            </button>
          </div>

          {installments.length === 0 ? (
            <div className="p-10 text-center">
              <Icons.Receipt className="mx-auto text-slate-300 dark:text-slate-600 mb-3" size={40} />
              <p className="text-slate-500 dark:text-slate-400 font-medium">Nenhuma parcela gerada.</p>
              {isCash && <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2 font-bold">A venda foi à vista, não há parcelas futuras.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white dark:bg-[#0a0f1c] border-b border-slate-100 dark:border-white/5 text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400 font-bold">
                    <th className="p-4">Descrição</th>
                    <th className="p-4">Vencimento</th>
                    <th className="p-4">Valor</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-white/5 text-sm">
                  {installments.map((inst, index) => (
                    <tr key={inst.id} className="hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                      <td className="p-4 font-bold font-serif text-slate-700 dark:text-slate-300">
                        {inst.installment_number ? `${inst.installment_number}ª Parcela` : `Parcela Extra`}
                      </td>
                      <td className="p-4 text-slate-600 dark:text-slate-400">
                        {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 font-bold font-serif text-slate-800 dark:text-white">
                        {Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-4">
                        {inst.status === 'paid' ? (
                          <span className="bg-emerald-100 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><Icons.CheckCircle size={12} /> Pago</span>
                        ) : new Date(inst.due_date) < new Date() ? (
                          <span className="bg-red-100 dark:bg-red-500/10 text-red-700 dark:text-red-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><Icons.AlertCircle size={12} /> Atrasado</span>
                        ) : (
                          <span className="bg-amber-100 dark:bg-amber-500/10 text-amber-700 dark:text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><Icons.Clock size={12} /> Pendente</span>
                        )}
                      </td>
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center gap-2">
                          {inst.status !== 'paid' && (
                            <button
                              onClick={() => handleSendWhatsAppReminder(inst)}
                              title="Cobrar via WhatsApp"
                              className="p-2 rounded-lg border border-[#25D366]/30 bg-[#25D366]/10 text-[#25D366] hover:bg-[#25D366] hover:text-white transition-colors"
                            >
                              <Icons.MessageCircle size={16} />
                            </button>
                          )}
                          <button
                            onClick={() => handleMarkAsPaid(inst.id, inst.status)}
                            className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-all ${
                              inst.status === 'paid' ? 'border-slate-200 dark:border-white/10 text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5' : 'border-emerald-200 dark:border-emerald-500/20 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20'
                            }`}
                          >
                            {inst.status === 'paid' ? 'Desfazer' : 'Dar Baixa'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ABA: VISTORIA (APENAS ALUGUEL) */}
      {activeTab === 'vistoria' && isRent && (
        <div className="bg-white/80 dark:bg-[#0a0f1c]/80 backdrop-blur-xl rounded-3xl border border-slate-200/60 dark:border-white/5 shadow-[0_8px_30px_rgba(0,0,0,0.04)] dark:shadow-none overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/[0.02] flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold font-serif text-slate-800 dark:text-white">Checklist de Saída (Vistoria)</h2>
              <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">Marque avarias encontradas no final do contrato para deduzir do Caução.</p>
            </div>
            <div className="text-right bg-white dark:bg-[#0a0f1c] p-3 rounded-xl border border-slate-200 dark:border-white/5 shadow-sm">
              <p className="text-xs text-slate-500 dark:text-slate-400 uppercase font-bold">Total a Deduzir</p>
              <p className="text-xl font-bold font-serif text-red-500">
                {totalRepairCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {vistoriaList.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-slate-50/50 dark:bg-white/[0.02] rounded-xl border border-slate-100 dark:border-white/5">
                <div className="md:col-span-5 font-bold font-serif text-slate-700 dark:text-slate-300">{item.item}</div>
                
                <div className="md:col-span-4 flex items-center gap-3">
                  <select 
                    value={item.status} 
                    onChange={(e) => updateVistoriaItem(idx, 'status', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none ${
                      item.status === 'ok' ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-500/20' : 'bg-red-50 dark:bg-red-500/10 text-red-700 dark:text-red-400 border-red-200 dark:border-red-500/20'
                    }`}
                  >
                    <option value="ok">✅ Inteiro / Sem Avarias</option>
                    <option value="damaged">❌ Avariado / Sujo</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 text-sm">R$</span>
                    <input 
                      type="number" 
                      value={item.repair_cost}
                      disabled={item.status === 'ok'}
                      onChange={(e) => updateVistoriaItem(idx, 'repair_cost', Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 dark:border-white/10 bg-white dark:bg-[#0a0f1c] text-slate-800 dark:text-white outline-none focus:border-brand-500 text-sm disabled:opacity-50 disabled:bg-slate-100 dark:disabled:bg-white/5"
                      placeholder="Custo..."
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-6 mt-4 border-t border-slate-100 dark:border-white/5 flex justify-end">
              <button 
                onClick={handleSaveVistoria}
                disabled={savingVistoria}
                className="bg-gradient-to-r from-brand-600 to-sky-500 hover:shadow-lg text-white px-6 py-2.5 rounded-xl font-bold transition-all disabled:opacity-50 flex items-center gap-2"
              >
                {savingVistoria ? 'Salvando...' : 'Salvar Vistoria'} <Icons.Save size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GESTÃO DE CHAVES */}
      <div className="bg-white dark:bg-dark-card rounded-2xl border border-slate-200 dark:border-dark-border p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Icons.Key size={20} />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800 dark:text-white">Gestão de Chaves</h2>
            <p className="text-sm text-slate-500">Controlo de entrega/devolução</p>
          </div>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Localização Atual</label>
            <div className="grid grid-cols-1 gap-2">
              <button
                onClick={() => setKeysStatus('na_imobiliaria')}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${keysStatus === 'na_imobiliaria' ? 'border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-400' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-white/5 dark:text-slate-400'}`}
              >
                <Icons.Building size={16} /> Na Imobiliária (Quadro)
              </button>
              <button
                onClick={() => setKeysStatus('com_inquilino')}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${keysStatus === 'com_inquilino' ? 'border-green-500 bg-green-50 text-green-700 dark:bg-green-500/10 dark:text-green-400' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-white/5 dark:text-slate-400'}`}
              >
                <Icons.UserCheck size={16} /> Entregues ao Inquilino
              </button>
              <button
                onClick={() => setKeysStatus('devolvidas')}
                className={`flex items-center gap-2 p-3 rounded-xl border transition-all text-sm font-medium ${keysStatus === 'devolvidas' ? 'border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-400' : 'border-slate-200 bg-slate-50 text-slate-600 hover:bg-slate-100 dark:border-dark-border dark:bg-white/5 dark:text-slate-400'}`}
              >
                <Icons.Archive size={16} /> Devolvidas (Rescisão)
              </button>
            </div>
          </div>
          <div>
            <label className="block text-sm font-bold text-slate-700 dark:text-slate-300 mb-2">Observações (Cópias, comandos, etc.)</label>
            <textarea
              value={keysNotes}
              onChange={(e) => setKeysNotes(e.target.value)}
              placeholder="Ex: Entregue 2 cópias da porta principal e 1 comando da garagem."
              className="w-full px-4 py-3 rounded-xl border border-slate-200 dark:border-dark-border bg-slate-50 dark:bg-white/5 focus:ring-2 focus:ring-brand-500 outline-none text-sm min-h-[100px] resize-none"
            />
          </div>
          <button
            onClick={handleUpdateKeys}
            disabled={isUpdatingKeys || (keysStatus === contract.keys_status && keysNotes === (contract.keys_notes || ''))}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 hover:bg-slate-800 dark:bg-brand-600 dark:hover:bg-brand-700 text-white rounded-xl font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUpdatingKeys ? <Icons.Loader2 size={18} className="animate-spin" /> : <Icons.Save size={18} />}
            Salvar Registo de Chaves
          </button>
        </div>
      </div>

    </div>
  );
};

export default AdminContractDetails;

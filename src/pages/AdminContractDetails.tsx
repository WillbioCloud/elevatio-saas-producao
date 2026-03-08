import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Icons } from '../components/Icons';
import { useAuth } from '../contexts/AuthContext';

const AdminContractDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [contract, setContract] = useState<any>(null);
  const [installments, setInstallments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  
  // Novos estados para Abas e Vistoria
  const [activeTab, setActiveTab] = useState<'finance' | 'vistoria'>('finance');
  const [vistoriaList, setVistoriaList] = useState<any[]>([]);
  const [savingVistoria, setSavingVistoria] = useState(false);
  const [finalizing, setFinalizing] = useState(false);

  const handleFinalizeContract = async () => {
    if (!window.confirm('CUIDADO: Tem certeza que deseja encerrar/dar baixa neste contrato? O imóvel associado será marcado como "Inativo" e oculto do sistema.')) return;

    setFinalizing(true);
    try {
      // 1. Arquiva/Finaliza o contrato
      const { data: contractData, error: contractError } = await supabase
        .from('contracts')
        .update({ status: 'archived' })
        .eq('id', id)
        .select();

      if (contractError) throw contractError;
      if (!contractData || contractData.length === 0) throw new Error('Acesso negado: O contrato não pôde ser atualizado. Verifique as permissões (RLS).');

      // 2. EXCLUI o imóvel do banco de dados permanentemente para limpar espaço
      if (contract.property_id) {
        const { error: propError } = await supabase
          .from('properties')
          .delete()
          .eq('id', contract.property_id);

        if (propError) throw new Error('Erro ao deletar imóvel do banco: ' + propError.message);
      }

      alert('Contrato e Imóvel finalizados com sucesso!');
      fetchContractData();
      navigate('/admin/contratos'); // Volta para a lista
    } catch (error: any) {
      alert('Erro ao finalizar: ' + error.message);
    } finally {
      setFinalizing(false);
    }
  };

  const fetchContractData = async () => {
    setLoading(true);
    const { data: contractData } = await supabase
      .from('contracts')
      .select('*, lead:leads(name, phone, email), property:properties(title), broker:profiles(name)')
      .eq('id', id)
      .single();

    if (contractData) {
      setContract(contractData);
      setVistoriaList(contractData.vistoria_items || []);
    }

    const { data: installmentsData } = await supabase
      .from('installments')
      .select('*')
      .eq('contract_id', id)
      .order('due_date', { ascending: true });

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
      type: contract?.type === 'rent' ? 'rent_monthly' : 'monthly',
      amount: Number(value),
      due_date: dueDate,
      status: 'pending',
      installment_number: installments.length + 1,
      company_id: user?.company_id,
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

    // Verifica se está atrasado (data menor que hoje e não está pago)
    const isOverdue = new Date(inst.due_date) < new Date() && inst.status !== 'paid';

    let text = '';
    if (isOverdue) {
      text = `Olá ${firstName}, tudo bem? Aqui é da imobiliária. Consta em nosso sistema uma parcela em aberto no valor de *${valueFormatted}*, referente ao imóvel *${contract.property?.title}*, com vencimento original em *${dateFormatted}*. Como podemos ajudar para regularizar?`;
    } else {
      text = `Olá ${firstName}, tudo bem? Aqui é da imobiliária. Passando para lembrar que a parcela de *${valueFormatted}* referente ao imóvel *${contract.property?.title}* vence no dia *${dateFormatted}*. Se já efetuou o pagamento, por favor, desconsidere esta mensagem!`;
    }

    window.open(`https://wa.me/55${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  // Gerenciamento da Vistoria
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
  if (!contract) return <div className="p-10 text-center text-slate-500">Contrato não encontrado.</div>;

  const isRent = contract.type === 'rent';
  const isCash = contract.sale_is_cash;

  // Cálculos visuais
  const totalRepairCost = vistoriaList.reduce((acc, item) => acc + (Number(item.repair_cost) || 0), 0);
  const totalPaid = installments.filter(i => i.status === 'paid').reduce((acc, i) => acc + Number(i.amount), 0);
  const pendingInstallments = installments.filter(i => i.status !== 'paid');
  const remainingBalance = pendingInstallments.reduce((acc, i) => acc + Number(i.amount), 0);
  const remainingCount = pendingInstallments.length;

  return (
    <div className="space-y-6 animate-fade-in pb-10">
      
      {/* HEADER PRINCIPAL */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full border border-slate-200 hover:bg-slate-50 text-slate-500 transition-colors" title="Voltar para a tela anterior">
            <Icons.ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-serif font-bold text-slate-800">
                Contrato #{contract.id.split('-')[0].toUpperCase()}
              </h1>
              <span className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full ${isRent ? 'bg-indigo-100 text-indigo-700' : 'bg-brand-100 text-brand-700'}`}>
                {isRent ? 'Locação' : 'Venda'} {isCash && '- À VISTA'}
              </span>
              {contract.status === 'archived' && (
                <span className="px-3 py-1 text-[10px] font-bold uppercase tracking-wider rounded-full bg-slate-100 text-slate-500">
                  Encerrado
                </span>
              )}
            </div>
            <p className="text-sm text-slate-500 mt-1">Imóvel: {contract.property?.title}</p>
          </div>
        </div>

        {/* BOTÃO DE FINALIZAÇÃO */}
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

      {/* CARDS DE RESUMO GERAL */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Card Cliente e Prazos */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div>
            <div className="flex items-center gap-2 mb-2 text-slate-400">
              <Icons.User size={16} /> <h3 className="font-bold text-slate-700 text-sm uppercase">Cliente</h3>
            </div>
            <p className="font-bold text-lg text-slate-800">{contract.lead?.name}</p>
            <p className="text-sm text-slate-500">{contract.lead?.phone}</p>
          </div>
          <div className="pt-4 border-t border-slate-100 flex justify-between items-center">
            <div>
              <p className="text-xs text-slate-400 uppercase">Início</p>
              <p className="font-bold text-slate-700">{new Date(contract.start_date).toLocaleDateString('pt-BR')}</p>
            </div>
            {contract.end_date && (
              <div className="text-right">
                <p className="text-xs text-slate-400 uppercase">Vencimento</p>
                <p className="font-bold text-slate-700">{new Date(contract.end_date).toLocaleDateString('pt-BR')}</p>
              </div>
            )}
          </div>
        </div>

        {/* Card Financeiro Principal */}
        <div className="lg:col-span-2 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex items-center gap-2 mb-4 text-slate-400">
            <Icons.DollarSign size={16} /> <h3 className="font-bold text-slate-700 text-sm uppercase">Extrato do Contrato</h3>
          </div>
          
          {isRent ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase">Aluguel Base</p>
                <p className="font-bold text-xl text-indigo-600">{Number(contract.rent_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Condomínio</p>
                <p className="font-bold text-lg text-slate-700">{Number(contract.condo_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">IPTU</p>
                <p className="font-bold text-lg text-slate-700">{Number(contract.iptu_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">Garantia</p>
                <p className="font-bold text-sm text-slate-700 mt-1 uppercase">{String(contract.rent_guarantee_type).replace('_', ' ')}</p>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex justify-between items-end border-b border-slate-100 pb-4">
                <div>
                  <p className="text-xs text-slate-400 uppercase">Valor Total do Imóvel</p>
                  <p className="font-bold text-3xl text-emerald-600">{Number(contract.sale_total_value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                </div>
                {isCash ? (
                  <div className="text-right">
                    <p className="text-xs text-emerald-500 font-bold uppercase tracking-wider mb-1 flex items-center gap-1 justify-end"><Icons.CheckCircle size={14}/> Pago à vista</p>
                    <p className="text-sm font-bold text-slate-700">{contract.sale_payment_method}</p>
                  </div>
                ) : (
                  <div className="text-right">
                    <p className="text-xs text-slate-400 uppercase">Saldo Devedor (Faltante)</p>
                    <p className="font-bold text-2xl text-amber-500">{remainingBalance.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                    <p className="text-xs text-slate-500 font-medium mt-1">Faltam {remainingCount} parcela(s)</p>
                  </div>
                )}
              </div>
              
              {!isCash && (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-slate-50 p-4 rounded-xl">
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Sinal / Entrada</p>
                    <p className="font-bold text-slate-700">{Number(contract.sale_down_payment || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Financiamento</p>
                    <p className="font-bold text-slate-700">{Number(contract.sale_financing_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Consórcio</p>
                    <p className="font-bold text-slate-700">{Number(contract.sale_consortium_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold">Permuta</p>
                    <p className="font-bold text-slate-700">{Number(contract.permutation_value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* NAVEGAÇÃO DE ABAS (RECEBÍVEIS X VISTORIA) */}
      <div className="flex gap-6 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('finance')}
          className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
            activeTab === 'finance' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <Icons.List size={18} /> Parcelas e Recebíveis
        </button>
        {isRent && (
          <button
            onClick={() => setActiveTab('vistoria')}
            className={`pb-4 px-2 text-sm font-bold transition-colors border-b-2 flex items-center gap-2 ${
              activeTab === 'vistoria' ? 'border-brand-500 text-brand-600' : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            <Icons.CheckSquare size={18} /> Vistoria e Avarias
          </button>
        )}
      </div>

      {/* ABA: FINANCEIRO */}
      {activeTab === 'finance' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">Cronograma de Pagamentos</h2>
              <p className="text-sm text-slate-500">Valor total já recebido: <strong className="text-emerald-600">{totalPaid.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</strong></p>
            </div>
            <button 
              onClick={handleGenerateInstallment}
              disabled={generating}
              className="bg-slate-900 hover:bg-slate-800 text-white px-4 py-2 rounded-lg text-sm font-bold transition-colors flex items-center gap-2"
            >
              <Icons.Plus size={16} /> Nova Parcela/Boleto
            </button>
          </div>

          {installments.length === 0 ? (
            <div className="p-10 text-center">
              <Icons.Receipt className="mx-auto text-slate-300 mb-3" size={40} />
              <p className="text-slate-500 font-medium">Nenhuma parcela gerada.</p>
              {isCash && <p className="text-sm text-emerald-600 mt-2 font-bold">A venda foi à vista, não há parcelas futuras.</p>}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white border-b border-slate-100 text-xs uppercase tracking-wider text-slate-500 font-bold">
                    <th className="p-4">Descrição</th>
                    <th className="p-4">Vencimento</th>
                    <th className="p-4">Valor</th>
                    <th className="p-4">Status</th>
                    <th className="p-4 text-center">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-sm">
                  {installments.map((inst, index) => (
                    <tr key={inst.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-4 font-bold text-slate-700">
                        {inst.installment_number ? `${inst.installment_number}ª Parcela` : `Parcela Extra`}
                      </td>
                      <td className="p-4 text-slate-600">
                        {new Date(inst.due_date).toLocaleDateString('pt-BR')}
                      </td>
                      <td className="p-4 font-bold text-slate-800">
                        {Number(inst.amount).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </td>
                      <td className="p-4">
                        {inst.status === 'paid' ? (
                          <span className="bg-emerald-100 text-emerald-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><Icons.CheckCircle size={12} /> Pago</span>
                        ) : new Date(inst.due_date) < new Date() ? (
                          <span className="bg-red-100 text-red-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><Icons.AlertCircle size={12} /> Atrasado</span>
                        ) : (
                          <span className="bg-amber-100 text-amber-700 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 w-fit"><Icons.Clock size={12} /> Pendente</span>
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
                              inst.status === 'paid' ? 'border-slate-200 text-slate-500 hover:bg-slate-100' : 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
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
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in">
          <div className="p-6 border-b border-slate-100 bg-slate-50 flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-800">Checklist de Saída (Vistoria)</h2>
              <p className="text-sm text-slate-500 mt-1">Marque avarias encontradas no final do contrato para deduzir do Caução.</p>
            </div>
            <div className="text-right bg-white p-3 rounded-xl border border-slate-200 shadow-sm">
              <p className="text-xs text-slate-500 uppercase font-bold">Total a Deduzir</p>
              <p className="text-xl font-bold text-red-500">
                {totalRepairCost.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </p>
            </div>
          </div>

          <div className="p-6 space-y-4">
            {vistoriaList.map((item, idx) => (
              <div key={item.id} className="grid grid-cols-1 md:grid-cols-12 gap-4 items-center p-4 bg-slate-50 rounded-xl border border-slate-100">
                <div className="md:col-span-5 font-bold text-slate-700">{item.item}</div>
                
                <div className="md:col-span-4 flex items-center gap-3">
                  <select 
                    value={item.status} 
                    onChange={(e) => updateVistoriaItem(idx, 'status', e.target.value)}
                    className={`w-full px-3 py-2 rounded-lg border text-sm font-bold outline-none ${
                      item.status === 'ok' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'
                    }`}
                  >
                    <option value="ok">✅ Inteiro / Sem Avarias</option>
                    <option value="damaged">❌ Avariado / Sujo</option>
                  </select>
                </div>

                <div className="md:col-span-3">
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">R$</span>
                    <input 
                      type="number" 
                      value={item.repair_cost}
                      disabled={item.status === 'ok'}
                      onChange={(e) => updateVistoriaItem(idx, 'repair_cost', Number(e.target.value))}
                      className="w-full pl-8 pr-3 py-2 rounded-lg border border-slate-200 outline-none focus:border-brand-500 text-sm disabled:opacity-50 disabled:bg-slate-100"
                      placeholder="Custo..."
                    />
                  </div>
                </div>
              </div>
            ))}

            <div className="pt-6 mt-4 border-t border-slate-100 flex justify-end">
              <button 
                onClick={handleSaveVistoria}
                disabled={savingVistoria}
                className="bg-brand-600 hover:bg-brand-700 text-white px-6 py-2.5 rounded-xl font-bold transition-colors disabled:opacity-50 flex items-center gap-2"
              >
                {savingVistoria ? 'Salvando...' : 'Salvar Vistoria'} <Icons.Save size={18} />
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default AdminContractDetails;
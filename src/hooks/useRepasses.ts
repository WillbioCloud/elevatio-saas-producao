import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';

export interface Repasse {
  id: string;
  invoice_id: string;
  contract_id: string;
  property_title: string;
  owner_name: string;
  tenant_name: string;
  due_date: string;
  gross_value: number;
  admin_fee_percent: number;
  admin_fee_value: number;
  broker_fee_percent: number;
  broker_fee_value: number;
  net_value: number;
  status: 'pendente' | 'repassado';
}

export function useRepasses() {
  const { user } = useAuth();
  const [repasses, setRepasses] = useState<Repasse[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRepasses = useCallback(async () => {
    if (!user?.company_id) {
      setRepasses([]);
      setLoading(false);
      return;
    }

    setLoading(true);

    try {
      const { data: invoicesData, error } = await supabase
        .from('invoices')
        .select(`
          *,
          contract:contracts(
            *,
            property:properties(*),
            lead:leads(*)
          )
        `)
        .eq('company_id', user.company_id)
        .in('status', ['pago', 'Pago', 'PAID', 'paid', 'RECEIVED', 'RECEIVED_IN_CASH'])
        .order('due_date', { ascending: true });

      if (error) throw error;

      const processedRepasses: Repasse[] = ((invoicesData || []) as any[]).map((inv) => {
        const contract = Array.isArray(inv.contract) ? inv.contract[0] : inv.contract;
        const property = contract?.property
          ? (Array.isArray(contract.property) ? contract.property[0] : contract.property)
          : null;
        const lead = contract?.lead
          ? (Array.isArray(contract.lead) ? contract.lead[0] : contract.lead)
          : null;

        // 1. O que o Inquilino pagou de fato (Pode incluir a Caução)
        const grossValue = Number(inv.amount) || 0;

        // 2. Extrai os valores originais do Imóvel para formar a Base de Cálculo
        const propertyRent = Number(property?.price || 0);
        const propertyCondo = Number(property?.condominium || 0);
        const propertyIptu = Number(property?.iptu || 0);

        // O PACOTE MENSAL (Aluguel + Condomínio + IPTU)
        const basePackage = propertyRent + propertyCondo + propertyIptu;

        // Se por algum motivo o imóvel não tiver preço salvo, usamos o valor da fatura como fallback
        const calculationBase = basePackage > 0 ? basePackage : grossValue;

        // 3. Busca as taxas estipuladas no contrato
        const adminPercent = Number(contract?.admin_fee_percent) || 0;
        const brokerPercent = Number(contract?.broker_fee_percent) || 0;

        // 4. A MÁGICA: Calcula as comissões APENAS em cima do Pacote Mensal
        const adminFeeValue = (calculationBase * adminPercent) / 100;
        const brokerFeeValue = (calculationBase * brokerPercent) / 100;

        // 5. O Repasse Líquido do Dono é a fatia dele APENAS no Pacote Mensal
        // Obs: O que sobrar (grossValue - calculationBase) é a Caução, que ficará retida intocável na conta da Imobiliária.
        const netValue = calculationBase - adminFeeValue - brokerFeeValue;

        // Busca o nome do dono
        const finalOwnerName =
          contract?.lessor_name ||
          contract?.contract_data?.lessor_name ||
          contract?.owner_name ||
          property?.owner_name ||
          contract?.locador_nome ||
          contract?.contract_data?.locador_nome ||
          'Dono não informado';

        // Busca o nome do inquilino
        const finalTenantName =
          contract?.lessee_name ||
          contract?.contract_data?.lessee_name ||
          contract?.tenant_name ||
          lead?.name ||
          contract?.locatario_nome ||
          contract?.contract_data?.locatario_nome ||
          'Inquilino não informado';

        return {
          id: inv.id,
          invoice_id: inv.id,
          contract_id: String(contract?.id || ''),
          property_title: property?.title || 'Imóvel sem título',
          owner_name: finalOwnerName,
          tenant_name: finalTenantName,
          due_date: inv.due_date,
          gross_value: grossValue,
          admin_fee_percent: adminPercent,
          admin_fee_value: adminFeeValue,
          broker_fee_percent: brokerPercent,
          broker_fee_value: brokerFeeValue,
          net_value: netValue,
          status: inv.metadata?.repassado ? 'repassado' : 'pendente',
        };
      });

      setRepasses(processedRepasses);
    } catch (err) {
      console.error('Erro ao buscar repasses:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.company_id]);

  useEffect(() => {
    void fetchRepasses();
  }, [fetchRepasses]);

  const markAsRepassado = useCallback(async (invoiceId: string) => {
    const inv = repasses.find((repasse) => repasse.invoice_id === invoiceId);
    if (!inv) return false;

    const { error } = await supabase
      .from('invoices')
      .update({ metadata: { repassado: true, repassado_em: new Date().toISOString() } })
      .eq('id', invoiceId);

    if (error) {
      console.error('Erro ao confirmar repasse:', error);
      return false;
    }

    await fetchRepasses();
    return true;
  }, [fetchRepasses, repasses]);

  return { repasses, loading, markAsRepassado, refresh: fetchRepasses };
}

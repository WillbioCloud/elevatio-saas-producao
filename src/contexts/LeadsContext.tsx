import React, { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import { Lead, LeadStatus } from '../types';

const isAbortError = (error: unknown): boolean => {
  if (!error || typeof error !== 'object') return false;
  const maybe = error as { name?: string; message?: string };
  const message = `${maybe.message ?? ''}`.toLowerCase();
  return maybe.name === 'AbortError' || message.includes('aborted') || message.includes('signal is aborted');
};

interface LeadsContextType {
  leads: Lead[];
  loading: boolean;
  refreshLeads: () => Promise<void>;
  updateLeadStatus: (leadId: string, status: LeadStatus) => Promise<void>;
}

export const LeadsContext = createContext<LeadsContextType | undefined>(undefined);

export const LeadsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, isAdmin } = useAuth();
  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshLeads = useCallback(async () => {
    if (!user?.id) {
      setLeads([]);
      setLoading(false);
      return;
    }

    const shouldShowInitialLoading = leads.length === 0;
    if (shouldShowInitialLoading) {
      setLoading(true);
    }

    let query = supabase
      .from('leads')
      .select(`
        *,
        property:properties!leads_property_id_fkey (
          title,
          price,
          agent_id,
          agent:profiles (name)
        )
      `)
      .order('created_at', { ascending: false });

    if (!isAdmin) {
      query = query.eq('assigned_to', user.id);
    }

    try {
      const { data, error } = await query;

      if (error) {
        throw error;
      }

      if (data) {
        setLeads(data as Lead[]);
      }
    } catch (error) {
      if (!isAbortError(error)) {
        console.error('Erro ao buscar leads:', error);
      }
    }

    if (shouldShowInitialLoading) {
      setLoading(false);
    }
  }, [isAdmin, leads.length, user?.id]);

  const updateLeadStatus = useCallback(async (leadId: string, status: LeadStatus) => {
    let previousLead: Lead | undefined;

    setLeads((prev) => {
      previousLead = prev.find((lead) => lead.id === leadId);
      return prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead));
    });

    const { error } = await supabase
      .from('leads')
      .update({ status })
      .eq('id', leadId);

    if (error && previousLead) {
      setLeads((prev) => prev.map((lead) => (lead.id === leadId ? previousLead as Lead : lead)));
      console.error('Erro ao atualizar status do lead:', error);
    }
  }, []);

  useEffect(() => {
    void refreshLeads().catch((error) => {
      if (!isAbortError(error)) {
        console.error('Erro ao atualizar leads:', error);
      }
    });
  }, [refreshLeads]);

  const value = useMemo(
    () => ({
      leads,
      loading,
      refreshLeads,
      updateLeadStatus,
    }),
    [leads, loading, refreshLeads, updateLeadStatus]
  );

  return <LeadsContext.Provider value={value}>{children}</LeadsContext.Provider>;
};

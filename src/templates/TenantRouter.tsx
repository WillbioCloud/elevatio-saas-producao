import React from 'react';
import ClassicTemplate from './classic';
import { useTenant } from '../contexts/TenantContext';

export default function TenantRouter({ customDomain }: { customDomain?: string }) {
  const { tenant, isLoadingTenant } = useTenant();

  if (isLoadingTenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-500"></div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <h1 className="text-2xl">Site não encontrado ou inativo.</h1>
      </div>
    );
  }

  // Futuramente faremos o switch(tenant.template) aqui
  return <ClassicTemplate />;
}

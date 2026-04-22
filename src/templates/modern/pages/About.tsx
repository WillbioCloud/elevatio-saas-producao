import React from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { Icons } from '../../../components/Icons';

export default function About() {
  const { tenant } = useTenant();
  const companyName = tenant?.name || 'Nossa Empresa';
  
  const siteData = typeof tenant?.site_data === 'string' 
    ? JSON.parse(tenant.site_data) 
    : tenant?.site_data || {};
  const companyDocument = siteData?.cnpj || tenant?.document || '';

  return (
    <div className="pt-24 min-h-screen bg-white">
      {/* Hero Section */}
      <div className="bg-slate-900 text-white py-20 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-white/10 via-transparent to-transparent"></div>
        <div className="max-w-7xl mx-auto px-4 relative z-10 text-center">
          <h1 className="text-4xl md:text-5xl font-light mb-4">
            Sobre a <span className="font-semibold">{companyName}</span>
          </h1>
          <p className="text-slate-300 max-w-2xl mx-auto text-lg font-light">
            Conheça nossa história, nossos valores e as informações oficiais da nossa empresa.
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Nossa História */}
          <div className="lg:col-span-2 space-y-8">
            <div>
              <h2 className="text-2xl font-semibold text-slate-900 mb-6 flex items-center gap-3">
                <Icons.BookOpen className="text-slate-400" size={24} />
                Nossa História
              </h2>
              <div className="prose prose-lg text-slate-600 font-light leading-relaxed">
                {siteData?.about_text ? (
                  <p className="whitespace-pre-wrap">{siteData.about_text}</p>
                ) : (
                  <p>
                    Somos uma imobiliária dedicada a encontrar o imóvel perfeito para você. 
                    Nossa missão é transformar a experiência de compra, venda e locação de 
                    imóveis em um processo transparente, seguro e focado totalmente na 
                    satisfação dos nossos clientes.
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar: Dados Jurídicos e Contato */}
          <div className="space-y-6">
            <div className="bg-slate-50 border border-slate-100 p-8 rounded-2xl">
              <h3 className="text-lg font-semibold text-slate-900 mb-6 border-b border-slate-200 pb-4">
                Informações Oficiais
              </h3>
              
              <ul className="space-y-5">
                {siteData?.corporate_name && (
                  <li>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Razão Social</p>
                    <p className="text-slate-800 font-medium">{siteData.corporate_name}</p>
                  </li>
                )}
                
                {companyDocument && (
                  <li>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">CNPJ</p>
                    <p className="text-slate-800 font-medium">{companyDocument}</p>
                  </li>
                )}

                {siteData?.creci && (
                  <li>
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-1">Registro CRECI</p>
                    <p className="text-slate-800 font-medium">{siteData.creci}</p>
                  </li>
                )}

                {(siteData?.contact_email || siteData?.contact_phone) && (
                  <li className="pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Contato Direto</p>
                    {siteData?.contact_phone && (
                      <div className="flex items-center gap-3 text-slate-700 mb-2">
                        <Icons.Phone size={18} className="text-slate-400" />
                        <span>{siteData.contact_phone}</span>
                      </div>
                    )}
                    {siteData?.contact_email && (
                      <div className="flex items-center gap-3 text-slate-700">
                        <Icons.Mail size={18} className="text-slate-400" />
                        <span>{siteData.contact_email}</span>
                      </div>
                    )}
                  </li>
                )}

                {siteData?.address?.street && (
                  <li className="pt-4 border-t border-slate-200">
                    <p className="text-xs text-slate-400 uppercase tracking-wider font-semibold mb-3">Sede</p>
                    <div className="flex gap-3 text-slate-700">
                      <Icons.MapPin size={18} className="text-slate-400 shrink-0 mt-0.5" />
                      <span className="leading-snug">
                        {siteData.address.street}, {siteData.address.number}<br/>
                        {siteData.address.neighborhood}<br/>
                        {siteData.address.city} - {siteData.address.state}
                      </span>
                    </div>
                  </li>
                )}
              </ul>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

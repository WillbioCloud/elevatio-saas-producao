import React, { useState } from 'react';
import { useTenant } from '../../../contexts/TenantContext';
import { Icons } from '../../../components/Icons';
import { getWhatsappLink } from '../../../utils/tenantUtils';

export default function LuxuryContact() {
  const { tenant } = useTenant();
  const siteData = (tenant?.site_data as any) || {};

  const phone = siteData.contact?.phone || tenant?.phone || '';
  const email = siteData.contact?.email || tenant?.email || '';
  const address = siteData.contact?.address || '';
  const whatsappLink = getWhatsappLink(tenant, 'Olá, acessei o site e gostaria de falar com um especialista.');

  const [form, setForm] = useState({ name: '', email: '', phone: '', message: '' });
  const [sent, setSent] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // Em produção, isso iria para a tabela leads/mensagens. 
    // Simulamos envio com sucesso:
    setTimeout(() => setSent(true), 800);
  };

  return (
    <div className="pt-32 pb-20 px-6 max-w-[1400px] mx-auto selection:bg-white selection:text-black min-h-screen">
      <div className="max-w-4xl mb-24">
        <h1 className="text-5xl md:text-7xl font-medium tracking-tight mb-8 leading-[1.1]">
          Fale Conosco
        </h1>
        <p className="text-xl md:text-2xl text-neutral-400 leading-relaxed font-light">
          Estamos disponíveis para responder às suas dúvidas, apresentar oportunidades e agendar reuniões privativas.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 lg:gap-24">
        {/* Coluna Esquerda: Informações */}
        <div>
          <h2 className="text-2xl font-medium mb-10">Informações de Contato</h2>
          <div className="space-y-10">
            {phone && (
              <div className="flex items-start gap-6">
                <div className="bg-[#111] w-14 h-14 rounded-full flex items-center justify-center border border-white/5 flex-shrink-0">
                  <Icons.Phone className="w-6 h-6 text-white" />
                </div>
                <div className="pt-1">
                  <p className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2">Telefone / WhatsApp</p>
                  <p className="text-lg text-white font-light">{phone}</p>
                </div>
              </div>
            )}
            {email && (
              <div className="flex items-start gap-6">
                <div className="bg-[#111] w-14 h-14 rounded-full flex items-center justify-center border border-white/5 flex-shrink-0">
                  <Icons.Mail className="w-6 h-6 text-white" />
                </div>
                <div className="pt-1">
                  <p className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2">E-mail</p>
                  <p className="text-lg text-white font-light">{email}</p>
                </div>
              </div>
            )}
            {address && (
              <div className="flex items-start gap-6">
                <div className="bg-[#111] w-14 h-14 rounded-full flex items-center justify-center border border-white/5 flex-shrink-0">
                  <Icons.MapPin className="w-6 h-6 text-white" />
                </div>
                <div className="pt-1">
                  <p className="text-xs uppercase tracking-widest text-neutral-500 font-medium mb-2">Endereço</p>
                  <p className="text-lg text-white font-light whitespace-pre-line leading-relaxed">{address}</p>
                </div>
              </div>
            )}
          </div>

          {whatsappLink && (
            <div className="mt-16">
              <a href={whatsappLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-3 bg-[#111] text-white px-8 py-4 rounded-full text-sm font-medium border border-white/10 hover:bg-white/5 transition-colors">
                <Icons.MessageCircle className="w-5 h-5" />
                Iniciar conversa no WhatsApp
              </a>
            </div>
          )}
        </div>

        {/* Coluna Direita: Formulário */}
        <div className="bg-[#111] p-10 md:p-12 rounded-[2rem] border border-white/5">
          <h2 className="text-2xl font-medium mb-8">Envie uma Mensagem</h2>
          {sent ? (
             <div className="text-center py-12">
               <div className="bg-white/5 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-white/10">
                 <Icons.CheckCircle className="w-10 h-10 text-white" />
               </div>
               <h3 className="text-xl font-medium text-white mb-2">Mensagem enviada com sucesso.</h3>
               <p className="text-neutral-400">Um de nossos consultores retornará o contato o mais breve possível.</p>
             </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <input type="text" required placeholder="Nome Completo" className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-colors" value={form.name} onChange={e => setForm({...form, name: e.target.value})} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <input type="email" required placeholder="E-mail" className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-colors" value={form.email} onChange={e => setForm({...form, email: e.target.value})} />
                <input type="tel" required placeholder="Telefone" className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-colors" value={form.phone} onChange={e => setForm({...form, phone: e.target.value})} />
              </div>
              <div>
                <textarea rows={4} required placeholder="Como podemos ajudar?" className="w-full bg-black/50 border border-white/10 rounded-xl px-5 py-4 text-sm text-white placeholder:text-neutral-600 focus:outline-none focus:border-white/30 transition-colors resize-none" value={form.message} onChange={e => setForm({...form, message: e.target.value})} />
              </div>
              <button type="submit" className="w-full bg-white text-black font-medium text-sm py-4 rounded-xl hover:bg-neutral-200 transition-colors flex justify-center items-center gap-2">
                Enviar Mensagem
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

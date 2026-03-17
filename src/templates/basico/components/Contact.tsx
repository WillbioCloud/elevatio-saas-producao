import React, { useState } from 'react';
import { MapPin, Phone, Mail, Send } from 'lucide-react';
import { useTenant } from '../../../contexts/TenantContext';
import { supabase } from '../../../lib/supabase';

export function Contact() {
  const { tenant } = useTenant();
  const siteData = tenant?.site_data as any;
  const primaryColor = siteData?.primary_color || '#b08d5e';

  const email = siteData?.contact?.email || '';
  const phone = siteData?.contact?.phone || '';
  const address = siteData?.contact?.address || '';

  const [form, setForm] = useState({ name: '', phone: '', message: '' });
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tenant?.id) return;
    setSending(true);
    await supabase.from('leads').insert([{
      name: form.name,
      phone: form.phone,
      message: form.message,
      source: 'Site',
      company_id: tenant.id,
      status: 'Aguardando Atendimento',
    }]);
    setSending(false);
    setSent(true);
  };

  return (
    <section id="contato" className="py-24 bg-[#111]">
      <div className="max-w-7xl mx-auto px-6">
        <div className="text-center mb-16">
          <div className="flex items-center justify-center gap-4 mb-4">
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
            <p className="text-xs tracking-[0.4em] uppercase font-medium" style={{ color: primaryColor }}>Contato</p>
            <div className="h-px w-12" style={{ backgroundColor: primaryColor + '80' }} />
          </div>
          <h2 className="font-serif text-3xl sm:text-4xl text-white font-bold">Fale Conosco</h2>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Info */}
          <div className="space-y-8">
            <p className="text-white/50 text-base leading-relaxed">
              Entre em contato com nossa equipe. Estamos prontos para ajudá-lo a encontrar o imóvel ideal ou tirar qualquer dúvida.
            </p>
            <div className="space-y-5">
              {address && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor + '18' }}>
                    <MapPin size={18} style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-1">Endereço</p>
                    <p className="text-white/70 text-sm">{address}</p>
                  </div>
                </div>
              )}
              {phone && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor + '18' }}>
                    <Phone size={18} style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-1">Telefone</p>
                    <a href={`tel:${phone.replace(/\D/g, '')}`} className="text-white/70 text-sm hover:text-white transition-colors">{phone}</a>
                  </div>
                </div>
              )}
              {email && (
                <div className="flex items-start gap-4">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ backgroundColor: primaryColor + '18' }}>
                    <Mail size={18} style={{ color: primaryColor }} />
                  </div>
                  <div>
                    <p className="text-white/30 text-xs uppercase tracking-wider mb-1">E-mail</p>
                    <a href={`mailto:${email}`} className="text-white/70 text-sm hover:text-white transition-colors">{email}</a>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Form */}
          {sent ? (
            <div className="flex flex-col items-center justify-center p-12 rounded-2xl border border-white/8 text-center" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div className="text-4xl mb-4">✓</div>
              <h3 className="font-serif text-xl text-white font-bold mb-2">Mensagem Enviada!</h3>
              <p className="text-white/40 text-sm">Em breve nossa equipe entrará em contato.</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4 p-8 rounded-2xl border border-white/8" style={{ background: 'rgba(255,255,255,0.02)' }}>
              <div>
                <label className="block text-white/40 text-xs uppercase tracking-wider mb-2">Nome</label>
                <input
                  type="text"
                  required
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="Seu nome completo"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-white/40 text-xs uppercase tracking-wider mb-2">WhatsApp</label>
                <input
                  type="tel"
                  required
                  value={form.phone}
                  onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                  placeholder="(00) 00000-0000"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-white/30 transition-colors"
                />
              </div>
              <div>
                <label className="block text-white/40 text-xs uppercase tracking-wider mb-2">Mensagem</label>
                <textarea
                  rows={4}
                  value={form.message}
                  onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                  placeholder="Como podemos ajudá-lo?"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-sm placeholder:text-white/20 outline-none focus:border-white/30 transition-colors resize-none"
                />
              </div>
              <button
                type="submit"
                disabled={sending}
                className="w-full py-4 rounded-xl font-bold text-sm tracking-widest uppercase flex items-center justify-center gap-2 transition-all duration-300 hover:opacity-90 disabled:opacity-60"
                style={{ backgroundColor: primaryColor, color: '#0e0e0e' }}
              >
                <Send size={16} />
                {sending ? 'Enviando...' : 'Enviar Mensagem'}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}

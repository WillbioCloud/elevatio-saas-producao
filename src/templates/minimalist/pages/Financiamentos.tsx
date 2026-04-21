import React from 'react';
import { Link } from 'react-router-dom';
import { useTenant } from '../../../contexts/TenantContext';
import { Icons } from '../../../components/Icons';
import { getTenantName } from '../../../utils/tenantUtils';

const banks = [
  { name: 'Caixa Econômica', desc: 'Simulador Habitacional Caixa', url: 'https://habitacao.caixa.gov.br/siopiweb-web/simulaOperacaoInternet.do?method=inicializarCasoUso', logo: '/bancos/caixa.png', color: 'bg-blue-600' },
  { name: 'Banco do Brasil', desc: 'Crédito Imobiliário BB', url: 'https://cim-simulador-imovelproprio.apps.bb.com.br/simulacao-imobiliario/sobre-imovel', logo: '/bancos/bb.png', color: 'bg-yellow-500' },
  { name: 'Itaú', desc: 'Financiamento de Imóveis Itaú', url: 'https://www.itau.com.br/emprestimos-financiamentos#emprestimoOnlineSeg', logo: '/bancos/itau.avif', color: 'bg-orange-500' },
  { name: 'Bradesco', desc: 'Simulador de Imóveis Bradesco', url: 'https://banco.bradesco/html/classic/produtos-servicos/emprestimo-e-financiamento/encontre-seu-credito/simuladores-imoveis.shtm#box1-comprar', logo: '/bancos/bradesco.webp', color: 'bg-red-600' },
  { name: 'Santander', desc: 'Crédito Imobiliário Santander', url: 'https://www.negociosimobiliarios.santander.com.br/negociosimobiliarios/#/dados-pessoais?goal=3&ic=lpcreditoimob', logo: '/bancos/santander.png', color: 'bg-red-500' }
];

const Financiamentos: React.FC = () => {
  const { tenant } = useTenant();
  const companyName = getTenantName(tenant);

  return (
    <div className="min-h-screen bg-slate-50 pt-24 pb-20 animate-fade-in">
      <div className="container mx-auto px-4 max-w-5xl">
        <Link to="/imoveis" className="inline-flex items-center gap-2 text-slate-500 hover:text-brand-600 font-bold mb-6 transition-colors">
          <Icons.ArrowLeft size={20} /> Voltar para Imóveis
        </Link>

        <div className="bg-white rounded-3xl p-8 md:p-12 shadow-sm border border-slate-100 text-center mb-10">
          <div className="w-16 h-16 bg-brand-50 text-brand-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
            <Icons.Landmark size={32} />
          </div>
          <h1 className="text-3xl md:text-4xl font-serif font-bold text-slate-800 mb-4">Simuladores de Financiamento</h1>
          <p className="text-slate-600 max-w-2xl mx-auto">
            Escolha o banco de sua preferência para realizar a simulação do seu crédito imobiliário. {companyName} pode apoiar sua análise com mais contexto sobre o imóvel e a negociação.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {banks.map((bank) => (
            <a
              key={bank.name}
              href={bank.url}
              target="_blank"
              rel="noreferrer"
              className="group bg-white rounded-2xl p-6 border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all flex flex-col items-center text-center"
            >
              <div className="w-full h-32 rounded-xl mb-4 flex items-center justify-center p-4 bg-slate-50 border border-slate-100 group-hover:border-slate-200 transition-colors">
                <img src={bank.logo} alt={`Logo ${bank.name}`} className="max-h-16 max-w-[80%] object-contain" onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.nextElementSibling?.classList.remove('hidden'); }} />
                <span className={`hidden text-white font-bold px-4 py-2 rounded-lg ${bank.color}`}>{bank.name}</span>
              </div>
              <h3 className="font-bold text-lg text-slate-800 mb-2">{bank.name}</h3>
              <p className="text-sm text-slate-500 mb-4">{bank.desc}</p>
              <span className="mt-auto w-full py-2.5 rounded-xl bg-slate-50 group-hover:bg-brand-50 text-slate-600 group-hover:text-brand-700 font-bold text-sm transition-colors flex items-center justify-center gap-2">
                Simular agora <Icons.ExternalLink size={16} />
              </span>
            </a>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Financiamentos;

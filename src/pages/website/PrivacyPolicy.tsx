import LegalPageLayout from './LegalPageLayout';

const sections = [
  {
    title: '1. Dados Coletados',
    body: 'Coletamos dados cadastrais (como nome, e-mail, telefone, CPF/CNPJ) no momento do registro. Também registramos automaticamente informações de uso, como endereço IP, tipo de navegador, logs de acesso e as informações dos leads que você insere ou capta através dos seus sites criados na plataforma.',
  },
  {
    title: '2. Uso das Informações',
    body: 'Seus dados são utilizados para fornecer, manter e faturar o serviço (via integração com o Asaas). Os leads gerados nos seus sites são de sua propriedade exclusiva; o Elevatio Vendas apenas atua como processador de dados para disponibilizá-los no seu CRM, não realizando qualquer tipo de contato ou venda com seus leads.',
  },
  {
    title: '3. Cookies e Tecnologias Semelhantes',
    body: 'Utilizamos cookies essenciais para manter sua sessão logada, garantir a segurança do painel de administração e medir estatísticas de acesso. Você pode gerenciar as preferências de cookies nas configurações do seu navegador, mas bloqueá-los pode impedir o login no sistema.',
  },
  {
    title: '4. Compartilhamento de Dados',
    body: 'Não vendemos ou alugamos seus dados pessoais. Compartilhamos informações exclusivamente com provedores de infraestrutura estritamente necessários para a operação do SaaS (ex: servidores de banco de dados Supabase, hospedagem Vercel e gateway de pagamentos Asaas), ou por ordem judicial.',
  },
  {
    title: '5. Segurança da Informação',
    body: 'Adotamos práticas robustas de segurança da informação, incluindo criptografia em trânsito (HTTPS/SSL) e em repouso no banco de dados, além de políticas de controle de acesso (Row Level Security). Contudo, nenhum serviço web é 100% infalível contra ataques maliciosos avançados.',
  },
  {
    title: '6. Seus Direitos (LGPD)',
    body: 'Conforme a Lei Geral de Proteção de Dados (Lei nº 13.709/2018), você possui o direito de acessar, corrigir, solicitar a portabilidade ou a exclusão de seus dados pessoais. Grande parte dessas ações pode ser feita diretamente no painel de configurações. Para solicitações extras, contate nosso suporte.',
  },
  {
    title: '7. Retenção e Exclusão',
    body: 'Mantemos seus dados ativos enquanto sua assinatura estiver em vigor. Em caso de cancelamento, seus dados comerciais e leads podem ser mantidos temporariamente para facilitar reativação, e dados financeiros serão guardados pelo período exigido pelas leis fiscais brasileiras (mínimo 5 anos).',
  },
  {
    title: '8. Contato e Encarregado de Dados',
    body: 'Caso tenha dúvidas sobre nossa política de privacidade, o tratamento dos seus dados ou deseje exercer seus direitos previstos na LGPD, entre em contato conosco através dos nossos canais de atendimento ou pelo e-mail oficial da empresa.',
  },
];

export default function PrivacyPolicy() {
  return (
    <LegalPageLayout
      title="Política de Privacidade"
      subtitle="Como tratamos dados pessoais, cookies e tecnologias semelhantes na Elevatio Vendas."
      updatedAt="19 de abril de 2026"
    >
      {sections.map((section) => (
        <section key={section.title}>
          <h2>{section.title}</h2>
          <p>{section.body}</p>
        </section>
      ))}
    </LegalPageLayout>
  );
}

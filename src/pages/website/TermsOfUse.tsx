import LegalPageLayout from './LegalPageLayout';

const sections = [
  {
    title: '1. Aceitação dos Termos',
    body: 'Ao acessar, cadastrar-se ou utilizar o Elevatio Vendas, você concorda expressamente com estes Termos de Uso. Se você não concordar com alguma destas regras, não deverá utilizar a plataforma. O uso contínuo após atualizações constitui aceitação das novas diretrizes.',
  },
  {
    title: '2. Uso da Plataforma',
    body: 'O Elevatio Vendas fornece um CRM e construtor de sites para o mercado imobiliário. Você concorda em usar a plataforma apenas para fins legais, comprometendo-se a não inserir dados falsos, ilícitos, código malicioso ou conteúdos que violem direitos autorais e de propriedade intelectual de terceiros.',
  },
  {
    title: '3. Conta e Segurança',
    body: 'Você é inteiramente responsável por manter a confidencialidade de suas credenciais de acesso (login e senha). Qualquer ação realizada sob a sua conta é de sua responsabilidade. Você deve nos notificar imediatamente sobre qualquer uso não autorizado ou quebra de segurança.',
  },
  {
    title: '4. Assinaturas, Cobranças e Bloqueios',
    body: 'Nossos serviços são cobrados no modelo de assinatura recorrente pré-paga. O atraso no pagamento poderá resultar na suspensão temporária do acesso após o período de tolerância de 7 dias, seguida pelo cancelamento definitivo e perda do domínio configurado, caso a inadimplência persista.',
  },
  {
    title: '5. Propriedade Intelectual',
    body: 'O software, logotipos, design, arquitetura de banco de dados e código-fonte do Elevatio Vendas são de propriedade exclusiva da nossa empresa. Concedemos a você uma licença de uso revogável, não exclusiva e intransferível durante a vigência da assinatura. Você não possui direitos sobre a tecnologia da plataforma.',
  },
  {
    title: '6. Limitação de Responsabilidade',
    body: 'A plataforma é fornecida "no estado em que se encontra" (as is). Não garantimos número específico de vendas, leads ou resultados comerciais. Nossa responsabilidade máxima em caso de falhas tecnológicas limita-se ao valor correspondente à mensalidade do ciclo vigente pago pela sua imobiliária.',
  },
  {
    title: '7. Encerramento de Conta',
    body: 'Você pode cancelar sua assinatura a qualquer momento através do painel. O cancelamento interrompe cobranças futuras, mas não gera reembolso de ciclos parciais já pagos. Reservamo-nos o direito de encerrar ou suspender contas que violem estes Termos de Uso.',
  },
  {
    title: '8. Foro e Legislação Aplicável',
    body: 'Estes termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca da sede da Elevatio Vendas para dirimir quaisquer controvérsias referentes a este documento.',
  },
];

export default function TermsOfUse() {
  return (
    <LegalPageLayout
      title="Termos de Uso"
      subtitle="Condições gerais de acesso e utilização da plataforma Elevatio Vendas."
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

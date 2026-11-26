import { Link } from 'react-router-dom';
import './Privacy.css';

const privacyEmail = 'Leonardoaguiar080@gmail.com';

function PrivacyContact({ deletion = false }) {
  const subject = deletion ? '?subject=Pedido%20de%20exclus%C3%A3o%20%7C%20LeadIA%20Dev' : '';
  return <a href={'mailto:' + privacyEmail + subject}>{privacyEmail}</a>;
}

function PrivacyLayout({ title, children }) {
  return (
    <main className="container privacy-page">
      <meta name="robots" content="noindex" />
      <header>
        <Link to="/">LeadIA</Link>
        <p>Ambiente de homologação do LeadIA</p>
        <h1>{title}</h1>
        <p className="privacy-review">Prévia para revisão. Os prazos de retenção e as bases legais estão em validação.</p>
      </header>
      {children}
    </main>
  );
}

export function PrivacyPolicy() {
  return (
    <PrivacyLayout title="Política de privacidade">
      <section>
        <h2>Escopo e responsável</h2>
        <p>Esta política se aplica ao LeadIA Dev, usado para avaliação acadêmica e testes do CRM e da integração com WhatsApp.</p>
        <p>Leonardo Miguel Sampaio de Oliveira é o responsável pelo tratamento neste ambiente. Para questões de privacidade ou para exercer seus direitos, escreva para <PrivacyContact />.</p>
      </section>
      <section>
        <h2>Dados e finalidades</h2>
        <ul>
          <li><strong>Contas do CRM.</strong> Tratamos nome, e-mail, dados de autenticação e vínculo à organização para liberar o acesso autorizado e isolar os dados de cada equipe.</li>
          <li><strong>Conversas e leads.</strong> Nos testes autorizados, tratamos os dados informados no CRM e, no WhatsApp, o número do remetente, o nome do perfil quando fornecido, o conteúdo e metadados das mensagens. Usamos esses dados para testar atendimento, classificação, encaminhamento e registro no CRM.</li>
          <li><strong>Operação e segurança.</strong> Registros técnicos ajudam a detectar falhas, acompanhar a entrega das mensagens e investigar uso indevido.</li>
        </ul>
      </section>
      <section>
        <h2>Bases legais</h2>
        <p>Os testes voluntários com dados pessoais podem ocorrer com consentimento específico e revogável. Para administrar o acesso e proteger o ambiente, o legítimo interesse pode ser usado quando o tratamento for necessário e respeitar os direitos dos participantes. Tratamos dados para cumprir obrigações legais quando elas se aplicam.</p>
      </section>
      <section>
        <h2>Fornecedores e automação</h2>
        <p>A hospedagem do LeadIA armazena o CRM e as cópias de segurança. A Meta usa os dados do WhatsApp para receber e enviar mensagens. Quando a integração com Claude está habilitada, um trecho da mensagem pode ser enviado à Anthropic para sugerir a resposta e a classificação. O próprio texto pode conter dados pessoais informados pelo remetente.</p>
        <p>O tratamento por fornecedores pode envolver transferência internacional de dados. Você pode solicitar pelo contato de privacidade informações sobre o compartilhamento e as salvaguardas aplicadas.</p>
        <p>Você pode pedir atendimento humano e solicitar a revisão das decisões automatizadas quando a LGPD se aplicar.</p>
      </section>
      <section>
        <h2>Retenção e direitos</h2>
        <p>A retenção acompanha a finalidade de cada dado. Contas atendem ao acesso à homologação, conversas e leads à execução e à verificação dos testes, registros técnicos à operação, e backups à recuperação do serviço. As cópias de segurança têm rotação própria. A legislação pode exigir a guarda de registros específicos.</p>
        <p>Você pode solicitar confirmação de tratamento, acesso, correção, informação sobre compartilhamento, revogação de consentimento e exclusão ou bloqueio nas hipóteses legais. Consulte as <Link to="/exclusao-de-dados">instruções para pedir a exclusão</Link>.</p>
      </section>
    </PrivacyLayout>
  );
}

export function DataDeletion() {
  return (
    <PrivacyLayout title="Exclusão de dados">
      <section>
        <h2>Como fazer o pedido</h2>
        <ol>
          <li>Envie um e-mail para <PrivacyContact deletion /> e informe que o pedido é sobre o LeadIA Dev.</li>
          <li>Indique se quer excluir os dados da sua conta, de uma conversa de WhatsApp ou de ambos. Informe somente o e-mail da conta ou o número utilizado no teste, conforme o pedido.</li>
          <li>Aguarde a confirmação por e-mail. Se precisarmos confirmar sua identidade, pediremos apenas as informações necessárias para localizar o registro e evitar a exclusão de dados de outra pessoa.</li>
        </ol>
        <p>Mantenha senhas e códigos de autenticação em sigilo.</p>
      </section>
      <section>
        <h2>O que acontece depois</h2>
        <p>A resposta informa as medidas tomadas e qualquer conservação aplicável, com o motivo. Se houver cópias de segurança com os dados, elas seguem o ciclo de rotação. A exclusão no LeadIA se aplica às cópias sob nossa gestão.</p>
        <p>Para pedir correção, acesso ou outro direito, use o mesmo contato. Saiba como tratamos os dados na <Link to="/privacidade">política de privacidade</Link>.</p>
      </section>
    </PrivacyLayout>
  );
}

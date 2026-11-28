import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, Play, CheckCircle2 } from 'lucide-react';
import './Landing.css';

const script = [
  { t: 'c', x: 'Oi! Vi a viagem para Jericoacoara no Instagram. Qual o valor?', h: '14:02', s: ['Interessado', 'Descobrir perfil'] },
  { t: 'i', x: 'Olá! Que bom que você se interessou pela nossa viagem! Temos opções de pagamento facilitado. Você gostaria de viajar sozinho(a) ou acompanhado(a)?', h: '14:02' },
  { t: 'c', x: 'Vou com meu marido.', h: '14:03', s: ['Interessado · 2 pessoas', 'Checar disponibilidade'] },
  { t: 'i', x: 'Perfeito! Vou verificar a disponibilidade para duas pessoas e apresentar as condições de pagamento. Posso também encaminhar sua conversa para um consultor finalizar sua reserva!', h: '14:03', s: ['Interessado', 'Enviar proposta'], crm: '✓ Lead registrado no CRM' },
];

function ChatDemo() {
  const [messages, setMessages] = useState([]);
  const [status, setStatus] = useState({ s1: 'Novo contato', s2: 'Entender interesse', crm: '' });
  const timers = useRef([]);
  const reduce = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  function run() {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setMessages([]);
    setStatus({ s1: 'Novo contato', s2: 'Entender interesse', crm: '' });
    script.forEach((m, i) => {
      const apply = () => {
        setMessages(prev => [...prev, m]);
        if (m.s) setStatus(prev => ({ ...prev, s1: m.s[0], s2: m.s[1] }));
        if (m.crm) setStatus(prev => ({ ...prev, crm: m.crm }));
      };
      if (reduce) apply();
      else timers.current.push(setTimeout(apply, i * 1900 + 300));
    });
  }

  useEffect(() => { run(); return () => timers.current.forEach(clearTimeout); }, []);

  return (
    <div>
      <div className="l-phone" aria-label="Simulação de atendimento da LeadIA">
        <div className="l-phone-head"><span>Agência de viagens · Instagram</span><span><i className="l-dot"></i>IA ativa</span></div>
        <div className="l-chat" aria-live="polite">
          {messages.map((m, i) => (
            <div key={i} className={`l-msg ${m.t}`}>
              {m.x}
              <small>{(m.t === 'c' ? 'Cliente' : 'LeadIA') + ' · ' + m.h}</small>
            </div>
          ))}
        </div>
        <div className="l-status">
          <div><span>Status do lead</span><strong className={status.s1 !== 'Novo contato' ? 'on' : ''}>{status.s1}</strong></div>
          <div><span>Próxima ação</span><strong>{status.s2}</strong></div>
          <div className="l-crm">{status.crm}</div>
        </div>
      </div>
      <p className="l-note">Simulação ilustrativa de funcionamento, não uma integração ativa.</p>
      <div style={{ marginTop: 10 }}>
        <button className="btn btn-outline btn-sm" onClick={run}><Play size={14} /> Rever atendimento</button>
      </div>
    </div>
  );
}

export default function Landing() {
  const [email, setEmail] = useState('');
  const [ok, setOk] = useState('');

  function submit(e) {
    e.preventDefault();
    setOk(`Pronto! Avisaremos ${email} quando abrirmos as vagas.`);
    setEmail('');
  }

  return (
    <div className="landing">
      <div className="container">
        <nav className="l-nav">
          <a href="#" className="l-logo">Lead<b>IA</b></a>
          <div className="l-nav-actions">
            <a className="btn btn-ghost btn-sm" href="#planos">Planos</a>
            <Link className="btn btn-outline btn-sm" to="/login">Acessar demo</Link>
            <a className="btn btn-primary btn-sm" href="#lista">Entrar na lista</a>
          </div>
        </nav>

        <div className="l-hero">
          <div>
            <div className="badge blue" style={{ marginBottom: 16 }}>Plataforma comercial com IA</div>
            <h1>Cada direct respondido, cada lead acompanhado.</h1>
            <p className="l-lead">LeadIA é um departamento comercial automatizado para pequenas e médias empresas: atende no Instagram e no WhatsApp, entende o que o cliente quer e leva a conversa até a venda.</p>
            <div className="l-hero-actions">
              <a className="btn btn-primary" href="#lista">Quero testar primeiro</a>
              <Link className="btn btn-outline" to="/login">Ver painel demo <ArrowRight size={16} /></Link>
            </div>
            <div className="l-proof">
              <div><strong>&lt; 1 min</strong>Tempo de resposta</div>
              <div><strong>24/7</strong>Atendimento contínuo</div>
              <div><strong>+Conversão</strong>Follow-up inteligente</div>
            </div>
          </div>
          <ChatDemo />
        </div>
      </div>

      <section className="section">
        <div className="container l-grid-2">
          <div>
            <h2 className="section-title">O problema é o silêncio depois do “quanto custa?”</h2>
            <p className="section-lead">A venda se perde na demora, não na falta de interesse.</p>
          </div>
          <ul className="l-pain">
            <li>Dezenas ou centenas de directs por dia, e ninguém dá conta.</li>
            <li>Interessados esperam horas e compram de quem respondeu primeiro.</li>
            <li>Sem acompanhamento, o orçamento enviado nunca vira venda.</li>
            <li>Os leads vivem em conversas soltas, sem organização.</li>
            <li>A equipe repete as mesmas respostas o dia inteiro.</li>
            <li>Ninguém sabe quantos contatos realmente viraram vendas.</li>
          </ul>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Do primeiro direct à proposta enviada</h2>
          <p className="section-lead">A IA trabalha com objetivo comercial. Ela não só responde perguntas: conduz a conversa.</p>
          <ol className="l-steps">
            <li>Captura os leads que chegam pelos canais integrados.</li>
            <li>Usa IA para entender o que o cliente deseja.</li>
            <li>Responde de forma humanizada, na hora.</li>
            <li>Identifica o potencial de compra.</li>
            <li>Apresenta produtos, serviços e preços cadastrados.</li>
            <li>Envia propostas e links de pagamento, quando configurados.</li>
            <li>Faz follow-up de quem não concluiu a compra, respeitando as permissões de contato.</li>
            <li>Passa conversas complexas para vendedores humanos.</li>
            <li>Gera relatórios de desempenho e conversão.</li>
          </ol>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Começamos por quem vende pelo Instagram</h2>
          <p className="section-lead">A tecnologia é a mesma; a inteligência comercial se adapta a cada mercado. Vamos lançar em um segmento e expandir depois.</p>
          <div className="l-seg">
            <div><b>Agências de viagens</b><p>Leads sem retorno e orçamentos perdidos.</p></div>
            <div><b>Salões de beleza</b><p>Clientes perguntando preços e horários.</p></div>
            <div><b>Clínicas</b><p>Agendamentos e dúvidas repetitivas.</p></div>
            <div><b>Lojas de roupas</b><p>Consultas sobre produtos e disponibilidade.</p></div>
            <div><b>Imobiliárias</b><p>Qualificação de interessados.</p></div>
            <div><b>Cursos e escolas</b><p>Atendimento e conversão de matrículas.</p></div>
          </div>
        </div>
      </section>

      <section className="section" id="planos">
        <div className="container">
          <h2 className="section-title">Assinatura mensal, sem surpresas</h2>
          <p className="section-lead">Valores hipotéticos, a validar com os primeiros clientes. Implantação, treinamento e integrações especiais podem ser cobrados à parte.</p>
          <div className="l-plans">
            <div className="l-plan"><h3>Start</h3><div className="l-pr">R$ 97<small>/mês</small></div><p>1 canal e atendimento com IA básico.</p></div>
            <div className="l-plan hl"><h3>Pro</h3><div className="l-pr">R$ 197<small>/mês</small></div><p>CRM, follow-up e relatórios.</p></div>
            <div className="l-plan"><h3>Business</h3><div className="l-pr">R$ 397<small>/mês</small></div><p>Mais canais, equipe e automações.</p></div>
            <div className="l-plan"><h3>Enterprise</h3><div className="l-pr">Sob consulta</div><p>Personalização e integrações.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="l-mvp">
            <div>
              <h3>O que entra na primeira versão</h3>
              <ul>
                <li><b>Conexão com Instagram:</b> integração oficial para receber e responder mensagens elegíveis.</li>
                <li><b>Cérebro de IA:</b> treinado com informações, produtos, preços e regras da empresa.</li>
                <li><b>Painel de leads:</b> clientes, histórico de conversas e status da negociação.</li>
                <li><b>Follow-up inteligente:</b> mensagens de acompanhamento conforme as regras dos canais.</li>
                <li><b>Dashboard comercial:</b> leads recebidos, atendidos, convertidos e vendas geradas.</li>
              </ul>
            </div>
            <div>
              <h3>Onde vamos ser diferentes</h3>
              <ul>
                <li><b>IA que vende:</b> entende objeções e conduz a negociação.</li>
                <li><b>Memória comercial:</b> lembra do histórico e não repete perguntas.</li>
                <li><b>Inteligência de conversão:</b> mostra por que os clientes não compram.</li>
                <li><b>Follow-up personalizado:</b> sabe quando e como retomar a conversa.</li>
                <li><b>Aprendizado comercial:</b> descobre quais abordagens vendem mais.</li>
              </ul>
            </div>
          </div>
          <div className="l-law">Trabalhamos dentro das APIs oficiais da Meta, das permissões e janelas de atendimento e da LGPD. Não prometemos acesso irrestrito a todos os directs nem disparos ilimitados.</div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Resumo executivo em 1 minuto</h2>
          <p className="section-lead">Uma visão rápida para apresentar o LeadIA na banca.</p>
          <div className="l-seg l-seg-3">
            <div><b>Problema</b><p>PMEs perdem vendas por demora no atendimento e falta de follow-up.</p></div>
            <div><b>Solução</b><p>IA que atende, qualifica, faz follow-up e centraliza leads em um painel.</p></div>
            <div><b>Público</b><p>Negócios que vendem por Instagram/WhatsApp e precisam responder rápido.</p></div>
            <div><b>Diferencial</b><p>Não é só chatbot: é um departamento comercial com objetivo de conversão.</p></div>
            <div><b>Modelo</b><p>Assinatura mensal com planos Start, Pro, Business e Enterprise.</p></div>
            <div><b>Roadmap</b><p>Demo forte → MVP técnico com backend → piloto com integrações oficiais.</p></div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">Perguntas frequentes</h2>
          <div className="l-faq">
            <details><summary>A LeadIA substitui o vendedor?</summary><p>Não. Ela cuida do atendimento inicial, qualificação e follow-up. Conversas complexas ou de alto valor podem ser encaminhadas para um vendedor humano.</p></details>
            <details><summary>Funciona só no Instagram?</summary><p>O MVP prioriza Instagram, mas a arquitetura foi pensada para múltiplos canais como WhatsApp, site e outros pontos de contato.</p></details>
            <details><summary>A IA responde com informações erradas?</summary><p>A IA é treinada com os dados cadastrados da empresa: produtos, preços, regras e tom de voz. Também é possível definir limites e handoff para humano.</p></details>
            <details><summary>Os dados ficam seguros?</summary><p>O projeto foi pensado com LGPD em mente, usando permissões oficiais dos canais e boas práticas de controle de acesso e privacidade.</p></details>
          </div>
        </div>
      </section>

      <section className="section" id="lista">
        <div className="container">
          <div className="l-cta-box">
            <div>
              <h2>Pronto para ver a LeadIA em ação?</h2>
              <p>Entre na lista de acesso antecipado ou abra o painel demo para explorar o fluxo comercial completo.</p>
              <form onSubmit={submit} style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 20 }}>
                <input type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="seu@email.com.br" aria-label="Seu e-mail" style={{ flex: '1 1 240px', border: '1px solid var(--line-strong)', background: '#F5F5F4', color: 'var(--ink)' }} />
                <button className="btn btn-primary" type="submit">Entrar na lista</button>
              </form>
              {ok && <div style={{ marginTop: 12, color: '#15803D', fontWeight: 600, display: 'flex', gap: 8, alignItems: 'center' }}><CheckCircle2 size={16} /> {ok}</div>}
            </div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link className="btn btn-primary" to="/login">Abrir demo <ArrowRight size={16} /></Link>
            </div>
          </div>
        </div>
      </section>

      <div className="container">
        <footer className="l-footer">
          <span>LeadIA · Plataforma inteligente de captação, atendimento e conversão de leads com Inteligência Artificial.</span>
          <span>Projeto acadêmico · Demonstração funcional</span>
          <nav className="privacy-footer-links" aria-label="Privacidade">
            <Link to="/privacidade">Privacidade</Link>
            <Link to="/exclusao-de-dados">Exclusão de dados</Link>
          </nav>
        </footer>
      </div>
    </div>
  );
}
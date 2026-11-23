export const seedLeads = [
  { id: 'l1', name: 'Mariana Costa', channel: 'Instagram', interest: 'Pacote Jericoacoara', status: 'Novo', value: 4800, lastMessage: 'Oi! Vi a viagem para Jericoacoara no Instagram. Qual o valor?', time: '14:02', avatar: 'MC', score: 72, tags: ['Viagem', 'Casal'], nextAction: 'Qualificar perfil e datas', lossReason: '' },
  { id: 'l2', name: 'Rafael Lima', channel: 'WhatsApp', interest: 'Plano Pro', status: 'Qualificado', value: 197, lastMessage: 'Quero entender como funciona o follow-up automático.', time: '13:40', avatar: 'RL', score: 84, tags: ['SaaS', 'Follow-up'], nextAction: 'Enviar proposta do plano Pro', lossReason: '' },
  { id: 'l3', name: 'Clínica Vida Plena', channel: 'Instagram', interest: 'Agendamento automático', status: 'Proposta', value: 397, lastMessage: 'Pode enviar uma proposta para duas unidades?', time: '12:15', avatar: 'CV', score: 91, tags: ['Clínica', 'Multiunidade'], nextAction: 'Acompanhar proposta enviada', lossReason: '' },
  { id: 'l4', name: 'Beatriz Souza', channel: 'WhatsApp', interest: 'Salão - pacote mensal', status: 'Convertido', value: 197, lastMessage: 'Fechado! Vou fazer o pagamento agora.', time: '11:03', avatar: 'BS', score: 97, tags: ['Salão', 'Mensal'], nextAction: 'Onboarding do cliente', lossReason: '' },
  { id: 'l5', name: 'Imobiliária Horizonte', channel: 'Instagram', interest: 'Qualificação de leads', status: 'Em atendimento', value: 397, lastMessage: 'Precisamos filtrar quem tem perfil de compra.', time: 'Ontem', avatar: 'IH', score: 78, tags: ['Imobiliária', 'Qualificação'], nextAction: 'Configurar fluxo de qualificação', lossReason: '' },
  { id: 'l6', name: 'Carlos Mendes', channel: 'Instagram', interest: 'Curso de inglês', status: 'Perdido', value: 297, lastMessage: 'Vou pensar e te retorno.', time: 'Ontem', avatar: 'CM', score: 35, tags: ['Educação', 'Preço'], nextAction: 'Reativar em 7 dias', lossReason: 'Sem decisão / adiou compra' },
];

export const seedConversations = {
  l1: [
    { from: 'client', text: 'Oi! Vi a viagem para Jericoacoara no Instagram. Qual o valor?', time: '14:02' },
    { from: 'ia', text: 'Olá! Que bom que você se interessou pela nossa viagem! Temos opções de pagamento facilitado. Você gostaria de viajar sozinho(a) ou acompanhado(a)?', time: '14:02' },
    { from: 'client', text: 'Vou com meu marido.', time: '14:03' },
    { from: 'ia', text: 'Perfeito! Vou verificar a disponibilidade para duas pessoas e apresentar as condições de pagamento. Posso também encaminhar sua conversa para um consultor finalizar sua reserva!', time: '14:03' },
  ],
  l2: [
    { from: 'client', text: 'Quero entender como funciona o follow-up automático.', time: '13:40' },
    { from: 'ia', text: 'O follow-up da LeadIA envia mensagens personalizadas para leads que não responderam, respeitando a janela de atendimento e as permissões do canal. Posso te mostrar um exemplo no seu segmento?', time: '13:41' },
  ],
  l3: [
    { from: 'client', text: 'Boa tarde, atendemos em duas unidades e precisamos automatizar agendamentos.', time: '12:10' },
    { from: 'ia', text: 'Entendi! A LeadIA pode responder dúvidas, coletar dados e encaminhar para agendamento. Quantos atendimentos vocês recebem por dia?', time: '12:11' },
    { from: 'client', text: 'Pode enviar uma proposta para duas unidades?', time: '12:15' },
    { from: 'ia', text: 'Claro! Preparei uma proposta Business para duas unidades com múltiplos canais e automações. Vou enviar por e-mail e deixar o link aqui.', time: '12:16' },
  ],
  l4: [
    { from: 'client', text: 'Oi, quero saber o preço do plano Pro.', time: '10:55' },
    { from: 'ia', text: 'O plano Pro custa R$ 197/mês e inclui CRM, follow-up e relatórios. Quer que eu envie o link de pagamento?', time: '10:55' },
    { from: 'client', text: 'Fechado! Vou fazer o pagamento agora.', time: '11:03' },
  ],
  l5: [
    { from: 'client', text: 'Precisamos filtrar quem tem perfil de compra.', time: 'Ontem' },
    { from: 'ia', text: 'Consigo qualificar leads com perguntas objetivas: orçamento, prazo, região e tipo de imóvel. Quer configurar esse fluxo?', time: 'Ontem' },
  ],
  l6: [
    { from: 'client', text: 'Quanto custa o curso de inglês?', time: 'Ontem' },
    { from: 'ia', text: 'Temos planos a partir de R$ 297/mês. Posso te enviar as opções e condições?', time: 'Ontem' },
    { from: 'client', text: 'Vou pensar e te retorno.', time: 'Ontem' },
  ],
};

export const statusOptions = ['Novo', 'Em atendimento', 'Qualificado', 'Proposta', 'Convertido', 'Perdido'];

export const channelOptions = ['Instagram', 'WhatsApp'];
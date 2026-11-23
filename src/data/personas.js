export const personas = [
  {
    id: 'viagens',
    label: 'Agência de viagens',
    description: 'Pacotes, roteiros e atendimento consultivo via Instagram/WhatsApp.',
    settings: { companyName: 'Horizonte Viagens', segment: 'Agências de viagens', tone: 'Profissional e amigável' },
    leads: [
      { id: 'v1', name: 'Mariana Costa', channel: 'Instagram', interest: 'Pacote Jericoacoara', status: 'Novo', value: 4800, lastMessage: 'Oi! Vi a viagem para Jericoacoara no Instagram. Qual o valor?', time: '14:02', avatar: 'MC', score: 72, tags: ['Viagem', 'Casal'], nextAction: 'Qualificar datas e nº de pessoas', lossReason: '' },
      { id: 'v2', name: 'Fernanda Alves', channel: 'WhatsApp', interest: 'Pacote Fernando de Noronha', status: 'Qualificado', value: 6200, lastMessage: 'Tem opção com parcelamento em 10x?', time: '13:18', avatar: 'FA', score: 86, tags: ['Lua de mel', 'Alta intenção'], nextAction: 'Enviar proposta com parcelamento', lossReason: '' },
      { id: 'v3', name: 'João e Ana', channel: 'Instagram', interest: 'Roteiro Chile', status: 'Proposta', value: 9500, lastMessage: 'Gostamos do roteiro, pode enviar a proposta final?', time: '11:40', avatar: 'JA', score: 91, tags: ['Casal', 'Inverno'], nextAction: 'Acompanhar aceite da proposta', lossReason: '' },
      { id: 'v4', name: 'Carlos Mendes', channel: 'WhatsApp', interest: 'Pacote Gramado', status: 'Perdido', value: 3200, lastMessage: 'Vou pensar e te retorno.', time: 'Ontem', avatar: 'CM', score: 35, tags: ['Família', 'Preço'], nextAction: 'Reativar em 7 dias', lossReason: 'Adiou decisão' },
    ],
    conversations: {
      v1: [
        { from: 'client', text: 'Oi! Vi a viagem para Jericoacoara no Instagram. Qual o valor?', time: '14:02' },
        { from: 'ia', text: 'Olá, Mariana! O pacote para Jericoacoara tem opções a partir de R$ 4.800 para casal, com parcelamento. Você já tem datas em mente?', time: '14:02' },
      ],
      v2: [
        { from: 'client', text: 'Olá! Estou buscando pacote para Noronha em setembro.', time: '13:10' },
        { from: 'ia', text: 'Que ótimo! Setembro é um mês excelente. Quantas pessoas vão viajar e quantas noites pretende ficar?', time: '13:11' },
        { from: 'client', text: 'Somos um casal, 5 noites. Tem opção com parcelamento em 10x?', time: '13:18' },
      ],
      v3: [
        { from: 'client', text: 'Queremos um roteiro no Chile para 7 dias.', time: '11:20' },
        { from: 'ia', text: 'Perfeito! Posso montar um roteiro com Santiago, Valle Nevado e Vinícolas. Prefere foco em neve ou experiências gastronômicas?', time: '11:21' },
        { from: 'client', text: 'Gostamos do roteiro, pode enviar a proposta final?', time: '11:40' },
      ],
      v4: [
        { from: 'client', text: 'Quanto custa o pacote para Gramado?', time: 'Ontem' },
        { from: 'ia', text: 'Temos opções a partir de R$ 3.200 para o período solicitado. Posso incluir passeio e traslado?', time: 'Ontem' },
        { from: 'client', text: 'Vou pensar e te retorno.', time: 'Ontem' },
      ],
    },
  },
  {
    id: 'clinica',
    label: 'Clínica estética',
    description: 'Agendamentos, procedimentos e qualificação de pacientes.',
    settings: { companyName: 'Clínica Vida Plena', segment: 'Clínicas', tone: 'Consultivo e comercial' },
    leads: [
      { id: 'c1', name: 'Patrícia Rocha', channel: 'WhatsApp', interest: 'Avaliação de harmonização facial', status: 'Novo', value: 1800, lastMessage: 'Oi, queria saber valores da harmonização facial.', time: '09:42', avatar: 'PR', score: 74, tags: ['Estética', 'Primeiro contato'], nextAction: 'Qualificar objetivo e agendar avaliação', lossReason: '' },
      { id: 'c2', name: 'Luana Martins', channel: 'Instagram', interest: 'Limpeza de pele + peeling', status: 'Qualificado', value: 450, lastMessage: 'Consigo agendar para sábado de manhã?', time: '09:10', avatar: 'LM', score: 88, tags: ['Agendamento', 'Fim de semana'], nextAction: 'Confirmar horário e enviar preparo', lossReason: '' },
      { id: 'c3', name: 'Renata Silva', channel: 'WhatsApp', interest: 'Pacote depilação a laser', status: 'Proposta', value: 1200, lastMessage: 'Pode me mandar as condições do pacote completo?', time: 'Ontem', avatar: 'RS', score: 90, tags: ['Pacote', 'Recorrente'], nextAction: 'Fechar pacote e forma de pagamento', lossReason: '' },
      { id: 'c4', name: 'Juliana Pires', channel: 'Instagram', interest: 'Botox', status: 'Convertido', value: 950, lastMessage: 'Fechado, vou pagar o sinal agora.', time: 'Ontem', avatar: 'JP', score: 96, tags: ['Convertido', 'Sinal'], nextAction: 'Enviar confirmação do agendamento', lossReason: '' },
    ],
    conversations: {
      c1: [
        { from: 'client', text: 'Oi, queria saber valores da harmonização facial.', time: '09:42' },
        { from: 'ia', text: 'Olá, Patrícia! O valor varia conforme a avaliação e os objetivos. Você busca um resultado mais natural ou mais marcado?', time: '09:43' },
      ],
      c2: [
        { from: 'client', text: 'Vocês fazem limpeza de pele com peeling?', time: '09:05' },
        { from: 'ia', text: 'Fazemos sim! Temos horários nesta semana. Você prefere manhã ou tarde?', time: '09:06' },
        { from: 'client', text: 'Consigo agendar para sábado de manhã?', time: '09:10' },
      ],
      c3: [
        { from: 'client', text: 'Tenho interesse no pacote de depilação a laser.', time: 'Ontem' },
        { from: 'ia', text: 'Ótimo! O pacote completo inclui 6 sessões com acompanhamento. Qual área você quer tratar?', time: 'Ontem' },
        { from: 'client', text: 'Pode me mandar as condições do pacote completo?', time: 'Ontem' },
      ],
      c4: [
        { from: 'client', text: 'Quero agendar botox para esta semana.', time: 'Ontem' },
        { from: 'ia', text: 'Tenho disponibilidade quinta às 15h ou sexta às 10h. Qual prefere?', time: 'Ontem' },
        { from: 'client', text: 'Fechado, vou pagar o sinal agora.', time: 'Ontem' },
      ],
    },
  },
  {
    id: 'imobiliaria',
    label: 'Imobiliária',
    description: 'Qualificação de compradores e agendamento de visitas.',
    settings: { companyName: 'Prime Imóveis', segment: 'Imobiliárias', tone: 'Profissional e amigável' },
    leads: [
      { id: 'i1', name: 'Rodrigo Nunes', channel: 'WhatsApp', interest: 'Apartamento 2 quartos no Centro', status: 'Novo', value: 320000, lastMessage: 'Oi, vi o apto de 2 quartos no Centro. Ainda está disponível?', time: '16:12', avatar: 'RN', score: 70, tags: ['Compra', 'Centro'], nextAction: 'Qualificar orçamento e financiamento', lossReason: '' },
      { id: 'i2', name: 'Camila Torres', channel: 'Instagram', interest: 'Casa em condomínio', status: 'Qualificado', value: 780000, lastMessage: 'Meu orçamento vai até 800 mil, com entrada de 200 mil.', time: '15:30', avatar: 'CT', score: 89, tags: ['Alto valor', 'Entrada'], nextAction: 'Agendar visita ao condomínio', lossReason: '' },
      { id: 'i3', name: 'Eduardo Lima', channel: 'WhatsApp', interest: 'Sala comercial', status: 'Em atendimento', value: 250000, lastMessage: 'Preciso entender as taxas de condomínio e IPTU.', time: '14:05', avatar: 'EL', score: 77, tags: ['Comercial', 'Dúvidas'], nextAction: 'Enviar detalhamento de custos', lossReason: '' },
      { id: 'i4', name: 'Marcos Vieira', channel: 'Instagram', interest: 'Apartamento 3 quartos', status: 'Proposta', value: 540000, lastMessage: 'Quero fazer uma proposta, qual o próximo passo?', time: 'Ontem', avatar: 'MV', score: 92, tags: ['Proposta', 'Financiamento'], nextAction: 'Encaminhar proposta ao vendedor', lossReason: '' },
    ],
    conversations: {
      i1: [
        { from: 'client', text: 'Oi, vi o apto de 2 quartos no Centro. Ainda está disponível?', time: '16:12' },
        { from: 'ia', text: 'Olá, Rodrigo! Está disponível sim. Você busca para moradia ou investimento?', time: '16:13' },
      ],
      i2: [
        { from: 'client', text: 'Procuro casa em condomínio até 800 mil.', time: '15:20' },
        { from: 'ia', text: 'Tenho ótimas opções! Você já tem entrada definida ou pretende financiar parte do valor?', time: '15:21' },
        { from: 'client', text: 'Meu orçamento vai até 800 mil, com entrada de 200 mil.', time: '15:30' },
      ],
      i3: [
        { from: 'client', text: 'Vi a sala comercial na avenida principal.', time: '14:00' },
        { from: 'ia', text: 'Ela é excelente para consultórios e escritórios. Quer saber mais sobre metragem, vagas ou custos mensais?', time: '14:01' },
        { from: 'client', text: 'Preciso entender as taxas de condomínio e IPTU.', time: '14:05' },
      ],
      i4: [
        { from: 'client', text: 'Gostei do apartamento de 3 quartos, quero avançar.', time: 'Ontem' },
        { from: 'ia', text: 'Ótimo! Posso te ajudar com simulação e encaminhar a proposta. Você já tem financiamento pré-aprovado?', time: 'Ontem' },
        { from: 'client', text: 'Quero fazer uma proposta, qual o próximo passo?', time: 'Ontem' },
      ],
    },
  },
];

export const defaultPersonaId = 'viagens';
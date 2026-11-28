# LeadIA — plano de evolução

## Problema e público

Pequenas equipes comerciais recebem contatos por mensagem, qualificam oportunidades e precisam lembrar quem espera resposta, proposta ou retorno. Quando o trabalho fica disperso, o histórico se perde na troca de operador e o gestor tem dificuldade para identificar onde o funil trava.

O LeadIA reúne contatos, histórico, etapa e próxima ação. O piloto deve testar se esse fluxo melhora o acompanhamento e se a equipe consegue operar o painel durante o atendimento.

## Estado atual

| Frente | Evidência | Próximo aceite |
| --- | --- | --- |
| CRM e conta | Cadastro, oito telas acessíveis e lead persistido após nova autenticação | Testar mudança de etapa, registro de conversa e conclusão de follow-up pela interface |
| Acesso em celular | Menu recolhível e retorno ao link após login no ambiente publicado | Testar onboarding com um novo operador |
| WhatsApp | Webhook, fila, integração e testes automatizados disponíveis na dev | Receber texto do celular, responder no WhatsApp e reencontrar a conversa no CRM |
| Claude | Integração no backend com resposta por regra em contingência | Confirmar chamada real, resposta recebida e origem registrada como Claude |
| Analytics | Visões de funil, canais e perdas disponíveis | Substituir a série simulada por uma série de eventos observados |

## Ordem de execução

1. **Validar o canal de teste.** O DevOps confirma que o contêiner consegue acessar o CRM e a Graph API. Um celular autorizado envia uma mensagem de texto. A aceitação da API, a entrega ao celular e a gravação no CRM devem ser verificadas separadamente.
2. **Validar o Claude.** Configurar o modelo no backend e testar interesse, qualificação, objeção, follow-up e encaminhamento humano. O servidor valida o resultado do modelo e aplica as regras do produto.
3. **Revisar a experiência comercial.** Ensaiar criar lead, mover no Kanban, registrar conversa, concluir follow-up e voltar a esses dados após novo login. Dar prioridade aos estados vazios, ao primeiro acesso e à clareza da próxima ação.
4. **Operar um piloto controlado.** Escolher uma equipe e um fluxo comercial, medir uma linha de base e acompanhar os indicadores durante o piloto. Registrar falhas, custo por atendimento e quando a equipe preferiu assumir a conversa.

## Referência de produto

O CRM SVG apresenta uma caixa de entrada para a equipe, agentes com regras e conteúdo próprio, funis configuráveis, agenda, follow-ups automáticos e métricas de atendimento. A referência orienta os fluxos do LeadIA, mantendo a interface e a arquitetura do projeto. [Demonstração](https://www.youtube.com/watch?v=Y9dWPzyO98Q) · [Recursos do CRM SVG](https://www.svgmultimidia.com.br/crm-yt)

| Ordem | Evolução no LeadIA | Critério de aceite |
| --- | --- | --- |
| 1 | Caixa de entrada para operação diária | Buscar por contato, interesse ou última mensagem, combinar filtros e encontrar conversas pausadas para retomar o atendimento |
| 2 | Responsável e ações com prazo | Atribuir atendimento a um membro da organização e ver retornos vencidos ou do dia, com histórico de alterações |
| 3 | Agente configurável e agenda | Editar uma base de perguntas, produtos e regras por organização. Oferecer um horário disponível e confirmar somente após aceite do contato |
| 4 | Automação e gestão | Configurar follow-ups com pausa quando o contato responde, respeitar as regras do canal e medir primeira resposta, avanço no funil e origem de leads quando os eventos estiverem disponíveis |

A homologação do WhatsApp segue como marco do piloto. O primeiro incremento da caixa de entrada usa os registros já carregados no CRM e funciona com leads manuais.

## Indicadores para o piloto

| Indicador | Como medir |
| --- | --- |
| Tempo até a primeira resposta | Mediana entre a primeira mensagem recebida e a primeira resposta enviada |
| Follow-ups cumpridos | Tarefas concluídas até o prazo ÷ tarefas com prazo vencido no período |
| Avanço no funil | Leads que avançaram para a etapa seguinte ÷ leads elegíveis que entraram na etapa no período |
| Encaminhamento humano | Conversas transferidas ÷ conversas atendidas |
| Confiabilidade do canal | Respostas entregues, falhas e pendências por período |

Os benefícios são hipóteses para medir no piloto. Use registros reais da operação como evidência. Apresente métricas simuladas como exemplos.

## Referências

- [CRM no Dokploy](https://devleadia.funilsocial.com.br/)
- [Testes de banco e integração](https://github.com/neosamdez/LeadIA/actions/runs/45741912573)
- [Validação e publicação da interface](https://github.com/neosamdez/LeadIA/actions/runs/45844538418)
- [Runbook do canal de teste](../deploy/whatsapp/README.md)

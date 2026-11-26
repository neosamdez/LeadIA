# LeadIA

O LeadIA reúne leads, conversas, etapas do funil e tarefas de retorno em um CRM para pequenas equipes comerciais que atendem por mensagem.

- **Ambiente com CRM e banco reais:** [LeadIA no Dokploy](https://devleadia.funilsocial.com.br/), branch `dev`.
- **Versão de demonstração:** [LeadIA no GitHub Pages](https://neosamdez.github.io/LeadIA/), publicação independente da branch `main`.

## O que a equipe pode fazer

| Tela | Uso |
| --- | --- |
| Dashboard | Acompanhar leads por etapa, metas e resultados comerciais |
| Leads | Criar contatos, buscar oportunidades e consultar histórico e próxima ação |
| Conversas | Ler o histórico, registrar mensagens e acompanhar o atendimento |
| Pipeline | Acompanhar as etapas Novo, Em atendimento, Qualificado, Proposta, Convertido e Perdido |
| Alertas | Revisar pendências e organizar follow-ups |
| Analytics | Explorar o funil, canais e motivos de perda. O gráfico de evolução simulada serve como exemplo |
| Configurações | Ajustar dados da empresa e opções da organização |

## Estado da entrega

- **CRM validado no navegador:** cadastro, login, logout, acesso às oito telas autenticadas e persistência de um lead após novo login.
- **Interface publicada:** menu móvel recolhível e retorno à rota solicitada após entrar ou criar conta. [CI e deploy](https://github.com/neosamdez/LeadIA/actions/runs/45844538418)
- **WhatsApp em homologação:** webhook, gravação, fila, envio e contingência implementados para o número de teste da Meta. A entrega de uma resposta ao celular com a mesma conversa persistida no CRM ainda depende do ensaio ponta a ponta. [Testes de integração](https://github.com/neosamdez/LeadIA/actions/runs/45741912573)
- **Claude:** integração opcional no servidor. O worker valida o resultado do modelo e aplica regras comerciais. Sem chamada válida ao Claude, o serviço usa respostas por regra. A configuração no Dokploy e o uso do modelo no ensaio estão pendentes de confirmação.

## Rodar localmente

Requer Node.js 22 para reproduzir o runtime do contêiner.

```bash
npm ci
npm run dev
```

O setup padrão abre o modo de demonstração no navegador. Para configurar o modo real, veja o [guia do banco e do frontend no Dokploy](deploy/database/README.md). A chave da Anthropic é variável do serviço de WhatsApp no servidor.

```bash
npm run lint
npm run build
npm run preview
node --test tests/whatsapp.test.mjs
```

## Documentação

- [Plano de evolução e critérios de aceite](docs/PLANO_PROJETO_REAL.md)
- [Ambientes e deploy](deploy/README.md)
- [Banco, autenticação e isolamento dos dados](deploy/database/README.md)
- [Configuração e diagnóstico do WhatsApp de teste](deploy/whatsapp/README.md)

## Apresentar o sistema

Mostre o cadastro, crie um lead fictício, abra o Pipeline e volte ao mesmo lead em uma nova sessão. Use Conversas e Alertas para explicar como a equipe acompanha o histórico e os próximos contatos. Apresente a integração ao vivo pelo celular quando o ensaio confirmar a resposta e a gravação no CRM.

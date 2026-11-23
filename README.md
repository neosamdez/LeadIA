# LeadIA

Projeto acadêmico: **LeadIA – Seu departamento comercial com IA**.

Landing page + painel demo funcional para apresentar a proposta de uma plataforma que automatiza atendimento, qualificação e follow-up de leads para PMEs.

- **Demo online:** https://neosamdez.github.io/LeadIA/
- **Repositório:** https://github.com/neosamdez/LeadIA

## O que tem no projeto

- **Landing page**: proposta de valor, problema, como funciona, segmentos, planos, MVP e FAQ.
- **Painel demo (funcional no front-end)**:
  - Dashboard com métricas simuladas
  - Gestão de leads (filtro, status, criação)
  - Conversas com histórico e envio de mensagens
  - Simulação de resposta da IA
  - Configurações da empresa/IA
  - Persistência local via `localStorage`

> Observação: este projeto é uma demonstração acadêmica. Não há integração real com Instagram/WhatsApp/Meta APIs nem backend.

## Tecnologias

- React + Vite
- React Router
- Lucide React (ícones)
- CSS customizado
- GitHub Actions + GitHub Pages (deploy)

## Como rodar localmente

```bash
npm install
npm run dev
```

Build de produção:

```bash
npm run build
npm run preview
```

## Estrutura

```text
src/
  context/        # estado global + persistência local
  data/           # dados mockados
  layouts/        # layout do painel
  pages/          # Landing, Login, Dashboard, Leads, Conversas, Configurações
.github/workflows # deploy para GitHub Pages
```

## Roteiro sugerido para apresentação

1. Mostrar a **landing page** e o problema que o LeadIA resolve.
2. Clicar em **Acessar demo** e entrar no painel.
3. No **Dashboard**, destacar métricas de atendimento e conversão.
4. Em **Leads**, filtrar, alterar status e criar um lead ao vivo.
5. Em **Conversas**, abrir um lead e usar **Simular resposta IA** para mostrar o fluxo comercial.
6. Em **Configurações**, ajustar tom da IA/follow-up e mostrar o reset da demo.
7. Fechar com diferenciais, modelo de negócio, LGPD e próximos passos.

## Como melhorar ainda mais para apresentar o app

### 1. Melhorias rápidas para a apresentação (alto impacto)

- **Modo apresentação guiado**: botão “Iniciar tour” com passos destacando Dashboard → Leads → Conversas → Configurações.
- **Dados demo mais ricos**: adicionar mais leads, canais, etiquetas, motivos de perda e histórico temporal para os gráficos ficarem mais convincentes.
- **Cenários prontos**: botões como “Simular novo lead do Instagram”, “Simular objeção de preço” e “Simular conversão” para demonstrar ao vivo sem digitar muito.
- **Tela de resumo executivo**: slide/página com problema, solução, mercado, diferencial, modelo de negócio e roadmap em 1 minuto.
- **Capturas/GIFs no README**: incluir imagens do fluxo principal para quem abrir o repositório antes da apresentação.

### 2. Melhorias de produto (experiência do usuário)

- **Funil visual**: gráfico de funil (Novo → Qualificado → Proposta → Convertido) e taxa por etapa.
- **Detalhe do lead**: página/modal com timeline completa, notas do vendedor, tarefas e próximos passos.
- **Filtros avançados**: filtrar por canal, período, valor estimado, responsável e status.
- **Respostas sugeridas pela IA**: botões de sugestão (“Enviar proposta”, “Responder objeção”, “Agendar call”).
- **Notificações**: alertas de leads quentes, leads sem resposta e follow-ups pendentes.
- **Acessibilidade e polish**: navegação por teclado, estados vazios, feedbacks de carregamento e refinamento mobile.

### 3. Melhorias técnicas (para dar mais credibilidade)

- **Backend real**: API (Node/FastAPI) + banco (PostgreSQL/Supabase) para persistir leads e mensagens.
- **Autenticação real**: login com contas, papéis (admin/vendedor) e proteção de rotas.
- **Integrações oficiais**: conectar Instagram/WhatsApp via APIs oficiais da Meta, com webhooks e filas.
- **IA real**: integração com LLM usando base de conhecimento da empresa (RAG), guardrails e handoff para humano.
- **Testes e qualidade**: testes unitários/e2e (Vitest/Playwright), lint no CI e monitoramento de erros.
- **Observabilidade**: logs, métricas de latência de resposta, taxa de conversão e auditoria de ações.

### 4. Melhorias de negócio (para a banca)

- **Validação de mercado**: incluir pesquisa com PMEs, personas, dores validadas e hipóteses testadas.
- **Métricas de negócio**: CAC, LTV, churn estimado, payback e projeção de receita por plano.
- **Comparativo competitivo**: tabela comparando LeadIA com chatbots comuns, CRMs e atendimento manual.
- **Estratégia de MVP**: definir claramente o que é MVP, o que é simulado e o que entra nas próximas versões.
- **Conformidade**: aprofundar LGPD, consentimento, retenção de dados, segurança e limites das APIs da Meta.

## Próximos passos sugeridos (roadmap)

1. **V1 (demo forte)**: tour guiado, cenários prontos, funil visual e página de detalhe do lead.
2. **V2 (MVP técnico)**: backend + auth + banco + CRUD real de leads/conversas.
3. **V3 (produto piloto)**: integração com canal oficial, IA com base de conhecimento e dashboard com dados reais.
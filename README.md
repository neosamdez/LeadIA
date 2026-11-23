# LeadIA

Projeto acadêmico: **LeadIA – Seu departamento comercial com IA**.

Landing page + painel demo funcional para apresentar a proposta de uma plataforma que automatiza atendimento, qualificação e follow-up de leads para PMEs.

- **Demo online:** https://neosamdez.github.io/LeadIA/
- **Repositório:** https://github.com/neosamdez/LeadIA

## O que tem no projeto

- **Landing page**: proposta de valor, problema, como funciona, segmentos, planos, MVP e FAQ.
- **Painel demo (funcional no front-end)**:
  - Dashboard com métricas simuladas e **funil comercial**
  - **Analytics profissional**: gráficos interativos (Recharts) com troca de tipo (barras/linha/área/pizza), funil, canais, motivos de perda e evolução simulada
  - **Detalhe do lead**: drawer com score de conversão, tags, próxima ação sugerida, motivo de perda e timeline
  - **Conversas com IA mais realista**: sugestões contextuais, detecção de objeção, typing indicator e handoff humano
  - **Cenários prontos** para apresentação (novo lead, objeção de preço, conversão)
  - **Tour guiado** pelo painel (Dashboard → Leads → Conversas → Analytics → Configurações)
  - **Resumo executivo** em modal (demo) e seção na landing
  - Gestão de leads (filtro, status, criação)
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

1. Mostrar a **landing page**, o problema e a seção **Resumo executivo em 1 minuto**.
2. Clicar em **Acessar demo** e entrar no painel.
3. No **Dashboard**, clicar em **Iniciar tour** para guiar a banca pelo fluxo.
4. Usar os **Cenários prontos** (novo lead, objeção, conversão) para demonstrar ao vivo.
5. Mostrar o **Funil comercial** e as métricas de conversão/receita.
6. Em **Leads/Conversas**, ajustar status e usar **Simular resposta IA**.
7. Fechar com diferenciais, modelo de negócio, LGPD e próximos passos.

## Como melhorar ainda mais para apresentar o app

### 1. Melhorias rápidas para a apresentação (alto impacto)

- [x] **Modo apresentação guiado**: botão “Iniciar tour” com passos destacando Dashboard → Leads → Conversas → Configurações.
- [x] **Cenários prontos**: botões “Simular novo lead do Instagram”, “Simular objeção de preço” e “Simular conversão”.
- [x] **Funil visual**: funil comercial no Dashboard (Novo → Qualificado → Proposta → Convertido).
- [x] **Resumo executivo**: seção na landing e modal no painel com problema, solução, público, diferencial, modelo e roadmap.
- [ ] **Dados demo mais ricos**: adicionar mais leads, canais, etiquetas, motivos de perda e histórico temporal para gráficos mais convincentes.
- [ ] **Capturas/GIFs no README**: incluir imagens do fluxo principal para quem abrir o repositório antes da apresentação.

### 2. Melhorias de produto (experiência do usuário)

- [x] **Funil visual**: gráfico de funil e visão por etapa.
- [x] **Detalhe do lead**: drawer com timeline, score, tags, próxima ação e motivo de perda.
- [x] **Respostas sugeridas pela IA**: sugestões contextuais, objeção de preço, handoff humano e typing indicator.
- [x] **Analytics comercial**: desempenho por canal, motivos de perda e recomendações.
- [ ] **Filtros avançados**: filtrar por canal, período, valor estimado, responsável e status.
- [ ] **Notificações**: alertas de leads quentes, leads sem resposta e follow-ups pendentes.

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
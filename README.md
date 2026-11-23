# LeadIA

Projeto acadêmico: **LeadIA – Seu departamento comercial com IA**.

Landing page + painel demo funcional para apresentar a proposta de uma plataforma que automatiza atendimento, qualificação e follow-up de leads para PMEs.

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

## Como rodar

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
```

## Roteiro sugerido para apresentação

1. Mostrar a **landing page** e o problema que o LeadIA resolve.
2. Clicar em **Acessar demo**.
3. Entrar no **Dashboard** e mostrar métricas.
4. Abrir **Leads** e mudar status/criar lead.
5. Abrir **Conversas**, selecionar um lead e usar **Simular resposta IA**.
6. Mostrar **Configurações** (tom da IA, follow-up, reset demo).
7. Fechar com diferenciais, LGPD e modelo de negócio.
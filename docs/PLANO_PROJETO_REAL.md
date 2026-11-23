# LeadIA — Plano de ação para projeto real

## Objetivo
Transformar o LeadIA de **demo front-end (localStorage)** em um **produto real multiempresa** para atendimento comercial com IA (WhatsApp/Instagram), com dados persistentes, autenticação, segurança e operação.

## Estado atual (base)
- Front-end: Vite + React + React Router + Recharts + Lucide.
- Dados: `localStorage` (leads, conversas, eventos, metas, alertas, follow-ups).
- IA: NVIDIA NIM via proxy Cloudflare Worker; chave configurável no browser (demo).
- Deploy: GitHub Pages.
- Limitações: sem backend, sem auth real, sem banco, sem integrações reais, sem multi-tenancy, sem auditoria.

## Decisões recomendadas (MVP real)
| Área | Decisão MVP | Motivo |
|---|---|---|
| Front-end | Manter **Vite + React** no MVP, preparar migração futura para Next.js se precisar SSR/SEO/app router | Menor reescrita, aproveita o que já existe |
| Backend/BaaS | **Supabase** (Postgres + Auth + RLS + Edge Functions + Storage) | Velocidade, Postgres real, Auth, RLS, bom custo MVP |
| IA | Chamada NVIDIA **server-side** (Supabase Edge Function/proxy backend) | Remove chave do browser, permite rate limit/log/auditoria |
| Deploy | Front-end em **Vercel/Cloudflare Pages**; Supabase gerenciado | CI/CD simples, env seguro |
| Integrações | Fase 2: WhatsApp Business Cloud API / Instagram Messaging via webhooks | Complexidade e aprovação Meta |
| Observabilidade | Sentry + logs estruturados + métricas básicas | Operação mínima |

> Assunção: MVP real = um cliente/empresa usando com dados reais, antes de escalar para SaaS multiempresa completo.

## Fases

### Fase 0 — Planejamento e base (agora)
- [x] Levantar estado atual e lacunas.
- [ ] Definir escopo MVP real (quem usa, qual canal, qual fluxo crítico).
- [ ] Criar projeto Supabase e configurar `.env.example`.
- [ ] Definir modelo de dados e RLS.
- [ ] Criar camada de cliente Supabase no front.

**Entregáveis:** plano, schema SQL, `.env.example`, cliente Supabase, ADR inicial.

### Fase 1 — Fundação do produto (MVP real)
- [ ] **Auth real**: login/cadastro/magic link ou e-mail+senha, sessão, logout, proteção de rotas.
- [ ] **Organização/empresa**: `organizations`, `profiles`, membership.
- [ ] **Banco de dados**: migrar entidades do localStorage para Postgres.
- [ ] **CRUD Leads**: criar, editar, excluir, listar, filtros, status, score.
- [ ] **Conversas e mensagens**: persistir conversas/mensagens/eventos.
- [ ] **Configurações**: configurações por organização, sem chave sensível no browser.
- [ ] **IA server-side**: Edge Function para NVIDIA, rate limit, logs, fallback.
- [ ] **Migração/demo mode**: modo demo opcional ou importação inicial.

**Critério de aceite:** usuário autentica, cria/edita lead, conversa é persistida, IA responde via backend, dados sobrevivem refresh/dispositivo.

### Fase 2 — Operação comercial
- [ ] Pipeline/Kanban persistido.
- [ ] Alertas e follow-ups persistidos com agendamento.
- [ ] Metas por organização/período.
- [ ] Timeline/auditoria completa.
- [ ] Proposta/exportação PDF/compartilhamento.
- [ ] Permissões (admin, consultor, viewer).
- [ ] Testes E2E (Playwright) e unitários.

### Fase 3 — Integrações reais
- [ ] WhatsApp Business Cloud API (webhook inbound/outbound).
- [ ] Instagram Messaging/Direct (Meta).
- [ ] CRM externo (HubSpot/Pipedrive) ou CRM nativo simples.
- [ ] Agenda/calendário.
- [ ] Notificações (e-mail/push/Slack).

### Fase 4 — Escala e SaaS
- [ ] Multiempresa robusto + billing (Stripe).
- [ ] Onboarding.
- [ ] Observabilidade completa (Sentry, logs, métricas, traces).
- [ ] LGPD: consentimento, retenção, exclusão, trilha de auditoria.
- [ ] Avaliação de IA, guardrails, custo por conversa.

## Modelo de dados inicial (Supabase/Postgres)

```sql
-- organizations
id uuid pk, name text, slug text unique, created_at timestamptz

-- profiles (auth.users)
id uuid pk references auth.users, full_name text, avatar_url text, created_at timestamptz

-- memberships
id uuid pk, org_id uuid fk, user_id uuid fk, role text check in ('owner','admin','member'), created_at timestamptz

-- leads
id uuid pk, org_id uuid fk, owner_id uuid fk, name text, company text, channel text, status text, score int, interest text, last_message text, avatar text, tags text[], created_at timestamptz, updated_at timestamptz

-- conversations
id uuid pk, org_id uuid fk, lead_id uuid fk, status text, created_at timestamptz, updated_at timestamptz

-- messages
id uuid pk, org_id uuid fk, conversation_id uuid fk, lead_id uuid fk, sender text check in ('client','ia','consultor','system'), content text, meta jsonb, created_at timestamptz

-- lead_events
id uuid pk, org_id uuid fk, lead_id uuid fk, type text, text text, meta jsonb, created_by uuid, created_at timestamptz

-- follow_ups
id uuid pk, org_id uuid fk, lead_id uuid fk, title text, note text, due_at timestamptz, status text, created_by uuid, created_at timestamptz

-- goals
id uuid pk, org_id uuid fk, period text, target_leads int, target_conversion numeric, target_response_minutes int, created_at timestamptz

-- settings
org_id uuid pk, nvidia_model text, nvidia_proxy_url text, ai_enabled boolean, created_at timestamptz, updated_at timestamptz
```

## RLS (princípios)
- Toda tabela com `org_id` tem RLS habilitado.
- Usuário só lê/escreve linhas da organização onde tem membership ativa.
- `profiles`: usuário lê/edita o próprio perfil.
- Chaves sensíveis (NVIDIA API key) **nunca** no front; usar secret de Edge Function.

## Backlog técnico imediato (ataque)
1. **Criar `.env.example` e camada de config** para Supabase + app.
2. **Adicionar `@supabase/supabase-js`** e criar `src/lib/supabase.js`.
3. **Criar schema SQL inicial** em `supabase/schema.sql` (tabelas, índices, RLS, triggers).
4. **Criar serviço de auth** e adaptar `AppContext`/login para modo real + fallback demo.
5. **Criar camada de repositório** (leads/conversations/messages) com interface comum: localStorage hoje, Supabase amanhã.
6. **Mover IA para Edge Function** (ou endpoint backend) com contrato compatível.
7. **Adicionar testes smoke** e script de migração/importação.

## Riscos e mitigação
- **Escopo grande**: cortar MVP em fluxo único (captura lead → conversa IA → qualificação → follow-up).
- **Integração Meta complexa**: deixar para Fase 3; usar canal web/chat interno no MVP.
- **Migração de dados demo**: manter modo demo separado do modo real.
- **Segurança da chave NVIDIA**: bloquear uso de chave no browser no modo real.

## Definição de MVP real pronto
- Auth real + organização.
- Leads e conversas persistidos em Postgres.
- IA respondendo via server-side.
- Dashboard/Kanban/Alertas lendo dados reais.
- Deploy com env seguro.
- Teste E2E do fluxo principal passando.

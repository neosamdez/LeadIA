# Deploy no Dokploy

O LeadIA usa o projeto `thiago-dev`. O ambiente ativo com CRM real está em [devleadia.funilsocial.com.br](https://devleadia.funilsocial.com.br/).

| Origem | Destino | Situação |
| --- | --- | --- |
| `dev` | `leadia-dev`, frontend no Dokploy | Ambiente de uso e homologação |
| `dev` | `leadia-db-dev`, Compose de banco | PostgreSQL, autenticação, API e gateway interno |
| `dev` | `leadia-whatsapp-dev`, Compose do webhook e worker | Número de teste e ensaio de ponta a ponta em homologação |
| `main` | GitHub Pages | Publicação de demonstração independente |
| `main` | `leadia-prod`, frontend no Dokploy | Destino previsto no workflow. URL pública sem confirmação |

## Frontend

O workflow `LeadIA CI/CD` executa lint, build Docker e testes de saúde, rotas e assets. Em pushes para `dev` ou `main`, chama o webhook do ambiente. Pull requests executam a validação. O frontend usa a porta interna 80 e recebe a configuração de modo real em runtime no Dokploy.

Após publicar:

1. Confirme o SHA do deploy na aba **Deployments**.
2. Verifique `/healthz` para a aplicação e `/api/healthz` para o gateway do CRM.
3. Abra uma rota protegida em uma sessão sem login. Autentique e confirme que o painel retorna à rota solicitada.
4. Em mudanças de fluxo, rode o ensaio com uma organização isolada e dados fictícios.

## Banco e WhatsApp

A publicação do frontend e a aplicação de mudanças no banco ou no worker têm etapas próprias. Consulte os runbooks de [banco e autenticação](database/README.md) e [WhatsApp](whatsapp/README.md). Mantenha os segredos nos ambientes correspondentes do GitHub Actions ou do Dokploy.

## Piloto gerenciado

O piloto usa um projeto Supabase separado em modo real, um site Cloudflare
Pages e um Web Service Render. Valide primeiro com dados fictícios e convite
para usuários de ensaio. Mantenha o cadastro público desabilitado enquanto
o endpoint de IA aceitar qualquer sessão válida do projeto.

1. Em um banco Supabase novo, aplique `supabase/schema.sql` e depois
   `supabase/migrations/001_whatsapp.sql` até
   `005_ad_integrations.sql` e `006_evolution_whatsapp.sql` em ordem. Configure a URL do app nas opções
   de Auth e convide um usuário de ensaio quando ela estiver disponível.
2. No Render, use o Blueprint `render.yaml` para criar o serviço Free.
   Configure `AI_AUTH_URL=https://<projeto>.supabase.co/auth/v1`,
   `SUPABASE_PUBLISHABLE_KEY` e `ANTHROPIC_API_KEY` no Environment.
   Configure `CLAUDE_MODEL` com um Haiku habilitado na conta. O Blueprint
   começa com `WHATSAPP_ENABLED=false` para permitir a verificação de IA
   antes de conectar o número de teste.
3. Na Cloudflare, conecte o repositório ao Pages, selecione a branch do
   piloto, use `npm exec -- vite build` e publique `dist`. Esse comando
   omite o `404.html` do GitHub Pages e permite que o Pages sirva as rotas
   do React em acessos diretos. Configure
   `VITE_APP_MODE=real`, `VITE_SUPABASE_URL` e
   `VITE_SUPABASE_ANON_KEY` com a chave publicável. Nas variáveis de
   execução das Pages Functions, configure `LEADIA_AI_ORIGIN` com a
   origem HTTPS do Render. A função encaminha a rota de IA no próprio
   domínio do app.
4. Confira `/healthz` no Render e faça um POST em `/ai/v1/complete` no
   Pages sem token. Com o Claude configurado, espere HTTP 401. Entre com
   o usuário de ensaio e valide a criação de lead, o Kanban,
   **Gerar com IA** em Agentes, as sugestões em Conversas e a persistência
   após recarregar.
5. Para validar WhatsApp, siga o [runbook](whatsapp/README.md) com um número
   de teste da Meta. No Render, use `WHATSAPP_CRM_URL` com a origem do
   Supabase e configure as demais variáveis do runbook. Confirme que o
   token restrito com papel `leadia_whatsapp` é aceito pelo Supabase
   gerenciado. Depois habilite `WHATSAPP_ENABLED=true` no Blueprint e
   no serviço e teste recebimento, resposta e histórico.

O Render Free suspende o processo quando fica sem tráfego de entrada. Ensaie
o WhatsApp com o serviço ativo e use compute contínuo antes de depender do
worker para atendimento. O painel do Supabase e o Render guardam as
credenciais de servidor. Nas variáveis `VITE_*`, use apenas configuração
pública.

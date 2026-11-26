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

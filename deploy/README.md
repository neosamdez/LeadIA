# Deploy Dokploy

Os serviços ficam exclusivamente no projeto `thiago-dev`.

| Branch | Ambiente | Serviço | Secret GitHub Actions |
|---|---|---|---|
| `dev` | `dev` | `leadia-dev` | `DOKPLOY_WEBHOOK_DEV` |
| `main` | `prod` | `leadia-prod` | `DOKPLOY_WEBHOOK_PROD` |

O workflow `LeadIA CI/CD` executa lint, constrói a imagem e verifica saúde,
fallback de rotas SPA e assets antes de chamar o webhook do ambiente.
Pull requests validam sem disparar deploy. Para promover, faça PR de `dev` para
`main`. Os webhooks devem ficar somente em secrets, nunca no código.

No Dokploy, usar origem Git pública, branch correspondente, Dockerfile na raiz,
porta interna 80 e domínio gerado. Manter autodeploy habilitado para receber o
webhook; não configurar um webhook direto de push que ignore o CI.

O container atende o modo demo, com persistência local no navegador. Não inclui
credenciais Supabase/NVIDIA, nem aplica migrações. Cada origem mantém seu próprio
localStorage. O deploy existente do GitHub Pages permanece independente.

# Banco do LeadIA no Dokploy

Criar um Compose por ambiente, exclusivamente no projeto `thiago-dev`.
Usar o repositório LeadIA, branch correspondente e `deploy/database/compose.yml`.
Os caminhos relativos são resolvidos a partir desse arquivo.

Serviços: PostgreSQL 17, GoTrue (autenticação), migração, PostgREST (API),
gateway interno e backup diário. Só o gateway participa de `dokploy-network`;
banco e autenticação ficam na rede privada do Compose. Não há portas publicadas.

Definir no Compose as variáveis de `.env.example`, usando segredos distintos
em dev e prod. As senhas e o segredo JWT nunca entram no repositório, frontend
ou logs. `API_ALIAS` deve ser `leadia-dev-backend` ou `leadia-prod-backend`.
`SITE_URL` é a origem HTTPS da plataforma, sem barra ao final.

No serviço frontend, configurar em runtime:

```dotenv
APP_MODE=real
LEADIA_API_HOST=leadia-dev-backend:8000
PUBLIC_SUPABASE_ANON_KEY=token-JWT-com-role-anon
```

O token anon é público, não concede acesso às tabelas. É assinado pelo segredo
JWT do ambiente com `role=anon` e `aud=authenticated`. Dados exigem sessão válida,
membership e RLS. Não colocar `JWT_SECRET` ou token `service_role` no frontend.
O frontend usa a própria origem para `/auth/v1` e `/rest/v1`; `/api/healthz`
verifica a disponibilidade da API/banco. `/healthz` verifica o Nginx frontend.

O bootstrap da organização é uma transação no banco. Memberships não aceitam
inserções/alterações pelo cliente. Viewer lê, membros escrevem dados comerciais,
owner/admin alteram configurações. Chaves compostas impedem associar mensagens,
conversas e follow-ups a leads de outra organização. A interface só confirma
uma alteração depois da gravação e mostra falhas sem fallback para dados demo.

Sem SMTP, o primeiro deploy usa cadastro por e-mail/senha **sem verificar a posse
do e-mail** (`EMAIL_AUTOCONFIRM=true`). Recuperação por e-mail exige configurar
SMTP no GoTrue. Pode-se fechar novos cadastros com `DISABLE_SIGNUP=true` após
cadastrar os usuários desejados. Nenhuma mensagem WhatsApp é enviada nesta etapa.

O volume `pgdata` mantém os dados entre recriações. O serviço backup cria um dump
diário no volume `backups`, valida seu catálogo e mantém sete dias. É uma cópia
no mesmo servidor; backup externo ainda exige um destino aprovado.
Para restaurar, criar outro banco vazio, executar `pg_restore` do dump e validar
antes de trocar a aplicação. Não remover volumes para atualizar/reimplantar.

Para mudanças futuras no schema: revisar migração, validar em dev, criar backup,
reimplantar o Compose do banco (migrate precisa terminar com código 0), verificar
gateway e então publicar frontend. O CI/CD do frontend não substitui esse passo.

Para a atribuição de conversas, o Compose aplica também a migração 002_lead_assignment.sql. Ao aplicar a migração, o banco disponibiliza list_lead_assignees. O controle de atribuição aparece no frontend depois que essa função estiver disponível. Em uma organização de teste, atribua um lead a um membro, recarregue a conversa e confira o registro na Timeline. A alteração fica vinculada à organização do lead.

Para o contexto da organização, o Compose aplica a migração 003_org_context.sql. Ela adiciona a org_settings a proposta de valor, o público, as ofertas, o idioma, o fuso, o horário, as restrições, quem assume conversas e a prioridade do mês. O banco valida o fuso e o responsável e registra quem alterou o contexto. Antes de aplicar, faça backup. Depois do redeploy do DB Compose, abra Configurações > Contexto do negócio como owner ou admin, salve, recarregue e confira a prioridade na tela Hoje. Enquanto a 003 não estiver aplicada, o frontend mostra o aviso de migração pendente no lugar do formulário.

Para os agentes, o Compose aplica a migração 004_agents.sql. Ela cria agents (rascunho por organização) e agent_revisions (revisões publicadas, imutáveis, com cópia do contexto do negócio). Só owner ou admin editam, publicam e restauram; restaurar cria uma revisão nova e não apaga o histórico. Publicar não liga envio automático em canal. Depois do redeploy do DB Compose, abra Agentes como owner ou admin, salve o rascunho, publique e confira a revisão na lista.

## Validação de SQL

Usar somente PostgreSQL descartável, banco terminado em `_test`:

```sh
TEST_DATABASE_URL=postgres://postgres:postgres@localhost:5432/leadia_test sh tests/run-database.sh
```

A suíte reaplica a migração e verifica bootstrap idempotente, persistência,
transação de mensagens, isolamento entre organizações, tentativa de autoelevar
membership, vínculos entre organizações, acesso de viewer e acesso anônimo.
O teste SQL usa uma tabela `auth.users` mínima; cadastro/sessão reais precisam
também ser verificados contra GoTrue no ambiente dev implantado.

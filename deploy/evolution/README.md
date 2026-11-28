# Evolution API para o LeadIA

Este Compose hospeda a Evolution API v2.3.8 no Dokploy. Ele usa PostgreSQL,
Redis e volumes nomeados para preservar dados e sessões do WhatsApp após
reinícios. O banco e o Redis ficam somente na rede privada do Compose. A API
fica também na rede `dokploy-network`, com alias `leadia-evolution-api` para
o serviço adaptador.

## Recursos necessários

Use uma VPS/Dokploy com pelo menos 2 GB de RAM livre para este conjunto de
serviços e armazenamento persistente. O Compose não publica portas do banco,
Redis ou API no host. Atribua HTTPS ao `evolution-api` pela porta 8080 no
Dokploy. Faça backup dos volumes `evolution_instances` e `evolution_postgres`.

## Instalação

1. Publique `deploy/evolution/compose.yml` em um projeto Dokploy conectado à
   rede compartilhada `dokploy-network`.
2. Cadastre as variáveis de `deploy/evolution/.env.example` no painel privado
   do Dokploy. Gere API key e senha de banco aleatórias e mantenha-as somente
   no ambiente do serviço.
3. Aplique o Compose e associe um domínio HTTPS ao serviço `evolution-api`.
4. Acesse o manager, crie uma instância Baileys de teste e faça o pareamento
   escaneando o QR em WhatsApp → Dispositivos conectados. Use um número de
   teste autorizado. Não compartilhe nem versione o QR ou a sessão.
5. Cadastre o canal Evolution no banco de dev com `provider='evolution'`, o
   nome exato da instância, a organização de ensaio e apenas o número de
   destino autorizado. Gere uma credencial JWT exclusiva para esse canal,
   seguindo `deploy/whatsapp/README.md`.
6. Publique `deploy/whatsapp/compose.evolution.yml` em um segundo serviço
   Dokploy com o token do canal, `EVOLUTION_API_URL=http://leadia-evolution-api:8080`,
   a API key e um token webhook aleatório. Atribua domínio HTTPS ao adaptador.
7. Configure o webhook da instância pela API, substituindo os valores no
   ambiente seguro (não grave a chamada com segredos no histórico do shell):

   ```bash
   curl -X POST "$EVOLUTION_SERVER_URL/event/webhook/set/$EVOLUTION_INSTANCE" \
     -H "apikey: $EVOLUTION_API_KEY" -H "content-type: application/json" \
     -d "{\"webhook\":{\"enabled\":true,\"url\":\"https://DOMINIO_DO_ADAPTADOR/webhooks/evolution\",\"headers\":{\"Authorization\":\"Bearer ${EVOLUTION_WEBHOOK_TOKEN}\"},\"events\":[\"MESSAGES_UPSERT\",\"MESSAGES_UPDATE\"],\"byEvents\":false,\"base64\":false}}"
   ```

Com os serviços ativos, `/healthz` no adaptador deve retornar `ok`. Envie uma
mensagem do número autorizado para o WhatsApp pareado e confirme a entrada,
resposta e estado da entrega em Conversas. O worker grava a decisão antes de
chamar a Evolution; timeout de envio fica como incerto e não é reenviado
automaticamente.

## Limitações e operação

- O número é pareado por WhatsApp Web via Baileys; desconexão ou expiração da
  sessão exige novo pareamento manual.
- Evolution não é a API oficial da Meta. Avalie os termos e riscos para o
  número usado. Comece com número de teste e destinatários autorizados.
- A porta pública da API exige chave de autenticação. Se possível, restrinja
  o acesso no Dokploy e mantenha o tráfego interno do adaptador na rede privada.
- Não use armazenamento efêmero: perder `evolution_instances` pode exigir
  parear o aparelho de novo.

## Canal no CRM e adaptador

Depois de aplicar `supabase/migrations/006_evolution_whatsapp.sql`, crie o
canal com a organização de ensaio e somente os números autorizados:

```sql
insert into whatsapp_private.channels
  (org_id, provider, evolution_instance, recipients)
values
  ('UUID_ORGANIZACAO', 'evolution', 'NOME_DA_INSTANCIA', array['DESTINATARIO_AUTORIZADO'])
returning id;
```

Assine um JWT `leadia_whatsapp`, `aud=authenticated`, `channel_id` igual ao
UUID retornado e validade curta para o ensaio, conforme `deploy/whatsapp/README.md`.
Use um token exclusivo para este canal. Publique `deploy/whatsapp/compose.evolution.yml`
como serviço independente no Dokploy, com `EVOLUTION_API_URL` apontando para
`http://leadia-evolution-api:8080`, a API key e um `EVOLUTION_WEBHOOK_TOKEN`
aleatório. Atribua HTTPS à porta 3000 do adaptador e configure na instância a
URL `/webhooks/evolution`, eventos `MESSAGES_UPSERT` e `MESSAGES_UPDATE`,
`webhook_by_events=false` e o cabeçalho
`Authorization: Bearer EVOLUTION_WEBHOOK_TOKEN`.

Confirme `/healthz`, envie mensagem só do número permitido e valide a resposta
no aparelho e em Conversas. Falha de rede após o envio fica como incerta e não
é reenviada automaticamente. O pareamento por QR deve ser feito manualmente
pelo titular do número de teste.

# WhatsApp de teste do LeadIA

Destino exclusivo: Dokploy → thiago-dev → dev. O GitHub Actions publica o
frontend de dev. Aplique a migração do banco e publique o Compose do WhatsApp
no Dokploy como serviços próprios, com o mesmo commit de dev.

## Implantação

1. Confirme o backup da dev. Reimplante leadia-db-dev pela branch dev e
   confira a saída zero de migrate, a saúde do gateway e a migração
   supabase/migrations/001_whatsapp.sql.
2. Use uma organização de ensaio. No console privado do PostgreSQL da dev,
   cadastre o ID da organização, o Phone Number ID oficial de teste da Meta
   e os números autorizados em formato internacional, apenas dígitos. Use
   os mesmos destinatários na Meta e no Compose. A coluna enabled é a pausa
   global do canal.

   ```sql
   insert into whatsapp_private.channels (org_id, phone_number_id, recipients)
   values ('UUID_ORGANIZACAO', 'ID_NUMERO_META', array['DESTINATARIO_AUTORIZADO'])
   returning id;
   ```

3. Assine um JWT de integração com o JWT_SECRET da dev, em ambiente seguro.
   Use HS256, role leadia_whatsapp, aud authenticated, channel_id igual ao
   UUID devolvido no passo anterior e exp limitado ao ensaio. Omita sub.
   Configure apenas o token assinado no webhook. Mantenha JWT_SECRET e
   credenciais administrativas no banco. Sem um canal habilitado, o token
   não permite receber nem enviar mensagens.

4. Crie um Compose leadia-whatsapp-dev dentro de thiago-dev → dev, com
   branch dev e arquivo deploy/whatsapp/compose.yml. Associe no Dokploy um
   domínio HTTPS ao serviço webhook na porta 3000. Configure no ambiente
   do serviço:

   - WHATSAPP_VERIFY_TOKEN, valor aleatório exclusivo para validar o callback.
   - META_APP_SECRET, segredo do app de teste.
   - WHATSAPP_PHONE_NUMBER_ID, ID do número oficial de teste.
   - WHATSAPP_TEST_RECIPIENTS, lista de destinatários autorizados, separada por vírgulas.
   - META_GRAPH_VERSION, versão da Graph API exibida na configuração do app.
   - WHATSAPP_ACCESS_TOKEN, token válido para o envio pelo número de teste.
   - WHATSAPP_CRM_TOKEN, JWT de integração do passo 3.
   - ANTHROPIC_API_KEY e CLAUDE_MODEL, opcionais. Use chave autorizada com
     orçamento definido na Anthropic e um modelo Haiku habilitado na conta.
     Sem chave, o serviço opera por regras. Em erro do Claude, registra o
     fallback e mantém o atendimento por regras.

5. Valide /healthz e configure o callback HTTPS /webhooks/whatsapp na Meta.
   Use o verify token configurado no Compose e assine o campo messages.
   Habilite somente o canal de ensaio no banco:

   ```sql
   update whatsapp_private.channels set enabled = true where id = 'UUID_CANAL';
   ```

## Verificação e pausa

Use o app e número de teste da Meta e um celular autorizado. Envie o teste
inicial pelo painel da Meta, responda pelo celular e confirme a resposta
no aparelho. Confira o mesmo lead em Conversas e Kanban após recarregar
e o follow-up interno em Alertas. Em Conversas, as mensagens exibem o
estado informado pela Meta. Aceita pela Meta indica aceite da API. Entregue
e Lida são notificações posteriores do provedor.

Para intervenção humana, use Pausar automação ou Retomar automação na
conversa. As notas do operador são internas. Para interromper o canal inteiro,
ajuste enabled para false no canal. Mensagens com entrega incerta são
registradas e reconciliadas com a notificação da Meta, sem reenvio automático.

Os logs registram eventos e IDs parciais. Guarde o link do GitHub Actions,
o SHA e os IDs de deploy. Não coloque tokens, chaves, nomes nem números
de ensaio no Git ou no relatório.

## Antes de um ensaio no celular

1. Confirme que o webhook está publicado e que a Meta validou o callback e a inscrição em `messages`.
2. Confirme de dentro do serviço o acesso ao CRM com a credencial do canal e à Graph API com a credencial de envio. Verifique a validade de ambas para o período do ensaio.
3. Para testar o Claude, preencha `ANTHROPIC_API_KEY` e `CLAUDE_MODEL` no **Environment** do Compose e reaplique o deploy. Com chave configurada, o serviço exige um modelo com prefixo `claude-haiku-`.
4. Faça o teste com o número da Meta e um celular autorizado. Anote o horário e o ID parcial para correlacionar os registros. Observar `whatsapp_inbound` com `stored` confirma a gravação da entrada. Confirme a resposta no aparelho e recarregue Conversas na organização de ensaio.

Se a entrada não aparecer, confira a tentativa de entrega na Meta e compare o Phone Number ID e o remetente recebido com os valores permitidos no Compose e no canal do banco. Se a entrada for gravada e a resposta não chegar, confira a fila, a resposta da Graph API e o estado de entrega. Verifique a origem da resposta quando o cenário depende do Claude.

# Verificação do webhook WhatsApp na dev

Crie um Compose separado no projeto `thiago-dev` do Dokploy com este arquivo.
Na aba Domains, associe um host HTTPS ao serviço `webhook` na porta 3000.
Configure `META_APP_SECRET`, `WHATSAPP_PHONE_NUMBER_ID` do número de teste e
`WHATSAPP_VERIFY_TOKEN` no ambiente do serviço. Use o mesmo verify token na
Meta ao registrar a URL HTTPS com o caminho `/webhooks/whatsapp`.

Confira `/healthz`, valide a URL na Meta e assine o campo `messages`.
Envie a mensagem de teste da Meta ao celular autorizado e responda pelo celular.
O log `whatsapp_test_delivery` indica a contagem de mensagens recebidas e
notificações de entrega. O serviço não registra o texto nem o telefone, não
grava no CRM e não envia respostas. Use apenas com o número de teste.

# WhatsApp conversational agent

The WhatsApp ordering assistant is a controlled language layer over the existing
Jurgens Energy commerce services. PostgreSQL and the existing product, delivery,
order, payment and invoice modules remain authoritative; the model never writes
directly to the database.

## Request path

1. The provider sends a signed webhook containing a provider message ID.
2. The webhook validates and parses the raw payload before processing it.
3. The inbound message is inserted idempotently and linked to the customer by
   normalized WhatsApp number.
4. Recent turns, rolling facts and workflow state are reduced to a bounded,
   identity-redacted model view.
5. The OpenAI Responses API chooses from strict application tools.
6. Read tools return live business facts. Write tools run only when deterministic
   server rules authorize the current customer message and persisted state.
7. The final answer is checked for unsupported prices, links, order states,
   delivery claims, multiple questions and internal media paths.
8. Product media is sent as a real WhatsApp image attachment, followed by the
   text reply.

If the agent times out, fails validation, exceeds a tool budget or OpenAI is not
configured, the existing deterministic ordering flow handles the message.

## Write safeguards

- Preparing an offer is allowed only for a server-classified order request.
- A checkout link is created only for the exact offer persisted on the
  conversation and an unambiguous `YES` or `JA` confirmation.
- Product price and availability are re-read immediately before checkout
  creation.
- Cancellation, payment-link renewal, opt-out and human handover each require a
  matching deterministic intent.
- Refunds, order edits and delivery promises are not agent tools.

Safety concerns, complaints, payment disputes, commercial quotations and bulk
requests pause automation and hand the conversation to staff. An active detailed
delivery-address workflow remains deterministic.

## Privacy and retention

Responses requests use `store: false`. Names, email addresses, phone numbers,
street addresses, postal codes and internal UUIDs are omitted from model input.
Verified prices, order references and secure application URLs are retained when
needed. Full message history remains in PostgreSQL; only a bounded recent window
and versioned rolling facts are supplied to the model.

The verified customer first name is added by the application after model
generation, so the model does not need customer identity metadata.

## Required production setup

- Enable and configure OpenAI in **Admin → Settings → Platform**.
- Keep the 360dialog GET verification token separate from POST authentication.
- In **Admin → Settings → Platform → WhatsApp ordering**, generate the inbound
  POST signing secret, add it to the 360dialog Channel Webhook headers as
  `x-whatsapp-webhook-secret`, test the provider webhook, and only then save the
  setting. `WHATSAPP_WEBHOOK_SIGNING_SECRET` is the environment fallback.
- Confirm that the public application URL can serve
  `/api/whatsapp/product-media/:mediaId` to 360dialog.
- Keep approved invoice and order-update templates configured for messages sent
  outside WhatsApp's customer-service window.

Run the regression suite with:

```bash
npm run test:whatsapp
```

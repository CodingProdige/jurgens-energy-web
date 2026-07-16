# VAT invoicing

Jurgens Energy is the only seller represented on customer invoices. The legal
entity and VAT registration details are managed at **Admin → Settings → Business
information**. “Jurgens Energy” is stored separately as the trading name.

## Issuance lifecycle

1. PayFast validates a `COMPLETE` ITN and atomically captures the payment.
2. The application creates one immutable invoice snapshot for the paid order.
3. The next number is allocated transactionally as `INV1`, `INV2`, `INV3`, and
   so on. Numbers are not padded and are never reused.
4. A persistent invoice job renders the PDF to private storage.
5. The customer receives the PDF and secure link by email and through an
   approved WhatsApp document template when those integrations are configured.
6. Signed-in customers can always download ready invoices under **My account →
   Invoices**. Admin staff with order access can use **Orders → Invoices**.

Failed or cancelled checkouts do not receive an invoice. Invoice rendering or
notification provider failures never reverse a verified payment. Failed jobs
remain in PostgreSQL and are retried by the server-side worker. Docker restarts
the web service automatically, and Next.js starts the worker with the server.

## VAT and snapshots

Product prices and delivery charges are treated as VAT inclusive. Every order
line stores its SKU and VAT rate at checkout. The issued invoice stores frozen
issuer, customer, address, item, payment, subtotal, VAT, and total values, so a
later catalogue, address, or business-profile edit cannot rewrite history.

The checkout uses the delivery address for personal billing by default. The
optional Billing & VAT invoice section lets a customer add a registered
business name, customer VAT number, and a different billing address.

Issued invoices must never be edited or deleted to represent a refund. They are
the immutable source for every later credit allocation: original invoice line,
description, SKU, quantity, unit price, VAT rate, net amount, VAT amount, and
gross amount all remain frozen.

## Refunds and credit notes

Refunds are started from the paid order in the admin order workspace. Only a
captured PayFast payment for a paid or fulfilled order is eligible. The service
locks and validates the order, payment, invoice, currency, and totals before it
reserves any refundable value.

- A **full refund** credits every remaining refundable invoice line.
- A **partial refund** identifies the affected invoice lines and quantities.
  The server derives and validates each gross credit from the immutable invoice
  unit price and quantity, then allocates the matching net and VAT amounts.
- Active refund reservations enforce cumulative payment, line-value, and
  quantity limits. A second refund cannot over-credit the payment or any line.
- Idempotency keys make a repeated admin submission return the existing refund.
  A key cannot be reused for a different refund request.

PayFast reports whether a refund can return to the original payment source. A
`PAYMENT_SOURCE` refund is submitted through the PayFast Refunds API. If PayFast
requires `BANK_PAYOUT`, or reports that an automatic source refund is not
available, the request becomes **manual required**. Banking details are never
requested or stored by this application; an authorised admin completes that
step in PayFast and then lets reconciliation confirm the outcome.

The application calls the PayFast mutation endpoint at most once for a refund.
A timeout, HTTP 408, server error, or malformed success response is marked
**verification required** and is never blindly resubmitted. The background
worker and the admin status action use only PayFast's GET query/retrieve APIs to
reconcile submitted, verification-required, and manual-required refunds.

## Credit-note lifecycle

A credit note is issued only after PayFast evidence confirms that the refund
completed. Provider acceptance without confirmation does not create an
accounting document.

1. The next number is allocated transactionally as `CN1`, `CN2`, `CN3`, and so
   on. Numbers are not padded or reused.
2. Immutable credit-note lines copy the confirmed refund allocation and retain
   their original invoice-line references.
3. The original invoice remains unchanged; its status becomes partially
   credited or credited according to cumulative confirmed credit notes.
4. A persistent job renders the credit-note PDF to private invoice storage and
   creates a time-limited secure download link.
5. The customer receives the PDF and secure link by email and through the
   approved WhatsApp document template when those channels are configured.
6. Signed-in customers can download ready credit notes from their invoice
   history, and authorised admins can access them from the order/invoice views.

Rendering and provider-delivery failures are persisted with the credit note.
Failed jobs retry with backoff, successful channels are not sent twice, and an
admin can retry delivery after correcting a missing or rejected provider
template. If a provider request times out or returns an ambiguous response, that
channel is quarantined as **verification required** and is never retried
automatically; an admin must first verify the provider outcome and explicitly
acknowledge the duplicate-delivery risk before forcing a retry. A failed refund
does not issue a credit note. A manual-required or
verification-required refund remains reserved and visibly requires attention
until PayFast can be reconciled.

Refund processing is deliberately separate from fulfilment operations. It does
not cancel an order, restock products, reverse an exchange handover, or cancel a
courier shipment automatically. A fully confirmed refund changes the order and
payment accounting status to refunded, but any required stock, delivery, or
customer-service action must be handled explicitly by staff.

## Required configuration

- Complete the legal name, VAT number, invoice contact details, and registered
  address in Business information.
- Confirm the courier collection contact and origin on the same page. Bob Go
  uses this single Jurgens origin; the first deployment copies the legacy
  collection profile into it when one exists.
- Configure SendGrid for invoice email delivery.
- Configure live PayFast credentials under **Admin → Settings → Platform →
  PayFast payments**. The Refunds API is intentionally unavailable in sandbox
  mode.
- Create both approved WhatsApp document templates described in
  `docs/environment.md`.
- Keep `INVOICE_STORAGE_PATH` on durable private storage and `APP_URL` publicly
  reachable for token-protected invoice and credit-note retrieval.

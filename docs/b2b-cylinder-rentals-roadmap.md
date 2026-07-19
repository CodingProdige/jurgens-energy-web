# B2B Cylinder Rentals Roadmap

Status: **Deferred for a later implementation**  
Recorded: **17 July 2026**

When a future request refers to the "rental implementation", "business gas
rentals", "Suremix rentals", "butane rentals", "business pricing", or
"payment terms", use this document as the starting product and engineering
context.

## Product decision

Build cylinder rental as a dedicated **B2B Accounts and Rentals module inside
the existing modular monolith**. Do not turn rental into a normal retail
product option, reuse seller subscriptions, or create a separate platform.

Keep the following concepts separate:

- Gas or a refill is a billable product or service.
- A cylinder is a physical asset held in custody by a customer.
- Rental is a recurring charge linked to a contract and the assets or pooled
  quantity on hire.
- A delivery, swap, return, loss, or collection is an operational movement.
- The business account is responsible for pricing, payment, sites, users, and
  cylinder custody.
- Asset ownership must be explicit because a cylinder may belong to Jurgens
  Energy or an upstream supplier.

The existing retail checkout remains unchanged. Only approved business
accounts receive private pricing, account terms, rental contracts, and B2B
ordering capabilities.

## Existing platform foundations to reuse

- Authentication, customer users, and staff capability controls.
- Saved delivery addresses and Jurgens Energy delivery scheduling.
- Products, variants, SKUs, VAT-inclusive prices, and fulfillment metadata.
- Order, customer, delivery-address, and unit-price snapshots.
- Sequential VAT invoices, PDF delivery, refunds, and credit notes.
- Email, in-app, and WhatsApp notification infrastructure.
- WhatsApp customer identity and secure order/payment links.
- Audit logs and admin mutation patterns.

## Required B2B domains

### Business accounts

- Legal and trading name, registration number, VAT number, status, billing
  cycle, and finance contact.
- Multiple business members with owner, buyer, approver, finance, and viewer
  roles.
- Multiple service, delivery, and billing sites.
- Admin-approved credit profile: prepaid or on-account, term days, credit
  limit, PO requirement, effective dates, and credit-hold status.

### Contract pricing

- Effective-dated price lists with VAT-inclusive prices and quantity breaks.
- Business-account price-list assignments and optional account overrides.
- One central server-side price resolver used by the catalog, cart, checkout,
  admin orders, and WhatsApp ordering.
- Snapshot the resolved price, its source, and commercial terms on each order
  and invoice line so history never changes with a later price update.

Suggested precedence:

```text
contract override
→ business-account override
→ assigned trade price list
→ public retail price
```

### Rental contracts and cylinder custody

- Rental asset types for cylinder class, gas compatibility, size, default
  rental cadence, and default rate.
- Rental assets with owner, asset tag/barcode, manufacturer serial, condition,
  current location, status, and inspection/test dates.
- Support both individually serialized assets and supplier-managed pooled
  quantities.
- Rental contracts linked to a business and service site.
- Contract lines for quantity, rental rate, refill pricing, deposits, and
  agreed loss/damage charges.
- Immutable asset movements for issue, return, swap, depot transfer,
  inspection, loss, damage, and write-off.
- A cylinder swap must atomically record the returned cylinder and the issued
  replacement.

### Receivables and recurring billing

- Allow VAT invoices to be issued before payment, with due dates and unpaid,
  partially paid, paid, overdue, and written-off states.
- Support payments and remittances allocated across one or more invoices.
- Generate idempotent periodic rental charges from contract/assets held during
  a billing period.
- Produce account statements, ageing, reminders, and automatic credit holds.
- Keep invoice issue, payment due, payment receipt, and VAT time-of-supply
  dates separate.
- Treat refundable security, returnable-container deposits, rental, gas,
  delivery, and loss/damage charges as distinct line types pending accounting
  confirmation.

## Recommended implementation phases

### Phase 1 — B2B foundation

- Business accounts, members, sites, approvals, and private price lists.
- Central account-aware pricing with price provenance snapshots.
- Negotiated prices visible only to authorised business members and linked
  WhatsApp identities.

### Phase 2 — On-account ordering

- PO/reference support, credit limits, prepaid fallback, and account-order
  approval.
- Unpaid VAT invoices with due dates.
- EFT/manual payment capture, allocations, balances, and basic statements.

### Phase 3 — Rental operations

- Admin-created rental contracts.
- Cylinder register, optional barcode/QR scanning, assignment, and custody
  ledger.
- Issue, swap, return, lost, damaged, and collection workflows.
- Reuse delivery zones and scheduling where applicable.

### Phase 4 — Recurring billing and credit control

- Monthly billing runs, statements, ageing, reminders, and credit holds.
- PayFast invoice links by default.
- Optional PayFast subscriptions for fixed charges or explicitly authorised
  tokenization for variable future charges.

### Phase 5 — Business portal and WhatsApp

- Show contracts, cylinders on site, open invoices, statements, and balance.
- Let authorised contacts request refills, swaps, or collections.
- Give the WhatsApp agent account pricing and contract context, while keeping
  credit approval and asset movements as deterministic server actions.

### Phase 6 — Operations analytics

- Fleet utilisation and location.
- Cylinders by customer and service site.
- Overdue returns, inspection expiry, loss, and damage.
- Recurring revenue and receivables ageing.

## Recommended MVP boundary

Do not begin with an automated public rental checkout. Pilot the workflow with
a small group of approved business customers using:

- private trade pricing;
- admin-approved Net 7/15/30 terms and credit limits;
- admin-created rental contracts;
- serialized or pooled cylinder custody;
- issue/swap/return records;
- monthly invoices and statements; and
- portal or WhatsApp service requests.

## Commercial and professional decisions required first

Confirm these rules with the supplier, accountant, insurer, and a South African
legal adviser before implementation:

- Who owns each cylinder class?
- Are cylinders individually serialized or managed as a pool?
- When does rental start and stop?
- Is billing per cylinder, per day/month, or per contract?
- How are deposits, losses, damage, failed collections, and contamination
  handled?
- Are refill and delivery prices fixed, indexed, or account-specific?
- Which customers qualify for terms and what credit checks are required?
- Are interest or late fees charged?
- Are invoices issued per delivery or consolidated monthly?
- What supplier-specific inspection, handling, and return obligations apply?

## Reference material

- [PayFast recurring billing and tokenization](https://developers.payfast.co.za/documentation/)
- [SARS VAT 404 guide for vendors](https://www.sars.gov.za/wp-content/uploads/Ops/Guides/Legal-Pub-Guide-VAT404-VAT-404-Guide-for-Vendors.pdf)
- [SARS tax invoice guidance](https://www.sars.gov.za/businesses-and-employers/government/tax-invoices/)
- [South African National Credit Act](https://www.gov.za/documents/national-credit-act)


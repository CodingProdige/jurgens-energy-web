import "server-only";

import path from "node:path";

import {
  Document,
  Image,
  Page,
  StyleSheet,
  Text,
  View,
  renderToBuffer,
} from "@react-pdf/renderer";

import {
  parseInvoiceDocumentData,
  type InvoiceDocumentData,
} from "@/src/modules/invoices/document-data";

const BRAND = {
  ink: "#080808",
  carbon: "#1A1A1A",
  porcelain: "#F7F7F2",
  flame: "#FF5A1F",
  amber: "#FFB000",
  muted: "#666660",
  border: "#D9D9D2",
  success: "#087A4B",
} as const;

const styles = StyleSheet.create({
  page: {
    backgroundColor: "#FFFFFF",
    color: BRAND.ink,
    fontFamily: "Helvetica",
    fontSize: 8.5,
    lineHeight: 1.45,
    paddingBottom: 52,
    paddingHorizontal: 34,
    paddingTop: 34,
  },
  topRule: {
    backgroundColor: BRAND.flame,
    height: 5,
    left: 0,
    position: "absolute",
    right: 0,
    top: 0,
  },
  header: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 24,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    width: "58%",
  },
  brandMark: {
    height: 42,
    marginRight: 11,
    objectFit: "contain",
    width: 42,
  },
  brandName: {
    color: BRAND.ink,
    fontFamily: "Helvetica-Bold",
    fontSize: 16,
    letterSpacing: 2.6,
  },
  tradingName: {
    color: BRAND.flame,
    fontFamily: "Helvetica-Bold",
    fontSize: 7.5,
    letterSpacing: 3.8,
    marginTop: 3,
    textTransform: "uppercase",
  },
  documentTitleWrap: {
    alignItems: "flex-end",
    width: "42%",
  },
  documentTitle: {
    color: BRAND.ink,
    fontFamily: "Helvetica-Bold",
    fontSize: 21,
    letterSpacing: 0.8,
  },
  invoiceNumber: {
    color: BRAND.flame,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginTop: 4,
  },
  paidBadge: {
    backgroundColor: "#E7F6EF",
    borderColor: "#A9DFC8",
    borderRadius: 10,
    borderWidth: 1,
    color: BRAND.success,
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  partyGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 18,
  },
  partyCard: {
    borderColor: BRAND.border,
    borderRadius: 5,
    borderWidth: 1,
    padding: 11,
    width: "50%",
  },
  eyebrow: {
    color: BRAND.flame,
    fontFamily: "Helvetica-Bold",
    fontSize: 6.8,
    letterSpacing: 1.3,
    marginBottom: 6,
    textTransform: "uppercase",
  },
  partyName: {
    fontFamily: "Helvetica-Bold",
    fontSize: 9.5,
    marginBottom: 3,
  },
  secondary: {
    color: BRAND.muted,
  },
  deliveryAddress: {
    borderTopColor: BRAND.border,
    borderTopWidth: 1,
    marginTop: 6,
    paddingTop: 6,
  },
  infoGrid: {
    backgroundColor: BRAND.porcelain,
    borderRadius: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 18,
    paddingHorizontal: 11,
    paddingVertical: 9,
  },
  infoItem: {
    width: "24%",
  },
  infoLabel: {
    color: BRAND.muted,
    fontSize: 6.5,
    letterSpacing: 0.5,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  infoValue: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  table: {
    borderColor: BRAND.border,
    borderRadius: 4,
    borderWidth: 1,
    marginBottom: 16,
    overflow: "hidden",
  },
  tableHeader: {
    backgroundColor: BRAND.carbon,
    color: "#FFFFFF",
    flexDirection: "row",
    fontFamily: "Helvetica-Bold",
    fontSize: 6.7,
    letterSpacing: 0.2,
    paddingHorizontal: 7,
    paddingVertical: 7,
    textTransform: "uppercase",
  },
  tableRow: {
    borderBottomColor: BRAND.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    paddingHorizontal: 7,
    paddingVertical: 8,
  },
  tableRowLast: {
    borderBottomWidth: 0,
  },
  descriptionColumn: {
    paddingRight: 6,
    width: "36%",
  },
  quantityColumn: {
    textAlign: "right",
    width: "8%",
  },
  unitColumn: {
    textAlign: "right",
    width: "16%",
  },
  rateColumn: {
    textAlign: "right",
    width: "10%",
  },
  amountColumn: {
    textAlign: "right",
    width: "15%",
  },
  lineTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 8,
  },
  lineMeta: {
    color: BRAND.muted,
    fontSize: 6.8,
    marginTop: 2,
  },
  summaryArea: {
    alignItems: "flex-start",
    flexDirection: "row",
    justifyContent: "space-between",
  },
  paymentCard: {
    backgroundColor: BRAND.porcelain,
    borderRadius: 5,
    padding: 10,
    width: "54%",
  },
  summary: {
    width: "40%",
  },
  summaryRow: {
    borderBottomColor: BRAND.border,
    borderBottomWidth: 1,
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  summaryTotal: {
    borderBottomWidth: 0,
    color: BRAND.ink,
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    paddingTop: 7,
  },
  amountPaid: {
    color: BRAND.success,
    fontFamily: "Helvetica-Bold",
  },
  notes: {
    borderTopColor: BRAND.border,
    borderTopWidth: 1,
    marginTop: 18,
    paddingTop: 10,
  },
  note: {
    color: BRAND.muted,
    fontSize: 7.2,
    marginBottom: 3,
  },
  thankYou: {
    color: BRAND.flame,
    fontFamily: "Helvetica-Bold",
    fontSize: 9,
    marginTop: 13,
  },
  footer: {
    alignItems: "center",
    borderTopColor: BRAND.border,
    borderTopWidth: 1,
    bottom: 19,
    color: BRAND.muted,
    flexDirection: "row",
    fontSize: 6.5,
    justifyContent: "space-between",
    left: 34,
    paddingTop: 6,
    position: "absolute",
    right: 34,
  },
});

function formatMoney(cents: number) {
  return new Intl.NumberFormat("en-ZA", {
    currency: "ZAR",
    currencyDisplay: "symbol",
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
    style: "currency",
  })
    .format(cents / 100)
    .replace(/\u00a0/g, " ");
}

function formatDate(value: string) {
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00Z`);

  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).format(date);
}

function formatAddress(address: InvoiceDocumentData["issuer"]["address"]) {
  return [
    address.line1,
    address.line2,
    address.suburb,
    address.city,
    address.province,
    address.postalCode,
    address.countryName,
  ].filter(Boolean);
}

function AddressBlock({
  address,
}: {
  address: InvoiceDocumentData["issuer"]["address"];
}) {
  return (
    <View>
      {formatAddress(address).map((line, index) => (
        <Text key={`${line}-${index}`} style={styles.secondary}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function InvoiceDocument({ data }: { data: InvoiceDocumentData }) {
  const logoPath = path.join(
    /* turbopackIgnore: true */ process.cwd(),
    "public",
    "brand",
    "logo",
    "jurgens-icon.png",
  );

  return (
    <Document
      author={data.issuer.legalName}
      creationDate={new Date(data.issuedAt)}
      creator="Jurgens Energy invoicing"
      keywords={`tax invoice, ${data.invoiceNumber}, ${data.orderNumber}`}
      language="en-ZA"
      modificationDate={new Date(data.issuedAt)}
      pageLayout="singlePage"
      subject={`VAT invoice for order ${data.orderNumber}`}
      title={`Tax Invoice ${data.invoiceNumber}`}
    >
      <Page size="A4" style={styles.page} wrap>
        <View style={styles.topRule} fixed />

        <View style={styles.header}>
          <View style={styles.brand}>
            {/* react-pdf Image does not expose the HTML alt attribute. */}
            {/* eslint-disable-next-line jsx-a11y/alt-text */}
            <Image src={logoPath} style={styles.brandMark} />
            <View>
              <Text style={styles.brandName}>JURGENS</Text>
              <Text style={styles.tradingName}>ENERGY</Text>
            </View>
          </View>
          <View style={styles.documentTitleWrap}>
            <Text style={styles.documentTitle}>TAX INVOICE</Text>
            <Text style={styles.invoiceNumber}>{data.invoiceNumber}</Text>
            <Text style={styles.paidBadge}>PAID</Text>
          </View>
        </View>

        <View style={styles.partyGrid}>
          <View style={styles.partyCard}>
            <Text style={styles.eyebrow}>Issued by</Text>
            <Text style={styles.partyName}>{data.issuer.legalName}</Text>
            {data.issuer.tradingName !== data.issuer.legalName ? (
              <Text style={styles.secondary}>
                Trading as {data.issuer.tradingName}
              </Text>
            ) : null}
            {data.issuer.registrationNumber ? (
              <Text style={styles.secondary}>
                Registration: {data.issuer.registrationNumber}
              </Text>
            ) : null}
            <Text style={styles.secondary}>VAT: {data.issuer.vatNumber}</Text>
            <AddressBlock address={data.issuer.address} />
            {data.issuer.email ? (
              <Text style={styles.secondary}>{data.issuer.email}</Text>
            ) : null}
            {data.issuer.phone ? (
              <Text style={styles.secondary}>{data.issuer.phone}</Text>
            ) : null}
            {data.issuer.website ? (
              <Text style={styles.secondary}>{data.issuer.website}</Text>
            ) : null}
          </View>

          <View style={styles.partyCard}>
            <Text style={styles.eyebrow}>Billed to</Text>
            <Text style={styles.partyName}>
              {data.customer.companyName ?? data.customer.name}
            </Text>
            {data.customer.companyName ? (
              <Text style={styles.secondary}>{data.customer.name}</Text>
            ) : null}
            {data.customer.vatNumber ? (
              <Text style={styles.secondary}>VAT: {data.customer.vatNumber}</Text>
            ) : null}
            <AddressBlock address={data.customer.billingAddress} />
            {data.customer.email ? (
              <Text style={styles.secondary}>{data.customer.email}</Text>
            ) : null}
            {data.customer.phone ? (
              <Text style={styles.secondary}>{data.customer.phone}</Text>
            ) : null}
            {data.customer.deliveryAddress ? (
              <View style={styles.deliveryAddress}>
                <Text style={styles.eyebrow}>Delivered to</Text>
                <AddressBlock address={data.customer.deliveryAddress} />
              </View>
            ) : null}
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Invoice date</Text>
            <Text style={styles.infoValue}>{formatDate(data.issuedAt)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Supply date</Text>
            <Text style={styles.infoValue}>{formatDate(data.supplyDate)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Order</Text>
            <Text style={styles.infoValue}>{data.orderNumber}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Currency</Text>
            <Text style={styles.infoValue}>{data.currency}</Text>
          </View>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.descriptionColumn}>Description</Text>
            <Text style={styles.quantityColumn}>Qty</Text>
            <Text style={styles.unitColumn}>Unit incl.</Text>
            <Text style={styles.rateColumn}>VAT</Text>
            <Text style={styles.amountColumn}>Excl.</Text>
            <Text style={styles.amountColumn}>Incl.</Text>
          </View>
          {data.lines.map((line, index) => (
            <View
              key={`${line.kind}-${line.sku ?? line.description}-${index}`}
              style={[
                styles.tableRow,
                index === data.lines.length - 1 ? styles.tableRowLast : {},
              ]}
              wrap={false}
            >
              <View style={styles.descriptionColumn}>
                <Text style={styles.lineTitle}>{line.description}</Text>
                {line.optionDescription ? (
                  <Text style={styles.lineMeta}>{line.optionDescription}</Text>
                ) : null}
                {line.sku ? (
                  <Text style={styles.lineMeta}>SKU: {line.sku}</Text>
                ) : null}
                {line.discountGrossCents > 0 ? (
                  <Text style={styles.lineMeta}>
                    Discount: {formatMoney(line.discountGrossCents)}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.quantityColumn}>{line.quantity}</Text>
              <Text style={styles.unitColumn}>
                {formatMoney(line.unitPriceGrossCents)}
              </Text>
              <Text style={styles.rateColumn}>
                {(line.vatRateBasisPoints / 100).toFixed(2)}%
              </Text>
              <Text style={styles.amountColumn}>
                {formatMoney(line.netAmountCents)}
              </Text>
              <Text style={styles.amountColumn}>
                {formatMoney(line.grossAmountCents)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryArea} wrap={false}>
          <View style={styles.paymentCard}>
            <Text style={styles.eyebrow}>Payment details</Text>
            <Text>
              {data.payment.provider} reference: {data.payment.transactionReference}
            </Text>
            <Text style={styles.secondary}>
              Paid on {formatDate(data.payment.paidAt)}
            </Text>
            {data.purchaseOrderReference ? (
              <Text style={styles.secondary}>
                Purchase order: {data.purchaseOrderReference}
              </Text>
            ) : null}
            <Text style={styles.thankYou}>Thank you for your business.</Text>
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text>Subtotal excl. VAT</Text>
              <Text>{formatMoney(data.totals.netAmountCents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>VAT</Text>
              <Text>{formatMoney(data.totals.vatAmountCents)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text>Total incl. VAT</Text>
              <Text>{formatMoney(data.totals.grossAmountCents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>Amount paid</Text>
              <Text style={styles.amountPaid}>
                {formatMoney(data.payment.amountPaidCents)}
              </Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text>Balance due</Text>
              <Text>{formatMoney(0)}</Text>
            </View>
          </View>
        </View>

        {data.notes.length > 0 ? (
          <View style={styles.notes} wrap={false}>
            <Text style={styles.eyebrow}>Notes</Text>
            {data.notes.map((note, index) => (
              <Text key={`${note}-${index}`} style={styles.note}>
                {note}
              </Text>
            ))}
          </View>
        ) : null}

        <View style={styles.footer} fixed>
          <Text>
            {data.issuer.tradingName} · VAT {data.issuer.vatNumber} · Invoice {data.invoiceNumber}
          </Text>
          <Text
            render={({ pageNumber, totalPages }) =>
              `Page ${pageNumber} of ${totalPages}`
            }
          />
        </View>
      </Page>
    </Document>
  );
}

export async function renderInvoicePdf(
  input: InvoiceDocumentData | unknown,
): Promise<Buffer> {
  const data = parseInvoiceDocumentData(input);

  return renderToBuffer(<InvoiceDocument data={data} />);
}

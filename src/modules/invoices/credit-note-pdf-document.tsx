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
  parseCreditNoteDocumentData,
  type CreditNoteDocumentData,
} from "@/src/modules/invoices/credit-note-document-data";

const BRAND = {
  amber: "#FFB000",
  border: "#D9D9D2",
  carbon: "#1A1A1A",
  flame: "#FF5A1F",
  ink: "#080808",
  muted: "#666660",
  porcelain: "#F7F7F2",
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
    backgroundColor: BRAND.amber,
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
    marginBottom: 22,
  },
  brand: {
    alignItems: "center",
    flexDirection: "row",
    width: "52%",
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
    width: "48%",
  },
  documentTitle: {
    fontFamily: "Helvetica-Bold",
    fontSize: 19,
    letterSpacing: 0.6,
  },
  documentNumber: {
    color: BRAND.flame,
    fontFamily: "Helvetica-Bold",
    fontSize: 10,
    marginTop: 4,
  },
  creditBadge: {
    backgroundColor: "#FFF5D9",
    borderColor: "#F0CF77",
    borderRadius: 10,
    borderWidth: 1,
    color: "#7B5200",
    fontFamily: "Helvetica-Bold",
    fontSize: 7,
    marginTop: 7,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  partyGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 16,
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
  infoGrid: {
    backgroundColor: BRAND.porcelain,
    borderRadius: 5,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 12,
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
  reasonCard: {
    borderColor: "#F0CF77",
    borderRadius: 5,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 11,
    paddingVertical: 8,
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
    width: "38%",
  },
  quantityColumn: {
    textAlign: "right",
    width: "8%",
  },
  unitColumn: {
    textAlign: "right",
    width: "14%",
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
  explanationCard: {
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
    fontFamily: "Helvetica-Bold",
    fontSize: 11,
    paddingTop: 7,
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

function formatCredit(cents: number) {
  return `-${formatMoney(cents)}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-ZA", {
    day: "2-digit",
    month: "long",
    timeZone: "Africa/Johannesburg",
    year: "numeric",
  }).format(new Date(value));
}

function formatQuantity(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(3).replace(/0+$/, "");
}

function AddressBlock({
  address,
}: {
  address: CreditNoteDocumentData["issuer"]["address"];
}) {
  const lines = [
    address.line1,
    address.line2,
    address.suburb,
    address.city,
    address.province,
    address.postalCode,
    address.countryName,
  ].filter(Boolean);

  return (
    <View>
      {lines.map((line, index) => (
        <Text key={`${line}-${index}`} style={styles.secondary}>
          {line}
        </Text>
      ))}
    </View>
  );
}

function CreditNoteDocument({ data }: { data: CreditNoteDocumentData }) {
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
      keywords={`tax credit note, ${data.creditNoteNumber}, ${data.originalInvoice.invoiceNumber}`}
      language="en-ZA"
      modificationDate={new Date(data.issuedAt)}
      pageLayout="singlePage"
      subject={`VAT credit against invoice ${data.originalInvoice.invoiceNumber}`}
      title={`Tax Credit Note ${data.creditNoteNumber}`}
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
            <Text style={styles.documentTitle}>TAX CREDIT NOTE</Text>
            <Text style={styles.documentNumber}>{data.creditNoteNumber}</Text>
            <Text style={styles.creditBadge}>CREDIT ISSUED</Text>
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
          </View>

          <View style={styles.partyCard}>
            <Text style={styles.eyebrow}>Credited to</Text>
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
          </View>
        </View>

        <View style={styles.infoGrid}>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Credit-note date</Text>
            <Text style={styles.infoValue}>{formatDate(data.issuedAt)}</Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Original invoice</Text>
            <Text style={styles.infoValue}>
              {data.originalInvoice.invoiceNumber}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Invoice date</Text>
            <Text style={styles.infoValue}>
              {formatDate(data.originalInvoice.issuedAt)}
            </Text>
          </View>
          <View style={styles.infoItem}>
            <Text style={styles.infoLabel}>Order</Text>
            <Text style={styles.infoValue}>{data.orderNumber}</Text>
          </View>
        </View>

        <View style={styles.reasonCard} wrap={false}>
          <Text style={styles.eyebrow}>Reason for credit</Text>
          <Text>{data.reason}</Text>
        </View>

        <View style={styles.table}>
          <View style={styles.tableHeader}>
            <Text style={styles.descriptionColumn}>Description</Text>
            <Text style={styles.quantityColumn}>Qty</Text>
            <Text style={styles.unitColumn}>Unit incl.</Text>
            <Text style={styles.rateColumn}>VAT</Text>
            <Text style={styles.amountColumn}>Credit excl.</Text>
            <Text style={styles.amountColumn}>Credit incl.</Text>
          </View>
          {data.lines.map((line, index) => (
            <View
              key={`${line.sku ?? line.description}-${index}`}
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
              </View>
              <Text style={styles.quantityColumn}>
                {formatQuantity(line.quantity)}
              </Text>
              <Text style={styles.unitColumn}>
                {formatMoney(line.unitPriceGrossCents)}
              </Text>
              <Text style={styles.rateColumn}>
                {(line.vatRateBasisPoints / 100).toFixed(2)}%
              </Text>
              <Text style={styles.amountColumn}>
                {formatCredit(line.netAmountCents)}
              </Text>
              <Text style={styles.amountColumn}>
                {formatCredit(line.grossAmountCents)}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summaryArea} wrap={false}>
          <View style={styles.explanationCard}>
            <Text style={styles.eyebrow}>Credit details</Text>
            <Text>
              This tax credit note reduces the amount and VAT recorded on tax
              invoice {data.originalInvoice.invoiceNumber}.
            </Text>
            {data.refund ? (
              <View style={{ marginTop: 7 }}>
                <Text>
                  Refund settlement: {data.refund.provider}
                </Text>
                <Text style={styles.secondary}>
                  Jurgens refund reference: {data.refund.transactionReference}
                </Text>
                <Text style={styles.secondary}>
                  Processed {formatDate(data.refund.processedAt)} · {formatMoney(data.refund.amountCents)}
                </Text>
              </View>
            ) : (
              <Text style={[styles.secondary, { marginTop: 7 }]}>
                Refund settlement is recorded separately from this tax document.
              </Text>
            )}
          </View>

          <View style={styles.summary}>
            <View style={styles.summaryRow}>
              <Text>Credit excl. VAT</Text>
              <Text>{formatCredit(data.totals.netAmountCents)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text>VAT credit</Text>
              <Text>{formatCredit(data.totals.vatAmountCents)}</Text>
            </View>
            <View style={[styles.summaryRow, styles.summaryTotal]}>
              <Text>Total credit incl. VAT</Text>
              <Text>{formatCredit(data.totals.grossAmountCents)}</Text>
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
            {data.issuer.tradingName} · VAT {data.issuer.vatNumber} · Credit note {data.creditNoteNumber}
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

export async function renderCreditNotePdf(
  input: CreditNoteDocumentData | unknown,
): Promise<Buffer> {
  const data = parseCreditNoteDocumentData(input);

  return renderToBuffer(<CreditNoteDocument data={data} />);
}

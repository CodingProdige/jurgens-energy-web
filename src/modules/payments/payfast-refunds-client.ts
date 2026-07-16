import "server-only";

import crypto from "node:crypto";

import { z } from "zod";

import { getPayFastIntegrationConfig } from "@/src/modules/marketplace/settings";

const PAYFAST_API_BASE_URL = "https://api.payfast.co.za";
const PAYFAST_API_VERSION = "v1";
const PAYFAST_REQUEST_TIMEOUT_MS = 20_000;

const providerPaymentIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(160)
  .regex(/^[A-Za-z0-9-]+$/, "Invalid PayFast payment identifier.");

const createRefundInputSchema = z.object({
  amountCents: z.number().int().safe().positive(),
  notifyBuyer: z.boolean().default(true),
  notifyMerchant: z.boolean().default(false),
  reason: z.string().trim().min(3).max(255),
});

const providerIntegerSchema = z
  .union([
    z.number(),
    z.string().trim().regex(/^\d+$/),
  ])
  .transform(Number)
  .pipe(z.number().int().safe().nonnegative());

const providerSignedIntegerSchema = z
  .union([
    z.number(),
    z.string().trim().regex(/^-?\d+$/),
  ])
  .transform(Number)
  .pipe(z.number().int().safe());

const refundMethodResponseSchema = z.object({
  method: z.string().trim().min(1),
});

const refundQueryResponseSchema = z.object({
  amount_available_for_refund: providerIntegerSchema,
  amount_original: providerIntegerSchema,
  errors: z.array(z.unknown()).optional().default([]),
  funding_type: z.unknown().optional(),
  refund_full: refundMethodResponseSchema,
  refund_partial: refundMethodResponseSchema,
  status: z.unknown().optional(),
});

const refundTransactionSchema = z.object({
  // PayFast represents completed refund ledger entries as negative cents.
  amount: providerSignedIntegerSchema,
  date: z.unknown().optional(),
  type: z.unknown().optional(),
});

const refundRetrieveResponseSchema = z.object({
  available_balance: providerIntegerSchema.nullish(),
  transactions: z.array(refundTransactionSchema).optional().default([]),
});

const sensitiveBankKeys = new Set([
  "account_number",
  "account_type",
  "acc_holder",
  "acc_type",
  "bank_account_holder",
  "bank_account_number",
  "bank_account_type",
  "bank_branch_code",
  "bank_code",
  "bank_name",
  "bic",
  "branch_code",
  "iban",
  "routing_number",
  "swift",
  "token",
]);

export type PayFastRefundMethod =
  | "PAYMENT_SOURCE"
  | "BANK_PAYOUT"
  | "NOT_AVAILABLE"
  | "UNKNOWN";

export type PayFastRefundQuery = Readonly<{
  amountAvailableCents: number;
  amountOriginalCents: number;
  errors: string[];
  fullMethod: PayFastRefundMethod;
  fundingType: string;
  httpStatus: number;
  partialMethod: PayFastRefundMethod;
  providerStatus: string;
  raw: unknown;
}>;

export type PayFastRefundCreateResult = Readonly<{
  accepted: boolean;
  httpStatus: number;
  message: string | null;
  providerStatus: string;
  raw: unknown;
}>;

export type PayFastRefundTransaction = Readonly<{
  amountCents: number;
  date: string;
  type: string;
}>;

export type PayFastRefundRetrieveResult = Readonly<{
  availableBalanceCents: number | null;
  httpStatus: number;
  message: string | null;
  providerStatus: string;
  raw: unknown;
  transactions: PayFastRefundTransaction[];
}>;

export type CreatePayFastRefundInput = z.input<typeof createRefundInputSchema>;

export type PayFastRefundApiErrorCode =
  | "invalid_response"
  | "not_configured"
  | "request_failed"
  | "sandbox_not_supported";

export class PayFastRefundApiError extends Error {
  readonly code: PayFastRefundApiErrorCode;
  readonly httpStatus: number | null;
  readonly outcomeUnknown: boolean;
  readonly providerResponse: unknown;

  constructor({
    cause,
    code,
    httpStatus = null,
    message,
    outcomeUnknown = false,
    providerResponse = null,
  }: {
    cause?: unknown;
    code: PayFastRefundApiErrorCode;
    httpStatus?: number | null;
    message: string;
    outcomeUnknown?: boolean;
    providerResponse?: unknown;
  }) {
    super(message, cause ? { cause } : undefined);
    this.name = "PayFastRefundApiError";
    this.code = code;
    this.httpStatus = httpStatus;
    this.outcomeUnknown = outcomeUnknown;
    this.providerResponse = sanitizeProviderPayload(providerResponse);
  }
}

type PayFastRefundsClientOptions = Readonly<{
  baseUrl?: string;
  fetchImplementation?: typeof fetch;
  merchantId: string;
  now?: () => Date;
  passphrase: string;
}>;

type RequestOptions = Readonly<{
  body?: Record<string, string | number>;
  method: "GET" | "POST";
  mutation?: boolean;
  path: string;
}>;

type PayFastApiResponse = Readonly<{
  httpStatus: number;
  payload: unknown;
}>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function sanitizeProviderPayload(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sanitizeProviderPayload);
  }

  if (!isRecord(value)) {
    return value;
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([key, entry]) =>
      sensitiveBankKeys.has(key.toLowerCase())
        ? []
        : [[key, sanitizeProviderPayload(entry)]],
    ),
  );
}

function encodePayFastApiValue(value: string | number) {
  return encodeURIComponent(String(value))
    .replace(/[!'()*~]/g, (character) =>
      `%${character.charCodeAt(0).toString(16).toUpperCase()}`,
    )
    .replace(/%20/g, "+");
}

function createPayFastApiSignature(
  values: Record<string, string | number>,
  passphrase: string,
) {
  const parameterString = Object.entries({ ...values, passphrase })
    .filter(([key, value]) => key !== "signature" && String(value) !== "")
    .sort(([first], [second]) =>
      first < second ? -1 : first > second ? 1 : 0,
    )
    .map(([key, value]) => `${key}=${encodePayFastApiValue(value)}`)
    .join("&");

  return crypto.createHash("md5").update(parameterString).digest("hex");
}

function formatTimestamp(date: Date) {
  return `${date.toISOString().slice(0, 19)}+00:00`;
}

function normalizeMethod(value: unknown): PayFastRefundMethod {
  const method = String(value ?? "").trim().toUpperCase();

  if (
    method === "PAYMENT_SOURCE" ||
    method === "BANK_PAYOUT" ||
    method === "NOT_AVAILABLE"
  ) {
    return method;
  }

  return "UNKNOWN";
}

function unwrapData(payload: unknown) {
  if (!isRecord(payload)) {
    return payload;
  }

  const data = payload.data;

  if (!isRecord(data)) {
    return "data" in payload ? data : payload;
  }

  return data.response ?? data;
}

function getProviderStatus(payload: unknown) {
  return isRecord(payload) && typeof payload.status === "string"
    ? payload.status
    : "unknown";
}

function getProviderMessage(payload: unknown) {
  if (!isRecord(payload)) {
    return null;
  }

  if (typeof payload.message === "string") {
    return payload.message;
  }

  return isRecord(payload.data) && typeof payload.data.message === "string"
    ? payload.data.message
    : null;
}

export class PayFastRefundsClient {
  private readonly baseUrl: string;
  private readonly fetchImplementation: typeof fetch;
  private readonly merchantId: string;
  private readonly now: () => Date;
  private readonly passphrase: string;

  constructor({
    baseUrl = PAYFAST_API_BASE_URL,
    fetchImplementation = fetch,
    merchantId,
    now = () => new Date(),
    passphrase,
  }: PayFastRefundsClientOptions) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.fetchImplementation = fetchImplementation;
    this.merchantId = z
      .string()
      .trim()
      .regex(/^\d{8}$/, "PayFast merchant ID must contain exactly eight digits.")
      .parse(merchantId);
    this.now = now;
    this.passphrase = passphrase;
  }

  async queryRefund(providerPaymentId: string): Promise<PayFastRefundQuery> {
    const paymentId = providerPaymentIdSchema.parse(providerPaymentId);
    const apiResponse = await this.request({
      method: "GET",
      path: `/refunds/query/${encodeURIComponent(paymentId)}`,
    });
    const raw = apiResponse.payload;
    const response = refundQueryResponseSchema.safeParse(unwrapData(raw));

    if (!response.success) {
      throw new PayFastRefundApiError({
        code: "invalid_response",
        httpStatus: apiResponse.httpStatus,
        message: "PayFast returned an invalid refund query response.",
        providerResponse: raw,
      });
    }
    const data = response.data;

    return {
      amountAvailableCents: data.amount_available_for_refund,
      amountOriginalCents: data.amount_original,
      errors: data.errors.map(String).filter(Boolean),
      fullMethod: normalizeMethod(data.refund_full.method),
      fundingType: String(data.funding_type ?? "unknown"),
      httpStatus: apiResponse.httpStatus,
      partialMethod: normalizeMethod(data.refund_partial.method),
      providerStatus: String(data.status ?? getProviderStatus(raw)),
      raw: sanitizeProviderPayload(raw),
    };
  }

  async createRefund(
    providerPaymentId: string,
    input: CreatePayFastRefundInput,
  ): Promise<PayFastRefundCreateResult> {
    const paymentId = providerPaymentIdSchema.parse(providerPaymentId);
    const parsed = createRefundInputSchema.parse(input);
    const apiResponse = await this.request({
      body: {
        amount: parsed.amountCents,
        notify_buyer: parsed.notifyBuyer ? 1 : 0,
        notify_merchant: parsed.notifyMerchant ? 1 : 0,
        reason: parsed.reason,
      },
      method: "POST",
      mutation: true,
      path: `/refunds/${encodeURIComponent(paymentId)}`,
    });
    const raw = apiResponse.payload;
    const response = unwrapData(raw);
    const responseMarker = isRecord(response) ? response.response : response;
    const accepted =
      responseMarker === true || responseMarker === "true"
        ? true
        : responseMarker === false || responseMarker === "false"
          ? false
          : null;

    if (accepted === null) {
      throw new PayFastRefundApiError({
        code: "invalid_response",
        httpStatus: apiResponse.httpStatus,
        message:
          "PayFast returned an ambiguous refund creation response. The request must be reconciled before retrying.",
        outcomeUnknown: true,
        providerResponse: raw,
      });
    }

    return {
      accepted,
      httpStatus: apiResponse.httpStatus,
      message: getProviderMessage(raw),
      providerStatus: getProviderStatus(raw),
      raw: sanitizeProviderPayload(raw),
    };
  }

  async retrieveRefund(
    providerPaymentId: string,
  ): Promise<PayFastRefundRetrieveResult> {
    const paymentId = providerPaymentIdSchema.parse(providerPaymentId);
    const apiResponse = await this.request({
      method: "GET",
      path: `/refunds/${encodeURIComponent(paymentId)}`,
    });
    const raw = apiResponse.payload;
    const response = refundRetrieveResponseSchema.safeParse(unwrapData(raw));

    if (!response.success) {
      throw new PayFastRefundApiError({
        code: "invalid_response",
        httpStatus: apiResponse.httpStatus,
        message: "PayFast returned an invalid refund retrieval response.",
        providerResponse: raw,
      });
    }
    const data = response.data;

    return {
      availableBalanceCents:
        data.available_balance ?? null,
      httpStatus: apiResponse.httpStatus,
      message: getProviderMessage(raw),
      providerStatus: getProviderStatus(raw),
      raw: sanitizeProviderPayload(raw),
      transactions: data.transactions.map((transaction) => ({
        amountCents: transaction.amount,
        date: String(transaction.date ?? ""),
        type: String(transaction.type ?? ""),
      })),
    };
  }

  private async request({
    body,
    method,
    mutation = false,
    path,
  }: RequestOptions): Promise<PayFastApiResponse> {
    const timestamp = formatTimestamp(this.now());
    const signatureValues = {
      ...(body ?? {}),
      "merchant-id": this.merchantId,
      timestamp,
      version: PAYFAST_API_VERSION,
    };
    const signature = createPayFastApiSignature(
      signatureValues,
      this.passphrase,
    );
    let response: Response;

    try {
      response = await this.fetchImplementation(`${this.baseUrl}${path}`, {
        body: body ? JSON.stringify(body) : undefined,
        cache: "no-store",
        headers: {
          Accept: "application/json",
          ...(body ? { "Content-Type": "application/json" } : {}),
          "merchant-id": this.merchantId,
          signature,
          timestamp,
          version: PAYFAST_API_VERSION,
        },
        method,
        signal: AbortSignal.timeout(PAYFAST_REQUEST_TIMEOUT_MS),
      });
    } catch (error) {
      throw new PayFastRefundApiError({
        cause: error,
        code: "request_failed",
        message: "Could not reach the PayFast Refunds API.",
        outcomeUnknown: mutation,
      });
    }

    let responseText: string;

    try {
      responseText = await response.text();
    } catch (error) {
      throw new PayFastRefundApiError({
        cause: error,
        code: "request_failed",
        httpStatus: response.status,
        message: "Could not read the PayFast Refunds API response.",
        outcomeUnknown: mutation,
      });
    }
    let payload: unknown = null;

    if (responseText) {
      try {
        payload = JSON.parse(responseText);
      } catch (error) {
        throw new PayFastRefundApiError({
          cause: error,
          code: "invalid_response",
          httpStatus: response.status,
          message: "PayFast returned a non-JSON Refunds API response.",
          outcomeUnknown: mutation && response.ok,
        });
      }
    }

    if (!response.ok) {
      throw new PayFastRefundApiError({
        code: "request_failed",
        httpStatus: response.status,
        message: getProviderMessage(payload) ?? "PayFast rejected the refund request.",
        outcomeUnknown:
          mutation && (response.status === 408 || response.status >= 500),
        providerResponse: payload,
      });
    }

    return {
      httpStatus: response.status,
      payload: sanitizeProviderPayload(payload),
    };
  }
}

export async function getConfiguredPayFastRefundsClient() {
  const config = await getPayFastIntegrationConfig();
  const merchantId = config.merchantId;

  if (config.mode !== "live") {
    throw new PayFastRefundApiError({
      code: "sandbox_not_supported",
      message:
        "PayFast refunds are not available in sandbox mode. Use the live PayFast account or record a manual refund.",
    });
  }

  if (!merchantId || !/^\d{8}$/.test(merchantId) || !config.passphrase) {
    throw new PayFastRefundApiError({
      code: "not_configured",
      message:
        "A valid eight-digit PayFast merchant ID and passphrase are required for Refunds API access.",
    });
  }

  return new PayFastRefundsClient({
    merchantId,
    passphrase: config.passphrase,
  });
}

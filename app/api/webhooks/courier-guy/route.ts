import crypto from "node:crypto";

import { NextResponse } from "next/server";

import { getCourierGuyWebhookToken } from "@/src/modules/marketplace/settings";
import {
  processCourierGuyWebhookPayload,
  type CourierGuyWebhookProcessingResult,
} from "@/src/modules/shipping/courier-guy-webhook-processing";
import { parseCourierGuyWebhookPayloads } from "@/src/modules/shipping/courier-guy-webhook-payload";

export const runtime = "nodejs";

const MAX_WEBHOOK_BYTES = 256_000;

export async function POST(request: Request) {
  const configuredToken = await getCourierGuyWebhookToken();

  if (!configuredToken) {
    return NextResponse.json(
      { error: "Courier Guy webhook authentication is not configured." },
      { status: 503 },
    );
  }

  const authorization = request.headers.get("authorization") ?? "";
  const requestUrl = new URL(request.url);
  const queryToken = requestUrl.searchParams.get("token") ?? "";
  const isAuthorized =
    safeEqual(authorization, `Bearer ${configuredToken}`) ||
    safeEqual(queryToken, configuredToken);

  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const environment = requestUrl.searchParams.get("environment");

  if (environment !== "live" && environment !== "sandbox") {
    return NextResponse.json(
      { error: "A valid Courier Guy webhook environment is required." },
      { status: 400 },
    );
  }

  const rawBody = await readLimitedRequestBody(request);

  if (rawBody === null) {
    return NextResponse.json(
      { error: "Webhook payload is too large." },
      { status: 413 },
    );
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const payloads = parseCourierGuyWebhookPayloads(parsedJson);

  if (!payloads) {
    return NextResponse.json(
      { error: "Invalid webhook payload." },
      { status: 400 },
    );
  }

  const results: CourierGuyWebhookProcessingResult[] = [];

  for (const payload of payloads) {
    results.push(
      await processCourierGuyWebhookPayload(payload, environment),
    );
  }

  const matched = results.filter((result) => result === "processed").length;
  const unmatched = results.filter((result) => result === "unmatched").length;
  const duplicates = results.filter(
    (result) => result === "duplicate",
  ).length;

  return NextResponse.json(
    {
      duplicates,
      matched,
      ok: unmatched === 0,
      received: payloads.length,
      retryable: unmatched > 0,
      unmatched,
    },
    { status: unmatched > 0 ? 503 : 200 },
  );
}

async function readLimitedRequestBody(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));

  if (
    Number.isFinite(contentLength) &&
    contentLength > MAX_WEBHOOK_BYTES
  ) {
    return null;
  }

  if (!request.body) {
    return "";
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    totalBytes += value.byteLength;

    if (totalBytes > MAX_WEBHOOK_BYTES) {
      await reader.cancel();
      return null;
    }

    chunks.push(value);
  }

  return Buffer.concat(chunks).toString("utf8");
}

function safeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  return (
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

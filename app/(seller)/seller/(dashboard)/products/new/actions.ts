"use server";

import { z } from "zod";

import { env } from "@/src/config/env";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";

const productDescriptionGenerationSchema = z.object({
  kind: z.enum(["short", "long"]),
  productName: z.string().trim().min(2).max(500),
});

function getResponseText(payload: unknown) {
  if (
    typeof payload === "object" &&
    payload !== null &&
    "output_text" in payload &&
    typeof payload.output_text === "string"
  ) {
    return payload.output_text;
  }

  if (
    typeof payload === "object" &&
    payload !== null &&
    "output" in payload &&
    Array.isArray(payload.output)
  ) {
    for (const item of payload.output) {
      if (
        typeof item === "object" &&
        item !== null &&
        "content" in item &&
        Array.isArray(item.content)
      ) {
        const text = item.content
          .map((contentItem: unknown) =>
            typeof contentItem === "object" &&
            contentItem !== null &&
            "text" in contentItem &&
            typeof contentItem.text === "string"
              ? contentItem.text
              : "",
          )
          .join("")
          .trim();

        if (text) {
          return text;
        }
      }
    }
  }

  return "";
}

function clampGeneratedText(value: string, maxLength: number) {
  return value.trim().replace(/^["']|["']$/g, "").slice(0, maxLength);
}

export async function generateProductDescription(input: {
  kind: "long" | "short";
  productName: string;
}) {
  await requireSellerDashboardAccess();

  const parsed = productDescriptionGenerationSchema.safeParse(input);

  if (!parsed.success) {
    return {
      ok: false,
      message: "Enter a product name before generating copy.",
    };
  }

  if (!env.OPENAI_API_KEY) {
    return {
      ok: false,
      message: "OPENAI_API_KEY is not configured.",
    };
  }

  const isShort = parsed.data.kind === "short";
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      body: JSON.stringify({
        input: [
          `Product name: ${parsed.data.productName}`,
          isShort
            ? "Write one concise marketplace product short description under 400 characters."
            : "Write a helpful marketplace product description under 2000 characters.",
          "Keep it neutral, buyer-friendly, specific enough to be useful, and do not invent certifications, stock availability, delivery promises, discounts, warranties, dimensions, or ingredients.",
        ].join("\n"),
        instructions:
          "You write marketplace product copy for seller-submitted listings. Return only the product description text.",
        max_output_tokens: isShort ? 80 : 420,
        model: env.OPENAI_MODEL,
      }),
      headers: {
        Authorization: `Bearer ${env.OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        ok: false,
        message: "The AI generator is unavailable right now.",
      };
    }

    const description = clampGeneratedText(
      getResponseText(await response.json()),
      isShort ? 400 : 2000,
    );

    if (!description) {
      return {
        ok: false,
        message: "The AI generator did not return usable text.",
      };
    }

    return { ok: true, description };
  } catch {
    return {
      ok: false,
      message: "The AI generator timed out. Try again.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

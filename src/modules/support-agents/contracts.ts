import { z } from "zod";

import { normalizePhoneNumber } from "../phone/index.ts";

function optionalText(maxLength: number) {
  return z.preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();
      return normalized || null;
    },
    z.string().max(maxLength).nullable(),
  );
}

const optionalEmail = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim().toLowerCase();
    return normalized || null;
  },
  z.string().email().max(254).nullable(),
);

const optionalUuid = z.preprocess(
  (value) => {
    if (typeof value !== "string") {
      return value;
    }

    const normalized = value.trim();
    return normalized || null;
  },
  z.string().uuid().nullable(),
);

const optionalPhone = z
  .preprocess(
    (value) => {
      if (typeof value !== "string") {
        return value;
      }

      const normalized = value.trim();
      return normalized || null;
    },
    z.string().max(40).nullable(),
  )
  .transform((value, context) => {
    if (!value) {
      return null;
    }

    const normalized = normalizePhoneNumber(value, {
      defaultCountryCode: "ZA",
    });

    if (!normalized) {
      context.addIssue({
        code: "custom",
        message: "Enter a valid phone number.",
      });

      return z.NEVER;
    }

    return normalized;
  });

export const supportAgentInputSchema = z
  .object({
    availability: optionalText(240),
    bio: optionalText(1_200),
    displayName: z.string().trim().min(2).max(160),
    isPublished: z.boolean(),
    photoMediaId: optionalUuid,
    publicEmail: optionalEmail,
    publicPhone: optionalPhone,
    publicWhatsapp: optionalPhone,
    roleTitle: optionalText(160),
    showInFooter: z.boolean(),
    showOnAbout: z.boolean(),
    showOnSupport: z.boolean(),
  })
  .superRefine((agent, context) => {
    const appearsPublicly =
      agent.isPublished &&
      (agent.showInFooter || agent.showOnAbout || agent.showOnSupport);

    if (
      appearsPublicly &&
      !agent.publicEmail &&
      !agent.publicPhone &&
      !agent.publicWhatsapp
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Add at least one public email, phone, or WhatsApp contact before publishing this agent.",
        path: ["publicEmail"],
      });
    }
  });

export const supportAgentIdSchema = z.string().uuid();

export const supportAgentOrderSchema = z
  .array(z.string().uuid())
  .max(100)
  .refine((ids) => new Set(ids).size === ids.length, {
    message: "Support-agent order cannot contain duplicate entries.",
  });

export type SupportAgentInput = z.infer<typeof supportAgentInputSchema>;

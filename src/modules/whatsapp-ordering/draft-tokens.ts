import { z } from "zod";

export const whatsappDraftTokenSchema = z
  .string()
  .trim()
  .min(24)
  .max(160)
  .regex(/^[A-Za-z0-9_-]+$/);

export function parseWhatsappDraftToken(value: unknown) {
  const parsed = whatsappDraftTokenSchema.safeParse(value);

  return parsed.success ? parsed.data : null;
}

export function getWhatsappDraftResumePath(token: string) {
  return `/whatsapp/resume/${encodeURIComponent(token)}`;
}

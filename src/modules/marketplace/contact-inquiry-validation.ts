import { z } from "zod";

export const contactInquiryFormSchema = z.object({
  company: z.string().max(200).optional().default(""),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .max(254, "Email must be 254 characters or fewer.")
    .pipe(z.email("Enter a valid email address.")),
  message: z
    .string()
    .trim()
    .min(1, "Enter a message.")
    .max(4_000, "Message must be 4,000 characters or fewer."),
  name: z
    .string()
    .trim()
    .min(2, "Enter your name.")
    .max(120, "Name must be 120 characters or fewer."),
});

export type ContactInquiryFormInput = z.infer<typeof contactInquiryFormSchema>;

export function isContactInquiryHoneypotFilled(company: string | undefined) {
  return Boolean(company?.trim());
}

export function createContactInquiryMessagePreview(
  message: string,
  limit = 180,
) {
  const normalizedMessage = message.replace(/\s+/g, " ").trim();

  if (normalizedMessage.length <= limit) {
    return normalizedMessage;
  }

  return `${normalizedMessage.slice(0, Math.max(0, limit - 1)).trimEnd()}…`;
}

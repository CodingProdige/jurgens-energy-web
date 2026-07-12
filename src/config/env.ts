import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://jurgens_energy:jurgens_energy@localhost:5433/jurgens_energy"),
  DIALOGUE_API_KEY: z.string().min(1).optional(),
  DIALOGUE_MESSAGE_URL: z
    .string()
    .url()
    .default("https://waba-v2.360dialog.io"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6380"),
  MEDIA_ROOT: z.string().min(1).default("./storage/jurgens-energy/media"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.6-luna"),
  OPENAI_REASONING_EFFORT: z
    .enum(["none", "minimal", "low", "medium", "high", "xhigh"])
    .default("medium"),
  SENDGRID_API_KEY: z.string().min(1).optional(),
  SENDGRID_FROM_EMAIL: z.email().optional(),
  SENDGRID_FROM_NAME: z.string().min(1).default("Jurgens Energy"),
  SENDGRID_WEBHOOK_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_PRIVATE_KEY: z.string().min(1).optional(),
  WEB_PUSH_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_SUBJECT: z.string().min(1).default("mailto:no-reply@jurgensenergy.com"),
  WHATSAPP_ORDERING_PHONE_NUMBER: z.string().min(1).optional(),
  WHATSAPP_AUTOMATION_SECRET: z.string().min(16).optional(),
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: z.string().min(1).optional(),
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL ?? process.env.AUTH_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  DIALOGUE_API_KEY: process.env.DIALOGUE_API_KEY,
  DIALOGUE_MESSAGE_URL: process.env.DIALOGUE_MESSAGE_URL,
  REDIS_URL: process.env.REDIS_URL,
  MEDIA_ROOT: process.env.MEDIA_ROOT,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  OPENAI_REASONING_EFFORT: process.env.OPENAI_REASONING_EFFORT,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME,
  SENDGRID_WEBHOOK_PUBLIC_KEY: process.env.SENDGRID_WEBHOOK_PUBLIC_KEY,
  WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY,
  WEB_PUSH_PUBLIC_KEY:
    process.env.WEB_PUSH_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
  WEB_PUSH_SUBJECT: process.env.WEB_PUSH_SUBJECT,
  WHATSAPP_ORDERING_PHONE_NUMBER: process.env.WHATSAPP_ORDERING_PHONE_NUMBER,
  WHATSAPP_AUTOMATION_SECRET: process.env.WHATSAPP_AUTOMATION_SECRET,
  WHATSAPP_WEBHOOK_VERIFY_TOKEN: process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN,
});

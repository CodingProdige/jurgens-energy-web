import { z } from "zod";

const envSchema = z.object({
  APP_URL: z.string().url().default("http://localhost:3000"),
  AUTH_SECRET: z.string().min(32).optional(),
  AUTH_GOOGLE_ID: z.string().min(1).optional(),
  AUTH_GOOGLE_SECRET: z.string().min(1).optional(),
  DATABASE_URL: z
    .string()
    .min(1)
    .default("postgres://marketplace:marketplace@localhost:5432/marketplace"),
  REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
  MEDIA_ROOT: z.string().min(1).default("./storage/media"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().min(1).default("gpt-5.4-mini"),
  SENDGRID_API_KEY: z.string().min(1).optional(),
  SENDGRID_FROM_EMAIL: z.email().optional(),
  SENDGRID_FROM_NAME: z.string().min(1).default("Piessang"),
  SENDGRID_WEBHOOK_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_PRIVATE_KEY: z.string().min(1).optional(),
  WEB_PUSH_PUBLIC_KEY: z.string().min(1).optional(),
  WEB_PUSH_SUBJECT: z.string().min(1).default("mailto:no-reply@piessang.com"),
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL ?? process.env.AUTH_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  MEDIA_ROOT: process.env.MEDIA_ROOT,
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
  OPENAI_MODEL: process.env.OPENAI_MODEL,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME,
  SENDGRID_WEBHOOK_PUBLIC_KEY: process.env.SENDGRID_WEBHOOK_PUBLIC_KEY,
  WEB_PUSH_PRIVATE_KEY: process.env.WEB_PUSH_PRIVATE_KEY,
  WEB_PUSH_PUBLIC_KEY:
    process.env.WEB_PUSH_PUBLIC_KEY ??
    process.env.NEXT_PUBLIC_WEB_PUSH_PUBLIC_KEY,
  WEB_PUSH_SUBJECT: process.env.WEB_PUSH_SUBJECT,
});

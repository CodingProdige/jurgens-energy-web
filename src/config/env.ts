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
  SENDGRID_API_KEY: z.string().min(1).optional(),
  SENDGRID_FROM_EMAIL: z.email().optional(),
  SENDGRID_FROM_NAME: z.string().min(1).default("Piessang"),
});

export const env = envSchema.parse({
  APP_URL: process.env.APP_URL ?? process.env.AUTH_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  DATABASE_URL: process.env.DATABASE_URL,
  REDIS_URL: process.env.REDIS_URL,
  MEDIA_ROOT: process.env.MEDIA_ROOT,
  SENDGRID_API_KEY: process.env.SENDGRID_API_KEY,
  SENDGRID_FROM_EMAIL: process.env.SENDGRID_FROM_EMAIL,
  SENDGRID_FROM_NAME: process.env.SENDGRID_FROM_NAME,
});

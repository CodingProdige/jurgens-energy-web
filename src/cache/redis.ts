import { createClient } from "redis";

import { env } from "@/src/config/env";

const globalForRedis = globalThis as unknown as {
  redisClient?: ReturnType<typeof createClient>;
};

export const redis =
  globalForRedis.redisClient ??
  createClient({
    url: env.REDIS_URL,
  });

if (process.env.NODE_ENV !== "production") {
  globalForRedis.redisClient = redis;
}

export async function getRedis() {
  if (!redis.isOpen) {
    await redis.connect();
  }

  return redis;
}

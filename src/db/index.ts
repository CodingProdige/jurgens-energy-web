import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

import { env } from "@/src/config/env";
import * as schema from "@/src/db/schema";

const globalForDb = globalThis as unknown as {
  postgresClient?: postgres.Sql;
};

export const sql =
  globalForDb.postgresClient ??
  postgres(env.DATABASE_URL, {
    max: 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") {
  globalForDb.postgresClient = sql;
}

export const db = drizzle(sql, { schema });

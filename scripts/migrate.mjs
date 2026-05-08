import crypto from "node:crypto";
import { existsSync, readFileSync } from "node:fs";

import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
const migrationsFolder = "src/db/migrations";
const journalPath = `${migrationsFolder}/meta/_journal.json`;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

if (!existsSync(journalPath)) {
  throw new Error(`Missing migration journal at ${journalPath}.`);
}

const journal = JSON.parse(readFileSync(journalPath, "utf8"));
const sql = postgres(databaseUrl, { max: 1 });

await sql.unsafe("create schema if not exists drizzle");
await sql.unsafe(`
  create table if not exists drizzle.__drizzle_migrations (
    id serial primary key,
    hash text not null,
    created_at bigint
  )
`);

const appliedRows = await sql.unsafe(
  "select created_at from drizzle.__drizzle_migrations",
);
const applied = new Set(appliedRows.map((row) => String(row.created_at)));

for (const entry of journal.entries) {
  if (applied.has(String(entry.when))) {
    console.log(`Migration already applied: ${entry.tag}`);
    continue;
  }

  const migrationPath = `${migrationsFolder}/${entry.tag}.sql`;

  if (!existsSync(migrationPath)) {
    throw new Error(`Missing migration file at ${migrationPath}.`);
  }

  const migrationSql = readFileSync(migrationPath, "utf8");
  const hash = crypto.createHash("sha256").update(migrationSql).digest("hex");
  const statements = migrationSql
    .split("--> statement-breakpoint")
    .map((statement) => statement.trim())
    .filter(Boolean);

  await sql.begin(async (tx) => {
    for (const statement of statements) {
      await tx.unsafe(statement);
    }

    await tx.unsafe(
      "insert into drizzle.__drizzle_migrations (hash, created_at) values ($1, $2)",
      [hash, entry.when],
    );
  });

  console.log(`Applied migration: ${entry.tag}`);
}

await sql.end();

import bcrypt from "bcryptjs";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const email = process.env.ADMIN_EMAIL ?? "admin@example.com";
const password = process.env.ADMIN_PASSWORD;
const name = process.env.ADMIN_NAME ?? "Marketplace Admin";

if (!password || password.length < 8) {
  throw new Error("ADMIN_PASSWORD must be at least 8 characters.");
}

const sql = postgres(databaseUrl, { max: 1 });
const normalizedEmail = email.toLowerCase();
const passwordHash = await bcrypt.hash(password, 12);
const [adminUser] = await sql`
  insert into users (name, email, password_hash, is_active)
  values (${name}, ${normalizedEmail}, ${passwordHash}, true)
  on conflict (email)
  do update set
    name = excluded.name,
    password_hash = excluded.password_hash,
    is_active = true,
    updated_at = now()
  returning id
`;

await sql`
  insert into user_roles (user_id, role)
  values
    (${adminUser.id}, 'customer'),
    (${adminUser.id}, 'admin')
  on conflict (user_id, role)
  do nothing
`;

await sql.end();

console.log(`Seeded admin user: ${email.toLowerCase()}`);

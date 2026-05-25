import bcrypt from "bcryptjs";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const email = process.env.SELLER_EMAIL ?? "seller@example.com";
const password = process.env.SELLER_PASSWORD ?? process.env.ADMIN_PASSWORD;
const name = process.env.SELLER_NAME ?? "Internal Test Seller";
const storeName = process.env.SELLER_STORE_NAME ?? "Piessang Test Seller";
const storeSlug = process.env.SELLER_STORE_SLUG ?? "piessang-test-seller";

if (!password || password.length < 8) {
  throw new Error("SELLER_PASSWORD or ADMIN_PASSWORD must be at least 8 characters.");
}

const sql = postgres(databaseUrl, { max: 1 });
const normalizedEmail = email.toLowerCase();
const passwordHash = await bcrypt.hash(password, 12);

const [sellerUser] = await sql`
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
  values (${sellerUser.id}, 'seller_owner')
  on conflict (user_id, role)
  do nothing
`;

const [seller] = await sql`
  insert into sellers (owner_user_id, display_name, slug, status)
  values (${sellerUser.id}, ${storeName}, ${storeSlug}, 'active')
  on conflict (slug)
  do update set
    owner_user_id = excluded.owner_user_id,
    display_name = excluded.display_name,
    status = 'active',
    updated_at = now()
  returning id
`;

await sql`
  insert into seller_staff (seller_id, user_id, role)
  values (${seller.id}, ${sellerUser.id}, 'owner')
  on conflict (seller_id, user_id)
  do update set role = excluded.role
`;

await sql`
  insert into seller_fulfillment_profiles (
    seller_id,
    contact_name,
    contact_phone,
    contact_email,
    address_type,
    address_line_1,
    suburb,
    city,
    province,
    postal_code,
    country_code,
    collection_instructions,
    is_verified
  )
  values (
    ${seller.id},
    ${name},
    ${process.env.SELLER_PHONE ?? "0827223783"},
    ${normalizedEmail},
    'business',
    ${process.env.SELLER_ADDRESS_LINE_1 ?? "22 Chantilly Avenue"},
    ${process.env.SELLER_SUBURB ?? "Paarl"},
    ${process.env.SELLER_CITY ?? "Paarl"},
    ${process.env.SELLER_PROVINCE ?? "Western Cape"},
    ${process.env.SELLER_POSTAL_CODE ?? "7620"},
    'ZA',
    ${process.env.SELLER_COLLECTION_INSTRUCTIONS ?? "Collect from the seller reception desk."},
    true
  )
  on conflict (seller_id)
  do update set
    contact_name = excluded.contact_name,
    contact_phone = excluded.contact_phone,
    contact_email = excluded.contact_email,
    address_type = excluded.address_type,
    address_line_1 = excluded.address_line_1,
    suburb = excluded.suburb,
    city = excluded.city,
    province = excluded.province,
    postal_code = excluded.postal_code,
    country_code = excluded.country_code,
    collection_instructions = excluded.collection_instructions,
    is_verified = excluded.is_verified,
    updated_at = now()
`;

await sql.end();

console.log(`Seeded seller user: ${normalizedEmail}`);

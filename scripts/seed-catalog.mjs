import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.");
}

const sql = postgres(databaseUrl, { max: 1 });

function slugify(value) {
  return value
    .trim()
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);
}

function category(name, children) {
  return { children, name };
}

function branch(name, children = []) {
  return { children, name };
}

const categories = [
  category("Gas Cylinders", [
    branch("Full LPG Cylinders", [
      "3 kg LPG Cylinders",
      "5 kg LPG Cylinders",
      "9 kg LPG Cylinders",
      "14 kg LPG Cylinders",
      "19 kg LPG Cylinders",
      "48 kg LPG Cylinders",
    ]),
    branch("Cylinder Exchange", [
      "9 kg Cylinder Exchange",
      "14 kg Cylinder Exchange",
      "19 kg Cylinder Exchange",
      "48 kg Cylinder Exchange",
    ]),
    branch("Empty Cylinders", [
      "Empty LPG Cylinders",
      "Cylinder Deposits",
      "Cylinder Recertification",
    ]),
    branch("Cylinder Accessories", [
      "Cylinder Caps",
      "Cylinder Seals",
      "Cylinder Trolleys",
      "Cylinder Cages",
    ]),
  ]),
  category("Gas Geysers", [
    branch("Indoor Gas Geysers"),
    branch("Outdoor Gas Geysers"),
    branch("Constant Temperature Geysers"),
    branch("Low Pressure Geysers"),
    branch("Geyser Flues & Kits"),
    branch("Geyser Spares"),
  ]),
  category("Gas Appliances", [
    branch("Gas Stoves"),
    branch("Gas Cooker Tops"),
    branch("Single Burners"),
    branch("Double Burners"),
    branch("Camping Stoves"),
    branch("Gas Heaters"),
  ]),
  category("Burners & Cooker Equipment", [
    branch("Cast Iron Burners"),
    branch("Boiling Rings"),
    branch("Potjie Burners"),
    branch("Wok Burners"),
    branch("Burner Stands"),
    branch("Cooker Spares"),
  ]),
  category("Regulators & Valves", [
    branch("LPG Regulators"),
    branch("Low Pressure Regulators"),
    branch("High Pressure Regulators"),
    branch("Changeover Valves"),
    branch("Safety Valves"),
    branch("Gauges"),
  ]),
  category("Hoses & Fittings", [
    branch("Gas Hoses", [
      "1.2 m Gas Hoses",
      "2 m Gas Hoses",
      "3 m Gas Hoses",
      "Bulk Gas Hose",
    ]),
    branch("Hose Clamps"),
    branch("Brass Fittings"),
    branch("Nozzles & Jets"),
    branch("Quick Couplers"),
    branch("Adapters"),
  ]),
  category("Installation & Safety", [
    branch("Installation Kits"),
    branch("Leak Detection"),
    branch("Gas Cages"),
    branch("Mounting Brackets"),
    branch("Fire Safety"),
    branch("Compliance Accessories"),
  ]),
  category("Spares & Maintenance", [
    branch("Geyser Spares"),
    branch("Stove Spares"),
    branch("Burner Spares"),
    branch("Ignition Parts"),
    branch("Service Kits"),
    branch("Cleaning & Maintenance"),
  ]),
];

const brands = [
  "Jurgens Energy",
  "Generic / Unbranded",
  "Cadac",
  "Alva",
  "Totai",
  "Dewhot",
  "Rinnai",
  "Paloma",
  "Bosch",
  "Kwikot",
  "Megamaster",
  "Safire",
  "LeisureQuip",
  "LK's",
  "Bull",
  "Oryx Energies",
  "Afrox",
  "Easigas",
  "Handigas",
  "Typhoon",
];

const activeCategoryPaths = new Set();
const activeBrandSlugs = new Set();

async function upsertCategory(node, parent, depth, sortOrder) {
  const slug = slugify(node.name);
  const path = parent ? `${parent.path}/${slug}` : slug;
  activeCategoryPaths.add(path);

  const [row] = await sql`
    insert into categories (
      parent_id,
      name,
      slug,
      path,
      depth,
      commission_rate_bps,
      status,
      sort_order,
      updated_at
    )
    values (
      ${parent?.id ?? null},
      ${node.name},
      ${slug},
      ${path},
      ${depth},
      null,
      'active',
      ${sortOrder},
      now()
    )
    on conflict (path)
    do update set
      parent_id = excluded.parent_id,
      name = excluded.name,
      slug = excluded.slug,
      depth = excluded.depth,
      commission_rate_bps = null,
      status = 'active',
      sort_order = excluded.sort_order,
      updated_at = now()
    returning id, path
  `;

  const children = node.children ?? [];

  for (const [index, child] of children.entries()) {
    await upsertCategory(
      typeof child === "string" ? branch(child) : child,
      row,
      depth + 1,
      index,
    );
  }
}

async function cleanupStaleCategories() {
  const rows = await sql`
    select id, path
    from categories
    order by depth desc, path desc
  `;

  for (const row of rows) {
    if (activeCategoryPaths.has(row.path)) {
      continue;
    }

    await sql`
      delete from categories
      where id = ${row.id}
        and not exists (
          select 1 from products where products.category_id = categories.id
        )
        and not exists (
          select 1 from categories children where children.parent_id = categories.id
        )
    `;

    await sql`
      update categories
      set status = 'archived', updated_at = now()
      where id = ${row.id}
    `;
  }
}

async function cleanupStaleBrands() {
  const rows = await sql`
    select id, slug
    from brands
    order by name
  `;

  for (const row of rows) {
    if (activeBrandSlugs.has(row.slug)) {
      continue;
    }

    await sql`
      delete from brands
      where id = ${row.id}
        and not exists (
          select 1 from products where products.brand_id = brands.id
        )
    `;

    await sql`
      update brands
      set status = 'archived', updated_at = now()
      where id = ${row.id}
    `;
  }
}

for (const [index, item] of categories.entries()) {
  await upsertCategory(item, null, 0, index);
}

for (const name of brands) {
  const slug = slugify(name);
  activeBrandSlugs.add(slug);

  await sql`
    insert into brands (name, slug, status, updated_at)
    values (${name}, ${slug}, 'active', now())
    on conflict (slug)
    do update set
      name = excluded.name,
      status = 'active',
      updated_at = now()
  `;
}

await cleanupStaleCategories();
await cleanupStaleBrands();
await sql.end();

console.log(
  `Seeded gas catalog taxonomy: ${categories.length} root categories and ${brands.length} preset brands.`,
);

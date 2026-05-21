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

function category(name, commissionRateBps, children) {
  return { children, commissionRateBps, name };
}

function branch(name, children) {
  return { children, name };
}

const categories = [
  category("Fashion & Apparel", 1200, [
    branch("Clothing", [
      "T-Shirts",
      "Shirts",
      "Hoodies & Sweaters",
      "Jackets & Coats",
      "Dresses",
      "Pants",
      "Jeans",
      "Activewear",
      "Sleepwear",
      "Underwear",
    ]),
    branch("Shoes", [
      "Sneakers",
      "Formal Shoes",
      "Boots",
      "Sandals",
      "Heels",
      "Loafers",
      "Sports Shoes",
    ]),
    branch("Bags & Accessories", [
      "Handbags",
      "Backpacks",
      "Wallets",
      "Belts",
      "Hats & Caps",
      "Scarves",
      "Sunglasses",
    ]),
    branch("Jewelry & Watches", [
      "Fine Jewelry",
      "Fashion Jewelry",
      "Watches",
      "Rings",
      "Necklaces",
      "Earrings",
    ]),
  ]),
  category("Electronics", 800, [
    branch("Phones & Accessories", [
      "Smartphones",
      "Feature Phones",
      "Phone Cases",
      "Chargers & Cables",
      "Screen Protectors",
      "Power Banks",
    ]),
    branch("Computers", [
      "Laptops",
      "Desktop Computers",
      "Monitors",
      "Keyboards & Mice",
      "Computer Storage",
      "Printers & Scanners",
    ]),
    branch("Audio", [
      "Headphones",
      "Earbuds",
      "Speakers",
      "Microphones",
      "Home Audio",
      "DJ Equipment",
    ]),
    branch("Cameras & Imaging", [
      "Digital Cameras",
      "Camera Lenses",
      "Action Cameras",
      "Drones",
      "Lighting & Studio",
      "Camera Accessories",
    ]),
    branch("Gaming", [
      "Consoles",
      "Video Games",
      "Controllers",
      "Gaming Headsets",
      "Gaming Chairs",
      "PC Gaming Parts",
    ]),
  ]),
  category("Home & Living", 1000, [
    branch("Furniture", [
      "Sofas",
      "Tables",
      "Chairs",
      "Beds & Mattresses",
      "Storage Furniture",
      "Office Furniture",
    ]),
    branch("Home Decor", [
      "Wall Art",
      "Mirrors",
      "Candles",
      "Vases",
      "Clocks",
      "Decorative Accessories",
    ]),
    branch("Kitchen & Dining", [
      "Cookware",
      "Dinnerware",
      "Drinkware",
      "Kitchen Tools",
      "Small Appliances",
      "Food Storage",
    ]),
    branch("Bedding & Bath", [
      "Bedding Sets",
      "Pillows",
      "Blankets",
      "Towels",
      "Bath Accessories",
      "Laundry",
    ]),
    branch("Lighting", [
      "Ceiling Lights",
      "Table Lamps",
      "Floor Lamps",
      "Outdoor Lighting",
      "Smart Lighting",
    ]),
  ]),
  category("Beauty & Personal Care", 1400, [
    branch("Makeup", [
      "Face Makeup",
      "Eye Makeup",
      "Lip Makeup",
      "Makeup Brushes",
      "Makeup Palettes",
    ]),
    branch("Skincare", [
      "Cleansers",
      "Moisturizers",
      "Serums",
      "Sunscreen",
      "Face Masks",
      "Treatments",
    ]),
    branch("Hair Care", [
      "Shampoo",
      "Conditioner",
      "Hair Styling",
      "Hair Treatments",
      "Hair Tools",
    ]),
    branch("Fragrance", [
      "Perfume",
      "Cologne",
      "Body Mist",
      "Fragrance Sets",
    ]),
    branch("Personal Care", [
      "Bath & Body",
      "Oral Care",
      "Shaving & Grooming",
      "Deodorants",
      "Personal Care Tools",
    ]),
  ]),
  category("Food & Beverage", 1200, [
    branch("Pantry", [
      "Snacks",
      "Breakfast Foods",
      "Pasta & Grains",
      "Sauces & Condiments",
      "Baking",
      "Canned Goods",
    ]),
    branch("Drinks", [
      "Coffee",
      "Tea",
      "Juice",
      "Soft Drinks",
      "Energy Drinks",
      "Water",
    ]),
    branch("Specialty Food", [
      "Organic",
      "Vegan",
      "Gluten Free",
      "International Foods",
      "Gourmet Gifts",
    ]),
    branch("Fresh & Frozen", [
      "Fresh Produce",
      "Meat & Seafood",
      "Dairy",
      "Frozen Meals",
      "Bakery",
    ]),
  ]),
  category("Health & Wellness", 1000, [
    branch("Vitamins & Supplements", [
      "Multivitamins",
      "Protein",
      "Minerals",
      "Herbal Supplements",
      "Sports Nutrition",
    ]),
    branch("Medical Supplies", [
      "First Aid",
      "Mobility Aids",
      "Monitoring Devices",
      "Masks & Sanitizers",
    ]),
    branch("Wellness", [
      "Massage",
      "Aromatherapy",
      "Sleep Support",
      "Fitness Recovery",
      "Sexual Wellness",
    ]),
  ]),
  category("Sports & Outdoors", 1000, [
    branch("Fitness", [
      "Weights",
      "Cardio Equipment",
      "Yoga & Pilates",
      "Fitness Accessories",
      "Wearable Fitness",
    ]),
    branch("Team Sports", [
      "Soccer",
      "Basketball",
      "Rugby",
      "Cricket",
      "Tennis",
      "Golf",
    ]),
    branch("Outdoor Recreation", [
      "Camping",
      "Hiking",
      "Cycling",
      "Fishing",
      "Water Sports",
      "Travel Gear",
    ]),
    branch("Sportswear", [
      "Training Tops",
      "Training Bottoms",
      "Sports Bras",
      "Performance Shoes",
    ]),
  ]),
  category("Toys, Kids & Baby", 1000, [
    branch("Toys", [
      "Action Figures",
      "Dolls",
      "Building Toys",
      "Educational Toys",
      "Outdoor Toys",
      "Board Games",
    ]),
    branch("Baby", [
      "Diapers",
      "Feeding",
      "Strollers",
      "Car Seats",
      "Nursery",
      "Baby Clothing",
    ]),
    branch("Kids", [
      "Kids Clothing",
      "Kids Shoes",
      "School Supplies",
      "Kids Room",
    ]),
  ]),
  category("Books, Media & Stationery", 800, [
    branch("Books", [
      "Fiction",
      "Non-Fiction",
      "Children's Books",
      "Textbooks",
      "Comics & Graphic Novels",
    ]),
    branch("Music & Movies", [
      "Vinyl",
      "CDs",
      "DVDs & Blu-ray",
      "Collectibles",
    ]),
    branch("Stationery", [
      "Notebooks",
      "Pens & Pencils",
      "Art Supplies",
      "Office Supplies",
      "Calendars & Planners",
    ]),
  ]),
  category("Art, Handmade & Collectibles", 1200, [
    branch("Art", [
      "Paintings",
      "Prints",
      "Photography",
      "Sculpture",
      "Digital Art",
    ]),
    branch("Handmade", [
      "Handmade Jewelry",
      "Handmade Decor",
      "Handmade Clothing",
      "Craft Supplies",
    ]),
    branch("Collectibles", [
      "Trading Cards",
      "Coins",
      "Stamps",
      "Memorabilia",
      "Antiques",
    ]),
  ]),
  category("Automotive", 900, [
    branch("Parts", [
      "Engine Parts",
      "Brake Parts",
      "Suspension",
      "Electrical",
      "Filters",
    ]),
    branch("Accessories", [
      "Interior Accessories",
      "Exterior Accessories",
      "Car Covers",
      "Phone Mounts",
      "Dash Cameras",
    ]),
    branch("Tools & Maintenance", [
      "Car Care",
      "Oils & Fluids",
      "Tyres & Wheels",
      "Workshop Tools",
    ]),
  ]),
  category("Pet Supplies", 1000, [
    branch("Dogs", [
      "Dog Food",
      "Dog Treats",
      "Dog Toys",
      "Dog Beds",
      "Leashes & Collars",
    ]),
    branch("Cats", [
      "Cat Food",
      "Cat Treats",
      "Cat Toys",
      "Cat Litter",
      "Cat Trees",
    ]),
    branch("Other Pets", [
      "Bird Supplies",
      "Fish Supplies",
      "Small Animal Supplies",
      "Reptile Supplies",
    ]),
  ]),
  category("Garden & DIY", 1000, [
    branch("Garden", [
      "Plants",
      "Seeds",
      "Planters",
      "Garden Tools",
      "Outdoor Furniture",
      "Irrigation",
    ]),
    branch("DIY & Tools", [
      "Power Tools",
      "Hand Tools",
      "Hardware",
      "Paint",
      "Electrical",
      "Plumbing",
    ]),
  ]),
  category("Digital Products", 1500, [
    branch("Software", [
      "Productivity Software",
      "Design Software",
      "Security Software",
      "Developer Tools",
    ]),
    branch("Digital Media", [
      "Templates",
      "E-books",
      "Stock Assets",
      "Music & Audio",
      "Courses",
    ]),
  ]),
  category("Services", 1500, [
    branch("Creative Services", [
      "Graphic Design",
      "Photography",
      "Video Editing",
      "Writing & Translation",
    ]),
    branch("Professional Services", [
      "Consulting",
      "Accounting",
      "Legal Services",
      "Business Support",
    ]),
    branch("Home Services", [
      "Cleaning",
      "Repairs",
      "Installation",
      "Moving Services",
    ]),
  ]),
  category("Business & Industrial", 900, [
    branch("Business Supplies", [
      "Packaging",
      "Labels",
      "Office Furniture",
      "Cleaning Supplies",
      "Safety Supplies",
    ]),
    branch("Industrial", [
      "Machinery",
      "Raw Materials",
      "Lab Equipment",
      "Material Handling",
    ]),
  ]),
];

const brands = [
  "Generic / Unbranded",
  "Apple",
  "Samsung",
  "Sony",
  "LG",
  "Microsoft",
  "Dell",
  "HP",
  "Lenovo",
  "Asus",
  "Acer",
  "Canon",
  "Nikon",
  "GoPro",
  "DJI",
  "Bose",
  "JBL",
  "Sennheiser",
  "Logitech",
  "Nike",
  "Adidas",
  "Puma",
  "New Balance",
  "Under Armour",
  "Reebok",
  "Converse",
  "Vans",
  "Levi's",
  "Zara",
  "H&M",
  "Gucci",
  "Prada",
  "Louis Vuitton",
  "Rolex",
  "Casio",
  "Fossil",
  "L'Oreal",
  "Maybelline",
  "Revlon",
  "Nivea",
  "Dove",
  "The Ordinary",
  "CeraVe",
  "Philips",
  "Braun",
  "Dyson",
  "KitchenAid",
  "Nespresso",
  "Bosch",
  "Makita",
  "DeWalt",
  "Black+Decker",
  "Toyota",
  "BMW",
  "Mercedes-Benz",
  "Volkswagen",
  "Ford",
  "Purina",
  "Royal Canin",
  "Lego",
  "Mattel",
  "Hasbro",
  "Penguin Books",
  "Oxford",
  "Moleskine",
  "Faber-Castell",
  "Adobe",
  "Canva",
  "Notion",
  "Shopify",
];

async function upsertCategory(node, parent, depth, sortOrder) {
  const slug = slugify(node.name);
  const path = parent ? `${parent.path}/${slug}` : slug;
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
      ${node.commissionRateBps ?? null},
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
      commission_rate_bps = excluded.commission_rate_bps,
      status = excluded.status,
      sort_order = excluded.sort_order,
      updated_at = now()
    returning id, path
  `;

  const children = node.children ?? [];

  for (const [index, child] of children.entries()) {
    await upsertCategory(
      typeof child === "string" ? branch(child, []) : child,
      row,
      depth + 1,
      index,
    );
  }
}

for (const [index, item] of categories.entries()) {
  await upsertCategory(item, null, 0, index);
}

for (const name of brands) {
  const slug = slugify(name);

  await sql`
    insert into brands (name, slug, status, updated_at)
    values (${name}, ${slug}, 'active', now())
    on conflict (slug)
    do update set
      name = excluded.name,
      status = excluded.status,
      updated_at = now()
  `;
}

await sql.end();

console.log(
  `Seeded catalog taxonomy: ${categories.length} root categories and ${brands.length} brands.`,
);

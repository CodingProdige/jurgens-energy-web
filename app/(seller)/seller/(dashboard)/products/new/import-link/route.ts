import { isIP } from "node:net";

import * as cheerio from "cheerio";
import { z } from "zod";

import { requireAdminCapability } from "@/src/modules/auth/permissions";

type ImportedProductImage = {
  alt: string;
  url: string;
};

type ImportedProductScan = {
  barcode: string;
  brandName: string;
  compareAtPrice: string;
  description: string;
  images: ImportedProductImage[];
  longDescription: string;
  price: string;
  productName: string;
  sku: string;
  sourceUrl: string;
};

type JsonRecord = Record<string, unknown>;

const scanSchema = z.object({
  url: z.string().trim().url(),
});
const blockedHostnames = new Set(["localhost", "127.0.0.1", "0.0.0.0"]);

function isPrivateIpv4(hostname: string) {
  if (!isIP(hostname)) {
    return false;
  }

  if (hostname.includes(":")) {
    return true;
  }

  const [first = 0, second = 0] = hostname.split(".").map(Number);

  return (
    first === 10 ||
    first === 127 ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 169 && second === 254)
  );
}

function validateImportUrl(value: string) {
  const parsedUrl = new URL(value);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("Paste a normal website link that starts with http or https.");
  }

  const hostname = parsedUrl.hostname.toLowerCase();

  if (blockedHostnames.has(hostname) || isPrivateIpv4(hostname)) {
    throw new Error("That link cannot be imported.");
  }

  return parsedUrl;
}

function sendEvent(
  controller: ReadableStreamDefaultController<Uint8Array>,
  event: Record<string, unknown>,
) {
  controller.enqueue(new TextEncoder().encode(`${JSON.stringify(event)}\n`));
}

function cleanText(value: unknown) {
  return String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
}

function toAbsoluteUrl(value: string, baseUrl: string) {
  try {
    const url = new URL(value, baseUrl);

    if (!["http:", "https:"].includes(url.protocol)) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

function firstString(...values: unknown[]): string {
  for (const value of values) {
    if (Array.isArray(value)) {
      const nested = firstString(...value);

      if (nested) {
        return nested;
      }

      continue;
    }

    const text = cleanText(value);

    if (text) {
      return text;
    }
  }

  return "";
}

function getJsonRecord(value: unknown): JsonRecord | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonRecord)
    : null;
}

function getJsonPath(record: JsonRecord | null, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    const currentRecord = getJsonRecord(current);

    if (!currentRecord) {
      return undefined;
    }

    current = currentRecord[key];
  }

  return current;
}

function isProductJsonLd(record: JsonRecord) {
  const type = record["@type"];
  const types = Array.isArray(type) ? type : [type];

  return types.some((item) => String(item).toLowerCase() === "product");
}

function findProductJsonLd(value: unknown): JsonRecord | null {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findProductJsonLd(item);

      if (found) {
        return found;
      }
    }

    return null;
  }

  const record = getJsonRecord(value);

  if (!record) {
    return null;
  }

  if (isProductJsonLd(record)) {
    return record;
  }

  const graph = record["@graph"];

  if (graph) {
    const found = findProductJsonLd(graph);

    if (found) {
      return found;
    }
  }

  for (const child of Object.values(record)) {
    const found = findProductJsonLd(child);

    if (found) {
      return found;
    }
  }

  return null;
}

function getMeta($: cheerio.CheerioAPI, ...names: string[]) {
  for (const name of names) {
    const content = $(`meta[property="${name}"], meta[name="${name}"]`)
      .first()
      .attr("content");

    if (content) {
      return cleanText(content);
    }
  }

  return "";
}

function collectJsonLdProducts($: cheerio.CheerioAPI) {
  const products: JsonRecord[] = [];

  $('script[type="application/ld+json"]').each((_index, element) => {
    const content = $(element).contents().text();

    if (!content.trim()) {
      return;
    }

    try {
      const parsed = JSON.parse(content);
      const product = findProductJsonLd(parsed);

      if (product) {
        products.push(product);
      }
    } catch {
      // Ignore broken structured data.
    }
  });

  return products;
}

function collectImages({
  $,
  baseUrl,
  product,
  productName,
}: {
  $: cheerio.CheerioAPI;
  baseUrl: string;
  product: JsonRecord | null;
  productName: string;
}) {
  const urls = new Map<string, ImportedProductImage>();
  const addImage = (url: unknown, alt?: unknown) => {
    const absoluteUrl = toAbsoluteUrl(firstString(url), baseUrl);

    if (!absoluteUrl || urls.has(absoluteUrl)) {
      return;
    }

    urls.set(absoluteUrl, {
      alt: cleanText(alt) || productName || "Imported product image",
      url: absoluteUrl,
    });
  };

  const productImages = product?.image;

  if (Array.isArray(productImages)) {
    productImages.forEach((image) => addImage(image, productName));
  } else if (getJsonRecord(productImages)) {
    addImage((productImages as JsonRecord).url, productName);
  } else {
    addImage(productImages, productName);
  }

  addImage(getMeta($, "og:image", "twitter:image"), productName);

  $("img").each((_index, element) => {
    const image = $(element);
    const src =
      image.attr("src") ||
      image.attr("data-src") ||
      image.attr("data-original") ||
      image.attr("data-lazy-src");
    const alt = image.attr("alt");

    if (src && /product|gallery|image|photo|main|media/i.test(`${src} ${alt ?? ""}`)) {
      addImage(src, alt);
    }
  });

  return Array.from(urls.values()).slice(0, 12);
}

function extractMoney(value: unknown) {
  const text = firstString(value);
  const match = text.match(/(?:R|ZAR|\$|€|£)?\s*([0-9]+(?:[,.][0-9]{1,2})?)/i);

  return match?.[1]?.replace(",", ".") ?? "";
}

function toHtmlDescription(value: string) {
  return value
    .split(/\n{2,}|(?<=\.)\s+(?=[A-Z])/)
    .map((paragraph) => cleanText(paragraph))
    .filter(Boolean)
    .slice(0, 8)
    .map((paragraph) => `<p>${paragraph}</p>`)
    .join("");
}

function extractProductData(html: string, sourceUrl: string): ImportedProductScan {
  const $ = cheerio.load(html);
  const [product = null] = collectJsonLdProducts($);
  const offers = getJsonRecord(product?.offers) ?? getJsonRecord(
    Array.isArray(product?.offers) ? product?.offers[0] : null,
  );
  const brand = getJsonRecord(product?.brand);
  const productName = firstString(
    product?.name,
    getMeta($, "product:name", "og:title", "twitter:title"),
    $("h1").first().text(),
    $("title").first().text(),
  ).slice(0, 240);
  const description = firstString(
    product?.description,
    getMeta($, "description", "og:description", "twitter:description"),
    $('[itemprop="description"]').first().text(),
  );
  const sku = firstString(product?.sku, product?.mpn, getMeta($, "product:retailer_item_id"))
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toUpperCase()
    .slice(0, 120);
  const barcode = firstString(
    product?.gtin,
    product?.gtin8,
    product?.gtin12,
    product?.gtin13,
    product?.gtin14,
  ).slice(0, 120);
  const brandName = firstString(
    brand?.name,
    product?.brand,
    getMeta($, "product:brand", "brand"),
  ).slice(0, 120);
  const price = extractMoney(
    firstString(
      offers?.price,
      getJsonPath(offers, ["priceSpecification", "price"]),
      getMeta($, "product:price:amount", "product:sale_price:amount"),
      $('[itemprop="price"]').first().attr("content"),
      $('[itemprop="price"]').first().text(),
    ),
  );
  const compareAtPrice = extractMoney(
    firstString(
      getMeta($, "product:original_price:amount", "product:retail_price:amount"),
      $("[data-compare-at-price], .compare-at-price, .was-price").first().text(),
    ),
  );

  return {
    barcode,
    brandName,
    compareAtPrice,
    description: description.slice(0, 400),
    images: collectImages({ $, baseUrl: sourceUrl, product, productName }),
    longDescription: toHtmlDescription(description).slice(0, 12000),
    price,
    productName,
    sku,
    sourceUrl,
  };
}

async function fetchProductPage(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml",
        "User-Agent":
          "JurgensEnergyProductImporter/1.0 (+https://jurgensenergy.com; product import)",
      },
      redirect: "follow",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error("That page could not be opened.");
    }

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.includes("text/html")) {
      throw new Error("That link did not return a product web page.");
    }

    return response.text();
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        sendEvent(controller, {
          message: "Confirming catalog access...",
          step: "auth",
          type: "status",
        });
        const access = await requireAdminCapability("admin.catalog.manage");

        if (!access.ok) {
          throw new Error("Catalog access could not be confirmed.");
        }

        const body = await request.json();
        const parsed = scanSchema.safeParse(body);

        if (!parsed.success) {
          throw new Error("Paste a valid product page link.");
        }

        sendEvent(controller, {
          message: "Checking that the link is safe to open...",
          step: "validate",
          type: "status",
        });
        const url = validateImportUrl(parsed.data.url);

        sendEvent(controller, {
          message: "Opening the product page...",
          step: "fetch",
          type: "status",
        });
        const html = await fetchProductPage(url);

        sendEvent(controller, {
          message: "Reading product details from the page...",
          step: "extract",
          type: "status",
        });
        const product = extractProductData(html, url.toString());

        sendEvent(controller, {
          message: "Looking for product images...",
          step: "media",
          type: "status",
        });

        if (!product.productName && !product.description && product.images.length === 0) {
          throw new Error("No product details were found on that page.");
        }

        sendEvent(controller, {
          message: "Import preview is ready for review.",
          product,
          step: "complete",
          type: "result",
        });
      } catch (error) {
        const message =
          error instanceof Error && error.message === "NEXT_REDIRECT"
            ? "Sign in to the admin dashboard before importing products."
            : error instanceof Error
              ? error.message
              : "The product could not be imported from that link.";

        sendEvent(controller, {
          message,
          step: "error",
          type: "error",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/x-ndjson; charset=utf-8",
    },
  });
}

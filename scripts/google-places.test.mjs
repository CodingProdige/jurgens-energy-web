import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  GOOGLE_PLACE_DETAILS_FIELD_MASK,
  GOOGLE_PLACES_AUTOCOMPLETE_FIELD_MASK,
  GooglePlacesApiError,
  createGooglePlacesClient,
  isSameOriginGooglePlacesRequest,
  normalizeSouthAfricanProvince,
  parseGooglePlaceAddress,
} from "../src/modules/places/google-places.ts";

function jsonResponse(payload, init = {}) {
  return new Response(JSON.stringify(payload), {
    headers: { "Content-Type": "application/json", ...init.headers },
    status: init.status ?? 200,
  });
}

function component(longText, shortText, ...types) {
  return { longText, shortText, types };
}

const southAfricanPlace = {
  addressComponents: [
    component("12", "12", "street_number"),
    component("Main Road", "Main Rd", "route"),
    component("Foundry Building", "Foundry Building", "premise"),
    component("Unit 4", "Unit 4", "subpremise"),
    component(
      "Paarl Central",
      "Paarl Central",
      "sublocality_level_1",
      "sublocality",
      "political",
    ),
    component("Paarl", "Paarl", "locality", "political"),
    component(
      "Western Cape",
      "WC",
      "administrative_area_level_1",
      "political",
    ),
    component("7646", "7646", "postal_code"),
    component("South Africa", "ZA", "country", "political"),
  ],
  formattedAddress: "12 Main Road, Paarl Central, Paarl, 7646, South Africa",
  id: "ChIJ-test-place-123",
};

test("normalizes South African province names and common abbreviations", () => {
  assert.equal(normalizeSouthAfricanProvince("WC"), "Western Cape");
  assert.equal(normalizeSouthAfricanProvince(" kwaZulu natal "), "KwaZulu-Natal");
  assert.equal(normalizeSouthAfricanProvince("North-West"), "North West");
  assert.equal(normalizeSouthAfricanProvince("Gauteng"), "Gauteng");
  assert.equal(normalizeSouthAfricanProvince("Unmapped Province"), "Unmapped Province");
  assert.equal(normalizeSouthAfricanProvince(""), "");
});

test("public proxy origin checks require an explicitly allowed same origin", () => {
  const allowedOrigins = new Set([
    "https://jurgensenergy.com",
    "https://admin.jurgensenergy.com",
  ]);

  assert.equal(
    isSameOriginGooglePlacesRequest({
      allowedOrigins,
      origin: null,
      requestUrl: "https://jurgensenergy.com/api/places/autocomplete",
    }),
    false,
  );
  assert.equal(
    isSameOriginGooglePlacesRequest({
      allowedOrigins,
      origin: "https://admin.jurgensenergy.com",
      requestUrl:
        "https://admin.jurgensenergy.com/api/places/autocomplete",
    }),
    true,
  );
  assert.equal(
    isSameOriginGooglePlacesRequest({
      allowedOrigins,
      origin: "https://attacker.example",
      requestUrl: "https://jurgensenergy.com/api/places/autocomplete",
    }),
    false,
  );
  assert.equal(
    isSameOriginGooglePlacesRequest({
      allowedOrigins,
      origin: "not a URL",
      requestUrl: "https://jurgensenergy.com/api/places/autocomplete",
    }),
    false,
  );
  assert.equal(
    isSameOriginGooglePlacesRequest({
      allowedOrigins,
      origin: "https://unconfigured.example",
      requestUrl: "https://unconfigured.example/api/places/autocomplete",
    }),
    false,
  );
});

test("projects Google address components into the canonical address shape", () => {
  assert.deepEqual(parseGooglePlaceAddress(southAfricanPlace), {
    addressLine1: "12 Main Road",
    addressLine2: "Unit 4, Foundry Building",
    city: "Paarl",
    countryCode: "ZA",
    formattedAddress:
      "12 Main Road, Paarl Central, Paarl, 7646, South Africa",
    placeId: "ChIJ-test-place-123",
    postalCode: "7646",
    province: "Western Cape",
    suburb: "Paarl Central",
  });
});

test("keeps parser fallbacks editable when Google omits address components", () => {
  const address = parseGooglePlaceAddress({
    addressComponents: [
      component("Warehouse 5", "Warehouse 5", "premise"),
      component("Cape Town", "Cape Town", "locality", "political"),
      component(
        "Cape Town",
        "Cape Town",
        "sublocality_level_1",
        "sublocality",
        "political",
      ),
      component("KZN", "KZN", "administrative_area_level_1", "political"),
      component("South Africa", "ZA", "country", "political"),
    ],
    formattedAddress: "Warehouse 5, Cape Town, South Africa",
    id: "ChIJ-fallback-place",
  });

  assert.equal(address.addressLine1, "Warehouse 5");
  assert.equal(address.addressLine2, "");
  assert.equal(address.suburb, "");
  assert.equal(address.postalCode, "");
  assert.equal(address.province, "KwaZulu-Natal");
});

test("combines a postal code suffix without coercing postal codes to numbers", () => {
  const address = parseGooglePlaceAddress({
    addressComponents: [
      component("7", "7", "street_number"),
      component("Example Street", "Example St", "route"),
      component("Cape Town", "Cape Town", "locality", "political"),
      component(
        "Western Cape",
        "WC",
        "administrative_area_level_1",
        "political",
      ),
      component("0800", "0800", "postal_code"),
      component("1234", "1234", "postal_code_suffix"),
      component("South Africa", "ZA", "country", "political"),
    ],
    formattedAddress: "7 Example Street, Cape Town, 0800-1234, South Africa",
    id: "ChIJ-postal-suffix",
  });

  assert.equal(address.postalCode, "0800-1234");
});

test("Autocomplete New uses a strict mask, session token, and region restriction", async () => {
  const requests = [];
  const client = createGooglePlacesClient(
    {
      apiBaseUrl: "https://places.example.test/v1",
      apiKey: "server-only-test-key",
      timeoutMs: 1_000,
    },
    async (url, init) => {
      requests.push({ init, url: String(url) });

      return jsonResponse({
        ignoredProviderField: "not returned",
        suggestions: [
          {
            placePrediction: {
              placeId: "ChIJ-paarl-place",
              structuredFormat: {
                mainText: { text: "12 Main Road" },
                secondaryText: { text: "Paarl, Western Cape" },
              },
              text: { text: "12 Main Road, Paarl, Western Cape" },
              types: ["street_address"],
            },
          },
          {
            queryPrediction: {
              text: { text: "This query result must be ignored" },
            },
          },
        ],
      });
    },
  );

  const suggestions = await client.autocomplete({
    includedRegionCodes: ["ZA", "za"],
    input: "  12 Main  ",
    sessionToken: "20bfc79a-e4f3-431f-98aa-c8f51d31fb00",
  });

  assert.deepEqual(suggestions, [
    {
      mainText: "12 Main Road",
      placeId: "ChIJ-paarl-place",
      secondaryText: "Paarl, Western Cape",
      text: "12 Main Road, Paarl, Western Cape",
    },
  ]);
  assert.equal(
    requests[0].url,
    "https://places.example.test/v1/places:autocomplete",
  );
  assert.equal(requests[0].init.method, "POST");
  assert.equal(
    requests[0].init.headers["X-Goog-FieldMask"],
    GOOGLE_PLACES_AUTOCOMPLETE_FIELD_MASK,
  );
  assert.equal(
    requests[0].init.headers["X-Goog-Api-Key"],
    "server-only-test-key",
    "the server sends the key only in the upstream authorization header",
  );

  const requestBody = JSON.parse(requests[0].init.body);
  assert.deepEqual(requestBody.includedRegionCodes, ["za"]);
  assert.equal(requestBody.input, "12 Main");
  assert.equal(requestBody.regionCode, "za");
  assert.equal(
    requestBody.sessionToken,
    "20bfc79a-e4f3-431f-98aa-c8f51d31fb00",
  );
  assert.equal(JSON.stringify(requestBody).includes("server-only-test-key"), false);
});

test("Place Details New terminates the same session and requests Essentials fields only", async () => {
  let request;
  const client = createGooglePlacesClient(
    {
      apiBaseUrl: "https://places.example.test/v1/",
      apiKey: "server-only-test-key",
      timeoutMs: 1_000,
    },
    async (url, init) => {
      request = { init, url: String(url) };
      return jsonResponse(southAfricanPlace);
    },
  );

  const address = await client.details({
    placeId: "ChIJ-test-place-123",
    regionCode: "ZA",
    sessionToken: "20bfc79a-e4f3-431f-98aa-c8f51d31fb00",
  });

  const url = new URL(request.url);
  assert.equal(
    `${url.origin}${url.pathname}`,
    "https://places.example.test/v1/places/ChIJ-test-place-123",
  );
  assert.equal(url.searchParams.get("languageCode"), "en");
  assert.equal(url.searchParams.get("regionCode"), "za");
  assert.equal(
    url.searchParams.get("sessionToken"),
    "20bfc79a-e4f3-431f-98aa-c8f51d31fb00",
  );
  assert.equal(request.init.method, "GET");
  assert.equal(
    request.init.headers["X-Goog-FieldMask"],
    GOOGLE_PLACE_DETAILS_FIELD_MASK,
  );
  assert.equal(GOOGLE_PLACE_DETAILS_FIELD_MASK.includes("location"), false);
  assert.equal(address.countryCode, "ZA");
});

test("provider failures expose no upstream body or API key", async () => {
  const client = createGooglePlacesClient(
    {
      apiBaseUrl: "https://places.example.test/v1",
      apiKey: "key-that-must-never-leak",
      timeoutMs: 1_000,
    },
    async () =>
      jsonResponse(
        {
          error: {
            message:
              "Provider body includes key-that-must-never-leak and account details",
          },
        },
        { status: 403 },
      ),
  );

  await assert.rejects(
    () =>
      client.autocomplete({
        input: "Main Road",
        sessionToken: "20bfc79a-e4f3-431f-98aa-c8f51d31fb00",
      }),
    (error) => {
      assert.ok(error instanceof GooglePlacesApiError);
      assert.equal(error.code, "provider_error");
      assert.equal(error.status, 403);
      assert.equal(error.message.includes("key-that-must-never-leak"), false);
      assert.equal(error.message.includes("account details"), false);
      return true;
    },
  );
});

test("every structured address surface uses the shared autocomplete", async () => {
  const expectedInstances = new Map([
    ["../components/marketplace/checkout-experience.tsx", 2],
    ["../app/(marketplace)/account/addresses/address-manager.tsx", 1],
    [
      "../app/(admin)/admin/(dashboard)/settings/business/business-information-form.tsx",
      2,
    ],
    [
      "../app/(seller)/seller/(dashboard)/shipping/shipping-managers.tsx",
      1,
    ],
    ["../app/(seller)/seller/register/seller-register-screen.tsx", 1],
  ]);

  for (const [relativePath, expectedCount] of expectedInstances) {
    const source = await readFile(new URL(relativePath, import.meta.url), "utf8");
    const instanceCount =
      source.match(/<GooglePlacesAddressAutocomplete\b/g)?.length ?? 0;

    assert.equal(
      instanceCount,
      expectedCount,
      `${relativePath} should render autocomplete for every active address group`,
    );
  }
});

import assert from "node:assert/strict";
import test from "node:test";

import {
  createCustomerSupportContactDetails,
  formatCustomerSupportBusinessAddress,
  formatCustomerSupportContactSentence,
} from "../src/modules/customer-support/contact-details.ts";

const business = {
  addressLine1: "10 Example Road",
  addressLine2: null,
  city: "Cape Town",
  companyRegistrationNumber: "2026/123456/07",
  countryCode: "ZA",
  invoiceEmail: "accounts@example.com",
  invoicePhone: "082 000 0000",
  legalName: "Jurgens Energy (Pty) Ltd",
  postalCode: "8001",
  province: "Western Cape",
  suburb: "Gardens",
  tradingName: "Jurgens Energy",
  vatRegistrationNumber: "4123456789",
};

test("formats the registered business address without duplicate locality text", () => {
  assert.equal(
    formatCustomerSupportBusinessAddress(business),
    "10 Example Road, Gardens, Cape Town, Western Cape, 8001, South Africa",
  );
});

test("prefers Marketplace Settings support channels and Business Information address", () => {
  const details = createCustomerSupportContactDetails({
    business,
    settings: {
      contactEmail: "help@example.com",
      contactPhonePrimary: "+27 82 123 4567",
      contactPhoneSecondary: "+27 82 123 4567",
      whatsappBusinessPhoneNumber: "  +27 71 234 5678  ",
    },
  });

  assert.deepEqual(details, {
    businessAddress:
      "10 Example Road, Gardens, Cape Town, Western Cape, 8001, South Africa",
    businessName: "Jurgens Energy",
    companyRegistrationNumber: "2026/123456/07",
    email: "help@example.com",
    legalName: "Jurgens Energy (Pty) Ltd",
    phoneNumbers: ["+27 82 123 4567"],
    vatRegistrationNumber: "4123456789",
    whatsappPhone: "+27712345678",
  });
  assert.equal(
    formatCustomerSupportContactSentence(details),
    "Contact Jurgens Energy: email help@example.com; call +27 82 123 4567; WhatsApp +27712345678.",
  );
});

test("falls back to Business Information when support settings are empty", () => {
  const details = createCustomerSupportContactDetails({
    business,
    settings: {
      contactEmail: "",
      contactPhonePrimary: "",
      contactPhoneSecondary: "",
      whatsappBusinessPhoneNumber: null,
    },
  });

  assert.equal(details.email, "accounts@example.com");
  assert.deepEqual(details.phoneNumbers, ["082 000 0000"]);
});

test("does not repeat the same voice and WhatsApp phone in a contact sentence", () => {
  const details = createCustomerSupportContactDetails({
    business,
    settings: {
      contactEmail: "help@example.com",
      contactPhonePrimary: "+27 82 123 4567",
      contactPhoneSecondary: "",
      whatsappBusinessPhoneNumber: "+27821234567",
    },
  });

  assert.equal(
    formatCustomerSupportContactSentence(details),
    "Contact Jurgens Energy: email help@example.com; call +27 82 123 4567.",
  );
});

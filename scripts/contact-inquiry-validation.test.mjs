import assert from "node:assert/strict";
import test from "node:test";

import {
  contactInquiryFormSchema,
  createContactInquiryMessagePreview,
  isContactInquiryHoneypotFilled,
} from "../src/modules/marketplace/contact-inquiry-validation.ts";

test("contact inquiries are validated and normalized", () => {
  assert.deepEqual(
    contactInquiryFormSchema.parse({
      company: "",
      email: " CUSTOMER@EXAMPLE.COM ",
      message: "  Please help with my order.  ",
      name: "  Thandi Customer  ",
    }),
    {
      company: "",
      email: "customer@example.com",
      message: "Please help with my order.",
      name: "Thandi Customer",
    },
  );
});

test("contact inquiries require a name, valid email and message", () => {
  const result = contactInquiryFormSchema.safeParse({
    company: "",
    email: "not-an-email",
    message: " ",
    name: " ",
  });

  assert.equal(result.success, false);

  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;

    assert.ok(fieldErrors.email?.length);
    assert.ok(fieldErrors.message?.length);
    assert.ok(fieldErrors.name?.length);
  }
});

test("the hidden company field identifies likely automated submissions", () => {
  assert.equal(isContactInquiryHoneypotFilled(""), false);
  assert.equal(isContactInquiryHoneypotFilled("   "), false);
  assert.equal(isContactInquiryHoneypotFilled("spam.example"), true);
});

test("notification previews collapse whitespace and stay within their limit", () => {
  assert.equal(
    createContactInquiryMessagePreview("One\n\n two   three", 12),
    "One two thr…",
  );
});

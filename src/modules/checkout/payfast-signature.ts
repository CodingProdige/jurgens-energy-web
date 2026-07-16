import crypto from "node:crypto";

export type PayFastField = {
  name: string;
  value: string;
};

export function encodePayFastValue(value: string) {
  return encodeURIComponent(value.trim()).replace(/%20/g, "+");
}

function createParameterString({
  fields,
  includeEmptyValues,
  passphrase,
}: {
  fields: PayFastField[];
  includeEmptyValues: boolean;
  passphrase?: string | null;
}) {
  const parameterString = fields
    .filter(
      (field) =>
        field.name !== "signature" &&
        (includeEmptyValues || field.value !== ""),
    )
    .map((field) => `${field.name}=${encodePayFastValue(field.value)}`)
    .join("&");

  return passphrase
    ? `${parameterString}&passphrase=${encodePayFastValue(passphrase)}`
    : parameterString;
}

export function createPayFastParameterString(
  fields: PayFastField[],
  passphrase?: string | null,
) {
  return createParameterString({
    fields,
    includeEmptyValues: false,
    passphrase,
  });
}

// PayFast omits blank fields when signing the hosted checkout form, but its ITN
// signature and validation request include every field posted in the callback.
export function createPayFastItnParameterString(
  fields: PayFastField[],
  passphrase?: string | null,
) {
  return createParameterString({
    fields,
    includeEmptyValues: true,
    passphrase,
  });
}

export function createPayFastSignature(
  fields: PayFastField[],
  passphrase?: string | null,
) {
  return crypto
    .createHash("md5")
    .update(createPayFastParameterString(fields, passphrase))
    .digest("hex");
}

export function createPayFastItnSignature(
  fields: PayFastField[],
  passphrase?: string | null,
) {
  return crypto
    .createHash("md5")
    .update(createPayFastItnParameterString(fields, passphrase))
    .digest("hex");
}

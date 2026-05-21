import crypto from "node:crypto";

import { env } from "@/src/config/env";

const algorithm = "aes-256-gcm";
const version = "v1";

function getSecretKey() {
  if (!env.AUTH_SECRET) {
    throw new Error("AUTH_SECRET is required to encrypt platform secrets.");
  }

  return crypto.createHash("sha256").update(env.AUTH_SECRET).digest();
}

export function encryptSecret(value: string) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, getSecretKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    version,
    iv.toString("base64url"),
    tag.toString("base64url"),
    encrypted.toString("base64url"),
  ].join(":");
}

export function decryptSecret(value: string) {
  const [storedVersion, ivValue, tagValue, encryptedValue] = value.split(":");

  if (
    storedVersion !== version ||
    !ivValue ||
    !tagValue ||
    !encryptedValue
  ) {
    throw new Error("Secret value is not in a supported encrypted format.");
  }

  const decipher = crypto.createDecipheriv(
    algorithm,
    getSecretKey(),
    Buffer.from(ivValue, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagValue, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedValue, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

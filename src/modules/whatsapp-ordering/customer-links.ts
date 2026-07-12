import crypto from "node:crypto";

import { and, desc, eq, gt } from "drizzle-orm";

import { db } from "@/src/db";
import {
  whatsappConversations,
  whatsappCustomerLinks,
  whatsappOrderDrafts,
} from "@/src/db/schema";
import {
  normalizeInternationalPhoneNumber,
  normalizePhoneNumber,
} from "@/src/modules/phone";

export type WhatsappCustomerLinkSource =
  | "account_settings"
  | "checkout"
  | "order_history"
  | "registration"
  | "sso_completion"
  | "whatsapp_draft"
  | "whatsapp_origin";

type WhatsappLinkDatabase = Pick<typeof db, "insert" | "select" | "update">;

export class WhatsappNumberLinkedToAnotherUserError extends Error {
  phone: string;

  constructor(phone: string) {
    super("This WhatsApp number is already linked to another account.");
    this.name = "WhatsappNumberLinkedToAnotherUserError";
    this.phone = phone;
  }
}

function hashDraftToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function normalizeWhatsappAccountPhone(value: string) {
  const cleaned = value.replace(/^whatsapp:/i, "");
  const trimmed = cleaned.trim();
  const digits = trimmed.replace(/\D/g, "");

  if (trimmed.startsWith("+") || trimmed.startsWith("00")) {
    return normalizeInternationalPhoneNumber(trimmed);
  }

  const providerStyleInternational =
    digits.length >= 10 && !digits.startsWith("0")
      ? normalizeInternationalPhoneNumber(digits)
      : null;

  return (
    providerStyleInternational ??
    normalizePhoneNumber(cleaned, {
      defaultCountryCode: "ZA",
    })
  );
}

export async function rememberWhatsappCustomerLink({
  database = db,
  phone,
  source = "whatsapp_origin",
  userId = null,
  verified = false,
}: {
  database?: WhatsappLinkDatabase;
  phone: string;
  source?: WhatsappCustomerLinkSource;
  userId?: string | null;
  verified?: boolean;
}) {
  const normalizedPhone = normalizeWhatsappAccountPhone(phone);

  if (!normalizedPhone) {
    throw new Error("Enter a valid WhatsApp number.");
  }

  if (userId) {
    return linkWhatsappNumberToUser({
      database,
      phone: normalizedPhone,
      source,
      userId,
      verified,
    });
  }

  const now = new Date();
  const [link] = await database
    .insert(whatsappCustomerLinks)
    .values({
      lastSeenAt: now,
      linkSource: source,
      phone: normalizedPhone,
      updatedAt: now,
      verificationStatus: "unverified",
    })
    .onConflictDoUpdate({
      target: whatsappCustomerLinks.phone,
      set: {
        lastSeenAt: now,
        updatedAt: now,
      },
    })
    .returning({
      id: whatsappCustomerLinks.id,
      phone: whatsappCustomerLinks.phone,
      userId: whatsappCustomerLinks.userId,
    });

  return link;
}

export async function linkWhatsappNumberToUser({
  database = db,
  phone,
  source,
  userId,
  verified = false,
}: {
  database?: WhatsappLinkDatabase;
  phone: string;
  source: WhatsappCustomerLinkSource;
  userId: string;
  verified?: boolean;
}) {
  const normalizedPhone = normalizeWhatsappAccountPhone(phone);

  if (!normalizedPhone) {
    throw new Error("Enter a valid WhatsApp number.");
  }

  const now = new Date();
  const [existing] = await database
    .select({
      id: whatsappCustomerLinks.id,
      userId: whatsappCustomerLinks.userId,
      verificationStatus: whatsappCustomerLinks.verificationStatus,
      verifiedAt: whatsappCustomerLinks.verifiedAt,
    })
    .from(whatsappCustomerLinks)
    .where(eq(whatsappCustomerLinks.phone, normalizedPhone))
    .limit(1);

  if (existing?.userId && existing.userId !== userId) {
    throw new WhatsappNumberLinkedToAnotherUserError(normalizedPhone);
  }

  const verificationStatus =
    verified || existing?.verificationStatus === "verified"
      ? "verified"
      : "unverified";
  const verifiedAt = verified ? now : (existing?.verifiedAt ?? null);
  const updateValues = {
    lastSeenAt: now,
    linkSource: source,
    updatedAt: now,
    userId,
    verificationStatus,
    verifiedAt,
    ...(!existing?.userId ? { linkedAt: now } : {}),
  };

  const [link] = existing
    ? await database
        .update(whatsappCustomerLinks)
        .set(updateValues)
        .where(eq(whatsappCustomerLinks.id, existing.id))
        .returning({
          id: whatsappCustomerLinks.id,
          phone: whatsappCustomerLinks.phone,
          userId: whatsappCustomerLinks.userId,
        })
    : await database
        .insert(whatsappCustomerLinks)
        .values({
          lastSeenAt: now,
          linkedAt: now,
          linkSource: source,
          phone: normalizedPhone,
          updatedAt: now,
          userId,
          verificationStatus,
          verifiedAt,
        })
        .returning({
          id: whatsappCustomerLinks.id,
          phone: whatsappCustomerLinks.phone,
          userId: whatsappCustomerLinks.userId,
        });

  await database
    .update(whatsappConversations)
    .set({
      customerLinkId: link.id,
      updatedAt: now,
      userId,
    })
    .where(eq(whatsappConversations.phone, normalizedPhone));

  await database
    .update(whatsappOrderDrafts)
    .set({
      updatedAt: now,
      userId,
    })
    .where(eq(whatsappOrderDrafts.phone, normalizedPhone));

  return link;
}

export async function claimWhatsappDraftForUser({
  database = db,
  source = "whatsapp_draft",
  token,
  userId,
}: {
  database?: WhatsappLinkDatabase;
  source?: WhatsappCustomerLinkSource;
  token: string;
  userId: string;
}) {
  const now = new Date();
  const tokenHash = hashDraftToken(token);
  const [draft] = await database
    .select({
      phone: whatsappOrderDrafts.phone,
      status: whatsappOrderDrafts.status,
    })
    .from(whatsappOrderDrafts)
    .where(
      and(
        eq(whatsappOrderDrafts.tokenHash, tokenHash),
        gt(whatsappOrderDrafts.expiresAt, now),
      ),
    )
    .limit(1);

  if (!draft || draft.status === "cancelled") {
    return { ok: false as const, reason: "draft_not_found" as const };
  }

  const link = await linkWhatsappNumberToUser({
    database,
    phone: draft.phone,
    source,
    userId,
    verified: true,
  });

  await database
    .update(whatsappOrderDrafts)
    .set({ updatedAt: now, userId })
    .where(eq(whatsappOrderDrafts.tokenHash, tokenHash));

  return { link, ok: true as const };
}

export async function getWhatsappDraftCustomerPhoneByToken(token: string) {
  const [draft] = await db
    .select({
      phone: whatsappOrderDrafts.phone,
      status: whatsappOrderDrafts.status,
    })
    .from(whatsappOrderDrafts)
    .where(
      and(
        eq(whatsappOrderDrafts.tokenHash, hashDraftToken(token)),
        gt(whatsappOrderDrafts.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!draft || draft.status === "cancelled") {
    return null;
  }

  return draft.phone;
}

export async function getPrimaryWhatsappCustomerLinkForUser(userId: string) {
  const [link] = await db
    .select({
      linkSource: whatsappCustomerLinks.linkSource,
      phone: whatsappCustomerLinks.phone,
      verificationStatus: whatsappCustomerLinks.verificationStatus,
      verifiedAt: whatsappCustomerLinks.verifiedAt,
    })
    .from(whatsappCustomerLinks)
    .where(eq(whatsappCustomerLinks.userId, userId))
    .orderBy(
      desc(whatsappCustomerLinks.verifiedAt),
      desc(whatsappCustomerLinks.updatedAt),
    )
    .limit(1);

  return link ?? null;
}

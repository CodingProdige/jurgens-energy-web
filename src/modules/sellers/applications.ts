import { and, eq, or } from "drizzle-orm";

import { db } from "@/src/db";
import {
  sellerApplications,
  sellerStaff,
  sellers,
  userRoles,
  users,
  type PlatformRole,
} from "@/src/db/schema";
import { hashPassword } from "@/src/modules/auth/service";
import { addEmailSubscriber } from "@/src/modules/marketing/email-subscribers";

type SellerApplicationInput = {
  addressLine1: string;
  addressLine2?: string;
  businessType: string;
  city: string;
  countryRegion: string;
  email: string;
  fullName?: string;
  password?: string;
  phone: string;
  postalCode: string;
  stateProvince: string;
  storeName: string;
};

export function createSellerStoreSlug(storeName: string) {
  const slug = storeName
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 160);

  return slug || "seller";
}

export async function findSellerApplicationByUserId(userId: string) {
  const [application] = await db
    .select()
    .from(sellerApplications)
    .where(eq(sellerApplications.userId, userId))
    .limit(1);

  return application;
}

export async function isSellerStoreSlugAvailable(storeSlug: string) {
  const [application] = await db
    .select({ id: sellerApplications.id })
    .from(sellerApplications)
    .where(eq(sellerApplications.storeSlug, storeSlug))
    .limit(1);

  if (application) {
    return false;
  }

  const [seller] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(eq(sellers.slug, storeSlug))
    .limit(1);

  return !seller;
}

export async function getSellerStoreNameAvailability(storeName: string) {
  const trimmedStoreName = storeName.trim();
  const storeSlug = createSellerStoreSlug(trimmedStoreName);
  const available = await isSellerStoreSlugAvailable(storeSlug);

  if (available) {
    return {
      available,
      storeSlug,
      suggestions: [] as string[],
    };
  }

  const suggestionCandidates = [
    `${trimmedStoreName} Store`,
    `Shop ${trimmedStoreName}`,
    `${trimmedStoreName} Market`,
    `${trimmedStoreName} Online`,
    `${trimmedStoreName} Co`,
    `${trimmedStoreName} Global`,
  ];
  const suggestions: string[] = [];

  for (const suggestion of suggestionCandidates) {
    const candidateSlug = createSellerStoreSlug(suggestion);

    if (
      candidateSlug !== storeSlug &&
      (await isSellerStoreSlugAvailable(candidateSlug))
    ) {
      suggestions.push(suggestion);
    }

    if (suggestions.length === 3) {
      break;
    }
  }

  return {
    available,
    storeSlug,
    suggestions,
  };
}

export async function getSellerAccessState(userId: string) {
  const [roleRow] = await db
    .select({ role: userRoles.role })
    .from(userRoles)
    .where(
      and(
        eq(userRoles.userId, userId),
        or(
          eq(userRoles.role, "seller_owner" satisfies PlatformRole),
          eq(userRoles.role, "seller_staff" satisfies PlatformRole),
          eq(userRoles.role, "admin" satisfies PlatformRole),
          eq(userRoles.role, "superadmin" satisfies PlatformRole),
        ),
      ),
    )
    .limit(1);

  const [ownerRow] = await db
    .select({ id: sellers.id })
    .from(sellers)
    .where(eq(sellers.ownerUserId, userId))
    .limit(1);

  const [staffRow] = await db
    .select({ id: sellerStaff.id })
    .from(sellerStaff)
    .where(eq(sellerStaff.userId, userId))
    .limit(1);

  return {
    hasSellerAccess: Boolean(roleRow || ownerRow || staffRow),
  };
}

export async function createSellerApplicationForNewUser(
  input: SellerApplicationInput & {
    fullName: string;
    password: string;
  },
) {
  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const storeSlug = createSellerStoreSlug(input.storeName);

  return db.transaction(async (tx) => {
    const [createdUser] = await tx
      .insert(users)
      .values({
        email: input.email,
        name: input.fullName,
        passwordHash,
      })
      .returning({ id: users.id });

    await tx.insert(sellerApplications).values({
      userId: createdUser.id,
      email: input.email,
      fullName: input.fullName,
      storeName: input.storeName,
      storeSlug,
      businessType: input.businessType,
      countryRegion: input.countryRegion,
      phone: input.phone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 || null,
      city: input.city,
      stateProvince: input.stateProvince,
      postalCode: input.postalCode,
      updatedAt: now,
    });

    await addEmailSubscriber({
      database: tx,
      email: input.email,
      source: "seller_signup",
    });

    return createdUser;
  });
}

export async function createSellerApplicationForExistingUser(
  userId: string,
  input: SellerApplicationInput,
) {
  const now = new Date();
  const storeSlug = createSellerStoreSlug(input.storeName);

  await db.transaction(async (tx) => {
    await tx.insert(sellerApplications).values({
      userId,
      email: input.email,
      fullName: input.fullName || null,
      storeName: input.storeName,
      storeSlug,
      businessType: input.businessType,
      countryRegion: input.countryRegion,
      phone: input.phone,
      addressLine1: input.addressLine1,
      addressLine2: input.addressLine2 || null,
      city: input.city,
      stateProvince: input.stateProvince,
      postalCode: input.postalCode,
      updatedAt: now,
    });

    await addEmailSubscriber({
      database: tx,
      email: input.email,
      source: "seller_signup",
    });
  });

  return { id: userId };
}

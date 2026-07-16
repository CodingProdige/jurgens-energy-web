import "server-only";

import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { customerAddresses, users } from "@/src/db/schema";
import { normalizePhoneNumber } from "@/src/modules/phone";

export const MAX_CUSTOMER_ADDRESSES = 20;

const userIdSchema = z.string().uuid();
const addressIdSchema = z.string().uuid();

export const customerAddressInputSchema = z.object({
  label: z.string().trim().min(1).max(80),
  recipientName: z.string().trim().min(2).max(160),
  recipientPhone: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .transform((value, context) => {
      const normalized = normalizePhoneNumber(value, {
        defaultCountryCode: "ZA",
      });

      if (!normalized) {
        context.addIssue({
          code: "custom",
          message: "Enter a valid phone number.",
        });

        return z.NEVER;
      }

      return normalized;
    }),
  addressLine1: z.string().trim().min(2).max(240),
  addressLine2: z.string().trim().max(240).optional().default(""),
  suburb: z.string().trim().max(120).optional().default(""),
  city: z.string().trim().min(2).max(120),
  province: z.string().trim().min(2).max(120),
  postalCode: z.string().trim().min(2).max(40),
  countryCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z]{2}$/, "Enter a valid two-letter country code.")
    .default("ZA")
    .transform((value) => value.toUpperCase()),
  isDefault: z.boolean().default(false),
});

export type CustomerAddressInput = z.input<typeof customerAddressInputSchema>;
type ParsedCustomerAddressInput = z.output<typeof customerAddressInputSchema>;

export type CustomerAddress = {
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  countryCode: string;
  createdAt: Date;
  id: string;
  isDefault: boolean;
  label: string;
  lastUsedAt: Date | null;
  postalCode: string;
  province: string;
  recipientName: string;
  recipientPhone: string;
  suburb: string;
  updatedAt: Date;
  userId: string;
};

export type CustomerAddressBook = {
  addresses: CustomerAddress[];
  defaultAddress: CustomerAddress | null;
  defaultAddressId: string | null;
};

export type CustomerAddressDatabase = Pick<
  typeof db,
  "delete" | "insert" | "select" | "update"
>;

export class CustomerAddressNotFoundError extends Error {
  constructor() {
    super("The saved address was not found.");
    this.name = "CustomerAddressNotFoundError";
  }
}

export class CustomerAddressLimitError extends Error {
  constructor() {
    super(`You can save up to ${MAX_CUSTOMER_ADDRESSES} addresses.`);
    this.name = "CustomerAddressLimitError";
  }
}

export class CustomerAddressUserNotFoundError extends Error {
  constructor() {
    super("The customer account was not found.");
    this.name = "CustomerAddressUserNotFoundError";
  }
}

const addressSelection = {
  addressLine1: customerAddresses.addressLine1,
  addressLine2: customerAddresses.addressLine2,
  city: customerAddresses.city,
  countryCode: customerAddresses.countryCode,
  createdAt: customerAddresses.createdAt,
  id: customerAddresses.id,
  isDefault: customerAddresses.isDefault,
  label: customerAddresses.label,
  lastUsedAt: customerAddresses.lastUsedAt,
  postalCode: customerAddresses.postalCode,
  province: customerAddresses.province,
  recipientName: customerAddresses.recipientName,
  recipientPhone: customerAddresses.recipientPhone,
  suburb: sql<string>`coalesce(${customerAddresses.suburb}, '')`,
  updatedAt: customerAddresses.updatedAt,
  userId: customerAddresses.userId,
};

function parseUserId(userId: string) {
  return userIdSchema.parse(userId);
}

function parseAddressId(addressId: string) {
  return addressIdSchema.parse(addressId);
}

function inputValues(input: ParsedCustomerAddressInput) {
  return {
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 || null,
    city: input.city,
    countryCode: input.countryCode,
    isDefault: input.isDefault,
    label: input.label,
    postalCode: input.postalCode,
    province: input.province,
    recipientName: input.recipientName,
    recipientPhone: input.recipientPhone,
    suburb: input.suburb,
  };
}

async function lockCustomerUser(
  database: CustomerAddressDatabase,
  userId: string,
) {
  const [user] = await database
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
    .for("update");

  if (!user) {
    throw new CustomerAddressUserNotFoundError();
  }
}

async function runMutation<T>(
  database: CustomerAddressDatabase | undefined,
  operation: (transaction: CustomerAddressDatabase) => Promise<T>,
) {
  if (database) {
    return operation(database);
  }

  return db.transaction(operation);
}

export async function listCustomerAddresses(
  userId: string,
  database: CustomerAddressDatabase = db,
): Promise<CustomerAddress[]> {
  const parsedUserId = parseUserId(userId);

  return database
    .select(addressSelection)
    .from(customerAddresses)
    .where(eq(customerAddresses.userId, parsedUserId))
    .orderBy(
      desc(customerAddresses.isDefault),
      sql`${customerAddresses.lastUsedAt} DESC NULLS LAST`,
      desc(customerAddresses.updatedAt),
      desc(customerAddresses.createdAt),
    );
}

export async function getCheckoutAddressBook(
  userId: string,
  database: CustomerAddressDatabase = db,
): Promise<CustomerAddressBook> {
  const addresses = await listCustomerAddresses(userId, database);
  const defaultAddress =
    addresses.find((address) => address.isDefault) ?? addresses[0] ?? null;

  return {
    addresses,
    defaultAddress,
    defaultAddressId: defaultAddress?.id ?? null,
  };
}

export async function createCustomerAddress(
  userId: string,
  input: CustomerAddressInput,
  database?: CustomerAddressDatabase,
): Promise<CustomerAddress> {
  const parsedUserId = parseUserId(userId);
  const parsedInput = customerAddressInputSchema.parse(input);

  return runMutation(database, async (transaction) => {
    await lockCustomerUser(transaction, parsedUserId);

    const countRow = await transaction
      .select({ count: sql<number>`count(*)::int` })
      .from(customerAddresses)
      .where(eq(customerAddresses.userId, parsedUserId));
    const currentDefault = await transaction
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.userId, parsedUserId),
          eq(customerAddresses.isDefault, true),
        ),
      )
      .limit(1);
    const count = Number(countRow[0]?.count ?? 0);

    if (count >= MAX_CUSTOMER_ADDRESSES) {
      throw new CustomerAddressLimitError();
    }

    const shouldBeDefault =
      parsedInput.isDefault || count === 0 || !currentDefault[0];

    if (shouldBeDefault) {
      await transaction
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.userId, parsedUserId));
    }

    const [address] = await transaction
      .insert(customerAddresses)
      .values({
        ...inputValues(parsedInput),
        isDefault: shouldBeDefault,
        userId: parsedUserId,
      })
      .returning(addressSelection);

    return address;
  });
}

export async function updateCustomerAddress(
  userId: string,
  addressId: string,
  input: CustomerAddressInput,
  database?: CustomerAddressDatabase,
): Promise<CustomerAddress> {
  const parsedUserId = parseUserId(userId);
  const parsedAddressId = parseAddressId(addressId);
  const parsedInput = customerAddressInputSchema.parse(input);

  return runMutation(database, async (transaction) => {
    await lockCustomerUser(transaction, parsedUserId);

    const existing = await transaction
      .select({
        id: customerAddresses.id,
        isDefault: customerAddresses.isDefault,
      })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.id, parsedAddressId),
          eq(customerAddresses.userId, parsedUserId),
        ),
      )
      .limit(1);
    const currentDefault = await transaction
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.userId, parsedUserId),
          eq(customerAddresses.isDefault, true),
        ),
      )
      .limit(1);

    if (!existing[0]) {
      throw new CustomerAddressNotFoundError();
    }

    const shouldBeDefault =
      parsedInput.isDefault || existing[0].isDefault || !currentDefault[0];

    if (shouldBeDefault) {
      await transaction
        .update(customerAddresses)
        .set({ isDefault: false })
        .where(eq(customerAddresses.userId, parsedUserId));
    }

    const [address] = await transaction
      .update(customerAddresses)
      .set({
        ...inputValues(parsedInput),
        isDefault: shouldBeDefault,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(customerAddresses.id, parsedAddressId),
          eq(customerAddresses.userId, parsedUserId),
        ),
      )
      .returning(addressSelection);

    return address;
  });
}

export async function deleteCustomerAddress(
  userId: string,
  addressId: string,
  database?: CustomerAddressDatabase,
): Promise<boolean> {
  const parsedUserId = parseUserId(userId);
  const parsedAddressId = parseAddressId(addressId);

  return runMutation(database, async (transaction) => {
    await lockCustomerUser(transaction, parsedUserId);

    const [existing] = await transaction
      .select({
        id: customerAddresses.id,
        isDefault: customerAddresses.isDefault,
      })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.id, parsedAddressId),
          eq(customerAddresses.userId, parsedUserId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new CustomerAddressNotFoundError();
    }

    await transaction
      .delete(customerAddresses)
      .where(
        and(
          eq(customerAddresses.id, parsedAddressId),
          eq(customerAddresses.userId, parsedUserId),
        ),
      );

    if (existing.isDefault) {
      const [replacement] = await transaction
        .select({ id: customerAddresses.id })
        .from(customerAddresses)
        .where(eq(customerAddresses.userId, parsedUserId))
        .orderBy(
          sql`${customerAddresses.lastUsedAt} DESC NULLS LAST`,
          desc(customerAddresses.updatedAt),
          desc(customerAddresses.createdAt),
        )
        .limit(1);

      if (replacement) {
        await transaction
          .update(customerAddresses)
          .set({ isDefault: true, updatedAt: new Date() })
          .where(
            and(
              eq(customerAddresses.id, replacement.id),
              eq(customerAddresses.userId, parsedUserId),
            ),
          );
      }
    }

    return true;
  });
}

export async function setDefaultCustomerAddress(
  userId: string,
  addressId: string,
  database?: CustomerAddressDatabase,
): Promise<CustomerAddress> {
  const parsedUserId = parseUserId(userId);
  const parsedAddressId = parseAddressId(addressId);

  return runMutation(database, async (transaction) => {
    await lockCustomerUser(transaction, parsedUserId);

    const [existing] = await transaction
      .select({ id: customerAddresses.id })
      .from(customerAddresses)
      .where(
        and(
          eq(customerAddresses.id, parsedAddressId),
          eq(customerAddresses.userId, parsedUserId),
        ),
      )
      .limit(1);

    if (!existing) {
      throw new CustomerAddressNotFoundError();
    }

    const now = new Date();

    await transaction
      .update(customerAddresses)
      .set({ isDefault: false })
      .where(eq(customerAddresses.userId, parsedUserId));

    const [address] = await transaction
      .update(customerAddresses)
      .set({ isDefault: true, updatedAt: now })
      .where(
        and(
          eq(customerAddresses.id, parsedAddressId),
          eq(customerAddresses.userId, parsedUserId),
        ),
      )
      .returning(addressSelection);

    return address;
  });
}

export async function markCustomerAddressUsed(
  userId: string,
  addressId: string,
  database: CustomerAddressDatabase = db,
): Promise<CustomerAddress> {
  const parsedUserId = parseUserId(userId);
  const parsedAddressId = parseAddressId(addressId);
  const [address] = await database
    .update(customerAddresses)
    .set({ lastUsedAt: new Date() })
    .where(
      and(
        eq(customerAddresses.id, parsedAddressId),
        eq(customerAddresses.userId, parsedUserId),
      ),
    )
    .returning(addressSelection);

  if (!address) {
    throw new CustomerAddressNotFoundError();
  }

  return address;
}

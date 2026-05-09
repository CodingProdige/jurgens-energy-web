import { db } from "@/src/db";
import {
  emailSubscribers,
  type EmailSubscriberSource,
} from "@/src/db/schema";

type SubscriberDb = Pick<typeof db, "insert">;

export function sanitizeSubscriberEmail(email: string) {
  return email.trim().toLowerCase();
}

export async function addEmailSubscriber({
  database = db,
  email,
  source,
}: {
  database?: SubscriberDb;
  email: string;
  source: EmailSubscriberSource;
}) {
  const normalizedEmail = sanitizeSubscriberEmail(email);
  const now = new Date();

  await database
    .insert(emailSubscribers)
    .values({
      email: normalizedEmail,
      source,
      updatedAt: now,
    })
    .onConflictDoUpdate({
      target: emailSubscribers.email,
      set: {
        source,
        updatedAt: now,
      },
    });
}

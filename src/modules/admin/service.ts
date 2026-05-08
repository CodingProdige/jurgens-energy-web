import { count } from "drizzle-orm";

import { db } from "@/src/db";
import { auditLogs, products, sellers, users } from "@/src/db/schema";

export async function getAdminOverview() {
  const [[userCount], [sellerCount], [productCount], [auditLogCount]] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(sellers),
      db.select({ value: count() }).from(products),
      db.select({ value: count() }).from(auditLogs),
    ]);

  return {
    users: userCount.value,
    sellers: sellerCount.value,
    products: productCount.value,
    auditLogs: auditLogCount.value,
  };
}

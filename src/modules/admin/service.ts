import { count } from "drizzle-orm";

import { db } from "@/src/db";
import { auditLogs, categories, products, users } from "@/src/db/schema";

export async function getAdminOverview() {
  const [[userCount], [categoryCount], [productCount], [auditLogCount]] =
    await Promise.all([
      db.select({ value: count() }).from(users),
      db.select({ value: count() }).from(categories),
      db.select({ value: count() }).from(products),
      db.select({ value: count() }).from(auditLogs),
    ]);

  return {
    users: userCount.value,
    categories: categoryCount.value,
    products: productCount.value,
    auditLogs: auditLogCount.value,
  };
}

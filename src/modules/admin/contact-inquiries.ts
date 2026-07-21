import { count, desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import {
  contactInquiries,
  type ContactInquiryStatus,
} from "@/src/db/schema";

export type AdminContactInquiryRow = {
  createdAt: Date;
  email: string;
  id: string;
  message: string;
  name: string;
  status: ContactInquiryStatus;
  updatedAt: Date;
};

export type AdminContactInquiryList = {
  inquiries: AdminContactInquiryRow[];
  metrics: {
    new: number;
    resolved: number;
    total: number;
  };
};

export async function getAdminContactInquiries(): Promise<AdminContactInquiryList> {
  const [inquiries, statusCounts] = await Promise.all([
    db
      .select({
        createdAt: contactInquiries.createdAt,
        email: contactInquiries.email,
        id: contactInquiries.id,
        message: contactInquiries.message,
        name: contactInquiries.name,
        status: contactInquiries.status,
        updatedAt: contactInquiries.updatedAt,
      })
      .from(contactInquiries)
      .orderBy(desc(contactInquiries.createdAt))
      .limit(100),
    db
      .select({
        status: contactInquiries.status,
        value: count(),
      })
      .from(contactInquiries)
      .groupBy(contactInquiries.status),
  ]);

  const countByStatus = new Map(
    statusCounts.map((row) => [row.status, row.value]),
  );
  const newCount = countByStatus.get("new") ?? 0;
  const resolvedCount = countByStatus.get("resolved") ?? 0;

  return {
    inquiries,
    metrics: {
      new: newCount,
      resolved: resolvedCount,
      total: statusCounts.reduce((total, row) => total + row.value, 0),
    },
  };
}

export async function getAdminContactInquiry(
  inquiryId: string,
): Promise<AdminContactInquiryRow | null> {
  const [inquiry] = await db
    .select({
      createdAt: contactInquiries.createdAt,
      email: contactInquiries.email,
      id: contactInquiries.id,
      message: contactInquiries.message,
      name: contactInquiries.name,
      status: contactInquiries.status,
      updatedAt: contactInquiries.updatedAt,
    })
    .from(contactInquiries)
    .where(eq(contactInquiries.id, inquiryId))
    .limit(1);

  return inquiry ?? null;
}

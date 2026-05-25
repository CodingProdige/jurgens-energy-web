import { desc, eq } from "drizzle-orm";

import { db } from "@/src/db";
import { sellerApplications, users } from "@/src/db/schema";

export type AdminSellerApplicationStatus = "pending" | "approved" | "rejected";

export type AdminSellerApplication = {
  addressLine1: string;
  addressLine2: string | null;
  businessType: string;
  city: string;
  countryRegion: string;
  createdAt: Date;
  email: string;
  fullName: string | null;
  id: string;
  phone: string;
  postalCode: string;
  rejectionReason: string | null;
  reviewedAt: Date | null;
  stateProvince: string;
  status: AdminSellerApplicationStatus;
  storeName: string;
  storeSlug: string;
  updatedAt: Date;
  userEmail: string | null;
  userId: string;
  userImage: string | null;
  userName: string | null;
};

export type AdminSellerApplicationsData = {
  approvedCount: number;
  pendingCount: number;
  rejectedCount: number;
  totalCount: number;
  applications: AdminSellerApplication[];
};

export async function getAdminSellerApplications(): Promise<AdminSellerApplicationsData> {
  const rows = await db
    .select({
      addressLine1: sellerApplications.addressLine1,
      addressLine2: sellerApplications.addressLine2,
      businessType: sellerApplications.businessType,
      city: sellerApplications.city,
      countryRegion: sellerApplications.countryRegion,
      createdAt: sellerApplications.createdAt,
      email: sellerApplications.email,
      fullName: sellerApplications.fullName,
      id: sellerApplications.id,
      phone: sellerApplications.phone,
      postalCode: sellerApplications.postalCode,
      rejectionReason: sellerApplications.rejectionReason,
      reviewedAt: sellerApplications.reviewedAt,
      stateProvince: sellerApplications.stateProvince,
      status: sellerApplications.status,
      storeName: sellerApplications.storeName,
      storeSlug: sellerApplications.storeSlug,
      updatedAt: sellerApplications.updatedAt,
      userEmail: users.email,
      userId: sellerApplications.userId,
      userImage: users.image,
      userName: users.name,
    })
    .from(sellerApplications)
    .leftJoin(users, eq(sellerApplications.userId, users.id))
    .orderBy(desc(sellerApplications.createdAt));

  return {
    approvedCount: rows.filter((application) => application.status === "approved").length,
    applications: rows,
    pendingCount: rows.filter((application) => application.status === "pending").length,
    rejectedCount: rows.filter((application) => application.status === "rejected").length,
    totalCount: rows.length,
  };
}

import type { AdminStaffRole } from "@/src/db/schema";

export const adminCapabilities = [
  "admin.dashboard.view",
  "admin.staff.view",
  "admin.staff.manage",
  "admin.users.view",
  "admin.users.manage",
  "admin.catalog.view",
  "admin.catalog.manage",
  "admin.orders.view",
  "admin.orders.manage",
  "admin.sellers.view",
  "admin.sellers.manage",
  "admin.marketing.view",
  "admin.marketing.manage",
  "admin.reviews.view",
  "admin.reviews.manage",
  "admin.payouts.view",
  "admin.payouts.manage",
  "admin.analytics.view",
  "admin.settings.view",
  "admin.settings.manage",
] as const;

export type AdminCapability = (typeof adminCapabilities)[number];

export const adminStaffRoleLabels: Record<AdminStaffRole, string> = {
  analyst: "Analyst",
  catalog: "Catalog manager",
  finance: "Finance",
  manager: "Admin",
  marketing: "Marketing",
  operations: "Operations",
  owner: "Superadmin",
  readonly: "Read-only",
  support: "Support",
};

export const adminStaffRoleReadme: Record<
  AdminStaffRole,
  {
    description: string;
    permissions: string[];
  }
> = {
  analyst: {
    description: "Read operational dashboard and analytics data.",
    permissions: ["Dashboard", "Analytics"],
  },
  catalog: {
    description: "Manage catalog structure while keeping finance and settings locked.",
    permissions: ["Dashboard", "Catalog", "Seller visibility", "Analytics"],
  },
  finance: {
    description: "Review order and payout information for finance workflows.",
    permissions: ["Dashboard", "Orders", "Payouts", "Analytics"],
  },
  manager: {
    description: "Manage staff and user access without full superadmin access.",
    permissions: ["Dashboard", "Admin staff", "Users", "Analytics"],
  },
  marketing: {
    description: "Manage marketing surfaces and review performance.",
    permissions: ["Dashboard", "Marketing", "Analytics"],
  },
  operations: {
    description: "Handle daily marketplace operations across users, orders, sellers, and reviews.",
    permissions: ["Dashboard", "Users", "Orders", "Sellers", "Reviews", "Analytics"],
  },
  owner: {
    description: "Full admin dashboard access. Reserved for trusted platform superadmins.",
    permissions: ["All admin surfaces", "All management actions"],
  },
  readonly: {
    description: "View most admin surfaces without mutation access.",
    permissions: [
      "Dashboard",
      "Users",
      "Catalog",
      "Orders",
      "Sellers",
      "Marketing",
      "Reviews",
      "Payouts",
      "Analytics",
      "Settings",
    ],
  },
  support: {
    description: "Assist customers and sellers without write access to sensitive settings.",
    permissions: ["Dashboard", "Users", "Orders", "Sellers", "Reviews"],
  },
};

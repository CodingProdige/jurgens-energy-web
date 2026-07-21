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
  "admin.contact_inquiries.view",
  "admin.contact_inquiries.manage",
  "admin.marketing.view",
  "admin.marketing.manage",
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
  marketing: "Site Builder",
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
    permissions: ["Dashboard", "Catalog", "Analytics"],
  },
  finance: {
    description: "Review order information for finance workflows.",
    permissions: ["Dashboard", "Orders", "Analytics"],
  },
  manager: {
    description: "Manage staff and user access without full superadmin access.",
    permissions: ["Dashboard", "Admin staff", "Users", "Analytics"],
  },
  marketing: {
    description: "Manage site builder surfaces and review performance.",
    permissions: ["Dashboard", "Site Builder", "Analytics"],
  },
  operations: {
    description: "Handle daily marketplace operations across users, orders, and catalog workflows.",
    permissions: [
      "Dashboard",
      "Users",
      "Orders",
      "Contact inquiries",
      "Catalog",
      "Analytics",
    ],
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
      "Site Builder",
      "Analytics",
      "Settings",
    ],
  },
  support: {
    description: "Assist customers without write access to sensitive settings.",
    permissions: ["Dashboard", "Users", "Orders", "Contact inquiries"],
  },
};

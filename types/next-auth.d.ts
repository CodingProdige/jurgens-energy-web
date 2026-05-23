import type { DefaultSession } from "next-auth";
import type { AdminStaffRole, PlatformRole } from "@/src/db/schema";
import type { AdminCapability } from "@/src/modules/admin/staff-constants";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      adminCapabilities: AdminCapability[];
      adminStaffRole: AdminStaffRole | null;
      roles: PlatformRole[];
    } & DefaultSession["user"];
  }

  interface User {
    adminCapabilities?: AdminCapability[];
    adminStaffRole?: AdminStaffRole | null;
    roles: PlatformRole[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    adminCapabilities?: AdminCapability[];
    adminStaffRole?: AdminStaffRole | null;
    roles?: PlatformRole[];
  }
}

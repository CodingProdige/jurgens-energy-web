import type { DefaultSession } from "next-auth";
import type { PlatformRole } from "@/src/db/schema";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      roles: PlatformRole[];
    } & DefaultSession["user"];
  }

  interface User {
    roles: PlatformRole[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    roles?: PlatformRole[];
  }
}

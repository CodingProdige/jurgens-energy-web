import NextAuth from "next-auth";
import type { Provider } from "next-auth/providers";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { db } from "@/src/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/src/db/schema";
import { getSharedAuthCookieDomain } from "@/src/modules/auth/constants";
import { signInSchema } from "@/src/modules/auth/validation";
import {
  findUserByEmail,
  getUserRoles,
  isPlatformRole,
  verifyPassword,
} from "@/src/modules/auth/service";
import {
  getAdminStaffAccess,
  isAdminStaffRole,
} from "@/src/modules/admin/staff";

const providers: Provider[] = [
  Credentials({
    credentials: {
      email: { label: "Email", type: "email" },
      password: { label: "Password", type: "password" },
    },
    async authorize(credentials) {
      const parsed = signInSchema.safeParse(credentials);

      if (!parsed.success) {
        return null;
      }

      const user = await findUserByEmail(parsed.data.email);

      if (!user?.passwordHash || !user.isActive) {
        return null;
      }

      const passwordMatches = await verifyPassword(
        parsed.data.password,
        user.passwordHash,
      );

      if (!passwordMatches) {
        return null;
      }

      const roles = await getUserRoles(user.id);
      const adminStaffAccess = await getAdminStaffAccess(user.id);

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
        adminCapabilities: adminStaffAccess.capabilities,
        adminStaffRole: adminStaffAccess.role,
        roles,
      };
    },
  }),
];

if (process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET) {
  providers.push(
    Google({
      allowDangerousEmailAccountLinking: true,
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  );
}

const sharedAuthCookieDomain = getSharedAuthCookieDomain();
const sharedAuthCookieOptions = sharedAuthCookieDomain
  ? {
      httpOnly: true,
      sameSite: "lax" as const,
      path: "/",
      secure: process.env.NODE_ENV === "production",
      domain: sharedAuthCookieDomain,
    }
  : undefined;

const localSurfaceHostnames = new Set([
  "admin.localhost",
  "admin.127.0.0.1",
  "seller.localhost",
  "seller.127.0.0.1",
]);

function getConfiguredSurfaceHostnames() {
  return [
    process.env.ADMIN_HOSTNAME,
    process.env.SELLER_HOSTNAME,
    process.env.DOMAIN ? `admin.${process.env.DOMAIN}` : undefined,
    process.env.DOMAIN ? `seller.${process.env.DOMAIN}` : undefined,
  ]
    .filter(Boolean)
    .map((host) =>
      host!
        .replace(/^https?:\/\//, "")
        .split("/")[0]
        ?.split(":")[0]
        ?.toLowerCase(),
    )
    .filter(Boolean);
}

function isAllowedAuthRedirect(url: string, baseUrl: string) {
  try {
    const targetUrl = new URL(url, baseUrl);
    const base = new URL(baseUrl);

    return (
      targetUrl.origin === base.origin ||
      localSurfaceHostnames.has(targetUrl.hostname.toLowerCase()) ||
      getConfiguredSurfaceHostnames().includes(targetUrl.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  adapter: DrizzleAdapter(db, {
    usersTable: users,
    accountsTable: accounts,
    sessionsTable: sessions,
    verificationTokensTable: verificationTokens,
    authenticatorsTable: authenticators,
  }),
  session: {
    strategy: "jwt",
  },
  pages: {
    signIn: "/sign-in",
  },
  providers,
  cookies: sharedAuthCookieOptions
    ? {
        sessionToken: {
          name: "authjs.session-token",
          options: sharedAuthCookieOptions,
        },
        callbackUrl: {
          name: "authjs.callback-url",
          options: sharedAuthCookieOptions,
        },
        csrfToken: {
          name: "authjs.csrf-token",
          options: sharedAuthCookieOptions,
        },
        pkceCodeVerifier: {
          name: "authjs.pkce.code_verifier",
          options: {
            ...sharedAuthCookieOptions,
            maxAge: 60 * 15,
          },
        },
        state: {
          name: "authjs.state",
          options: {
            ...sharedAuthCookieOptions,
            maxAge: 60 * 15,
          },
        },
        nonce: {
          name: "authjs.nonce",
          options: sharedAuthCookieOptions,
        },
      }
    : undefined,
  callbacks: {
    redirect({ url, baseUrl }) {
      if (isAllowedAuthRedirect(url, baseUrl)) {
        return new URL(url, baseUrl).toString();
      }

      return baseUrl;
    },
    signIn({ account, profile, user }) {
      if (account?.provider === "google") {
        const email = user.email ?? (profile?.email as string | undefined);
        const emailVerified = (profile as { email_verified?: boolean })
          ?.email_verified;

        return Boolean(email) && emailVerified !== false;
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user?.id) {
        token.roles = user.roles ?? (await getUserRoles(user.id));
        const adminStaffAccess =
          user.adminCapabilities && user.adminStaffRole !== undefined
            ? {
                capabilities: user.adminCapabilities,
                role: user.adminStaffRole,
              }
            : await getAdminStaffAccess(user.id);
        token.adminCapabilities = adminStaffAccess.capabilities;
        token.adminStaffRole = adminStaffAccess.role;
        return token;
      }

      if (token.sub) {
        token.roles = await getUserRoles(token.sub);
        const adminStaffAccess = await getAdminStaffAccess(token.sub);
        token.adminCapabilities = adminStaffAccess.capabilities;
        token.adminStaffRole = adminStaffAccess.role;
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = Array.isArray(token.roles)
          ? token.roles.filter(isPlatformRole)
          : [];
        session.user.adminCapabilities = Array.isArray(token.adminCapabilities)
          ? token.adminCapabilities
          : [];
        session.user.adminStaffRole = isAdminStaffRole(token.adminStaffRole)
          ? token.adminStaffRole
          : null;
      }

      return session;
    },
  },
});

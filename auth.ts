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

      return {
        id: user.id,
        name: user.name,
        email: user.email,
        image: user.image,
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
        return token;
      }

      if (token.sub) {
        token.roles = await getUserRoles(token.sub);
      }

      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.roles = Array.isArray(token.roles)
          ? token.roles.filter(isPlatformRole)
          : [];
      }

      return session;
    },
  },
});

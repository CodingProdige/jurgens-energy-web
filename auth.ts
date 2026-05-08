import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { DrizzleAdapter } from "@auth/drizzle-adapter";

import { db } from "@/src/db";
import {
  accounts,
  authenticators,
  sessions,
  users,
  verificationTokens,
} from "@/src/db/schema";
import { signInSchema } from "@/src/modules/auth/validation";
import {
  findUserByEmail,
  getUserRoles,
  isPlatformRole,
  verifyPassword,
} from "@/src/modules/auth/service";

export const { handlers, signIn, signOut, auth } = NextAuth({
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
  providers: [
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
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.roles = user.roles;
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

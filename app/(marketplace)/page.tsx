import Link from "next/link";
import type { Metadata } from "next";

import { auth, signOut } from "@/auth";
import { PiessangLogo } from "@/components/brand/piessang-logo";

export const metadata: Metadata = {
  title: "Marketplace",
  description:
    "Piessang marketplace foundation for a self-hosted multi-vendor commerce platform.",
};

export default async function Home() {
  const session = await auth();
  const links = [
    { href: "/sign-in", label: "Marketplace sign in" },
    { href: "/register", label: "Create marketplace account" },
    { href: "/forgot-password", label: "Marketplace password reset" },
    { href: "http://seller.localhost:3000", label: "Seller dashboard" },
    { href: "http://seller.localhost:3000/sign-in", label: "Seller sign in" },
    { href: "http://admin.localhost:3000", label: "Admin dashboard" },
    { href: "http://admin.localhost:3000/sign-in", label: "Admin sign in" },
  ];

  return (
    <main className="home-shell">
      <section className="home-hero">
        <PiessangLogo priority className="mb-6 h-12 w-64" />
        <p className="eyebrow">Self-hosted modular marketplace</p>
        <h1>Marketplace foundation</h1>
        <p className="muted">
          Next.js App Router, PostgreSQL, Drizzle, Auth.js, Redis, Caddy, and
          local media storage are wired for a controlled self-hosted path.
        </p>
        <div className="home-actions">
          <Link href="/sign-in">Sign in</Link>
          <Link href="/register">Create account</Link>
        </div>

        {session?.user ? (
          <form
            action={async () => {
              "use server";

              await signOut({ redirectTo: "/" });
            }}
            className="mt-6 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/82"
          >
            <p>
              Signed in as{" "}
              <span className="font-semibold text-white">
                {session.user.email ?? session.user.name ?? "current user"}
              </span>
              . Auth pages redirect home while you are signed in.
            </p>
            <button
              type="submit"
              className="mt-3 rounded-md border border-white/15 px-3 py-2 text-xs font-bold text-white transition hover:border-primary/50 hover:bg-primary/10"
            >
              Sign out
            </button>
          </form>
        ) : null}

        <nav
          aria-label="Development routes"
          className="mt-8 grid w-full max-w-2xl gap-3 sm:grid-cols-2"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-semibold text-white/86 transition hover:border-primary/50 hover:bg-primary/10 hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <div className="mt-4 text-xs text-muted-foreground">
          Local dashboard links use `admin.localhost:3000` and
          `seller.localhost:3000`.
        </div>
      </section>
    </main>
  );
}

import {
  BadgeCheckIcon,
  BoxesIcon,
  LayoutDashboardIcon,
  LineChartIcon,
  PackageCheckIcon,
  SettingsIcon,
  StarIcon,
  StoreIcon,
  WalletCardsIcon,
} from "lucide-react";
import type { Metadata } from "next";

import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import { DashboardShell } from "@/components/dashboard/dashboard-shell";
import { DashboardStatCard } from "@/components/dashboard/dashboard-stat-card";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getNotificationCenter } from "@/src/modules/notifications/in-app";

export const metadata: Metadata = {
  title: "Seller Dashboard",
  description:
    "Protected Piessang seller dashboard for products, orders, payouts, reviews, analytics, and seller settings.",
  robots: {
    index: false,
    follow: false,
  },
};

const sellerNavItems = [
  { label: "Overview", href: "/", icon: LayoutDashboardIcon },
  { label: "Products", href: "/products", icon: BoxesIcon },
  { label: "Orders", href: "/orders", icon: PackageCheckIcon },
  { label: "Payouts", href: "/payouts", icon: WalletCardsIcon },
  { label: "Reviews", href: "/reviews", icon: StarIcon },
  { label: "Analytics", href: "/analytics", icon: LineChartIcon },
  { label: "Settings", href: "/settings", icon: SettingsIcon },
];

export default async function SellerDashboardPage() {
  const session = await requireSellerDashboardAccess();
  const notificationCenter = await getNotificationCenter({
    surface: "seller",
    userId: session.user.id,
  });

  return (
    <DashboardShell
      accent="green"
      activeHref="/"
      badge="Seller"
      description="Manage catalog readiness, order work, payouts, reviews, and seller performance from one focused workspace."
      eyebrow="Protected seller dashboard"
      navItems={sellerNavItems}
      notificationCenter={notificationCenter}
      notificationSurface="seller"
      surfaceHref="/"
      surfaceLabel="Seller"
      title="Seller operations"
      userLabel={`${session.user.email} (seller access)`}
    >
      <section
        className="grid gap-4 md:grid-cols-2 xl:grid-cols-4"
        aria-label="Seller dashboard overview"
      >
        <DashboardStatCard
          accent="green"
          description="Draft and active listings connected to this seller."
          icon={BoxesIcon}
          label="Products"
          value={0}
        />
        <DashboardStatCard
          accent="green"
          description="Incoming and fulfilled order items for this seller."
          icon={PackageCheckIcon}
          label="Orders"
          value={0}
        />
        <DashboardStatCard
          accent="green"
          description="Approved and pending seller payout batches."
          icon={WalletCardsIcon}
          label="Payouts"
          value={0}
        />
        <DashboardStatCard
          accent="green"
          description="Buyer feedback linked to verified order history."
          icon={StarIcon}
          label="Reviews"
          value={0}
        />
      </section>

      <section className="grid gap-4 xl:grid-cols-[0.9fr_1.1fr]">
        <DashboardPanel
          accent="green"
          title="Seller readiness"
          description="The seller workspace will start with products, orders, payouts, and staff controls."
        >
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-600/10 p-4 dark:bg-emerald-500/10">
            <StoreIcon className="size-5 text-emerald-700 dark:text-emerald-300" />
            <p className="mt-4 text-sm leading-6 text-zinc-700 dark:text-zinc-200">
              Seller data will always be scoped through server-side seller
              access checks before any catalog, order, or payout data is shown.
            </p>
          </div>
        </DashboardPanel>

        <DashboardPanel
          accent="green"
          title="Next seller workflows"
          description="These sit behind seller ownership and staff permission checks."
        >
          <div className="grid gap-3">
            {[
              "Create and edit product drafts",
              "Track order item fulfillment",
              "Review payout availability",
              "Manage seller staff access",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
              >
                <BadgeCheckIcon className="size-4 text-emerald-700 dark:text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </DashboardPanel>
      </section>
    </DashboardShell>
  );
}

import {
  BadgeCheckIcon,
  BoxesIcon,
  CheckCircle2Icon,
  CircleIcon,
  ClipboardListIcon,
  PackageCheckIcon,
  ShieldCheckIcon,
  TruckIcon,
  WalletCardsIcon,
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";

import { DashboardCompactMetrics } from "@/components/dashboard/dashboard-compact-metrics";
import {
  DashboardPageHeader,
  dashboardTableClass,
  dashboardTableContainerClass,
} from "@/components/dashboard/dashboard-controls";
import { DashboardPanel } from "@/components/dashboard/dashboard-panel";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import { getSellerDashboardOverview } from "@/src/modules/sellers/dashboard";

export const metadata: Metadata = {
  title: "Seller Dashboard",
  description:
    "Protected Piessang seller dashboard for products, orders, fulfillment, payouts, and seller settings.",
  robots: {
    index: false,
    follow: false,
  },
};

export default async function SellerDashboardPage() {
  const session = await requireSellerDashboardAccess();
  const overview = await getSellerDashboardOverview(session.user.id);

  const counts = [
    {
      id: "products",
      label: "Products",
      value: overview.products.total,
      description: "Total products connected to this seller account.",
      color: "#10b981",
    },
    {
      id: "active_products",
      label: "Active products",
      value: overview.products.active,
      description: "Products currently visible as active marketplace listings.",
      color: "#22c55e",
    },
    {
      id: "orders",
      label: "Orders",
      value: overview.orders.total,
      description: "Order items assigned to this seller.",
      color: "#0ea5e9",
    },
    {
      id: "open_shipments",
      label: "Open shipments",
      value: overview.shipments.open,
      description: "Shipments that are not delivered, returned, failed, or cancelled.",
      color: "#f59e0b",
    },
    {
      id: "waybills",
      label: "Waybills ready",
      value: overview.shipments.waybillReady,
      description: "Shipments with a waybill available for seller printing.",
      color: "#8b5cf6",
    },
    {
      id: "payouts",
      label: "Payouts",
      value: overview.payouts.total,
      description: "Seller payout batches recorded for this seller.",
      color: "#64748b",
    },
  ];

  return (
    <div className="grid gap-5">
      <DashboardPageHeader
        title="Seller operations"
        breadcrumbs={["Seller", "Overview"]}
      />

      <DashboardCompactMetrics
        metrics={counts}
        storageKey={`seller:${overview.seller.id}:overview-counts`}
      />

      {!overview.setup.complete ? (
        <DashboardPanel
          accent="green"
          title="Seller setup guide"
          description="Complete these steps to make your seller dashboard ready for orders, shipping quotes, and collection bookings."
        >
          <ol className="grid gap-3">
            {overview.setup.steps.map((step, index) => (
              <li
                key={step.id}
                className="flex min-w-0 items-start gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 dark:border-white/10 dark:bg-white/[0.04]"
              >
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-white text-sm font-bold text-zinc-700 ring-1 ring-zinc-200 dark:bg-white/10 dark:text-white dark:ring-white/10">
                  {index + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex min-w-0 items-center gap-2">
                    {step.complete ? (
                      <CheckCircle2Icon className="size-4 shrink-0 text-emerald-600 dark:text-emerald-300" />
                    ) : (
                      <CircleIcon className="size-4 shrink-0 text-amber-500" />
                    )}
                    <span className="font-semibold text-zinc-950 dark:text-white">
                      {step.title}
                    </span>
                  </span>
                  <span className="mt-1 block text-sm leading-5 text-zinc-600 dark:text-zinc-300">
                    {step.description}
                  </span>
                </span>
                {!step.complete ? (
                  step.href && step.actionLabel ? (
                    <Link
                      className="shrink-0 rounded-md border border-emerald-700/20 bg-emerald-600/10 px-3 py-1.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-600/15 dark:border-emerald-300/20 dark:text-emerald-200"
                      href={step.href}
                    >
                      {step.actionLabel}
                    </Link>
                  ) : (
                    <span className="shrink-0 rounded-md border border-amber-500/25 bg-amber-500/10 px-3 py-1.5 text-sm font-semibold text-amber-700 dark:text-amber-200">
                      Waiting
                    </span>
                  )
                ) : null}
              </li>
            ))}
          </ol>
        </DashboardPanel>
      ) : null}

      <section className="grid gap-4 xl:grid-cols-[0.92fr_1.08fr]">
        <DashboardPanel
          accent="green"
          title="Fulfillment readiness"
          description="The seller dashboard starts with the workflows needed for Bob Go-backed fulfillment."
        >
          <div className="grid gap-3">
            {[
              {
                icon: BoxesIcon,
                label: "Product parcel data",
                text: "Every shippable variant needs weight, length, width, and height before checkout quoting.",
              },
              {
                icon: TruckIcon,
                label: "Collection details",
                text: overview.fulfillmentProfile?.isVerified
                  ? "Collection profile is verified for shipment booking."
                  : "Collection profile still needs verification before shipment booking.",
              },
              {
                icon: PackageCheckIcon,
                label: "Waybill handoff",
                text: "Booked shipments will surface waybills here for seller printing.",
              },
            ].map((item) => {
              const Icon = item.icon;

              return (
                <div
                  key={item.label}
                  className="flex items-start gap-3 rounded-lg border border-zinc-200/80 bg-zinc-50/80 p-3 text-sm dark:border-white/10 dark:bg-white/[0.04]"
                >
                  <span className="grid size-9 shrink-0 place-items-center rounded-full bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
                    <Icon className="size-4" />
                  </span>
                  <span>
                    <span className="block font-semibold text-zinc-950 dark:text-white">
                      {item.label}
                    </span>
                    <span className="mt-1 block leading-5 text-zinc-600 dark:text-zinc-300">
                      {item.text}
                    </span>
                  </span>
                </div>
              );
            })}
          </div>
        </DashboardPanel>

        <DashboardPanel
          accent="green"
          title="Next workflows"
          description="These pages will use the same table, modal, filter, export, and action patterns as admin."
        >
          <div
            className={dashboardTableContainerClass}
          >
            <Table className={dashboardTableClass}>
              <TableHeader>
                <TableRow>
                  <TableHead>Workflow</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Focus</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {[
                  ["Orders", "Ready", "Seller order queue and SLA status"],
                  ["Products", "Ready", "Listing readiness and parcel data"],
                  ["Shipping", "Planned", "Bob Go quotes, bookings, and waybills"],
                  ["Payouts", "Planned", "Balances, batches, and statements"],
                ].map(([workflow, status, focus]) => (
                  <TableRow key={workflow}>
                    <TableCell className="font-semibold">{workflow}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/12 px-2 py-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        <BadgeCheckIcon className="size-3.5" />
                        {status}
                      </span>
                    </TableCell>
                    <TableCell>{focus}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </DashboardPanel>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <DashboardPanel
          accent="green"
          title="Orders"
          description="Seller-scoped fulfillment work."
        >
          <ClipboardListIcon className="size-5 text-emerald-700 dark:text-emerald-300" />
          <p className="mt-3 text-2xl font-semibold">{overview.orders.total}</p>
        </DashboardPanel>
        <DashboardPanel
          accent="green"
          title="Payouts"
          description="Seller payout batches."
        >
          <WalletCardsIcon className="size-5 text-emerald-700 dark:text-emerald-300" />
          <p className="mt-3 text-2xl font-semibold">{overview.payouts.total}</p>
        </DashboardPanel>
        <DashboardPanel
          accent="green"
          title="Reviews"
          description="Verified buyer feedback."
        >
          <ShieldCheckIcon className="size-5 text-emerald-700 dark:text-emerald-300" />
          <p className="mt-3 text-2xl font-semibold">0</p>
        </DashboardPanel>
      </section>
    </div>
  );
}

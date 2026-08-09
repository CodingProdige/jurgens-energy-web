import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";

import { CourierGuyPackingManager } from "@/app/(admin)/admin/(dashboard)/shipping/orders/[orderId]/packing-manager";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardBackButton,
  DashboardPageHeader,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { getCourierGuyManualPackingOrder } from "@/src/modules/shipping/courier-guy-manual-packing";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Manual Courier Packing",
  description:
    "Pack, quote, and book an order's physical Courier Guy packages.",
  robots: { follow: false, index: false },
};

function statusClass(status: string) {
  if (["paid", "confirmed"].includes(status)) {
    return "border-emerald-500/20 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (["cancelled", "refunded"].includes(status)) {
    return "border-red-500/20 bg-red-500/12 text-red-700 dark:text-red-300";
  }

  return "border-amber-500/20 bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

export default async function CourierGuyManualPackingPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const access = await requireAdminCapability("admin.orders.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const { orderId } = await params;

  if (!z.string().uuid().safeParse(orderId).success) {
    notFound();
  }

  const packingOrder = await getCourierGuyManualPackingOrder(orderId).catch(
    (error: unknown) => {
      if (
        error instanceof Error &&
        error.message === "Order could not be found."
      ) {
        return null;
      }

      throw error;
    },
  );

  if (!packingOrder) {
    notFound();
  }

  const canManage = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.orders.manage",
  );
  const managerKey = [
    packingOrder.packingPlan.revision,
    ...packingOrder.packages.map((packingPackage) => packingPackage.shipmentId),
  ].join(":");

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Orders", "Shipping", packingOrder.order.orderNumber]}
        title={`Pack ${packingOrder.order.orderNumber}`}
      />

      <div className="mb-4 flex min-w-0 flex-wrap items-center justify-between gap-3">
        <DashboardBackButton href="/shipping" label="Back to shipping" />
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              "rounded-md border capitalize",
              statusClass(packingOrder.order.status),
            )}
          >
            Order {packingOrder.order.status.replaceAll("_", " ")}
          </Badge>
          <Badge
            className={cn(
              "rounded-md border capitalize",
              statusClass(packingOrder.packingPlan.status),
            )}
          >
            Packing {packingOrder.packingPlan.status.replaceAll("_", " ")}
          </Badge>
        </div>
      </div>

      <CourierGuyPackingManager
        canManage={canManage}
        data={packingOrder}
        key={managerKey}
      />
    </>
  );
}

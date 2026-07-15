import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CalendarDaysIcon,
  CheckCircle2Icon,
  Clock3Icon,
  ExternalLinkIcon,
  MapPinIcon,
  MessageCircleIcon,
  PackageCheckIcon,
  PackageIcon,
  ReceiptTextIcon,
  ShoppingBagIcon,
  TruckIcon,
  UserRoundIcon,
} from "lucide-react";

import { MarketplaceFooter } from "@/components/marketplace/marketplace-footer";
import { MarketplaceGate } from "@/components/marketplace/marketplace-gate";
import { MarketplaceHeader } from "@/components/marketplace/marketplace-header";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type {
  CustomerOrderDetail,
  CustomerOrderSummary,
} from "@/src/modules/marketplace/account/data";

const dateTimeFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Africa/Johannesburg",
});
const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "long",
  timeZone: "Africa/Johannesburg",
});

export function formatAccountMoney(value: number, currency = "ZAR") {
  try {
    return new Intl.NumberFormat("en-ZA", {
      currency,
      style: "currency",
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-ZA", {
      currency: "ZAR",
      style: "currency",
    }).format(value);
  }
}

function formatDateTime(value: Date) {
  return dateTimeFormatter.format(value);
}

function humanizeStatus(value: string) {
  return value.replaceAll("_", " ");
}

function getOrderDisplayStatus(order: {
  shipmentStatus: string | null;
  status: string;
}) {
  if (order.status === "cancelled") {
    return "Cancelled";
  }

  if (order.status === "refunded") {
    return "Refunded";
  }

  if (order.shipmentStatus === "delivered") {
    return "Delivered";
  }

  if (order.shipmentStatus) {
    return humanizeStatus(order.shipmentStatus);
  }

  if (order.status === "fulfilled") {
    return "Delivered";
  }

  if (order.status === "paid") {
    return "Preparing order";
  }

  return "Awaiting payment";
}

function statusBadgeClass(status: string) {
  const normalized = status.toLowerCase().replaceAll(" ", "_");

  if (
    ["authorized", "captured", "completed", "delivered", "fulfilled", "paid"].includes(
      normalized,
    )
  ) {
    return "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";
  }

  if (["cancelled", "failed_delivery", "refunded", "returned"].includes(normalized)) {
    return "bg-red-500/12 text-red-700 dark:text-red-300";
  }

  if (["in_transit", "out_for_delivery", "collected"].includes(normalized)) {
    return "bg-sky-500/12 text-sky-700 dark:text-sky-300";
  }

  return "bg-amber-500/12 text-amber-700 dark:text-amber-300";
}

export function OrderStatusBadge({
  shipmentStatus,
  status,
}: {
  shipmentStatus: string | null;
  status: string;
}) {
  const label = getOrderDisplayStatus({ shipmentStatus, status });

  return (
    <Badge
      className={cn(
        "h-6 rounded-full border-0 px-2.5 font-bold capitalize",
        statusBadgeClass(label),
      )}
    >
      {label}
    </Badge>
  );
}

export function AccountPageShell({
  active,
  children,
  description,
  title,
}: {
  active: "orders" | "overview" | "whatsapp";
  children: ReactNode;
  description: string;
  title: string;
}) {
  const links = [
    { href: "/account", id: "overview" as const, label: "Overview" },
    { href: "/account/orders", id: "orders" as const, label: "Orders" },
    {
      href: "/account/whatsapp",
      id: "whatsapp" as const,
      label: "WhatsApp",
    },
  ];

  return (
    <MarketplaceGate>
      <div className="min-h-screen bg-[#f7f7f2] text-[#080808] dark:bg-[#080808] dark:text-[#f7f7f2]">
        <MarketplaceHeader />
        <main className="w-full overflow-x-clip pb-12 sm:mx-auto sm:w-[min(1500px,calc(100%-1rem))]">
          <div className="mx-auto grid w-full max-w-6xl gap-6 px-4 py-7 sm:px-6 sm:py-10 lg:px-8">
            <header className="grid gap-5 border-b border-[#deded7] pb-6 dark:border-white/10 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-[#ff5a1f]">
                  My account
                </p>
                <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">
                  {title}
                </h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#666660] dark:text-[#aaa9a1]">
                  {description}
                </p>
              </div>

              <nav
                aria-label="Account navigation"
                className="flex max-w-full gap-1 overflow-x-auto rounded-md border border-[#deded7] bg-white p-1 dark:border-white/10 dark:bg-[#101010]"
              >
                {links.map((link) => (
                  <Link
                    aria-current={active === link.id ? "page" : undefined}
                    className={cn(
                      "shrink-0 rounded-sm px-3 py-2 text-xs font-black uppercase tracking-wide transition",
                      active === link.id
                        ? "bg-[#ff5a1f] text-white shadow-[0_8px_20px_rgba(255,90,31,0.22)] dark:bg-[#ff5a1f] dark:text-white"
                        : "text-[#696963] hover:bg-[#f7f7f2] hover:text-[#080808] dark:text-[#b8b8b0] dark:hover:bg-white/[0.06] dark:hover:text-white",
                    )}
                    href={link.href}
                    key={link.id}
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </header>

            {children}
          </div>
        </main>
        <MarketplaceFooter />
      </div>
    </MarketplaceGate>
  );
}

export function OrderSummaryCard({ order }: { order: CustomerOrderSummary }) {
  return (
    <Link
      className="group grid min-w-0 gap-4 rounded-md border border-[#deded7] bg-white p-4 shadow-[0_10px_30px_rgba(8,8,8,0.04)] transition hover:border-[#ff5a1f]/60 hover:shadow-[0_14px_40px_rgba(8,8,8,0.08)] dark:border-white/10 dark:bg-[#101010] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:p-5"
      href={`/account/orders/${order.id}`}
    >
      <div className="flex min-w-0 items-start gap-3 sm:gap-4">
        <span className="grid size-11 shrink-0 place-items-center rounded-md bg-[#ff5a1f]/10 text-[#ff5a1f]">
          <PackageIcon className="size-5" />
        </span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="font-black">{order.orderNumber}</p>
            <OrderStatusBadge
              shipmentStatus={order.shipmentStatus}
              status={order.status}
            />
          </div>
          <p className="mt-1 truncate text-sm text-[#666660] dark:text-[#aaa9a1]">
            {order.itemTitles.join(", ") || "Order items"}
            {order.itemCount > order.itemTitles.length
              ? ` +${order.itemCount - order.itemTitles.length} more`
              : ""}
          </p>
          <p className="mt-2 text-xs text-[#777770] dark:text-[#92928c]">
            {formatDateTime(order.createdAt)} · {order.totalQuantity} unit
            {order.totalQuantity === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-[#e8e8e2] pt-3 dark:border-white/10 sm:border-0 sm:pt-0">
        <strong className="tabular-nums">
          {formatAccountMoney(order.grandTotal, order.currency)}
        </strong>
        <ArrowRightIcon className="size-4 text-[#ff5a1f] transition group-hover:translate-x-1" />
      </div>
    </Link>
  );
}

function DetailPanel({
  children,
  className,
  description,
  icon,
  title,
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  icon: ReactNode;
  title: string;
}) {
  return (
    <section
      className={cn(
        "min-w-0 overflow-hidden rounded-md border border-[#deded7] bg-white dark:border-white/10 dark:bg-[#101010]",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-[#e8e8e2] px-4 py-4 dark:border-white/10 sm:px-5">
        <span className="grid size-9 shrink-0 place-items-center rounded-md bg-[#ff5a1f]/10 text-[#ff5a1f]">
          {icon}
        </span>
        <div className="min-w-0">
          <h2 className="font-black">{title}</h2>
          {description ? (
            <p className="mt-0.5 text-xs leading-5 text-[#777770] dark:text-[#aaa9a1]">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      {children}
    </section>
  );
}

function ShipmentTimeline({
  shipment,
}: {
  shipment: CustomerOrderDetail["shipments"][number];
}) {
  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black capitalize">
            {humanizeStatus(shipment.status)}
          </p>
          <p className="mt-1 text-xs text-[#777770] dark:text-[#aaa9a1]">
            {shipment.trackingNumber
              ? `Tracking ${shipment.trackingNumber}`
              : shipment.waybillNumber
                ? `Waybill ${shipment.waybillNumber}`
                : `${humanizeStatus(shipment.provider)} delivery`}
          </p>
        </div>
        {shipment.trackingUrl ? (
          <a
            className="inline-flex h-9 items-center gap-2 rounded-md border border-[#ff5a1f]/50 px-3 text-xs font-black text-[#d9460f] transition hover:bg-[#fff2ed] dark:text-[#ff8a60] dark:hover:bg-[#ff5a1f]/10"
            href={shipment.trackingUrl}
            rel="noreferrer"
            target="_blank"
          >
            Track parcel
            <ExternalLinkIcon className="size-3.5" />
          </a>
        ) : null}
      </div>

      {shipment.events.length > 0 ? (
        <ol className="grid gap-0">
          {shipment.events.map((event, index) => {
            const isLatest = index === shipment.events.length - 1;

            return (
              <li className="grid grid-cols-[20px_minmax(0,1fr)] gap-3" key={event.id}>
                <div className="flex flex-col items-center">
                  <span
                    className={cn(
                      "mt-1 size-2.5 rounded-full ring-4",
                      isLatest
                        ? "bg-[#ff5a1f] ring-[#ff5a1f]/15"
                        : "bg-[#b8b8b0] ring-[#b8b8b0]/15",
                    )}
                  />
                  {index < shipment.events.length - 1 ? (
                    <span className="min-h-10 w-px flex-1 bg-[#deded7] dark:bg-white/10" />
                  ) : null}
                </div>
                <div className="pb-5">
                  <p className="text-sm font-bold capitalize">
                    {humanizeStatus(event.status)}
                  </p>
                  {event.message ? (
                    <p className="mt-1 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
                      {event.message}
                    </p>
                  ) : null}
                  <p className="mt-1 text-[11px] text-[#888880] dark:text-[#92928c]">
                    {formatDateTime(event.occurredAt)}
                    {event.location ? ` · ${event.location}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      ) : (
        <p className="rounded-md bg-[#f7f7f2] px-3 py-3 text-xs leading-5 text-[#666660] dark:bg-white/[0.05] dark:text-[#aaa9a1]">
          Detailed tracking events will appear here once the delivery provider
          starts moving your order.
        </p>
      )}
    </div>
  );
}

export function OrderDetailView({ order }: { order: CustomerOrderDetail }) {
  const latestPayment = order.payments[0] ?? null;
  const address = order.deliveryAddress;

  return (
    <div className="grid min-w-0 gap-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link
            className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-wide text-[#696963] transition hover:text-[#ff5a1f] dark:text-[#aaa9a1]"
            href="/account/orders"
          >
            <ArrowLeftIcon className="size-3.5" />
            All orders
          </Link>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-black sm:text-2xl">{order.orderNumber}</h2>
            <OrderStatusBadge
              shipmentStatus={order.shipmentStatus}
              status={order.status}
            />
          </div>
          <p className="mt-1 text-sm text-[#777770] dark:text-[#aaa9a1]">
            Placed {formatDateTime(order.createdAt)}
          </p>
        </div>
        <Link
          className="inline-flex h-10 items-center gap-2 rounded-md bg-[#ff5a1f] px-4 text-sm font-black text-white transition hover:bg-[#e84c15]"
          href="/products"
        >
          <ShoppingBagIcon className="size-4" />
          Shop again
        </Link>
      </div>

      <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.7fr)]">
        <div className="grid min-w-0 content-start gap-5">
          <DetailPanel
            description={`${order.items.length} line item${order.items.length === 1 ? "" : "s"}`}
            icon={<ReceiptTextIcon className="size-4" />}
            title="Order items"
          >
            <div className="divide-y divide-[#e8e8e2] dark:divide-white/10">
              {order.items.map((item) => (
                <div
                  className="grid gap-3 px-4 py-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start sm:px-5"
                  key={item.id}
                >
                  <div className="min-w-0">
                    <p className="font-bold leading-5">{item.title}</p>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-[#777770] dark:text-[#aaa9a1]">
                      <span>Qty {item.quantity}</span>
                      <span>{formatAccountMoney(item.unitPrice, order.currency)} each</span>
                      {item.deliveryLabel ? <span>{item.deliveryLabel}</span> : null}
                    </div>
                    {item.purchaseType === "exchange" ? (
                      <p className="mt-2 inline-flex items-center gap-1.5 rounded-sm bg-[#ff5a1f]/10 px-2 py-1 text-[11px] font-bold text-[#d9460f] dark:text-[#ff8a60]">
                        <PackageCheckIcon className="size-3" />
                        Cylinder exchange
                        {item.exchangeEmptyConfirmed ? " · empty confirmed" : ""}
                      </p>
                    ) : null}
                  </div>
                  <strong className="tabular-nums sm:text-right">
                    {formatAccountMoney(item.lineTotal, order.currency)}
                  </strong>
                </div>
              ))}
            </div>
            <div className="grid gap-2 border-t border-[#e8e8e2] bg-[#fafaf7] px-4 py-4 text-sm dark:border-white/10 dark:bg-white/[0.025] sm:px-5">
              <div className="flex justify-between gap-4 text-[#666660] dark:text-[#aaa9a1]">
                <span>Subtotal</span>
                <span className="tabular-nums">
                  {formatAccountMoney(order.subtotal, order.currency)}
                </span>
              </div>
              <div className="flex justify-between gap-4 text-[#666660] dark:text-[#aaa9a1]">
                <span>Delivery</span>
                <span className="tabular-nums">
                  {formatAccountMoney(order.shippingTotal, order.currency)}
                </span>
              </div>
              <div className="mt-1 flex justify-between gap-4 border-t border-[#deded7] pt-3 text-base font-black dark:border-white/10">
                <span>Total</span>
                <span className="tabular-nums">
                  {formatAccountMoney(order.grandTotal, order.currency)}
                </span>
              </div>
            </div>
          </DetailPanel>

          <DetailPanel
            description="The latest delivery progress for this order"
            icon={<TruckIcon className="size-4" />}
            title="Delivery tracking"
          >
            <div className="grid gap-5 px-4 py-5 sm:px-5">
              {order.schedules.map((schedule) => (
                <div
                  className="grid gap-3 rounded-md border border-[#deded7] p-4 dark:border-white/10 sm:grid-cols-[auto_minmax(0,1fr)]"
                  key={`${schedule.scheduledDate}-${schedule.windowLabel}`}
                >
                  <span className="grid size-10 place-items-center rounded-full bg-[#ff5a1f]/10 text-[#ff5a1f]">
                    <CalendarDaysIcon className="size-5" />
                  </span>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-black">Jurgens local delivery</p>
                      <Badge
                        className={cn(
                          "h-6 border-0 capitalize",
                          statusBadgeClass(schedule.status),
                        )}
                      >
                        {humanizeStatus(schedule.status)}
                      </Badge>
                    </div>
                    <p className="mt-1 text-sm text-[#666660] dark:text-[#aaa9a1]">
                      {dateFormatter.format(
                        new Date(`${schedule.scheduledDate}T12:00:00+02:00`),
                      )}{" "}
                      · {schedule.windowLabel}
                    </p>
                    {schedule.deliveryInstructions ? (
                      <p className="mt-2 text-xs leading-5 text-[#777770] dark:text-[#92928c]">
                        {schedule.deliveryInstructions}
                      </p>
                    ) : null}
                  </div>
                </div>
              ))}

              {order.shipments.length > 0 ? (
                order.shipments.map((shipment) => (
                  <ShipmentTimeline key={shipment.id} shipment={shipment} />
                ))
              ) : order.schedules.length === 0 ? (
                <div className="flex items-start gap-3 rounded-md bg-[#f7f7f2] p-4 dark:bg-white/[0.05]">
                  <Clock3Icon className="mt-0.5 size-5 shrink-0 text-[#ff5a1f]" />
                  <div>
                    <p className="text-sm font-bold">Delivery is being prepared</p>
                    <p className="mt-1 text-xs leading-5 text-[#666660] dark:text-[#aaa9a1]">
                      Tracking information will appear here after your order is
                      paid and booked for delivery.
                    </p>
                  </div>
                </div>
              ) : null}
            </div>
          </DetailPanel>
        </div>

        <aside className="grid min-w-0 content-start gap-5">
          <DetailPanel icon={<MapPinIcon className="size-4" />} title="Delivery address">
            <address className="px-4 py-4 text-sm not-italic leading-6 text-[#555550] dark:text-[#c4c4bd] sm:px-5">
              <strong className="text-[#080808] dark:text-[#f7f7f2]">
                {order.customer.name}
              </strong>
              <br />
              {address.addressLine1}
              <br />
              {address.addressLine2 ? (
                <>
                  {address.addressLine2}
                  <br />
                </>
              ) : null}
              {address.suburb}, {address.city}
              <br />
              {address.province}, {address.postalCode}
              <br />
              {address.countryCode}
            </address>
          </DetailPanel>

          <DetailPanel icon={<UserRoundIcon className="size-4" />} title="Contact details">
            <dl className="grid gap-3 px-4 py-4 text-sm sm:px-5">
              <div className="min-w-0">
                <dt className="text-xs text-[#777770] dark:text-[#92928c]">Email</dt>
                <dd className="mt-0.5 break-all font-bold">{order.customer.email}</dd>
              </div>
              <div>
                <dt className="text-xs text-[#777770] dark:text-[#92928c]">Phone</dt>
                <dd className="mt-0.5 font-bold">{order.customer.phone}</dd>
              </div>
            </dl>
          </DetailPanel>

          <DetailPanel icon={<CheckCircle2Icon className="size-4" />} title="Payment">
            <div className="px-4 py-4 sm:px-5">
              {latestPayment ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <Badge
                      className={cn(
                        "h-6 border-0 capitalize",
                        statusBadgeClass(latestPayment.status),
                      )}
                    >
                      {humanizeStatus(latestPayment.status)}
                    </Badge>
                    <p className="mt-2 text-xs capitalize text-[#777770] dark:text-[#aaa9a1]">
                      {latestPayment.provider}
                      {latestPayment.completedAt
                        ? ` · ${formatDateTime(latestPayment.completedAt)}`
                        : ""}
                    </p>
                  </div>
                  <strong className="tabular-nums">
                    {formatAccountMoney(latestPayment.amount, order.currency)}
                  </strong>
                </div>
              ) : (
                <p className="text-sm text-[#666660] dark:text-[#aaa9a1]">
                  No payment has been recorded yet.
                </p>
              )}
            </div>
          </DetailPanel>

          <Link
            className="group flex items-center justify-between gap-4 rounded-md border border-[#deded7] bg-white px-4 py-4 text-sm font-black transition hover:border-[#18a957]/60 dark:border-white/10 dark:bg-[#101010]"
            href="/account/whatsapp"
          >
            <span className="flex items-center gap-3">
              <MessageCircleIcon className="size-5 text-[#18a957]" />
              WhatsApp order updates
            </span>
            <ArrowRightIcon className="size-4 transition group-hover:translate-x-1" />
          </Link>
        </aside>
      </div>
    </div>
  );
}

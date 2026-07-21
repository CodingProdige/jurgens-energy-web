import type { Metadata } from "next";
import Link from "next/link";

import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import {
  DashboardPageHeader,
  dashboardPanelClass,
  dashboardTableCellClass,
  dashboardTableClass,
  dashboardTableContainerClass,
  dashboardTableHeadClass,
  dashboardTableHeaderRowClass,
  dashboardTableMutedTextClass,
  dashboardTablePrimaryTextClass,
  dashboardTableRowClass,
  dashboardTableSecondaryTextClass,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import {
  getAdminContactInquiries,
  type AdminContactInquiryRow,
} from "@/src/modules/admin/contact-inquiries";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Contact Inquiries",
  description: "Review messages submitted through the Jurgens Energy contact form.",
  robots: { follow: false, index: false },
};

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
});

function InquiryStatus({ status }: { status: AdminContactInquiryRow["status"] }) {
  return (
    <Badge
      className={cn(
        "rounded-md border-0 capitalize",
        status === "resolved"
          ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
          : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
      )}
    >
      {status}
    </Badge>
  );
}

export default async function AdminContactInquiriesPage() {
  const access = await requireAdminCapability("admin.contact_inquiries.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const data = await getAdminContactInquiries();
  const metrics: DashboardMetricDefinition[] = [
    {
      color: "amber",
      description: "Messages that still need a response or final review.",
      id: "new",
      label: "New",
      value: data.metrics.new,
    },
    {
      color: "emerald",
      description: "Messages that an authorized admin marked as resolved.",
      id: "resolved",
      label: "Resolved",
      value: data.metrics.resolved,
    },
    {
      color: "slate",
      description: "All contact-form messages stored in the database.",
      id: "total",
      label: "Total",
      value: data.metrics.total,
    },
  ];

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Support", "Contact inquiries"]}
        title="Contact inquiries"
      />

      <div className="grid gap-4">
        <DashboardCompactMetrics
          metrics={metrics}
          storageKey="jurgens:admin:contact-inquiry-metrics"
        />

        <section
          className={cn(
            "overflow-hidden",
            dashboardPanelClass,
            dashboardTableContainerClass,
          )}
        >
          <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              Inquiry inbox
            </p>
            <p className="text-xs text-slate-500 dark:text-zinc-400">
              {data.inquiries.length} most recent message
              {data.inquiries.length === 1 ? "" : "s"} shown
            </p>
          </div>

          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Contact</TableHead>
                <TableHead className={dashboardTableHeadClass}>Message</TableHead>
                <TableHead className={dashboardTableHeadClass}>Status</TableHead>
                <TableHead className={dashboardTableHeadClass}>Received</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.inquiries.length === 0 ? (
                <TableRow className={dashboardTableRowClass}>
                  <TableCell
                    className={cn("h-28 text-center", dashboardTableCellClass)}
                    colSpan={4}
                  >
                    <span className={dashboardTableMutedTextClass}>
                      No contact inquiries have been submitted yet.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                data.inquiries.map((inquiry) => (
                  <TableRow className={dashboardTableRowClass} key={inquiry.id}>
                    <TableCell className={dashboardTableCellClass}>
                      <div className="min-w-0 space-y-1">
                        <Link
                          className={`${dashboardTablePrimaryTextClass} transition hover:text-[#ff5a1f]`}
                          href={`/contact-inquiries/${inquiry.id}`}
                        >
                          {inquiry.name}
                        </Link>
                        <p className={cn("break-all", dashboardTableSecondaryTextClass)}>
                          {inquiry.email}
                        </p>
                      </div>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <p className={cn("line-clamp-2 max-w-xl break-words", dashboardTableMutedTextClass)}>
                        {inquiry.message}
                      </p>
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <InquiryStatus status={inquiry.status} />
                    </TableCell>
                    <TableCell className={dashboardTableCellClass}>
                      <span className={dashboardTableMutedTextClass}>
                        {dateFormatter.format(inquiry.createdAt)}
                      </span>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </section>
      </div>
    </>
  );
}

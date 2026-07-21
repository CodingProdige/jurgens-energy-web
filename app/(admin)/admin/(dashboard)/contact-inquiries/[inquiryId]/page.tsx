import type { Metadata } from "next";
import { CheckCircle2Icon, MailIcon, RotateCcwIcon, UserRoundIcon } from "lucide-react";
import { notFound } from "next/navigation";
import { z } from "zod";

import { updateContactInquiryStatusAction } from "@/app/(admin)/admin/(dashboard)/contact-inquiries/actions";
import { RestrictedAdminPage } from "@/components/admin/restricted-admin-page";
import {
  DashboardBackButton,
  DashboardButton,
  DashboardPageHeader,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { getAdminContactInquiry } from "@/src/modules/admin/contact-inquiries";
import { hasAdminCapability } from "@/src/modules/admin/staff";
import { requireAdminCapability } from "@/src/modules/auth/permissions";

export const metadata: Metadata = {
  title: "Contact Inquiry",
  description: "Review a message submitted through the Jurgens Energy contact form.",
  robots: { follow: false, index: false },
};

const inquiryIdSchema = z.string().uuid();
const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "long",
  timeStyle: "short",
});

export default async function AdminContactInquiryDetailPage({
  params,
}: {
  params: Promise<{ inquiryId: string }>;
}) {
  const access = await requireAdminCapability("admin.contact_inquiries.view");

  if (!access.ok) {
    return <RestrictedAdminPage />;
  }

  const parsedInquiryId = inquiryIdSchema.safeParse((await params).inquiryId);

  if (!parsedInquiryId.success) {
    notFound();
  }

  const inquiry = await getAdminContactInquiry(parsedInquiryId.data);

  if (!inquiry) {
    notFound();
  }

  const canManage = hasAdminCapability(
    access.session.user.adminCapabilities,
    "admin.contact_inquiries.manage",
  );
  const nextStatus = inquiry.status === "new" ? "resolved" : "new";

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Support", "Contact inquiries", "Message"]}
        title="Contact inquiry"
      />

      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <DashboardBackButton
          href="/contact-inquiries"
          label="Back to inquiries"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            className={cn(
              "rounded-md border-0 px-3 py-1 capitalize",
              inquiry.status === "resolved"
                ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                : "bg-amber-500/12 text-amber-700 dark:text-amber-300",
            )}
          >
            {inquiry.status}
          </Badge>
          {canManage ? (
            <form action={updateContactInquiryStatusAction}>
              <input name="inquiryId" type="hidden" value={inquiry.id} />
              <input name="status" type="hidden" value={nextStatus} />
              <DashboardButton type="submit">
                {nextStatus === "resolved" ? (
                  <CheckCircle2Icon className="size-4" />
                ) : (
                  <RotateCcwIcon className="size-4" />
                )}
                {nextStatus === "resolved" ? "Mark resolved" : "Reopen"}
              </DashboardButton>
            </form>
          ) : null}
        </div>
      </div>

      <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(300px,0.6fr)]">
        <section className={cn("min-w-0 overflow-hidden", dashboardPanelClass)}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              Message
            </p>
            <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
              Received {dateFormatter.format(inquiry.createdAt)}
            </p>
          </div>
          <p className="whitespace-pre-wrap break-words px-5 py-5 text-sm leading-7 text-slate-700 dark:text-zinc-300">
            {inquiry.message}
          </p>
        </section>

        <aside className={cn("min-w-0 overflow-hidden", dashboardPanelClass)}>
          <div className="border-b border-slate-200 px-5 py-4 dark:border-white/10">
            <p className="text-sm font-semibold text-zinc-950 dark:text-white">
              Contact details
            </p>
          </div>
          <dl className="grid gap-5 px-5 py-5 text-sm">
            <div className="flex min-w-0 gap-3">
              <UserRoundIcon className="mt-0.5 size-4 shrink-0 text-[#ff5a1f]" />
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Name
                </dt>
                <dd className="mt-1 break-words font-medium text-zinc-950 dark:text-white">
                  {inquiry.name}
                </dd>
              </div>
            </div>
            <div className="flex min-w-0 gap-3">
              <MailIcon className="mt-0.5 size-4 shrink-0 text-[#ff5a1f]" />
              <div className="min-w-0">
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Email
                </dt>
                <dd className="mt-1 break-all font-medium text-zinc-950 dark:text-white">
                  {inquiry.email}
                </dd>
              </div>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                Reference
              </dt>
              <dd className="mt-1 break-all font-mono text-xs text-slate-700 dark:text-zinc-300">
                {inquiry.id}
              </dd>
            </div>
            {inquiry.status === "resolved" ? (
              <div>
                <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500 dark:text-zinc-400">
                  Last updated
                </dt>
                <dd className="mt-1 text-slate-700 dark:text-zinc-300">
                  {dateFormatter.format(inquiry.updatedAt)}
                </dd>
              </div>
            ) : null}
          </dl>
          <div className="border-t border-slate-200 px-5 py-4 dark:border-white/10">
            <a
              className={buttonVariants({
                className: "w-full",
                variant: "default",
              })}
              href={`mailto:${inquiry.email}`}
            >
              <MailIcon className="size-4" />
              Reply by email
            </a>
          </div>
        </aside>
      </div>
    </>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  BarChart3Icon,
  BotIcon,
  EyeIcon,
  Loader2Icon,
  RefreshCwIcon,
  SendIcon,
  UserCheckIcon,
  XCircleIcon,
} from "lucide-react";

import {
  clearWhatsappModeration,
  pauseWhatsappAutomation,
  resumeWhatsappAutomation,
  sendWhatsappFollowUp,
  setWhatsappAutomatedResponsesEnabled,
} from "@/app/(admin)/admin/(dashboard)/whatsapp/actions";
import { WhatsappCustomerDetails } from "@/app/(admin)/admin/(dashboard)/whatsapp/whatsapp-customer-details";
import {
  DashboardPageHeader,
  DashboardTablePagination,
  dashboardPanelClass,
  dashboardTableActionCellClass,
  dashboardTableActionHeadClass,
  dashboardTableCellClass,
  dashboardTableClass,
  dashboardTableHeadClass,
  dashboardTableHeaderRowClass,
  dashboardTableMutedTextClass,
  dashboardTablePrimaryTextClass,
  dashboardTableRowClass,
  dashboardTableSecondaryTextClass,
} from "@/components/dashboard/dashboard-controls";
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import { DashboardRowActionMenu } from "@/components/dashboard/dashboard-row-action-menu";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type {
  AdminWhatsappConversation,
  AdminWhatsappConversationsData,
} from "@/src/modules/admin/whatsapp";

const dateFormatter = new Intl.DateTimeFormat("en-ZA", {
  dateStyle: "medium",
  timeStyle: "short",
});
const rowActionMenuItemClass =
  "flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-white/10";
const tablePreviewCellClass = cn(
  dashboardTableCellClass,
  "min-w-0 overflow-hidden whitespace-normal align-middle",
);
const whatsappTableActionHeadClass = cn(
  dashboardTableHeadClass,
  dashboardTableActionHeadClass,
  "sticky right-0 z-20 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.7)] dark:bg-[#151719]",
);
const whatsappTableActionCellClass = cn(
  dashboardTableActionCellClass,
  "sticky right-0 z-10 bg-white shadow-[-8px_0_12px_-12px_rgba(15,23,42,0.7)] dark:bg-[#151719]",
);

type PendingConversationAction = {
  conversationId: string;
  kind: "automation" | "follow_up";
};

type ConversationActionFeedback = {
  message: string;
  tone: "error" | "success";
};

function formatDate(value: Date | string | null | undefined) {
  if (!value) {
    return "Never";
  }

  return dateFormatter.format(new Date(value));
}

function ActivityBadge({
  conversation,
}: {
  conversation: AdminWhatsappConversation;
}) {
  const classes = {
    awaiting_customer:
      "bg-sky-500/12 text-sky-700 dark:text-sky-300",
    idle: "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
    live: "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300",
    manual_handover:
      "bg-amber-500/14 text-amber-700 dark:text-amber-300",
    muted: "bg-red-500/12 text-red-700 dark:text-red-300",
    needs_follow_up:
      "bg-orange-500/12 text-orange-700 dark:text-orange-300",
    needs_reply: "bg-[#ff5a1f]/12 text-[#d84612] dark:text-[#ffb199]",
  } satisfies Record<AdminWhatsappConversation["activity"]["status"], string>;

  return (
    <Badge className={cn("rounded-md border-0", classes[conversation.activity.status])}>
      {conversation.activity.label}
    </Badge>
  );
}

function AutomationBadge({
  automatedResponsesEnabled,
  conversation,
}: {
  automatedResponsesEnabled: boolean;
  conversation: AdminWhatsappConversation;
}) {
  if (!automatedResponsesEnabled) {
    return (
      <Badge className="rounded-md border-0 bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300">
        Global off
      </Badge>
    );
  }

  if (conversation.isAutomationPaused) {
    return (
      <Badge className="rounded-md border-0 bg-amber-500/14 text-amber-700 dark:text-amber-300">
        Manual
      </Badge>
    );
  }

  if (conversation.isMuted) {
    return (
      <Badge className="rounded-md border-0 bg-red-500/12 text-red-700 dark:text-red-300">
        Muted
      </Badge>
    );
  }

  return (
    <Badge className="rounded-md border-0 bg-emerald-500/12 text-emerald-700 dark:text-emerald-300">
      Auto
    </Badge>
  );
}

function ConversationQuickActions({
  automatedResponsesEnabled,
  canManage,
  conversation,
  onSendFollowUp,
  onToggleAutomation,
  onViewCustomerDetails,
  pendingAction,
}: {
  automatedResponsesEnabled: boolean;
  canManage: boolean;
  conversation: AdminWhatsappConversation;
  onSendFollowUp: (conversation: AdminWhatsappConversation) => void;
  onToggleAutomation: (conversation: AdminWhatsappConversation) => void;
  onViewCustomerDetails: (conversation: AdminWhatsappConversation) => void;
  pendingAction: PendingConversationAction | null;
}) {
  const hasFlags =
    (conversation.moderation.abuseCount ?? 0) > 0 ||
    (conversation.moderation.unknownCount ?? 0) > 0;
  const isAutomationPending =
    pendingAction?.conversationId === conversation.id &&
    pendingAction.kind === "automation";
  const isFollowUpPending =
    pendingAction?.conversationId === conversation.id &&
    pendingAction.kind === "follow_up";
  const isConversationActionPending = isAutomationPending || isFollowUpPending;

  return (
    <div className="inline-flex items-center justify-end">
      <DashboardRowActionMenu
        ariaLabel={`Open actions for ${conversation.customer.name ?? conversation.phone}`}
        className="w-60"
        trigger={
          isConversationActionPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : undefined
        }
      >
        <Link
          className={rowActionMenuItemClass}
          href={`/whatsapp/${conversation.id}`}
        >
          <EyeIcon className="size-4" />
          Open conversation
        </Link>
        <button
          className={rowActionMenuItemClass}
          onClick={() => onViewCustomerDetails(conversation)}
          type="button"
        >
          <BarChart3Icon className="size-4" />
          View customer details
        </button>
        {canManage ? (
          <>
            <button
              className={cn(
                rowActionMenuItemClass,
                "disabled:cursor-wait disabled:opacity-60",
              )}
              disabled={
                Boolean(pendingAction) || !automatedResponsesEnabled
              }
              onClick={() => onToggleAutomation(conversation)}
              title={
                automatedResponsesEnabled
                  ? undefined
                  : "Global automated responses are disabled."
              }
              type="button"
            >
              {isAutomationPending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : conversation.isAutomationPaused || conversation.isMuted ? (
                <RefreshCwIcon className="size-4" />
              ) : (
                <UserCheckIcon className="size-4" />
              )}
              {isAutomationPending
                ? "Updating automation..."
                : conversation.isAutomationPaused || conversation.isMuted
                  ? "Resume automation"
                  : "Manual handover"}
            </button>
            {conversation.activity.status === "needs_follow_up" ? (
              <button
                className={cn(
                  rowActionMenuItemClass,
                  "items-start disabled:cursor-not-allowed disabled:opacity-60",
                )}
                disabled={Boolean(pendingAction) || !conversation.followUp.canSend}
                onClick={() => onSendFollowUp(conversation)}
                title={conversation.followUp.unavailableReason ?? undefined}
                type="button"
              >
                {isFollowUpPending ? (
                  <Loader2Icon className="mt-0.5 size-4 animate-spin" />
                ) : (
                  <SendIcon className="mt-0.5 size-4" />
                )}
                <span className="min-w-0 text-left">
                  <span className="block">
                    {isFollowUpPending ? "Sending follow-up..." : "Send follow-up"}
                  </span>
                  {!conversation.followUp.canSend &&
                  conversation.followUp.unavailableReason ? (
                    <span className="mt-0.5 block text-xs leading-4 text-slate-500 dark:text-zinc-400">
                      {conversation.followUp.unavailableReason}
                    </span>
                  ) : null}
                </span>
              </button>
            ) : null}
            {hasFlags ? (
              <form action={clearWhatsappModeration}>
                <input name="conversationId" type="hidden" value={conversation.id} />
                <button className={rowActionMenuItemClass} type="submit">
                  <XCircleIcon className="size-4" />
                  Clear flags
                </button>
              </form>
            ) : null}
          </>
        ) : null}
      </DashboardRowActionMenu>
    </div>
  );
}

export function AdminWhatsappManager({
  canManage,
  canManageAutomatedResponses,
  data,
}: {
  canManage: boolean;
  canManageAutomatedResponses: boolean;
  data: AdminWhatsappConversationsData;
}) {
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [customerDetailsConversation, setCustomerDetailsConversation] =
    useState<AdminWhatsappConversation | null>(null);
  const [actionFeedback, setActionFeedback] =
    useState<ConversationActionFeedback | null>(null);
  const [automatedResponsesEnabled, setAutomatedResponsesEnabled] = useState(
    data.automatedResponsesEnabled,
  );
  const [pendingAction, setPendingAction] =
    useState<PendingConversationAction | null>(null);
  const [isAutomationSettingPending, startAutomationSettingTransition] =
    useTransition();
  const [, startActionTransition] = useTransition();
  const automatedResponsesActive =
    data.whatsappOrderingEnabled && automatedResponsesEnabled;
  const metrics = useMemo<DashboardMetricDefinition[]>(
    () => [
      {
        color: "blue",
        description: "All WhatsApp conversations currently stored in the admin inbox.",
        id: "total",
        label: "Conversations",
        value: data.metrics.total,
      },
      {
        color: "emerald",
        description: automatedResponsesActive
          ? "Open conversations with automation active and recent or available customer activity."
          : "No conversations are automated while the global response switch is off.",
        id: "active",
        label: "Active",
        value: automatedResponsesActive ? data.metrics.active : 0,
      },
      {
        color: "#ff5a1f",
        description:
          "Customers who sent a message after the latest Jurgens Energy reply.",
        id: "needs-reply",
        label: "Needs reply",
        value: data.metrics.needsReply,
      },
      {
        color: "amber",
        description:
          "Customers who did not answer an unresolved assistant prompt after the follow-up window.",
        id: "follow-up",
        label: "Follow-up",
        value: data.metrics.needsFollowUp,
      },
      {
        color: "violet",
        description:
          "Conversations where automation is paused for manual admin handling.",
        id: "manual",
        label: "Manual",
        value: data.metrics.manualHandover,
      },
      {
        color: "red",
        description: "Conversations temporarily muted after moderation rules triggered.",
        id: "muted",
        label: "Muted",
        value: data.metrics.muted,
      },
      {
        color: "slate",
        description:
          "Conversations with abuse or unknown-intent flags that may need review.",
        id: "flagged",
        label: "Flagged",
        value: data.metrics.flagged,
      },
    ],
    [automatedResponsesActive, data.metrics],
  );
  const activePage = Math.min(
    currentPage,
    Math.max(1, Math.ceil(data.conversations.length / pageSize)),
  );
  const pageConversations = data.conversations.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function updateAutomatedResponses(enabled: boolean) {
    if (isAutomationSettingPending) {
      return;
    }

    const previousValue = automatedResponsesEnabled;
    setActionFeedback(null);
    setAutomatedResponsesEnabled(enabled);

    startAutomationSettingTransition(async () => {
      try {
        const result = await setWhatsappAutomatedResponsesEnabled({ enabled });

        setActionFeedback({
          message: result.message,
          tone: result.ok ? "success" : "error",
        });

        if (result.ok) {
          router.refresh();
          return;
        }

        setAutomatedResponsesEnabled(previousValue);
      } catch {
        setAutomatedResponsesEnabled(previousValue);
        setActionFeedback({
          message: "The global automated response setting could not be updated.",
          tone: "error",
        });
      }
    });
  }

  function runConversationAction(
    conversation: AdminWhatsappConversation,
    kind: PendingConversationAction["kind"],
  ) {
    if (pendingAction) {
      return;
    }

    setActionFeedback(null);
    setPendingAction({ conversationId: conversation.id, kind });
    const action =
      kind === "follow_up"
        ? sendWhatsappFollowUp
        : conversation.isAutomationPaused || conversation.isMuted
          ? resumeWhatsappAutomation
          : pauseWhatsappAutomation;

    startActionTransition(() => {
      void action({ conversationId: conversation.id })
        .then((result) => {
          setPendingAction(null);
          setActionFeedback({
            message: result.message,
            tone: result.ok ? "success" : "error",
          });

          if (result.ok) {
            router.refresh();
          }
        })
        .catch(() => {
          setPendingAction(null);
          setActionFeedback({
            message:
              kind === "follow_up"
                ? "The WhatsApp follow-up could not be sent."
                : "The automation setting could not be updated.",
            tone: "error",
          });
        });
    });
  }

  return (
    <>
      <DashboardPageHeader
        breadcrumbs={["Orders", "WhatsApp"]}
        title="WhatsApp Conversations"
      />

      <div className="grid gap-4">
        <section
          className={cn(
            dashboardPanelClass,
            "flex min-w-0 flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between",
          )}
        >
          <div className="flex min-w-0 items-start gap-3">
            <span
              className={cn(
                "inline-flex size-9 shrink-0 items-center justify-center rounded-lg",
                automatedResponsesActive
                  ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                  : "bg-slate-100 text-slate-600 dark:bg-white/10 dark:text-zinc-300",
              )}
            >
              <BotIcon className="size-4" />
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm font-bold text-zinc-950 dark:text-white">
                  Automated WhatsApp responses
                </h2>
                <Badge
                  className={cn(
                    "rounded-md border-0",
                    automatedResponsesActive
                      ? "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300"
                      : "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
                  )}
                >
                  {automatedResponsesActive
                    ? "On"
                    : data.whatsappOrderingEnabled
                      ? "Off"
                      : "Ordering off"}
                </Badge>
              </div>
              <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 dark:text-zinc-400">
                {data.whatsappOrderingEnabled
                  ? "When off, incoming messages stay in this inbox for manual replies. The assistant and scheduled automatic follow-ups will not send; transactional order updates continue normally."
                  : "WhatsApp ordering is disabled in Platform Settings, so automated responses are inactive. Incoming messages remain available for manual handling."}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center gap-3 sm:justify-end">
            <Link
              href="/settings/platform?section=whatsapp-ordering#whatsapp-email-alerts"
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium text-zinc-900 transition hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ff5a1f] focus-visible:ring-offset-2 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:hover:bg-white/10"
            >
              Configure WhatsApp
            </Link>
            <Switch
              aria-label="Toggle automated WhatsApp responses globally"
              checked={automatedResponsesEnabled}
              disabled={
                !canManageAutomatedResponses || isAutomationSettingPending
              }
              onCheckedChange={updateAutomatedResponses}
            />
            {isAutomationSettingPending ? (
              <Loader2Icon
                aria-label="Updating automated responses"
                className="size-4 animate-spin text-slate-500"
              />
            ) : null}
          </div>
        </section>

        <DashboardCompactMetrics
          metrics={metrics}
          storageKey="jurgens:admin:whatsapp-conversation-metrics"
        />

        {actionFeedback ? (
          <div
            aria-live="polite"
            className={cn(
              "rounded-lg border px-3 py-2 text-sm",
              actionFeedback.tone === "success"
                ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-400/20 dark:bg-emerald-500/10 dark:text-emerald-100"
                : "border-red-200 bg-red-50 text-red-700 dark:border-red-400/20 dark:bg-red-500/10 dark:text-red-100",
            )}
          >
            {actionFeedback.message}
          </div>
        ) : null}

        <section
          className={cn(
            dashboardPanelClass,
            "overflow-visible",
          )}
        >
          <Table
            className={cn(
              dashboardTableClass,
              "min-w-[1080px] table-fixed md:min-w-[1080px] md:table-fixed",
            )}
          >
            <colgroup>
              <col className="w-[17%]" />
              <col className="w-[23%]" />
              <col className="w-[32%]" />
              <col className="w-[9%]" />
              <col className="w-[11%]" />
              <col className="w-[8%]" />
            </colgroup>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Customer</TableHead>
                <TableHead className={dashboardTableHeadClass}>Activity</TableHead>
                <TableHead className={dashboardTableHeadClass}>Latest message</TableHead>
                <TableHead className={dashboardTableHeadClass}>Flags</TableHead>
                <TableHead className={dashboardTableHeadClass}>Updated</TableHead>
                <TableHead className={whatsappTableActionHeadClass}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageConversations.length === 0 ? (
                <TableRow className={dashboardTableRowClass}>
                  <TableCell
                    className={cn("h-28 text-center", dashboardTableCellClass)}
                    colSpan={6}
                  >
                    <span className={dashboardTableMutedTextClass}>
                      No WhatsApp conversations have been captured yet.
                    </span>
                  </TableCell>
                </TableRow>
              ) : (
                pageConversations.map((conversation) => {
                  const latestMessage = conversation.recentMessages.at(-1);

                  return (
                    <TableRow className={dashboardTableRowClass} key={conversation.id}>
                      <TableCell className={tablePreviewCellClass}>
                        <div className="min-w-0 space-y-1">
                          <Link
                            className={cn(
                              "block truncate hover:text-[#ff5a1f]",
                              dashboardTablePrimaryTextClass,
                            )}
                            href={`/whatsapp/${conversation.id}`}
                          >
                            {conversation.customer.name ?? conversation.phone}
                          </Link>
                          <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                            {conversation.customer.email ?? conversation.phone}
                          </p>
                          <p className={cn("truncate", dashboardTableSecondaryTextClass)}>
                            {conversation.provider}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className={tablePreviewCellClass}>
                        <div className="min-w-0 space-y-2 overflow-hidden">
                          <div className="flex flex-wrap gap-1.5">
                            <ActivityBadge conversation={conversation} />
                            <AutomationBadge
                              automatedResponsesEnabled={
                                automatedResponsesActive
                              }
                              conversation={conversation}
                            />
                          </div>
                          <p className="line-clamp-2 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                            {conversation.activity.description}
                          </p>
                        </div>
                      </TableCell>
                      <TableCell className={tablePreviewCellClass}>
                        {latestMessage ? (
                          <div className="min-w-0 max-w-full space-y-1 overflow-hidden">
                            <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-400">
                              {latestMessage.direction}
                            </p>
                            <p className="line-clamp-2 break-words text-sm leading-5 text-zinc-800 dark:text-zinc-200">
                              {latestMessage.body}
                            </p>
                          </div>
                        ) : (
                          <span className={dashboardTableSecondaryTextClass}>
                            No messages yet
                          </span>
                        )}
                      </TableCell>
                      <TableCell className={tablePreviewCellClass}>
                        <div className="flex flex-wrap gap-1.5">
                          {(conversation.moderation.abuseCount ?? 0) > 0 ? (
                            <Badge className="rounded-md border-0 bg-red-500/12 text-red-700 dark:text-red-300">
                              Abuse {conversation.moderation.abuseCount}
                            </Badge>
                          ) : null}
                          {(conversation.moderation.unknownCount ?? 0) > 0 ? (
                            <Badge className="rounded-md border-0 bg-orange-500/12 text-orange-700 dark:text-orange-300">
                              Unknown {conversation.moderation.unknownCount}
                            </Badge>
                          ) : null}
                          {!conversation.moderation.abuseCount &&
                          !conversation.moderation.unknownCount ? (
                            <span className={dashboardTableSecondaryTextClass}>
                              None
                            </span>
                          ) : null}
                        </div>
                      </TableCell>
                      <TableCell className={tablePreviewCellClass}>
                        <span className={cn("block truncate", dashboardTableMutedTextClass)}>
                          {formatDate(conversation.updatedAt)}
                        </span>
                      </TableCell>
                      <TableCell className={whatsappTableActionCellClass}>
                        <ConversationQuickActions
                          automatedResponsesEnabled={automatedResponsesActive}
                          canManage={canManage}
                          conversation={conversation}
                          onSendFollowUp={(selectedConversation) =>
                            runConversationAction(selectedConversation, "follow_up")
                          }
                          onToggleAutomation={(selectedConversation) =>
                            runConversationAction(selectedConversation, "automation")
                          }
                          onViewCustomerDetails={setCustomerDetailsConversation}
                          pendingAction={pendingAction}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>

          <DashboardTablePagination
            currentPage={activePage}
            itemLabel="conversations"
            onPageChange={setCurrentPage}
            onPageSizeChange={(nextPageSize) => {
              setCurrentPage(1);
              setPageSize(nextPageSize);
            }}
            pageSize={pageSize}
            totalItems={data.conversations.length}
          />
        </section>
      </div>

      <Dialog
        open={Boolean(customerDetailsConversation)}
        onOpenChange={(open) => !open && setCustomerDetailsConversation(null)}
      >
        <DialogContent className="!w-[min(30rem,calc(100vw-2rem))] !max-w-[min(30rem,calc(100vw-2rem))] border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader>
            <DialogTitle>Customer details</DialogTitle>
            <DialogDescription>
              Order and WhatsApp activity linked to this customer.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="max-h-[min(42rem,calc(100dvh-13rem))] overflow-y-auto">
            {customerDetailsConversation ? (
              <WhatsappCustomerDetails conversation={customerDetailsConversation} />
            ) : null}
          </DialogBody>
          <DialogFooter showCloseButton />
        </DialogContent>
      </Dialog>
    </>
  );
}

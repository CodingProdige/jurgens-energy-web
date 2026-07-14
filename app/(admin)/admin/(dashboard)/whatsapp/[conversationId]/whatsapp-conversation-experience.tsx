"use client";

import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowLeftIcon,
  CheckCheckIcon,
  FileTextIcon,
  ImageIcon,
  Loader2Icon,
  MoreVerticalIcon,
  PaperclipIcon,
  RefreshCwIcon,
  SendHorizontalIcon,
  UserCheckIcon,
  XIcon,
} from "lucide-react";

import {
  clearWhatsappModeration,
  pauseWhatsappAutomation,
  resumeWhatsappAutomation,
  sendAdminWhatsappMessage,
  sendWhatsappFollowUp,
} from "@/app/(admin)/admin/(dashboard)/whatsapp/actions";
import { WhatsappCustomerDetails } from "@/app/(admin)/admin/(dashboard)/whatsapp/whatsapp-customer-details";
import { DashboardRowActionMenu } from "@/components/dashboard/dashboard-row-action-menu";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AdminWhatsappConversation,
  AdminWhatsappMessage,
  AdminWhatsappMessageAttachment,
} from "@/src/modules/admin/whatsapp";
import type {
  AdminMediaAsset,
  AdminMediaFolder,
  MediaStorageSettings,
} from "@/src/modules/media/admin";

type MediaLibrary = {
  assets: AdminMediaAsset[];
  folders: AdminMediaFolder[];
  storage: MediaStorageSettings;
  usedStorageBytes: number;
};

const timeFormatter = new Intl.DateTimeFormat("en-ZA", {
  hour: "2-digit",
  minute: "2-digit",
});
const menuItemClass =
  "flex w-full items-center gap-3 px-4 py-3 text-sm text-zinc-800 transition hover:bg-slate-50 dark:text-zinc-200 dark:hover:bg-white/10";

type ConversationActionKind = "automation" | "follow_up";

type ConversationActionFeedback = {
  message: string;
  tone: "error" | "success";
};

function formatTime(value: Date | string) {
  return timeFormatter.format(new Date(value));
}

function getAttachmentType(
  asset: AdminMediaAsset,
): AdminWhatsappMessageAttachment["type"] {
  if (asset.mimeType.startsWith("image/")) {
    return "image";
  }

  if (asset.mimeType.startsWith("video/")) {
    return "video";
  }

  return "document";
}

function ConversationStatusBadge({
  conversation,
}: {
  conversation: AdminWhatsappConversation;
}) {
  const tone =
    conversation.activity.status === "manual_handover"
      ? "bg-amber-500/14 text-amber-800 dark:text-amber-200"
      : conversation.activity.status === "muted"
        ? "bg-red-500/12 text-red-700 dark:text-red-300"
        : "bg-emerald-500/12 text-emerald-700 dark:text-emerald-300";

  return (
    <Badge className={cn("h-6 rounded-md border-0 px-2 text-xs", tone)}>
      {conversation.activity.label}
    </Badge>
  );
}

function AttachmentPreview({
  attachment,
}: {
  attachment: AdminWhatsappMessageAttachment;
}) {
  if (attachment.type === "image") {
    return (
      <a
        className="relative mb-2 block h-72 w-full overflow-hidden rounded-lg bg-black/5"
        href={attachment.url}
        target="_blank"
        rel="noreferrer"
      >
        <Image
          alt={attachment.fileName ?? "WhatsApp image attachment"}
          className="object-cover"
          fill
          sizes="(max-width: 768px) 86vw, 38rem"
          src={attachment.url}
          unoptimized
        />
      </a>
    );
  }

  if (attachment.type === "video") {
    return (
      <video
        className="mb-2 max-h-72 w-full rounded-lg bg-black"
        controls
        src={attachment.url}
      >
        <track kind="captions" />
      </video>
    );
  }

  return (
    <a
      className="mb-2 flex items-center gap-3 rounded-lg bg-black/5 p-3 text-sm text-zinc-900 transition hover:bg-black/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15"
      href={attachment.url}
      rel="noreferrer"
      target="_blank"
    >
      <FileTextIcon className="size-5 shrink-0 text-[#00a884]" />
      <span className="min-w-0 flex-1 truncate">
        {attachment.fileName ?? "Document attachment"}
      </span>
    </a>
  );
}

function ChatMessage({ message }: { message: AdminWhatsappMessage }) {
  const isInbound = message.direction === "inbound";

  return (
    <div className={cn("flex px-4", isInbound ? "justify-start" : "justify-end")}>
      <div
        className={cn(
          "max-w-[min(38rem,86%)] rounded-lg px-3 py-2 text-[14px] leading-5 shadow-sm",
          isInbound
            ? "rounded-tl-none bg-white text-[#111b21] dark:bg-[#202c33] dark:text-zinc-100"
            : "rounded-tr-none bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-white",
        )}
      >
        {message.attachment ? (
          <AttachmentPreview attachment={message.attachment} />
        ) : null}
        <p className="whitespace-pre-wrap break-words">{message.body}</p>
        <div className="mt-1 flex items-center justify-end gap-1 text-[11px] text-black/45 dark:text-white/55">
          <span>{formatTime(message.createdAt)}</span>
          {!isInbound ? <CheckCheckIcon className="size-3.5" /> : null}
        </div>
      </div>
    </div>
  );
}

function HeaderActions({
  canManage,
  conversation,
  onSendFollowUp,
  onToggleAutomation,
  pendingAction,
}: {
  canManage: boolean;
  conversation: AdminWhatsappConversation;
  onSendFollowUp: () => void;
  onToggleAutomation: () => void;
  pendingAction: ConversationActionKind | null;
}) {
  if (!canManage) {
    return null;
  }

  return (
    <DashboardRowActionMenu
      ariaLabel="Open conversation actions"
      className="w-60"
      trigger={
        pendingAction ? (
          <Loader2Icon className="size-5 animate-spin" />
        ) : (
          <MoreVerticalIcon className="size-5" />
        )
      }
      triggerClassName="rounded-full text-[#54656f] hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
    >
      <button
        className={cn(
          menuItemClass,
          "disabled:cursor-wait disabled:opacity-60",
        )}
        disabled={Boolean(pendingAction)}
        onClick={onToggleAutomation}
        type="button"
      >
        {pendingAction === "automation" ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : conversation.isAutomationPaused || conversation.isMuted ? (
          <RefreshCwIcon className="size-4" />
        ) : (
          <UserCheckIcon className="size-4" />
        )}
        {pendingAction === "automation"
          ? "Updating automation..."
          : conversation.isAutomationPaused || conversation.isMuted
            ? "Resume automation"
            : "Manual handover"}
      </button>
      <button
        className={cn(
          menuItemClass,
          "items-start disabled:cursor-not-allowed disabled:opacity-60",
        )}
        disabled={Boolean(pendingAction) || !conversation.followUp.canSend}
        onClick={onSendFollowUp}
        title={conversation.followUp.unavailableReason ?? undefined}
        type="button"
      >
        {pendingAction === "follow_up" ? (
          <Loader2Icon className="mt-0.5 size-4 animate-spin" />
        ) : (
          <SendHorizontalIcon className="mt-0.5 size-4" />
        )}
        <span className="min-w-0 text-left">
          <span className="block">
            {pendingAction === "follow_up"
              ? "Sending follow-up..."
              : "Send follow-up"}
          </span>
          {!conversation.followUp.canSend &&
          conversation.followUp.unavailableReason ? (
            <span className="mt-0.5 block text-xs leading-4 text-slate-500 dark:text-zinc-400">
              {conversation.followUp.unavailableReason}
            </span>
          ) : null}
        </span>
      </button>
      <form action={clearWhatsappModeration}>
        <input name="conversationId" type="hidden" value={conversation.id} />
        <button className={menuItemClass} type="submit">
          <XIcon className="size-4" />
          Clear flags
        </button>
      </form>
    </DashboardRowActionMenu>
  );
}

export function AdminWhatsappConversationExperience({
  canManage,
  conversation,
  mediaLibrary,
}: {
  canManage: boolean;
  conversation: AdminWhatsappConversation;
  mediaLibrary: MediaLibrary;
}) {
  const router = useRouter();
  const [isCustomerDetailsOpen, setIsCustomerDetailsOpen] = useState(false);
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const [selectedAttachment, setSelectedAttachment] =
    useState<AdminWhatsappMessageAttachment | null>(null);
  const [actionFeedback, setActionFeedback] =
    useState<ConversationActionFeedback | null>(null);
  const [pendingAction, setPendingAction] =
    useState<ConversationActionKind | null>(null);
  const [, startActionTransition] = useTransition();
  const customerLabel = conversation.customer.name ?? conversation.phone;
  const selectedAttachmentIcon = useMemo(() => {
    if (!selectedAttachment) {
      return null;
    }

    return selectedAttachment.type === "document" ? FileTextIcon : ImageIcon;
  }, [selectedAttachment]);
  const SelectedAttachmentIcon = selectedAttachmentIcon;

  function runConversationAction(kind: ConversationActionKind) {
    if (pendingAction) {
      return;
    }

    setActionFeedback(null);
    setPendingAction(kind);
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
    <div className="grid gap-3">
      <Link
        className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-zinc-800 shadow-sm transition hover:bg-slate-50 dark:border-white/10 dark:bg-[#151719] dark:text-zinc-200 dark:hover:bg-white/10"
        href="/whatsapp"
      >
        <ArrowLeftIcon className="size-4" />
        Back to WhatsApp
      </Link>

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

      <section className="h-[calc(100dvh-9rem)] min-h-[42rem] overflow-hidden rounded-xl border border-slate-300 bg-[#efeae2] shadow-sm dark:border-white/10 dark:bg-[#0b141a]">
        <div
          className={cn(
            "grid h-full min-h-0 min-w-0",
            isCustomerDetailsOpen
              ? "xl:grid-cols-[minmax(0,1fr)_24rem]"
              : "grid-cols-1",
          )}
        >
          <div className="flex min-h-0 min-w-0 flex-col overflow-hidden">
            <header className="flex min-h-16 shrink-0 items-center justify-between gap-3 border-b border-black/5 bg-[#f0f2f5] px-4 dark:border-white/10 dark:bg-[#202c33]">
              <button
                className="flex min-w-0 flex-1 items-center gap-3 text-left"
                onClick={() => setIsCustomerDetailsOpen(true)}
                type="button"
              >
                <div className="grid size-10 shrink-0 place-items-center rounded-full bg-[#00a884] text-sm font-semibold text-white">
                  {customerLabel.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <p className="truncate text-sm font-semibold text-[#111b21] dark:text-white">
                      {customerLabel}
                    </p>
                    <ConversationStatusBadge conversation={conversation} />
                  </div>
                  <p className="truncate text-xs text-[#667781] dark:text-zinc-400">
                    {conversation.phone} · {conversation.activity.description}
                  </p>
                </div>
              </button>
              <HeaderActions
                canManage={canManage}
                conversation={conversation}
                onSendFollowUp={() => runConversationAction("follow_up")}
                onToggleAutomation={() => runConversationAction("automation")}
                pendingAction={pendingAction}
              />
            </header>

            <div className="relative min-h-0 flex-1 overflow-y-auto bg-[radial-gradient(circle_at_1px_1px,rgba(17,27,33,0.08)_1px,transparent_0)] [background-size:22px_22px]">
              <div className="grid gap-2 py-5">
                {conversation.recentMessages.length === 0 ? (
                  <div className="mx-auto mt-20 rounded-lg bg-white/88 px-4 py-3 text-center text-sm text-slate-600 shadow-sm dark:bg-[#202c33] dark:text-zinc-300">
                    No messages have been stored for this conversation yet.
                  </div>
                ) : (
                  conversation.recentMessages.map((message) => (
                    <ChatMessage key={message.id} message={message} />
                  ))
                )}
              </div>
            </div>

            <form
              action={sendAdminWhatsappMessage}
              className="shrink-0 border-t border-black/5 bg-[#f0f2f5] p-3 dark:border-white/10 dark:bg-[#202c33]"
            >
              <input name="conversationId" type="hidden" value={conversation.id} />
              {selectedAttachment ? (
                <>
                  <input
                    name="attachmentAssetId"
                    type="hidden"
                    value={selectedAttachment.assetId ?? ""}
                  />
                  <input
                    name="attachmentFileName"
                    type="hidden"
                    value={selectedAttachment.fileName ?? ""}
                  />
                  <input
                    name="attachmentMimeType"
                    type="hidden"
                    value={selectedAttachment.mimeType}
                  />
                  <input
                    name="attachmentType"
                    type="hidden"
                    value={selectedAttachment.type}
                  />
                  <input
                    name="attachmentUrl"
                    type="hidden"
                    value={selectedAttachment.url}
                  />
                </>
              ) : null}

              {selectedAttachment ? (
                <div className="mb-2 flex items-center gap-2 rounded-xl bg-white px-3 py-2 text-sm text-[#111b21] shadow-sm dark:bg-[#111b21] dark:text-white">
                  {SelectedAttachmentIcon ? (
                    <SelectedAttachmentIcon className="size-4 text-[#00a884]" />
                  ) : null}
                  <span className="min-w-0 flex-1 truncate">
                    {selectedAttachment.fileName ?? "Selected attachment"}
                  </span>
                  <button
                    aria-label="Remove attachment"
                    className="rounded-full p-1 text-slate-500 hover:bg-black/5 dark:text-zinc-400 dark:hover:bg-white/10"
                    onClick={() => setSelectedAttachment(null)}
                    type="button"
                  >
                    <XIcon className="size-4" />
                  </button>
                </div>
              ) : null}

              <div className="flex items-end gap-2">
                <Button
                  aria-label="Attach media or document"
                  className="size-11 rounded-full border-0 bg-transparent text-[#54656f] shadow-none hover:bg-black/5 dark:text-zinc-300 dark:hover:bg-white/10"
                  disabled={!canManage}
                  onClick={() => setIsMediaManagerOpen(true)}
                  type="button"
                  variant="ghost"
                >
                  <PaperclipIcon className="size-5" />
                </Button>
                <Textarea
                  className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border-0 bg-white px-4 py-3 text-sm text-[#111b21] shadow-none placeholder:text-[#667781] focus-visible:ring-2 focus-visible:ring-[#00a884]/25 dark:bg-[#2a3942] dark:text-white"
                  disabled={!canManage}
                  name="body"
                  placeholder={
                    canManage
                      ? "Type a message"
                      : "You need manage permission to reply"
                  }
                />
                <Button
                  aria-label="Send WhatsApp message"
                  className="size-11 rounded-full bg-[#00a884] text-white shadow-none hover:bg-[#008f72]"
                  disabled={!canManage}
                  type="submit"
                >
                  <SendHorizontalIcon className="size-5" />
                </Button>
              </div>
            </form>
          </div>

          {isCustomerDetailsOpen ? (
            <>
              <button
                aria-label="Close customer details"
                className="fixed inset-0 z-40 bg-black/30 xl:hidden"
                onClick={() => setIsCustomerDetailsOpen(false)}
                type="button"
              />
              <aside className="fixed bottom-0 right-0 top-0 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col border-l border-slate-200 bg-white shadow-2xl dark:border-white/10 dark:bg-[#111b21] xl:static xl:z-auto xl:w-auto xl:shadow-none">
                <div className="flex min-h-16 items-center gap-3 border-b border-slate-200 px-4 dark:border-white/10">
                  <button
                    aria-label="Close customer details"
                    className="rounded-full p-2 text-slate-500 hover:bg-slate-100 dark:text-zinc-400 dark:hover:bg-white/10"
                    onClick={() => setIsCustomerDetailsOpen(false)}
                    type="button"
                  >
                    <XIcon className="size-5" />
                  </button>
                  <p className="text-sm font-semibold text-zinc-950 dark:text-white">
                    Contact info
                  </p>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto p-4">
                  <WhatsappCustomerDetails conversation={conversation} />
                </div>
              </aside>
            </>
          ) : null}
        </div>
      </section>

      <MediaManagerDialog
        acceptedMediaTypes={["image", "video", "document"]}
        assets={mediaLibrary.assets}
        folders={mediaLibrary.folders}
        onOpenChange={setIsMediaManagerOpen}
        onSelect={(asset) => {
          setSelectedAttachment({
            assetId: asset.id,
            fileName: asset.originalFileName,
            mimeType: asset.mimeType,
            type: getAttachmentType(asset),
            url: asset.publicUrl,
          });
          setIsMediaManagerOpen(false);
        }}
        open={isMediaManagerOpen}
        selectedAssetId={selectedAttachment?.assetId ?? undefined}
        storage={mediaLibrary.storage}
        surface="admin"
        title="Attach media or document"
        usedStorageBytes={mediaLibrary.usedStorageBytes}
      />
    </div>
  );
}

"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckCircle2Icon,
  Edit3Icon,
  ImageIcon,
  MailIcon,
  MessageCircleIcon,
  PhoneIcon,
  PlusIcon,
  Trash2Icon,
  UserRoundIcon,
  XIcon,
} from "lucide-react";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
  useTransition,
} from "react";

import {
  deleteSupportAgentAction,
  reorderSupportAgentsAction,
  saveSupportAgentAction,
  type SupportAgentMutationState,
} from "@/app/(admin)/admin/(dashboard)/settings/platform/support-team/actions";
import {
  DashboardButton,
  dashboardPanelClass,
} from "@/components/dashboard/dashboard-controls";
import { MediaManagerDialog } from "@/components/media/media-manager-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type {
  AdminMediaAsset,
  AdminMediaFolder,
  MediaStorageSettings,
} from "@/src/modules/media/admin";
import type { AdminSupportAgent } from "@/src/modules/support-agents/server";

const initialMutationState: SupportAgentMutationState = {};

export type SupportAgentMediaLibrary = {
  assets: AdminMediaAsset[];
  folders: AdminMediaFolder[];
  storage: MediaStorageSettings;
  totalAssetCount: number;
  usedStorageBytes: number;
};

type SupportAgentManagerProps = {
  agents: AdminSupportAgent[];
  canManage: boolean;
  mediaLibrary?: SupportAgentMediaLibrary | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function MutationMessage({ state }: { state: SupportAgentMutationState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      aria-live="polite"
      className={cn(
        "rounded-lg border px-3 py-2 text-sm leading-5",
        state.ok
          ? "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200"
          : "border-red-200 bg-red-50 text-red-800 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-200",
      )}
    >
      {state.message}
    </p>
  );
}

function PlacementCheckbox({
  defaultChecked,
  description,
  disabled,
  label,
  name,
}: {
  defaultChecked: boolean;
  description: string;
  disabled: boolean;
  label: string;
  name: string;
}) {
  return (
    <label className="flex min-w-0 items-start gap-3 rounded-lg border border-slate-200 p-3 dark:border-white/10">
      <input
        className="mt-0.5 size-4 shrink-0 accent-[#ff5a1f]"
        defaultChecked={defaultChecked}
        disabled={disabled}
        name={name}
        type="checkbox"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-900 dark:text-white">
          {label}
        </span>
        <span className="mt-0.5 block text-xs leading-5 text-slate-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </label>
  );
}

function AgentEditorDialog({
  agent,
  canManage,
  mediaLibrary,
  onOpenChange,
  onSaved,
  open,
}: {
  agent: AdminSupportAgent | null;
  canManage: boolean;
  mediaLibrary?: SupportAgentMediaLibrary | null;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  open: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    saveSupportAgentAction,
    initialMutationState,
  );
  const currentPhotoAsset = useMemo(
    () =>
      mediaLibrary?.assets.find((asset) => asset.id === agent?.photoMediaId) ??
      null,
    [agent?.photoMediaId, mediaLibrary?.assets],
  );
  const [selectedPhoto, setSelectedPhoto] = useState<AdminMediaAsset | null>(
    currentPhotoAsset,
  );
  const [keepExistingPhoto, setKeepExistingPhoto] = useState(
    Boolean(agent?.photoMediaId),
  );
  const [mediaOpen, setMediaOpen] = useState(false);
  const selectedPhotoId =
    selectedPhoto?.id ?? (keepExistingPhoto ? agent?.photoMediaId : null) ?? "";
  const photoUrl =
    selectedPhoto?.thumbnailUrl ??
    selectedPhoto?.publicUrl ??
    (keepExistingPhoto ? agent?.photoUrl : null);

  useEffect(() => {
    if (state.ok) {
      onSaved();
    }
  }, [onSaved, state.ok]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
        <form
          action={formAction}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <DialogHeader>
            <DialogTitle>{agent ? "Edit support agent" : "Add support agent"}</DialogTitle>
            <DialogDescription>
              Only the details entered here can appear publicly. Internal staff
              profile details and login emails are never used as fallbacks.
            </DialogDescription>
          </DialogHeader>

          <DialogBody className="grid gap-5">
            {agent ? <input name="id" type="hidden" value={agent.id} /> : null}
            <input name="photoMediaId" type="hidden" value={selectedPhotoId} />

            <div className="grid gap-3 sm:grid-cols-[7rem_minmax(0,1fr)] sm:items-center">
              <div className="relative size-28 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-white/[0.06]">
                {photoUrl ? (
                  <Image
                    alt={`${agent?.displayName ?? "Support agent"} profile`}
                    className="object-cover"
                    fill
                    sizes="112px"
                    src={photoUrl}
                  />
                ) : (
                  <span className="grid size-full place-items-center text-slate-400 dark:text-zinc-500">
                    <UserRoundIcon className="size-10" strokeWidth={1.5} />
                  </span>
                )}
              </div>
              <div className="min-w-0">
                <Label>Public profile photo</Label>
                <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                  Select a public image. A branded initials tile is shown if no
                  photo is configured.
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DashboardButton
                    disabled={!canManage || !mediaLibrary}
                    onClick={() => setMediaOpen(true)}
                    type="button"
                  >
                    <ImageIcon className="size-4" />
                    {photoUrl ? "Change photo" : "Choose photo"}
                  </DashboardButton>
                  {selectedPhotoId ? (
                    <Button
                      className="h-9 gap-2"
                      disabled={!canManage}
                      onClick={() => {
                        setSelectedPhoto(null);
                        setKeepExistingPhoto(false);
                      }}
                      type="button"
                      variant="outline"
                    >
                      <XIcon className="size-4" />
                      Remove
                    </Button>
                  ) : null}
                </div>
                {!mediaLibrary ? (
                  <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">
                    Pass the admin media library to this component to enable photo selection.
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1.5">
                <Label htmlFor="support-agent-display-name">
                  Display name <span className="text-red-600">*</span>
                </Label>
                <Input
                  defaultValue={agent?.displayName ?? ""}
                  disabled={!canManage}
                  id="support-agent-display-name"
                  maxLength={160}
                  name="displayName"
                  placeholder="e.g. Dillon Jurgens"
                  required
                />
              </label>
              <label className="grid min-w-0 gap-1.5">
                <Label htmlFor="support-agent-role-title">Role or title</Label>
                <Input
                  defaultValue={agent?.roleTitle ?? ""}
                  disabled={!canManage}
                  id="support-agent-role-title"
                  maxLength={160}
                  name="roleTitle"
                  placeholder="e.g. Customer Support"
                />
              </label>
            </div>

            <label className="grid min-w-0 gap-1.5">
              <Label htmlFor="support-agent-bio">Public biography</Label>
              <Textarea
                className="min-h-28 resize-y"
                defaultValue={agent?.bio ?? ""}
                disabled={!canManage}
                id="support-agent-bio"
                maxLength={1_200}
                name="bio"
                placeholder="A concise introduction and the areas this person can help with."
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="grid min-w-0 gap-1.5">
                <Label htmlFor="support-agent-email">Public email</Label>
                <div className="relative">
                  <MailIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    defaultValue={agent?.publicEmail ?? ""}
                    disabled={!canManage}
                    id="support-agent-email"
                    maxLength={254}
                    name="publicEmail"
                    placeholder="support@company.co.za"
                    type="email"
                  />
                </div>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <Label htmlFor="support-agent-phone">Public phone</Label>
                <div className="relative">
                  <PhoneIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    defaultValue={agent?.publicPhone ?? ""}
                    disabled={!canManage}
                    id="support-agent-phone"
                    maxLength={40}
                    name="publicPhone"
                    placeholder="+27 00 000 0000"
                    type="tel"
                  />
                </div>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <Label htmlFor="support-agent-whatsapp">Public WhatsApp</Label>
                <div className="relative">
                  <MessageCircleIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    className="pl-9"
                    defaultValue={agent?.publicWhatsapp ?? ""}
                    disabled={!canManage}
                    id="support-agent-whatsapp"
                    maxLength={40}
                    name="publicWhatsapp"
                    placeholder="+27 00 000 0000"
                    type="tel"
                  />
                </div>
              </label>
              <label className="grid min-w-0 gap-1.5">
                <Label htmlFor="support-agent-availability">Availability</Label>
                <Input
                  defaultValue={agent?.availability ?? ""}
                  disabled={!canManage}
                  id="support-agent-availability"
                  maxLength={240}
                  name="availability"
                  placeholder="Mon–Fri, 08:00–17:00 SAST"
                />
              </label>
            </div>

            <fieldset className="grid gap-3">
              <legend className="text-sm font-semibold">Public placement</legend>
              <div className="grid gap-3 sm:grid-cols-3">
                <PlacementCheckbox
                  defaultChecked={agent?.showInFooter ?? false}
                  description="Show a compact contact card in the website footer."
                  disabled={!canManage}
                  label="Footer"
                  name="showInFooter"
                />
                <PlacementCheckbox
                  defaultChecked={agent?.showOnAbout ?? false}
                  description="Show the full profile on the About page."
                  disabled={!canManage}
                  label="About page"
                  name="showOnAbout"
                />
                <PlacementCheckbox
                  defaultChecked={agent?.showOnSupport ?? false}
                  description="Show the full profile in the Support centre."
                  disabled={!canManage}
                  label="Support page"
                  name="showOnSupport"
                />
              </div>
            </fieldset>

            <label className="flex min-w-0 items-start gap-3 rounded-lg border border-[#ff5a1f]/25 bg-[#fff6f1] p-4 dark:bg-[#ff5a1f]/[0.07]">
              <input
                className="mt-0.5 size-4 shrink-0 accent-[#ff5a1f]"
                defaultChecked={agent?.isPublished ?? false}
                disabled={!canManage}
                name="isPublished"
                type="checkbox"
              />
              <span className="min-w-0">
                <span className="block text-sm font-semibold">Published</span>
                <span className="mt-0.5 block text-xs leading-5 text-slate-600 dark:text-zinc-300">
                  The agent only appears publicly when published and enabled for
                  the relevant placement.
                </span>
              </span>
            </label>

            <MutationMessage state={state} />
          </DialogBody>

          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button disabled={!canManage || isPending} type="submit">
              {isPending ? "Saving..." : agent ? "Save agent" : "Add agent"}
            </Button>
          </DialogFooter>
        </form>

        {mediaLibrary ? (
          <MediaManagerDialog
            acceptedMediaTypes={["image"]}
            assets={mediaLibrary.assets}
            folders={mediaLibrary.folders}
            onOpenChange={setMediaOpen}
            onSelect={(asset) => {
              setSelectedPhoto(asset);
              setKeepExistingPhoto(false);
              setMediaOpen(false);
            }}
            open={mediaOpen}
            selectedAssetId={selectedPhotoId || null}
            storage={mediaLibrary.storage}
            surface="admin"
            title="Choose support-agent photo"
            totalAssetCount={mediaLibrary.totalAssetCount}
            usedStorageBytes={mediaLibrary.usedStorageBytes}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function DeleteAgentDialog({
  agent,
  onDeleted,
  onOpenChange,
  open,
}: {
  agent: AdminSupportAgent;
  onDeleted: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [state, formAction, isPending] = useActionState(
    deleteSupportAgentAction,
    initialMutationState,
  );

  useEffect(() => {
    if (state.ok) {
      onDeleted();
    }
  }, [onDeleted, state.ok]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Remove public support agent?</DialogTitle>
            <DialogDescription>
              This removes {agent.displayName} from the managed public directory.
              It does not delete an internal staff account.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <input name="id" type="hidden" value={agent.id} />
            <MutationMessage state={state} />
          </DialogBody>
          <DialogFooter>
            <Button
              disabled={isPending}
              onClick={() => onOpenChange(false)}
              type="button"
              variant="outline"
            >
              Keep agent
            </Button>
            <Button
              className="bg-red-600 text-white hover:bg-red-700"
              disabled={isPending}
              type="submit"
            >
              <Trash2Icon className="size-4" />
              {isPending ? "Removing..." : "Remove agent"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function AgentAvatar({ agent }: { agent: AdminSupportAgent }) {
  return (
    <span className="relative grid size-14 shrink-0 place-items-center overflow-hidden rounded-xl bg-gradient-to-br from-[#ff5a1f] to-[#ffb000] text-base font-black text-white">
      {agent.photoUrl ? (
        <Image
          alt={`${agent.displayName} profile`}
          className="object-cover"
          fill
          sizes="56px"
          src={agent.photoUrl}
        />
      ) : (
        initials(agent.displayName) || <UserRoundIcon className="size-5" />
      )}
    </span>
  );
}

export function SupportAgentManager({
  agents,
  canManage,
  mediaLibrary,
}: SupportAgentManagerProps) {
  const router = useRouter();
  const [orderedAgents, setOrderedAgents] = useState(agents);
  const [editingAgent, setEditingAgent] = useState<AdminSupportAgent | null>(null);
  const [deletingAgent, setDeletingAgent] = useState<AdminSupportAgent | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [reorderState, setReorderState] = useState<SupportAgentMutationState>({});
  const [isReordering, startReordering] = useTransition();

  useEffect(() => {
    setOrderedAgents(agents);
  }, [agents]);

  function refreshAfterMutation() {
    setEditingAgent(null);
    setDeletingAgent(null);
    setIsAdding(false);
    router.refresh();
  }

  function moveAgent(index: number, direction: -1 | 1) {
    const destination = index + direction;

    if (
      !canManage ||
      destination < 0 ||
      destination >= orderedAgents.length ||
      isReordering
    ) {
      return;
    }

    const previousAgents = orderedAgents;
    const nextAgents = [...orderedAgents];
    [nextAgents[index], nextAgents[destination]] = [
      nextAgents[destination]!,
      nextAgents[index]!,
    ];
    setOrderedAgents(nextAgents);
    setReorderState({});

    startReordering(async () => {
      const result = await reorderSupportAgentsAction(
        nextAgents.map((agent) => agent.id),
      );
      setReorderState(result);

      if (!result.ok) {
        setOrderedAgents(previousAgents);
        return;
      }

      router.refresh();
    });
  }

  return (
    <section className={cn(dashboardPanelClass, "min-w-0 p-5 sm:p-6")}>
      <div className="flex min-w-0 flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-lg font-bold text-zinc-950 dark:text-white">
            Public support team
          </h2>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600 dark:text-zinc-300">
            Manage deliberate public profiles independently from internal staff
            accounts. Choose exactly where each published agent appears.
          </p>
        </div>
        <Button
          className="w-full shrink-0 gap-2 sm:w-auto"
          disabled={!canManage}
          onClick={() => setIsAdding(true)}
          type="button"
        >
          <PlusIcon className="size-4" />
          Add agent
        </Button>
      </div>

      {!canManage ? (
        <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
          You can review public support agents, but managing them requires the
          settings-management capability.
        </p>
      ) : null}

      <div className="mt-5 grid gap-3">
        {orderedAgents.length === 0 ? (
          <div className="grid min-h-40 place-items-center rounded-xl border border-dashed border-slate-300 px-5 text-center dark:border-white/15">
            <div>
              <UserRoundIcon className="mx-auto size-8 text-slate-400" />
              <p className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">
                No public support agents yet
              </p>
              <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-zinc-400">
                Add a deliberate public profile; internal staff details are never
                published automatically.
              </p>
            </div>
          </div>
        ) : (
          orderedAgents.map((agent, index) => {
            const placements = [
              agent.showInFooter ? "Footer" : null,
              agent.showOnAbout ? "About" : null,
              agent.showOnSupport ? "Support" : null,
            ].filter((placement): placement is string => Boolean(placement));

            return (
              <article
                className="flex min-w-0 flex-col gap-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-white/10 dark:bg-white/[0.025] lg:flex-row lg:items-center"
                key={agent.id}
              >
                <div className="flex min-w-0 flex-1 items-start gap-3">
                  <AgentAvatar agent={agent} />
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h3 className="truncate text-sm font-bold text-zinc-950 dark:text-white">
                        {agent.displayName}
                      </h3>
                      <Badge variant={agent.isPublished ? "default" : "secondary"}>
                        {agent.isPublished ? "Published" : "Draft"}
                      </Badge>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500 dark:text-zinc-400">
                      {agent.roleTitle ?? "No public role configured"}
                    </p>
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {placements.length > 0 ? (
                        placements.map((placement) => (
                          <Badge key={placement} variant="outline">
                            {placement}
                          </Badge>
                        ))
                      ) : (
                        <span className="text-xs text-amber-700 dark:text-amber-300">
                          No public placement selected
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2 lg:justify-end">
                  <Button
                    aria-label={`Move ${agent.displayName} up`}
                    className="size-9 p-0"
                    disabled={!canManage || index === 0 || isReordering}
                    onClick={() => moveAgent(index, -1)}
                    type="button"
                    variant="outline"
                  >
                    <ArrowUpIcon className="size-4" />
                  </Button>
                  <Button
                    aria-label={`Move ${agent.displayName} down`}
                    className="size-9 p-0"
                    disabled={
                      !canManage ||
                      index === orderedAgents.length - 1 ||
                      isReordering
                    }
                    onClick={() => moveAgent(index, 1)}
                    type="button"
                    variant="outline"
                  >
                    <ArrowDownIcon className="size-4" />
                  </Button>
                  <Button
                    className="h-9 gap-2"
                    disabled={!canManage}
                    onClick={() => setEditingAgent(agent)}
                    type="button"
                    variant="outline"
                  >
                    <Edit3Icon className="size-4" />
                    Edit
                  </Button>
                  <Button
                    aria-label={`Remove ${agent.displayName}`}
                    className="size-9 p-0 text-red-600 hover:text-red-700"
                    disabled={!canManage}
                    onClick={() => setDeletingAgent(agent)}
                    type="button"
                    variant="outline"
                  >
                    <Trash2Icon className="size-4" />
                  </Button>
                </div>
              </article>
            );
          })
        )}
      </div>

      {reorderState.message ? (
        <div className="mt-4 flex items-center gap-2">
          {reorderState.ok ? (
            <CheckCircle2Icon className="size-4 text-emerald-600" />
          ) : null}
          <MutationMessage state={reorderState} />
        </div>
      ) : null}

      {isAdding ? (
        <AgentEditorDialog
          agent={null}
          canManage={canManage}
          key="add-support-agent"
          mediaLibrary={mediaLibrary}
          onOpenChange={setIsAdding}
          onSaved={refreshAfterMutation}
          open
        />
      ) : null}
      {editingAgent ? (
        <AgentEditorDialog
          agent={editingAgent}
          canManage={canManage}
          key={editingAgent.id}
          mediaLibrary={mediaLibrary}
          onOpenChange={(open) => {
            if (!open) {
              setEditingAgent(null);
            }
          }}
          onSaved={refreshAfterMutation}
          open
        />
      ) : null}
      {deletingAgent ? (
        <DeleteAgentDialog
          agent={deletingAgent}
          key={deletingAgent.id}
          onDeleted={refreshAfterMutation}
          onOpenChange={(open) => {
            if (!open) {
              setDeletingAgent(null);
            }
          }}
          open
        />
      ) : null}
    </section>
  );
}

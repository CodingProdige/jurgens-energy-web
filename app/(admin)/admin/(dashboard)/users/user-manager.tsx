"use client";

import { useActionState, useEffect, useMemo, useState } from "react";
import {
  DownloadIcon,
  Edit3Icon,
  FilterIcon,
  ImageIcon,
  KeyRoundIcon,
  Trash2Icon,
  UserRoundIcon,
  SearchIcon,
  XIcon,
} from "lucide-react";

import {
  sendAdminUserPasswordReset,
  setAdminUserActive,
  updateAdminUserProfile,
  type UserMutationState,
} from "@/app/(admin)/admin/(dashboard)/users/actions";
import {
  DashboardButton,
  DashboardInput,
  DashboardPageHeader,
  DashboardTablePagination,
  dashboardPanelClass,
  dashboardTableActionCellClass,
  dashboardTableActionHeadClass,
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
import {
  DashboardCompactMetrics,
  type DashboardMetricDefinition,
} from "@/components/dashboard/dashboard-compact-metrics";
import { DashboardRowActionMenu } from "@/components/dashboard/dashboard-row-action-menu";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import type { PlatformRole } from "@/src/db/schema";
import type {
  AdminMediaAsset,
  AdminMediaFolder,
  MediaStorageSettings,
} from "@/src/modules/media/admin";
import type { AdminUser, AdminUsersData } from "@/src/modules/users/admin";

type UserPageKind = "admins" | "all" | "customers" | "sellers";
type UserManagerProps = AdminUsersData & {
  canManage: boolean;
  mediaLibrary: {
    assets: AdminMediaAsset[];
    folders: AdminMediaFolder[];
    storage: MediaStorageSettings;
    usedStorageBytes: number;
  };
  page: UserPageKind;
};

type RoleFilter = "all" | PlatformRole | "admins" | "sellers" | "no-role";
type StatusFilter = "all" | "active" | "inactive";

const roleLabels: Record<PlatformRole, string> = {
  admin: "Admin",
  customer: "Customer",
  seller_owner: "Seller owner",
  seller_staff: "Seller staff",
  superadmin: "Superadmin",
};
const roleFilterLabels: Record<RoleFilter, string> = {
  ...roleLabels,
  admins: "Admin access",
  all: "All roles",
  "no-role": "No role",
  sellers: "Seller access",
};

const userPageLabels: Record<UserPageKind, string> = {
  admins: "Admins",
  all: "All users",
  customers: "Customers",
  sellers: "Sellers",
};

const roleBadgeClass: Record<PlatformRole, string> = {
  admin: "bg-amber-100 text-amber-800 dark:bg-amber-400/15 dark:text-amber-200",
  customer:
    "bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-zinc-300",
  seller_owner:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
  seller_staff:
    "bg-teal-100 text-teal-800 dark:bg-teal-400/15 dark:text-teal-200",
  superadmin:
    "bg-[#fbe694] text-[#5d4711] dark:bg-[#fbe694]/20 dark:text-[#fbe694]",
};
const modalSelectClass =
  "h-10 rounded-lg border border-slate-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-[#c4982d] focus:ring-4 focus:ring-[#c4982d]/10 dark:border-white/18 dark:bg-[#151719] dark:text-white";
const modalSelectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const modalSelectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";
const modalContentClass =
  "max-w-xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white";
const modalFieldClass =
  "h-10 border-slate-300 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-[#c4982d] focus-visible:ring-[#c4982d]/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const modalLabelClass = "text-sm font-semibold text-zinc-900 dark:text-white";
const initialUserMutationState: UserMutationState = {};

function formatDate(date: Date) {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeCsvValue(value: string | number | null) {
  if (value === null) {
    return "";
  }

  const text = String(value);

  if (/[",\n\r]/.test(text)) {
    return `"${text.replaceAll('"', '""')}"`;
  }

  return text;
}

function getInitials(user: AdminUser) {
  const source = user.name?.trim() || user.email;
  const words = source.split(/\s+/).filter(Boolean);

  if (words.length >= 2) {
    return `${words[0][0] ?? ""}${words[1][0] ?? ""}`.toUpperCase();
  }

  return source.slice(0, 2).toUpperCase();
}

function getDisplayName(user: AdminUser) {
  return user.name?.trim() || "Unnamed user";
}

function RoleBadges({ roles }: { roles: PlatformRole[] }) {
  if (roles.length === 0) {
    return (
      <Badge className="h-6 rounded-md border-0 bg-zinc-100 px-2 text-xs font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-400">
        No role
      </Badge>
    );
  }

  const [primaryRole, ...secondaryRoles] = roles;

  if (!primaryRole) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge
        className={cn(
          "h-6 rounded-md border-0 px-2 text-xs font-semibold",
          roleBadgeClass[primaryRole],
        )}
      >
        {roleLabels[primaryRole]}
      </Badge>
      {secondaryRoles.length > 0 ? (
        <span className="group/roles relative inline-flex">
          <Badge
            className="h-6 cursor-default rounded-md border-0 bg-zinc-100 px-2 text-xs font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300"
            tabIndex={0}
          >
            +{secondaryRoles.length}
          </Badge>
          <span className="pointer-events-none absolute left-full top-1/2 z-40 ml-2 hidden -translate-y-1/2 items-center gap-1.5 rounded-lg border border-slate-200 bg-white p-1.5 shadow-xl group-hover/roles:flex group-focus-within/roles:flex dark:border-white/10 dark:bg-[#151719]">
            {secondaryRoles.map((role) => (
              <Badge
                key={role}
                className={cn(
                  "h-6 rounded-md border-0 px-2 text-xs font-semibold",
                  roleBadgeClass[role],
                )}
              >
                {roleLabels[role]}
              </Badge>
            ))}
          </span>
        </span>
      ) : null}
    </div>
  );
}

function UserAvatar({
  className,
  image,
  user,
}: {
  className?: string;
  image?: string | null;
  user: AdminUser;
}) {
  const initials = getInitials(user);
  const imageUrl = image ?? user.image;

  if (imageUrl) {
    return (
      <div
        aria-label={`${getDisplayName(user)} profile picture`}
        className={cn(
          "shrink-0 rounded-full border border-[#fbe694]/70 bg-cover bg-center bg-no-repeat shadow-sm dark:border-[#fbe694]/25",
          className,
        )}
        role="img"
        style={{ backgroundImage: `url("${imageUrl}")` }}
      />
    );
  }

  return (
    <div
      className={cn(
        "flex shrink-0 items-center justify-center rounded-full bg-[#fbe694] text-xs font-bold text-[#5d4711] dark:bg-[#fbe694]/20 dark:text-[#fbe694]",
        className,
      )}
    >
      {initials}
    </div>
  );
}

function ProviderBadge({
  hasPassword,
  providers,
}: {
  hasPassword: boolean;
  providers: string[];
}) {
  const uniqueProviders = Array.from(
    new Set([...providers, ...(hasPassword ? ["password"] : [])]),
  );

  if (uniqueProviders.length === 0) {
    return <span className={dashboardTableMutedTextClass}>None</span>;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {uniqueProviders.map((provider) =>
        provider === "google" ? (
          <span
            key={provider}
            className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm dark:border-white/12 dark:bg-white"
            aria-label="Google"
            title="Google"
          >
            <svg
              aria-hidden="true"
              className="size-4"
              viewBox="0 0 24 24"
            >
              <path
                fill="#4285F4"
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
              />
              <path
                fill="#34A853"
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.24 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              />
              <path
                fill="#FBBC05"
                d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l3.66-2.84z"
              />
              <path
                fill="#EA4335"
                d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06L5.84 9.9C6.71 7.3 9.14 5.38 12 5.38z"
              />
            </svg>
          </span>
        ) : provider === "password" ? (
          <span
            key={provider}
            className="inline-flex size-7 items-center justify-center rounded-full border border-slate-200 bg-slate-50 text-slate-700 dark:border-white/12 dark:bg-white/10 dark:text-zinc-200"
            aria-label="Password"
            title="Password"
          >
            <KeyRoundIcon className="size-3.5" />
          </span>
        ) : (
          <span
            key={provider}
            className="inline-flex h-7 items-center rounded-full border border-slate-200 bg-slate-50 px-2 text-xs font-semibold capitalize text-slate-700 dark:border-white/12 dark:bg-white/10 dark:text-zinc-200"
          >
            {provider}
          </span>
        ),
      )}
    </div>
  );
}

function UserFilterPanel({
  activeFilterCount,
  roleFilter,
  statusFilter,
  onChangeRole,
  onChangeStatus,
  onClear,
  onClose,
}: {
  activeFilterCount: number;
  roleFilter: RoleFilter;
  statusFilter: StatusFilter;
  onChangeRole: (role: RoleFilter) => void;
  onChangeStatus: (status: StatusFilter) => void;
  onClear: () => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute left-0 top-[calc(100%+0.5rem)] z-50 max-h-[min(32rem,calc(100dvh-8rem))] w-[min(20rem,calc(100vw-2rem))] overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white p-4 text-left shadow-2xl [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151719] md:left-auto md:right-0 md:w-80">
      <div className="sticky -top-4 z-10 -mx-4 -mt-4 mb-4 flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-4 dark:border-white/10 dark:bg-[#151719]">
        <div>
          <p className="text-sm font-bold text-zinc-950 dark:text-white">
            Filter users
          </p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-zinc-400">
            Narrow the current user list.
          </p>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-2 text-xs text-slate-600 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
            disabled={activeFilterCount === 0}
            onClick={onClear}
            type="button"
          >
            Clear
          </Button>
          <Button
            aria-label="Close user filters"
            variant="ghost"
            size="icon-sm"
            className="rounded-full text-slate-500 hover:bg-slate-100 hover:text-zinc-950 dark:text-zinc-300 dark:hover:bg-white/10 dark:hover:text-white"
            onClick={onClose}
            type="button"
          >
            <XIcon className="size-4" />
          </Button>
        </div>
      </div>

      <div className="grid gap-3">
        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Role
          </Label>
          <Select
            value={roleFilter}
            onValueChange={(value: string | null) => {
              if (value) {
                onChangeRole(value as RoleFilter);
              }
            }}
          >
            <SelectTrigger className={cn("w-full", modalSelectClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={modalSelectContentClass}>
              <SelectItem value="all" className={modalSelectItemClass}>
                {roleFilterLabels.all}
              </SelectItem>
              <SelectItem value="admins" className={modalSelectItemClass}>
                {roleFilterLabels.admins}
              </SelectItem>
              <SelectItem value="sellers" className={modalSelectItemClass}>
                {roleFilterLabels.sellers}
              </SelectItem>
              <SelectItem value="superadmin" className={modalSelectItemClass}>
                Superadmin
              </SelectItem>
              <SelectItem value="admin" className={modalSelectItemClass}>
                Admin
              </SelectItem>
              <SelectItem value="seller_owner" className={modalSelectItemClass}>
                Seller owner
              </SelectItem>
              <SelectItem value="seller_staff" className={modalSelectItemClass}>
                Seller staff
              </SelectItem>
              <SelectItem value="customer" className={modalSelectItemClass}>
                Customer
              </SelectItem>
              <SelectItem value="no-role" className={modalSelectItemClass}>
                No role
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid gap-1.5">
          <Label className="text-xs font-semibold text-slate-700 dark:text-zinc-300">
            Status
          </Label>
          <Select
            value={statusFilter}
            onValueChange={(value: string | null) => {
              if (value) {
                onChangeStatus(value as StatusFilter);
              }
            }}
          >
            <SelectTrigger className={cn("w-full", modalSelectClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={modalSelectContentClass}>
              <SelectItem value="all" className={modalSelectItemClass}>
                All statuses
              </SelectItem>
              <SelectItem value="active" className={modalSelectItemClass}>
                Enabled
              </SelectItem>
              <SelectItem value="inactive" className={modalSelectItemClass}>
                Disabled
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <Badge
      className={cn(
        "h-6 rounded-md border-0 px-2 text-xs font-semibold",
        isActive
          ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-400/15 dark:text-emerald-200"
          : "bg-red-100 text-red-700 dark:bg-red-400/15 dark:text-red-200",
      )}
    >
      {isActive ? "Enabled" : "Disabled"}
    </Badge>
  );
}

function exportUsers(users: AdminUser[]) {
  const headers = [
    "Name",
    "Email",
    "Roles",
    "Status",
    "Auth providers",
    "Seller access count",
    "Seller owner count",
    "Joined",
    "Updated",
  ];
  const rows = users.map((user) => [
    getDisplayName(user),
    user.email,
    user.roles.map((role) => roleLabels[role]).join(", "),
    user.isActive ? "Enabled" : "Disabled",
    user.accountProviders.length > 0
      ? user.accountProviders.join(", ")
      : user.hasPassword ? "Password" : "None",
    user.sellerAccessCount,
    user.sellerOwnerCount,
    formatDate(user.createdAt),
    formatDate(user.updatedAt),
  ]);
  const csv = [headers, ...rows]
    .map((row) => row.map((value) => escapeCsvValue(value)).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");

  link.href = url;
  link.download = "piessang-users.csv";
  link.click();
  URL.revokeObjectURL(url);
}

function matchesUserPage(user: AdminUser, page: UserPageKind) {
  if (page === "all") {
    return true;
  }

  if (page === "customers") {
    return user.roles.includes("customer");
  }

  if (page === "admins") {
    return user.roles.some((role) => role === "admin" || role === "superadmin");
  }

  return user.roles.some(
    (role) => role === "seller_owner" || role === "seller_staff",
  );
}

function getUserPageMetricLabel(page: UserPageKind) {
  if (page === "customers") {
    return "Total customers";
  }

  if (page === "admins") {
    return "Total admins";
  }

  if (page === "sellers") {
    return "Total sellers";
  }

  return "Total users";
}

function UserMutationMessage({ state }: { state: UserMutationState }) {
  if (!state.message) {
    return null;
  }

  return (
    <p
      className={cn(
        "rounded-lg px-3 py-2 text-sm",
        state.ok
          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-200"
          : "bg-red-50 text-red-700 dark:bg-red-400/10 dark:text-red-200",
      )}
    >
      {state.message}
    </p>
  );
}

function UserProfileForm({
  mediaLibrary,
  onDone,
  user,
}: {
  mediaLibrary: UserManagerProps["mediaLibrary"];
  onDone: () => void;
  user: AdminUser;
}) {
  const [isMediaManagerOpen, setIsMediaManagerOpen] = useState(false);
  const emailManagedByProvider = user.accountProviders.length > 0;
  const [selectedProfileImage, setSelectedProfileImage] =
    useState<AdminMediaAsset | null>(() =>
      user.image
        ? (mediaLibrary.assets.find((asset) => asset.publicUrl === user.image) ??
          null)
        : null,
    );
  const [profileImageUrl, setProfileImageUrl] = useState(user.image ?? "");
  const [state, formAction, isPending] = useActionState(
    updateAdminUserProfile,
    initialUserMutationState,
  );

  useEffect(() => {
    if (state.ok) {
      onDone();
    }
  }, [onDone, state.ok]);

  useEffect(() => {
    const matchingAsset =
      user.image
        ? (mediaLibrary.assets.find((asset) => asset.publicUrl === user.image) ??
          null)
        : null;

    setSelectedProfileImage(matchingAsset);
    setProfileImageUrl(user.image ?? "");
  }, [mediaLibrary.assets, user]);

  function selectProfileImage(asset: AdminMediaAsset) {
    setSelectedProfileImage(asset);
    setProfileImageUrl(asset.publicUrl);
  }

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="grid min-w-0 gap-4">
        <input name="id" type="hidden" value={user.id} />
        <input name="image" type="hidden" value={profileImageUrl} />
        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-200 p-3 dark:border-white/10 sm:gap-4">
          <div className="relative shrink-0">
            <UserAvatar
              image={profileImageUrl}
              user={user}
              className="size-16 text-base"
            />
            <Button
              aria-label="Select profile picture"
              className="absolute -bottom-1 -right-1 size-8 rounded-full border border-slate-200 bg-white p-0 text-slate-700 shadow-sm hover:bg-slate-50 dark:border-white/10 dark:bg-[#151719] dark:text-zinc-200 dark:hover:bg-white/10"
              onClick={() => setIsMediaManagerOpen(true)}
              type="button"
              variant="ghost"
            >
              <Edit3Icon className="size-4" />
            </Button>
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-zinc-950 dark:text-white">
              {getDisplayName(user)}
            </p>
            <p className="truncate text-sm text-slate-600 dark:text-zinc-400">
              {user.email}
            </p>
          </div>
          <div className="shrink-0 self-start">
            <DashboardRowActionMenu ariaLabel="Open profile picture actions">
              <button
                className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                onClick={() => setIsMediaManagerOpen(true)}
                type="button"
              >
                <ImageIcon className="size-4" />
                Select image
              </button>
              <button
                className="flex h-12 w-full items-center gap-3 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                disabled={!profileImageUrl}
                onClick={() => {
                  setSelectedProfileImage(null);
                  setProfileImageUrl("");
                }}
                type="button"
              >
                <Trash2Icon className="size-4" />
                Remove image
              </button>
            </DashboardRowActionMenu>
          </div>
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="user-name" className={modalLabelClass}>
            Name
          </Label>
          <Input
            id="user-name"
            name="name"
            defaultValue={user.name ?? ""}
            className={modalFieldClass}
            placeholder="Display name"
          />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="user-email" className={modalLabelClass}>
            Email
          </Label>
          <Input
            id="user-email"
            name="email"
            type="email"
            defaultValue={user.email}
            className={cn(
              modalFieldClass,
              emailManagedByProvider &&
                "cursor-not-allowed bg-slate-50 text-slate-500 dark:bg-white/[0.04] dark:text-zinc-400",
            )}
            readOnly={emailManagedByProvider}
            required
          />
        </div>
        <div className="grid gap-1.5">
          <Label className={modalLabelClass}>Status</Label>
          <Select name="isActive" defaultValue={user.isActive ? "active" : "inactive"}>
            <SelectTrigger className={cn("w-full", modalSelectClass)}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={modalSelectContentClass}>
              <SelectItem value="active" className={modalSelectItemClass}>
                Enabled
              </SelectItem>
              <SelectItem value="inactive" className={modalSelectItemClass}>
                Disabled
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="min-w-0 rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
          <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
                Providers
              </p>
              <div className="mt-1">
                <ProviderBadge
                  hasPassword={user.hasPassword}
                  providers={user.accountProviders}
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
                Seller access
              </p>
              <p className="mt-1 text-slate-700 dark:text-zinc-300">
                {user.sellerAccessCount > 0 || user.sellerOwnerCount > 0
                  ? `${user.sellerAccessCount} staff / ${user.sellerOwnerCount} owner`
                : "None"}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
                Status
              </p>
              <div className="mt-1">
                <StatusBadge isActive={user.isActive} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
                Roles
              </p>
              <div className="mt-1">
                <RoleBadges roles={user.roles} />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
                Joined
              </p>
              <p className="mt-1 text-slate-700 dark:text-zinc-300">
                {formatDate(user.createdAt)}
              </p>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-500 dark:text-zinc-500">
                Updated
              </p>
              <p className="mt-1 text-slate-700 dark:text-zinc-300">
                {formatDate(user.updatedAt)}
              </p>
            </div>
          </div>
        </div>
        <UserMutationMessage state={state} />
      </DialogBody>
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={isPending}>
          {isPending ? "Saving..." : "Save changes"}
        </Button>
      </DialogFooter>
      <MediaManagerDialog
        acceptedMediaTypes={["image"]}
        assets={mediaLibrary.assets}
        folders={mediaLibrary.folders}
        onOpenChange={setIsMediaManagerOpen}
        onSelect={selectProfileImage}
        open={isMediaManagerOpen}
        selectedAssetId={selectedProfileImage?.id}
        storage={mediaLibrary.storage}
        surface="admin"
        title="Select profile picture"
        usedStorageBytes={mediaLibrary.usedStorageBytes}
      />
    </form>
  );
}

function PasswordResetForm({ user }: { user: AdminUser }) {
  const [state, formAction, isPending] = useActionState(
    sendAdminUserPasswordReset,
    initialUserMutationState,
  );

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="grid gap-4">
        <input name="id" type="hidden" value={user.id} />
        <p className="text-sm text-slate-600 dark:text-zinc-300">
          Send a password reset link to {user.email}.
        </p>
        <UserMutationMessage state={state} />
        {state.devResetUrl ? (
          <div className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            {state.devResetUrl}
          </div>
        ) : null}
      </DialogBody>
      <DialogFooter showCloseButton>
        <Button type="submit" disabled={isPending || !user.isActive}>
          {isPending ? "Sending..." : "Send reset link"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function UserStatusForm({
  onDone,
  user,
}: {
  onDone: () => void;
  user: AdminUser;
}) {
  const nextStatus = user.isActive ? "inactive" : "active";
  const [state, formAction, isPending] = useActionState(
    setAdminUserActive,
    initialUserMutationState,
  );

  useEffect(() => {
    if (state.ok) {
      onDone();
    }
  }, [onDone, state.ok]);

  return (
    <form action={formAction} className="flex min-h-0 flex-1 flex-col">
      <DialogBody className="grid gap-4">
        <input name="id" type="hidden" value={user.id} />
        <input name="isActive" type="hidden" value={nextStatus} />
        <p className="text-sm text-slate-600 dark:text-zinc-300">
          {user.isActive
            ? `Deactivate ${getDisplayName(user)} and prevent account access.`
            : `Activate ${getDisplayName(user)} and restore account access.`}
        </p>
        <UserMutationMessage state={state} />
      </DialogBody>
      <DialogFooter showCloseButton>
        <Button
          type="submit"
          disabled={isPending}
          variant={user.isActive ? "destructive" : "default"}
        >
          {isPending ? "Saving..." : user.isActive ? "Deactivate user" : "Activate user"}
        </Button>
      </DialogFooter>
    </form>
  );
}

export function UserManager({
  canManage,
  mediaLibrary,
  page,
  users,
}: UserManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [profileUser, setProfileUser] = useState<AdminUser | null>(null);
  const [passwordUser, setPasswordUser] = useState<AdminUser | null>(null);
  const [statusUser, setStatusUser] = useState<AdminUser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const pageLabel = userPageLabels[page];
  const activeFilterCount =
    (roleFilter === "all" ? 0 : 1) + (statusFilter === "all" ? 0 : 1);
  const pageUsers = useMemo(
    () => users.filter((user) => matchesUserPage(user, page)),
    [page, users],
  );
  const pageActiveUserCount = pageUsers.filter((user) => user.isActive).length;
  const pageInactiveUserCount = pageUsers.filter((user) => !user.isActive).length;
  const pageAdminUserCount = pageUsers.filter((user) =>
    user.roles.some((role) => role === "admin" || role === "superadmin"),
  ).length;
  const pageCustomerUserCount = pageUsers.filter((user) =>
    user.roles.includes("customer"),
  ).length;
  const pageSellerUserCount = pageUsers.filter((user) =>
    user.roles.some((role) => role === "seller_owner" || role === "seller_staff"),
  ).length;
  const pageSellerOwnerCount = pageUsers.filter((user) =>
    user.roles.includes("seller_owner"),
  ).length;
  const pageSellerStaffCount = pageUsers.filter((user) =>
    user.roles.includes("seller_staff"),
  ).length;
  const pageCustomerOnlyCount = pageUsers.filter(
    (user) => user.roles.length === 1 && user.roles.includes("customer"),
  ).length;
  const pageCustomerWithOtherAccessCount =
    pageCustomerUserCount - pageCustomerOnlyCount;
  const noRoleUserCount = pageUsers.filter((user) => user.roles.length === 0).length;
  const googleProviderCount = pageUsers.filter((user) =>
    user.accountProviders.includes("google"),
  ).length;
  const passwordProviderCount = pageUsers.filter((user) => user.hasPassword).length;
  const userMetricStorageKey = `piessang:admin:user-metrics:${page}`;
  const availableMetrics = useMemo<DashboardMetricDefinition[]>(() => {
    const baseMetrics: DashboardMetricDefinition[] = [
      {
        color: "blue",
        description: "All users included on this page after the page-level user grouping is applied.",
        id: "total",
        label: getUserPageMetricLabel(page),
        value: pageUsers.length,
      },
      {
        color: "emerald",
        description: "Users on this page whose account is currently enabled.",
        id: "enabled",
        label: "Enabled",
        value: pageActiveUserCount,
      },
      {
        color: "red",
        description: "Users on this page whose account is currently disabled.",
        id: "disabled",
        label: "Disabled",
        value: pageInactiveUserCount,
      },
      {
        color: "amber",
        description: "Users on this page with a linked Google sign-in provider.",
        id: "google",
        label: "Google",
        value: googleProviderCount,
      },
      {
        color: "slate",
        description: "Users on this page with password sign-in available.",
        id: "password",
        label: "Password",
        value: passwordProviderCount,
      },
      {
        color: "slate",
        description: "Users on this page without any assigned platform role.",
        id: "no-role",
        label: "No role",
        value: noRoleUserCount,
      },
    ];

    if (page === "customers") {
      return [
        ...baseMetrics,
        {
          color: "blue",
          description: "Users on this page with the customer role.",
          id: "customers",
          label: "Customers",
          value: pageCustomerUserCount,
        },
        {
          color: "emerald",
          description: "Customer users without admin or seller access roles.",
          id: "customer-only",
          label: "Customer only",
          value: pageCustomerOnlyCount,
        },
        {
          color: "violet",
          description: "Customer users who also have another platform access role.",
          id: "customer-other-access",
          label: "Other access",
          value: pageCustomerWithOtherAccessCount,
        },
      ];
    }

    if (page === "admins") {
      return [
        ...baseMetrics,
        {
          color: "violet",
          description: "Users on this page with admin or superadmin platform access.",
          id: "admin-access",
          label: "Admin access",
          value: pageAdminUserCount,
        },
      ];
    }

    if (page === "sellers") {
      return [
        ...baseMetrics,
        {
          color: "amber",
          description: "Users on this page with seller owner or seller staff platform access.",
          id: "seller-access",
          label: "Seller access",
          value: pageSellerUserCount,
        },
        {
          color: "blue",
          description: "Users on this page who own at least one seller account.",
          id: "seller-owners",
          label: "Seller owners",
          value: pageSellerOwnerCount,
        },
        {
          color: "violet",
          description: "Users on this page assigned as staff on at least one seller account.",
          id: "seller-staff",
          label: "Seller staff",
          value: pageSellerStaffCount,
        },
      ];
    }

    return [
      ...baseMetrics,
      {
        color: "violet",
        description: "Users on this page with admin or superadmin platform access.",
        id: "admin-access",
        label: "Admin access",
        value: pageAdminUserCount,
      },
      {
        color: "amber",
        description: "Users on this page with seller owner or seller staff platform access.",
        id: "seller-access",
        label: "Seller access",
        value: pageSellerUserCount,
      },
      {
        color: "blue",
        description: "Users on this page with the customer role.",
        id: "customers",
        label: "Customers",
        value: pageCustomerUserCount,
      },
    ];
  }, [
    googleProviderCount,
    noRoleUserCount,
    page,
    pageActiveUserCount,
    pageAdminUserCount,
    pageCustomerOnlyCount,
    pageCustomerUserCount,
    pageCustomerWithOtherAccessCount,
    pageInactiveUserCount,
    pageSellerOwnerCount,
    pageSellerStaffCount,
    pageSellerUserCount,
    pageUsers.length,
    passwordProviderCount,
  ]);

  const filteredUsers = useMemo(() => {
    const normalizedTerm = searchTerm.trim().toLowerCase();

    return pageUsers.filter((user) => {
      const matchesSearch =
        !normalizedTerm ||
        user.email.toLowerCase().includes(normalizedTerm) ||
        getDisplayName(user).toLowerCase().includes(normalizedTerm) ||
        user.roles.some((role) => roleLabels[role].toLowerCase().includes(normalizedTerm));
      const matchesRole =
        roleFilter === "all" ||
        (roleFilter === "no-role"
          ? user.roles.length === 0
          : roleFilter === "admins"
            ? user.roles.some((role) => role === "admin" || role === "superadmin")
            : roleFilter === "sellers"
              ? user.roles.some(
                  (role) => role === "seller_owner" || role === "seller_staff",
                )
              : user.roles.includes(roleFilter));
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.isActive : !user.isActive);
      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [pageUsers, roleFilter, searchTerm, statusFilter]);

  const pageCount = Math.max(1, Math.ceil(filteredUsers.length / pageSize));
  const activePage = Math.min(currentPage, pageCount);
  const visibleUsers = filteredUsers.slice(
    (activePage - 1) * pageSize,
    activePage * pageSize,
  );

  function handlePageSizeChange(nextPageSize: number) {
    setPageSize(nextPageSize);
    setCurrentPage(1);
  }

  function updateRoleFilter(nextRoleFilter: RoleFilter) {
    setRoleFilter(nextRoleFilter);
    setCurrentPage(1);
  }

  function updateStatusFilter(nextStatusFilter: StatusFilter) {
    setStatusFilter(nextStatusFilter);
    setCurrentPage(1);
  }

  function clearFilters() {
    setRoleFilter("all");
    setStatusFilter("all");
    setCurrentPage(1);
  }

  function closeUserDialogs() {
    setProfileUser(null);
    setPasswordUser(null);
    setStatusUser(null);
  }

  return (
    <div>
      <DashboardPageHeader
        breadcrumbs={["Users & Access", pageLabel]}
        title={pageLabel}
      />

      <DashboardCompactMetrics
        metrics={availableMetrics}
        storageKey={userMetricStorageKey}
      />

      <section className="mt-4 grid gap-3 md:mt-5 md:flex md:items-center md:justify-between">
        <div className="relative w-full md:max-w-[420px]">
          <SearchIcon className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <DashboardInput
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setCurrentPage(1);
            }}
            placeholder="Search users"
            className="pl-10"
          />
        </div>

        <div className="grid grid-cols-2 gap-2 md:flex md:items-center">
          <div className="relative min-w-0">
            <DashboardButton
              className="w-full md:w-auto"
              onClick={() => setIsFilterPanelOpen((isOpen) => !isOpen)}
              type="button"
            >
              <FilterIcon className="size-3.5" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-[#c4982d] px-1 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </DashboardButton>
            {isFilterPanelOpen ? (
              <>
                <button
                  aria-label="Close user filters"
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setIsFilterPanelOpen(false)}
                  type="button"
                />
                <UserFilterPanel
                  activeFilterCount={activeFilterCount}
                  roleFilter={roleFilter}
                  statusFilter={statusFilter}
                  onChangeRole={updateRoleFilter}
                  onChangeStatus={updateStatusFilter}
                  onClear={clearFilters}
                  onClose={() => setIsFilterPanelOpen(false)}
                />
              </>
            ) : null}
          </div>
          <DashboardButton
            className="w-full md:w-auto"
            type="button"
            onClick={() => exportUsers(filteredUsers)}
            disabled={filteredUsers.length === 0}
          >
            <DownloadIcon className="size-3.5" />
            Export
          </DashboardButton>
        </div>
      </section>

      <section
        className={cn("mt-5", dashboardTableContainerClass, dashboardPanelClass)}
      >
        <Table className={dashboardTableClass}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={dashboardTableHeadClass}>
                User
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Roles
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Status</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Providers</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Seller access</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Joined</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, dashboardTableActionHeadClass)}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
            <TableBody>
              {visibleUsers.length > 0 ? (
                visibleUsers.map((user) => (
                  <TableRow key={user.id} className={dashboardTableRowClass}>
                    <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                      <div className="flex min-w-0 items-center gap-3">
                        <UserAvatar user={user} className="size-9" />
                        <div className="min-w-0">
                          <p className={cn(dashboardTablePrimaryTextClass, "truncate")}>
                            {getDisplayName(user)}
                          </p>
                          <p className={cn(dashboardTableSecondaryTextClass, "truncate")}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                      <RoleBadges roles={user.roles} />
                    </TableCell>
                    <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                      <StatusBadge isActive={user.isActive} />
                    </TableCell>
                    <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                      <ProviderBadge
                        hasPassword={user.hasPassword}
                        providers={user.accountProviders}
                      />
                    </TableCell>
                    <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                      <span className={dashboardTableMutedTextClass}>
                        {user.sellerAccessCount > 0 || user.sellerOwnerCount > 0
                          ? `${user.sellerAccessCount} staff / ${user.sellerOwnerCount} owner`
                          : "None"}
                      </span>
                    </TableCell>
                    <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                      <span className={dashboardTableMutedTextClass}>
                        {formatDate(user.createdAt)}
                      </span>
                    </TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      {canManage ? (
                        <div className="flex justify-end gap-1 md:gap-2">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                            aria-label={`Edit ${getDisplayName(user)}`}
                            onClick={() => {
                              setProfileUser(user);
                            }}
                            type="button"
                          >
                            <Edit3Icon className="size-4" />
                          </Button>
                          <DashboardRowActionMenu
                            ariaLabel={`Open actions for ${getDisplayName(user)}`}
                          >
                            <button
                              className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                              onClick={() => setProfileUser(user)}
                              type="button"
                            >
                              <UserRoundIcon className="size-4" />
                              View profile
                            </button>
                            <button
                              className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:text-slate-400 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06] dark:disabled:text-zinc-500"
                              onClick={() => setPasswordUser(user)}
                              type="button"
                            >
                              <KeyRoundIcon className="size-4" />
                              Reset password
                            </button>
                            <button
                              className={cn(
                                "flex h-12 w-full items-center gap-3 border-t px-4 text-sm font-medium transition",
                                user.isActive
                                  ? "border-red-100 bg-red-50/70 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                                  : "border-emerald-100 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15",
                              )}
                              onClick={() => setStatusUser(user)}
                              type="button"
                            >
                              <Trash2Icon className="size-4" />
                              {user.isActive ? "Deactivate" : "Activate"}
                            </button>
                          </DashboardRowActionMenu>
                        </div>
                      ) : (
                        <span className={dashboardTableSecondaryTextClass}>
                          Locked
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={7}
                    className="h-32 px-5 text-center text-sm text-slate-500 dark:text-zinc-400"
                  >
                    No users match the current filters.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
        </Table>

        <DashboardTablePagination
          currentPage={activePage}
          itemLabel="users"
          pageSize={pageSize}
          totalItems={filteredUsers.length}
          onPageChange={setCurrentPage}
          onPageSizeChange={handlePageSizeChange}
        />
      </section>

      <Dialog open={Boolean(profileUser)} onOpenChange={(open) => !open && setProfileUser(null)}>
        {profileUser ? (
          <DialogContent className={modalContentClass}>
            <DialogHeader>
              <DialogTitle>Edit user</DialogTitle>
              <DialogDescription>
                Update the profile and account status for {profileUser.email}.
              </DialogDescription>
            </DialogHeader>
            <UserProfileForm
              mediaLibrary={mediaLibrary}
              user={profileUser}
              onDone={closeUserDialogs}
            />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(passwordUser)} onOpenChange={(open) => !open && setPasswordUser(null)}>
        {passwordUser ? (
          <DialogContent className={modalContentClass}>
            <DialogHeader>
              <DialogTitle>Reset password</DialogTitle>
              <DialogDescription>
                Prepare a password reset for {passwordUser.email}.
              </DialogDescription>
            </DialogHeader>
            <PasswordResetForm user={passwordUser} />
          </DialogContent>
        ) : null}
      </Dialog>

      <Dialog open={Boolean(statusUser)} onOpenChange={(open) => !open && setStatusUser(null)}>
        {statusUser ? (
          <DialogContent className={modalContentClass}>
            <DialogHeader>
              <DialogTitle>
                {statusUser.isActive ? "Deactivate user" : "Activate user"}
              </DialogTitle>
              <DialogDescription>
                Change account access for {statusUser.email}.
              </DialogDescription>
            </DialogHeader>
            <UserStatusForm user={statusUser} onDone={closeUserDialogs} />
          </DialogContent>
        ) : null}
      </Dialog>

      {pageInactiveUserCount > 0 ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-zinc-400">
          {pageInactiveUserCount.toLocaleString()} disabled{" "}
          {pageInactiveUserCount === 1 ? "account is" : "accounts are"} retained for audit history.
        </p>
      ) : null}
    </div>
  );
}

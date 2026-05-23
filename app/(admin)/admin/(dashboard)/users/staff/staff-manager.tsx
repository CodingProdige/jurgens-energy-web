"use client";

import { useActionState, useEffect, useState } from "react";
import {
  BookOpenIcon,
  DownloadIcon,
  Edit3Icon,
  FilterIcon,
  MailPlusIcon,
  MoreVerticalIcon,
  SearchIcon,
  ShieldCheckIcon,
  ShieldOffIcon,
  XIcon,
} from "lucide-react";

import {
  inviteAdminStaff,
  revokeAdminStaffInvitationAction,
  setAdminStaffEnabledAction,
  updateAdminStaffRoleAction,
  type InviteAdminStaffState,
  type StaffMutationState,
} from "@/app/(admin)/admin/(dashboard)/users/staff/actions";
import {
  DashboardButton,
  DashboardInput,
  DashboardMetricStrip,
  DashboardPageHeader,
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  adminStaffRoleLabels,
  adminStaffRoleReadme,
} from "@/src/modules/admin/staff-constants";
import type { AdminStaffRole } from "@/src/db/schema";

const initialState: InviteAdminStaffState = {};
const initialStaffMutationState: StaffMutationState = {};
const roleOptions: AdminStaffRole[] = [
  "manager",
  "operations",
  "catalog",
  "support",
  "finance",
  "marketing",
  "analyst",
  "readonly",
];
const readmeRoleOrder: AdminStaffRole[] = ["owner", ...roleOptions];
type StatusFilter = "all" | "enabled" | "disabled";
type RoleFilter = "all" | AdminStaffRole;

type AdminStaffManagerProps = {
  canManage: boolean;
  currentUserId: string;
  currentUserIsOwner: boolean;
  invitations: Array<{
    email: string;
    expiresAt: Date;
    id: string;
    name: string | null;
    role: AdminStaffRole;
    roles: AdminStaffRole[];
  }>;
  staff: Array<{
    createdAt: Date;
    email: string;
    id: string;
    isActive: boolean;
    name: string | null;
    role: AdminStaffRole;
    roles: AdminStaffRole[];
    userId: string;
  }>;
};

type StaffMember = AdminStaffManagerProps["staff"][number];

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
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function getStaffRoles(member: { role: AdminStaffRole; roles: AdminStaffRole[] }) {
  return member.roles.length > 0 ? member.roles : [member.role];
}

function RoleBadges({ roles }: { roles: AdminStaffRole[] }) {
  const [primaryRole, ...extraRoles] = roles;

  if (!primaryRole) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <Badge className="h-6 rounded-md border-0 bg-amber-100 px-2 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
        {adminStaffRoleLabels[primaryRole]}
      </Badge>
      {extraRoles.length > 0 ? (
        <Badge className="h-6 rounded-md border-0 bg-zinc-100 px-2 text-xs font-semibold text-zinc-600 dark:bg-white/10 dark:text-zinc-300">
          +{extraRoles.length}
        </Badge>
      ) : null}
    </div>
  );
}

function getRoleSummary(roles: AdminStaffRole[]) {
  return roles.map((role) => adminStaffRoleLabels[role]).join(", ");
}

function StaffFilterPanel({
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
    <div className="absolute right-0 top-[calc(100%+0.5rem)] z-30 w-[320px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl dark:border-white/10 dark:bg-[#151719]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-zinc-950 dark:text-white">
            Filter staff
          </h2>
          <p className="mt-1 text-xs text-slate-500 dark:text-zinc-400">
            Narrow staff by role and status.
          </p>
        </div>
        <Button
          type="button"
          variant="ghost"
          className="size-8 p-0"
          onClick={onClose}
        >
          <XIcon className="size-4" />
        </Button>
      </div>

      <div className="mt-4 grid gap-3">
        <label className="grid gap-1.5">
          <Label>Role</Label>
          <Select
            value={roleFilter}
            onValueChange={(value) => onChangeRole(value as RoleFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All roles</SelectItem>
              {roleOptions.map((role) => (
                <SelectItem key={role} value={role}>
                  {adminStaffRoleLabels[role]}
                </SelectItem>
              ))}
              <SelectItem value="owner">{adminStaffRoleLabels.owner}</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5">
          <Label>Status</Label>
          <Select
            value={statusFilter}
            onValueChange={(value) => onChangeStatus(value as StatusFilter)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All statuses</SelectItem>
              <SelectItem value="enabled">Enabled</SelectItem>
              <SelectItem value="disabled">Disabled</SelectItem>
            </SelectContent>
          </Select>
        </label>
      </div>

      <div className="mt-4 flex items-center justify-between gap-3">
        <Button
          type="button"
          variant="ghost"
          className="h-8 px-2 text-xs"
          disabled={activeFilterCount === 0}
          onClick={onClear}
        >
          Clear filters
        </Button>
        <DashboardButton type="button" onClick={onClose}>
          Apply
        </DashboardButton>
      </div>
    </div>
  );
}

function InviteStaffDialog({
  canManage,
  onOpenChange,
  open,
}: {
  canManage: boolean;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  const [state, formAction, pending] = useActionState(
    inviteAdminStaff,
    initialState,
  );
  const [selectedRoles, setSelectedRoles] = useState<AdminStaffRole[]>([
    "readonly",
  ]);

  function toggleRole(role: AdminStaffRole, checked: boolean) {
    setSelectedRoles((current) => {
      if (checked) {
        return Array.from(new Set([...current, role]));
      }

      const nextRoles = current.filter((currentRole) => currentRole !== role);
      return nextRoles.length > 0 ? nextRoles : ["readonly"];
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Invite staff</DialogTitle>
            <DialogDescription>
              Staff receive admin-only credentials and their assigned dashboard roles.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            {selectedRoles.map((role) => (
              <input key={role} type="hidden" name="roles" value={role} />
            ))}
            <label className="grid gap-1.5">
              <Label>Name</Label>
              <Input name="name" placeholder="Staff name" disabled={!canManage} />
            </label>
            <label className="grid gap-1.5">
              <Label>Email</Label>
              <Input
                name="email"
                type="email"
                placeholder="staff@example.com"
                required
                disabled={!canManage}
              />
            </label>
            <fieldset className="grid gap-2">
              <Label>Roles</Label>
              <div className="grid gap-2 sm:grid-cols-2">
                {roleOptions.map((role) => (
                  <label
                    key={role}
                    className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-zinc-800 dark:border-white/10 dark:text-zinc-200"
                  >
                    <Checkbox
                      checked={selectedRoles.includes(role)}
                      onCheckedChange={(checked) =>
                        toggleRole(role, checked === true)
                      }
                      disabled={!canManage}
                    />
                    {adminStaffRoleLabels[role]}
                  </label>
                ))}
              </div>
            </fieldset>
            {state.message ? (
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
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DashboardButton type="submit" disabled={!canManage || pending}>
              <MailPlusIcon className="size-3.5" />
              {pending ? "Sending..." : "Send invite"}
            </DashboardButton>
            <DashboardButton type="button" onClick={() => onOpenChange(false)}>
              Close
            </DashboardButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StaffRolesReadmeDialog({
  onOpenChange,
  open,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
        <DialogHeader>
          <DialogTitle>Staff roles readme</DialogTitle>
          <DialogDescription>
            A quick reminder of what each admin staff role can access.
          </DialogDescription>
        </DialogHeader>
        <DialogBody>
          <div className="grid gap-3">
            {readmeRoleOrder.map((role) => {
              const readme = adminStaffRoleReadme[role];

              return (
                <div
                  key={role}
                  className="rounded-lg border border-slate-200 p-3 dark:border-white/10"
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge className="h-6 rounded-md border-0 bg-amber-100 px-2 text-xs font-semibold text-amber-800 dark:bg-amber-400/15 dark:text-amber-200">
                      {adminStaffRoleLabels[role]}
                    </Badge>
                    {role === "owner" ? (
                      <span className="text-xs font-semibold text-red-600 dark:text-red-300">
                        Restricted assignment
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-slate-600 dark:text-zinc-300">
                    {readme.description}
                  </p>
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {readme.permissions.map((permission) => (
                      <span
                        key={permission}
                        className="rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700 dark:bg-white/10 dark:text-zinc-300"
                      >
                        {permission}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DialogBody>
        <DialogFooter>
          <DashboardButton type="button" onClick={() => onOpenChange(false)}>
            Close
          </DashboardButton>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function EditStaffRolesDialog({
  member,
  onOpenChange,
  roleOptionsForMember,
}: {
  member: StaffMember | null;
  onOpenChange: (open: boolean) => void;
  roleOptionsForMember: AdminStaffRole[];
}) {
  const [selectedRoles, setSelectedRoles] = useState<AdminStaffRole[]>(
    member ? getStaffRoles(member) : ["readonly"],
  );

  if (!member) {
    return null;
  }

  function toggleRole(role: AdminStaffRole, checked: boolean) {
    setSelectedRoles((current) => {
      if (checked) {
        return Array.from(new Set([...current, role]));
      }

      const nextRoles = current.filter((currentRole) => currentRole !== role);
      return nextRoles.length > 0 ? nextRoles : ["readonly"];
    });
  }

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
        <form action={updateAdminStaffRoleAction}>
          <DialogHeader>
            <DialogTitle>Edit staff roles</DialogTitle>
            <DialogDescription>
              Manage dashboard roles for {member.email}.
            </DialogDescription>
          </DialogHeader>
          <DialogBody className="grid gap-4">
            <input type="hidden" name="id" value={member.id} />
            {selectedRoles.map((role) => (
              <input key={role} type="hidden" name="roles" value={role} />
            ))}
            <div className="grid gap-2 sm:grid-cols-2">
              {roleOptionsForMember.map((role) => (
                <label
                  key={role}
                  className="flex items-center gap-3 rounded-lg border border-slate-200 px-3 py-2 text-sm font-semibold text-zinc-800 dark:border-white/10 dark:text-zinc-200"
                >
                  <Checkbox
                    checked={selectedRoles.includes(role)}
                    onCheckedChange={(checked) => toggleRole(role, checked === true)}
                  />
                  {adminStaffRoleLabels[role]}
                </label>
              ))}
            </div>
          </DialogBody>
          <DialogFooter>
            <DashboardButton type="submit">
              Save roles
            </DashboardButton>
            <DashboardButton type="button" onClick={() => onOpenChange(false)}>
              Close
            </DashboardButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function StaffStatusDialog({
  member,
  onOpenChange,
}: {
  member: StaffMember | null;
  onOpenChange: (open: boolean) => void;
}) {
  const [state, formAction, pending] = useActionState(
    setAdminStaffEnabledAction,
    initialStaffMutationState,
  );

  useEffect(() => {
    if (state.ok) {
      onOpenChange(false);
    }
  }, [onOpenChange, state.ok]);

  if (!member) {
    return null;
  }

  return (
    <Dialog open={Boolean(member)} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white">
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>
              {member.isActive ? "Disable staff access" : "Enable staff access"}
            </DialogTitle>
            <DialogDescription>
              {member.isActive
                ? `Disable admin dashboard access for ${member.email}.`
                : `Restore admin dashboard access for ${member.email}.`}
            </DialogDescription>
          </DialogHeader>
          <DialogBody>
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="userId" value={member.userId} />
            <input
              type="hidden"
              name="enabled"
              value={member.isActive ? "false" : "true"}
            />
            {state.message && !state.ok ? (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-400/10 dark:text-red-200">
                {state.message}
              </p>
            ) : null}
          </DialogBody>
          <DialogFooter>
            <DashboardButton type="submit" disabled={pending}>
              {pending
                ? member.isActive
                  ? "Disabling..."
                  : "Enabling..."
                : member.isActive
                  ? "Disable"
                  : "Enable"}
            </DashboardButton>
            <DashboardButton type="button" onClick={() => onOpenChange(false)}>
              Close
            </DashboardButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function AdminStaffManager({
  canManage,
  currentUserId,
  currentUserIsOwner,
  invitations,
  staff,
}: AdminStaffManagerProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [isFilterPanelOpen, setIsFilterPanelOpen] = useState(false);
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [isReadmeOpen, setIsReadmeOpen] = useState(false);
  const [roleMember, setRoleMember] = useState<StaffMember | null>(null);
  const [statusMember, setStatusMember] = useState<StaffMember | null>(null);
  const [activeActionStaffId, setActiveActionStaffId] = useState<string | null>(
    null,
  );
  const enabledStaffCount = staff.filter((member) => member.isActive).length;
  const activeFilterCount =
    (roleFilter === "all" ? 0 : 1) + (statusFilter === "all" ? 0 : 1);

  const normalizedTerm = searchTerm.trim().toLowerCase();
  const filteredStaff = staff.filter((member) => {
    const roles = getStaffRoles(member);
    const matchesSearch =
      !normalizedTerm ||
      member.name?.toLowerCase().includes(normalizedTerm) ||
      member.email.toLowerCase().includes(normalizedTerm);
    const matchesRole = roleFilter === "all" || roles.includes(roleFilter);
    const matchesStatus =
      statusFilter === "all" ||
      (statusFilter === "enabled" ? member.isActive : !member.isActive);

    return matchesSearch && matchesRole && matchesStatus;
  });

  function clearFilters() {
    setRoleFilter("all");
    setStatusFilter("all");
  }

  function exportStaff() {
    const rows = filteredStaff.map((member) => [
      member.name ?? "Unnamed staff member",
      member.email,
      getStaffRoles(member)
        .map((role) => adminStaffRoleLabels[role])
        .join("; "),
      member.isActive ? "Enabled" : "Disabled",
      formatDate(member.createdAt),
    ]);
    const csv = [
      ["Name", "Email", "Roles", "Status", "Added"],
      ...rows,
    ]
      .map((row) => row.map(escapeCsvValue).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = "admin-staff.csv";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <div>
      <DashboardPageHeader
        breadcrumbs={["Users & Access", "Admin staff"]}
        title="Admin staff"
      />

      <DashboardMetricStrip
        metrics={[
          { label: "Staff members", value: staff.length.toLocaleString() },
          { label: "Enabled", value: enabledStaffCount.toLocaleString() },
          { label: "Pending invites", value: invitations.length.toLocaleString() },
        ]}
      />

      <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
          <DashboardInput
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Search staff"
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:justify-end">
          <DashboardButton type="button" onClick={() => setIsReadmeOpen(true)}>
            <BookOpenIcon className="size-3.5" />
            Readme
          </DashboardButton>
          <DashboardButton
            type="button"
            disabled={!canManage}
            onClick={() => setIsInviteOpen(true)}
          >
            <MailPlusIcon className="size-3.5" />
            Invite staff
          </DashboardButton>
          <div className="relative">
            <DashboardButton
              type="button"
              onClick={() => setIsFilterPanelOpen((isOpen) => !isOpen)}
            >
              <FilterIcon className="size-3.5" />
              Filter
              {activeFilterCount > 0 ? (
                <span className="ml-1 rounded-full bg-admin-primary px-1.5 py-0.5 text-[10px] font-bold text-white">
                  {activeFilterCount}
                </span>
              ) : null}
            </DashboardButton>
            {isFilterPanelOpen ? (
              <>
                <button
                  aria-label="Close staff filters"
                  className="fixed inset-0 z-20 cursor-default"
                  type="button"
                  onClick={() => setIsFilterPanelOpen(false)}
                />
                <StaffFilterPanel
                  activeFilterCount={activeFilterCount}
                  roleFilter={roleFilter}
                  statusFilter={statusFilter}
                  onChangeRole={setRoleFilter}
                  onChangeStatus={setStatusFilter}
                  onClear={clearFilters}
                  onClose={() => setIsFilterPanelOpen(false)}
                />
              </>
            ) : null}
          </div>
          <DashboardButton type="button" onClick={exportStaff}>
            <DownloadIcon className="size-3.5" />
            Export
          </DashboardButton>
        </div>
      </div>

      <section
        className={cn(
          "mt-5",
          dashboardTableContainerClass,
          dashboardPanelClass,
        )}
      >
        <Table className={dashboardTableClass}>
          <TableHeader>
            <TableRow className={dashboardTableHeaderRowClass}>
              <TableHead className={dashboardTableHeadClass}>Staff member</TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Roles
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Status
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                Added
              </TableHead>
              <TableHead className={cn(dashboardTableHeadClass, dashboardTableActionHeadClass)}>
                Actions
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredStaff.map((member) => {
              const roles = getStaffRoles(member);
              const isOwnerRow = roles.includes("owner");
              const isCurrentUserRow = member.userId === currentUserId;
              const canManageRow =
                canManage &&
                !isCurrentUserRow &&
                (!isOwnerRow || currentUserIsOwner);

              return (
                <TableRow key={member.id} className={dashboardTableRowClass}>
                  <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                    <p className={dashboardTablePrimaryTextClass}>
                      {member.name ?? "Unnamed staff member"}
                    </p>
                    <p className={dashboardTableSecondaryTextClass}>
                      {member.email}
                    </p>
                    <p className={cn("mt-1 truncate md:hidden", dashboardTableSecondaryTextClass)}>
                      {getRoleSummary(roles)} · {member.isActive ? "Enabled" : "Disabled"}
                    </p>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <RoleBadges roles={roles} />
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <span className={dashboardTableMutedTextClass}>
                      {member.isActive ? "Enabled" : "Disabled"}
                    </span>
                  </TableCell>
                  <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                    <span className={dashboardTableMutedTextClass}>
                      {formatDate(member.createdAt)}
                    </span>
                  </TableCell>
                  <TableCell className={dashboardTableActionCellClass}>
                    {canManageRow ? (
                      <div className="flex justify-end gap-1 md:gap-2">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                          aria-label={`Edit roles for ${member.email}`}
                          onClick={() => {
                            setActiveActionStaffId(null);
                            setRoleMember(member);
                          }}
                          type="button"
                        >
                          <Edit3Icon className="size-4" />
                        </Button>
                        <div className="relative">
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            className="text-slate-700 hover:bg-slate-100 dark:text-zinc-300 dark:hover:bg-white/10"
                            aria-label={`Open actions for ${member.email}`}
                            onMouseDown={(event) => event.preventDefault()}
                            onClick={(event) => {
                              event.currentTarget.blur();
                              setActiveActionStaffId((current) =>
                                current === member.id ? null : member.id,
                              );
                            }}
                            type="button"
                          >
                            <MoreVerticalIcon className="size-4" />
                          </Button>
                          {activeActionStaffId === member.id ? (
                            <>
                              <button
                                aria-label="Close staff actions"
                                className="fixed inset-0 z-40 cursor-default"
                                onClick={() => setActiveActionStaffId(null)}
                                type="button"
                              />
                              <div className="absolute right-0 top-9 z-50 max-h-[min(22rem,calc(100dvh-8rem))] w-64 overflow-y-auto overscroll-contain rounded-xl border border-slate-200 bg-white text-left text-zinc-950 shadow-2xl [scrollbar-width:thin] dark:border-white/10 dark:bg-[#151719] dark:text-white">
                                <button
                                  className="flex h-12 w-full items-center gap-3 border-b border-slate-200 px-4 text-sm text-zinc-800 transition hover:bg-slate-50 dark:border-white/10 dark:text-zinc-100 dark:hover:bg-white/[0.06]"
                                  onClick={() => {
                                    setActiveActionStaffId(null);
                                    setRoleMember(member);
                                  }}
                                  type="button"
                                >
                                  <Edit3Icon className="size-4" />
                                  Edit roles
                                </button>
                                <button
                                  className={cn(
                                    "flex h-12 w-full items-center gap-3 border-t px-4 text-sm font-medium transition",
                                    member.isActive
                                      ? "border-red-100 bg-red-50/70 text-red-600 hover:bg-red-50 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/15"
                                      : "border-emerald-100 bg-emerald-50/70 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/15",
                                  )}
                                  onClick={() => {
                                    setActiveActionStaffId(null);
                                    setStatusMember(member);
                                  }}
                                  type="button"
                                >
                                  {member.isActive ? (
                                    <ShieldOffIcon className="size-4" />
                                  ) : (
                                    <ShieldCheckIcon className="size-4" />
                                  )}
                                  {member.isActive ? "Disable access" : "Enable access"}
                                </button>
                              </div>
                            </>
                          ) : null}
                        </div>
                      </div>
                    ) : (
                      <span className={dashboardTableSecondaryTextClass}>
                        {isCurrentUserRow ? "Current" : "Locked"}
                      </span>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </section>

      {invitations.length > 0 ? (
        <section
          className={cn(
            "mt-5",
            dashboardTableContainerClass,
            dashboardPanelClass,
          )}
        >
          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Pending invite</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Roles
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>
                  Expires
                </TableHead>
                <TableHead className={cn(dashboardTableHeadClass, dashboardTableActionHeadClass)}>
                  Actions
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invitations.map((invitation) => {
                const roles = getStaffRoles(invitation);

                return (
                  <TableRow key={invitation.id} className={dashboardTableRowClass}>
                    <TableCell className={cn("min-w-0", dashboardTableCellClass)}>
                      <p className={dashboardTablePrimaryTextClass}>
                        {invitation.name ?? "Invited staff member"}
                      </p>
                      <p className={dashboardTableSecondaryTextClass}>
                        {invitation.email}
                      </p>
                      <p className={cn("mt-1 truncate md:hidden", dashboardTableSecondaryTextClass)}>
                        {getRoleSummary(roles)} · Expires {formatDate(invitation.expiresAt)}
                      </p>
                    </TableCell>
                    <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                      <RoleBadges roles={roles} />
                    </TableCell>
                    <TableCell className={cn("hidden md:table-cell", dashboardTableCellClass)}>
                      {formatDate(invitation.expiresAt)}
                    </TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      {canManage ? (
                        <form
                          action={revokeAdminStaffInvitationAction}
                          className="inline-flex"
                        >
                          <input type="hidden" name="id" value={invitation.id} />
                          <DashboardButton type="submit">
                            <XIcon className="size-3.5" />
                            <span className="hidden md:inline">Revoke</span>
                          </DashboardButton>
                        </form>
                      ) : (
                        <span className={dashboardTableSecondaryTextClass}>
                          Locked
                        </span>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </section>
      ) : null}

      <InviteStaffDialog
        canManage={canManage}
        open={isInviteOpen}
        onOpenChange={setIsInviteOpen}
      />
      <StaffRolesReadmeDialog
        open={isReadmeOpen}
        onOpenChange={setIsReadmeOpen}
      />
      <EditStaffRolesDialog
        key={roleMember?.id ?? "empty-role-member"}
        member={roleMember}
        roleOptionsForMember={
          currentUserIsOwner && roleMember
            ? readmeRoleOrder
            : roleOptions
        }
        onOpenChange={(open) => !open && setRoleMember(null)}
      />
      <StaffStatusDialog
        key={
          statusMember
            ? `${statusMember.id}-${statusMember.isActive ? "disable" : "enable"}`
            : "empty-status-member"
        }
        member={statusMember}
        onOpenChange={(open) => !open && setStatusMember(null)}
      />
    </div>
  );
}

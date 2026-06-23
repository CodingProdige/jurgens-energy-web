"use client";

import { useActionState, useMemo, useState } from "react";
import {
  DownloadIcon,
  Edit3Icon,
  FilterIcon,
  PlusIcon,
  SaveIcon,
} from "lucide-react";

import {
  disableParcelPreset,
  saveCollectionProfile,
  saveParcelPreset,
  type SellerShippingActionState,
} from "@/app/(seller)/seller/(dashboard)/shipping/actions";
import {
  DashboardButton,
  DashboardInput,
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
} from "@/components/dashboard/dashboard-controls";
import { DashboardRowActionMenu } from "@/components/dashboard/dashboard-row-action-menu";
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
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { normalizePhoneNumber } from "@/src/modules/phone";
import type {
  SellerCollectionProfile,
  SellerParcelPresetRow,
  SellerShipmentRow,
} from "@/src/modules/sellers/shipping";

const initialState: SellerShippingActionState = {};
const pageSizeOptions = [10, 25, 50];
const fieldClass =
  "h-10 border-slate-300 bg-white text-zinc-950 placeholder:text-slate-400 focus-visible:border-emerald-500 focus-visible:ring-emerald-500/20 dark:border-white/18 dark:bg-[#151719] dark:text-white dark:placeholder:text-zinc-500";
const selectContentClass =
  "border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white";
const selectItemClass =
  "cursor-pointer px-2 py-2 text-zinc-800 focus:bg-slate-100 focus:text-zinc-950 dark:text-zinc-200 dark:focus:bg-white/10 dark:focus:text-white";

function formatDate(date: Date | null) {
  if (!date) return "Not set";
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function escapeCsvValue(value: string | number | null) {
  const text = value === null ? "" : String(value);
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function exportRows(fileName: string, headers: string[], rows: Array<Array<string | number | null>>) {
  const csv = [headers, ...rows]
    .map((row) => row.map(escapeCsvValue).join(","))
    .join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${fileName}-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

function StatusBadge({ status }: { status: string }) {
  const isDone = ["delivered", "collected"].includes(status);
  const isProblem = ["failed_delivery", "returned", "cancelled"].includes(status);

  return (
    <Badge
      className={cn(
        "rounded-md px-2 py-1 text-xs font-semibold capitalize",
        isDone && "bg-emerald-100 text-emerald-800 dark:bg-emerald-400/15 dark:text-emerald-200",
        isProblem && "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-200",
        !isDone && !isProblem && "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-200",
      )}
    >
      {status.replaceAll("_", " ")}
    </Badge>
  );
}

export function ParcelPresetsManager({
  presets,
}: {
  presets: SellerParcelPresetRow[];
}) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "inactive">("active");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [editingPreset, setEditingPreset] = useState<SellerParcelPresetRow | null>(null);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [state, formAction, isPending] = useActionState(saveParcelPreset, initialState);
  const [disableState, disableAction] = useActionState(disableParcelPreset, initialState);

  const filteredPresets = useMemo(
    () =>
      presets.filter((preset) => {
        const matchesQuery = `${preset.name} ${preset.notes ?? ""}`
          .toLowerCase()
          .includes(query.toLowerCase());
        const matchesStatus =
          statusFilter === "all" ||
          (statusFilter === "active" ? preset.isActive : !preset.isActive);

        return matchesQuery && matchesStatus;
      }),
    [presets, query, statusFilter],
  );
  const totalPages = Math.max(1, Math.ceil(filteredPresets.length / pageSize));
  const pagePresets = filteredPresets.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );
  const activeDialogPreset = editingPreset ?? null;
  const isDialogOpen = isCreateOpen || Boolean(editingPreset);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <DashboardInput
          className="md:max-w-md"
          onChange={(event) => {
            setQuery(event.target.value);
            setCurrentPage(1);
          }}
          placeholder="Search parcel presets"
          value={query}
        />
        <div className="flex flex-col gap-2 sm:flex-row">
          <Select
            onValueChange={(value) => {
              setStatusFilter(value as typeof statusFilter);
              setCurrentPage(1);
            }}
            value={statusFilter}
          >
            <SelectTrigger className="h-8 w-full border-slate-300 bg-white text-[14px] font-normal md:w-36">
              <FilterIcon className="size-3.5" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem className={selectItemClass} value="active">Active</SelectItem>
              <SelectItem className={selectItemClass} value="inactive">Inactive</SelectItem>
              <SelectItem className={selectItemClass} value="all">All</SelectItem>
            </SelectContent>
          </Select>
          <DashboardButton
            onClick={() =>
              exportRows(
                "parcel-presets",
                ["Name", "Weight g", "Length mm", "Width mm", "Height mm", "Default", "Active"],
                filteredPresets.map((preset) => [
                  preset.name,
                  preset.weightGrams,
                  preset.lengthMm,
                  preset.widthMm,
                  preset.heightMm,
                  preset.isDefault ? "Yes" : "No",
                  preset.isActive ? "Yes" : "No",
                ]),
              )
            }
            type="button"
          >
            <DownloadIcon className="size-3.5" />
            Export
          </DashboardButton>
          <DashboardButton
            className="border-emerald-700 bg-emerald-700 text-white hover:bg-emerald-800 hover:text-white"
            onClick={() => setIsCreateOpen(true)}
            type="button"
          >
            <PlusIcon className="size-3.5" />
            New preset
          </DashboardButton>
        </div>
      </div>

      <div className={cn(dashboardPanelClass, "overflow-hidden")}>
        <div className={dashboardTableContainerClass}>
          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Preset</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Weight</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Dimensions</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Status</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Updated</TableHead>
                <TableHead className={dashboardTableActionHeadClass}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pagePresets.length > 0 ? (
                pagePresets.map((preset) => (
                  <TableRow key={preset.id} className={dashboardTableRowClass}>
                    <TableCell className={dashboardTableCellClass}>
                      <p className={dashboardTablePrimaryTextClass}>{preset.name}</p>
                      <p className="text-xs text-slate-500">{preset.notes ?? "No notes"}</p>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>{preset.weightGrams} g</TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                      {preset.lengthMm} x {preset.widthMm} x {preset.heightMm} mm
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>
                      <div className="flex gap-1">
                        {preset.isDefault ? <Badge className="bg-emerald-100 text-emerald-800">Default</Badge> : null}
                        <Badge className={preset.isActive ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-600"}>
                          {preset.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>{formatDate(preset.updatedAt)}</TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      <div className="flex justify-end gap-1">
                        <Button
                          aria-label="Edit parcel preset"
                          onClick={() => setEditingPreset(preset)}
                          size="icon-sm"
                          type="button"
                          variant="ghost"
                        >
                          <Edit3Icon className="size-4" />
                        </Button>
                        <DashboardRowActionMenu ariaLabel="Parcel preset actions">
                          <button className="flex w-full px-3 py-2 text-sm hover:bg-slate-50" onClick={() => setEditingPreset(preset)} type="button">
                            Edit preset
                          </button>
                          {preset.isActive ? (
                            <form action={disableAction}>
                              <input name="id" type="hidden" value={preset.id} />
                              <button className="flex w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50" type="submit">
                                Disable preset
                              </button>
                            </form>
                          ) : null}
                        </DashboardRowActionMenu>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="px-5 py-8 text-center text-sm text-slate-500" colSpan={6}>
                    No parcel presets found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DashboardTablePagination
          currentPage={Math.min(currentPage, totalPages)}
          itemLabel="presets"
          onPageChange={setCurrentPage}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          pageSize={pageSize}
          pageSizeOptions={pageSizeOptions}
          totalItems={filteredPresets.length}
        />
      </div>

      {disableState.message ? (
        <p className={cn("text-sm", disableState.ok ? "text-emerald-700" : "text-red-600")}>
          {disableState.message}
        </p>
      ) : null}

      <Dialog
        open={isDialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setIsCreateOpen(false);
            setEditingPreset(null);
          }
        }}
      >
        <DialogContent>
          <form action={formAction} className="contents">
            <input name="id" type="hidden" value={activeDialogPreset?.id ?? ""} />
            <DialogHeader>
              <DialogTitle>{activeDialogPreset ? "Edit parcel preset" : "New parcel preset"}</DialogTitle>
              <DialogDescription>
                Save reusable parcel metrics to reduce repeated typing and shipping rate errors.
              </DialogDescription>
            </DialogHeader>
            <DialogBody className="grid gap-4">
              <label className="grid gap-1.5">
                <Label>Name</Label>
                <Input className={fieldClass} defaultValue={activeDialogPreset?.name ?? ""} name="name" placeholder="Small parcel" />
              </label>
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="grid gap-1.5">
                  <Label>Weight (g)</Label>
                  <Input className={fieldClass} defaultValue={activeDialogPreset?.weightGrams ?? ""} inputMode="decimal" name="weightGrams" type="number" step="any" />
                </label>
                <label className="grid gap-1.5">
                  <Label>Length (mm)</Label>
                  <Input className={fieldClass} defaultValue={activeDialogPreset?.lengthMm ?? ""} inputMode="decimal" name="lengthMm" type="number" step="any" />
                </label>
                <label className="grid gap-1.5">
                  <Label>Width (mm)</Label>
                  <Input className={fieldClass} defaultValue={activeDialogPreset?.widthMm ?? ""} inputMode="decimal" name="widthMm" type="number" step="any" />
                </label>
                <label className="grid gap-1.5">
                  <Label>Height (mm)</Label>
                  <Input className={fieldClass} defaultValue={activeDialogPreset?.heightMm ?? ""} inputMode="decimal" name="heightMm" type="number" step="any" />
                </label>
              </div>
              <label className="grid gap-1.5">
                <Label>Notes</Label>
                <Textarea className={cn(fieldClass, "min-h-20")} defaultValue={activeDialogPreset?.notes ?? ""} name="notes" />
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                <Checkbox defaultChecked={activeDialogPreset?.isDefault ?? false} name="isDefault" />
                Use as default preset
              </label>
              <label className="flex items-center gap-3 rounded-lg border border-slate-200 p-3 text-sm">
                <Checkbox defaultChecked={activeDialogPreset?.isActive ?? true} name="isActive" />
                Active
              </label>
              {state.message ? (
                <p className={cn("text-sm", state.ok ? "text-emerald-700" : "text-red-600")}>{state.message}</p>
              ) : null}
            </DialogBody>
            <DialogFooter>
              <Button className="gap-2" disabled={isPending} type="submit">
                <SaveIcon className="size-4" />
                {isPending ? "Saving..." : "Save preset"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ShipmentsManager({ shipments }: { shipments: SellerShipmentRow[] }) {
  return <ShipmentTable shipments={shipments} emptyLabel="No shipments yet." exportName="shipments" />;
}

export function CollectionsManager({ shipments }: { shipments: SellerShipmentRow[] }) {
  const collectionRows = shipments.filter((shipment) =>
    ["booked", "waybill_ready", "ready_for_collection", "collected", "delivered"].includes(shipment.status),
  );

  return <ShipmentTable shipments={collectionRows} emptyLabel="No booked collections yet." exportName="collections" />;
}

function ShipmentTable({
  emptyLabel,
  exportName,
  shipments,
}: {
  emptyLabel: string;
  exportName: string;
  shipments: SellerShipmentRow[];
}) {
  const [query, setQuery] = useState("");
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const filtered = shipments.filter((shipment) =>
    `${shipment.orderId} ${shipment.status} ${shipment.waybillNumber ?? ""} ${shipment.trackingNumber ?? ""}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageRows = filtered.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  return (
    <div className="grid gap-5">
      <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
        <DashboardInput className="md:max-w-md" onChange={(event) => setQuery(event.target.value)} placeholder="Search shipments" value={query} />
        <DashboardButton
          onClick={() =>
            exportRows(
              exportName,
              ["Order", "Status", "Waybill", "Tracking", "Booked", "Collected"],
              filtered.map((shipment) => [
                shipment.orderId,
                shipment.status,
                shipment.waybillNumber,
                shipment.trackingNumber,
                formatDate(shipment.bookedAt),
                formatDate(shipment.collectedAt),
              ]),
            )
          }
          type="button"
        >
          <DownloadIcon className="size-3.5" />
          Export
        </DashboardButton>
      </div>
      <div className={cn(dashboardPanelClass, "overflow-hidden")}>
        <div className={dashboardTableContainerClass}>
          <Table className={dashboardTableClass}>
            <TableHeader>
              <TableRow className={dashboardTableHeaderRowClass}>
                <TableHead className={dashboardTableHeadClass}>Shipment</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Status</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Booked</TableHead>
                <TableHead className={cn(dashboardTableHeadClass, "hidden md:table-cell")}>Collected</TableHead>
                <TableHead className={dashboardTableActionHeadClass}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.length > 0 ? (
                pageRows.map((shipment) => (
                  <TableRow key={shipment.id} className={dashboardTableRowClass}>
                    <TableCell className={dashboardTableCellClass}>
                      <p className={dashboardTablePrimaryTextClass}>Order {shipment.orderId.slice(0, 8)}</p>
                      <p className={dashboardTableMutedTextClass}>{shipment.waybillNumber ?? "Waybill pending"}</p>
                    </TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}><StatusBadge status={shipment.status} /></TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>{formatDate(shipment.bookedAt)}</TableCell>
                    <TableCell className={cn(dashboardTableCellClass, "hidden md:table-cell")}>{formatDate(shipment.collectedAt)}</TableCell>
                    <TableCell className={dashboardTableActionCellClass}>
                      {shipment.waybillUrl ? (
                        <a className="text-sm text-emerald-700" href={shipment.waybillUrl} rel="noreferrer" target="_blank">Waybill</a>
                      ) : (
                        <span className="text-xs text-slate-500">Pending</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell className="px-5 py-8 text-center text-sm text-slate-500" colSpan={5}>{emptyLabel}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
        <DashboardTablePagination currentPage={Math.min(currentPage, totalPages)} itemLabel="shipments" onPageChange={setCurrentPage} onPageSizeChange={(size) => { setPageSize(size); setCurrentPage(1); }} pageSize={pageSize} pageSizeOptions={pageSizeOptions} totalItems={filtered.length} />
      </div>
    </div>
  );
}

export function CollectionProfileForm({ profile }: { profile: SellerCollectionProfile }) {
  const [state, formAction, isPending] = useActionState(saveCollectionProfile, initialState);
  const [contactPhone, setContactPhone] = useState(profile?.contactPhone ?? "");

  function normalizeContactPhone() {
    const normalized = normalizePhoneNumber(contactPhone, {
      defaultCountryCode: "ZA",
    });

    if (normalized) {
      setContactPhone(normalized);
    }
  }

  return (
    <form action={formAction} className={cn("grid gap-5 p-5", dashboardPanelClass)}>
      <div className="grid gap-4 md:grid-cols-2">
        <label className="grid gap-1.5">
          <Label>Contact name</Label>
          <Input className={fieldClass} defaultValue={profile?.contactName ?? ""} name="contactName" />
        </label>
        <label className="grid gap-1.5">
          <Label>Contact phone</Label>
          <Input
            autoComplete="tel"
            className={fieldClass}
            inputMode="tel"
            name="contactPhone"
            onBlur={normalizeContactPhone}
            onChange={(event) => setContactPhone(event.target.value)}
            placeholder="+27821234567"
            value={contactPhone}
          />
        </label>
        <label className="grid gap-1.5">
          <Label>Contact email</Label>
          <Input className={fieldClass} defaultValue={profile?.contactEmail ?? ""} name="contactEmail" type="email" />
        </label>
        <label className="grid gap-1.5">
          <Label>Address type</Label>
          <Select defaultValue={profile?.addressType ?? "business"} name="addressType">
            <SelectTrigger className={fieldClass}><SelectValue /></SelectTrigger>
            <SelectContent className={selectContentClass}>
              <SelectItem className={selectItemClass} value="business">Business</SelectItem>
              <SelectItem className={selectItemClass} value="residential">Residential</SelectItem>
            </SelectContent>
          </Select>
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <Label>Address line 1</Label>
          <Input className={fieldClass} defaultValue={profile?.addressLine1 ?? ""} name="addressLine1" />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <Label>Address line 2</Label>
          <Input className={fieldClass} defaultValue={profile?.addressLine2 ?? ""} name="addressLine2" />
        </label>
        <label className="grid gap-1.5">
          <Label>Suburb</Label>
          <Input className={fieldClass} defaultValue={profile?.suburb ?? ""} name="suburb" />
        </label>
        <label className="grid gap-1.5">
          <Label>City</Label>
          <Input className={fieldClass} defaultValue={profile?.city ?? ""} name="city" />
        </label>
        <label className="grid gap-1.5">
          <Label>Province</Label>
          <Input className={fieldClass} defaultValue={profile?.province ?? ""} name="province" />
        </label>
        <label className="grid gap-1.5">
          <Label>Postal code</Label>
          <Input className={fieldClass} defaultValue={profile?.postalCode ?? ""} name="postalCode" />
        </label>
        <label className="grid gap-1.5 md:col-span-2">
          <Label>Collection instructions</Label>
          <Textarea className={cn(fieldClass, "min-h-24")} defaultValue={profile?.collectionInstructions ?? ""} name="collectionInstructions" />
        </label>
      </div>
      {state.message ? (
        <p className={cn("text-sm", state.ok ? "text-emerald-700" : "text-red-600")}>{state.message}</p>
      ) : null}
      <Button className="w-fit gap-2" disabled={isPending} type="submit">
        <SaveIcon className="size-4" />
        {isPending ? "Saving..." : "Save collection profile"}
      </Button>
    </form>
  );
}

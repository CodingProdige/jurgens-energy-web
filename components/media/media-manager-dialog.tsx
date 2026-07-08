"use client";

import {
  type MouseEvent,
  type ReactNode,
  useActionState,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ArrowDownIcon,
  ArrowLeftIcon,
  BarChart3Icon,
  CheckIcon,
  ChevronRightIcon,
  CloudUploadIcon,
  CopyIcon,
  CrownIcon,
  CreditCardIcon,
  DownloadIcon,
  FileImageIcon,
  FileTextIcon,
  FileVideoIcon,
  FilterIcon,
  FolderIcon,
  Grid2X2Icon,
  ImageIcon,
  ListIcon,
  LockIcon,
  MoreVerticalIcon,
  PauseIcon,
  PencilIcon,
  PlayIcon,
  RefreshCwIcon,
  SearchIcon,
  ShieldCheckIcon,
  SlidersHorizontalIcon,
  TagIcon,
  Trash2Icon,
  UploadIcon,
  Volume2Icon,
  VolumeXIcon,
  XIcon,
  ZapIcon,
} from "lucide-react";

import {
  createAdminMediaFolder,
  deleteAdminMediaAsset,
  deleteAdminMediaFolder,
  renameAdminMediaFolder,
  setAdminMediaAssetFolders,
  updateAdminMediaMetadata,
  type MediaMetadataState,
} from "@/app/(admin)/admin/(dashboard)/media/actions";
import { deleteOwnerMediaAsset } from "@/components/media/actions";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import type {
  AdminMediaAsset,
  AdminMediaFolder,
  MediaStorageSettings,
} from "@/src/modules/media/admin";

type MediaManagerDialogProps = {
  acceptedMediaTypes?: MediaType[];
  allowMultipleSelection?: boolean;
  assets: AdminMediaAsset[];
  folders?: AdminMediaFolder[];
  onOpenChange: (open: boolean) => void;
  onSelect: (asset: AdminMediaAsset) => void;
  onSelectMany?: (assets: AdminMediaAsset[]) => void;
  open: boolean;
  selectedAssetId?: string | null;
  storage: MediaStorageSettings;
  surface?: MediaManagerSurface;
  title?: string;
  usedStorageBytes: number;
};

const initialMetadataState: MediaMetadataState = {};
type MediaType = "document" | "image" | "video";
type MediaManagerSurface = "admin" | "marketplace" | "seller";
type LibraryFilter =
  | "all"
  | "brand"
  | "document"
  | "image"
  | "product"
  | "trash"
  | "video"
  | `custom-${string}`;
type MediaDateFilter = "7d" | "30d" | "all" | "today";
type MediaFolderFilter =
  | "all"
  | "brand"
  | "document"
  | "none"
  | "product"
  | "trash"
  | `folder-${string}`;
type MediaSortOrder = "name" | "newest" | "oldest";
type MediaTypeFilter = "all" | MediaType;
type PendingUploadStatus = "uploading" | "processing" | "error";
type PendingMediaUpload = {
  id: string;
  message?: string;
  name: string;
  progress: number;
  previewUrl: string | null;
  status: PendingUploadStatus;
  type: MediaType | "unknown";
};
type StorageQuotaNotice = {
  excessBytes: number;
  fileCount: number;
  quotaBytes: number;
  uploadBytes: number;
  usedBytes: number;
};
type PremiumPlan = "monthly" | "yearly";
type PremiumStep = "intro" | "payment" | "plan" | "review" | "success";
type MediaDeleteRequest = {
  asset: AdminMediaAsset;
  source: "card" | "details";
} | null;
type MediaLibraryFolder = {
  filter: LibraryFilter;
  id?: string;
  label: string;
  value: number;
};

const MEDIA_FOLDER_NAME_MAX_LENGTH = 25;

const systemMediaFolders = [
  { filter: "brand", label: "Brand assets" },
  { filter: "product", label: "Product images" },
  { filter: "document", label: "Documents" },
  { filter: "trash", label: "Trash" },
] as const satisfies ReadonlyArray<{
  filter: Extract<LibraryFilter, "brand" | "document" | "product" | "trash">;
  label: string;
}>;

const mediaManagerAccentClasses = {
  admin: {
    activeLibrary:
      "border-[#c4982d]/25 bg-[#c4982d]/10 text-[#7a5b19] dark:text-[#f3d27a]",
    button: "bg-[#c4982d] text-white hover:bg-[#a87920]",
    dropzone:
      "hover:border-[#c4982d] hover:bg-[#c4982d]/5 dark:hover:border-[#c4982d]",
    icon: "text-[#c4982d]",
    progress: "bg-[#c4982d]",
    ring: "border-[#c4982d] ring-2 ring-[#c4982d]/20",
    selected: "bg-[#c4982d] text-white",
    success:
      "border-[#c4982d]/25 bg-[#c4982d]/10 text-[#7a5b19] dark:text-[#f3d27a]",
    tag: "bg-[#c4982d]/10 text-[#7a5b19] dark:text-[#f3d27a]",
  },
  marketplace: {
    activeLibrary:
      "border-[#fbe694]/40 bg-[#fbe694]/20 text-[#7a5b19] dark:text-[#fbe694]",
    button: "bg-[#f2bc05] text-zinc-950 hover:bg-[#d8a904]",
    dropzone:
      "hover:border-[#f2bc05] hover:bg-[#fbe694]/15 dark:hover:border-[#f2bc05]",
    icon: "text-[#f2bc05]",
    progress: "bg-[#f2bc05]",
    ring: "border-[#f2bc05] ring-2 ring-[#f2bc05]/20",
    selected: "bg-[#f2bc05] text-zinc-950",
    success:
      "border-[#fbe694]/40 bg-[#fbe694]/20 text-[#7a5b19] dark:text-[#fbe694]",
    tag: "bg-[#fbe694]/25 text-[#7a5b19] dark:text-[#fbe694]",
  },
  seller: {
    activeLibrary:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    button: "bg-emerald-700 text-white hover:bg-emerald-800",
    dropzone:
      "hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:border-emerald-500",
    icon: "text-emerald-600",
    progress: "bg-emerald-600",
    ring: "border-emerald-500 ring-2 ring-emerald-500/20",
    selected: "bg-emerald-600 text-white",
    success:
      "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
    tag: "bg-emerald-100 text-emerald-700",
  },
} satisfies Record<MediaManagerSurface, Record<string, string>>;

export function MediaManagerDialog({
  acceptedMediaTypes = ["document", "image", "video"],
  allowMultipleSelection = false,
  assets,
  folders: initialFolders = [],
  onOpenChange,
  onSelect,
  onSelectMany,
  open,
  selectedAssetId,
  storage,
  surface = "marketplace",
  title = "Media Manager",
  usedStorageBytes,
}: MediaManagerDialogProps) {
  const accent = mediaManagerAccentClasses[surface];
  const deleteMediaAsset =
    surface === "seller" ? deleteOwnerMediaAsset : deleteAdminMediaAsset;
  const [libraryAssets, setLibraryAssets] = useState(assets);
  const [localUsedStorageBytes, setLocalUsedStorageBytes] =
    useState(usedStorageBytes);
  const [persistedFolders, setPersistedFolders] =
    useState<AdminMediaFolder[]>(initialFolders);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>(
    selectedAssetId ? [selectedAssetId] : [],
  );
  const [activeTab, setActiveTab] = useState("library");
  const [libraryFilter, setLibraryFilter] = useState<LibraryFilter>("all");
  const [pendingUploads, setPendingUploads] = useState<PendingMediaUpload[]>(
    [],
  );
  const [deleteRequest, setDeleteRequest] = useState<MediaDeleteRequest>(null);
  const [deleteMessage, setDeleteMessage] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPremiumOpen, setIsPremiumOpen] = useState(false);
  const [storageQuotaNotice, setStorageQuotaNotice] =
    useState<StorageQuotaNotice | null>(null);
  const [mobilePanel, setMobilePanel] = useState<"library" | "details" | "storage">(
    "library",
  );
  const [query, setQuery] = useState("");
  const [sortOrder, setSortOrder] = useState<MediaSortOrder>("newest");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [mediaTypeFilter, setMediaTypeFilter] =
    useState<MediaTypeFilter>("all");
  const [folderFilter, setFolderFilter] = useState<MediaFolderFilter>("all");
  const [dateFilter, setDateFilter] = useState<MediaDateFilter>("all");
  const hasActiveMediaFilters =
    mediaTypeFilter !== "all" || folderFilter !== "all" || dateFilter !== "all";
  const selectedAsset =
    selectedAssetIds.length === 1
      ? libraryAssets.find((asset) => asset.id === selectedAssetIds[0]) ?? null
      : null;
  const selectedAssets = selectedAssetIds
    .map((assetId) => libraryAssets.find((asset) => asset.id === assetId))
    .filter((asset): asset is AdminMediaAsset => Boolean(asset));
  const hasDetailsPanel = Boolean(selectedAsset);
  const selectedAssetIsSelectable =
    selectedAsset ? isAssetSelectable(selectedAsset, acceptedMediaTypes) : false;
  const selectedAssetsAreSelectable =
    selectedAssets.length > 0 &&
    selectedAssets.every((asset) => isAssetSelectable(asset, acceptedMediaTypes));
  const imageCount = libraryAssets.filter((asset) =>
    asset.mimeType.startsWith("image/"),
  ).length;
  const videoCount = libraryAssets.filter((asset) =>
    asset.mimeType.startsWith("video/"),
  ).length;
  const systemFolderIds = useMemo(
    () => getSystemFolderIds(persistedFolders),
    [persistedFolders],
  );
  const documentCount = libraryAssets.filter(isDocumentAsset).length;
  const brandAssetCount = libraryAssets.filter(
    (asset) => isBrandAsset(asset) || hasAssetFolder(asset, systemFolderIds.brand),
  ).length;
  const productImageCount = libraryAssets.filter(
    (asset) => hasAssetFolder(asset, systemFolderIds.product),
  ).length;
  const trashCount = libraryAssets.filter(
    (asset) => hasAssetFolder(asset, systemFolderIds.trash),
  ).length;
  const folderAssetCounts = useMemo(() => {
    const counts = new Map<string, number>();

    libraryAssets.forEach((asset) => {
      getAssetFolderIds(asset).forEach((folderId) => {
        counts.set(folderId, (counts.get(folderId) ?? 0) + 1);
      });
    });

    return counts;
  }, [libraryAssets]);

  useEffect(() => {
    if (open) {
      setSelectedAssetIds([]);
    }
  }, [open]);

  const filteredAssets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    const filteredByLibrary = libraryAssets.filter((asset) => {
      if (libraryFilter === "image") {
        return asset.mimeType.startsWith("image/");
      }

      if (libraryFilter === "video") {
        return asset.mimeType.startsWith("video/");
      }

      if (libraryFilter === "document") {
        return isDocumentAsset(asset);
      }

      if (libraryFilter === "brand") {
        return isBrandAsset(asset) || hasAssetFolder(asset, systemFolderIds.brand);
      }

      if (libraryFilter === "product") {
        return hasAssetFolder(asset, systemFolderIds.product);
      }

      if (libraryFilter === "trash") {
        return hasAssetFolder(asset, systemFolderIds.trash);
      }

      if (libraryFilter.startsWith("custom-")) {
        return hasAssetFolder(asset, libraryFilter.replace(/^custom-/, ""));
      }

      return true;
    });

    const filteredBySearch = normalizedQuery
      ? filteredByLibrary.filter((asset) =>
          [
            asset.originalFileName,
            asset.altText,
            asset.mimeType,
            asset.tags,
          ].some((value) => value?.toLowerCase().includes(normalizedQuery)),
        )
      : filteredByLibrary;

    const filteredByControls = filteredBySearch.filter((asset) => {
      if (
        mediaTypeFilter !== "all" &&
        getAssetMediaType(asset) !== mediaTypeFilter
      ) {
        return false;
      }

      if (folderFilter === "none" && getAssetFolderIds(asset).length) {
        return false;
      }

      if (folderFilter === "brand" && !isBrandAsset(asset)) {
        return hasAssetFolder(asset, systemFolderIds.brand);
      }

      if (folderFilter === "document") {
        return hasAssetFolder(asset, systemFolderIds.document);
      }

      if (folderFilter === "product") {
        return hasAssetFolder(asset, systemFolderIds.product);
      }

      if (folderFilter === "trash") {
        return hasAssetFolder(asset, systemFolderIds.trash);
      }

      if (folderFilter.startsWith("folder-")) {
        return hasAssetFolder(asset, folderFilter.replace(/^folder-/, ""));
      }

      if (dateFilter !== "all") {
        const createdAt = new Date(asset.createdAt).getTime();
        const now = new Date();
        const threshold =
          dateFilter === "today"
            ? new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
            : Date.now() - (dateFilter === "7d" ? 7 : 30) * 24 * 60 * 60 * 1000;

        if (createdAt < threshold) {
          return false;
        }
      }

      return true;
    });

    return [...filteredByControls].sort((assetA, assetB) => {
      if (sortOrder === "name") {
        return (assetA.originalFileName ?? "").localeCompare(
          assetB.originalFileName ?? "",
        );
      }

      const createdA = new Date(assetA.createdAt).getTime();
      const createdB = new Date(assetB.createdAt).getTime();

      return sortOrder === "oldest" ? createdA - createdB : createdB - createdA;
    });
  }, [
    dateFilter,
    folderFilter,
    libraryAssets,
    libraryFilter,
    mediaTypeFilter,
    query,
    sortOrder,
    systemFolderIds,
  ]);

  useEffect(() => setLibraryAssets(assets), [assets]);
  useEffect(() => setLocalUsedStorageBytes(usedStorageBytes), [usedStorageBytes]);
  useEffect(() => setPersistedFolders(initialFolders), [initialFolders]);

  useEffect(
    () => () => {
      pendingUploads.forEach((upload) => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });
    },
    [pendingUploads],
  );

  function handleUploadStart(uploads: PendingMediaUpload[]) {
    setActiveTab("library");
    setLibraryFilter("all");
    setPendingUploads((current) => {
      current.forEach((upload) => {
        if (upload.previewUrl) {
          URL.revokeObjectURL(upload.previewUrl);
        }
      });

      return uploads;
    });
  }

  function handleUploadProgress({
    id,
    progress,
    status,
  }: {
    id: string;
    progress: number;
    status: PendingUploadStatus;
  }) {
    setPendingUploads((current) =>
      current.map((upload) =>
        upload.id === id ? { ...upload, progress, status } : upload,
      ),
    );
  }

  function handleUploadComplete({
    asset,
    id,
  }: {
    asset: AdminMediaAsset;
    id: string;
  }) {
    setLibraryAssets((current) =>
      current.some((currentAsset) => currentAsset.id === asset.id)
        ? current.map((currentAsset) =>
            currentAsset.id === asset.id ? asset : currentAsset,
          )
        : [asset, ...current],
    );
    setLocalUsedStorageBytes((current) => current + asset.byteSize);
    setSelectedAssetIds((current) => (current.length ? current : [asset.id]));
    setPendingUploads((current) => {
      const completedUpload = current.find((upload) => upload.id === id);

      if (completedUpload?.previewUrl) {
        URL.revokeObjectURL(completedUpload.previewUrl);
      }

      return current.filter((upload) => upload.id !== id);
    });
  }

  function handleAssetUpdated(asset: AdminMediaAsset) {
    const existingAsset = libraryAssets.find(
      (currentAsset) => currentAsset.id === asset.id,
    );

    setLibraryAssets((current) =>
      current.map((currentAsset) =>
        currentAsset.id === asset.id ? asset : currentAsset,
      ),
    );

    if (existingAsset) {
      setLocalUsedStorageBytes((usedBytes) =>
        Math.max(0, usedBytes - existingAsset.byteSize + asset.byteSize),
      );
    }
  }

  function handleAssetMoved(
    assetId: string,
    folderId: string | null,
    folderIds?: string[],
  ) {
    setLibraryAssets((current) =>
      current.map((asset) =>
        asset.id === assetId
          ? { ...asset, folderId, folderIds: folderIds ?? legacyFolderIds(folderId) }
          : asset,
      ),
    );
  }

  function handleUploadError({
    id,
    message,
    storageFull,
  }: {
    id: string;
    message: string;
    storageFull?: StorageQuotaNotice;
  }) {
    if (storageFull) {
      setStorageQuotaNotice(storageFull);
    }

    setPendingUploads((current) =>
      current.map((upload) =>
        upload.id === id
          ? { ...upload, message, progress: 100, status: "error" }
          : upload,
      ),
    );
  }

  function requestDeleteAsset(asset: AdminMediaAsset, source: "card" | "details") {
    setDeleteMessage(null);
    setDeleteRequest({ asset, source });
  }

  async function confirmDeleteAsset() {
    if (!deleteRequest) {
      return;
    }

    const asset = deleteRequest.asset;
    setIsDeleting(true);
    const result = await deleteMediaAsset(asset.id);
    setIsDeleting(false);

    if (!result.ok) {
      setDeleteMessage(result.message ?? "Could not delete this media asset.");
      return;
    }

    setLibraryAssets((current) =>
      current.filter((currentAsset) => currentAsset.id !== asset.id),
    );
    setLocalUsedStorageBytes((current) =>
      Math.max(0, current - asset.byteSize),
    );
    setSelectedAssetIds((current) =>
      current.filter((selectedId) => selectedId !== asset.id),
    );
    setDeleteRequest(null);
  }

  function toggleAssetSelection(asset: AdminMediaAsset) {
    if (!isAssetSelectable(asset, acceptedMediaTypes)) {
      return;
    }

    setSelectedAssetIds((current) =>
      current.includes(asset.id)
        ? current.filter((selectedId) => selectedId !== asset.id)
        : [...current, asset.id],
    );
  }

  function selectSingleAsset(asset: AdminMediaAsset) {
    if (!isAssetSelectable(asset, acceptedMediaTypes)) {
      return;
    }

    setSelectedAssetIds([asset.id]);
  }

  async function bulkDeleteSelectedAssets() {
    const idsToDelete = new Set(selectedAssetIds);
    const assetsToDelete = libraryAssets.filter((asset) =>
      idsToDelete.has(asset.id),
    );
    const blockedAsset = assetsToDelete.find((asset) => asset.usageCount > 0);

    if (blockedAsset) {
      setDeleteRequest({ asset: blockedAsset, source: "card" });
      setDeleteMessage(
        `This file is currently used by ${blockedAsset.usageCount} platform ${blockedAsset.usageCount === 1 ? "record" : "records"}. Remove that usage before deleting it.`,
      );
      return;
    }

    setIsDeleting(true);

    for (const asset of assetsToDelete) {
      const result = await deleteMediaAsset(asset.id);

      if (!result.ok) {
        setIsDeleting(false);
        setDeleteMessage(result.message ?? "Could not delete one of the selected files.");
        return;
      }
    }

    setIsDeleting(false);
    setLibraryAssets((current) =>
      current.filter((asset) => !idsToDelete.has(asset.id)),
    );
    setLocalUsedStorageBytes((current) =>
      Math.max(
        0,
        current -
          assetsToDelete.reduce((total, asset) => total + asset.byteSize, 0),
      ),
    );
    setSelectedAssetIds([]);
  }

  function openPremiumSubscription() {
    onOpenChange(false);
    window.setTimeout(() => setIsPremiumOpen(true), 120);
  }

  function useSelectedAsset() {
    if (allowMultipleSelection && onSelectMany) {
      if (!selectedAssetsAreSelectable) {
        return;
      }

      onSelectMany(selectedAssets);
      onOpenChange(false);
      return;
    }

    if (!selectedAsset || !selectedAssetIsSelectable) {
      return;
    }

    onSelect(selectedAsset);
    onOpenChange(false);
  }

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent
          showCloseButton={false}
          className="z-[80] h-[calc(100dvh-1rem)] max-h-[calc(100dvh-1rem)] w-[min(88rem,calc(100vw-1rem))] max-w-none overflow-hidden border border-slate-200 bg-white p-0 text-zinc-950 shadow-2xl shadow-black/20 sm:h-[min(54rem,calc(100dvh-1.5rem))] sm:max-h-[calc(100dvh-1.5rem)] sm:w-[min(88rem,calc(100vw-1.5rem))] sm:max-w-none dark:border-white/10 dark:bg-[#0d1218] dark:text-white dark:shadow-black/50"
          overlayClassName="z-[70] bg-black/72 backdrop-blur-sm"
        >
          <DialogHeader className="border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur md:px-6 dark:border-white/10 dark:bg-[#111820]/95">
            <div className="grid gap-4 lg:grid-cols-[22rem_minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <DialogTitle className="text-lg font-bold">{title}</DialogTitle>
                    <p className="mt-1 max-w-sm text-sm text-slate-500 dark:text-slate-400">
                      Upload, organize and manage your media files.
                    </p>
                  </div>
                  <Button
                    aria-label="Close media manager"
                    className="size-9 shrink-0 rounded-lg border-slate-200 bg-white text-zinc-950 hover:bg-slate-50 lg:hidden dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/10"
                    onClick={() => onOpenChange(false)}
                    size="icon"
                    type="button"
                    variant="outline"
                  >
                    <XIcon className="size-5" />
                  </Button>
                </div>
              </div>

              <div className="hidden min-w-0 items-center gap-3 lg:flex">
                <div className="relative w-full max-w-md">
                  <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                  <Input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search media..."
                    className="h-10 rounded-lg border-slate-200 bg-white pl-9 pr-12 text-sm text-zinc-950 placeholder:text-slate-400 focus-visible:ring-slate-200 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500 dark:focus-visible:ring-white/15"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded bg-slate-100 px-1.5 py-0.5 text-[0.65rem] font-semibold text-slate-500 dark:bg-white/5">
                    ⌘ K
                  </span>
                </div>
                <Button
                  className={cn(
                    "h-10 rounded-lg border-slate-200 bg-white px-4 text-zinc-950 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.07]",
                    hasActiveMediaFilters && accent.activeLibrary,
                  )}
                  onClick={() => setIsFilterOpen(true)}
                  type="button"
                  variant="outline"
                >
                  <FilterIcon className="size-4" />
                  Filter
                </Button>
                <MediaSortDropdown
                  onSortOrderChange={setSortOrder}
                  sortOrder={sortOrder}
                />
                <div className="flex rounded-lg border border-slate-200 bg-white p-1 dark:border-white/10 dark:bg-white/[0.03]">
                  <Button
                    aria-label="Grid view"
                    className={cn(
                      "size-8 border-0 bg-transparent text-slate-500 hover:bg-slate-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
                      viewMode === "grid" && "bg-slate-100 text-zinc-950 dark:bg-white/10 dark:text-white",
                    )}
                    onClick={() => setViewMode("grid")}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <Grid2X2Icon className="size-4" />
                  </Button>
                  <Button
                    aria-label="List view"
                    className={cn(
                      "size-8 border-0 bg-transparent text-slate-500 hover:bg-slate-100 hover:text-zinc-950 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white",
                      viewMode === "list" && "bg-slate-100 text-zinc-950 dark:bg-white/10 dark:text-white",
                    )}
                    onClick={() => setViewMode("list")}
                    size="icon-sm"
                    type="button"
                    variant="ghost"
                  >
                    <ListIcon className="size-4" />
                  </Button>
                </div>
              </div>

              <div className="hidden justify-end gap-3 lg:flex">
                <Button
                  className={cn("h-10 rounded-lg px-5 font-bold", accent.button)}
                  onClick={() => {
                    setActiveTab("upload");
                    setMobilePanel("library");
                  }}
                  type="button"
                >
                  <UploadIcon className="size-4" />
                  Upload
                </Button>
                <Button
                  aria-label="Close media manager"
                  className="size-10 rounded-lg border-slate-200 bg-white text-zinc-950 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/10"
                  onClick={() => onOpenChange(false)}
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <XIcon className="size-5" />
                </Button>
              </div>
            </div>
          </DialogHeader>

          <DialogBody className="overflow-hidden p-0">
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="h-full min-h-0 gap-0"
            >
              <div
                className={cn(
                  "grid h-full min-h-0 grid-cols-1",
                  hasDetailsPanel
                    ? "lg:grid-cols-[15rem_minmax(0,1fr)_19rem]"
                    : "lg:grid-cols-[15rem_minmax(0,1fr)]",
                )}
              >
                <aside className="hidden min-h-0 overflow-y-auto border-r border-slate-200 bg-slate-50/60 p-4 [scrollbar-width:none] dark:border-white/10 dark:bg-[#101820]/70 lg:block [&::-webkit-scrollbar]:hidden">
                  <StorageSummary
                    accent={accent}
                    onUnlockPremium={openPremiumSubscription}
                    storage={storage}
                    usedStorageBytes={localUsedStorageBytes}
                  />
                  <MediaLibraryNav
                    accent={accent}
                    brandAssetCount={brandAssetCount}
                    documentCount={documentCount}
                    folderAssetCounts={folderAssetCounts}
                    imageCount={imageCount}
                    initialFolders={persistedFolders}
                    libraryAssetsCount={libraryAssets.length}
                    libraryFilter={libraryFilter}
                    productImageCount={productImageCount}
                    setActiveTab={setActiveTab}
                    setLibraryFilter={setLibraryFilter}
                    trashCount={trashCount}
                    videoCount={videoCount}
                    onFolderCreated={(folder) =>
                      setPersistedFolders((current) => [...current, folder])
                    }
                    onFolderDeleted={(folderId) =>
                      setPersistedFolders((current) =>
                        current.filter((folder) => folder.id !== folderId),
                      )
                    }
                    onFolderRenamed={(folder) =>
                      setPersistedFolders((current) =>
                        current.map((currentFolder) =>
                          currentFolder.id === folder.id ? folder : currentFolder,
                        ),
                      )
                    }
                  />
                </aside>

                <main className="flex min-h-0 min-w-0 flex-col overflow-hidden">
                  <div className="grid gap-4 border-b border-slate-200 bg-white/90 p-4 dark:border-white/10 dark:bg-[#111820]/70 lg:hidden">
                    <div className="grid grid-cols-[minmax(0,1fr)_3rem] gap-3">
                      <div className="relative">
                        <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
                        <Input
                          value={query}
                          onChange={(event) => setQuery(event.target.value)}
                          placeholder="Search media..."
                          className="h-11 rounded-lg border-slate-200 bg-white pl-9 text-zinc-950 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
                        />
                      </div>
                      <Button
                        aria-label="Filter media"
                        className={cn(
                          "h-11 border-slate-200 bg-white text-zinc-950 hover:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/10",
                          hasActiveMediaFilters && accent.activeLibrary,
                        )}
                        onClick={() => setIsFilterOpen(true)}
                        type="button"
                        variant="outline"
                      >
                        <SlidersHorizontalIcon className="size-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
                      <button
                        className={cn(
                          "flex h-11 items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300",
                          mobilePanel === "library" &&
                            activeTab === "library" &&
                            accent.activeLibrary,
                        )}
                        onClick={() => {
                          setActiveTab("library");
                          setMobilePanel("library");
                        }}
                        type="button"
                      >
                        <ImageIcon className="size-4" />
                        Library
                      </button>
                      <button
                        className={cn(
                          "flex h-11 items-center justify-center gap-2 border-x border-slate-200 text-sm font-semibold text-slate-600 dark:border-white/10 dark:text-slate-300",
                          mobilePanel === "storage" && accent.activeLibrary,
                        )}
                        onClick={() => {
                          setActiveTab("library");
                          setMobilePanel("storage");
                        }}
                        type="button"
                      >
                        <FolderIcon className="size-4" />
                        Folders
                      </button>
                      <button
                        className={cn(
                          "flex h-11 items-center justify-center gap-2 text-sm font-semibold text-slate-600 dark:text-slate-300",
                          activeTab === "upload" && accent.activeLibrary,
                        )}
                        onClick={() => {
                          setActiveTab("upload");
                          setMobilePanel("library");
                        }}
                        type="button"
                      >
                        <UploadIcon className="size-4" />
                        Upload
                      </button>
                    </div>
                  </div>

                  {mobilePanel === "details" ? (
                    <div className="min-h-0 min-w-0 overflow-y-auto p-5 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
                      <div className="mb-5 flex items-center justify-between">
                        <button
                          className="inline-flex items-center gap-2 text-sm font-semibold text-zinc-950 dark:text-white"
                          onClick={() => setMobilePanel("library")}
                          type="button"
                        >
                          <ArrowDownIcon className="size-4 rotate-90" />
                          File Details
                        </button>
                        <button
                          className="text-slate-500 hover:text-zinc-950 dark:text-slate-300 dark:hover:text-white"
                          onClick={() => setMobilePanel("library")}
                          type="button"
                        >
                          <XIcon className="size-5" />
                        </button>
                      </div>
                      <MediaDetails
                        asset={selectedAsset}
                        acceptedMediaTypes={acceptedMediaTypes}
                        folders={persistedFolders}
                        onAssetMoved={handleAssetMoved}
                        onAssetUpdated={handleAssetUpdated}
                        onFolderCreated={(folder) =>
                          setPersistedFolders((current) =>
                            current.some((currentFolder) => currentFolder.id === folder.id)
                              ? current
                              : [...current, folder],
                          )
                        }
                        onDelete={(asset) => requestDeleteAsset(asset, "details")}
                        surface={surface}
                      />
                    </div>
                  ) : null}

                  {mobilePanel === "storage" ? (
                    <div className="grid min-h-0 gap-5 overflow-y-auto p-5 [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden">
                      <StorageSummary
                        accent={accent}
                        onUnlockPremium={openPremiumSubscription}
                        storage={storage}
                        usedStorageBytes={localUsedStorageBytes}
                        variant="mobile"
                      />
                      <MediaLibraryNav
                        accent={accent}
                        brandAssetCount={brandAssetCount}
                        documentCount={documentCount}
                        folderAssetCounts={folderAssetCounts}
                        imageCount={imageCount}
                        initialFolders={persistedFolders}
                        libraryAssetsCount={libraryAssets.length}
                        libraryFilter={libraryFilter}
                        productImageCount={productImageCount}
                        setActiveTab={setActiveTab}
                        setLibraryFilter={setLibraryFilter}
                        showLibrarySection={false}
                        trashCount={trashCount}
                        videoCount={videoCount}
                        onFolderCreated={(folder) =>
                          setPersistedFolders((current) => [...current, folder])
                        }
                        onFolderDeleted={(folderId) =>
                          setPersistedFolders((current) =>
                            current.filter((folder) => folder.id !== folderId),
                          )
                        }
                        onFolderRenamed={(folder) =>
                          setPersistedFolders((current) =>
                            current.map((currentFolder) =>
                              currentFolder.id === folder.id
                                ? folder
                                : currentFolder,
                            ),
                          )
                        }
                        onFilterSelected={() => setMobilePanel("library")}
                      />
                    </div>
                  ) : null}

                  <div
                    className={cn(
                      "contents",
                      mobilePanel !== "library" &&
                        activeTab !== "upload" &&
                        "hidden lg:contents",
                    )}
                  >
                    {activeTab === "library" ? (
                    <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white/80 px-4 py-3 dark:border-white/10 dark:bg-[#111820]/60 lg:hidden">
                      <p className="text-sm font-bold">
                        {getLibraryFilterLabel(libraryFilter)}{" "}
                        <span className="font-normal text-slate-500 dark:text-slate-400">
                          {filteredAssets.length.toLocaleString()} files
                        </span>
                      </p>
                      <MediaSortDropdown
                        className="h-9"
                        onSortOrderChange={setSortOrder}
                        sortOrder={sortOrder}
                      />
                    </div>
                    ) : null}
                    <TabsContent
                      value="library"
                      className="min-h-0 overflow-y-auto p-4 [scrollbar-width:none] lg:p-5 [&::-webkit-scrollbar]:hidden"
                    >
                      <div className="mb-5 hidden items-center justify-between lg:flex">
                        <p className="text-sm font-bold">
                          {getLibraryFilterLabel(libraryFilter)}{" "}
                          <span className="font-normal text-slate-400">
                            {filteredAssets.length.toLocaleString()} files
                          </span>
                        </p>
                      </div>

                      <div
                        className={cn(
                          "grid gap-4",
                          viewMode === "grid"
                            ? "grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5"
                            : "grid-cols-1",
                        )}
                      >
                        {pendingUploads.map((upload) => (
                          <PendingUploadCard
                            accent={accent}
                            key={upload.id}
                            onRemove={() => {
                              setPendingUploads((current) => {
                                const removedUpload = current.find(
                                  (currentUpload) =>
                                    currentUpload.id === upload.id,
                                );

                                if (removedUpload?.previewUrl) {
                                  URL.revokeObjectURL(removedUpload.previewUrl);
                                }

                                return current.filter(
                                  (currentUpload) => currentUpload.id !== upload.id,
                                );
                              });
                            }}
                            upload={upload}
                          />
                        ))}
                        {filteredAssets.map((asset) => (
                          <MediaAssetCard
                            acceptedMediaTypes={acceptedMediaTypes}
                            accent={accent}
                            active={selectedAssetIds.includes(asset.id)}
                            asset={asset}
                            folders={persistedFolders}
                            key={asset.id}
                            onAssetMoved={handleAssetMoved}
                            onDelete={() => requestDeleteAsset(asset, "card")}
                            onDetails={() => setMobilePanel("details")}
                            onFolderCreated={(folder) =>
                              setPersistedFolders((current) =>
                                current.some(
                                  (currentFolder) => currentFolder.id === folder.id,
                                )
                                  ? current
                                  : [...current, folder],
                              )
                            }
                            onSelect={() => toggleAssetSelection(asset)}
                            onSelectSingle={() => selectSingleAsset(asset)}
                            viewMode={viewMode}
                          />
                        ))}
                      </div>
                    </TabsContent>

                    <TabsContent
                      value="upload"
                      className="min-h-0 overflow-y-auto p-4 lg:p-6"
                    >
                      <MediaUploadForm
                        accent={accent}
                        acceptedMediaTypes={acceptedMediaTypes}
                        onUploadComplete={handleUploadComplete}
                        onUploadError={handleUploadError}
                        onUploadProgress={handleUploadProgress}
                        onUploadStart={handleUploadStart}
                        surface={surface}
                      />
                    </TabsContent>
                  </div>
                </main>

                {hasDetailsPanel ? (
                  <aside className="hidden min-h-0 w-80 min-w-0 max-w-80 shrink-0 overflow-y-auto overflow-x-hidden border-l border-slate-200 bg-slate-50/60 p-5 [scrollbar-width:none] dark:border-white/10 dark:bg-[#101820]/70 lg:block [&::-webkit-scrollbar]:hidden">
                    <MediaDetails
                      asset={selectedAsset}
                      acceptedMediaTypes={acceptedMediaTypes}
                      folders={persistedFolders}
                      onAssetMoved={handleAssetMoved}
                      onAssetUpdated={handleAssetUpdated}
                      onFolderCreated={(folder) =>
                        setPersistedFolders((current) =>
                          current.some((currentFolder) => currentFolder.id === folder.id)
                            ? current
                            : [...current, folder],
                        )
                      }
                      onDelete={(asset) => requestDeleteAsset(asset, "details")}
                      surface={surface}
                    />
                  </aside>
                ) : null}
              </div>
            </Tabs>
          </DialogBody>

          <DialogFooter className="items-center border-slate-200 bg-white/95 px-4 py-3 dark:border-white/10 dark:bg-[#111820]/95 sm:justify-between">
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {selectedAssetIds.length
                ? `${selectedAssetIds.length} selected`
                : "Select a media file"}
              {selectedAsset && !selectedAssetIsSelectable
                ? " - not valid for this field"
                : ""}
              {selectedAssetIds.length ? (
                <button
                  className="ml-4 font-semibold text-emerald-400 hover:text-emerald-300"
                  onClick={() => setSelectedAssetIds([])}
                  type="button"
                >
                  Clear
                </button>
              ) : null}
            </p>
            <div className="flex items-center gap-3">
              {selectedAssetIds.length > 1 ? (
                <Button
                  className="h-10 justify-center rounded-lg border-red-500/25 text-red-600 hover:bg-red-50 hover:text-red-700 dark:text-red-300 dark:hover:bg-red-950/30 dark:hover:text-red-200"
                  disabled={isDeleting}
                  onClick={() => void bulkDeleteSelectedAssets()}
                  type="button"
                  variant="outline"
                >
                  <Trash2Icon className="size-4" />
                  {isDeleting ? "Deleting..." : "Delete selected"}
                </Button>
              ) : null}
              <Button
                className={cn(
                  "h-10 min-w-28 justify-center rounded-lg font-bold",
                  accent.button,
                )}
                disabled={
                  allowMultipleSelection
                    ? !selectedAssetsAreSelectable
                    : !selectedAssetIsSelectable
                }
                onClick={useSelectedAsset}
                type="button"
              >
                Use selected
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <MediaDeleteDialog
        deleteMessage={deleteMessage}
        deleteRequest={deleteRequest}
        isDeleting={isDeleting}
        onConfirm={() => void confirmDeleteAsset()}
        onOpenChange={(nextOpen) => {
          if (!nextOpen && !isDeleting) {
            setDeleteRequest(null);
            setDeleteMessage(null);
          }
        }}
      />
      <StorageFullDialog
        notice={storageQuotaNotice}
        onFreeUpSpace={() => {
          setStorageQuotaNotice(null);
          setActiveTab("library");
          setMobilePanel("library");
        }}
        onOpenChange={(openState) => {
          if (!openState) {
            setStorageQuotaNotice(null);
          }
        }}
        onUnlockPremium={() => {
          setStorageQuotaNotice(null);
          openPremiumSubscription();
        }}
        storage={storage}
      />
      <MediaFilterDialog
        accent={accent}
        dateFilter={dateFilter}
        folderFilter={folderFilter}
        folders={persistedFolders}
        mediaTypeFilter={mediaTypeFilter}
        onClear={() => {
          setMediaTypeFilter("all");
          setFolderFilter("all");
          setDateFilter("all");
        }}
        onOpenChange={setIsFilterOpen}
        open={isFilterOpen}
        setDateFilter={setDateFilter}
        setFolderFilter={setFolderFilter}
        setMediaTypeFilter={setMediaTypeFilter}
      />
      <PremiumSubscriptionDialog
        open={isPremiumOpen}
        onOpenChange={setIsPremiumOpen}
        storage={storage}
      />
    </>
  );
}

function MediaDeleteDialog({
  deleteMessage,
  deleteRequest,
  isDeleting,
  onConfirm,
  onOpenChange,
}: {
  deleteMessage: string | null;
  deleteRequest: MediaDeleteRequest;
  isDeleting: boolean;
  onConfirm: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  const asset = deleteRequest?.asset;

  return (
    <Dialog open={Boolean(deleteRequest)} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[110] w-[min(28rem,calc(100vw-2rem))] border border-slate-200 bg-white text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white"
        overlayClassName="z-[100] bg-black/35"
      >
        <DialogHeader className="border-b border-slate-200 dark:border-white/10">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500/10 text-red-600 dark:text-red-300">
              <Trash2Icon className="size-5" />
            </span>
            <div className="min-w-0">
              <DialogTitle className="text-base font-bold">
                Delete media asset?
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-zinc-400">
                This removes the optimized file and its database record.
              </p>
            </div>
          </div>
        </DialogHeader>
        <DialogBody className="grid gap-3">
          <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
            <p className="font-semibold">
              {asset?.originalFileName ?? "Selected media asset"}
            </p>
            <p className="mt-1 text-xs">
              {asset && asset.usageCount > 0
                ? `This file is currently used by ${asset.usageCount} platform ${asset.usageCount === 1 ? "record" : "records"}. Remove that usage before deleting it.`
                : "This cannot be undone. If the file is used by a brand or product, deletion will be blocked."}
            </p>
          </div>
          {deleteMessage ? (
            <p className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">
              {deleteMessage}
            </p>
          ) : null}
        </DialogBody>
        <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
          <Button
            disabled={isDeleting}
            onClick={() => onOpenChange(false)}
            type="button"
            variant="outline"
          >
            Cancel
          </Button>
          <Button
            className="justify-center bg-red-600 text-white hover:bg-red-700"
            disabled={isDeleting}
            onClick={onConfirm}
            type="button"
          >
            <Trash2Icon className="size-4" />
            {isDeleting ? "Deleting..." : "Delete file"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StorageFullDialog({
  notice,
  onFreeUpSpace,
  onOpenChange,
  onUnlockPremium,
  storage,
}: {
  notice: StorageQuotaNotice | null;
  onFreeUpSpace: () => void;
  onOpenChange: (open: boolean) => void;
  onUnlockPremium: () => void;
  storage: MediaStorageSettings;
}) {
  const quotaBytes = notice?.quotaBytes ?? storage.freeStorageQuotaMb * 1024 * 1024;
  const usedBytes = notice ? Math.min(quotaBytes, notice.usedBytes) : 0;
  const displayUsedBytes = notice
    ? Math.min(quotaBytes, notice.usedBytes + notice.uploadBytes)
    : usedBytes;
  const usagePercent = quotaBytes > 0
    ? Math.min(100, Math.round((displayUsedBytes / quotaBytes) * 100))
    : 0;
  const premiumBytes = storage.premiumStorageQuotaMb * 1024 * 1024;

  return (
    <Dialog open={Boolean(notice)} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[130] w-[min(52rem,calc(100vw-2rem))] border border-white/10 bg-[#0c1117] text-white shadow-2xl"
        overlayClassName="z-[120] bg-black/70 backdrop-blur-md"
      >
        <DialogHeader className="border-b-0 pb-0 text-center">
          <button
            aria-label="Close storage warning"
            className="absolute right-5 top-5 grid size-9 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white"
            onClick={() => onOpenChange(false)}
            type="button"
          >
            <XIcon className="size-6" />
          </button>
          <div className="mx-auto grid size-16 place-items-center rounded-full bg-red-500/10 text-red-400">
            <CloudUploadIcon className="size-10" />
          </div>
          <DialogTitle className="mt-4 text-3xl font-black tracking-tight text-white">
            Not enough storage
          </DialogTitle>
          <p className="mx-auto mt-3 max-w-lg text-base leading-relaxed text-slate-300">
            You have run out of storage space. Upgrade your plan or free up
            space to continue uploading.
          </p>
        </DialogHeader>

        <DialogBody className="grid gap-4 pt-6">
          <section className="rounded-xl border border-white/10 bg-white/[0.035] p-5">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
              Storage usage
            </p>
            <div className="mt-6 flex items-end justify-between gap-4">
              <p className="text-2xl font-semibold text-slate-300">
                <span className="font-black text-red-400">
                  {formatBytes(displayUsedBytes)}
                </span>{" "}
                used
              </p>
              <p className="text-2xl font-semibold text-slate-300">
                {formatBytes(quotaBytes)} total
              </p>
            </div>
            <div className="mt-5 h-3 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full bg-red-400"
                style={{ width: `${Math.max(4, usagePercent)}%` }}
              />
            </div>
            <p className="mt-2 text-right text-sm font-bold text-red-400">
              {usagePercent}%
            </p>
          </section>

          <section className="grid gap-4 rounded-xl border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-[1fr_1fr] sm:items-center">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-slate-400">
                Uploading
              </p>
              <p className="mt-3 text-xl font-black text-white">
                {notice?.fileCount ?? 1}{" "}
                {(notice?.fileCount ?? 1) === 1 ? "file" : "files"} (
                {formatBytes(notice?.uploadBytes ?? 0)})
              </p>
              <p className="mt-2 text-sm text-slate-400">Total upload size</p>
            </div>
            <div className="flex items-start gap-4 rounded-xl bg-red-500/10 p-4 text-red-300">
              <span className="grid size-10 shrink-0 place-items-center rounded-full bg-red-500/20 text-red-300">
                !
              </span>
              <p className="text-base leading-relaxed text-slate-300">
                This upload exceeds your available storage by{" "}
                <span className="font-bold text-red-400">
                  {formatBytes(notice?.excessBytes ?? 0)}
                </span>
              </p>
            </div>
          </section>

          <section className="rounded-xl border border-[#fbe694]/20 bg-[#fbe694]/10 p-5">
            <div className="grid gap-5 sm:grid-cols-[1.1fr_1fr] sm:items-center">
              <div className="flex items-start gap-4">
                <span className="grid size-14 shrink-0 place-items-center rounded-full bg-[#fbe694]/10 text-[#fbe694]">
                  <CrownIcon className="size-7" />
                </span>
                <div>
                  <p className="text-xl font-black text-white">Unlock more space</p>
                  <p className="mt-2 text-sm leading-relaxed text-slate-300">
                    Get more storage, advanced tools and priority support with
                    Premium.
                  </p>
                </div>
              </div>
              <ul className="grid gap-3 text-sm text-slate-300">
                {[
                  `${formatBytes(premiumBytes)} of storage`,
                  "Advanced media tools",
                  "Priority support",
                  "And much more",
                ].map((benefit) => (
                  <li className="flex items-center gap-3" key={benefit}>
                    <CheckIcon className="size-4 text-[#fbe694]" />
                    {benefit}
                  </li>
                ))}
              </ul>
            </div>
            <Button
              className="mt-5 h-11 w-full justify-center rounded-lg bg-gradient-to-r from-[#fbe694] to-[#f2bc05] font-bold text-zinc-950 hover:from-[#f4d96e] hover:to-[#d8a904] sm:w-80"
              onClick={onUnlockPremium}
              type="button"
            >
              Unlock Premium
              <ChevronRightIcon className="ml-auto size-4" />
            </Button>
          </section>

          <div className="grid items-center gap-4 sm:grid-cols-[1fr_auto_1fr]">
            <div className="h-px bg-white/10" />
            <p className="text-sm font-bold uppercase text-slate-300">Or</p>
            <div className="h-px bg-white/10" />
          </div>
        </DialogBody>

        <DialogFooter className="border-t-0 pt-0">
          <Button
            className="h-11 w-full justify-center rounded-lg border-red-400/35 bg-transparent text-red-300 hover:bg-red-500/10 hover:text-red-200"
            onClick={onFreeUpSpace}
            type="button"
            variant="outline"
          >
            <Trash2Icon className="size-4" />
            Free up space
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediaFilterDialog({
  accent,
  dateFilter,
  folderFilter,
  folders,
  mediaTypeFilter,
  onClear,
  onOpenChange,
  open,
  setDateFilter,
  setFolderFilter,
  setMediaTypeFilter,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  dateFilter: MediaDateFilter;
  folderFilter: MediaFolderFilter;
  folders: AdminMediaFolder[];
  mediaTypeFilter: MediaTypeFilter;
  onClear: () => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  setDateFilter: (filter: MediaDateFilter) => void;
  setFolderFilter: (filter: MediaFolderFilter) => void;
  setMediaTypeFilter: (filter: MediaTypeFilter) => void;
}) {
  const hasActiveFilters =
    mediaTypeFilter !== "all" || folderFilter !== "all" || dateFilter !== "all";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="z-[120] w-[min(26rem,calc(100vw-2rem))] border border-slate-200 bg-white p-0 text-zinc-950 shadow-2xl dark:border-white/10 dark:bg-[#101214] dark:text-white"
        overlayClassName="z-[110] bg-black/35"
      >
        <DialogHeader className="border-b border-slate-200 dark:border-white/10">
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-base font-bold">
                Filter media
              </DialogTitle>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
                Narrow the current media library.
              </p>
            </div>
            {hasActiveFilters ? (
              <button
                className="text-sm font-semibold text-slate-500 transition hover:text-zinc-950 dark:text-slate-400 dark:hover:text-white"
                onClick={onClear}
                type="button"
              >
                Clear
              </button>
            ) : null}
          </div>
        </DialogHeader>
        <DialogBody className="grid max-h-[min(28rem,calc(100dvh-12rem))] gap-4 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <MediaFilterField label="Media type">
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              onChange={(event) =>
                setMediaTypeFilter(event.target.value as MediaTypeFilter)
              }
              value={mediaTypeFilter}
            >
              <option value="all">All types</option>
              <option value="image">Images</option>
              <option value="video">Videos</option>
              <option value="document">Documents</option>
            </select>
          </MediaFilterField>

          <MediaFilterField label="Folder">
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              onChange={(event) =>
                setFolderFilter(event.target.value as MediaFolderFilter)
              }
              value={folderFilter}
            >
              <option value="all">All folders</option>
              <option value="none">No folder</option>
              <optgroup label="Library">
                <option value="brand">Brand assets</option>
                <option value="product">Product images</option>
                <option value="document">Documents</option>
                <option value="trash">Trash</option>
              </optgroup>
              {getCustomMediaFolders(folders).length ? (
                <optgroup label="Custom folders">
                  {getCustomMediaFolders(folders).map((folder) => (
                    <option key={folder.id} value={`folder-${folder.id}`}>
                      {folder.name}
                    </option>
                  ))}
                </optgroup>
              ) : null}
            </select>
          </MediaFilterField>

          <MediaFilterField label="Uploaded">
            <select
              className="h-10 w-full rounded-lg border border-slate-200 bg-white px-3 text-sm text-zinc-950 outline-none focus:border-slate-300 dark:border-white/10 dark:bg-white/[0.03] dark:text-white"
              onChange={(event) =>
                setDateFilter(event.target.value as MediaDateFilter)
              }
              value={dateFilter}
            >
              <option value="all">Any time</option>
              <option value="today">Today</option>
              <option value="7d">Last 7 days</option>
              <option value="30d">Last 30 days</option>
            </select>
          </MediaFilterField>
        </DialogBody>
        <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
          <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
            Cancel
          </Button>
          <Button
            className={cn("justify-center", accent.button)}
            onClick={() => onOpenChange(false)}
            type="button"
          >
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MediaFilterField({
  children,
  label,
}: {
  children: ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label className="text-xs font-bold text-zinc-950 dark:text-white">
        {label}
      </Label>
      {children}
    </div>
  );
}

function MediaLibraryNav({
  accent,
  brandAssetCount,
  documentCount,
  folderAssetCounts,
  imageCount,
  initialFolders,
  libraryAssetsCount,
  libraryFilter,
  onFolderCreated,
  onFolderDeleted,
  onFolderRenamed,
  onFilterSelected,
  productImageCount,
  setActiveTab,
  setLibraryFilter,
  showLibrarySection = true,
  trashCount,
  videoCount,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  brandAssetCount: number;
  documentCount: number;
  folderAssetCounts: Map<string, number>;
  imageCount: number;
  initialFolders: AdminMediaFolder[];
  libraryAssetsCount: number;
  libraryFilter: LibraryFilter;
  onFolderCreated: (folder: AdminMediaFolder) => void;
  onFolderDeleted: (folderId: string) => void;
  onFolderRenamed: (folder: AdminMediaFolder) => void;
  onFilterSelected?: () => void;
  productImageCount: number;
  setActiveTab: (tab: string) => void;
  setLibraryFilter: (filter: LibraryFilter) => void;
  showLibrarySection?: boolean;
  trashCount: number;
  videoCount: number;
}) {
  const [folders, setFolders] = useState<MediaLibraryFolder[]>([
    { filter: "brand" as const, label: "Brand assets", value: brandAssetCount },
    { filter: "product" as const, label: "Product images", value: productImageCount },
    { filter: "document" as const, label: "Documents", value: documentCount },
    { filter: "trash" as const, label: "Trash", value: trashCount },
  ]);
  const [editingFolder, setEditingFolder] = useState<MediaLibraryFolder | null>(
    null,
  );
  const [editingFolderName, setEditingFolderName] = useState("");
  const [isCreateFolderOpen, setIsCreateFolderOpen] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");

  useEffect(() => {
    setFolders((current) =>
      current.map((folder) => {
        if (folder.filter === "brand") {
          return { ...folder, value: brandAssetCount };
        }

        if (folder.filter === "product") {
          return { ...folder, value: productImageCount };
        }

        if (folder.filter === "document") {
          return { ...folder, value: documentCount };
        }

        if (folder.filter === "trash") {
          return { ...folder, value: trashCount };
        }

        return folder;
      }),
    );
  }, [brandAssetCount, documentCount, productImageCount, trashCount]);

  useEffect(() => {
    setFolders((current) => {
      const defaultFolders = current.filter(
        (folder) => !folder.filter.startsWith("custom-"),
      );
      const nextCustomFolders = getCustomMediaFolders(initialFolders).map(
        (folder) => ({
          filter: `custom-${folder.id}` as LibraryFilter,
          id: folder.id,
          label: folder.name,
          value: folderAssetCounts.get(folder.id) ?? 0,
        }),
      );

      return [...defaultFolders, ...nextCustomFolders];
    });
  }, [folderAssetCounts, initialFolders]);

  async function createFolder() {
    const nextName = newFolderName.trim();

    if (!nextName) {
      return;
    }

    const result = await createAdminMediaFolder(nextName);

    if (result.ok && result.folder) {
      onFolderCreated(result.folder);
      setIsCreateFolderOpen(false);
      setNewFolderName("");
    }
  }

  function openFolderEditor(folder: MediaLibraryFolder) {
    setEditingFolder(folder);
    setEditingFolderName(folder.label);
  }

  async function saveFolderName() {
    if (!editingFolder?.id) {
      return;
    }

    const nextName = editingFolderName.trim();

    if (!nextName) {
      return;
    }

    const result = await renameAdminMediaFolder(editingFolder.id, nextName);

    if (result.ok && result.folder) {
      onFolderRenamed(result.folder);
      setEditingFolder(null);
      setEditingFolderName("");
    }
  }

  async function deleteFolder(folder: MediaLibraryFolder) {
    if (!folder.id) {
      return;
    }

    const result = await deleteAdminMediaFolder(folder.id);

    if (!result.ok) {
      return;
    }

    onFolderDeleted(folder.id);

    if (libraryFilter === folder.filter) {
      setLibraryFilter("all");
      setActiveTab("library");
    }
  }

  function moveFolder(filter: LibraryFilter, direction: "down" | "up") {
    setFolders((current) => {
      const index = current.findIndex((folder) => folder.filter === filter);
      const nextIndex = direction === "up" ? index - 1 : index + 1;

      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) {
        return current;
      }

      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];

      return next;
    });
  }

  return (
    <>
      <div className="grid gap-5">
        {showLibrarySection ? (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-xs font-bold text-zinc-950 dark:text-white">
                Library
              </p>
            </div>
            <div className="grid gap-1.5">
              <LibraryButton
                accent={accent}
                active={libraryFilter === "all"}
                icon={Grid2X2Icon}
                label="All files"
                onClick={() => {
                  setLibraryFilter("all");
                  setActiveTab("library");
                  onFilterSelected?.();
                }}
                value={libraryAssetsCount}
              />
              <LibraryButton
                accent={accent}
                active={libraryFilter === "image"}
                icon={ImageIcon}
                label="Images"
                onClick={() => {
                  setLibraryFilter("image");
                  setActiveTab("library");
                  onFilterSelected?.();
                }}
                value={imageCount}
              />
              <LibraryButton
                accent={accent}
                active={libraryFilter === "video"}
                icon={FileVideoIcon}
                label="Videos"
                onClick={() => {
                  setLibraryFilter("video");
                  setActiveTab("library");
                  onFilterSelected?.();
                }}
                value={videoCount}
              />
              <LibraryButton
                accent={accent}
                active={libraryFilter === "document"}
                icon={FileTextIcon}
                label="Documents"
                onClick={() => {
                  setLibraryFilter("document");
                  setActiveTab("library");
                  onFilterSelected?.();
                }}
                value={documentCount}
              />
            </div>
          </div>
        ) : null}

        <div>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-xs font-bold text-zinc-950 dark:text-white">Folders</p>
            <Button
              aria-label="Add folder"
              className="size-7 border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-zinc-950 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white"
              onClick={() => setIsCreateFolderOpen(true)}
              size="icon-sm"
              type="button"
              variant="outline"
            >
              +
            </Button>
          </div>
          <div className="grid gap-1.5">
            {folders.map((folder, index) => (
              <FolderButton
                accent={accent}
                active={libraryFilter === folder.filter}
                canMoveDown={index < folders.length - 1}
                canMoveUp={index > 0}
                folder={folder}
                key={folder.filter}
                onClick={() => {
                  setLibraryFilter(folder.filter);
                  setActiveTab("library");
                  onFilterSelected?.();
                }}
                onDelete={() => void deleteFolder(folder)}
                onEdit={() => openFolderEditor(folder)}
                onMoveDown={() => moveFolder(folder.filter, "down")}
                onMoveUp={() => moveFolder(folder.filter, "up")}
              />
            ))}
          </div>
        </div>
      </div>

      <Dialog
        open={isCreateFolderOpen}
        onOpenChange={(open) => {
          setIsCreateFolderOpen(open);

          if (!open) {
            setNewFolderName("");
          }
        }}
      >
        <DialogContent className="z-[120] w-[min(24rem,calc(100vw-2rem))] border border-slate-200 bg-white text-zinc-950 dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader className="border-b border-slate-200 dark:border-white/10">
            <DialogTitle className="text-base font-bold">Add folder</DialogTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Create a media folder to organize reusable assets.
            </p>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-2">
              <Label htmlFor="new-media-folder-name">Folder name</Label>
              <Input
                autoFocus
                id="new-media-folder-name"
                maxLength={MEDIA_FOLDER_NAME_MAX_LENGTH}
                onChange={(event) =>
                  setNewFolderName(
                    event.target.value.slice(0, MEDIA_FOLDER_NAME_MAX_LENGTH),
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void createFolder();
                  }
                }}
                placeholder="e.g. Campaign assets"
                value={newFolderName}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {newFolderName.length}/{MEDIA_FOLDER_NAME_MAX_LENGTH} characters
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
            <Button
              onClick={() => {
                setIsCreateFolderOpen(false);
                setNewFolderName("");
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className={cn("justify-center", accent.button)}
              disabled={!newFolderName.trim()}
              onClick={() => void createFolder()}
              type="button"
            >
              Create folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={Boolean(editingFolder)}
        onOpenChange={(open) => {
          if (!open) {
            setEditingFolder(null);
            setEditingFolderName("");
          }
        }}
      >
        <DialogContent className="z-[120] w-[min(24rem,calc(100vw-2rem))] border border-slate-200 bg-white text-zinc-950 dark:border-white/10 dark:bg-[#101214] dark:text-white">
          <DialogHeader className="border-b border-slate-200 dark:border-white/10">
            <DialogTitle className="text-base font-bold">Edit folder</DialogTitle>
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Rename this media folder.
            </p>
          </DialogHeader>
          <DialogBody>
            <div className="grid gap-2">
              <Label htmlFor="media-folder-name">Folder name</Label>
              <Input
                id="media-folder-name"
                maxLength={MEDIA_FOLDER_NAME_MAX_LENGTH}
                onChange={(event) =>
                  setEditingFolderName(
                    event.target.value.slice(0, MEDIA_FOLDER_NAME_MAX_LENGTH),
                  )
                }
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    saveFolderName();
                  }
                }}
                value={editingFolderName}
              />
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {editingFolderName.length}/{MEDIA_FOLDER_NAME_MAX_LENGTH}{" "}
                characters
              </p>
            </div>
          </DialogBody>
          <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
            <Button
              onClick={() => {
                setEditingFolder(null);
                setEditingFolderName("");
              }}
              type="button"
              variant="outline"
            >
              Cancel
            </Button>
            <Button
              className={cn("justify-center", accent.button)}
              disabled={!editingFolderName.trim()}
              onClick={saveFolderName}
              type="button"
            >
              Save folder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function FolderButton({
  accent,
  active,
  canMoveDown,
  canMoveUp,
  folder,
  onClick,
  onDelete,
  onEdit,
  onMoveDown,
  onMoveUp,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  active: boolean;
  canMoveDown: boolean;
  canMoveUp: boolean;
  folder: MediaLibraryFolder;
  onClick: () => void;
  onDelete: () => void;
  onEdit: () => void;
  onMoveDown: () => void;
  onMoveUp: () => void;
}) {
  const isCustomFolder = Boolean(folder.id);

  return (
    <div
      className={cn(
        "group/folder flex h-9 items-center gap-1 rounded-lg px-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-zinc-950 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white",
        active && accent.activeLibrary,
      )}
    >
      <button
        className="flex min-w-0 flex-1 items-center gap-2 text-left"
        onClick={onClick}
        type="button"
      >
        <FolderIcon className="size-4 shrink-0" />
        <span className="min-w-0 flex-1 truncate">{folder.label}</span>
        <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
          {folder.value}
        </span>
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              aria-label={`Open actions for ${folder.label}`}
              className="grid size-7 shrink-0 place-items-center rounded-md text-slate-500 opacity-100 outline-none transition hover:bg-slate-200/70 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-white/30 data-[popup-open]:bg-slate-200/70 dark:text-slate-400 dark:hover:bg-white/10 dark:hover:text-white dark:data-[popup-open]:bg-white/10"
              onClick={(event) => event.stopPropagation()}
              type="button"
            >
              <MoreVerticalIcon className="size-4" />
            </button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-48 border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
          collisionAvoidance={{
            align: "shift",
            fallbackAxisSide: "none",
            side: "flip",
          }}
          collisionPadding={12}
          side="top"
          sideOffset={8}
          sticky
        >
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2"
            disabled={!isCustomFolder}
            onClick={onEdit}
          >
            <PencilIcon className="size-4" />
            {isCustomFolder ? "Edit name" : "System folder"}
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2"
            disabled={!canMoveUp}
            onClick={onMoveUp}
          >
            <ArrowDownIcon className="size-4 rotate-180" />
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2"
            disabled={!canMoveDown}
            onClick={onMoveDown}
          >
            <ArrowDownIcon className="size-4" />
            Move down
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2 text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-300 dark:focus:bg-red-950/30 dark:focus:text-red-200"
            disabled={!isCustomFolder}
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
            Delete folder
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function MediaAssetCard({
  acceptedMediaTypes,
  accent,
  active,
  asset,
  folders,
  onAssetMoved,
  onDelete,
  onDetails,
  onFolderCreated,
  onSelect,
  onSelectSingle,
  viewMode,
}: {
  acceptedMediaTypes: MediaType[];
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  active: boolean;
  asset: AdminMediaAsset;
  folders: AdminMediaFolder[];
  onAssetMoved: (
    assetId: string,
    folderId: string | null,
    folderIds?: string[],
  ) => void;
  onDelete: () => void;
  onDetails: () => void;
  onFolderCreated: (folder: AdminMediaFolder) => void;
  onSelect: () => void;
  onSelectSingle: () => void;
  viewMode: "grid" | "list";
}) {
  const selectable = isAssetSelectable(asset, acceptedMediaTypes);
  const [isFolderDialogOpen, setIsFolderDialogOpen] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(true);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const isVideo = asset.mimeType.startsWith("video/");

  function toggleVideoPlayback(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();

    const video = videoRef.current;

    if (!video) {
      setIsPlaying(true);
      window.requestAnimationFrame(() => {
        void videoRef.current?.play();
      });
      return;
    }

    if (video.paused) {
      setIsPlaying(true);
      void video.play();
      return;
    }

    video.pause();
    setIsPlaying(false);
  }

  function toggleVideoSound(event: MouseEvent<HTMLButtonElement>) {
    event.stopPropagation();
    setIsMuted((current) => !current);
  }

  return (
    <div
      aria-disabled={!selectable}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-slate-200 bg-white text-left transition hover:border-slate-300 hover:bg-slate-50/80 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-white/20 dark:hover:bg-white/[0.055]",
        !selectable && "cursor-not-allowed opacity-40 grayscale",
        active && accent.ring,
        viewMode === "list" && "grid grid-cols-[5rem_minmax(0,1fr)_auto]",
      )}
    >
      <div
        className={cn(
          "block w-full text-left",
          selectable && "cursor-pointer",
          viewMode === "list" && "contents",
        )}
        onKeyDown={(event) => {
          if (!selectable || (event.key !== "Enter" && event.key !== " ")) {
            return;
          }

          event.preventDefault();
          onSelect();
        }}
        onClick={() => selectable && onSelect()}
        role="button"
        tabIndex={selectable ? 0 : -1}
      >
        <div
          className={cn(
            "relative aspect-square bg-slate-100 dark:bg-white/[0.04]",
            viewMode === "list" && "aspect-auto h-20",
          )}
        >
          {isVideo && (isPlaying || !asset.thumbnailUrl) ? (
            <video
              aria-label={asset.altText ?? asset.originalFileName ?? "Video preview"}
              className="size-full object-cover"
              muted={isMuted}
              onEnded={() => setIsPlaying(false)}
              onPause={() => setIsPlaying(false)}
              onPlay={() => setIsPlaying(true)}
              playsInline
              preload="metadata"
              ref={videoRef}
              src={asset.publicUrl}
            />
          ) : (
            <MediaPreview asset={asset} />
          )}
          {isVideo ? (
            <div className="absolute right-2 top-2 flex items-center gap-1">
              <button
                aria-label={isPlaying ? "Pause video" : "Play video"}
                className="grid size-7 place-items-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                onClick={toggleVideoPlayback}
                type="button"
              >
                {isPlaying ? (
                  <PauseIcon className="size-3.5 fill-current" />
                ) : (
                  <PlayIcon className="ml-0.5 size-3.5 fill-current" />
                )}
              </button>
              <button
                aria-label={isMuted ? "Unmute video" : "Mute video"}
                className="grid size-7 place-items-center rounded-full bg-black/70 text-white shadow-sm transition hover:bg-black/85 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"
                onClick={toggleVideoSound}
                type="button"
              >
                {isMuted ? (
                  <VolumeXIcon className="size-3.5" />
                ) : (
                  <Volume2Icon className="size-3.5" />
                )}
              </button>
            </div>
          ) : null}
          {selectable && active ? (
            <span
              className={cn(
                "absolute left-2 top-2 grid size-6 place-items-center rounded-full",
                accent.selected,
              )}
            >
              <CheckIcon className="size-4" />
            </span>
          ) : null}
          {asset.usageCount > 0 ? (
            <span
              className={cn(
                "absolute left-2 inline-flex max-w-[calc(100%-1rem)] items-center gap-1 rounded-full bg-zinc-950/80 px-2 py-1 text-[0.65rem] font-bold text-white shadow-sm backdrop-blur dark:bg-white/15",
                selectable && active ? "top-9" : "top-2",
              )}
            >
              <LockIcon className="size-3" />
              In use
            </span>
          ) : null}
        </div>
        <div className="grid gap-1 p-2.5 pr-9">
          <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">
            {asset.originalFileName ?? "Untitled media"}
          </p>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            {formatBytes(asset.byteSize)} ·{" "}
            {asset.mimeType.split("/")[1]?.toUpperCase()} ·{" "}
            {asset.usageCount > 0 ? "In use" : "Unused"}
          </p>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              className="absolute bottom-2 right-2 grid size-7 place-items-center rounded-md bg-transparent text-slate-500 outline-none transition hover:bg-slate-100 hover:text-zinc-950 focus-visible:ring-2 focus-visible:ring-slate-300 data-[popup-open]:bg-slate-100 data-[popup-open]:text-zinc-950 dark:text-white/60 dark:hover:bg-white/10 dark:hover:text-white dark:focus-visible:ring-white/30 dark:data-[popup-open]:bg-white/10 dark:data-[popup-open]:text-white"
              onClick={(event) => event.stopPropagation()}
              type="button"
            >
              <MoreVerticalIcon className="size-4" strokeWidth={2.25} />
              <span className="sr-only">
                Open options for {asset.originalFileName ?? "media asset"}
              </span>
            </button>
          }
        />
        <DropdownMenuContent
          align="end"
          className="w-44 border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
          sideOffset={8}
        >
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2"
            disabled={!selectable}
            onClick={() => {
              if (selectable) {
                onSelectSingle();
                onDetails();
              }
            }}
          >
            <FileImageIcon className="size-4" />
            View details
          </DropdownMenuItem>
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2"
            disabled={!selectable}
            onClick={() => selectable && onSelect()}
          >
            <CheckIcon className="size-4" />
            Select file
          </DropdownMenuItem>
          {getAssetFolderIds(asset).length ? (
            <DropdownMenuItem
              className="cursor-pointer gap-2 px-3 py-2"
              disabled={!selectable}
              onClick={() => {
                if (!selectable) {
                  return;
                }

                onSelectSingle();
                setIsFolderDialogOpen(true);
              }}
            >
              <FolderIcon className="size-4" />
              Manage folders
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuItem
            className="cursor-pointer gap-2 px-3 py-2 text-red-600 focus:bg-red-50 focus:text-red-700 dark:text-red-300 dark:focus:bg-red-950/30 dark:focus:text-red-200"
            onClick={onDelete}
          >
            <Trash2Icon className="size-4" />
            {asset.usageCount > 0 ? "Delete blocked" : "Delete"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <MediaFolderAssignmentDialog
        accent={accent}
        asset={asset}
        folders={folders}
        onAssetMoved={onAssetMoved}
        onFolderCreated={onFolderCreated}
        onOpenChange={setIsFolderDialogOpen}
        open={isFolderDialogOpen}
      />
    </div>
  );
}

function MediaUploadForm({
  acceptedMediaTypes,
  accent,
  onUploadComplete,
  onUploadError,
  onUploadProgress,
  onUploadStart,
  surface,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  acceptedMediaTypes: MediaType[];
  onUploadComplete: (input: { asset: AdminMediaAsset; id: string }) => void;
  onUploadError: (input: {
    id: string;
    message: string;
    storageFull?: StorageQuotaNotice;
  }) => void;
  onUploadProgress: (input: {
    id: string;
    progress: number;
    status: PendingUploadStatus;
  }) => void;
  onUploadStart: (uploads: PendingMediaUpload[]) => void;
  surface: MediaManagerSurface;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const acceptsImages = acceptedMediaTypes.includes("image");
  const acceptsVideos = acceptedMediaTypes.includes("video");
  const acceptsDocuments = acceptedMediaTypes.includes("document");
  const acceptAttribute = [
    acceptsImages ? "image/avif,image/jpeg,image/png,image/webp" : null,
    acceptsVideos ? "video/mp4,video/quicktime,video/webm" : null,
    acceptsDocuments ? "application/pdf" : null,
  ]
    .filter(Boolean)
    .join(",");

  function queueAndUploadFiles(files: File[]) {
    if (files.length === 0 || !inputRef.current) {
      return;
    }

    const uploads = files.map((file) => {
      const mediaType = getFileMediaType(file);

      return {
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        previewUrl: mediaType === "image" ? URL.createObjectURL(file) : null,
        progress: 0,
        status: "uploading" as const,
        type: mediaType,
      };
    });

    inputRef.current.value = "";
    setUploadMessage(null);
    onUploadStart(uploads);

    uploads.forEach((upload, index) => {
      uploadFileWithProgress({
        acceptedMediaTypes,
        file: files[index],
        id: upload.id,
        onComplete: onUploadComplete,
        onError: onUploadError,
        onProgress: onUploadProgress,
        surface,
      });
    });
  }

  return (
    <div className="mx-auto grid max-w-2xl gap-4">
      <button
        className={cn(
          "grid min-h-56 place-items-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-zinc-950 transition dark:border-white/15 dark:bg-white/[0.03] dark:text-white",
          accent.dropzone,
        )}
        onClick={() => inputRef.current?.click()}
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          queueAndUploadFiles(Array.from(event.dataTransfer.files));
        }}
        type="button"
      >
        <span>
          <CloudUploadIcon className={cn("mx-auto size-9", accent.icon)} />
          <span className="mt-3 block text-sm font-semibold">
            Drag and drop media, or click to browse
          </span>
          <span className="mt-1 block text-xs text-slate-500 dark:text-slate-400">
            {getAcceptedMediaDescription(acceptedMediaTypes)}
          </span>
        </span>
      </button>

      <Input
        ref={inputRef}
        name="file"
        type="file"
        accept={acceptAttribute}
        multiple
        className="sr-only"
        onChange={(event) =>
          queueAndUploadFiles(Array.from(event.target.files ?? []))
        }
      />

      <p
        aria-live="polite"
        className={cn(
          "min-h-11 rounded-lg border p-3 text-sm transition-opacity",
          uploadMessage
            ? "border-red-500/20 bg-red-500/10 text-red-300 opacity-100"
            : "pointer-events-none border-transparent opacity-0",
        )}
      >
        {uploadMessage ?? "Upload status"}
      </p>
    </div>
  );
}

function MediaDetails({
  acceptedMediaTypes,
  asset,
  folders,
  onAssetMoved,
  onAssetUpdated,
  onFolderCreated,
  onDelete,
  surface = "marketplace",
}: {
  acceptedMediaTypes: MediaType[];
  asset: AdminMediaAsset | null;
  folders: AdminMediaFolder[];
  onAssetMoved: (
    assetId: string,
    folderId: string | null,
    folderIds?: string[],
  ) => void;
  onAssetUpdated: (asset: AdminMediaAsset) => void;
  onFolderCreated: (folder: AdminMediaFolder) => void;
  onDelete: (asset: AdminMediaAsset) => void;
  surface?: MediaManagerSurface;
}) {
  const accent = mediaManagerAccentClasses[surface];
  const replaceInputRef = useRef<HTMLInputElement>(null);
  const [state, action, isPending] = useActionState(
    updateAdminMediaMetadata,
    initialMetadataState,
  );
  const [copiedUrl, setCopiedUrl] = useState(false);
  const [isReplacing, setIsReplacing] = useState(false);
  const [isMoveOpen, setIsMoveOpen] = useState(false);
  const [mediaActionMessage, setMediaActionMessage] = useState<string | null>(
    null,
  );

  useEffect(() => {
    setCopiedUrl(false);
    setIsMoveOpen(false);
    setMediaActionMessage(null);
  }, [asset?.id]);

  useEffect(() => {
    if (!copiedUrl) {
      return;
    }

    const timeout = window.setTimeout(() => setCopiedUrl(false), 1400);

    return () => window.clearTimeout(timeout);
  }, [copiedUrl]);

  if (!asset) {
    return (
      <div className="grid h-full min-h-48 place-items-center text-center text-sm text-slate-500 dark:text-slate-400">
        <span>
          <FileImageIcon className="mx-auto mb-3 size-8" />
          Select a file to view details.
        </span>
      </div>
    );
  }

  const acceptAttribute = getAcceptAttribute(acceptedMediaTypes);

  async function replaceFile(file: File) {
    if (!asset) {
      return;
    }

    const mediaType = getFileMediaType(file);

    if (mediaType === "unknown" || !acceptedMediaTypes.includes(mediaType)) {
      setMediaActionMessage("This picker does not accept that file type.");
      return;
    }

    setIsReplacing(true);
    setMediaActionMessage(null);

    uploadFileWithProgress({
      acceptedMediaTypes,
      file,
      id: `replace-${asset.id}`,
      onComplete: ({ asset: updatedAsset }) => {
        onAssetUpdated(updatedAsset);
        setIsReplacing(false);
        setMediaActionMessage("File replaced.");
      },
      onError: ({ message }) => {
        setIsReplacing(false);
        setMediaActionMessage(message);
      },
      onProgress: () => {},
      replaceAssetId: asset.id,
      surface,
    });
  }

  async function downloadFile() {
    if (!asset) {
      return;
    }

    const response = await fetch(asset.publicUrl);
    const blob = await response.blob();
    const objectUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = objectUrl;
    link.download = asset.originalFileName ?? "piessang-media";
    document.body.append(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(objectUrl);
  }

  return (
    <div className="grid min-w-0 max-w-full gap-4 overflow-hidden">
      <p className="text-sm font-bold text-zinc-950 dark:text-white">File details</p>
      {asset.mimeType.startsWith("video/") ? (
        <video
          className="aspect-video w-full max-w-full rounded-lg border border-slate-200 object-cover dark:border-white/10"
          controls
          poster={asset.thumbnailUrl ?? undefined}
          src={asset.publicUrl}
        />
      ) : isDocumentAsset(asset) ? (
        <div className="grid aspect-video w-full max-w-full place-items-center rounded-lg border border-slate-200 bg-white text-slate-500 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          <span className="grid place-items-center gap-2">
            <FileTextIcon className="size-12" />
            <span className="text-xs font-bold uppercase">
              {asset.mimeType.split("/")[1] ?? "Document"}
            </span>
          </span>
        </div>
      ) : (
        <img
          alt={asset.altText ?? asset.originalFileName ?? ""}
          className="aspect-video w-full max-w-full rounded-lg border border-slate-200 object-cover dark:border-white/10"
          src={asset.publicUrl}
        />
      )}
      <div className="min-w-0">
        <p
          className="truncate text-sm font-bold text-zinc-950 dark:text-white"
          title={asset.originalFileName ?? "Untitled media"}
        >
          {asset.originalFileName ?? "Untitled media"}
        </p>
        <p className="mt-1 min-w-0 break-words text-xs text-slate-500 dark:text-slate-400">
          {formatBytes(asset.byteSize)} · {asset.width ?? "-"} ×{" "}
          {asset.height ?? "-"} · {asset.mimeType}
          {asset.durationMs ? ` · ${formatDuration(asset.durationMs)}` : ""}
        </p>
        <p
          className={cn(
            "mt-2 inline-flex rounded-full px-2 py-1 text-xs font-bold",
            asset.usageCount > 0
              ? "bg-amber-500/10 text-amber-600 dark:text-amber-300"
              : "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
          )}
        >
          {asset.usageCount > 0
            ? `In use by ${asset.usageCount} platform ${asset.usageCount === 1 ? "record" : "records"}`
            : "Not used anywhere yet"}
        </p>
      </div>
      <div className="grid min-w-0 gap-2">
        <Label className="text-zinc-950 dark:text-white">URL</Label>
        <div className="flex h-10 min-w-0 items-center overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
          <span className="min-w-0 flex-1 truncate px-3 text-xs text-slate-600 dark:text-slate-300">
            {asset.publicUrl}
          </span>
          <Button
            variant="ghost"
            size="icon-sm"
            type="button"
            aria-label={copiedUrl ? "Copied media URL" : "Copy media URL"}
            className={cn(
              "shrink-0 transition-colors",
              copiedUrl &&
                "bg-emerald-500/10 text-emerald-300 hover:bg-emerald-500/10 hover:text-emerald-300",
            )}
            onClick={() => {
              void navigator.clipboard.writeText(asset.publicUrl).then(() => {
                setCopiedUrl(true);
              });
            }}
          >
            {copiedUrl ? (
              <CheckIcon className="size-4" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </Button>
        </div>
        <p className="min-h-4 text-xs text-emerald-300">
          {copiedUrl ? "Copied URL" : ""}
        </p>
      </div>
      <form action={action} className="grid min-w-0 gap-3">
        <input type="hidden" name="id" value={asset.id} />
        <div className="grid gap-2">
          <Label className="text-zinc-950 dark:text-white" htmlFor={`altText-${asset.id}`}>Alt text</Label>
          <Input
            id={`altText-${asset.id}`}
            name="altText"
            key={asset.id}
            maxLength={240}
            defaultValue={asset.altText ?? ""}
            placeholder="Describe this media for accessibility"
            className="min-w-0 border-slate-200 bg-white text-zinc-950 placeholder:text-slate-400 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:placeholder:text-slate-500"
          />
        </div>
        <Button
          className={cn(
            "h-9 justify-center rounded-lg border-0",
            state.ok ? "bg-emerald-600 text-white hover:bg-emerald-700" : accent.button,
          )}
          disabled={isPending}
          type="submit"
          variant="outline"
        >
          {isPending ? "Saving..." : "Save details"}
        </Button>
        {state.message ? (
          <p
            className={cn(
              "rounded-lg border p-2 text-xs",
              state.ok
                ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
                : "border-red-500/20 bg-red-500/10 text-red-700 dark:text-red-300",
            )}
          >
            {state.message}
          </p>
        ) : null}
      </form>
      <Input
        ref={replaceInputRef}
        accept={acceptAttribute}
        className="sr-only"
        onChange={(event) => {
          const [file] = Array.from(event.target.files ?? []);

          event.target.value = "";

          if (file) {
            void replaceFile(file);
          }
        }}
        type="file"
      />
      <div className="min-w-0 overflow-hidden rounded-lg border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.03]">
        <MediaDetailAction
          icon={RefreshCwIcon}
          label="Replace file"
          loading={isReplacing}
          onClick={() => replaceInputRef.current?.click()}
        />
        <MediaDetailAction
          icon={FolderIcon}
          label="Move to folder"
          onClick={() => setIsMoveOpen(true)}
        />
        <MediaDetailAction
          icon={CopyIcon}
          label="Copy URL"
          onClick={() => {
            void navigator.clipboard.writeText(asset.publicUrl).then(() => {
              setCopiedUrl(true);
            });
          }}
        />
        <MediaDetailAction
          icon={DownloadIcon}
          label="Download file"
          onClick={() => void downloadFile()}
        />
      </div>
      {mediaActionMessage ? (
        <p className="rounded-lg border border-slate-200 bg-white p-2 text-xs text-slate-600 dark:border-white/10 dark:bg-white/[0.03] dark:text-slate-300">
          {mediaActionMessage}
        </p>
      ) : null}
      <Button
        className="h-10 justify-center rounded-lg border-red-500/25 text-red-300 hover:bg-red-950/30 hover:text-red-200"
        onClick={() => onDelete(asset)}
        type="button"
        variant="outline"
      >
        <Trash2Icon className="size-4" />
        Delete file
      </Button>
      <Dialog open={isMoveOpen} onOpenChange={setIsMoveOpen}>
        <MediaFolderAssignmentDialogContent
          accent={accent}
          asset={asset}
          folders={folders}
          onAssetMoved={onAssetMoved}
          onFolderCreated={onFolderCreated}
          onOpenChange={setIsMoveOpen}
        />
      </Dialog>
    </div>
  );
}

function MediaFolderAssignmentDialog({
  accent,
  asset,
  folders,
  onAssetMoved,
  onFolderCreated,
  onOpenChange,
  open,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  asset: AdminMediaAsset;
  folders: AdminMediaFolder[];
  onAssetMoved: (
    assetId: string,
    folderId: string | null,
    folderIds?: string[],
  ) => void;
  onFolderCreated: (folder: AdminMediaFolder) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <MediaFolderAssignmentDialogContent
        accent={accent}
        asset={asset}
        folders={folders}
        onAssetMoved={onAssetMoved}
        onFolderCreated={onFolderCreated}
        onOpenChange={onOpenChange}
      />
    </Dialog>
  );
}

function MediaFolderAssignmentDialogContent({
  accent,
  asset,
  folders,
  onAssetMoved,
  onFolderCreated,
  onOpenChange,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  asset: AdminMediaAsset;
  folders: AdminMediaFolder[];
  onAssetMoved: (
    assetId: string,
    folderId: string | null,
    folderIds?: string[],
  ) => void;
  onFolderCreated: (folder: AdminMediaFolder) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const [selectedFolderKeys, setSelectedFolderKeys] = useState<string[]>(() =>
    getAssetFolderIds(asset),
  );
  const [message, setMessage] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const folderOptions = getAssignableMediaFolders(folders);

  useEffect(() => {
    setSelectedFolderKeys(getAssetFolderIds(asset));
    setMessage(null);
  }, [asset.id, asset.folderId, asset.folderIds]);

  async function saveFolders() {
    setIsSaving(true);
    setMessage(null);

    const folderIds: string[] = [];

    for (const folderKey of selectedFolderKeys) {
      if (folderKey.startsWith("system-")) {
        const systemFolder = systemMediaFolders.find(
          (folder) => `system-${folder.filter}` === folderKey,
        );

        if (!systemFolder) {
          continue;
        }

        const existingFolder = folders.find(
          (folder) =>
            normalizeMediaFolderName(folder.name) ===
            normalizeMediaFolderName(systemFolder.label),
        );

        if (existingFolder) {
          folderIds.push(existingFolder.id);
          continue;
        }

        const createdFolder = await createAdminMediaFolder(systemFolder.label);

        if (!createdFolder.ok || !createdFolder.folder) {
          setMessage(createdFolder.message ?? "Could not create that folder.");
          setIsSaving(false);
          return;
        }

        onFolderCreated(createdFolder.folder);
        folderIds.push(createdFolder.folder.id);
        continue;
      }

      folderIds.push(folderKey);
    }

    const result = await setAdminMediaAssetFolders({
      folderIds,
      id: asset.id,
    });

    setIsSaving(false);

    if (!result.ok || !result.id) {
      setMessage(result.message ?? "Could not update media folders.");
      return;
    }

    onAssetMoved(result.id, result.folderId ?? null, result.folderIds ?? folderIds);
    onOpenChange(false);
  }

  return (
    <DialogContent className="z-[120] w-[min(26rem,calc(100vw-2rem))] overflow-hidden border border-slate-200 bg-white text-zinc-950 dark:border-white/10 dark:bg-[#101214] dark:text-white">
      <DialogHeader className="border-b border-slate-200 dark:border-white/10">
        <DialogTitle className="text-base font-bold">Manage folders</DialogTitle>
        <p className="text-sm text-slate-500 dark:text-slate-400">
          Add this media asset to one or more folders, or remove it from all
          folders.
        </p>
      </DialogHeader>
      <DialogBody className="max-h-[min(28rem,calc(100vh-14rem))]">
        <div className="grid gap-2">
          {folderOptions.map((folder) => {
            const checked = selectedFolderKeys.includes(folder.value);

            return (
              <label
                className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/[0.03]"
                key={folder.value}
              >
                <input
                  checked={checked}
                  className="size-4 accent-current"
                  onChange={(event) =>
                    setSelectedFolderKeys((current) =>
                      event.target.checked
                        ? [...new Set([...current, folder.value])]
                        : current.filter((folderKey) => folderKey !== folder.value),
                    )
                  }
                  type="checkbox"
                />
                <span className="min-w-0 flex-1 truncate">{folder.label}</span>
                {folder.kind === "system" ? (
                  <span className="text-xs text-slate-400">Library</span>
                ) : null}
              </label>
            );
          })}
        </div>
        {message ? (
          <p className="mt-3 rounded-lg border border-red-500/20 bg-red-500/10 p-2 text-xs text-red-700 dark:text-red-300">
            {message}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter className="border-slate-200 bg-white/95 dark:border-white/10 dark:bg-[#101214]/95">
        <Button onClick={() => onOpenChange(false)} type="button" variant="outline">
          Cancel
        </Button>
        <Button
          className={cn("justify-center", accent.button)}
          disabled={isSaving}
          onClick={() => void saveFolders()}
          type="button"
        >
          {isSaving ? "Saving..." : "Save folders"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function MediaDetailAction({
  icon: Icon,
  label,
  loading,
  onClick,
}: {
  icon: typeof RefreshCwIcon;
  label: string;
  loading?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      className="flex h-11 w-full items-center gap-3 border-b border-slate-200 px-3 text-left text-sm font-semibold text-zinc-950 transition last:border-b-0 hover:bg-slate-50 dark:border-white/10 dark:text-white dark:hover:bg-white/[0.05]"
      onClick={onClick}
      type="button"
    >
      <Icon className={cn("size-4 text-slate-500 dark:text-slate-300", loading && "animate-spin")} />
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <ChevronRightIcon className="size-4 text-slate-400" />
    </button>
  );
}

function PremiumSubscriptionDialog({
  onOpenChange,
  open,
  storage,
}: {
  onOpenChange: (open: boolean) => void;
  open: boolean;
  storage: MediaStorageSettings;
}) {
  const [step, setStep] = useState<PremiumStep>("intro");
  const [plan, setPlan] = useState<PremiumPlan>("monthly");
  const premiumBytes = storage.premiumStorageQuotaMb * 1024 * 1024;
  const isMonthly = plan === "monthly";
  const planPrice = isMonthly ? "$9.99" : "$95.88";
  const planPeriod = isMonthly ? "month" : "year";

  useEffect(() => {
    if (!open) {
      window.setTimeout(() => {
        setStep("intro");
        setPlan("monthly");
      }, 120);
    }
  }, [open]);

  function close() {
    onOpenChange(false);
  }

  function back() {
    if (step === "intro") {
      close();
    } else if (step === "plan") {
      setStep("intro");
    } else if (step === "payment") {
      setStep("plan");
    } else if (step === "review") {
      setStep("payment");
    } else {
      setStep("intro");
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className="z-[140] h-[min(52rem,calc(100dvh-1.5rem))] w-[min(34rem,calc(100vw-1.5rem))] max-w-none overflow-hidden border border-slate-200 bg-white p-0 text-zinc-950 shadow-2xl shadow-black/25 sm:max-w-none dark:border-white/10 dark:bg-[#071016] dark:text-white"
        overlayClassName="z-[130] bg-black/75 backdrop-blur-md"
      >
        {step === "intro" ? (
          <PremiumIntro
            premiumBytes={premiumBytes}
            onClose={close}
            onContinue={() => setStep("plan")}
          />
        ) : null}

        {step === "plan" ? (
          <PremiumPlanStep
            plan={plan}
            premiumBytes={premiumBytes}
            setPlan={setPlan}
            onBack={back}
            onClose={close}
            onContinue={() => setStep("payment")}
          />
        ) : null}

        {step === "payment" ? (
          <PremiumPaymentStep
            onBack={back}
            onClose={close}
            onContinue={() => setStep("review")}
          />
        ) : null}

        {step === "review" ? (
          <PremiumReviewStep
            plan={plan}
            planPeriod={planPeriod}
            planPrice={planPrice}
            premiumBytes={premiumBytes}
            onBack={back}
            onClose={close}
            onContinue={() => setStep("success")}
          />
        ) : null}

        {step === "success" ? (
          <PremiumSuccessStep onClose={close} />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function PremiumShell({
  children,
  currentStep,
  onBack,
  onClose,
  showBrand = false,
}: {
  children: ReactNode;
  currentStep?: 1 | 2 | 3;
  onBack?: () => void;
  onClose: () => void;
  showBrand?: boolean;
}) {
  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[radial-gradient(circle_at_50%_18%,rgba(124,58,237,0.16),transparent_32%),linear-gradient(135deg,#ffffff,#f8fafc)] dark:bg-[radial-gradient(circle_at_50%_18%,rgba(34,197,94,0.14),transparent_30%),linear-gradient(135deg,#071016,#0d141d)]">
      <div className="flex shrink-0 items-center justify-between gap-3 px-5 py-5">
        {onBack ? (
          <button
            className="inline-flex items-center gap-2 text-sm font-medium text-slate-600 transition hover:text-zinc-950 dark:text-white/80 dark:hover:text-white"
            onClick={onBack}
            type="button"
          >
            <ArrowLeftIcon className="size-4" />
            Back
          </button>
        ) : showBrand ? (
          <PiessangPremiumBrand />
        ) : (
          <span />
        )}
        <button
          aria-label="Close premium dialog"
          className="grid size-9 place-items-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-zinc-950 dark:text-white/80 dark:hover:bg-white/10 dark:hover:text-white"
          onClick={onClose}
          type="button"
        >
          <XIcon className="size-5" />
        </button>
      </div>

      {currentStep ? <PremiumStepper currentStep={currentStep} /> : null}

      <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {children}
      </div>
    </div>
  );
}

function PiessangPremiumBrand() {
  return (
    <div className="flex items-center gap-2">
      <img
        alt=""
        className="size-9 object-contain"
        src="/brand/favicon-for-app/web-app-manifest-192x192.png"
      />
      <span className="text-sm font-black tracking-[0.18em]">PIESSANG</span>
    </div>
  );
}

function PremiumIntro({
  onClose,
  onContinue,
  premiumBytes,
}: {
  onClose: () => void;
  onContinue: () => void;
  premiumBytes: number;
}) {
  return (
    <PremiumShell onClose={onClose} showBrand>
      <div className="mx-auto grid max-w-sm gap-5">
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-md border border-[#d7ccff] bg-violet-500/10 px-3 py-1 text-xs font-black uppercase tracking-wide text-violet-600 dark:border-violet-400/30 dark:text-violet-200">
            <CrownIcon className="size-4" />
            Premium
          </span>
          <h2 className="mt-5 text-3xl font-black leading-tight">
            Unlock the full power of{" "}
            <span className="bg-gradient-to-r from-[#a855f7] to-[#2563eb] bg-clip-text text-transparent">
              Piessang
            </span>
          </h2>
          <p className="mx-auto mt-3 max-w-xs text-sm leading-relaxed text-slate-600 dark:text-slate-300">
            Upgrade to Premium and get everything you need to manage your
            marketplace like a pro.
          </p>
        </div>

        <div className="relative mx-auto grid h-44 w-72 place-items-center">
          <span className="absolute left-2 top-8 grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-white/70 text-[#7c3aed] shadow-sm dark:bg-white/10">
            <CloudUploadIcon className="size-5" />
          </span>
          <span className="absolute right-4 top-8 grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-white/70 text-[#7c3aed] shadow-sm dark:bg-white/10">
            <ShieldCheckIcon className="size-5" />
          </span>
          <span className="absolute bottom-12 left-0 grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-white/70 text-[#7c3aed] shadow-sm dark:bg-white/10">
            <ZapIcon className="size-5" />
          </span>
          <span className="absolute bottom-12 right-0 grid size-10 place-items-center rounded-xl border border-violet-400/20 bg-white/70 text-[#7c3aed] shadow-sm dark:bg-white/10">
            <BarChart3Icon className="size-5" />
          </span>
          <div className="absolute bottom-4 h-12 w-44 rounded-[50%] bg-gradient-to-r from-violet-500/20 via-[#fbe694]/25 to-blue-500/20 blur-xl" />
          <div className="relative grid size-32 place-items-center rounded-full border border-[#d7ccff]/60 bg-gradient-to-br from-[#fff7d6] via-white to-[#ede9fe] shadow-2xl shadow-violet-500/20 dark:border-white/10 dark:from-[#2a1d09] dark:via-[#0f1720] dark:to-[#20133a]">
            <img
              alt=""
              className="size-24 object-contain drop-shadow-2xl"
              src="/brand/favicon-for-app/web-app-manifest-192x192.png"
            />
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 shadow-lg shadow-black/5 backdrop-blur dark:border-white/10 dark:bg-white/[0.045]">
          <p className="text-sm font-black">Everything in Free, plus:</p>
          <div className="mt-4 grid gap-3">
            <PremiumBenefit title={`${formatBytes(premiumBytes)} of storage`} text="Store more images, videos and documents" />
            <PremiumBenefit title="Advanced media tools" text="Bulk edit, format convert and more" />
            <PremiumBenefit title="Priority support" text="Get help faster when you need it" />
            <PremiumBenefit title="Faster uploads" text="Upload larger files in less time" />
          </div>

          <div className="mt-5 rounded-lg border border-violet-400/40 bg-violet-500/5 p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                <p className="text-sm font-black">Monthly</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Cancel anytime
                </p>
              </div>
              <p className="text-xl font-black text-[#7c3aed]">
                $9.99{" "}
                <span className="text-xs font-medium text-slate-500 dark:text-slate-400">
                  / month
                </span>
              </p>
            </div>
          </div>

          <button
            className="mt-4 h-11 w-full rounded-lg bg-gradient-to-r from-[#a855f7] to-[#2563eb] text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:from-[#9333ea] hover:to-[#1d4ed8]"
            onClick={onContinue}
            type="button"
          >
            Unlock Premium
          </button>
          <p className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
            <LockIcon className="size-3.5" />
            Secure checkout powered by Stripe
          </p>
        </div>
      </div>
    </PremiumShell>
  );
}

function PremiumBenefit({ text, title }: { text: string; title: string }) {
  return (
    <div className="flex items-start gap-3">
      <CheckIcon className="mt-0.5 size-4 shrink-0 rounded-full bg-violet-500/10 p-0.5 text-[#7c3aed]" />
      <span>
        <span className="block text-sm font-bold">{title}</span>
        <span className="block text-xs text-slate-500 dark:text-slate-400">
          {text}
        </span>
      </span>
    </div>
  );
}

function PremiumStepper({ currentStep }: { currentStep: 1 | 2 | 3 }) {
  const steps = [
    { label: "Plan", value: 1 },
    { label: "Payment", value: 2 },
    { label: "Review", value: 3 },
  ] as const;

  return (
    <div className="mx-auto mb-2 grid w-full max-w-xs grid-cols-[1fr_1fr_1fr] items-start px-5">
      {steps.map((step, index) => (
        <div className="relative grid place-items-center gap-2" key={step.value}>
          {index > 0 ? (
            <span className="absolute right-1/2 top-3 h-px w-full bg-slate-200 dark:bg-white/15" />
          ) : null}
          <span
            className={cn(
              "relative z-10 grid size-7 place-items-center rounded-full border text-xs font-bold",
              currentStep >= step.value
                ? "border-violet-400/40 bg-gradient-to-br from-[#a855f7] to-[#2563eb] text-white shadow-lg shadow-violet-500/25"
                : "border-slate-300 bg-white text-slate-500 dark:border-white/20 dark:bg-transparent dark:text-slate-300",
            )}
          >
            {step.value}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-300">
            {step.label}
          </span>
        </div>
      ))}
    </div>
  );
}

function PremiumPlanStep({
  onBack,
  onClose,
  onContinue,
  plan,
  premiumBytes,
  setPlan,
}: {
  onBack: () => void;
  onClose: () => void;
  onContinue: () => void;
  plan: PremiumPlan;
  premiumBytes: number;
  setPlan: (plan: PremiumPlan) => void;
}) {
  return (
    <PremiumShell currentStep={1} onBack={onBack} onClose={onClose}>
      <div className="mx-auto grid max-w-md gap-5">
        <div className="text-center">
          <h2 className="text-2xl font-black">Choose your plan</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Choose the plan that works best for you.
          </p>
        </div>
        <PremiumPlanCard
          active={plan === "monthly"}
          badge="Most flexible"
          period="month"
          price="$9.99"
          title="Monthly Plan"
          subtitle="Billed monthly"
          premiumBytes={premiumBytes}
          onClick={() => setPlan("monthly")}
        />
        <PremiumPlanCard
          active={plan === "yearly"}
          badge="Save 20%"
          period="year"
          price="$95.88"
          title="Yearly Plan"
          subtitle="Billed annually"
          compareAt="$119.88 / year"
          premiumBytes={premiumBytes}
          onClick={() => setPlan("yearly")}
        />
        <div className="flex items-center gap-4 rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.045]">
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-violet-500/10 text-[#7c3aed]">
            <TagIcon className="size-5" />
          </span>
          <div>
            <p className="text-sm font-black">Cancel anytime</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              You can cancel your subscription at any time.
            </p>
          </div>
        </div>
        <button
          className="h-12 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#2563eb] text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:from-[#9333ea] hover:to-[#1d4ed8]"
          onClick={onContinue}
          type="button"
        >
          Continue to payment
        </button>
      </div>
    </PremiumShell>
  );
}

function PremiumPlanCard({
  active,
  badge,
  compareAt,
  onClick,
  period,
  premiumBytes,
  price,
  subtitle,
  title,
}: {
  active: boolean;
  badge: string;
  compareAt?: string;
  onClick: () => void;
  period: string;
  premiumBytes: number;
  price: string;
  subtitle: string;
  title: string;
}) {
  return (
    <button
      className={cn(
        "relative grid gap-4 rounded-xl border p-5 text-left transition",
        active
          ? "border-[#7c3aed] bg-violet-500/10 shadow-lg shadow-violet-500/10"
          : "border-slate-200 bg-white/70 hover:border-violet-300 dark:border-white/10 dark:bg-white/[0.035] dark:hover:border-violet-400/40",
      )}
      onClick={onClick}
      type="button"
    >
      {active ? (
        <span className="absolute right-4 top-4 grid size-6 place-items-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#2563eb] text-white">
          <CheckIcon className="size-4" />
        </span>
      ) : null}
      <div>
        <p className="text-base font-black">
          {title}{" "}
          <span className="ml-2 rounded bg-violet-500/10 px-2 py-1 text-xs font-bold text-[#7c3aed]">
            {badge}
          </span>
        </p>
        <p className="mt-5 text-3xl font-black">
          {price}{" "}
          <span className="text-sm font-medium text-slate-500 dark:text-slate-400">
            / {period}
          </span>
        </p>
        {compareAt ? (
          <p className="mt-2 text-xs text-slate-500 line-through dark:text-slate-400">
            {compareAt}
          </p>
        ) : null}
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          {subtitle}
        </p>
      </div>
      <div className="grid gap-2 text-sm text-slate-600 dark:text-slate-300">
        {[
          `${formatBytes(premiumBytes)} storage`,
          "Advanced media tools",
          "Priority support",
          "All premium features",
        ].map((item) => (
          <span className="flex items-center gap-2" key={item}>
            <CheckIcon className="size-4 text-[#7c3aed]" />
            {item}
          </span>
        ))}
      </div>
    </button>
  );
}

function PremiumPaymentStep({
  onBack,
  onClose,
  onContinue,
}: {
  onBack: () => void;
  onClose: () => void;
  onContinue: () => void;
}) {
  return (
    <PremiumShell currentStep={2} onBack={onBack} onClose={onClose}>
      <div className="mx-auto grid max-w-md gap-5">
        <div className="text-center">
          <h2 className="text-2xl font-black">Payment details</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Enter your card information to continue.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <div className="mb-4 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
            <span className="inline-flex items-center gap-2">
              <LockIcon className="size-4" />
              Secure payment
            </span>
            <span className="rounded border border-slate-200 px-2 py-1 dark:border-white/10">
              Powered by stripe
            </span>
          </div>
          <div className="grid gap-3">
            <PremiumInput label="Email" defaultValue="admin@example.com" />
            <PremiumInput label="Card information" defaultValue="4242 4242 4242 4242" icon={<CreditCardIcon className="size-4" />} />
            <div className="grid grid-cols-2 gap-3">
              <PremiumInput label="Expiry" defaultValue="12 / 26" />
              <PremiumInput label="CVC" defaultValue="123" />
            </div>
            <PremiumInput label="Name on card" defaultValue="Marketplace Admin" />
            <PremiumInput label="Country or region" defaultValue="South Africa" />
          </div>
        </div>
        <button
          className="h-12 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#2563eb] text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:from-[#9333ea] hover:to-[#1d4ed8]"
          onClick={onContinue}
          type="button"
        >
          Continue to review
        </button>
        <p className="flex items-center justify-center gap-2 text-xs text-slate-500 dark:text-slate-400">
          <LockIcon className="size-3.5" />
          Your payment is secure and encrypted
        </p>
      </div>
    </PremiumShell>
  );
}

function PremiumInput({
  defaultValue,
  icon,
  label,
}: {
  defaultValue?: string;
  icon?: ReactNode;
  label: string;
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold">
      {label}
      <span className="flex h-10 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-white/[0.03]">
        <input
          className="min-w-0 flex-1 bg-transparent text-sm font-medium outline-none placeholder:text-slate-400"
          defaultValue={defaultValue}
          placeholder={label}
        />
        {icon}
      </span>
    </label>
  );
}

function PremiumReviewStep({
  onBack,
  onClose,
  onContinue,
  planPeriod,
  planPrice,
  premiumBytes,
}: {
  onBack: () => void;
  onClose: () => void;
  onContinue: () => void;
  plan: PremiumPlan;
  planPeriod: string;
  planPrice: string;
  premiumBytes: number;
}) {
  return (
    <PremiumShell currentStep={3} onBack={onBack} onClose={onClose}>
      <div className="mx-auto grid max-w-md gap-5">
        <div className="text-center">
          <h2 className="text-2xl font-black">Review your subscription</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Please review your details before confirming.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <p className="text-xs font-black uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Plan
          </p>
          <div className="mt-3 flex gap-3">
            <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-violet-500/10 text-[#7c3aed]">
              <CrownIcon className="size-6" />
            </span>
            <div>
              <p className="text-sm font-black">Premium</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {planPrice} / {planPeriod}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {formatBytes(premiumBytes)} storage<br />
                Advanced media tools<br />
                Priority support<br />
                All premium features
              </p>
            </div>
          </div>
          <div className="my-4 h-px bg-slate-200 dark:bg-white/10" />
          <ReviewLine label="Billed" value={planPeriod === "month" ? "Monthly" : "Annually"} />
          <ReviewLine label="Tax (if applicable)" value="$0.00" />
          <ReviewLine strong label="Total today" value={`${planPrice} USD`} />
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 dark:border-white/10 dark:bg-white/[0.035]">
          <ReviewLine label="Payment method" value="Visa •••• 4242" />
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
            Exp 12 / 26
          </p>
        </div>
        <p className="text-center text-xs leading-relaxed text-slate-500 dark:text-slate-400">
          By subscribing, you agree to our{" "}
          <span className="font-bold text-[#7c3aed]">Terms of Service</span> and{" "}
          <span className="font-bold text-[#7c3aed]">Privacy Policy</span>.
        </p>
        <button
          className="h-12 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#2563eb] text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:from-[#9333ea] hover:to-[#1d4ed8]"
          onClick={onContinue}
          type="button"
        >
          Subscribe now
        </button>
      </div>
    </PremiumShell>
  );
}

function ReviewLine({
  label,
  strong,
  value,
}: {
  label: string;
  strong?: boolean;
  value: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 py-1.5 text-sm",
        strong && "font-black",
      )}
    >
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span>{value}</span>
    </div>
  );
}

function PremiumSuccessStep({ onClose }: { onClose: () => void }) {
  return (
    <PremiumShell onClose={onClose} showBrand>
      <div className="mx-auto grid max-w-sm gap-6 text-center">
        <div className="mx-auto grid size-28 place-items-center rounded-full bg-violet-500/10 text-white shadow-2xl shadow-violet-500/20">
          <span className="grid size-20 place-items-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#2563eb]">
            <CheckIcon className="size-11" />
          </span>
        </div>
        <div>
          <h2 className="text-3xl font-black leading-tight">
            You’re all set!<br />
            Welcome to{" "}
            <span className="bg-gradient-to-r from-[#a855f7] to-[#2563eb] bg-clip-text text-transparent">
              Premium
            </span>
          </h2>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            You now have access to all Premium features.
          </p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white/70 p-4 text-left dark:border-white/10 dark:bg-white/[0.045]">
          <p className="text-sm font-black">What’s next?</p>
          <div className="mt-4 grid gap-3">
            <PremiumBenefit title="Upload more files" text="Take advantage of your expanded storage" />
            <PremiumBenefit title="Explore premium tools" text="Check out the new file features" />
            <PremiumBenefit title="Need help?" text="Priority support is here for you" />
          </div>
        </div>
        <button
          className="h-12 rounded-lg bg-gradient-to-r from-[#a855f7] to-[#2563eb] text-sm font-black text-white shadow-lg shadow-violet-500/20 transition hover:from-[#9333ea] hover:to-[#1d4ed8]"
          onClick={onClose}
          type="button"
        >
          Go to Media Manager
        </button>
      </div>
    </PremiumShell>
  );
}

function StorageSummary({
  accent,
  onUnlockPremium,
  storage,
  usedStorageBytes,
  variant = "sidebar",
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  onUnlockPremium: () => void;
  storage: MediaStorageSettings;
  usedStorageBytes: number;
  variant?: "details" | "mobile" | "sidebar";
}) {
  const freeBytes = storage.freeStorageQuotaMb * 1024 * 1024;
  const premiumBytes = storage.premiumStorageQuotaMb * 1024 * 1024;
  const usagePercent = Math.min(100, Math.round((usedStorageBytes / freeBytes) * 100));
  const visualUsagePercent =
    usedStorageBytes > 0 ? Math.max(3, usagePercent) : 0;

  if (variant === "sidebar") {
    return (
      <section className="mb-5 overflow-hidden rounded-xl border border-slate-200 bg-white text-zinc-950 shadow-sm dark:border-white/10 dark:bg-white/[0.035] dark:text-white">
        <div className="grid gap-3 p-3">
          <div className="min-w-0">
            <p className="text-sm font-black leading-tight">Storage used</p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              Track your usage
            </p>
          </div>

          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#7c3aed] bg-clip-text text-2xl font-black text-transparent">
                {formatBytes(usedStorageBytes)}
              </p>
              <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                of {formatBytes(freeBytes)}
              </p>
            </div>
            <div className="relative grid size-14 shrink-0 place-items-center rounded-full border-[5px] border-[#eef0f7] text-center dark:border-white/10">
              <span className="absolute -top-[0.42rem] left-1/2 size-2.5 -translate-x-1/2 rounded-full bg-gradient-to-br from-[#7c3aed] to-[#2563eb] shadow-sm shadow-violet-500/30" />
              <span>
                <span className="block bg-gradient-to-r from-[#2563eb] to-[#7c3aed] bg-clip-text text-sm font-black text-transparent">
                  {usagePercent}%
                </span>
                <span className="block text-[0.6rem] text-slate-500 dark:text-slate-400">
                  used
                </span>
              </span>
            </div>
          </div>

          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f7] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#8b5cf6]"
                style={{ width: `${visualUsagePercent}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.68rem] font-semibold text-[#586a8d] dark:text-slate-400">
              <span className="text-[#2563eb]">{formatBytes(usedStorageBytes)} used</span>
              <span>{formatBytes(freeBytes)} total</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-white/10">
          <div className="rounded-xl border border-[#d7ccff] bg-gradient-to-br from-[#fbf8ff] via-[#f3edff] to-[#eef3ff] p-3 dark:border-[#7c3aed]/25 dark:from-[#1d172b] dark:via-[#161925] dark:to-[#101827]">
            <div className="flex items-start gap-2.5">
              <span className="grid size-8 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#6366f1] text-white shadow-md shadow-violet-500/20">
                <CrownIcon className="size-4" />
              </span>
              <div className="min-w-0">
                <p className="text-xs font-black leading-snug text-zinc-950 dark:text-white">
                  Unlock {formatBytes(premiumBytes)} of premium storage
                </p>
                <p className="mt-1 text-[0.68rem] leading-relaxed text-[#586a8d] dark:text-slate-300">
                  More space, faster uploads and advanced media tools.
                </p>
              </div>
            </div>
            <button
              className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-blue-600 px-3 text-xs font-bold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-600 hover:to-blue-700"
              onClick={onUnlockPremium}
              type="button"
            >
              Unlock Premium
              <ChevronRightIcon className="ml-auto size-3.5" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (variant === "mobile") {
    return (
      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white text-zinc-950 shadow-sm dark:border-white/10 dark:bg-white/[0.035] dark:text-white">
        <div className="grid gap-3 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-black leading-tight">Storage used</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
                Track your usage
              </p>
            </div>
            <div className="grid size-14 shrink-0 place-items-center rounded-full border-[5px] border-[#eef0f7] text-center dark:border-white/10">
              <span>
                <span className="block bg-gradient-to-r from-[#2563eb] to-[#7c3aed] bg-clip-text text-sm font-black text-transparent">
                  {usagePercent}%
                </span>
                <span className="block text-[0.6rem] text-slate-500 dark:text-slate-400">
                  used
                </span>
              </span>
            </div>
          </div>

          <div>
            <p className="truncate bg-gradient-to-r from-[#2563eb] via-[#4f46e5] to-[#7c3aed] bg-clip-text text-2xl font-black text-transparent">
              {formatBytes(usedStorageBytes)}
            </p>
            <p className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              of {formatBytes(freeBytes)}
            </p>
          </div>

          <div>
            <div className="h-1.5 overflow-hidden rounded-full bg-[#edf1f7] dark:bg-white/10">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#2563eb] to-[#8b5cf6]"
                style={{ width: `${visualUsagePercent}%` }}
              />
            </div>
            <div className="mt-1.5 flex items-center justify-between gap-2 text-[0.68rem] font-semibold text-[#586a8d] dark:text-slate-400">
              <span className="text-[#2563eb]">{formatBytes(usedStorageBytes)} used</span>
              <span>{formatBytes(freeBytes)} total</span>
            </div>
          </div>
        </div>

        <div className="border-t border-slate-200 p-3 dark:border-white/10">
          <div className="rounded-xl border border-[#d7ccff] bg-gradient-to-br from-[#fbf8ff] via-[#f3edff] to-[#eef3ff] p-3 dark:border-[#7c3aed]/25 dark:from-[#1d172b] dark:via-[#161925] dark:to-[#101827]">
            <p className="text-xs font-black leading-snug text-zinc-950 dark:text-white">
              Unlock {formatBytes(premiumBytes)} of premium storage
            </p>
            <p className="mt-1 text-[0.68rem] leading-relaxed text-[#586a8d] dark:text-slate-300">
              More space, faster uploads and advanced media tools.
            </p>
            <button
              className="mt-3 flex h-8 w-full items-center justify-center gap-2 rounded-lg bg-gradient-to-r from-violet-500 to-blue-600 px-3 text-xs font-bold text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-600 hover:to-blue-700"
              onClick={onUnlockPremium}
              type="button"
            >
              Unlock Premium
              <ChevronRightIcon className="ml-auto size-3.5" />
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-white/10 dark:bg-white/[0.035]",
        variant === "details" && "border-0 bg-transparent",
      )}
    >
      <div className={cn("grid gap-4", variant === "details" ? "p-0" : "p-4")}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-zinc-950 dark:text-white">Storage Overview</p>
            {variant !== "details" ? (
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Track your usage</p>
            ) : null}
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-500/10 px-2.5 py-1 text-[0.7rem] font-bold text-emerald-300">
            <span className="size-1.5 rounded-full bg-emerald-400" />
            Plenty of space
          </span>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-center lg:grid-cols-1">
          <div>
            <p className="text-sm font-bold text-zinc-950 dark:text-white">
              {formatBytes(usedStorageBytes)} used
            </p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
              of {formatBytes(freeBytes)}
            </p>
          </div>
          <div className="grid size-24 place-items-center rounded-full border-[7px] border-slate-100 text-center dark:border-white/10">
            <span>
              <span className={cn("block text-2xl font-black", accent.icon)}>
                {usagePercent}%
              </span>
              <span className="block text-sm text-slate-500 dark:text-slate-300">used</span>
            </span>
          </div>
        </div>

        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-white/10">
          <div
            className={cn("h-full rounded-full", accent.progress)}
            style={{ width: `${usagePercent}%` }}
          />
        </div>

        <div className="rounded-lg border border-[#d7ccff] bg-gradient-to-br from-[#fbf8ff] via-[#f3edff] to-[#eef3ff] p-4 dark:border-[#7c3aed]/25 dark:from-[#1d172b] dark:via-[#161925] dark:to-[#101827]">
          <div className="flex items-start gap-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-[#a855f7] to-[#6366f1] text-white shadow-md shadow-violet-500/20">
              <CrownIcon className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-zinc-950 dark:text-white">
                Unlock {formatBytes(premiumBytes)} of Premium storage
              </p>
              <ul className="mt-2 grid gap-1 text-xs text-[#586a8d] dark:text-slate-300">
                <li>5 GB of total storage</li>
                <li>Faster uploads</li>
                <li>Advanced file tools</li>
                <li>Priority support</li>
              </ul>
            </div>
          </div>
          <button
            className={cn(
              "mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-lg text-xs font-bold",
              "bg-gradient-to-r from-violet-500 to-blue-600 text-white shadow-lg shadow-violet-500/20 transition hover:from-violet-600 hover:to-blue-700",
            )}
            onClick={onUnlockPremium}
            type="button"
          >
            Unlock Premium
            <ChevronRightIcon className="ml-auto size-4" />
          </button>
        </div>

      </div>
    </div>
  );
}

function StorageBreakdownRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span>{label}</span>
      <span className="text-slate-500 dark:text-slate-400">{value}</span>
    </div>
  );
}

function LibraryButton({
  active,
  accent,
  icon: Icon,
  label,
  onClick,
  value,
}: {
  active?: boolean;
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  icon: typeof Grid2X2Icon;
  label: string;
  onClick: () => void;
  value: number;
}) {
  return (
    <button
      className={cn(
        "flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-slate-600 transition hover:bg-slate-100 hover:text-zinc-950 dark:text-slate-300 dark:hover:bg-white/[0.05] dark:hover:text-white",
        active && accent.activeLibrary,
      )}
      onClick={onClick}
      type="button"
    >
      <Icon className="size-4" />
      <span className="flex-1 text-left">{label}</span>
      <span className="text-xs text-slate-500 dark:text-slate-400">{value}</span>
    </button>
  );
}

function PendingUploadCard({
  accent,
  onRemove,
  upload,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  onRemove: () => void;
  upload: PendingMediaUpload;
}) {
  const isProcessing = upload.status === "processing";
  const isError = upload.status === "error";

  return (
    <div className="group relative overflow-hidden rounded-lg border border-white/10 bg-white/[0.035] text-left opacity-90">
      <button
        aria-label={`Remove ${upload.name}`}
        className="absolute right-2 top-2 z-20 grid size-7 place-items-center rounded-full border border-slate-200 bg-white/95 text-slate-700 opacity-100 shadow-sm transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 focus-visible:ring-2 focus-visible:ring-red-500/30 dark:border-white/10 dark:bg-[#101214]/95 dark:text-zinc-200 dark:hover:border-red-400/30 dark:hover:bg-red-500/15 dark:hover:text-red-200"
        onClick={onRemove}
        type="button"
      >
        <XIcon className="size-3.5" />
      </button>
      <div className="relative aspect-square bg-slate-100 dark:bg-white/[0.04]">
        {upload.previewUrl ? (
          <img
            alt=""
            className="h-full w-full object-cover blur-[2px]"
            src={upload.previewUrl}
          />
        ) : (
          <div className="grid h-full place-items-center text-slate-400">
            <FileVideoIcon className="size-9" />
          </div>
        )}
        <div className="absolute inset-0 grid place-items-center bg-white/60 backdrop-blur-[1px] dark:bg-black/50">
          <span className="grid place-items-center gap-2 text-xs font-semibold">
            {isError ? (
              <span className="grid size-12 place-items-center rounded-full bg-red-500/10 text-red-600">
                !
              </span>
            ) : (
              <CircularProgress
                accent={accent}
                progress={upload.progress}
                spin={isProcessing}
              />
            )}
            {isError
              ? "Upload failed"
              : isProcessing
                ? "Optimizing"
                : `${upload.progress}% uploaded`}
          </span>
        </div>
      </div>
      <div className="grid gap-1 p-2">
        <p className="truncate text-xs font-semibold text-zinc-950 dark:text-white">{upload.name}</p>
        <p className="text-xs text-slate-500 dark:text-slate-400">
          {isError ? upload.message : isProcessing ? "Processing..." : "Uploading..."}
        </p>
      </div>
    </div>
  );
}

function CircularProgress({
  accent,
  progress,
  spin,
}: {
  accent: (typeof mediaManagerAccentClasses)[MediaManagerSurface];
  progress: number;
  spin: boolean;
}) {
  const normalizedProgress = Math.max(0, Math.min(100, progress));
  const radius = 18;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (normalizedProgress / 100) * circumference;

  return (
    <span className="relative grid size-14 place-items-center">
      <svg
        aria-hidden="true"
        className={cn("size-14 -rotate-90", spin && "animate-spin")}
        viewBox="0 0 44 44"
      >
        <circle
          className="stroke-slate-200 dark:stroke-white/15"
          cx="22"
          cy="22"
          fill="none"
          r={radius}
          strokeWidth="4"
        />
        <circle
          className={cn("transition-all duration-150", accent.icon)}
          cx="22"
          cy="22"
          fill="none"
          r={radius}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={spin ? circumference * 0.28 : offset}
          strokeLinecap="round"
          strokeWidth="4"
        />
      </svg>
      {!spin ? (
        <span className="absolute text-[0.65rem] font-bold">
          {normalizedProgress}%
        </span>
      ) : null}
    </span>
  );
}

function uploadFileWithProgress({
  acceptedMediaTypes,
  file,
  id,
  onComplete,
  onError,
  onProgress,
  replaceAssetId,
  surface,
}: {
  acceptedMediaTypes: MediaType[];
  file: File;
  id: string;
  onComplete: (input: { asset: AdminMediaAsset; id: string }) => void;
  onError: (input: {
    id: string;
    message: string;
    storageFull?: StorageQuotaNotice;
  }) => void;
  onProgress: (input: {
    id: string;
    progress: number;
    status: PendingUploadStatus;
  }) => void;
  replaceAssetId?: string;
  surface: MediaManagerSurface;
}) {
  const formData = new FormData();
  const request = new XMLHttpRequest();
  const scope =
    surface === "admin"
      ? "admin-media"
      : surface === "seller"
        ? "seller-media"
        : "marketplace-media";
  const endpoint =
    surface === "seller" ? "/uploads/media" : "/admin/media/upload";

  formData.append("scope", scope);
  acceptedMediaTypes.forEach((mediaType) =>
    formData.append("acceptedMediaTypes", mediaType),
  );
  if (replaceAssetId) {
    formData.append("replaceAssetId", replaceAssetId);
  }
  formData.append("file", file);

  request.upload.onprogress = (event) => {
    if (!event.lengthComputable) {
      return;
    }

    const progress = Math.min(
      99,
      Math.round((event.loaded / event.total) * 100),
    );

    onProgress({ id, progress, status: "uploading" });
  };

  request.upload.onload = () => {
    onProgress({ id, progress: 100, status: "processing" });
  };

  request.onload = () => {
    try {
      const response = JSON.parse(request.responseText) as {
        asset?: AdminMediaAsset;
        code?: string;
        message?: string;
        ok?: boolean;
        storage?: StorageQuotaNotice;
      };

      if (request.status >= 200 && request.status < 300 && response.ok && response.asset) {
        onComplete({ asset: response.asset, id });
        return;
      }

      onError({
        id,
        message: response.message ?? "Could not upload this file.",
        storageFull:
          response.code === "storage_full" ? response.storage : undefined,
      });
    } catch {
      onError({ id, message: "Could not read the upload response." });
    }
  };

  request.onerror = () => {
    onError({ id, message: "The upload connection failed." });
  };

  request.open("POST", endpoint);
  request.send(formData);
}

function MediaPreview({ asset }: { asset: AdminMediaAsset }) {
  const src = asset.thumbnailUrl ?? asset.publicUrl;

  if (isDocumentAsset(asset)) {
    return (
      <div className="grid h-full place-items-center bg-slate-50 text-slate-500 dark:bg-white/[0.04] dark:text-slate-300">
        <span className="grid place-items-center gap-2">
          <FileTextIcon className="size-12" />
          <span className="text-xs font-bold uppercase">
            {asset.mimeType.split("/")[1] ?? "Document"}
          </span>
        </span>
      </div>
    );
  }

  if (asset.mimeType.startsWith("video/") && !asset.thumbnailUrl) {
    return (
      <video
        aria-label={asset.altText ?? asset.originalFileName ?? "Video preview"}
        className="h-full w-full object-cover"
        muted
        preload="metadata"
        src={asset.publicUrl}
      />
    );
  }

  return (
    <img
      alt={asset.altText ?? asset.originalFileName ?? ""}
      className="h-full w-full object-cover"
      src={src}
    />
  );
}

function getAssetMediaType(asset: AdminMediaAsset): MediaType | "unknown" {
  if (asset.mimeType.startsWith("image/")) {
    return "image";
  }

  if (asset.mimeType.startsWith("video/")) {
    return "video";
  }

  if (isDocumentAsset(asset)) {
    return "document";
  }

  return "unknown";
}

function isAssetSelectable(
  asset: AdminMediaAsset,
  acceptedMediaTypes: MediaType[],
) {
  const mediaType = getAssetMediaType(asset);

  return mediaType !== "unknown" && acceptedMediaTypes.includes(mediaType);
}

function getFileMediaType(file: File): MediaType | "unknown" {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (isDocumentMimeType(file.type)) {
    return "document";
  }

  return "unknown";
}

function getAcceptAttribute(acceptedMediaTypes: MediaType[]) {
  const acceptsImages = acceptedMediaTypes.includes("image");
  const acceptsVideos = acceptedMediaTypes.includes("video");
  const acceptsDocuments = acceptedMediaTypes.includes("document");

  return [
    acceptsImages ? "image/avif,image/jpeg,image/png,image/webp" : null,
    acceptsVideos ? "video/mp4,video/quicktime,video/webm" : null,
    acceptsDocuments ? "application/pdf" : null,
  ]
    .filter(Boolean)
    .join(",");
}

function getLibraryFilterLabel(filter: LibraryFilter) {
  if (filter === "image") {
    return "Images";
  }

  if (filter === "video") {
    return "Videos";
  }

  if (filter === "brand") {
    return "Brand assets";
  }

  if (filter === "document") {
    return "Documents";
  }

  if (filter === "product") {
    return "Product images";
  }

  if (filter === "trash") {
    return "Trash";
  }

  return "All files";
}

function MediaSortDropdown({
  className,
  onSortOrderChange,
  sortOrder,
}: {
  className?: string;
  onSortOrderChange: (sortOrder: MediaSortOrder) => void;
  sortOrder: MediaSortOrder;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            aria-label="Sort media"
            className={cn(
              "h-10 rounded-lg border-slate-200 bg-white px-3 text-sm font-semibold text-zinc-950 hover:bg-slate-50 data-[popup-open]:bg-slate-50 dark:border-white/10 dark:bg-white/[0.03] dark:text-white dark:hover:bg-white/[0.07] dark:data-[popup-open]:bg-white/[0.07]",
              className,
            )}
            type="button"
            variant="outline"
          >
            {getMediaSortLabel(sortOrder)}
          </Button>
        }
      />
      <DropdownMenuContent
        align="end"
        className="w-36 border border-slate-200 bg-white p-1 text-zinc-950 shadow-xl dark:border-white/10 dark:bg-[#151719] dark:text-white"
        collisionAvoidance={{
          align: "shift",
          fallbackAxisSide: "none",
          side: "flip",
        }}
        collisionPadding={12}
        sideOffset={8}
        sticky
      >
        <DropdownMenuRadioGroup
          value={sortOrder}
          onValueChange={(value) => onSortOrderChange(value as MediaSortOrder)}
        >
          <DropdownMenuRadioItem
            className="cursor-pointer px-3 py-2 text-sm"
            value="newest"
          >
            Newest
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            className="cursor-pointer px-3 py-2 text-sm"
            value="oldest"
          >
            Oldest
          </DropdownMenuRadioItem>
          <DropdownMenuRadioItem
            className="cursor-pointer px-3 py-2 text-sm"
            value="name"
          >
            Name
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function getMediaSortLabel(sortOrder: MediaSortOrder) {
  if (sortOrder === "oldest") {
    return "Oldest";
  }

  if (sortOrder === "name") {
    return "Name";
  }

  return "Newest";
}

function isDocumentAsset(asset: AdminMediaAsset) {
  return isDocumentMimeType(asset.mimeType);
}

function isDocumentMimeType(mimeType: string) {
  return mimeType.toLowerCase() === "application/pdf";
}

function isBrandAsset(asset: AdminMediaAsset) {
  const fileName = asset.originalFileName?.toLowerCase() ?? "";
  const tags = asset.tags?.toLowerCase() ?? "";

  return tags.includes("brand") || fileName.includes("brand") || fileName.includes("logo");
}

function normalizeMediaFolderName(name: string) {
  return name.trim().toLowerCase();
}

function isSystemMediaFolderName(name: string) {
  const normalizedName = normalizeMediaFolderName(name);

  return systemMediaFolders.some(
    (folder) => normalizeMediaFolderName(folder.label) === normalizedName,
  );
}

function getCustomMediaFolders(folders: AdminMediaFolder[]) {
  return folders.filter((folder) => !isSystemMediaFolderName(folder.name));
}

function getSystemFolderIds(folders: AdminMediaFolder[]) {
  return systemMediaFolders.reduce(
    (ids, systemFolder) => {
      const persistedFolder = folders.find(
        (folder) =>
          normalizeMediaFolderName(folder.name) ===
          normalizeMediaFolderName(systemFolder.label),
      );

      ids[systemFolder.filter] = persistedFolder?.id ?? null;

      return ids;
    },
    {
      brand: null,
      document: null,
      product: null,
      trash: null,
    } as Record<
      Extract<LibraryFilter, "brand" | "document" | "product" | "trash">,
      string | null
    >,
  );
}

function getAssetFolderIds(asset: AdminMediaAsset) {
  return asset.folderIds?.length ? asset.folderIds : legacyFolderIds(asset.folderId);
}

function legacyFolderIds(folderId: string | null) {
  return folderId ? [folderId] : [];
}

function hasAssetFolder(asset: AdminMediaAsset, folderId: string | null) {
  return Boolean(folderId && getAssetFolderIds(asset).includes(folderId));
}

function getAssignableMediaFolders(folders: AdminMediaFolder[]) {
  const systemOptions = systemMediaFolders.map((folder) => {
    const persistedFolder = folders.find(
      (persisted) =>
        normalizeMediaFolderName(persisted.name) ===
        normalizeMediaFolderName(folder.label),
    );

    return {
      kind: "system" as const,
      label: folder.label,
      value: persistedFolder?.id ?? `system-${folder.filter}`,
    };
  });
  const customOptions = getCustomMediaFolders(folders).map((folder) => ({
    kind: "custom" as const,
    label: folder.name,
    value: folder.id,
  }));

  return [...systemOptions, ...customOptions];
}

function getAcceptedMediaDescription(acceptedMediaTypes: MediaType[]) {
  const acceptsImages = acceptedMediaTypes.includes("image");
  const acceptsVideos = acceptedMediaTypes.includes("video");
  const acceptsDocuments = acceptedMediaTypes.includes("document");

  if (acceptsImages && acceptsVideos && acceptsDocuments) {
    return "Images become optimized WebP. Videos become compressed MP4. Documents are stored safely.";
  }

  if (acceptsImages && acceptsVideos) {
    return "Images become optimized WebP. Videos become compressed MP4 with a poster thumbnail.";
  }

  if (acceptsImages) {
    return "JPG, PNG, WebP, and AVIF are converted to optimized WebP.";
  }

  if (acceptsVideos) {
    return "MP4, MOV, and WebM are compressed to MP4 with a poster thumbnail.";
  }

  return "PDF documents are stored safely.";
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
  }

  return `${(bytes / 1024 / 1024 / 1024).toFixed(1)} GB`;
}

function formatDuration(durationMs: number) {
  const totalSeconds = Math.round(durationMs / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

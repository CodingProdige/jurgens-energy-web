import { revalidatePath } from "next/cache";
import { z } from "zod";

import { requireSellerDashboardAccess } from "@/src/modules/auth/permissions";
import {
  MediaStorageQuotaError,
  processAndStoreMediaUpload,
  replaceStoredMediaAsset,
} from "@/src/modules/media/admin";
import { getPrimarySellerForUser } from "@/src/modules/sellers/dashboard";

const uploadSchema = z.object({
  acceptedMediaTypes: z
    .array(z.enum(["document", "image", "video"]))
    .min(1)
    .default(["image", "video"]),
  replaceAssetId: z.string().uuid().optional(),
  scope: z.literal("seller-media").default("seller-media"),
});

function getFileMediaType(file: File) {
  if (file.type.startsWith("image/")) {
    return "image";
  }

  if (file.type.startsWith("video/")) {
    return "video";
  }

  if (file.type.toLowerCase() === "application/pdf") {
    return "document";
  }

  return "unknown";
}

export async function POST(request: Request) {
  const session = await requireSellerDashboardAccess();
  const seller = await getPrimarySellerForUser(session.user.id);

  if (!seller) {
    return Response.json(
      { ok: false, message: "Seller access could not be confirmed." },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const parsed = uploadSchema.safeParse({
    acceptedMediaTypes: formData.getAll("acceptedMediaTypes"),
    replaceAssetId: formData.get("replaceAssetId") || undefined,
    scope: String(formData.get("scope") ?? "seller-media"),
  });

  if (!parsed.success) {
    return Response.json(
      { ok: false, message: "Check the upload details." },
      { status: 400 },
    );
  }

  if (!(file instanceof File) || file.size === 0) {
    return Response.json(
      { ok: false, message: "Choose a media file to upload." },
      { status: 400 },
    );
  }

  const mediaType = getFileMediaType(file);

  if (mediaType === "unknown" || !parsed.data.acceptedMediaTypes.includes(mediaType)) {
    return Response.json(
      {
        ok: false,
        message: `This picker does not accept ${mediaType} files.`,
      },
      { status: 400 },
    );
  }

  try {
    const asset = parsed.data.replaceAssetId
      ? await replaceStoredMediaAsset({
          assetId: parsed.data.replaceAssetId,
          file,
          ownerUserId: session.user.id,
          scope: "seller-media",
        })
      : await processAndStoreMediaUpload({
          file,
          ownerUserId: session.user.id,
          scope: "seller-media",
        });

    revalidatePath("/seller/products/new");

    return Response.json({
      asset,
      ok: true,
      message: parsed.data.replaceAssetId
        ? "Media file replaced and optimized."
        : "Media uploaded and optimized.",
    });
  } catch (error) {
    if (error instanceof MediaStorageQuotaError) {
      return Response.json(
        {
          code: error.code,
          ok: false,
          message: error.message,
          storage: error.details,
        },
        { status: 413 },
      );
    }

    return Response.json(
      {
        ok: false,
        message:
          error instanceof Error
            ? error.message
            : "Could not process the uploaded media.",
      },
      { status: 400 },
    );
  }
}

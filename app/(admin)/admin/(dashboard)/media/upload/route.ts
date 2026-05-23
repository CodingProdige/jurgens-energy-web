import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { canAccessCapability } from "@/src/modules/auth/service";
import {
  getSurfaceAccessCookieName,
  verifySurfaceAccessToken,
} from "@/src/modules/auth/surface-access";
import {
  MediaStorageQuotaError,
  processAndStoreMediaUpload,
  replaceStoredMediaAsset,
} from "@/src/modules/media/admin";

const uploadSchema = z.object({
  acceptedMediaTypes: z
    .array(z.enum(["document", "image", "video"]))
    .min(1)
    .default(["image", "video"]),
  replaceAssetId: z.string().uuid().optional(),
  scope: z.string().trim().regex(/^[a-z0-9][a-z0-9-]*$/),
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
  const session = await auth();

  if (!session?.user || !canAccessCapability(session.user, "admin")) {
    return Response.json(
      { ok: false, message: "Sign in as an admin to upload media." },
      { status: 401 },
    );
  }

  const cookieStore = await cookies();
  const surfaceAccessToken = cookieStore.get(
    getSurfaceAccessCookieName("admin"),
  )?.value;

  if (
    !verifySurfaceAccessToken({
      surface: "admin",
      token: surfaceAccessToken,
      userId: session.user.id,
    })
  ) {
    return Response.json(
      { ok: false, message: "Admin session verification is required." },
      { status: 401 },
    );
  }

  const formData = await request.formData();
  const file = formData.get("file");
  const parsed = uploadSchema.safeParse({
    acceptedMediaTypes: formData.getAll("acceptedMediaTypes"),
    replaceAssetId: formData.get("replaceAssetId") || undefined,
    scope: String(formData.get("scope") ?? "admin-media"),
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
          scope: "admin-media",
        })
      : await processAndStoreMediaUpload({
          file,
          ownerUserId: session.user.id,
          scope: "admin-media",
        });

    revalidatePath("/catalog/brands");

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

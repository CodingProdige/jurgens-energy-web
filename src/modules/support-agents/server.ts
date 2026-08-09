import "server-only";

import { cache } from "react";

import { and, asc, eq, like } from "drizzle-orm";
import { z } from "zod";

import { db } from "@/src/db";
import { auditLogs } from "@/src/db/schema/audit-logs";
import { media } from "@/src/db/schema/media";
import { supportAgents } from "@/src/db/schema/support-agents";
import { getMediaPublicUrl } from "@/src/modules/media/paths";
import { normalizePhoneNumber } from "@/src/modules/phone";
import type { SupportAgentInput } from "@/src/modules/support-agents/contracts";

export type SupportAgentPlacement = "about" | "footer" | "support";

export type PublicSupportAgent = {
  availability: string | null;
  bio: string | null;
  displayName: string;
  id: string;
  photoUrl: string | null;
  publicEmail: string | null;
  publicPhone: string | null;
  publicWhatsapp: string | null;
  roleTitle: string | null;
};

export type AdminSupportAgent = PublicSupportAgent & {
  createdAt: Date;
  isPublished: boolean;
  photoMediaId: string | null;
  showInFooter: boolean;
  showOnAbout: boolean;
  showOnSupport: boolean;
  sortOrder: number;
  updatedAt: Date;
};

type SupportAgentRow = Omit<AdminSupportAgent, "photoUrl"> & {
  photoIsPublic: boolean | null;
  photoMimeType: string | null;
  photoRelativePath: string | null;
  photoThumbnailRelativePath: string | null;
};

export class SupportAgentInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SupportAgentInputError";
  }
}

const supportAgentSelection = {
  availability: supportAgents.availability,
  bio: supportAgents.bio,
  createdAt: supportAgents.createdAt,
  displayName: supportAgents.displayName,
  id: supportAgents.id,
  isPublished: supportAgents.isPublished,
  photoIsPublic: media.isPublic,
  photoMediaId: supportAgents.photoMediaId,
  photoMimeType: media.mimeType,
  photoRelativePath: media.relativePath,
  photoThumbnailRelativePath: media.thumbnailRelativePath,
  publicEmail: supportAgents.publicEmail,
  publicPhone: supportAgents.publicPhone,
  publicWhatsapp: supportAgents.publicWhatsapp,
  roleTitle: supportAgents.roleTitle,
  showInFooter: supportAgents.showInFooter,
  showOnAbout: supportAgents.showOnAbout,
  showOnSupport: supportAgents.showOnSupport,
  sortOrder: supportAgents.sortOrder,
  updatedAt: supportAgents.updatedAt,
} as const;

const safePublicEmailSchema = z.string().trim().email().max(254);

function toAdminSupportAgent(row: SupportAgentRow): AdminSupportAgent {
  const imagePath =
    row.photoIsPublic && row.photoMimeType?.startsWith("image/")
      ? (row.photoThumbnailRelativePath ?? row.photoRelativePath)
      : null;

  return {
    availability: row.availability,
    bio: row.bio,
    createdAt: row.createdAt,
    displayName: row.displayName,
    id: row.id,
    isPublished: row.isPublished,
    photoMediaId: row.photoMediaId,
    photoUrl: imagePath ? getMediaPublicUrl(imagePath) : null,
    publicEmail: row.publicEmail,
    publicPhone: row.publicPhone,
    publicWhatsapp: row.publicWhatsapp,
    roleTitle: row.roleTitle,
    showInFooter: row.showInFooter,
    showOnAbout: row.showOnAbout,
    showOnSupport: row.showOnSupport,
    sortOrder: row.sortOrder,
    updatedAt: row.updatedAt,
  };
}

function toPublicSupportAgent(agent: AdminSupportAgent): PublicSupportAgent {
  const parsedPublicEmail = safePublicEmailSchema.safeParse(agent.publicEmail);

  return {
    availability: agent.availability,
    bio: agent.bio,
    displayName: agent.displayName,
    id: agent.id,
    photoUrl: agent.photoUrl,
    publicEmail: parsedPublicEmail.success ? parsedPublicEmail.data : null,
    publicPhone: agent.publicPhone
      ? normalizePhoneNumber(agent.publicPhone, { defaultCountryCode: "ZA" })
      : null,
    publicWhatsapp: agent.publicWhatsapp
      ? normalizePhoneNumber(agent.publicWhatsapp, { defaultCountryCode: "ZA" })
      : null,
    roleTitle: agent.roleTitle,
  };
}

function placementCondition(placement: SupportAgentPlacement) {
  if (placement === "footer") {
    return eq(supportAgents.showInFooter, true);
  }

  if (placement === "about") {
    return eq(supportAgents.showOnAbout, true);
  }

  return eq(supportAgents.showOnSupport, true);
}

async function assertPublicImage(photoMediaId: string | null) {
  if (!photoMediaId) {
    return;
  }

  const [photo] = await db
    .select({ id: media.id })
    .from(media)
    .where(
      and(
        eq(media.id, photoMediaId),
        eq(media.isPublic, true),
        like(media.mimeType, "image/%"),
      ),
    )
    .limit(1);

  if (!photo) {
    throw new SupportAgentInputError(
      "Choose a public image from the media library for the agent photo.",
    );
  }
}

export async function getAdminSupportAgents(): Promise<AdminSupportAgent[]> {
  const rows = await db
    .select(supportAgentSelection)
    .from(supportAgents)
    .leftJoin(media, eq(media.id, supportAgents.photoMediaId))
    .orderBy(asc(supportAgents.sortOrder), asc(supportAgents.displayName));

  return rows.map((row) => toAdminSupportAgent(row as SupportAgentRow));
}

export const getPublicSupportAgents = cache(
  async (placement: SupportAgentPlacement): Promise<PublicSupportAgent[]> => {
    const rows = await db
      .select(supportAgentSelection)
      .from(supportAgents)
      .leftJoin(media, eq(media.id, supportAgents.photoMediaId))
      .where(
        and(
          eq(supportAgents.isPublished, true),
          placementCondition(placement),
        ),
      )
      .orderBy(asc(supportAgents.sortOrder), asc(supportAgents.displayName));

    return rows.map((row) =>
      toPublicSupportAgent(toAdminSupportAgent(row as SupportAgentRow)),
    );
  },
);

export async function createSupportAgent({
  actorUserId,
  input,
}: {
  actorUserId: string;
  input: SupportAgentInput;
}) {
  await assertPublicImage(input.photoMediaId);

  return db.transaction(async (tx) => {
    const currentAgents = await tx
      .select({ sortOrder: supportAgents.sortOrder })
      .from(supportAgents);
    const sortOrder =
      currentAgents.reduce(
        (highest, agent) => Math.max(highest, agent.sortOrder),
        -1,
      ) + 1;
    const [created] = await tx
      .insert(supportAgents)
      .values({ ...input, sortOrder })
      .returning({ id: supportAgents.id });

    if (!created) {
      throw new Error("Support agent could not be created.");
    }

    await tx.insert(auditLogs).values({
      action: "admin.support_agent.create",
      actorUserId,
      entityId: created.id,
      entityType: "support_agent",
      metadata: JSON.stringify({
        displayName: input.displayName,
        isPublished: input.isPublished,
        placements: {
          about: input.showOnAbout,
          footer: input.showInFooter,
          support: input.showOnSupport,
        },
      }),
    });

    return created.id;
  });
}

export async function updateSupportAgent({
  actorUserId,
  id,
  input,
}: {
  actorUserId: string;
  id: string;
  input: SupportAgentInput;
}) {
  await assertPublicImage(input.photoMediaId);

  return db.transaction(async (tx) => {
    const [updated] = await tx
      .update(supportAgents)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(supportAgents.id, id))
      .returning({ id: supportAgents.id });

    if (!updated) {
      throw new SupportAgentInputError("Support agent was not found.");
    }

    await tx.insert(auditLogs).values({
      action: "admin.support_agent.update",
      actorUserId,
      entityId: updated.id,
      entityType: "support_agent",
      metadata: JSON.stringify({
        displayName: input.displayName,
        isPublished: input.isPublished,
        placements: {
          about: input.showOnAbout,
          footer: input.showInFooter,
          support: input.showOnSupport,
        },
      }),
    });

    return true;
  });
}

export async function deleteSupportAgent({
  actorUserId,
  id,
}: {
  actorUserId: string;
  id: string;
}) {
  return db.transaction(async (tx) => {
    const [deleted] = await tx
      .delete(supportAgents)
      .where(eq(supportAgents.id, id))
      .returning({ displayName: supportAgents.displayName, id: supportAgents.id });

    if (!deleted) {
      throw new SupportAgentInputError("Support agent was not found.");
    }

    await tx.insert(auditLogs).values({
      action: "admin.support_agent.delete",
      actorUserId,
      entityId: deleted.id,
      entityType: "support_agent",
      metadata: JSON.stringify({ displayName: deleted.displayName }),
    });

    return true;
  });
}

export async function reorderSupportAgents({
  actorUserId,
  orderedIds,
}: {
  actorUserId: string;
  orderedIds: string[];
}) {
  const existingAgents = await db
    .select({ id: supportAgents.id })
    .from(supportAgents);
  const existingIds = new Set(existingAgents.map((agent) => agent.id));

  if (
    existingAgents.length !== orderedIds.length ||
    orderedIds.some((id) => !existingIds.has(id))
  ) {
    throw new SupportAgentInputError(
      "The support-team order changed. Refresh the page and try again.",
    );
  }

  await db.transaction(async (tx) => {
    for (const [sortOrder, id] of orderedIds.entries()) {
      await tx
        .update(supportAgents)
        .set({ sortOrder, updatedAt: new Date() })
        .where(eq(supportAgents.id, id));
    }

    await tx.insert(auditLogs).values({
      action: "admin.support_agent.reorder",
      actorUserId,
      entityType: "support_agent",
      metadata: JSON.stringify({ agentCount: orderedIds.length }),
    });
  });
}

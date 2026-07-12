import crypto from "node:crypto";

import { asc, desc, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "@/src/db";
import {
  orders,
  users,
  whatsappConversations,
  whatsappMessages,
  whatsappOrderDrafts,
} from "@/src/db/schema";
import {
  send360DialogMediaMessage,
  send360DialogTextMessage,
  type WhatsappMediaMessageAttachment,
} from "@/src/modules/whatsapp-ordering/360dialog";
import {
  getWhatsappFollowUpSettings,
  type WhatsappFollowUpSettings,
} from "@/src/modules/marketplace/settings";

type WhatsappModerationState = {
  abuseCount?: number;
  automationPausedAt?: string;
  automationPausedBy?: "admin" | "system";
  lastFlagReason?: string;
  lastFlaggedAt?: string;
  mutedUntil?: string;
  unknownCount?: number;
};

type WhatsappConversationState = {
  followUp?: {
    count?: number;
    lastIntent?: string;
    lastSentAt?: string;
  };
  moderation?: WhatsappModerationState;
  pendingOrder?: unknown;
};

export type AdminWhatsappMessageAttachment = {
  assetId?: string;
  fileName: string | null;
  mimeType: string;
  type: "document" | "image" | "video";
  url: string;
};

export type AdminWhatsappMessage = {
  attachment: AdminWhatsappMessageAttachment | null;
  body: string;
  createdAt: Date;
  direction: string;
  id: string;
};

export type AdminWhatsappConversation = {
  activity: {
    description: string;
    label: string;
    status:
      | "awaiting_customer"
      | "idle"
      | "live"
      | "manual_handover"
      | "muted"
      | "needs_follow_up"
      | "needs_reply";
  };
  customer: {
    accountCreatedAt: Date | null;
    email: string | null;
    name: string | null;
    userId: string | null;
  };
  customerStats: {
    lastOrder: {
      createdAt: Date;
      grandTotal: string;
      orderNumber: string;
      paidAt: Date | null;
      status: string;
    } | null;
    lastWhatsappOrderAt: Date | null;
    lifetimeOrderValue: string;
    orderCount: number;
    whatsappDraftCount: number;
    whatsappOrderCount: number;
  };
  id: string;
  isAutomationPaused: boolean;
  isMuted: boolean;
  lastInboundAt: Date | null;
  lastIntent: string | null;
  lastOutboundAt: Date | null;
  moderation: WhatsappModerationState;
  phone: string;
  provider: string;
  recentMessages: AdminWhatsappMessage[];
  status: string;
  updatedAt: Date;
};

export type AdminWhatsappConversationsData = {
  conversations: AdminWhatsappConversation[];
  metrics: {
    active: number;
    flagged: number;
    manualHandover: number;
    muted: number;
    needsFollowUp: number;
    needsReply: number;
    total: number;
  };
};

export async function getAdminWhatsappConversations(): Promise<AdminWhatsappConversationsData> {
  const [rows, followUpSettings] = await Promise.all([
    db
      .select({
        customerEmail: users.email,
        customerName: users.name,
        customerCreatedAt: users.createdAt,
        id: whatsappConversations.id,
        lastInboundAt: whatsappConversations.lastInboundAt,
        lastIntent: whatsappConversations.lastIntent,
        lastOutboundAt: whatsappConversations.lastOutboundAt,
        phone: whatsappConversations.phone,
        provider: whatsappConversations.provider,
        state: whatsappConversations.state,
        status: whatsappConversations.status,
        updatedAt: whatsappConversations.updatedAt,
        userId: whatsappConversations.userId,
      })
      .from(whatsappConversations)
      .leftJoin(users, eq(users.id, whatsappConversations.userId))
      .orderBy(desc(whatsappConversations.updatedAt))
      .limit(50),
    getWhatsappFollowUpSettings(),
  ]);

  const conversationIds = rows.map((row) => row.id);
  const messageRows =
    conversationIds.length > 0
      ? await db
          .select({
            body: whatsappMessages.body,
            conversationId: whatsappMessages.conversationId,
            createdAt: whatsappMessages.createdAt,
            direction: whatsappMessages.direction,
            id: whatsappMessages.id,
            payload: whatsappMessages.payload,
          })
          .from(whatsappMessages)
          .where(inArray(whatsappMessages.conversationId, conversationIds))
          .orderBy(desc(whatsappMessages.createdAt))
          .limit(300)
      : [];
  const messagesByConversation = new Map<string, AdminWhatsappMessage[]>();

  for (const message of messageRows) {
    const messages = messagesByConversation.get(message.conversationId) ?? [];

    if (messages.length < 6) {
      messages.push({
        attachment: extractMessageAttachment(message.payload),
        body: message.body,
        createdAt: message.createdAt,
        direction: message.direction,
        id: message.id,
      });
      messagesByConversation.set(message.conversationId, messages);
    }
  }

  const conversations = await Promise.all(
    rows.map(async (row) =>
      toAdminConversation({
        customerStats: await getCustomerStats({
          phone: row.phone,
          userId: row.userId,
        }),
        followUpSettings,
        row,
        messages: (messagesByConversation.get(row.id) ?? []).reverse(),
      }),
    ),
  );

  return {
    conversations,
    metrics: {
      active: conversations.filter(
        (conversation) =>
          conversation.status === "open" &&
          !conversation.isAutomationPaused &&
          !conversation.isMuted,
      ).length,
      flagged: conversations.filter(
        (conversation) =>
          (conversation.moderation.abuseCount ?? 0) > 0 ||
          (conversation.moderation.unknownCount ?? 0) > 0,
      ).length,
      manualHandover: conversations.filter(
        (conversation) => conversation.isAutomationPaused,
      ).length,
      muted: conversations.filter((conversation) => conversation.isMuted).length,
      needsFollowUp: conversations.filter(
        (conversation) => conversation.activity.status === "needs_follow_up",
      ).length,
      needsReply: conversations.filter(
        (conversation) => conversation.activity.status === "needs_reply",
      ).length,
      total: conversations.length,
    },
  };
}

function toMessage(input: {
  body: string;
  createdAt: Date;
  direction: string;
  id: string;
  payload: Record<string, unknown> | null;
}): AdminWhatsappMessage {
  return {
    attachment: extractMessageAttachment(input.payload),
    body: input.body,
    createdAt: input.createdAt,
    direction: input.direction,
    id: input.id,
  };
}

export async function getAdminWhatsappConversation(
  conversationId: string,
): Promise<AdminWhatsappConversation | null> {
  const [row] = await db
    .select({
      customerCreatedAt: users.createdAt,
      customerEmail: users.email,
      customerName: users.name,
      id: whatsappConversations.id,
      lastInboundAt: whatsappConversations.lastInboundAt,
      lastIntent: whatsappConversations.lastIntent,
      lastOutboundAt: whatsappConversations.lastOutboundAt,
      phone: whatsappConversations.phone,
      provider: whatsappConversations.provider,
      state: whatsappConversations.state,
      status: whatsappConversations.status,
      updatedAt: whatsappConversations.updatedAt,
      userId: whatsappConversations.userId,
    })
    .from(whatsappConversations)
    .leftJoin(users, eq(users.id, whatsappConversations.userId))
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);

  if (!row) {
    return null;
  }

  const [messages, followUpSettings] = await Promise.all([
    db
      .select({
        body: whatsappMessages.body,
        createdAt: whatsappMessages.createdAt,
        direction: whatsappMessages.direction,
        id: whatsappMessages.id,
        payload: whatsappMessages.payload,
      })
      .from(whatsappMessages)
      .where(eq(whatsappMessages.conversationId, conversationId))
      .orderBy(asc(whatsappMessages.createdAt))
      .limit(500),
    getWhatsappFollowUpSettings(),
  ]);

  return toAdminConversation({
    customerStats: await getCustomerStats({
      phone: row.phone,
      userId: row.userId,
    }),
    followUpSettings,
    row,
    messages: messages.map(toMessage),
  });
}

/*
 * Keep conversation reads above the mutations. It makes the admin surface easier
 * to scan because the row/detail page data shape is defined before actions.
 */
async function getCustomerStats({
  phone,
  userId,
}: {
  phone: string;
  userId: string | null;
}): Promise<AdminWhatsappConversation["customerStats"]> {
  const orderWhere = customerOrderIdentityCondition({ phone, userId });
  const whatsappWhere = customerWhatsappIdentityCondition({ phone, userId });
  const [orderStats, lastOrder, draftRows] = await Promise.all([
    db
      .select({
        lifetimeOrderValue: sql<string>`coalesce(sum(${orders.grandTotal}), 0)::text`,
        orderCount: sql<number>`count(*)::int`,
      })
      .from(orders)
      .where(orderWhere),
    db
      .select({
        createdAt: orders.createdAt,
        grandTotal: orders.grandTotal,
        orderNumber: orders.orderNumber,
        paidAt: orders.paidAt,
        status: orders.status,
      })
      .from(orders)
      .where(orderWhere)
      .orderBy(desc(orders.createdAt))
      .limit(1),
    db
      .select({
        consumedAt: whatsappOrderDrafts.consumedAt,
        createdAt: whatsappOrderDrafts.createdAt,
        status: whatsappOrderDrafts.status,
      })
      .from(whatsappOrderDrafts)
      .where(whatsappWhere)
      .orderBy(desc(whatsappOrderDrafts.createdAt))
      .limit(500),
  ]);

  const whatsappOrderRows = draftRows.filter((row) => row.status === "consumed");
  const lastWhatsappOrderAt =
    whatsappOrderRows
      .map((row) => row.consumedAt ?? row.createdAt)
      .filter((date): date is Date => Boolean(date))
      .sort((a, b) => b.getTime() - a.getTime())[0] ?? null;

  return {
    lastOrder: lastOrder[0] ?? null,
    lastWhatsappOrderAt,
    lifetimeOrderValue: orderStats[0]?.lifetimeOrderValue ?? "0",
    orderCount: Number(orderStats[0]?.orderCount ?? 0),
    whatsappDraftCount: draftRows.length,
    whatsappOrderCount: whatsappOrderRows.length,
  };
}

function customerOrderIdentityCondition({
  phone,
  userId,
}: {
  phone: string;
  userId: string | null;
}) {
  return userId
    ? or(eq(orders.customerPhone, phone), eq(orders.userId, userId))
    : eq(orders.customerPhone, phone);
}

function customerWhatsappIdentityCondition({
  phone,
  userId,
}: {
  phone: string;
  userId: string | null;
}) {
  return userId
    ? or(eq(whatsappOrderDrafts.phone, phone), eq(whatsappOrderDrafts.userId, userId))
    : eq(whatsappOrderDrafts.phone, phone);
}

export async function pauseWhatsappConversationAutomation({
  adminUserId,
  conversationId,
}: {
  adminUserId: string;
  conversationId: string;
}) {
  const state = await getConversationState(conversationId);
  const now = new Date().toISOString();

  await updateConversationState(conversationId, {
    ...state,
    moderation: {
      ...state.moderation,
      automationPausedAt: now,
      automationPausedBy: "admin",
      lastFlagReason: `Manual handover by admin ${adminUserId}`,
      lastFlaggedAt: now,
    },
  });
}

export async function resumeWhatsappConversationAutomation(conversationId: string) {
  const state = await getConversationState(conversationId);
  const moderation = { ...state.moderation };

  delete moderation.automationPausedAt;
  delete moderation.automationPausedBy;
  delete moderation.mutedUntil;

  await updateConversationState(conversationId, {
    ...state,
    moderation,
  });
}

export async function clearWhatsappConversationModeration(conversationId: string) {
  const state = await getConversationState(conversationId);
  const nextState = { ...state };

  delete nextState.moderation;

  await updateConversationState(conversationId, nextState);
}

export async function sendAdminWhatsappConversationMessage({
  adminUserId,
  attachment,
  body,
  conversationId,
  intent = "manual_handoff",
}: {
  adminUserId: string;
  attachment?: AdminWhatsappMessageAttachment;
  body?: string;
  conversationId: string;
  intent?: string;
}) {
  const message = body?.trim() ?? "";

  if (!message && !attachment) {
    return { ok: false, message: "Message is required." };
  }

  const [conversation] = await db
    .select({
      phone: whatsappConversations.phone,
      provider: whatsappConversations.provider,
      state: whatsappConversations.state,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    return { ok: false, message: "Conversation was not found." };
  }

  const result = attachment
    ? await send360DialogMediaMessage({
        attachment: toProviderAttachment(attachment),
        body: message,
        to: conversation.phone,
      })
    : await send360DialogTextMessage({
        body: message,
        to: conversation.phone,
      });

  if (!result.ok) {
    return {
      ok: false,
      message: "WhatsApp provider did not accept the message.",
    };
  }

  const now = new Date();
  const provider = normalizeProvider(conversation.provider);
  const state = normalizeConversationState(conversation.state);

  await db.insert(whatsappMessages).values({
    body: message || attachment?.fileName || `${attachment?.type ?? "Media"} attachment`,
    conversationId,
    direction: "outbound",
    payload: attachment ? { attachment } : undefined,
    provider,
    providerMessageId: `admin:${crypto.randomUUID()}`,
  });

  await db
    .update(whatsappConversations)
    .set({
      lastIntent: intent,
      lastOutboundAt: now,
      state: removeUndefined({
        ...state,
        moderation: {
          ...state.moderation,
          automationPausedAt:
            state.moderation?.automationPausedAt ?? now.toISOString(),
          automationPausedBy: "admin",
          lastFlagReason: `Manual message by admin ${adminUserId}`,
          lastFlaggedAt: now.toISOString(),
        },
      }),
      updatedAt: now,
    })
    .where(eq(whatsappConversations.id, conversationId));

  return { ok: true, message: "Message sent." };
}

export async function sendAdminWhatsappFollowUp({
  adminUserId,
  conversationId,
}: {
  adminUserId: string;
  conversationId: string;
}) {
  const [conversation, followUpSettings] = await Promise.all([
    getAdminWhatsappConversation(conversationId),
    getWhatsappFollowUpSettings(),
  ]);

  if (!conversation) {
    return { ok: false, message: "Conversation was not found." };
  }

  return sendAdminWhatsappConversationMessage({
    adminUserId,
    body: buildFollowUpMessage(conversation.lastIntent, followUpSettings),
    conversationId,
    intent: "manual_follow_up",
  });
}

export type WhatsappFollowUpRunResult = {
  attempted: number;
  failed: number;
  scanned: number;
  sent: number;
  skipped: {
    disabled: number;
    maxCount: number;
    outsideCustomerServiceWindow: number;
    quietHours: number;
  };
};

export async function runDueWhatsappFollowUps({
  limit = 25,
}: {
  limit?: number;
} = {}): Promise<WhatsappFollowUpRunResult> {
  const settings = await getWhatsappFollowUpSettings();
  const result: WhatsappFollowUpRunResult = {
    attempted: 0,
    failed: 0,
    scanned: 0,
    sent: 0,
    skipped: {
      disabled: 0,
      maxCount: 0,
      outsideCustomerServiceWindow: 0,
      quietHours: 0,
    },
  };

  if (!settings.whatsappFollowUpsEnabled) {
    result.skipped.disabled = 1;

    return result;
  }

  if (isWhatsappFollowUpQuietHours(settings)) {
    result.skipped.quietHours = 1;

    return result;
  }

  const rows = await db
    .select({
      id: whatsappConversations.id,
      lastInboundAt: whatsappConversations.lastInboundAt,
      lastIntent: whatsappConversations.lastIntent,
      lastOutboundAt: whatsappConversations.lastOutboundAt,
      phone: whatsappConversations.phone,
      provider: whatsappConversations.provider,
      state: whatsappConversations.state,
      status: whatsappConversations.status,
    })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.status, "open"))
    .orderBy(asc(whatsappConversations.updatedAt))
    .limit(Math.max(limit * 8, 50));

  for (const row of rows) {
    result.scanned += 1;

    if (result.sent >= limit) {
      break;
    }

    const state = normalizeConversationState(row.state);
    const moderation = state.moderation ?? {};
    const activity = getConversationActivity({
      isAutomationPaused: Boolean(moderation.automationPausedAt),
      isMuted: isFutureIsoDate(moderation.mutedUntil),
      lastInboundAt: row.lastInboundAt,
      lastIntent: row.lastIntent,
      lastOutboundAt: row.lastOutboundAt,
      settings,
      status: row.status,
    });

    if (activity.status !== "needs_follow_up") {
      continue;
    }

    if ((state.followUp?.count ?? 0) >= settings.whatsappFollowUpMaxCount) {
      result.skipped.maxCount += 1;
      continue;
    }

    if (!isWithinWhatsappCustomerServiceWindow(row.lastInboundAt)) {
      result.skipped.outsideCustomerServiceWindow += 1;
      continue;
    }

    result.attempted += 1;

    const body = buildFollowUpMessage(row.lastIntent, settings);
    const provider = normalizeProvider(row.provider);
    const sendResult = await send360DialogTextMessage({ body, to: row.phone });

    if (!sendResult.ok) {
      result.failed += 1;
      continue;
    }

    const now = new Date();
    const nextFollowUp = {
      count: (state.followUp?.count ?? 0) + 1,
      lastIntent: row.lastIntent ?? undefined,
      lastSentAt: now.toISOString(),
    };

    await db.insert(whatsappMessages).values({
      body,
      conversationId: row.id,
      direction: "outbound",
      payload: {
        automation: {
          kind: "follow_up",
        },
      },
      provider,
      providerMessageId: `follow-up:${crypto.randomUUID()}`,
    });

    await db
      .update(whatsappConversations)
      .set({
        lastIntent: "automated_follow_up",
        lastOutboundAt: now,
        state: removeUndefined({
          ...state,
          followUp: nextFollowUp,
        }),
        updatedAt: now,
      })
      .where(eq(whatsappConversations.id, row.id));

    result.sent += 1;
  }

  return result;
}

async function getConversationState(conversationId: string) {
  const [conversation] = await db
    .select({ state: whatsappConversations.state })
    .from(whatsappConversations)
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);

  return normalizeConversationState(conversation?.state);
}

function toAdminConversation({
  customerStats,
  followUpSettings,
  messages,
  row,
}: {
  customerStats: AdminWhatsappConversation["customerStats"];
  followUpSettings: WhatsappFollowUpSettings;
  messages: AdminWhatsappMessage[];
  row: {
    customerCreatedAt: Date | null;
    customerEmail: string | null;
    customerName: string | null;
    id: string;
    lastInboundAt: Date | null;
    lastIntent: string | null;
    lastOutboundAt: Date | null;
    phone: string;
    provider: string;
    state: Record<string, unknown>;
    status: string;
    updatedAt: Date;
    userId: string | null;
  };
}): AdminWhatsappConversation {
  const state = normalizeConversationState(row.state);
  const moderation = state.moderation ?? {};
  const isAutomationPaused = Boolean(moderation.automationPausedAt);
  const isMuted = isFutureIsoDate(moderation.mutedUntil);

  return {
    activity: getConversationActivity({
      isAutomationPaused,
      isMuted,
      lastInboundAt: row.lastInboundAt,
      lastIntent: row.lastIntent,
      lastOutboundAt: row.lastOutboundAt,
      settings: followUpSettings,
      status: row.status,
    }),
    customer: {
      accountCreatedAt: row.customerCreatedAt,
      email: row.customerEmail,
      name: row.customerName,
      userId: row.userId,
    },
    customerStats,
    id: row.id,
    isAutomationPaused,
    isMuted,
    lastInboundAt: row.lastInboundAt,
    lastIntent: row.lastIntent,
    lastOutboundAt: row.lastOutboundAt,
    moderation,
    phone: row.phone,
    provider: row.provider,
    recentMessages: messages,
    status: row.status,
    updatedAt: row.updatedAt,
  };
}

function getConversationActivity({
  isAutomationPaused,
  isMuted,
  lastInboundAt,
  lastIntent,
  lastOutboundAt,
  settings,
  status,
}: {
  isAutomationPaused: boolean;
  isMuted: boolean;
  lastInboundAt: Date | null;
  lastIntent: string | null;
  lastOutboundAt: Date | null;
  settings: WhatsappFollowUpSettings;
  status: string;
}) {
  if (isAutomationPaused) {
    return {
      description: "Automation is paused. Admin messages can be sent directly.",
      label: "Manual handover",
      status: "manual_handover" as const,
    };
  }

  if (isMuted) {
    return {
      description: "Automated replies are temporarily muted.",
      label: "Muted",
      status: "muted" as const,
    };
  }

  if (status !== "open") {
    return {
      description: "Conversation is not currently open.",
      label: "Closed",
      status: "idle" as const,
    };
  }

  const latestAt = Math.max(
    lastInboundAt?.getTime() ?? 0,
    lastOutboundAt?.getTime() ?? 0,
  );
  const ageMs = latestAt ? Date.now() - latestAt : Number.POSITIVE_INFINITY;

  if (ageMs < 10 * 60 * 1000) {
    return {
      description: "Recent WhatsApp activity in the last 10 minutes.",
      label: "Live",
      status: "live" as const,
    };
  }

  if (lastInboundAt && (!lastOutboundAt || lastInboundAt > lastOutboundAt)) {
    return {
      description: "Customer has sent a message after the latest reply.",
      label: "Needs reply",
      status: "needs_reply" as const,
    };
  }

  const followUpIntents = new Set([
    "ask_for_size",
    "draft_confirmation",
    "support_answer",
  ]);

  if (
    settings.whatsappFollowUpsEnabled &&
    lastOutboundAt &&
    (!lastInboundAt || lastOutboundAt >= lastInboundAt) &&
    followUpIntents.has(lastIntent ?? "") &&
    Date.now() - lastOutboundAt.getTime() >
      settings.whatsappFollowUpDelayMinutes * 60 * 1000
  ) {
    return {
      description: `Customer has not replied after ${settings.whatsappFollowUpDelayMinutes} minutes.`,
      label: "Needs follow-up",
      status: "needs_follow_up" as const,
    };
  }

  if (lastOutboundAt && (!lastInboundAt || lastOutboundAt >= lastInboundAt)) {
    return {
      description: "Waiting for the customer to answer the latest prompt.",
      label: "Waiting on customer",
      status: "awaiting_customer" as const,
    };
  }

  return {
    description: "No current action is needed.",
    label: "Idle",
    status: "idle" as const,
  };
}

function buildFollowUpMessage(
  lastIntent: string | null,
  settings: WhatsappFollowUpSettings,
) {
  if (lastIntent === "draft_confirmation") {
    return settings.whatsappFollowUpDraftMessage;
  }

  if (lastIntent === "support_answer") {
    return settings.whatsappFollowUpSupportMessage;
  }

  return settings.whatsappFollowUpDefaultMessage;
}

function isWithinWhatsappCustomerServiceWindow(lastInboundAt: Date | null) {
  if (!lastInboundAt) {
    return false;
  }

  return Date.now() - lastInboundAt.getTime() < 24 * 60 * 60 * 1000;
}

function isWhatsappFollowUpQuietHours(settings: WhatsappFollowUpSettings) {
  if (
    !settings.whatsappFollowUpQuietHoursEnabled ||
    !settings.whatsappFollowUpQuietHoursStart ||
    !settings.whatsappFollowUpQuietHoursEnd
  ) {
    return false;
  }

  const currentMinutes = getJohannesburgTimeMinutes();
  const start = timeStringToMinutes(settings.whatsappFollowUpQuietHoursStart);
  const end = timeStringToMinutes(settings.whatsappFollowUpQuietHoursEnd);

  if (start === null || end === null || start === end) {
    return false;
  }

  return start < end
    ? currentMinutes >= start && currentMinutes < end
    : currentMinutes >= start || currentMinutes < end;
}

function getJohannesburgTimeMinutes() {
  const parts = new Intl.DateTimeFormat("en-ZA", {
    hour: "2-digit",
    hourCycle: "h23",
    minute: "2-digit",
    timeZone: "Africa/Johannesburg",
  }).formatToParts(new Date());
  const hour = Number(parts.find((part) => part.type === "hour")?.value ?? 0);
  const minute = Number(
    parts.find((part) => part.type === "minute")?.value ?? 0,
  );

  return hour * 60 + minute;
}

function timeStringToMinutes(value: string) {
  const match = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);

  if (!match) {
    return null;
  }

  return Number(match[1]) * 60 + Number(match[2]);
}

function normalizeProvider(provider: string) {
  return provider === "360dialog" ||
    provider === "generic" ||
    provider === "meta" ||
    provider === "take_app" ||
    provider === "twilio"
    ? provider
    : "360dialog";
}

function toProviderAttachment(
  attachment: AdminWhatsappMessageAttachment,
): WhatsappMediaMessageAttachment {
  return {
    fileName: attachment.fileName,
    mimeType: attachment.mimeType,
    type: attachment.type,
    url: attachment.url,
  };
}

function extractMessageAttachment(
  payload: Record<string, unknown> | null,
): AdminWhatsappMessageAttachment | null {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const attachment = payload.attachment;

  if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) {
    return null;
  }

  const value = attachment as Record<string, unknown>;
  const type = value.type;
  const url = value.url;
  const mimeType = value.mimeType;

  if (
    (type !== "document" && type !== "image" && type !== "video") ||
    typeof url !== "string" ||
    typeof mimeType !== "string"
  ) {
    return null;
  }

  return {
    ...(typeof value.assetId === "string" ? { assetId: value.assetId } : {}),
    fileName: typeof value.fileName === "string" ? value.fileName : null,
    mimeType,
    type,
    url,
  };
}

async function updateConversationState(
  conversationId: string,
  state: WhatsappConversationState,
) {
  await db
    .update(whatsappConversations)
    .set({ state: removeUndefined(state), updatedAt: new Date() })
    .where(eq(whatsappConversations.id, conversationId));
}

function normalizeConversationState(value: unknown): WhatsappConversationState {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const state = value as WhatsappConversationState;
  const moderation =
    state.moderation &&
    typeof state.moderation === "object" &&
    !Array.isArray(state.moderation)
      ? state.moderation
      : undefined;
  const followUp =
    state.followUp &&
    typeof state.followUp === "object" &&
    !Array.isArray(state.followUp)
      ? state.followUp
      : undefined;

  return {
    ...(followUp
      ? {
          followUp: {
            count: normalizeNumber(followUp.count),
            lastIntent: normalizeString(followUp.lastIntent),
            lastSentAt: normalizeString(followUp.lastSentAt),
          },
        }
      : {}),
    ...(moderation
      ? {
          moderation: {
            abuseCount: normalizeNumber(moderation.abuseCount),
            automationPausedAt: normalizeString(moderation.automationPausedAt),
            automationPausedBy:
              moderation.automationPausedBy === "admin" ||
              moderation.automationPausedBy === "system"
                ? moderation.automationPausedBy
                : undefined,
            lastFlagReason: normalizeString(moderation.lastFlagReason),
            lastFlaggedAt: normalizeString(moderation.lastFlaggedAt),
            mutedUntil: normalizeString(moderation.mutedUntil),
            unknownCount: normalizeNumber(moderation.unknownCount),
          },
        }
      : {}),
    ...(state.pendingOrder ? { pendingOrder: state.pendingOrder } : {}),
  };
}

function normalizeNumber(value: unknown) {
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
}

function normalizeString(value: unknown) {
  return typeof value === "string" && value.trim() ? value : undefined;
}

function isFutureIsoDate(value: string | undefined) {
  return value ? new Date(value).getTime() > Date.now() : false;
}

function removeUndefined<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

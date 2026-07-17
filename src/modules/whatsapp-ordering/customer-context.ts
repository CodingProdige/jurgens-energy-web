import "server-only";

import { and, count, desc, eq, inArray } from "drizzle-orm";

import { db } from "@/src/db";
import {
  orders,
  users,
  whatsappConversations,
  whatsappCustomerLinks,
  whatsappMessages,
} from "@/src/db/schema";
import {
  getWhatsappFirstName,
  sanitizeWhatsappDisplayName,
} from "@/src/modules/whatsapp-ordering/customer-name";

export {
  getWhatsappFirstName,
  sanitizeWhatsappDisplayName,
} from "@/src/modules/whatsapp-ordering/customer-name";

export type WhatsappCustomerContextMessage = {
  body: string;
  direction: "assistant" | "customer";
};

export type WhatsappCustomerContext = {
  displayName: string | null;
  firstName: string | null;
  messages: WhatsappCustomerContextMessage[];
  nameSource: "account" | "order" | "provider_profile" | null;
  outboundCount: number;
};

export async function resolveWhatsappCustomerContext({
  conversationId,
  providerProfileName,
}: {
  conversationId: string;
  providerProfileName?: string | null;
}): Promise<WhatsappCustomerContext> {
  const [conversation] = await db
    .select({
      conversationUserId: whatsappConversations.userId,
      linkedUserId: whatsappCustomerLinks.userId,
      phone: whatsappConversations.phone,
      state: whatsappConversations.state,
    })
    .from(whatsappConversations)
    .leftJoin(
      whatsappCustomerLinks,
      and(
        eq(whatsappCustomerLinks.id, whatsappConversations.customerLinkId),
        eq(whatsappCustomerLinks.phone, whatsappConversations.phone),
      ),
    )
    .where(eq(whatsappConversations.id, conversationId))
    .limit(1);

  if (!conversation) {
    const displayName = sanitizeWhatsappDisplayName(providerProfileName);

    return {
      displayName,
      firstName: getWhatsappFirstName(displayName),
      messages: [],
      nameSource: displayName ? "provider_profile" : null,
      outboundCount: 0,
    };
  }

  const linkedUserId = conversation.linkedUserId ?? conversation.conversationUserId;
  const state =
    conversation.state &&
    typeof conversation.state === "object" &&
    !Array.isArray(conversation.state)
      ? conversation.state
      : {};
  const persistedProviderProfileName =
    "providerProfileName" in state &&
    typeof state.providerProfileName === "string"
      ? state.providerProfileName
      : null;
  const effectiveProviderProfileName =
    providerProfileName ?? persistedProviderProfileName;
  const orderCondition = linkedUserId
    ? eq(orders.userId, linkedUserId)
    : eq(orders.customerPhone, conversation.phone);
  const [accountRows, orderRows, recentMessageRows, outboundCountRows] =
    await Promise.all([
      linkedUserId
        ? db
            .select({ name: users.name })
            .from(users)
            .where(eq(users.id, linkedUserId))
            .limit(1)
        : Promise.resolve([]),
      db
        .select({ name: orders.customerName })
        .from(orders)
        .where(orderCondition)
        .orderBy(desc(orders.createdAt), desc(orders.id))
        .limit(1),
      db
        .select({
          body: whatsappMessages.body,
          direction: whatsappMessages.direction,
          payload: whatsappMessages.payload,
        })
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.conversationId, conversationId),
            inArray(whatsappMessages.direction, ["inbound", "outbound"]),
          ),
        )
        .orderBy(desc(whatsappMessages.createdAt), desc(whatsappMessages.id))
        .limit(30),
      db
        .select({ value: count() })
        .from(whatsappMessages)
        .where(
          and(
            eq(whatsappMessages.conversationId, conversationId),
            eq(whatsappMessages.direction, "outbound"),
          ),
        ),
    ]);

  const nameCandidates = [
    {
      name: sanitizeWhatsappDisplayName(accountRows[0]?.name),
      source: "account" as const,
    },
    {
      name: sanitizeWhatsappDisplayName(orderRows[0]?.name),
      source: "order" as const,
    },
    {
      name: sanitizeWhatsappDisplayName(effectiveProviderProfileName),
      source: "provider_profile" as const,
    },
  ];
  const resolvedName = nameCandidates.find((candidate) => candidate.name) ?? null;
  const messages = recentMessageRows
    .filter((message) => !isAttachmentHistoryRow(message.payload))
    .slice(0, 10)
    .reverse()
    .map((message) => ({
      body: message.body,
      direction:
        message.direction === "outbound"
          ? ("assistant" as const)
          : ("customer" as const),
    }));

  return {
    displayName: resolvedName?.name ?? null,
    firstName: getWhatsappFirstName(resolvedName?.name),
    messages,
    nameSource: resolvedName?.source ?? null,
    outboundCount: Number(outboundCountRows[0]?.value ?? 0),
  };
}

function isAttachmentHistoryRow(payload: unknown) {
  return Boolean(
    payload &&
      typeof payload === "object" &&
      !Array.isArray(payload) &&
      "attachment" in payload,
  );
}

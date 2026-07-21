import { db } from "@/src/db";
import { contactInquiries } from "@/src/db/schema";
import { getAdminStaffUserIdsWithCapability } from "@/src/modules/admin/staff";
import {
  createContactInquiryMessagePreview,
  type ContactInquiryFormInput,
} from "@/src/modules/marketplace/contact-inquiry-validation";
import { notify } from "@/src/modules/notifications/templates";

const contactInquiryNotificationEvent = "admin.contact_inquiry.received";

type PersistableContactInquiry = Omit<ContactInquiryFormInput, "company">;

export async function createContactInquiry(input: PersistableContactInquiry) {
  const [inquiry] = await db
    .insert(contactInquiries)
    .values({
      email: input.email,
      message: input.message,
      name: input.name,
    })
    .returning({
      createdAt: contactInquiries.createdAt,
      email: contactInquiries.email,
      id: contactInquiries.id,
      message: contactInquiries.message,
      name: contactInquiries.name,
    });

  return inquiry;
}

export async function notifyAdminsOfContactInquiry(
  inquiry: Awaited<ReturnType<typeof createContactInquiry>>,
) {
  const recipientUserIds = await getAdminStaffUserIdsWithCapability(
    "admin.contact_inquiries.view",
  );
  const notificationData = {
    contactEmail: inquiry.email,
    contactMessage: inquiry.message,
    contactName: inquiry.name,
    inquiryId: inquiry.id,
    messagePreview: createContactInquiryMessagePreview(inquiry.message),
    receivedAtLabel: new Intl.DateTimeFormat("en-ZA", {
      dateStyle: "medium",
      timeStyle: "short",
      timeZone: "Africa/Johannesburg",
    }).format(inquiry.createdAt),
  };

  const results = await Promise.allSettled(
    recipientUserIds.map((recipientUserId) =>
      notify({
        data: notificationData,
        event: contactInquiryNotificationEvent,
        recipientUserId,
      }),
    ),
  );

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(
        `Failed to notify admin ${recipientUserIds[index] ?? "unknown"} about contact inquiry ${inquiry.id}.`,
        result.reason,
      );
    }
  });
}

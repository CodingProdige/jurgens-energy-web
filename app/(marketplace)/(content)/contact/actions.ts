"use server";

import {
  contactInquiryFormSchema,
  isContactInquiryHoneypotFilled,
} from "@/src/modules/marketplace/contact-inquiry-validation";
import {
  createContactInquiry,
  notifyAdminsOfContactInquiry,
} from "@/src/modules/marketplace/contact-inquiries";
import { checkRateLimit, getClientIp } from "@/src/modules/security/rate-limit";

type ContactInquiryField = "email" | "message" | "name";

export type ContactInquiryActionState = {
  fieldErrors?: Partial<Record<ContactInquiryField, string[]>>;
  message?: string;
  status?: "error" | "success";
  submissionId?: string;
};

const inquiryReceivedMessage =
  "Thanks — your message has been received. Our support team will reply by email.";

function getFormString(formData: FormData, key: string) {
  const value = formData.get(key);

  return typeof value === "string" ? value : "";
}

export async function submitContactInquiry(
  _state: ContactInquiryActionState,
  formData: FormData,
): Promise<ContactInquiryActionState> {
  const clientIp = await getClientIp();

  try {
    const rateLimit = await checkRateLimit({
      key: `rate:contact-inquiry:${clientIp}`,
      limit: 5,
      windowSeconds: 15 * 60,
    });

    if (!rateLimit.allowed) {
      return {
        message: `Too many messages have been sent. Try again in ${Math.max(
          1,
          Math.ceil(rateLimit.retryAfterSeconds / 60),
        )} minutes.`,
        status: "error",
      };
    }
  } catch (error) {
    console.error("Contact inquiry rate limiting failed.", error);

    return {
      message: "We could not send your message right now. Please try again shortly.",
      status: "error",
    };
  }

  const company = getFormString(formData, "company");

  if (isContactInquiryHoneypotFilled(company)) {
    return { message: inquiryReceivedMessage, status: "success" };
  }

  const parsed = contactInquiryFormSchema.safeParse({
    company,
    email: getFormString(formData, "email"),
    message: getFormString(formData, "message"),
    name: getFormString(formData, "name"),
  });

  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;

    return {
      fieldErrors: {
        email: fieldErrors.email,
        message: fieldErrors.message,
        name: fieldErrors.name,
      },
      message: "Check the highlighted fields and try again.",
      status: "error",
    };
  }

  let inquiry: Awaited<ReturnType<typeof createContactInquiry>>;

  try {
    inquiry = await createContactInquiry({
      email: parsed.data.email,
      message: parsed.data.message,
      name: parsed.data.name,
    });
  } catch (error) {
    console.error("Failed to persist contact inquiry.", error);

    return {
      message: "We could not send your message right now. Please try again shortly.",
      status: "error",
    };
  }

  try {
    await notifyAdminsOfContactInquiry(inquiry);
  } catch (error) {
    console.error(
      `Contact inquiry ${inquiry.id} was saved, but admin notification preparation failed.`,
      error,
    );
  }

  return {
    message: inquiryReceivedMessage,
    status: "success",
    submissionId: inquiry.id,
  };
}

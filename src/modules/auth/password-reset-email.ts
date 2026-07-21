import { sendNotificationEmail } from "@/src/modules/notifications/templates";

export const PASSWORD_RESET_TEMPLATE_KEY = "auth.password_reset.requested";

type PasswordResetEmailInput = {
  to: string;
  resetUrl: string;
  surface: "admin" | "seller" | "marketplace";
  expiresAt: Date;
};

export async function sendPasswordResetEmail({
  to,
  resetUrl,
  surface,
  expiresAt,
}: PasswordResetEmailInput) {
  const surfaceLabel =
    surface === "admin"
      ? "admin"
      : surface === "seller"
        ? "seller"
        : "online store";
  const expiresAtLabel = expiresAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });
  return sendNotificationEmail({
    data: {
      expiresAtLabel,
      resetUrl,
      surfaceLabel,
    },
    recipientEmail: to,
    templateKey: PASSWORD_RESET_TEMPLATE_KEY,
  });
}

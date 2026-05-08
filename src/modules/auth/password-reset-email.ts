import { sendEmail } from "@/src/modules/email/sendgrid";

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
        : "marketplace";
  const expiresAtLabel = expiresAt.toLocaleString("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  });

  return sendEmail({
    personalizations: [
      {
        to: [{ email: to }],
        subject: `Reset your Piessang ${surfaceLabel} password`,
      },
    ],
    content: [
      {
        type: "text/plain",
        value: [
          `Reset your Piessang ${surfaceLabel} password`,
          "",
          "Use the link below to set a new password:",
          resetUrl,
          "",
          `This link expires at ${expiresAtLabel}.`,
          "If you did not request this reset, you can ignore this email.",
        ].join("\n"),
      },
      {
        type: "text/html",
        value: `
          <div style="font-family:Arial,sans-serif;line-height:1.6;color:#070b16">
            <h1 style="font-size:22px;margin:0 0 12px">Reset your Piessang ${surfaceLabel} password</h1>
            <p>Use the button below to set a new password.</p>
            <p>
              <a href="${resetUrl}" style="display:inline-block;background:#070b16;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:6px;font-weight:700">
                Reset password
              </a>
            </p>
            <p style="color:#596176;font-size:14px">This link expires at ${expiresAtLabel}.</p>
            <p style="color:#596176;font-size:14px">If you did not request this reset, you can ignore this email.</p>
          </div>
        `,
      },
    ],
  });
}

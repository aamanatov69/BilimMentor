import nodemailer from "nodemailer";

type ResetEmailPayload = {
  to: string;
  fullName: string;
  resetLink: string;
};

function getBaseUrl() {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.FRONTEND_URL ??
    "http://localhost:3000"
  );
}

export function buildResetPasswordLink(token: string) {
  const baseUrl = getBaseUrl().replace(/\/$/, "");
  return `${baseUrl}/reset-password?token=${encodeURIComponent(token)}`;
}

export async function sendResetPasswordEmail(payload: ResetEmailPayload) {
  const host = process.env.SMTP_HOST;
  const port = Number(process.env.SMTP_PORT ?? 587);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const from = process.env.SMTP_FROM ?? "noreply@nexora-lms.local";
  const allowFallback =
    process.env.MAILER_ALLOW_FALLBACK === "true" ||
    process.env.NODE_ENV !== "production";

  const logFallback = (reason: string) => {
    console.warn(`[MAILER_FALLBACK] ${reason}`);
    if (process.env.NODE_ENV !== "production") {
      console.log(
        `[MAILER_FALLBACK] Reset link for ${payload.to}: ${payload.resetLink}`,
      );
    }
  };

  if (!host || !user || !pass) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("SMTP config is required in production");
    }

    // Dev fallback to keep reset flow testable without SMTP setup.
    logFallback("SMTP config is missing");
    return;
  }

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  });

  try {
    await transporter.sendMail({
      from,
      to: payload.to,
      subject: "Сброс пароля BilimMentor",
      text: [
        `Здравствуйте, ${payload.fullName}.`,
        "",
        "Вы запросили сброс пароля в BilimMentor.",
        `Перейдите по ссылке, чтобы установить новый пароль: ${payload.resetLink}`,
        "",
        "Если это были не вы, проигнорируйте это письмо.",
      ].join("\n"),
    });
  } catch (error) {
    const authFailed =
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      String((error as { code?: unknown }).code) === "EAUTH";

    if (allowFallback) {
      logFallback(
        authFailed
          ? "SMTP auth failed (EAUTH). Check Gmail App Password settings"
          : "SMTP send failed",
      );
      return;
    }

    throw error;
  }
}

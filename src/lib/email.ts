const WEBHOOK_URL = process.env.POWER_AUTOMATE_EMAIL_URL;

export interface EmailAttachment {
  Name: string;
  ContentBytes: string;
}

export async function sendEmail(
  to: string,
  subject: string,
  body: string,
  attachments?: EmailAttachment[]
): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.warn("POWER_AUTOMATE_EMAIL_URL not set — email not sent");
    return false;
  }
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15_000);
  try {
    const payload: Record<string, unknown> = { to, subject, body };
    if (attachments?.length) payload.attachments = attachments;
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    return res.status === 202;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function isEmailConfigured(): boolean {
  return !!WEBHOOK_URL;
}

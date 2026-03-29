const WEBHOOK_URL = process.env.POWER_AUTOMATE_EMAIL_URL;

export async function sendEmail(
  to: string,
  subject: string,
  body: string
): Promise<boolean> {
  if (!WEBHOOK_URL) {
    console.warn("POWER_AUTOMATE_EMAIL_URL not set — email not sent");
    return false;
  }
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ to, subject, body }),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.status === 202;
  } catch (err) {
    console.error("Failed to send email:", err);
    return false;
  }
}

export function isEmailConfigured(): boolean {
  return !!WEBHOOK_URL;
}

import { escapeHtml } from "@/lib/html";
import { ESCALATING_SUBJECTS, ESCALATING_TONES } from "./types";

type EmailParams = {
  recipientName: string;
  invoiceNumber: string | null;
  quoteNumber?: string | null;
  type: "INVOICE" | "QUOTE";
  description: string;
  totalAmount: number;
  creatorName: string;
  formUrl: string;
  attempt: number;
  maxAttempts: number;
};

const TONE_MESSAGES: Record<string, string> = {
  friendly:
    "We need your account number to process this charge. Please provide it at your earliest convenience.",
  gentle:
    "This is a friendly reminder that we still need your account number to proceed with processing.",
  firm:
    "We have not yet received the account number required to process this charge. Please provide it as soon as possible.",
  urgent:
    "This charge cannot be processed without your account number. Immediate action is required.",
  final:
    "This is our final request for the account number needed to process this charge. If we do not receive it, the charge will remain unprocessed.",
};

export function buildAccountFollowUpEmail(params: EmailParams): {
  subject: string;
  html: string;
} {
  const docNumber =
    params.type === "QUOTE"
      ? (params.quoteNumber ?? "your quote")
      : (params.invoiceNumber ?? "your invoice");

  const subjectFn = ESCALATING_SUBJECTS[params.attempt] ?? ESCALATING_SUBJECTS[5];
  const subject = subjectFn(docNumber);

  const tone = ESCALATING_TONES[params.attempt] ?? "final";
  const toneMessage = TONE_MESSAGES[tone] ?? TONE_MESSAGES.friendly;

  const amount = `$${params.totalAmount.toFixed(2)}`;

  const html = `<div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
  <h2 style="color: #1a1a1a;">Account Number Needed</h2>
  <p>Hello ${escapeHtml(params.recipientName)},</p>
  <p>${escapeHtml(toneMessage)}</p>
  <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
    <tr>
      <td style="padding: 8px 0; color: #666;">${params.type === "QUOTE" ? "Quote" : "Invoice"}</td>
      <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(docNumber)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Description</td>
      <td style="padding: 8px 0;">${escapeHtml(params.description)}</td>
    </tr>
    <tr>
      <td style="padding: 8px 0; color: #666;">Amount</td>
      <td style="padding: 8px 0; font-weight: bold;">${escapeHtml(amount)}</td>
    </tr>
  </table>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(params.formUrl)}" style="background-color: #f59e0b; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: bold;">Provide Account Number</a>
  </p>
  <p style="color: #666; font-size: 14px;">Or copy this link: ${escapeHtml(params.formUrl)}</p>
  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 24px 0;" />
  <p style="color: #999; font-size: 12px;">This is reminder ${params.attempt} of ${params.maxAttempts}. If you have questions, contact ${escapeHtml(params.creatorName)}.</p>
  <p style="color: #999; font-size: 12px;">Los Angeles Pierce College Bookstore</p>
</div>`;

  return { subject, html };
}

import { Resend } from 'resend';

const apiKey = process.env.RESEND_API_KEY;
const from = process.env.EMAIL_FROM ?? 'TripMate <onboarding@resend.dev>';
const resend = apiKey ? new Resend(apiKey) : null;

// Sends an email alert. Never throws: a failed email must not break the
// action that triggered it (same contract as notify() for in-app alerts).
// With no RESEND_API_KEY set, it just logs instead of sending — lets the
// rest of the feature run and be tested before a real key is wired up.
export async function sendEmail(to: string | null, subject: string, html: string): Promise<void> {
  if (!to) return;
  if (!resend) {
    console.log(`[email] (no RESEND_API_KEY, not sent) to=${to} subject="${subject}"`);
    return;
  }
  try {
    await resend.emails.send({ from, to, subject, html });
  } catch (error) {
    console.error('[sendEmail]', error);
  }
}

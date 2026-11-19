import 'server-only';

/**
 * Transactional email, through Brevo's REST API.
 *
 * No SDK on purpose: one POST does not justify a dependency, and this
 * codebase keeps `ignore-scripts` on and verifies every package it
 * adds. One fetch is easier to audit than a package tree.
 *
 * Returns a result rather than throwing. The only caller is a scheduled
 * report, and a failed send must not take the whole job down or make a
 * cron look broken.
 */

export interface SendResult {
  sent: boolean;
  /** Why not, when `sent` is false. Safe to show in a job's output. */
  reason?: string;
}

export interface Mail {
  to: string[];
  subject: string;
  html: string;
  /** Falls back to MAIL_FROM, then to a no-reply on the app's domain. */
  fromEmail?: string;
  fromName?: string;
}

export async function sendEmail(mail: Mail): Promise<SendResult> {
  const key = process.env.BREVO_API_KEY;
  if (!key) return { sent: false, reason: 'BREVO_API_KEY is not set' };

  const to = mail.to.map((e) => e.trim()).filter(Boolean);
  if (to.length === 0) return { sent: false, reason: 'No recipients' };

  try {
    const res = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'api-key': key,
        'content-type': 'application/json',
        accept: 'application/json',
      },
      body: JSON.stringify({
        sender: {
          email: mail.fromEmail ?? process.env.MAIL_FROM ?? 'no-reply@anamaya.com',
          name: mail.fromName ?? process.env.MAIL_FROM_NAME ?? 'AnamayaOS',
        },
        to: to.map((email) => ({ email })),
        subject: mail.subject,
        htmlContent: mail.html,
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { sent: false, reason: `Brevo returned ${res.status} ${detail.slice(0, 200)}` };
    }
    return { sent: true };
  } catch (e) {
    return { sent: false, reason: (e as Error).message };
  }
}

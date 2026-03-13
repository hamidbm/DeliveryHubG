import { Notification } from '../../types/ai';

export type EmailDispatchInput = {
  to: string;
  userName?: string;
  appUrl?: string;
  notification: Notification;
};

export type EmailDispatchResult =
  | { ok: true }
  | { ok: false; error: string };

const buildSubject = (notification: Notification) => `DeliveryHub Notification: ${notification.title}`;

const buildBody = (input: EmailDispatchInput) => {
  const { notification, userName, appUrl } = input;
  const lines = [
    `Hello ${userName || 'there'},`,
    '',
    'You have a new DeliveryHub alert/notification:',
    '',
    `Title: ${notification.title}`,
    `Summary: ${notification.message}`,
    notification.severity ? `Severity: ${notification.severity}` : '',
    '',
    appUrl ? `See details: ${appUrl.replace(/\/$/, '')}/dashboards?tab=ai-insights` : '',
    '',
    'Regards,',
    'DeliveryHub Intelligence'
  ].filter(Boolean);

  return lines.join('\n');
};

export const sendNotificationEmail = async (input: EmailDispatchInput): Promise<EmailDispatchResult> => {
  const webhookUrl = String(process.env.NOTIFICATION_EMAIL_WEBHOOK_URL || '').trim();
  const mode = String(process.env.NOTIFICATION_EMAIL_MODE || 'webhook').toLowerCase();

  if (!input.to) {
    return { ok: false, error: 'Missing recipient email.' };
  }

  if (mode === 'disabled') {
    return { ok: false, error: 'Email delivery is disabled by configuration.' };
  }

  const payload = {
    to: input.to,
    subject: buildSubject(input.notification),
    body: buildBody(input),
    notificationId: input.notification.id,
    watcherId: input.notification.watcherId
  };

  if (mode === 'log') {
    console.info('notification_email_log', payload);
    return { ok: true };
  }

  if (!webhookUrl) {
    return { ok: false, error: 'Missing NOTIFICATION_EMAIL_WEBHOOK_URL.' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text();
      return { ok: false, error: `Webhook responded ${res.status}: ${text.slice(0, 240)}` };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: (error as Error).message || 'Unknown email dispatch error.' };
  }
};

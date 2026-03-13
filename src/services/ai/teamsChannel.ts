import { Notification } from '../../types/ai';

const buildTeamsPayload = (notification: Notification, appUrl?: string) => {
  const baseLink = appUrl ? `${appUrl.replace(/\/$/, '')}/dashboards?tab=ai-insights` : '';
  return {
    type: 'message',
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: {
          type: 'AdaptiveCard',
          version: '1.4',
          body: [
            { type: 'TextBlock', size: 'Medium', weight: 'Bolder', text: 'DeliveryHub Notification' },
            { type: 'TextBlock', text: `Title: ${notification.title}`, wrap: true },
            ...(notification.severity ? [{ type: 'TextBlock', text: `Severity: ${notification.severity}`, wrap: true }] : []),
            { type: 'TextBlock', text: `Summary: ${notification.message}`, wrap: true }
          ],
          actions: baseLink
            ? [{ type: 'Action.OpenUrl', title: 'Open DeliveryHub', url: baseLink }]
            : []
        }
      }
    ]
  };
};

export const sendTeamsNotification = async (
  webhookUrl: string,
  notification: Notification,
  appUrl?: string
): Promise<boolean> => {
  const mode = String(process.env.NOTIFICATION_TEAMS_MODE || 'webhook').toLowerCase();
  if (mode === 'disabled') {
    throw new Error('Teams delivery disabled by configuration.');
  }
  if (!webhookUrl) {
    throw new Error('Teams webhook URL is missing.');
  }

  const payload = buildTeamsPayload(notification, appUrl);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Teams webhook responded ${res.status}: ${text.slice(0, 240)}`);
  }

  return true;
};

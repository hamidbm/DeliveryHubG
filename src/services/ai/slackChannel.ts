import { Notification } from '../../types/ai';

const buildSlackPayload = (notification: Notification, appUrl?: string) => {
  const baseLink = appUrl ? `${appUrl.replace(/\/$/, '')}/dashboards?tab=ai-insights` : '';
  const severity = notification.severity ? `*Severity:* ${notification.severity}` : '';
  const lines = [
    '*DeliveryHub Alert*',
    `*Title:* ${notification.title}`,
    severity,
    '',
    '*Summary:*',
    notification.message,
    baseLink ? `\n*View in DeliveryHub:* ${baseLink}` : ''
  ].filter(Boolean);

  return {
    text: `DeliveryHub Notification: ${notification.title}`,
    blocks: [
      {
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: lines.join('\n')
        }
      }
    ]
  };
};

export const sendSlackNotification = async (
  webhookUrl: string,
  notification: Notification,
  appUrl?: string
): Promise<boolean> => {
  const mode = String(process.env.NOTIFICATION_SLACK_MODE || 'webhook').toLowerCase();
  if (mode === 'disabled') {
    throw new Error('Slack delivery disabled by configuration.');
  }
  if (!webhookUrl) {
    throw new Error('Slack webhook URL is missing.');
  }

  const payload = buildSlackPayload(notification, appUrl);
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Slack webhook responded ${res.status}: ${text.slice(0, 240)}`);
  }

  return true;
};

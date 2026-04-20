export interface WebhookPayload {
  title: string;
  text: string;
  severity?: 'info' | 'warning' | 'error';
  source?: string;
  score?: number;
  trend?: string;
  issues?: Array<{ title: string; level: string; id: string }>;
}

export async function sendWebhookNotification(webhookUrl: string, payload: WebhookPayload): Promise<void> {
  const url = new URL(webhookUrl);
  const isSlack = url.hostname.includes('slack.com');

  const body = isSlack
    ? {
        text: payload.text,
      }
    : {
        title: payload.title,
        text: payload.text,
        severity: payload.severity ?? 'info',
        source: payload.source,
        score: payload.score,
        trend: payload.trend,
        issues: payload.issues ?? [],
      };

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Webhook request failed with ${response.status} ${response.statusText}`);
  }
}

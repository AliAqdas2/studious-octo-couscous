/**
 * Client helper: download BEO as Word (.docx) via API (US Letter, not A4).
 */

import { getAccessToken } from '@/api/apiClient';

function safeFileName(eventName) {
  return (eventName || 'BEO').replace(/[^\w\-]+/g, '_').slice(0, 60);
}

/**
 * @param {{
 *   eventId: string,
 *   html: string,
 *   eventName?: string,
 * }} opts
 */
export async function downloadBeoDocx({ eventId, html, eventName }) {
  if (!eventId) throw new Error('eventId is required');
  if (!html?.trim()) throw new Error('BEO document is empty');

  const token = getAccessToken();
  const origin =
    typeof window !== 'undefined' ? window.location.origin : undefined;
  const res = await fetch(
    `/api/events/${encodeURIComponent(eventId)}/beo-docx`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        html,
        eventName: eventName || 'Banquet Event Order',
        origin,
      }),
    }
  );

  if (!res.ok) {
    let message = `Word download failed (${res.status})`;
    try {
      const err = await res.json();
      if (err?.error || err?.message) message = err.error || err.message;
    } catch {
      /* ignore */
    }
    throw new Error(message);
  }

  const blob = await res.blob();
  const name = `BEO_${safeFileName(eventName)}.docx`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  return name;
}

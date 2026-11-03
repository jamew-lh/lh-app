// Minimal TextMagic client (same account as the timecard app).
// Needs TEXTMAGIC_USERNAME and TEXTMAGIC_API_KEY in Netlify.
export const textMagicConfigured = (env) => !!(env.TEXTMAGIC_USERNAME && env.TEXTMAGIC_API_KEY);

/** "(610) 858-4549" -> "16108584549" (US numbers). */
export function toE164(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  if (d.length === 10) return `1${d}`;
  if (d.length === 11 && d.startsWith('1')) return d;
  return '';
}

export async function sendText(phone, text, env, fetchImpl = fetch) {
  const res = await fetchImpl('https://rest.textmagic.com/api/v2/messages', {
    method: 'POST',
    headers: {
      'X-TM-Username': env.TEXTMAGIC_USERNAME,
      'X-TM-Key': env.TEXTMAGIC_API_KEY,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({ text, phones: phone }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`TextMagic ${res.status}: ${t.slice(0, 160)}`);
  }
  return true;
}

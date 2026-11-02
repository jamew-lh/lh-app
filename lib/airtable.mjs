// Minimal read-only Airtable client.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const API = 'https://api.airtable.com/v0';

export async function listAll(base, table, fields, env = process.env, fetchImpl = fetch) {
  const token = env.AIRTABLE_TOKEN;
  if (!token) throw new HttpError(500, 'Server is missing AIRTABLE_TOKEN.');
  const out = [];
  let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true' });
    for (const f of fields) q.append('fields[]', f);
    if (offset) q.set('offset', offset);
    const res = await fetchImpl(`${API}/${base}/${table}?${q}`, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('Airtable error', res.status, text.slice(0, 300));
      throw new HttpError(502, res.status === 401 || res.status === 403
        ? 'The app cannot read Airtable. Check the AIRTABLE_TOKEN and its bases.'
        : 'Airtable is not answering right now. Try again in a minute.');
    }
    const data = await res.json();
    out.push(...(data.records || []));
    offset = data.offset;
  } while (offset);
  return out;
}

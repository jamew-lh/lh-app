// Minimal read-only Airtable client.
export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

const API = 'https://api.airtable.com/v0';
// For error messages only.
const BASE_NAMES = { apps6XaJewmWwJYLH: 'Safety', appehzc9Hjt88dJ2o: 'Daily Schedules' };

export async function listAll(base, table, fields, env = process.env, fetchImpl = fetch, { filterByFormula = '' } = {}) {
  const token = env.AIRTABLE_TOKEN;
  if (!token) throw new HttpError(500, 'Server is missing AIRTABLE_TOKEN.');
  const out = [];
  let offset;
  do {
    const q = new URLSearchParams({ pageSize: '100', returnFieldsByFieldId: 'true' });
    for (const f of fields) q.append('fields[]', f);
    if (filterByFormula) q.set('filterByFormula', filterByFormula);
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

// ---- writes (Safety base, Daily Schedules base) ----
async function send(method, url, body, env, fetchImpl) {
  const token = env.AIRTABLE_TOKEN;
  if (!token) throw new HttpError(500, 'Server is missing AIRTABLE_TOKEN.');
  const res = await fetchImpl(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text().catch(() => '');
  if (!res.ok) {
    console.error('Airtable error', method, res.status, text.slice(0, 300));
    if (res.status === 401 || res.status === 403) throw new HttpError(502, `The app cannot save to Airtable. The AIRTABLE_TOKEN needs write access to the ${BASE_NAMES[url.split('/')[4]] || 'Safety'} base.`);
    if (res.status === 404) throw new HttpError(404, 'That report was not found.');
    if (res.status === 413) throw new HttpError(413, 'That photo is too big to upload.');
    throw new HttpError(502, 'Airtable is not answering right now. Try again in a minute.');
  }
  try { return text ? JSON.parse(text) : {}; } catch { return {}; }
}

export const createRecord = (base, table, fields, env = process.env, fetchImpl = fetch) =>
  send('POST', `${API}/${base}/${table}?returnFieldsByFieldId=true`, { fields, typecast: true, returnFieldsByFieldId: true }, env, fetchImpl);

export const updateRecord = (base, table, id, fields, env = process.env, fetchImpl = fetch) =>
  send('PATCH', `${API}/${base}/${table}/${id}`, { fields, typecast: true, returnFieldsByFieldId: true }, env, fetchImpl);

export const getRecord = (base, table, id, env = process.env, fetchImpl = fetch) =>
  send('GET', `${API}/${base}/${table}/${id}?returnFieldsByFieldId=true`, null, env, fetchImpl);

/** Adds one file (base64) to an attachment field. Airtable limit: 5 MB per file. */
export const uploadAttachment = (base, recordId, fieldId, { contentType, data, filename }, env = process.env, fetchImpl = fetch) =>
  send('POST', `https://content.airtable.com/v0/${base}/${recordId}/${fieldId}/uploadAttachment`, { contentType, file: data, filename }, env, fetchImpl);

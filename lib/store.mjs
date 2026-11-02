// Reads employees and jobs from Airtable, with a short in-memory cache.
import { EMPLOYEES as E, JOBS as J, CACHE_MINUTES } from './config.mjs';
import { listAll } from './airtable.mjs';
import { shapeJobs } from './jobs.mjs';

const cache = new Map();
export function clearCache() { cache.clear(); }

async function cached(key, load, now = Date.now()) {
  const hit = cache.get(key);
  if (hit && now - hit.at < CACHE_MINUTES * 60000) return hit.value;
  const value = await load();
  cache.set(key, { at: now, value });
  return value;
}

const str = (v) => (v == null ? '' : typeof v === 'object' ? String(v.name ?? '') : String(v)).trim();
export const norm = (s) => String(s ?? '').toLowerCase().replace(/[^a-z]/g, '');

// "Last, First" -> { last, first, display: "First Last" }
export function splitName(full) {
  const s = str(full);
  if (s.includes(',')) {
    const [last, ...rest] = s.split(',');
    const first = rest.join(',').trim();
    return { last: last.trim(), first, display: `${first} ${last.trim()}`.trim() };
  }
  const parts = s.split(/\s+/);
  return { last: parts.slice(-1)[0] || '', first: parts.slice(0, -1).join(' '), display: s };
}

/** Current Site Contractors employees (the people who can sign in). */
export async function employees(env, fetchImpl) {
  return cached('employees', async () => {
    const recs = await listAll(E.base, E.table, Object.values(E.f), env, fetchImpl);
    return recs
      .map((r) => {
        const f = r.fields || {};
        const name = splitName(f[E.f.name]);
        return {
          id: r.id,
          sortName: str(f[E.f.name]),
          name: name.display,
          last: name.last,
          first: name.first,
          status: str(f[E.f.status]),
          location: str(f[E.f.location]),
          position: str(f[E.f.position]),
          pin: str(f[E.f.pin]),
          cell: str(f[E.f.cell]),
        };
      })
      .filter((p) => p.sortName && E.allowStatus.includes(p.status)
        && (E.allowLocation.includes(p.location) || (E.extraPeople || []).includes(p.id)));
  });
}

export async function jobs(env, fetchImpl) {
  return cached('jobs', async () => {
    const recs = await listAll(J.base, J.table, Object.values(J.f), env, fetchImpl);
    return shapeJobs(recs, J.f);
  });
}

const hasPosition = (list) => (p) => (list || []).some((x) => x.toLowerCase() === String(p.position || '').toLowerCase());
export const canSeeEquipment = hasPosition(E.equipmentPositions);
export const canSeePm = hasPosition(E.pmPositions);

export function publicPerson(p) {
  return { id: p.id, name: p.name, first: p.first || p.name, position: p.position, equipment: canSeeEquipment(p), pm: canSeePm(p) };
}

export async function phoneList(env, fetchImpl) {
  const all = await employees(env, fetchImpl);
  return all
    .filter((p) => p.cell)
    .sort((a, b) => a.sortName.localeCompare(b.sortName))
    .map((p) => ({ name: p.sortName, position: p.position, cell: p.cell }));
}

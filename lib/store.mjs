// Reads employees and jobs from Airtable, with a short in-memory cache.
import { EMPLOYEES as E, JOBS as J, CACHE_MINUTES } from './config.mjs';
import { listAll } from './airtable.mjs';
import { shapeJobs } from './jobs.mjs';

const cache = new Map();
export function clearCache() { cache.clear(); }

// The app's Refresh button: re-read Airtable now, at most once every 15 seconds
// (per server instance) so repeated taps can't flood Airtable.
let lastForced = 0;
export function forceFresh(now = Date.now()) {
  if (now - lastForced < 15000) return false;
  lastForced = now;
  cache.clear();
  return true;
}
export function resetForceFresh() { lastForced = 0; }

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

/** Everyone in the Employee List (any status / location). */
async function everyone(env, fetchImpl) {
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
          details: {
            hireDate: str(f[E.f.hireDate]),
            driving: str(f[E.f.driving]),
            medical: str(f[E.f.medical]),
            medExp: str(f[E.f.medExp]),
            endorsements: (f[E.f.endorsements] || []).map(str).filter(Boolean),
            address: str(f[E.f.address]),
            cityStateZip: str(f[E.f.cityStateZip]),
          },
        };
      })
      .filter((p) => p.sortName);
  });
}

/** Current Site Contractors employees (the people who can sign in). */
export async function employees(env, fetchImpl) {
  return (await everyone(env, fetchImpl)).filter((p) => E.allowStatus.includes(p.status)
    && (E.allowLocation.includes(p.location) || (E.extraPeople || []).includes(p.id)));
}

/** Every current employee, Site Contractors and Paving (for picking the injured employee). */
export async function currentEmployees(env, fetchImpl) {
  return (await everyone(env, fetchImpl)).filter((p) => E.allowStatus.includes(p.status));
}

export async function employeeById(id, env, fetchImpl) {
  return (await everyone(env, fetchImpl)).find((p) => p.id === id) || null;
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
export const canSeeCalendar = hasPosition(E.calendarPositions);
export const canSeeDetails = hasPosition(E.detailPositions);
export const isSupervisor = hasPosition(E.supervisorPositions);

// The vacation calendar link is private, so it only goes to the people allowed to see it.
export function publicPerson(p, env = process.env) {
  const cal = String(env.VACATION_CALENDAR_URL || '').trim();
  return {
    id: p.id, name: p.name, first: p.first || p.name, position: p.position,
    equipment: canSeeEquipment(p), pm: canSeePm(p), details: canSeeDetails(p), supervisor: isSupervisor(p),
    calendarUrl: canSeeCalendar(p) && /^https:\/\//.test(cal) ? cal : '',
  };
}

// Everyone gets name, position and cell. Management and supervisors also get
// start date, driving list, medical card and home address.
export async function phoneList(env, fetchImpl, viewer = null) {
  const all = await employees(env, fetchImpl);
  const more = !!viewer && canSeeDetails(viewer);
  return all
    .filter((p) => !(E.phoneListHide || []).includes(p.id))
    .filter((p) => p.cell || more)
    .sort((a, b) => a.sortName.localeCompare(b.sortName))
    .map((p) => (more
      ? { name: p.sortName, position: p.position, cell: p.cell, details: p.details }
      : { name: p.sortName, position: p.position, cell: p.cell }));
}

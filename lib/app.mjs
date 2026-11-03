// Request handler (used by the Netlify function and by the tests).
import { HttpError } from './airtable.mjs';
import { makeCookie, clearCookie, requirePerson, findForLogin, checkThrottle, recordFailure } from './auth.mjs';
import { jobs, phoneList, publicPerson as basePerson, forceFresh, currentEmployees } from './store.mjs';
import {
  canFile, canUseIncidents, canViewAll, isOffice, listIncidents, getIncident, createIncident, addFile,
  submitIncident, signReview, saveOffice,
} from './incidents.mjs';
import { incidentPdf } from './incident-pdf.mjs';

const publicPerson = (p, env) => ({
  ...basePerson(p, env),
  incidents: { file: canFile(p), view: canUseIncidents(p), all: canViewAll(p), office: isOffice(p) },
});

async function readJson(req) {
  try { return await req.json(); } catch { return {}; }
}

// /api/incidents/... routes. Returns a Response, or null if the path isn't one of them.
async function incidentRoutes(req, url, route, env, fetchImpl) {
  if (!route.includes(' incidents')) return null;
  const viewer = await requirePerson(req, env, fetchImpl);
  if (route === 'GET incidents') return json(200, { reports: await listIncidents(viewer, env, fetchImpl) });
  if (route === 'GET incidents/people') {
    if (!canFile(viewer)) throw new HttpError(403, 'Not allowed.');
    const people = (await currentEmployees(env, fetchImpl))
      .map((p) => ({ name: p.sortName, position: p.position }))
      .sort((a, b) => a.name.localeCompare(b.name));
    return json(200, { people });
  }
  if (route === 'POST incidents') return json(200, await createIncident(await readJson(req), viewer, env, fetchImpl));
  const m = route.match(/^(GET|POST) incidents\/(rec[A-Za-z0-9]{14})(?:\/(file|submit|review|office|pdf))?$/);
  if (!m) throw new HttpError(404, 'Not found.');
  const [, method, id, action] = m;
  if (method === 'GET' && !action) return json(200, { report: await getIncident(id, viewer, env, fetchImpl) });
  if (method === 'GET' && action === 'pdf') {
    const r = await getIncident(id, viewer, env, fetchImpl);
    const bytes = await incidentPdf(r, fetchImpl);
    const name = `Incident Report ${r.number || ''} ${r.injured}`.replace(/[^\w .-]/g, '').trim();
    return new Response(bytes, { status: 200, headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': `inline; filename="${name}.pdf"`, 'Cache-Control': 'no-store' } });
  }
  if (method === 'POST' && action === 'file') return json(200, await addFile(id, await readJson(req), viewer, env, fetchImpl));
  if (method === 'POST' && action === 'submit') return json(200, await submitIncident(id, viewer, url.origin, env, fetchImpl));
  if (method === 'POST' && action === 'review') return json(200, { report: await signReview(id, await readJson(req), viewer, env, fetchImpl) });
  if (method === 'POST' && action === 'office') return json(200, { report: await saveOffice(id, await readJson(req), viewer, env, fetchImpl) });
  throw new HttpError(404, 'Not found.');
}
import { EMPLOYEES } from './config.mjs';

const PHONE_COMPANY = EMPLOYEES.phoneListCompany || [];

const json = (status, data, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});

export async function handle(req, { env = process.env, fetchImpl = fetch, ip = '' } = {}) {
  const url = new URL(req.url);
  const route = `${req.method} ${url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')}`;
  const secure = url.protocol === 'https:';
  try {
    const inc = await incidentRoutes(req, url, route, env, fetchImpl);
    if (inc) return inc;
    switch (route) {
      case 'POST login': {
        let body = {};
        try { body = await req.json(); } catch { /* empty */ }
        const nameKey = `n:${String(body.lastName || '').toLowerCase().trim()}`;
        const ipKey = `ip:${ip}`;
        checkThrottle(nameKey); if (ip) checkThrottle(ipKey);
        const r = await findForLogin(body.lastName, body.pin, env, fetchImpl);
        if (r.status === 'ok') {
          return json(200, { person: publicPerson(r.person, env) }, { 'Set-Cookie': makeCookie(r.person, env, Date.now(), secure) });
        }
        recordFailure(nameKey); if (ip) recordFailure(ipKey);
        if (r.status === 'ambiguous') throw new HttpError(409, 'That name and PIN match more than one person. Please call the office.');
        throw new HttpError(401, 'Last name or PIN not recognized. Use the same PIN as your timecard.');
      }
      case 'POST logout':
        return json(200, { ok: true }, { 'Set-Cookie': clearCookie(secure) });
      case 'GET me': {
        if (url.searchParams.get('fresh')) {
          await requirePerson(req, env, fetchImpl);   // only signed-in people can force a re-read
          forceFresh();
        }
        const p = await requirePerson(req, env, fetchImpl);
        return json(200, { person: publicPerson(p, env) });
      }
      case 'GET jobs': {
        await requirePerson(req, env, fetchImpl);
        return json(200, { jobs: await jobs(env, fetchImpl) });
      }
      case 'GET phones': {
        const viewer = await requirePerson(req, env, fetchImpl);
        return json(200, { company: PHONE_COMPANY, people: await phoneList(env, fetchImpl, viewer) });
      }
      default:
        throw new HttpError(404, 'Not found.');
    }
  } catch (err) {
    if (err instanceof HttpError) {
      const extra = err.status === 401 ? { 'Set-Cookie': clearCookie(secure) } : {};
      return json(err.status, { error: err.message }, route === 'POST login' ? {} : extra);
    }
    console.error(err);
    return json(500, { error: 'Something went wrong. Try again.' });
  }
}

// Request handler (used by the Netlify function and by the tests).
import { HttpError } from './airtable.mjs';
import { makeCookie, clearCookie, requirePerson, findForLogin, checkThrottle, recordFailure } from './auth.mjs';
import { jobs, phoneList, publicPerson } from './store.mjs';

const json = (status, data, headers = {}) => new Response(JSON.stringify(data), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
});

export async function handle(req, { env = process.env, fetchImpl = fetch, ip = '' } = {}) {
  const url = new URL(req.url);
  const route = `${req.method} ${url.pathname.replace(/^\/api\/?/, '').replace(/\/$/, '')}`;
  const secure = url.protocol === 'https:';
  try {
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
        const p = await requirePerson(req, env, fetchImpl);
        return json(200, { person: publicPerson(p, env) });
      }
      case 'GET jobs': {
        await requirePerson(req, env, fetchImpl);
        return json(200, { jobs: await jobs(env, fetchImpl) });
      }
      case 'GET phones': {
        await requirePerson(req, env, fetchImpl);
        return json(200, { people: await phoneList(env, fetchImpl) });
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

// Incident Reports (Safety base): permissions, saving, sign-offs, notifications.
import { SAFETY as S, TIME_ZONE } from './config.mjs';
import { HttpError, listAll, createRecord, updateRecord, getRecord, uploadAttachment } from './airtable.mjs';
import { employeeById } from './store.mjs';
import { sendText, textMagicConfigured, toE164 } from './textmagic.mjs';

const F = S.f;
const has = (list, v) => (list || []).some((x) => String(x).toLowerCase() === String(v || '').toLowerCase());

export const canFile = (p) => has(S.filePositions, p.position);
export const canViewAll = (p) => has(S.viewAllPositions, p.position) || (S.viewAllPeople || []).includes(p.id);
export const isOffice = (p) => has(S.officePositions, p.position) || (S.officePeople || []).includes(p.id);
export const canSignStep = (p, step) => has(step.positions, p.position) || (step.people || []).includes(p.id);
export const canUseIncidents = (p) => canFile(p) || canViewAll(p);

// ---------- small helpers ----------
const str = (v) => (v == null ? '' : typeof v === 'object' && !Array.isArray(v) ? String(v.name ?? '') : String(v)).trim();
const clip = (v, n = 4000) => String(v ?? '').replace(/\r\n/g, '\n').trim().slice(0, n);
const oneOf = (v, list) => (list.includes(v) ? v : '');
const isoDate = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(String(v || '')) ? String(v) : '');

export function todayNY(now = new Date()) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
}
export function to12h(hhmm) {
  const m = String(hhmm || '').match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return clip(hhmm, 20);
  let h = Number(m[1]); const ap = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  return `${h}:${m[2]} ${ap}`;
}
export function dayName(iso) {
  if (!isoDate(iso)) return '';
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
}
export const usDate = (iso) => (isoDate(iso) ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(0, 4)}` : '');

// ---------- record <-> app ----------
const files = (v) => (Array.isArray(v) ? v : []).map((a) => ({
  id: a.id, name: a.filename || 'photo', url: a.url, thumb: a.thumbnails?.large?.url || a.url, type: a.type || '',
}));

export function shape(rec, viewer) {
  const f = rec.fields || {};
  const office = viewer ? isOffice(viewer) : true;
  const reviews = S.reviews.map((step) => {
    const k = { supervisor: ['supName', 'supDate', 'supSig'], coordinator: ['coordName', 'coordDate', 'coordSig'], committee: ['commName', 'commDate', 'commSig'] }[step.key];
    const name = str(f[F[k[0]]]);
    return {
      key: step.key, label: step.label, name, date: str(f[F[k[1]]]),
      signature: files(f[F[k[2]]])[0]?.url || '',
      done: !!name,
      canSign: !!viewer && !name && str(f[F.status]) !== 'Uploading' && canSignStep(viewer, step),
    };
  });
  const out = {
    id: rec.id,
    number: f[F.number] ?? '',
    status: str(f[F.status]) || 'Uploading',
    date: str(f[F.date]), time: str(f[F.time]), day: str(f[F.day]), shift: str(f[F.shift]), began: str(f[F.began]),
    job: str(f[F.job]), jobNumber: str(f[F.jobNumber]),
    injured: str(f[F.injured]), jobTitle: str(f[F.jobTitle]),
    injuryClass: (f[F.injuryClass] || []).map(str),
    location: str(f[F.location]), locationOther: str(f[F.locationOther]),
    working: str(f[F.working]), workingOther: str(f[F.workingOther]),
    witnesses: str(f[F.witnesses]), task: str(f[F.task]), nature: str(f[F.nature]), how: str(f[F.how]),
    causes: str(f[F.causes]), corrective: str(f[F.corrective]), cases: str(f[F.cases]),
    photos: files(f[F.photos]),
    preparedBy: str(f[F.preparedBy]), preparedTitle: str(f[F.preparedTitle]), preparedDate: str(f[F.preparedDate]),
    preparedSignature: files(f[F.preparedSig])[0]?.url || '',
    preparedById: str(f[F.preparedById]),
    submittedAt: str(f[F.submittedAt]),
    reviews,
    office,
  };
  if (office) {
    Object.assign(out, {
      drug: str(f[F.drug]), drugDate: str(f[F.drugDate]),
      alcohol: str(f[F.alcohol]), alcoholDate: str(f[F.alcoholDate]),
      officeNotes: str(f[F.officeNotes]), textsSent: str(f[F.textsSent]),
    });
  }
  return out;
}

export function canSee(viewer, rec) {
  return canViewAll(viewer) || str(rec.fields?.[F.preparedById]) === viewer.id;
}

// ---------- list / read ----------
const LIST_FIELDS = [F.number, F.status, F.date, F.time, F.injured, F.job, F.jobNumber, F.injuryClass, F.preparedBy, F.preparedById, F.supName, F.coordName, F.commName];

export async function listIncidents(viewer, env, fetchImpl) {
  if (!canUseIncidents(viewer)) throw new HttpError(403, 'Incident reports are for supervisors, foremen and management.');
  let recs;
  try { recs = await listAll(S.base, S.table, LIST_FIELDS, env, fetchImpl); }
  catch (e) {
    if (e.status === 502 && /cannot read/i.test(e.message)) {
      throw new HttpError(502, 'The app cannot open the Safety base. In Airtable, edit the L&H App token: add the Safety base under Access, and the data.records:write scope.');
    }
    throw e;
  }
  return recs
    .filter((r) => canSee(viewer, r))
    .map((r) => {
      const f = r.fields || {};
      return {
        id: r.id, number: f[F.number] ?? '', status: str(f[F.status]) || 'Uploading',
        date: str(f[F.date]), time: str(f[F.time]), injured: str(f[F.injured]),
        job: str(f[F.job]), jobNumber: str(f[F.jobNumber]), injuryClass: (f[F.injuryClass] || []).map(str),
        preparedBy: str(f[F.preparedBy]), mine: str(f[F.preparedById]) === viewer.id,
        signed: [F.supName, F.coordName, F.commName].filter((k) => str(f[k])).length,
      };
    })
    .sort((a, b) => (Number(b.number) || 0) - (Number(a.number) || 0));
}

async function loadVisible(id, viewer, env, fetchImpl) {
  if (!/^rec[A-Za-z0-9]{14}$/.test(id)) throw new HttpError(404, 'That report was not found.');
  if (!canUseIncidents(viewer)) throw new HttpError(403, 'Incident reports are for supervisors, foremen and management.');
  const rec = await getRecord(S.base, S.table, id, env, fetchImpl);
  if (!canSee(viewer, rec)) throw new HttpError(404, 'That report was not found.');
  return rec;
}

export async function getIncident(id, viewer, env, fetchImpl) {
  return shape(await loadVisible(id, viewer, env, fetchImpl), viewer);
}
export { loadVisible };

// ---------- create (step 1 of submitting) ----------
export function fieldsFromForm(b, viewer, now = new Date()) {
  const date = isoDate(b.date) || todayNY(now);
  const injuryClass = (Array.isArray(b.injuryClass) ? b.injuryClass : []).filter((c) => S.injuryClasses.includes(c));
  const injured = clip(b.injured, 120);
  const job = clip(b.job, 160);
  if (!injured) throw new HttpError(400, 'Enter the injured employee (or "None" for property damage / near miss).');
  if (!injuryClass.length) throw new HttpError(400, 'Pick at least one injury class.');
  if (!clip(b.how)) throw new HttpError(400, 'Describe how the incident occurred.');
  return {
    [F.report]: `${usDate(date)} – ${injured}${job ? ` – ${job}` : ''}`,
    [F.status]: 'Uploading',
    [F.date]: date,
    [F.time]: to12h(b.time),
    [F.day]: dayName(date),
    [F.shift]: oneOf(b.shift, ['Regular Shift', 'Overtime']) || null,
    [F.began]: to12h(b.began),
    [F.job]: job,
    [F.jobNumber]: clip(b.jobNumber, 40),
    [F.injured]: injured,
    [F.jobTitle]: clip(b.jobTitle, 120),
    [F.injuryClass]: injuryClass,
    [F.location]: oneOf(b.location, ["Employer's Premises", 'Other']) || null,
    [F.locationOther]: clip(b.locationOther, 300),
    [F.working]: oneOf(b.working, ['Alone', 'With Co-Worker', 'Other']) || null,
    [F.workingOther]: clip(b.workingOther, 300),
    [F.witnesses]: clip(b.witnesses, 2000),
    [F.task]: clip(b.task), [F.nature]: clip(b.nature), [F.how]: clip(b.how),
    [F.causes]: clip(b.causes), [F.corrective]: clip(b.corrective), [F.cases]: clip(b.cases, 2000),
    [F.preparedBy]: viewer.name,
    [F.preparedTitle]: clip(b.preparedTitle, 120) || viewer.position,
    [F.preparedDate]: todayNY(now),
    [F.preparedById]: viewer.id,
    [F.gps]: /^-?\d{1,3}\.\d+,\s?-?\d{1,3}\.\d+$/.test(String(b.gps || '')) ? String(b.gps) : '',
  };
}

export async function createIncident(body, viewer, env, fetchImpl) {
  if (!canFile(viewer)) throw new HttpError(403, 'Incident reports are filled out by supervisors, foremen and management.');
  const rec = await createRecord(S.base, S.table, fieldsFromForm(body, viewer), env, fetchImpl);
  return { id: rec.id };
}

// ---------- files ----------
const MAX_B64 = Math.floor(4.8 * 1024 * 1024 * 4 / 3);
function checkFile(file) {
  const contentType = String(file?.contentType || '');
  const data = String(file?.data || '').replace(/^data:[^,]+,/, '');
  if (!/^image\/(jpeg|png|webp|heic|heif)$/.test(contentType)) throw new HttpError(400, 'Only photos can be added.');
  if (!data || !/^[A-Za-z0-9+/=]+$/.test(data)) throw new HttpError(400, 'That photo could not be read.');
  if (data.length > MAX_B64) throw new HttpError(413, 'That photo is too big to upload.');
  return { contentType, data };
}

export async function addFile(id, body, viewer, env, fetchImpl) {
  const rec = await loadVisible(id, viewer, env, fetchImpl);
  const f = rec.fields || {};
  if (str(f[F.preparedById]) !== viewer.id || str(f[F.status]) !== 'Uploading') throw new HttpError(409, 'This report has already been sent. Photos can no longer be added.');
  const kind = body.kind === 'signature' ? 'signature' : 'photo';
  const { contentType, data } = checkFile(body);
  if (kind === 'photo' && (f[F.photos] || []).length >= S.maxPhotos) throw new HttpError(400, `Up to ${S.maxPhotos} photos per report.`);
  const ext = contentType.split('/')[1].replace('jpeg', 'jpg');
  const filename = kind === 'signature' ? `signature-prepared-by.${ext}` : clip(body.filename, 80).replace(/[^\w. -]/g, '') || `photo.${ext}`;
  await uploadAttachment(S.base, id, kind === 'signature' ? F.preparedSig : F.photos, { contentType, data, filename }, env, fetchImpl);
  return { ok: true };
}

// ---------- submit: mark sent, then text ----------
export async function submitIncident(id, viewer, origin, env, fetchImpl) {
  const rec = await loadVisible(id, viewer, env, fetchImpl);
  const f = rec.fields || {};
  if (str(f[F.preparedById]) !== viewer.id) throw new HttpError(403, 'Only the person who filled out this report can send it.');
  if (str(f[F.status]) !== 'Uploading') return { ok: true, already: true };
  if (!(f[F.preparedSig] || []).length) throw new HttpError(400, 'Sign the report before sending it.');
  const link = `${origin}/#incident/${id}`;
  const updated = await updateRecord(S.base, S.table, id, {
    [F.status]: 'Submitted',
    [F.submittedAt]: new Date().toISOString(),
    [F.appLink]: link,
  }, env, fetchImpl);
  const log = await textEveryone(updated.fields || f, link, env, fetchImpl);
  await updateRecord(S.base, S.table, id, { [F.textsSent]: log }, env, fetchImpl).catch((e) => console.error('texts log', e));
  return { ok: true, texts: log };
}

export function textMessage(f, link) {
  const classes = (f[F.injuryClass] || []).map(str).join(', ');
  const when = [usDate(str(f[F.date])), str(f[F.time])].filter(Boolean).join(' ');
  const job = [str(f[F.jobNumber]), str(f[F.job])].filter(Boolean).join(' ');
  return `L&H INCIDENT REPORT${f[F.number] ? ` #${f[F.number]}` : ''}: ${str(f[F.injured])}${classes ? ` (${classes})` : ''}${job ? `, ${job}` : ''}${when ? `, ${when}` : ''}. Filed by ${str(f[F.preparedBy])}. Open: ${link}`.slice(0, 600);
}

async function textEveryone(f, link, env, fetchImpl) {
  const people = [];
  for (const pid of S.textPeople) {
    const p = await employeeById(pid, env, fetchImpl).catch(() => null);
    if (p) people.push({ name: p.name, cell: p.cell });
  }
  people.push(...S.textNumbers);
  if (!textMagicConfigured(env)) return `Texts not sent: TextMagic is not set up in Netlify (${people.map((p) => p.name).join(', ')}).`;
  const msg = textMessage(f, link);
  const lines = [];
  for (const p of people) {
    const to = toE164(p.cell);
    if (!to) { lines.push(`${p.name}: no cell number`); continue; }
    try { await sendText(to, msg, env, fetchImpl); lines.push(`${p.name} (${p.cell}): sent`); }
    catch (e) { console.error('text', p.name, e.message); lines.push(`${p.name} (${p.cell}): FAILED`); }
  }
  return `${new Date().toISOString()}\n${lines.join('\n')}`;
}

// ---------- sign-offs ----------
const STEP_FIELDS = {
  supervisor: [F.supName, F.supDate, F.supSig],
  coordinator: [F.coordName, F.coordDate, F.coordSig],
  committee: [F.commName, F.commDate, F.commSig],
};

export async function signReview(id, body, viewer, env, fetchImpl) {
  const step = S.reviews.find((s) => s.key === body.step);
  if (!step) throw new HttpError(400, 'Unknown sign-off.');
  if (!canSignStep(viewer, step)) throw new HttpError(403, `Only the ${step.label} can sign this line.`);
  const rec = await loadVisible(id, viewer, env, fetchImpl);
  const f = rec.fields || {};
  if (str(f[F.status]) === 'Uploading') throw new HttpError(409, 'This report has not been sent yet.');
  const [nameF, dateF, sigF] = STEP_FIELDS[step.key];
  if (str(f[nameF])) throw new HttpError(409, `${step.label} has already signed.`);
  const { contentType, data } = checkFile(body.signature || {});
  await uploadAttachment(S.base, id, sigF, { contentType, data, filename: `signature-${step.key}.png` }, env, fetchImpl);
  const signed = Object.values(STEP_FIELDS).filter(([n]) => n === nameF || str(f[n])).length;
  const updated = await updateRecord(S.base, S.table, id, {
    [nameF]: viewer.name,
    [dateF]: todayNY(),
    [F.status]: signed === Object.keys(STEP_FIELDS).length ? 'Closed' : 'In Review',
  }, env, fetchImpl);
  return shape({ id, fields: { ...f, ...updated.fields } }, viewer);
}

// ---------- office-only fields ----------
export async function saveOffice(id, body, viewer, env, fetchImpl) {
  if (!isOffice(viewer)) throw new HttpError(403, 'Only the office can fill in these fields.');
  await loadVisible(id, viewer, env, fetchImpl);
  await updateRecord(S.base, S.table, id, {
    [F.drug]: oneOf(body.drug, ['Yes', 'No']) || null,
    [F.drugDate]: isoDate(body.drugDate) || null,
    [F.alcohol]: oneOf(body.alcohol, ['Yes', 'No']) || null,
    [F.alcoholDate]: isoDate(body.alcoholDate) || null,
    [F.officeNotes]: clip(body.officeNotes),
  }, env, fetchImpl);
  return getIncident(id, viewer, env, fetchImpl);
}

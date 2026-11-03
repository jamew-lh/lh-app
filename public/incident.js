// Safety → Incident Report (Lyons Hohl Loss Incident Investigation Report)
// The form (6 steps, saved on the phone as you go), photos, finger signature,
// the list of reports, and the review / sign-off screen.

let C; // shared helpers from app.js: { app, api, esc, I, bar, footer, me, loadJobs }

export function initIncidents(ctx) { C = ctx; }

const CLASSES = ['Fatality', 'Medical', 'First Aid', 'Automobile', 'Property Damage', 'Near Miss'];
const MAX_PHOTOS = 12;
const STEPS = ['When & who', 'What kind', 'What happened', 'Why & what next', 'Photos', 'Sign & send'];

// ---------------------------------------------------------------- storage
// The draft (including photos) is kept in IndexedDB on the phone, so a dropped
// signal or a closed app doesn't lose anything.
const DB = 'lh-app';
function idb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB, 1);
    req.onupgradeneeded = () => req.result.createObjectStore('drafts');
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
const memory = new Map();
async function draftGet(key) {
  try { const db = await idb(); return await new Promise((res, rej) => { const r = db.transaction('drafts').objectStore('drafts').get(key); r.onsuccess = () => res(r.result || null); r.onerror = () => rej(r.error); }); }
  catch { return memory.get(key) || null; }
}
async function draftPut(key, val) {
  memory.set(key, val);
  try { const db = await idb(); await new Promise((res, rej) => { const t = db.transaction('drafts', 'readwrite'); t.objectStore('drafts').put(val, key); t.oncomplete = res; t.onerror = () => rej(t.error); }); } catch { /* memory only */ }
}
async function draftDel(key) {
  memory.delete(key);
  try { const db = await idb(); await new Promise((res) => { const t = db.transaction('drafts', 'readwrite'); t.objectStore('drafts').delete(key); t.oncomplete = res; t.onerror = res; }); } catch { /* ignore */ }
}
const draftKey = () => `incident:${C.me().id}`;

// ---------------------------------------------------------------- helpers
const $ = (s, el = document) => el.querySelector(s);
const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const nowTime = () => new Intl.DateTimeFormat('en-GB', { timeZone: 'America/New_York', hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date());
const usDate = (iso) => (iso ? `${Number(iso.slice(5, 7))}/${Number(iso.slice(8, 10))}/${iso.slice(0, 4)}` : '');
const dayOf = (iso) => { if (!iso) return ''; const [y, m, d] = iso.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' }); };
const blobToB64 = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });

async function shrink(file) {
  // Photos are resized to 1600 px and saved as JPEG (about 300-600 KB) so they
  // upload on a weak jobsite signal.
  let bmp;
  try { bmp = await createImageBitmap(file, { imageOrientation: 'from-image' }); }
  catch {
    bmp = await new Promise((res, rej) => { const img = new Image(); img.onload = () => res(img); img.onerror = rej; img.src = URL.createObjectURL(file); });
  }
  const max = 1600; const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const cv = document.createElement('canvas');
  cv.width = Math.round(bmp.width * s); cv.height = Math.round(bmp.height * s);
  cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
  return new Promise((res) => cv.toBlob((b) => res(b), 'image/jpeg', 0.8));
}

function statusPill(status) {
  const cls = { Submitted: 'bad', 'In Review': 'warn', Closed: 'on', Uploading: 'off' }[status] || 'off';
  return `<span class="pill ${cls}">${C.esc(status === 'Uploading' ? 'Not sent' : status)}</span>`;
}

// ---------------------------------------------------------------- signature pad
function signaturePad(canvas) {
  const ctx = canvas.getContext('2d');
  let drawing = false; let empty = true; let last = null;
  const fit = () => {
    const r = canvas.getBoundingClientRect(); const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(r.width * dpr); canvas.height = Math.round(r.height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.6; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.strokeStyle = '#0B1B33';
    empty = true;
  };
  const pos = (e) => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; };
  canvas.addEventListener('pointerdown', (e) => { drawing = true; last = pos(e); canvas.setPointerCapture(e.pointerId); e.preventDefault(); });
  canvas.addEventListener('pointermove', (e) => {
    if (!drawing) return; const p = pos(e);
    ctx.beginPath(); ctx.moveTo(last.x, last.y); ctx.lineTo(p.x, p.y); ctx.stroke(); last = p; empty = false;
    canvas.dispatchEvent(new Event('change'));
  });
  const stop = () => { drawing = false; };
  canvas.addEventListener('pointerup', stop); canvas.addEventListener('pointercancel', stop);
  requestAnimationFrame(fit);
  return {
    clear() { ctx.clearRect(0, 0, canvas.width, canvas.height); empty = true; canvas.dispatchEvent(new Event('change')); },
    isEmpty: () => empty,
    toB64: () => canvas.toDataURL('image/png').split(',')[1],
    toDataURL: () => canvas.toDataURL('image/png'),
    async load(dataUrl) {
      if (!dataUrl) return;
      await new Promise((r) => requestAnimationFrame(r));
      const img = new Image(); img.onload = () => { const r = canvas.getBoundingClientRect(); ctx.drawImage(img, 0, 0, r.width, r.height); empty = false; }; img.src = dataUrl;
    },
  };
}

function signSheet(title, onSign) {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet sign-sheet" role="dialog" aria-modal="true">
      <h2 class="sheet-title">${C.esc(title)}</h2>
      <p>Sign with your finger in the box.</p>
      <canvas class="sigpad" id="sheetPad"></canvas>
      <div class="sig-actions"><button class="linkbtn" id="sheetClear">Clear</button></div>
      <div class="err" id="sheetErr" hidden></div>
      <button class="btn btn-green" id="sheetOk">Sign</button>
      <button class="btn btn-cancel" id="sheetCancel">Cancel</button>
    </div>`;
  document.body.appendChild(back);
  const pad = signaturePad($('#sheetPad', back));
  $('#sheetClear', back).onclick = () => pad.clear();
  $('#sheetCancel', back).onclick = () => back.remove();
  $('#sheetOk', back).onclick = async () => {
    if (pad.isEmpty()) { $('#sheetErr', back).textContent = 'Please sign first.'; $('#sheetErr', back).hidden = false; return; }
    const btn = $('#sheetOk', back); btn.disabled = true; btn.textContent = 'Saving…';
    try { await onSign(pad.toB64()); back.remove(); }
    catch (e) { $('#sheetErr', back).textContent = e.message; $('#sheetErr', back).hidden = false; btn.disabled = false; btn.textContent = 'Sign'; }
  };
}

// ---------------------------------------------------------------- list
export async function showIncidents() {
  const { app, esc, I, bar, footer, me } = C;
  document.title = 'Incident Reports · Lyons & Hohl';
  app.innerHTML = `${bar(`<button class="back" data-go="">${I.back}Home</button><span class="spacer"></span><h1>Incident Reports</h1>`)}
    <section class="inc-head"><div class="wrap">
      <div class="eyebrow">Safety</div>
      <h2>Loss Incident Investigation Report</h2>
      ${me().incidents.file ? `<button class="btn btn-tan wide-btn" data-go="incident-new">${I.plus}New incident report</button>` : ''}
    </div></section>
    <main><div class="wrap">
      <div id="draftBanner"></div>
      <div class="section-title">${me().incidents.all ? 'All reports' : 'Reports you filed'}</div>
      <div id="incList" class="list"><div class="loading">Loading…</div></div>
    </div></main>${footer()}`;
  if (me().incidents.file) {
    const d = await draftGet(draftKey());
    if (d) {
      $('#draftBanner').innerHTML = `<div class="draft-banner"><div><b>${d.recordId ? 'A report hasn’t finished sending' : 'You have an unfinished report'}</b><small>${esc(d.form.injured || 'No name yet')} · saved on this phone</small></div>
        <button class="btn btn-green" data-go="incident-new">${d.recordId ? 'Finish sending' : 'Continue'}</button>${d.recordId ? '' : '<button class="linkbtn" id="discardDraft">Discard</button>'}</div>`;
      $('#discardDraft')?.addEventListener('click', async () => { if (await confirmSheet('Discard this unfinished report?', 'Discard')) { await draftDel(draftKey()); showIncidents(); } });
    }
  }
  try {
    const { reports } = await C.api('incidents');
    $('#incList').innerHTML = reports.length ? reports.map((r) => `
      <button class="row inc-row" data-go="incident/${r.id}">
        <span class="num">#${esc(r.number)}</span>
        <span class="main"><div class="title">${esc(r.injured)}</div>
          <div class="sub">${esc(usDate(r.date))}${r.time ? ` · ${esc(r.time)}` : ''}${r.job ? ` · ${esc([r.jobNumber, r.job].filter(Boolean).join(' '))}` : ''}</div>
          <div class="sub">${r.injuryClass.map(esc).join(', ')}${r.status !== 'Uploading' ? ` · ${r.signed} of 3 signed` : ''}</div></span>
        ${statusPill(r.status)}${I.chev}</button>`).join('') : '<div class="empty">No incident reports yet.</div>';
  } catch (e) { if (e.message !== 'signed-out') $('#incList').innerHTML = `<div class="err">${esc(e.message)}</div>`; }
}

function confirmSheet(text, yes) {
  return new Promise((resolve) => {
    const back = document.createElement('div');
    back.className = 'sheet-back';
    back.innerHTML = `<div class="sheet"><h2 class="sheet-title">${C.esc(text)}</h2><button class="btn btn-red" id="cy">${C.esc(yes)}</button><button class="btn btn-cancel" id="cn">Cancel</button></div>`;
    document.body.appendChild(back);
    $('#cy', back).onclick = () => { back.remove(); resolve(true); };
    $('#cn', back).onclick = () => { back.remove(); resolve(false); };
  });
}

// ---------------------------------------------------------------- the form
let D = null;          // the draft being edited
let pad = null;
let saveTimer = null;
const save = () => { clearTimeout(saveTimer); saveTimer = setTimeout(flush, 200); };
const flush = () => { clearTimeout(saveTimer); if (D && C?.me()) draftPut(draftKey(), D); };
// Save right away if the phone locks, the app is switched away, or the page closes.
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') flush(); });
window.addEventListener('pagehide', flush);

function newDraft(auto) {
  const me = C.me();
  return {
    step: 0, recordId: '', uploaded: 0, sigUploaded: false,
    form: {
      date: today(), time: nowTime(), began: '', shift: 'Regular Shift', job: '', jobNumber: '', jobPick: '',
      injured: '', jobTitle: '', injuryClass: auto === 'auto' ? ['Automobile'] : [],
      location: '', locationOther: '', working: '', workingOther: '', witnesses: '',
      task: '', nature: '', how: '', causes: '', corrective: '', cases: '',
      preparedTitle: me.position || '', gps: '',
    },
    photos: [],          // [{ blob, name }]
    signature: '',       // data URL
  };
}

let people = null;
async function loadPeople() {
  if (!people) people = (await C.api('incidents/people')).people;
  return people;
}

export async function showIncidentForm(arg) {
  const me = C.me();
  if (!me.incidents.file) { location.hash = 'incidents'; return; }
  D = (await draftGet(draftKey())) || newDraft(arg);
  if (arg === 'auto' && !D.form.injuryClass.includes('Automobile') && !D.recordId) D.form.injuryClass.push('Automobile');
  save();
  if (D.recordId) return sendNow();     // it was already being sent: finish it
  renderStep();
  Promise.all([loadPeople().catch(() => []), C.loadJobs().catch(() => [])]).then(() => { if ($('#incForm')) fillLists(); });
}

function fillLists() {
  const pl = $('#peopleList'); const jl = $('#jobList');
  if (pl && people) pl.innerHTML = people.map((p) => `<option value="${C.esc(p.name)}">${C.esc(p.position)}</option>`).join('');
  C.loadJobs().then((jobs) => { if (jl) jl.innerHTML = jobs.map((j) => `<option value="${C.esc(`${j.number} – ${j.name}`)}"></option>`).join(''); }).catch(() => {});
}

const chips = (name, options, chosen, multi = false) => `<div class="chipset ${multi ? 'multi' : ''}" data-name="${name}" data-multi="${multi}">${options.map((o) => {
  const on = multi ? chosen.includes(o) : chosen === o;
  return `<button type="button" class="pick ${name === 'injuryClass' ? `cls-${o.replace(/\W/g, '').toLowerCase()}` : ''}" data-v="${C.esc(o)}" aria-pressed="${on}">${C.esc(o)}</button>`;
}).join('')}</div>`;
const field = (label, html, hint = '') => `<label class="flabel">${label}${hint ? `<small>${hint}</small>` : ''}</label>${html}`;
const input = (name, type = 'text', extra = '') => `<input type="${type}" name="${name}" value="${C.esc(D.form[name])}" ${extra}>`;
const area = (name, ph = '', rows = 4) => `<textarea name="${name}" rows="${rows}" placeholder="${C.esc(ph)}">${C.esc(D.form[name])}</textarea>`;

function stepHtml(i) {
  const f = D.form; const { I } = C;
  switch (i) {
    case 0: return `
      <div class="grid2">${field('Date of incident', input('date', 'date', `max="${today()}"`))}${field('Time of incident', input('time', 'time'))}</div>
      <p class="dayline" id="dayLine">${C.esc(dayOf(f.date))}</p>
      <div class="grid2">${field('Time began work', input('began', 'time'))}<div>${field('Shift', chips('shift', ['Regular Shift', 'Overtime'], f.shift))}</div></div>
      ${field('Job', `<input type="text" name="jobPick" list="jobList" value="${C.esc(f.jobPick || [f.jobNumber, f.job].filter(Boolean).join(' – '))}" placeholder="Start typing a job name or number" autocomplete="off"><datalist id="jobList"></datalist>`)}
      ${field('Injured employee <b class="req">*</b>', `<input type="text" name="injured" list="peopleList" value="${C.esc(f.injured)}" placeholder="Last name, First name" autocomplete="off"><datalist id="peopleList"></datalist>`, '<b>Type last name first</b> (e.g. Smith, John) and pick from the list. For property damage or a near miss with nobody hurt, type “None”.')}
      ${field('Job title', input('jobTitle'))}`;
    case 1: return `
      ${field('Injury class <b class="req">*</b>', chips('injuryClass', CLASSES, f.injuryClass, true), 'Pick all that apply.')}
      ${field('Location of incident', chips('location', ["Employer's Premises", 'Other'], f.location))}
      <div ${f.location === 'Other' ? '' : 'hidden'} id="locOther">${input('locationOther', 'text', 'placeholder="Where?"')}<small class="fromjob" id="locFromJob" hidden>Filled in from the job’s address in Job Details — change it if the incident was somewhere else.</small></div>
      ${field('Employee was working', chips('working', ['Alone', 'With Co-Worker', 'Other'], f.working))}
      <div ${f.working === 'Other' ? '' : 'hidden'} id="workOther">${input('workingOther', 'text', 'placeholder="Explain"')}</div>
      ${field('Witnesses', `${area('witnesses', 'Names, one per line', 3)}<div class="addrow"><input type="text" id="witnessPick" list="peopleList" placeholder="Add an employee (last name first)…" autocomplete="off"><button type="button" class="btn btn-light" id="witnessAdd">${I.plus}Add</button></div>`)}`;
    case 2: return `
      ${field('Task / activity when incident occurred', area('task', 'What were they doing?', 3))}
      ${field('Nature of injury / illness', area('nature', 'Body part affected, how affected, severity', 3))}
      ${field('Describe how incident occurred <b class="req">*</b>', area('how', 'Tell it step by step', 6))}
      <p class="tip">${I.mic}Tip: tap the microphone on your keyboard to talk instead of type.</p>`;
    case 3: return `
      ${field('Causal factors', area('causes', 'Events, actions, conditions and equipment that contributed', 5))}
      ${field('Corrective actions / recommendations', area('corrective', 'What has been or will be done to prevent it happening again', 5))}`;
    case 4: return `
      <p class="hint-left">Add photos of the scene, damage, equipment and anything else that helps. Up to ${MAX_PHOTOS}.</p>
      <div class="photo-btns">
        <label class="btn btn-green">${I.camera}Take photo<input type="file" accept="image/*" capture="environment" id="camIn" hidden></label>
        <label class="btn btn-light">${I.file}Choose photos<input type="file" accept="image/*" multiple id="picIn" hidden></label>
      </div>
      <div class="photo-grid" id="photoGrid"></div>
      <p class="hint-left" id="photoCount"></p>`;
    case 5: return `
      ${field('Case #s and names related to this incident', area('cases', 'Police report #, witnesses, WC claim #s, etc.', 3))}
      <div class="prep">
        <div><span class="dlabel">Prepared by</span><b>${C.esc(C.me().name)}</b></div>
        <div><span class="dlabel">Date</span><b>${C.esc(usDate(today()))}</b></div>
      </div>
      ${field('Your title', input('preparedTitle'))}
      ${field('Your signature <b class="req">*</b>', `<canvas class="sigpad" id="sigPad"></canvas><div class="sig-actions"><span class="muted">Sign with your finger</span><button type="button" class="linkbtn" id="sigClear">Clear</button></div>`)}
      <button type="button" class="btn btn-light gpsbtn" id="gpsBtn">${C.I.gps}${f.gps ? `Location added (${C.esc(f.gps)})` : 'Add my GPS location (optional)'}</button>
      <div class="err" id="formErr" hidden></div>`;
    default: return '';
  }
}

function renderStep() {
  const { app, esc, I, bar } = C;
  const i = D.step;
  document.title = 'New Incident Report · Lyons & Hohl';
  app.innerHTML = `${bar(`<button class="back" id="incExit">${I.back}Reports</button><span class="spacer"></span><h1>New Report</h1>`)}
    <div class="stepper"><div class="wrap">
      <div class="dots">${STEPS.map((s, n) => `<button type="button" class="dot ${n === i ? 'cur' : n < i ? 'done' : ''}" data-step="${n}" aria-label="Step ${n + 1}: ${esc(s)}">${n < i ? I.check : n + 1}</button>`).join('<span class="bar-line"></span>')}</div>
      <div class="steptitle"><span>Step ${i + 1} of ${STEPS.length}</span><b>${esc(STEPS[i])}</b></div>
    </div></div>
    <main><div class="wrap"><form id="incForm" class="incform" autocomplete="off">${stepHtml(i)}</form></div></main>
    <div class="formnav"><div class="wrap">
      ${i > 0 ? '<button type="button" class="btn btn-cancel" id="prevBtn">Back</button>' : '<span></span>'}
      ${i < STEPS.length - 1 ? '<button type="button" class="btn btn-green" id="nextBtn">Next</button>' : '<button type="button" class="btn btn-red" id="sendBtn">Send report</button>'}
    </div></div>`;
  window.scrollTo(0, 0);
  wireStep();
  fillLists();
}

function wireStep() {
  const form = $('#incForm');
  form.addEventListener('input', (e) => {
    const t = e.target; if (!t.name) return;
    D.form[t.name] = t.value;
    if (t.name === 'date') $('#dayLine').textContent = dayOf(t.value);
    if (t.name === 'jobPick') {
      const m = t.value.match(/^(\S+)\s+–\s+(.+)$/);
      if (m) { D.form.jobNumber = m[1]; D.form.job = m[2]; } else { D.form.jobNumber = ''; D.form.job = t.value; }
    }
    if (t.name === 'injured' && people) {
      const p = people.find((x) => x.name === t.value);
      if (p && !D.form.jobTitle) { D.form.jobTitle = p.position; const jt = form.querySelector('[name=jobTitle]'); if (jt) jt.value = p.position; }
    }
    save();
  });
  form.querySelectorAll('.chipset').forEach((set) => set.addEventListener('click', (e) => {
    const b = e.target.closest('.pick'); if (!b) return;
    const name = set.dataset.name; const v = b.dataset.v;
    if (set.dataset.multi === 'true') {
      const list = D.form[name]; const k = list.indexOf(v);
      if (k >= 0) list.splice(k, 1); else list.push(v);
      b.setAttribute('aria-pressed', String(k < 0));
    } else {
      D.form[name] = D.form[name] === v ? '' : v;
      set.querySelectorAll('.pick').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.v === D.form[name])));
      if (name === 'location') {
        $('#locOther').hidden = D.form.location !== 'Other';
        if (D.form.location === 'Other' && !D.form.locationOther.trim()) fillFromJob();
      }
      if (name === 'working') $('#workOther').hidden = D.form.working !== 'Other';
    }
    save();
  }));
  $('#witnessAdd')?.addEventListener('click', () => {
    const v = $('#witnessPick').value.trim(); if (!v) return;
    D.form.witnesses = [D.form.witnesses.trim(), v].filter(Boolean).join('\n');
    form.querySelector('[name=witnesses]').value = D.form.witnesses; $('#witnessPick').value = ''; save();
  });
  if (D.step === 4) wirePhotos();
  if (D.step === 5) {
    pad = signaturePad($('#sigPad'));
    pad.load(D.signature);
    $('#sigPad').addEventListener('change', () => { D.signature = pad.isEmpty() ? '' : pad.toDataURL(); D.sigUploaded = false; save(); });
    $('#sigClear').onclick = () => pad.clear();
    $('#gpsBtn').onclick = () => {
      const b = $('#gpsBtn'); b.disabled = true; b.lastChild.textContent = 'Finding your location…';
      navigator.geolocation?.getCurrentPosition((p) => {
        D.form.gps = `${p.coords.latitude.toFixed(5)},${p.coords.longitude.toFixed(5)}`; save();
        b.disabled = false; b.lastChild.textContent = `Location added (${D.form.gps})`;
      }, () => { b.disabled = false; b.lastChild.textContent = 'Couldn’t get location — tap to try again'; }, { enableHighAccuracy: true, timeout: 15000 });
    };
  }
  $('#prevBtn')?.addEventListener('click', () => go(D.step - 1));
  $('#nextBtn')?.addEventListener('click', () => {
    const problem = checkStep(D.step);
    if (problem) { showProblem(problem); return; }
    go(D.step + 1);
  });
  $('#sendBtn')?.addEventListener('click', () => {
    for (let s = 0; s < STEPS.length; s++) { const p = checkStep(s); if (p) { if (s !== D.step) go(s, p); else showProblem(p); return; } }
    sendNow();
  });
  document.querySelectorAll('.dot').forEach((d) => d.addEventListener('click', () => go(Number(d.dataset.step))));
  $('#incExit').onclick = () => { location.hash = 'incidents'; };
}

// "Other" location: start with the job's Nearest Physical Address from Job Details.
async function fillFromJob() {
  if (!D.form.job) return;
  let jobs = [];
  try { jobs = await C.loadJobs(); } catch { return; }
  const j = jobs.find((x) => x.number === D.form.jobNumber && x.name === D.form.job)
    || jobs.find((x) => x.name.toLowerCase() === D.form.job.toLowerCase());
  if (!j || !j.address || D.form.location !== 'Other' || D.form.locationOther.trim()) return;
  D.form.locationOther = j.address; save();
  const el = document.querySelector('[name=locationOther]'); if (el) el.value = j.address;
  const note = $('#locFromJob'); if (note) note.hidden = false;
}

function checkStep(s) {
  const f = D.form;
  if (s === 0 && !f.injured.trim()) return 'Enter the injured employee (or “None”).';
  if (s === 0 && !f.date) return 'Enter the date of the incident.';
  if (s === 1 && !f.injuryClass.length) return 'Pick at least one injury class.';
  if (s === 2 && !f.how.trim()) return 'Describe how the incident occurred.';
  if (s === 5 && !D.signature) return 'Sign the report before sending.';
  return '';
}
function showProblem(msg) {
  let box = $('#stepErr');
  if (!box) { box = document.createElement('div'); box.id = 'stepErr'; box.className = 'err'; $('#incForm').prepend(box); }
  box.textContent = msg; box.hidden = false; window.scrollTo(0, 0);
}
function go(n, problem = '') {
  D.step = Math.max(0, Math.min(STEPS.length - 1, n)); save(); renderStep();
  if (problem) showProblem(problem);
}

function wirePhotos() {
  const draw = () => {
    $('#photoGrid').innerHTML = D.photos.map((p, i) => `<div class="ph"><img alt="Photo ${i + 1}" data-i="${i}"><button type="button" class="phx" data-rm="${i}" aria-label="Remove photo">×</button></div>`).join('');
    $('#photoGrid').querySelectorAll('img').forEach((img) => { img.src = URL.createObjectURL(D.photos[Number(img.dataset.i)].blob); });
    $('#photoCount').textContent = D.photos.length ? `${D.photos.length} photo${D.photos.length === 1 ? '' : 's'} added` : 'No photos yet.';
  };
  const add = async (fileList) => {
    for (const file of fileList) {
      if (D.photos.length >= MAX_PHOTOS) break;
      try { const blob = await shrink(file); if (blob) D.photos.push({ blob, name: (file.name || 'photo').replace(/\.\w+$/, '') + '.jpg' }); }
      catch { /* skip unreadable */ }
    }
    save(); draw();
  };
  $('#camIn').addEventListener('change', (e) => add(e.target.files));
  $('#picIn').addEventListener('change', (e) => add(e.target.files));
  $('#photoGrid').addEventListener('click', (e) => {
    const rm = e.target.closest('[data-rm]'); if (!rm) return;
    D.photos.splice(Number(rm.dataset.rm), 1); save(); draw();
  });
  draw();
}

// ---------------------------------------------------------------- sending
async function sendNow() {
  const { app, esc, I, bar } = C;
  app.innerHTML = `${bar(`<span class="spacer"></span><h1>Incident Report</h1>`)}
    <main><div class="wrap"><div class="sending">
      <div class="spinner-lg" id="spin"></div>
      <h2 id="sendTitle">Sending report…</h2>
      <p id="sendStep">Saving the report</p>
      <div class="progress"><span id="sendBar"></span></div>
      <div class="err" id="sendErr" hidden></div>
      <button class="btn btn-green" id="retryBtn" hidden>Try again</button>
      <button class="btn btn-cancel" id="laterBtn" hidden>Finish later</button>
    </div></div></main>`;
  const stepText = (t, n, total) => { $('#sendStep').textContent = t; $('#sendBar').style.width = `${Math.round((n / total) * 100)}%`; };
  const total = 2 + D.photos.length + 1;
  try {
    if (!D.recordId) {
      stepText('Saving the report', 0, total);
      const r = await C.api('incidents', { method: 'POST', body: D.form });
      D.recordId = r.id; D.uploaded = 0; await draftPut(draftKey(), D);
    }
    while (D.uploaded < D.photos.length) {
      stepText(`Uploading photo ${D.uploaded + 1} of ${D.photos.length}`, 1 + D.uploaded, total);
      const p = D.photos[D.uploaded];
      await C.api(`incidents/${D.recordId}/file`, { method: 'POST', body: { kind: 'photo', contentType: 'image/jpeg', data: await blobToB64(p.blob), filename: p.name } });
      D.uploaded += 1; await draftPut(draftKey(), D);
    }
    if (!D.sigUploaded) {
      stepText('Adding your signature', 1 + D.photos.length, total);
      await C.api(`incidents/${D.recordId}/file`, { method: 'POST', body: { kind: 'signature', contentType: 'image/png', data: D.signature.split(',')[1] } });
      D.sigUploaded = true; await draftPut(draftKey(), D);
    }
    stepText('Notifying the office', total - 1, total);
    await C.api(`incidents/${D.recordId}/submit`, { method: 'POST' });
    const id = D.recordId;
    await draftDel(draftKey()); D = null;
    $('#sendBar').style.width = '100%';
    $('.sending').innerHTML = `<div class="done-ic">${I.check}</div><h2>Report sent</h2>
      <p>The office has been notified by text and email. Thank you.</p>
      <button class="btn btn-green" data-go="incident/${id}">View report</button>
      <button class="btn btn-cancel" data-go="">Back to home</button>`;
  } catch (e) {
    if (e.message === 'signed-out') return;
    $('#spin').hidden = true;
    $('#sendTitle').textContent = 'Not sent yet';
    $('#sendErr').textContent = `${e.message} Everything is saved on this phone — tap Try again when you have signal.`;
    $('#sendErr').hidden = false; $('#retryBtn').hidden = false; $('#laterBtn').hidden = false;
    $('#retryBtn').onclick = () => sendNow();
    $('#laterBtn').onclick = () => { location.hash = 'incidents'; };
  }
}

// ---------------------------------------------------------------- one report
export async function showIncident(id) {
  const { app, esc, I, bar, footer } = C;
  app.innerHTML = `${bar(`<button class="back" data-go="incidents">${I.back}Reports</button>`)}<main><div class="wrap"><div class="loading">Loading…</div></div></main>`;
  let r;
  try { r = (await C.api(`incidents/${id}`)).report; }
  catch (e) { if (e.message !== 'signed-out') app.querySelector('main .wrap').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  render(r);

  function render(rep) {
    r = rep;
    document.title = `Incident #${r.number} · Lyons & Hohl`;
    const row = (label, value) => (value ? `<div class="drow"><span class="dlabel">${label}</span><span class="dval">${esc(value)}</span></div>` : '');
    const text = (label, value) => `<div class="tblock"><div class="dlabel">${label}</div><div class="tval ${value ? '' : 'none'}">${value ? esc(value) : 'Not filled in'}</div></div>`;
    app.innerHTML = `${bar(`<button class="back" data-go="incidents">${I.back}Reports</button><span class="spacer"></span><h1>Report #${esc(r.number)}</h1>`)}
      <section class="inc-head"><div class="wrap">
        <div class="eyebrow">Incident report #${esc(r.number)} · ${esc(usDate(r.date))}</div>
        <h2>${esc(r.injured)}</h2>
        <div class="meta">${statusPill(r.status)}<span>${r.injuryClass.map(esc).join(' · ')}</span></div>
        <a class="btn btn-light wide-btn" href="/api/incidents/${r.id}/pdf" target="_blank" rel="noopener">${I.file}Download PDF</a>
      </div></section>
      <main><div class="wrap"><div class="cards">
        <section class="card"><h3><span class="dot">${I.clock}</span>When &amp; who</h3><div class="details">
          ${row('Date', `${usDate(r.date)}${r.day ? ` (${r.day})` : ''}`)}${row('Time', r.time)}${row('Began work', r.began)}${row('Shift', r.shift)}
          ${row('Job', [r.jobNumber, r.job].filter(Boolean).join(' '))}${row('Injured', r.injured)}${row('Job title', r.jobTitle)}
          ${row('Location', [r.location, r.locationOther].filter(Boolean).join(' – '))}${row('Working', [r.working, r.workingOther].filter(Boolean).join(' – '))}
          ${row('Witnesses', r.witnesses.replace(/\n+/g, ', '))}
        </div></section>
        <section class="card"><h3><span class="dot">${I.text}</span>What happened</h3><div class="body-blocks">
          ${text('Task / activity', r.task)}${text('Nature of injury / illness', r.nature)}${text('How it occurred', r.how)}
          ${text('Causal factors', r.causes)}${text('Corrective actions', r.corrective)}${text('Case #s and names', r.cases)}
        </div></section>
        ${r.photos.length ? `<section class="card"><h3><span class="dot">${I.camera}</span>Photos (${r.photos.length})</h3><div class="photo-grid view">${r.photos.map((p, i) => `<a class="ph" href="${esc(p.url)}" target="_blank" rel="noopener"><img src="${esc(p.thumb)}" alt="Photo ${i + 1}"></a>`).join('')}</div></section>` : ''}
        ${r.office ? `<section class="card office-card"><h3><span class="dot">${I.badge}</span>Office only</h3><form class="incform office-form" id="officeForm">
          <div class="grid2"><div><label class="flabel">Drug test</label>${chipsRO('drug', r.drug)}</div><div><label class="flabel">Date</label><input type="date" name="drugDate" value="${esc(r.drugDate)}"></div></div>
          <div class="grid2"><div><label class="flabel">Alcohol test</label>${chipsRO('alcohol', r.alcohol)}</div><div><label class="flabel">Date</label><input type="date" name="alcoholDate" value="${esc(r.alcoholDate)}"></div></div>
          <label class="flabel">Office notes</label><textarea name="officeNotes" rows="3">${esc(r.officeNotes)}</textarea>
          <button class="btn btn-green" id="officeSave">Save</button><span class="saved" id="officeSaved" hidden>Saved</span>
          ${r.textsSent ? `<p class="textslog">${esc(r.textsSent)}</p>` : ''}
        </form></section>` : ''}
        <section class="card"><h3><span class="dot">${I.pen}</span>Sign-off</h3><div class="signs">
          ${signRow('Prepared by', r.preparedBy ? `${r.preparedBy}${r.preparedTitle ? `, ${r.preparedTitle}` : ''}` : '', r.preparedDate, r.preparedSignature, false, '')}
          ${r.reviews.map((rv) => signRow(rv.label, rv.name, rv.date, rv.signature, rv.canSign, rv.key)).join('')}
        </div></section>
      </div></div></main>${footer()}`;
    app.querySelectorAll('[data-sign]').forEach((b) => b.addEventListener('click', () => {
      const step = b.dataset.sign; const label = r.reviews.find((x) => x.key === step).label;
      signSheet(`Sign as ${label}`, async (b64) => {
        const res = await C.api(`incidents/${r.id}/review`, { method: 'POST', body: { step, signature: { contentType: 'image/png', data: b64 } } });
        render(res.report);
      });
    }));
    const of = $('#officeForm');
    if (of) {
      of.querySelectorAll('.chipset').forEach((set) => set.addEventListener('click', (e) => {
        const b = e.target.closest('.pick'); if (!b) return;
        const on = b.getAttribute('aria-pressed') !== 'true';
        set.querySelectorAll('.pick').forEach((x) => x.setAttribute('aria-pressed', String(on && x === b)));
      }));
      of.addEventListener('submit', async (e) => {
        e.preventDefault();
        const pick = (n) => of.querySelector(`.chipset[data-name=${n}] .pick[aria-pressed=true]`)?.dataset.v || '';
        const btn = $('#officeSave'); btn.disabled = true; btn.textContent = 'Saving…';
        try {
          const res = await C.api(`incidents/${r.id}/office`, { method: 'POST', body: { drug: pick('drug'), drugDate: of.drugDate.value, alcohol: pick('alcohol'), alcoholDate: of.alcoholDate.value, officeNotes: of.officeNotes.value } });
          r = res.report; btn.disabled = false; btn.textContent = 'Save'; $('#officeSaved').hidden = false; setTimeout(() => { const s = $('#officeSaved'); if (s) s.hidden = true; }, 2000);
        } catch (ex) { btn.disabled = false; btn.textContent = 'Save'; alertBox(ex.message); }
      });
    }
  }
  function chipsRO(name, val) { return `<div class="chipset" data-name="${name}">${['Yes', 'No'].map((o) => `<button type="button" class="pick" data-v="${o}" aria-pressed="${val === o}">${o}</button>`).join('')}</div>`; }
  function signRow(label, name, date, sig, canSign, key) {
    return `<div class="signrow ${name ? 'signed' : ''}">
      <div class="sl"><span class="dlabel">${esc(label)}</span>${name ? `<b>${esc(name)}</b><small>${esc(usDate(date))}</small>` : '<small class="none">Waiting</small>'}</div>
      ${sig ? `<img class="sigimg" src="${esc(sig)}" alt="Signature">` : ''}
      ${canSign ? `<button class="btn btn-green" data-sign="${key}">${C.I.pen}Sign</button>` : ''}
    </div>`;
  }
  function alertBox(msg) { const of = $('#officeForm'); let e = $('#officeErr'); if (!e) { e = document.createElement('div'); e.id = 'officeErr'; e.className = 'err'; of.appendChild(e); } e.textContent = msg; }
}

// Lyons & Hohl landing app.
// ---------------------------------------------------------------------------
// LINKS — edit these to change where the buttons go.
// ---------------------------------------------------------------------------
const LINKS = {
  timecard: 'https://lhtimecard.netlify.app/',
  vacation: 'https://lhtimecard.netlify.app/timeoff.html',
  costCodes: 'https://static1.squarespace.com/static/60084d0846d4c56a53f84f46/t/6411915e37a7cf1d94167817/1678872926395/STANDARD+SITE+COST+CODES.pdf',
  shoring: 'https://static1.squarespace.com/static/60084d0846d4c56a53f84f46/t/65d74c5e6738b00cffe11b26/1708608609311/All+Shields+-+tab+data.pdf',
  jobsiteBases: 'https://www.lyonshohl.com/s/__Jobsite-bases_10-08-26.pdf',
  equipment: 'https://lh-equipment.netlify.app/',
  pmService: 'https://lh-service.netlify.app/',
  facebook: 'https://www.facebook.com/lyonshohlsite/',
  instagram: 'https://www.instagram.com/lyons_hohl',
  tiktok: 'https://www.tiktok.com/@lyons_hohl',
  linkedin: 'https://www.linkedin.com/company/lyons-hohl',
};

// ---------------------------------------------------------------------------
const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const app = $('#app');
let me = null;
let jobsCache = null;      // { at, jobs }
let phonesCache = null;    // { at, people }
const FRESH_MS = 15 * 60000;

const I = {
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 18l-6-6 6-6"/></svg>',
  chev: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M9 6l6 6-6 6"/></svg>',
  ext: '<svg class="ext" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
  jobs: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M5 21V9l7-5 7 5v12"/><path d="M9 21v-6h6v6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 3h3.5l1.8 4.6-2.3 1.5a11 11 0 0 0 5.9 5.9l1.5-2.3L21 14.5V18a2 2 0 0 1-2 2A16 16 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>',
  text: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
  sun: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/><path d="M9 15l2 2 4-4"/></svg>',
  codes: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><rect x="9" y="2.5" width="6" height="4" rx="1"/><path d="M8 11h2M8 15h2M13 11h3M13 15h3"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 4h16v16H4z"/><path d="M4 9h16M9 9v11M15 9v11"/></svg>',
  gps: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  dozer: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="14" width="13" height="5" rx="2.5"/><path d="M5 14V9h5l2 5M10 9V6h3"/><path d="M16 12l5 1v6h-3"/></svg>',
  wrench: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.7 6.3a4 4 0 0 0 5 5l-9.4 9.4a2.1 2.1 0 0 1-3-3l9.4-9.4a4 4 0 0 0-2-2z"/><path d="M14.7 6.3l2.5-2.5a4 4 0 0 1 3 3l-2.5 2.5"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2z"/><path d="M9 4v14M15 6v14"/></svg>',
  nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11l18-8-8 18-2-8-8-2z"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg>',
  badge: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2l8 3v6c0 5-3.5 9.4-8 11-4.5-1.6-8-6-8-11V5l8-3z"/></svg>',
  flame: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4-3-6.5-4-10-2 2-3 4-3 6-1.5-1-2-2.5-2-4C7 9 5 11.5 5 15a7 7 0 0 0 7 7z"/></svg>',
  town: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 21h18M4 21V10l8-6 8 6v11M8 21v-6M12 21v-6M16 21v-6M4 10h16"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s7-6.2 7-12a7 7 0 0 0-14 0c0 5.8 7 12 7 12z"/><circle cx="12" cy="10" r="2.6"/></svg>',
  toilet: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M5 8h14M12 13v3"/></svg>',
  file: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5"/></svg>',
  person: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>',
  facebook: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M13.5 21v-7.5h2.6l.4-3h-3V8.6c0-.9.3-1.5 1.6-1.5h1.6V4.4c-.3 0-1.2-.1-2.3-.1-2.3 0-3.9 1.4-3.9 4v2.2H7.9v3h2.6V21z"/></svg>',
  instagram: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r="1" fill="currentColor" stroke="none"/></svg>',
  tiktok: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.6 3c.3 2.3 1.7 3.8 4 4v3.1c-1.5.1-2.8-.4-4-1.2v6.2c0 3.8-3.2 6-6.3 5.6-2.6-.3-4.7-2.5-4.8-5.2-.2-3.4 2.7-6.1 6.1-5.6v3.3c-1.4-.4-2.9.5-3 2-.1 1.3.9 2.4 2.2 2.4 1.4 0 2.4-1 2.4-2.5V3z"/></svg>',
  linkedin: '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M4.5 9h3v11h-3zM6 3.8a1.8 1.8 0 1 1 0 3.6 1.8 1.8 0 0 1 0-3.6zM10 9h2.9v1.5c.4-.8 1.4-1.7 3-1.7 3.1 0 3.7 2 3.7 4.7V20h-3v-5.8c0-1.4 0-3.1-1.9-3.1s-2.2 1.5-2.2 3V20h-3z"/></svg>',
};

// ------------------------------- API ---------------------------------------
async function api(path, opts = {}) {
  const res = await fetch(`/api/${path}`, {
    method: opts.method || 'GET',
    headers: opts.body ? { 'Content-Type': 'application/json' } : {},
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: 'same-origin',
  });
  let data = {};
  try { data = await res.json(); } catch { /* empty */ }
  if (res.status === 401 && path !== 'login') { me = null; jobsCache = phonesCache = null; showLogin(); throw new Error('signed-out'); }
  if (!res.ok) throw new Error(data.error || 'Something went wrong. Try again.');
  return data;
}

// ------------------------------ Opening animation ---------------------------
function playIntro() {
  const intro = $('#intro');
  let today = '';
  try { today = new Date().toDateString(); if (localStorage.getItem('lh-intro') === today) { intro.remove(); return Promise.resolve(); } } catch { /* storage off */ }
  return new Promise((resolve) => {
    const amp = $('#lh-amp');
    try {
      const len = Math.ceil(amp.getTotalLength());
      amp.style.setProperty('--len', len);
      amp.style.strokeDasharray = len;
      amp.style.strokeDashoffset = len;
    } catch { /* old browser */ }
    intro.classList.add('play');
    let finished = false;
    const finish = () => {
      if (finished) return; finished = true;
      try { localStorage.setItem('lh-intro', today); } catch { /* ignore */ }
      intro.classList.add('done');
      setTimeout(() => intro.remove(), 600);
      resolve();
    };
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    setTimeout(finish, reduce ? 900 : 3300);
    intro.addEventListener('click', finish);
  });
}

// ------------------------------- Views -------------------------------------
function bar(inner) {
  return `<header class="bar"><div class="wrap">${inner}</div></header>`;
}
function homeBar() {
  return bar(`<img class="logo" src="logo.svg" alt="Lyons &amp; Hohl Site Contractors"><span class="spacer"></span><button class="linkbtn" id="signout">Sign out</button>`);
}
function subBar(title) {
  return bar(`<button class="back" data-go="">${I.back}Home</button><span class="spacer"></span><h1>${esc(title)}</h1>`);
}

function footer() {
  const s = (k, label) => `<a href="${LINKS[k]}" target="_blank" rel="noopener" aria-label="${label}">${I[k]}</a>`;
  return `<footer><div class="wrap">
    <div class="follow">Follow Lyons &amp; Hohl</div>
    <div class="social">${s('facebook', 'Facebook')}${s('instagram', 'Instagram')}${s('tiktok', 'TikTok')}${s('linkedin', 'LinkedIn')}</div>
    <div class="fine">Pride In Our People. Pride In Our Work.</div>
  </div></footer>`;
}

function showLogin(message = '') {
  document.title = 'Lyons & Hohl';
  app.innerHTML = `<main class="login"><form class="card" id="loginForm" autocomplete="on">
      <img class="logo" src="logo.svg" alt="Lyons &amp; Hohl Site Contractors">
      <h2>Employee Sign In</h2>
      <label for="ln">Last name</label>
      <input type="text" id="ln" name="lastName" autocomplete="family-name" autocapitalize="words" required>
      <label for="pin">PIN</label>
      <input type="password" id="pin" name="pin" inputmode="numeric" pattern="[0-9]*" autocomplete="current-password" required>
      <div class="err" id="loginErr" ${message ? '' : 'hidden'}>${esc(message)}</div>
      <button class="btn btn-primary" id="loginBtn">Sign in</button>
      <p class="hint">Use the same PIN as your timecard.</p>
    </form></main>`;
  try { const last = localStorage.getItem('lh-last'); if (last) $('#ln').value = last; } catch { /* ignore */ }
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = $('#loginBtn'); const err = $('#loginErr');
    btn.disabled = true; btn.textContent = 'Signing in…'; err.hidden = true;
    try {
      const lastName = $('#ln').value.trim();
      const { person } = await api('login', { method: 'POST', body: { lastName, pin: $('#pin').value.trim() } });
      try { localStorage.setItem('lh-last', lastName); } catch { /* ignore */ }
      me = person;
      location.hash = '';
      route();
    } catch (ex) {
      err.textContent = ex.message; err.hidden = false;
      btn.disabled = false; btn.textContent = 'Sign in';
    }
  });
}

function greeting() {
  const h = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: 'America/New_York' }).format(new Date()));
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
}

function tile({ href, go, icon, title, sub, cls = '', external = false }) {
  const inner = `<span class="ic">${I[icon]}</span><span class="txt"><b>${esc(title)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span>${external ? I.ext : ''}`;
  if (go != null) return `<button class="tile ${cls}" data-go="${go}">${inner}</button>`;
  return `<a class="tile ${cls}" href="${href}" target="_blank" rel="noopener">${inner}</a>`;
}

function showHome() {
  document.title = 'Lyons & Hohl';
  const date = new Intl.DateTimeFormat('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'America/New_York' }).format(new Date());
  app.innerHTML = `${homeBar()}
    <section class="hero"><div class="wrap">
      <div class="eyebrow">${esc(date)}</div>
      <h2>${greeting()}, ${esc(me.first)}</h2>
      <p>Everything you need for the jobsite, in one place.</p>
    </div></section>
    <main><div class="wrap">
      <div class="section-title">Everyday</div>
      <div class="tiles">
        ${tile({ go: 'jobs', icon: 'jobs', title: 'Job Details', sub: 'Location, supervisor, hospital, police, fire' })}
        ${tile({ go: 'phones', icon: 'phone', title: 'Phone List', sub: 'Call or text anyone' })}
        ${tile({ href: LINKS.timecard, icon: 'clock', title: 'Timecard', sub: 'Daily hours', external: true })}
        ${tile({ href: LINKS.vacation, icon: 'sun', title: 'Vacation Request', sub: 'Ask for time off', external: true })}
      </div>
      <div class="section-title">Field Reference</div>
      <div class="tiles">
        ${tile({ href: LINKS.costCodes, icon: 'codes', title: 'Cost Codes', sub: 'Standard site cost codes', cls: 'ref', external: true })}
        ${tile({ href: LINKS.shoring, icon: 'shield', title: 'Shoring Tab Data', sub: 'All shields', cls: 'ref', external: true })}
        ${tile({ href: LINKS.jobsiteBases, icon: 'gps', title: 'Jobsite Bases', sub: 'GPS base coordinates', cls: 'ref', external: true })}
      </div>
      ${me.calendarUrl ? `<div class="section-title">Management</div>
      <div class="tiles">
        ${tile({ href: me.calendarUrl, icon: 'sun', title: 'Vacation Calendar', sub: 'Who is off, month by month', cls: 'office wide', external: true })}
      </div>` : ''}
      ${me.equipment || (me.pm && LINKS.pmService) ? `<div class="section-title">Equipment</div>
      <div class="tiles">
        ${me.equipment ? tile({ href: LINKS.equipment, icon: 'dozer', title: 'Equipment Viewer', sub: 'Where every machine is', cls: 'office wide', external: true }) : ''}
        ${me.pm && LINKS.pmService ? tile({ href: LINKS.pmService, icon: 'wrench', title: 'PM Service', sub: 'Log and look up machine services', cls: 'office wide', external: true }) : ''}
      </div>` : ''}
    </div></main>
    ${footer()}`;
  $('#signout').addEventListener('click', async () => {
    try { await api('logout', { method: 'POST' }); } catch { /* ignore */ }
    me = null; jobsCache = phonesCache = null; location.hash = ''; showLogin();
  });
}

// ---- Jobs ----
let jobFilter = 'all';
let jobQuery = '';

async function loadJobs() {
  if (jobsCache && Date.now() - jobsCache.at < FRESH_MS) return jobsCache.jobs;
  const { jobs } = await api('jobs');
  jobsCache = { at: Date.now(), jobs };
  return jobs;
}

function showJobs() {
  document.title = 'Job Details · Lyons & Hohl';
  app.innerHTML = `${subBar('Job Details')}
    <main><div class="wrap">
      <div class="tools">
        <div class="search">${I.search}<input type="search" id="q" placeholder="Search job, number, supervisor, town" value="${esc(jobQuery)}" autocomplete="off"></div>
        <div class="chips">
          <button class="chip" data-f="all" aria-pressed="${jobFilter === 'all'}">All jobs</button>
          <button class="chip" data-f="active" aria-pressed="${jobFilter === 'active'}">Active only</button>
          <span class="count" id="count"></span>
        </div>
      </div>
      <div id="jobList"><div class="loading">Loading jobs…</div></div>
    </div></main>${footer()}`;
  const draw = (jobs) => {
    const q = jobQuery.toLowerCase().trim();
    const list = jobs.filter((j) => (jobFilter === 'all' || j.active)
      && (!q || [j.name, j.number, j.supervisor, j.address, j.township].join(' ').toLowerCase().includes(q)));
    $('#count').textContent = `${list.length} job${list.length === 1 ? '' : 's'}`;
    if (!list.length) { $('#jobList').innerHTML = '<div class="empty">No jobs match that search.</div>'; return; }
    let html = ''; let year = null; let open = false;
    for (const j of list) {
      if (j.year !== year) {
        if (open) html += '</div>';
        year = j.year;
        html += `<div class="year">${year || 'Other'}</div><div class="list">`; open = true;
      }
      html += `<button class="row" data-go="job/${j.id}">
        <span class="num">${esc(j.number)}</span>
        <span class="main"><div class="title">${esc(j.name)}</div><div class="sub">${j.supervisor ? esc(j.supervisor) : 'No supervisor listed'}</div></span>
        ${j.active ? '' : '<span class="pill off">Inactive</span>'}${I.chev}</button>`;
    }
    if (open) html += '</div>';
    $('#jobList').innerHTML = html;
  };
  loadJobs().then((jobs) => {
    draw(jobs);
    $('#q').addEventListener('input', (e) => { jobQuery = e.target.value; draw(jobs); });
    app.querySelectorAll('.chip').forEach((c) => c.addEventListener('click', () => {
      jobFilter = c.dataset.f;
      app.querySelectorAll('.chip').forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
      draw(jobs);
    }));
  }).catch((e) => { if (e.message !== 'signed-out') $('#jobList').innerHTML = `<div class="err">${esc(e.message)}</div>`; });
}

const PHONE_RE = /(\+?1[\s.-]?)?\(?(\d{3})\)?[\s.-]?(\d{3})[\s.-]?(\d{4})/g;
const mapsSearch = (q) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
const mapsDir = (q) => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;

function placeQuery(text) {
  return String(text).replace(PHONE_RE, '').split(/\n|,/).map((s) => s.trim().replace(/[.,;:-]+$/, '')).filter(Boolean).join(', ');
}

function infoCard(cls, icon, title, text, { place = true } = {}) {
  if (!text) return `<section class="card ${cls}"><h3><span class="dot">${I[icon]}</span>${title}</h3><div class="body none">Not entered yet</div></section>`;
  const phones = [...new Set([...text.matchAll(PHONE_RE)].map((m) => `${m[2]}-${m[3]}-${m[4]}`))];
  const q = place ? placeQuery(text) : '';
  const links = [
    ...phones.map((p) => `<a class="btn call" href="tel:${p.replace(/-/g, '')}">${I.phone}Call ${p}</a>`),
    q ? `<a class="btn" href="${mapsDir(q)}" target="_blank" rel="noopener">${I.nav}Directions</a>` : '',
  ].join('');
  return `<section class="card ${cls}"><h3><span class="dot">${I[icon]}</span>${title}</h3>
    <div class="body">${esc(text)}</div>${links ? `<div class="links">${links}</div>` : ''}</section>`;
}

async function showJob(id) {
  app.innerHTML = `${bar(`<button class="back" data-go="jobs">${I.back}Jobs</button>`)}<main><div class="wrap"><div class="loading">Loading…</div></div></main>`;
  let jobs;
  try { jobs = await loadJobs(); } catch (e) { if (e.message !== 'signed-out') app.querySelector('main .wrap').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const j = jobs.find((x) => x.id === id);
  if (!j) { app.querySelector('main .wrap').innerHTML = '<div class="empty">That job is not in the list any more.</div>'; return; }
  document.title = `${j.name} · Lyons & Hohl`;
  const addrBtn = j.address ? `<a class="btn btn-tan" href="${mapsDir(j.address)}" target="_blank" rel="noopener">${I.nav}Directions</a>` : '';
  const locBtn = j.location ? `<a class="btn btn-light" href="${esc(j.location)}" target="_blank" rel="noopener">${I.map}Job location</a>` : '';
  app.innerHTML = `${bar(`<button class="back" data-go="jobs">${I.back}Jobs</button><span class="spacer"></span><h1>Job ${esc(j.number)}</h1>`)}
    <section class="jobhead"><div class="wrap">
      <div class="eyebrow">Job ${esc(j.number)}${j.year ? ` · ${j.year}` : ''}</div>
      <h2>${esc(j.name)}</h2>
      <div class="meta"><span>Supervisor: <b>${esc(j.supervisor || 'Not listed')}</b></span><span class="pill ${j.active ? 'on' : 'off'}">${j.active ? 'Active' : 'Inactive'}</span></div>
      ${locBtn || addrBtn ? `<div class="actions">${locBtn}${addrBtn}</div>` : ''}
    </div></section>
    <main><div class="wrap"><div class="cards">
      ${infoCard('', 'pin', 'Nearest Physical Address', j.address)}
      ${infoCard('hospital', 'plus', 'Nearest Hospital', j.hospital)}
      ${infoCard('police', 'badge', 'Nearest Police Dept', j.police)}
      ${infoCard('fire', 'flame', 'Nearest Fire Dept', j.fire)}
      ${infoCard('', 'town', 'Township', j.township)}
      ${j.toilet ? infoCard('', 'toilet', 'Portable Toilet', j.toilet, { place: false }) : ''}
      ${j.files.length ? `<section class="card"><h3><span class="dot">${I.file}</span>Job Files</h3><div class="files">${j.files.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${I.file}${esc(f.name)}</a>`).join('')}</div></section>` : ''}
    </div>
    <p class="note">In an emergency, call 911 first.</p>
    </div></main>${footer()}`;
  window.scrollTo(0, 0);
}

// ---- Phones ----
let phoneQuery = '';
function initials(name) {
  const [last, first] = String(name).split(',').map((s) => s.trim());
  return ((first || '')[0] || '') + ((last || '')[0] || '');
}
async function showPhones() {
  document.title = 'Phone List · Lyons & Hohl';
  app.innerHTML = `${subBar('Phone List')}
    <main><div class="wrap">
      <div class="tools"><div class="search">${I.search}<input type="search" id="q" placeholder="Search name or position" value="${esc(phoneQuery)}" autocomplete="off"></div></div>
      <div id="people" class="list"><div class="loading">Loading…</div></div>
    </div></main>${footer()}`;
  try {
    if (!phonesCache || Date.now() - phonesCache.at > FRESH_MS) phonesCache = { at: Date.now(), people: (await api('phones')).people };
  } catch (e) { if (e.message !== 'signed-out') $('#people').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const draw = () => {
    const q = phoneQuery.toLowerCase().trim();
    const list = phonesCache.people.filter((p) => !q || `${p.name} ${p.position}`.toLowerCase().includes(q));
    $('#people').innerHTML = list.length ? list.map((p) => {
      const digits = p.cell.replace(/[^\d+]/g, '');
      return `<div class="person"><span class="avatar">${esc(initials(p.name))}</span>
        <span class="main"><div class="title">${esc(p.name)}</div><div class="sub">${esc(p.cell)}</div>${p.position ? `<div class="pos">${esc(p.position)}</div>` : ''}</span>
        <span class="callbtns"><a class="round" href="sms:${digits}" aria-label="Text ${esc(p.name)}">${I.text}</a><a class="round call" href="tel:${digits}" aria-label="Call ${esc(p.name)}">${I.phone}</a></span></div>`;
    }).join('') : '<div class="empty">Nobody matches that search.</div>';
  };
  draw();
  $('#q').addEventListener('input', (e) => { phoneQuery = e.target.value; draw(); });
}

// ------------------------------- Router ------------------------------------
function route() {
  if (!me) return showLogin();
  const h = location.hash.replace(/^#\/?/, '');
  if (h === 'jobs') return showJobs();
  if (h.startsWith('job/')) return showJob(h.slice(4));
  if (h === 'phones') return showPhones();
  showHome();
  window.scrollTo(0, 0);
}

app.addEventListener('click', (e) => {
  const t = e.target.closest('[data-go]');
  if (!t) return;
  e.preventDefault();
  const go = t.dataset.go;
  if (`#${go}` === location.hash || (!go && !location.hash)) route();
  else location.hash = go;
});
window.addEventListener('hashchange', route);

(async function start() {
  const who = api('me').then((d) => { me = d.person; }).catch(() => { me = null; });
  await playIntro();
  await who;
  route();
})();

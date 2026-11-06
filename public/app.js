// Lyons & Hohl landing app.
import { initIncidents, showIncidents, showIncidentForm, showIncident } from './incident.js';
import { initSchedule, showSchedule, flushSchedule } from './schedule.js';
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
  // Supervisors section (Site Supervisors, Foremen, Management). Add or remove forms here.
  esReports: [
    ['Sadsbury E&S Report', 'https://form.jotform.com/252333380553150/prefill/68a867a137353566f02d11400676'],
    ['Odessa E&S Report', 'https://form.jotform.com/252333624892157/prefill/68a869eb336436cca549de1e6e4c'],
    ['Gray Farm E&S Report', 'https://form.jotform.com/251245005916047/prefill/681908d3636638e9e4369afa168f'],
    ['Brandywine Walk E&S Report', 'https://form.jotform.com/253094005738154/prefill/690cc872393162a5eba67f1fc74f'],
    ['1201 E&S Report', 'https://form.jotform.com/261863199779176/prefill/6a4b95a8373131b3feedd98e6e37'],
  ],
  facebook: 'https://www.facebook.com/lyonshohlsite/',
  instagram: 'https://www.instagram.com/lyons_hohl',
  tiktok: 'https://www.tiktok.com/@lyons_hohl',
  linkedin: 'https://www.linkedin.com/company/lyons-hohl',
};

// ---------------------------------------------------------------------------
// OUR VALUES — shown on the home screen; tap one for the details. Edit wording here.
// ---------------------------------------------------------------------------
const MISSION = 'To be the contractor our people grow with, our clients trust, and our community is better for having.';
const VALUES = [
  {
    name: 'People First', icon: 'vPeople',
    text: 'Our people come before the project. Every crew member matters, everyone goes home safe, and we build people as much as we build projects.',
    looks: ['Stop the work if something isn’t safe', 'Look out for the person next to you', 'Help a newer hand learn the job'],
  },
  {
    name: 'Built With Pride', icon: 'vPride',
    text: 'Honest, high-quality site work and paving that southeastern PA has counted on since 1978. If our name is on it, it’s done right.',
    looks: ['Do it right the first time', 'Leave the site better than you found it', 'Take care of the equipment like it’s yours'],
  },
  {
    name: 'Own It', icon: 'vOwn',
    text: 'Leadership is a behavior, not a title. If you see it, you own it — the good work and the mistakes.',
    looks: ['Speak up early when something’s wrong', 'Fix the small stuff without being asked', 'Finish what you start'],
  },
  {
    name: 'Honesty Wins', icon: 'vHonest',
    text: 'We tell the truth to our crews, our clients and each other, even when it’s hard. Clear, honest communication keeps people safe and jobs on track.',
    looks: ['Report near misses and mistakes', 'Say what you mean and keep your word', 'Give a straight answer, good news or bad'],
  },
];

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
  refresh: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 11a8 8 0 0 0-14.3-4.9L4 8"/><path d="M4 3v5h5"/><path d="M4 13a8 8 0 0 0 14.3 4.9L20 16"/><path d="M20 21v-5h-5"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>',
  pen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4H6a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2h-3"/><rect x="9" y="2.5" width="6" height="4" rx="1"/><path d="M8 13l3 3 5-6"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13 2L4 14h7l-1 8 9-12h-7l1-8z"/></svg>',
  vPeople: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.6"/><path d="M16 14.2a5 5 0 0 1 5.5 5.3"/></svg>',
  vPride: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3l2.6 5.5 6 .8-4.4 4.1 1.1 6L12 16.6 6.7 19.4l1.1-6L3.4 9.3l6-.8z"/></svg>',
  vOwn: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11V7a5 5 0 0 1 10 0"/><path d="M6.5 11h11v4a5.5 5.5 0 0 1-11 0z"/><path d="M12 14v2"/></svg>',
  vHonest: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 11l3-3a2 2 0 0 1 2.8 0L15 10l3-1 3 3-6.5 6.5a2 2 0 0 1-2.8 0L3 9l3-3z"/></svg>',
  truck: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 6h11v10H2zM13 9h4l4 4v3h-8"/><circle cx="6" cy="17.5" r="2"/><circle cx="17" cy="17.5" r="2"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 17H3v-5l2-5h11l3 5h2v5h-2"/><circle cx="7.5" cy="17" r="2"/><circle cx="16.5" cy="17" r="2"/><path d="M9.5 17h5M5 12h14"/></svg>',
  camera: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1z"/><circle cx="12" cy="13.5" r="3.5"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
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
  return `<header class="bar"><div class="wrap">${inner}<button class="refresh" data-refresh aria-label="Refresh" title="Get the latest changes">${I.refresh}</button></div></header>`;
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
    <div class="fvalues"><div class="follow">Our Mission</div><q>${esc(MISSION)}</q></div>
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
      <div class="section-title">Our Values</div>
      <div class="vgrid">${VALUES.map((v, i) => `<button class="vtile" data-value="${i}"><span class="vi">${I[v.icon]}</span><b>${esc(v.name)}</b></button>`).join('')}</div>
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
        ${tile({ go: 'vendors', icon: 'truck', title: 'Vendors', sub: 'Suppliers: call or get directions', cls: 'ref' })}
      </div>
      <div class="section-title">Safety</div>
      <div class="safety">
        <button class="alert-tile" data-go="accident"><span class="ic">${I.car}</span><span class="txt"><b>In Case of Vehicle Accident</b><small>What to do, step by step</small></span>${I.chev}</button>
        ${me.incidents?.view ? `<button class="tile safety-tile" data-go="incidents"><span class="ic">${I.report}</span><span class="txt"><b>Incident Report</b><small>${me.incidents.file ? 'Fill out a loss incident investigation report' : 'Review and sign incident reports'}</small></span>${I.chev}</button>` : ''}
      </div>
      ${me.supervisor ? `<div class="section-title">Supervisors</div>
      <details class="linklist">
        <summary class="linklist-head"><span class="ic">${I.codes}</span><span class="txt"><b>E&amp;S Reports</b><small>Pick a job · ${LINKS.esReports.length} forms</small></span>${I.chev}</summary>
        ${LINKS.esReports.map(([name, url]) => `<a class="linkrow" href="${url}" target="_blank" rel="noopener"><span>${esc(name)}</span>${I.ext}</a>`).join('')}
      </details>` : ''}
      ${me.schedule ? `<div class="section-title">Dispatch</div>
      <div class="tiles">
        ${tile({ go: 'schedule', icon: 'jobs', title: 'Daily Schedule', sub: 'Crews, equipment and trucks by job', cls: 'office wide' })}
      </div>` : ''}
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
    me = null; jobsCache = phonesCache = vendorsCache = null; location.hash = ''; showLogin();
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
      && (!q || [j.name, j.number, j.supervisor, j.address, j.township, j.utilities].join(' ').toLowerCase().includes(q)));
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

// Utility Emergency Contacts: one call button per number, named from its line
// ("PECO Gas: 800-841-4141" -> "Call PECO Gas").
function utilityCard(text) {
  const title = 'Utility Emergency Contacts';
  if (!text) return `<section class="card utility"><h3><span class="dot">${I.bolt}</span>${title}</h3><div class="body none">Not entered yet</div></section>`;
  const buttons = [];
  for (const line of text.split('\n')) {
    for (const m of line.matchAll(PHONE_RE)) {
      const num = `${m[2]}-${m[3]}-${m[4]}`;
      const label = line.slice(0, m.index).replace(/[\s:|–—-]+$/, '').trim() || line.replace(m[0], '').replace(/^[\s:|–—-]+|[\s:|–—-]+$/g, '').trim();
      buttons.push(`<a class="btn call" href="tel:${num.replace(/-/g, '')}">${I.phone}<span>${label ? `Call ${esc(label)}` : 'Call'}<small>${num}</small></span></a>`);
    }
  }
  return `<section class="card utility"><h3><span class="dot">${I.bolt}</span>${title}</h3>
    <div class="body">${esc(text)}</div>${buttons.length ? `<div class="links ulinks">${buttons.join('')}</div>` : ''}</section>`;
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
      ${utilityCard(j.utilities)}
      ${infoCard('', 'town', 'Township', j.township)}
      ${j.toilet ? infoCard('', 'toilet', 'Portable Toilet', j.toilet, { place: false }) : ''}
      ${j.files.length ? `<section class="card"><h3><span class="dot">${I.file}</span>Job Files</h3><div class="files">${j.files.map((f) => `<a href="${esc(f.url)}" target="_blank" rel="noopener">${I.file}${esc(f.name)}</a>`).join('')}</div></section>` : ''}
    </div>
    <p class="note">In an emergency, call 911 first.</p>
    </div></main>${footer()}`;
  window.scrollTo(0, 0);
}

// ---- Vehicle accident ----
const ACCIDENT = {
  contacts: [
    { group: 'Lyons & Hohl (LH)', people: [['Bob', '610-636-7289'], ['James', '610-858-4549']] },
    { group: 'Lyons & Hohl Paving (LHP)', people: [['Tim', '610-636-7126'], ['Erick', '610-636-7131']] },
    { group: 'LH & LHP', people: [['Patti', '484-986-8153']] },
  ],
  pinkFormText: '484-986-8153',
  photos: [
    ['Other driver’s ID', ''],
    ['Their insurance card', ''],
    ['Their license plate', ''],
    ['Their VIN', 'On the dashboard by the windshield, or the driver’s door frame'],
    ['Both vehicles', 'Show the damage and where the vehicles ended up'],
    ['The intersection or road', 'Street signs and surroundings that show where it happened'],
  ],
};
let photoChecks = new Set();

function showAccident() {
  document.title = 'Vehicle Accident · Lyons & Hohl';
  const tel = (n) => n.replace(/\D/g, '');
  const callBtn = (name, num) => `<a class="btn call" href="tel:${tel(num)}">${I.phone}<span>Call ${esc(name)}<small>${esc(num)}</small></span></a>`;
  const step = (n, title, body) => `<li class="step"><span class="stepnum">${n}</span><div class="stepbody"><h3>${title}</h3>${body}</div></li>`;
  app.innerHTML = `${subBar('Accident')}
    <section class="acc-head"><div class="wrap">
      <div class="eyebrow">In case of vehicle accident</div>
      <h2>Stay calm. Work through these steps.</h2>
      <button class="btn btn-911" data-911>${I.phone}Anyone hurt? Call 911</button>
    </div></section>
    <main><div class="wrap"><ol class="steps">
      ${step(1, 'Check yourself', '<p>Are you okay? Check your passengers too.</p>')}
      ${step(2, 'Check the other driver', '<p>Are they okay? Check their passengers too.</p>')}
      ${step(3, 'Call for help', `<div class="split">
          <div class="opt bad"><b>Any injuries</b><p>Call 911 immediately.</p><button class="btn btn-red" data-911>${I.phone}Call 911</button></div>
          <div class="opt"><b>No visible injuries</b><p>Call the local police to the scene and <strong>get an incident / case number</strong>.</p></div>
        </div>`)}
      ${step(4, 'Take pictures', `<p>Tap each one as you get it.</p><div class="checks">${ACCIDENT.photos.map(([t, d], i) => `
          <button class="checkrow" data-photo="${i}" aria-pressed="${photoChecks.has(i)}"><span class="box">${I.check}</span><span><b>${esc(t)}</b>${d ? `<small>${esc(d)}</small>` : ''}</span></button>`).join('')}</div>`)}
      ${step(5, 'Call one of these people', ACCIDENT.contacts.map((g) => `<div class="cgroup"><div class="cgname">${esc(g.group)}</div><div class="cbtns">${g.people.map(([n, num]) => callBtn(n, num)).join('')}</div></div>`).join(''))}
      ${step(6, 'Fill out the Pink Form', `<p>Write up the incident on the <strong>Pink Form</strong> as soon as you can.</p>
          <ul class="ticks"><li><strong>Text a picture</strong> of it to ${esc(ACCIDENT.pinkFormText)}</li><li>Turn the <strong>original</strong> in to the main office</li></ul>
          <a class="btn btn-green" href="sms:${tel(ACCIDENT.pinkFormText)}">${I.camera}Text a photo of the Pink Form</a>`)}
      ${step(7, 'Incident report', me.incidents?.file
        ? `<p>Supervisors, foremen and management: fill out the online incident report. You can add the photos you just took.</p><button class="btn btn-red" data-go="incident-new/auto">${I.report}Start an incident report</button>`
        : '<p>Let your supervisor or foreman know so they can fill out the incident report.</p>')}
    </ol></div></main>${footer()}`;
  app.querySelectorAll('.checkrow').forEach((b) => b.addEventListener('click', () => {
    const i = Number(b.dataset.photo);
    if (photoChecks.has(i)) photoChecks.delete(i); else photoChecks.add(i);
    b.setAttribute('aria-pressed', String(photoChecks.has(i)));
  }));
  window.scrollTo(0, 0);
}

// ---- Vendors ----
let vendorsCache = null;
let vendorQuery = '';
let vendorType = '';
async function showVendors() {
  document.title = 'Vendors · Lyons & Hohl';
  app.innerHTML = `${subBar('Vendors')}
    <main><div class="wrap">
      <div class="tools"><div class="search">${I.search}<input type="search" id="q" placeholder="Search name, town or what they sell" value="${esc(vendorQuery)}" autocomplete="off"></div>
        <div class="chips typechips" id="typeChips"></div></div>
      <div id="vendorList"><div class="loading">Loading…</div></div>
    </div></main>${footer()}`;
  try {
    if (!vendorsCache || Date.now() - vendorsCache.at > FRESH_MS) vendorsCache = { at: Date.now(), list: (await api('vendors')).vendors };
  } catch (e) { if (e.message !== 'signed-out') $('#vendorList').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  const types = [...new Set(vendorsCache.list.map((v) => v.type))];
  const drawChips = () => {
    $('#typeChips').innerHTML = [['', 'All'], ...types.map((t) => [t, t])].map(([t, label]) => `<button class="chip" data-type="${esc(t)}" aria-pressed="${vendorType === t}">${esc(label)}</button>`).join('');
  };
  const draw = () => {
    const q = vendorQuery.toLowerCase().trim();
    const list = vendorsCache.list.filter((v) => (!vendorType || v.type === vendorType) && (!q || `${v.name} ${v.address} ${v.type}`.toLowerCase().includes(q)));
    if (!list.length) { $('#vendorList').innerHTML = '<div class="empty">No vendors match that search.</div>'; return; }
    let html = ''; let type = null;
    for (const v of list) {
      if (v.type !== type) { if (type !== null) html += '</div>'; type = v.type; html += `<div class="year">${esc(type)}</div><div class="list">`; }
      const tel = v.phone.replace(/[^\d+]/g, '');
      html += `<div class="vendor"><div class="main"><div class="title">${esc(v.name)}</div>${v.address ? `<div class="sub">${esc(v.address)}</div>` : ''}${v.phone ? `<div class="sub">${esc(v.phone)}</div>` : ''}</div>
        <span class="callbtns">${v.address ? `<a class="round" href="${mapsDir(v.address)}" target="_blank" rel="noopener" aria-label="Directions to ${esc(v.name)}">${I.nav}</a>` : ''}${tel ? `<a class="round call" href="tel:${tel}" aria-label="Call ${esc(v.name)}">${I.phone}</a>` : ''}</span></div>`;
    }
    $('#vendorList').innerHTML = `${html}</div>`;
  };
  drawChips(); draw();
  $('#q').addEventListener('input', (e) => { vendorQuery = e.target.value; draw(); });
  $('#typeChips').addEventListener('click', (e) => {
    const c = e.target.closest('[data-type]'); if (!c) return;
    vendorType = c.dataset.type; drawChips(); draw();
  });
}

// ---- Phones ----
const fmtDate = (iso) => {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
};
function yearsSince(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const now = new Date();
  let yrs = now.getFullYear() - y;
  if (now.getMonth() + 1 < m || (now.getMonth() + 1 === m && now.getDate() < d)) yrs -= 1;
  return yrs < 1 ? 'less than a year' : `${yrs} year${yrs === 1 ? '' : 's'}`;
}
function daysUntil(iso) {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number);
  const t = new Date(); const today = Date.UTC(t.getFullYear(), t.getMonth(), t.getDate());
  return Math.round((Date.UTC(y, m - 1, d) - today) / 86400000);
}
function yesNo(v) {
  if (/^yes$/i.test(v)) return '<span class="pill on">Yes</span>';
  if (/^no$/i.test(v)) return '<span class="pill bad">No</span>';
  return '<span class="none">Not entered</span>';
}
function detailsHtml(d) {
  const row = (label, value) => `<div class="drow"><span class="dlabel">${label}</span><span class="dval">${value}</span></div>`;
  let med = yesNo(d.medical);
  if (d.medExp) {
    const left = daysUntil(d.medExp);
    const cls = left < 0 ? 'bad' : left <= 30 ? 'warn' : 'muted';
    med += ` <span class="exp ${cls}">${left < 0 ? 'Expired' : 'Expires'} ${esc(fmtDate(d.medExp))}</span>`;
  }
  const addr = [d.address, d.cityStateZip].filter(Boolean).join(', ');
  return `<div class="details">
    ${row('Start date', d.hireDate ? `${esc(fmtDate(d.hireDate))} <span class="muted">· ${yearsSince(d.hireDate)}</span>` : '<span class="none">Not entered</span>')}
    ${row('Driving list', yesNo(d.driving))}
    ${row('Medical card', med)}
    ${d.endorsements.length ? row('License', esc(d.endorsements.join(', '))) : ''}
    ${row('Home address', addr ? `${esc(d.address)}${d.address && d.cityStateZip ? '<br>' : ''}${esc(d.cityStateZip)}<br><a class="maplink" href="${mapsDir(addr)}" target="_blank" rel="noopener">${I.nav}Directions</a>` : '<span class="none">Not entered</span>')}
  </div>`;
}
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
    if (!phonesCache || Date.now() - phonesCache.at > FRESH_MS) { const d = await api('phones'); phonesCache = { at: Date.now(), people: d.people, company: d.company || [] }; }
  } catch (e) { if (e.message !== 'signed-out') $('#people').innerHTML = `<div class="err">${esc(e.message)}</div>`; return; }
  let openName = null;
  const draw = () => {
    const q = phoneQuery.toLowerCase().trim();
    const list = phonesCache.people.filter((p) => !q || `${p.name} ${p.position}`.toLowerCase().includes(q));
    const company = phonesCache.company.filter((c) => !q || c.name.toLowerCase().includes(q));
    const top = company.map((c) => {
      const digits = c.cell.replace(/[^\d+]/g, '');
      return `<div class="person company"><span class="avatar">${I.jobs}</span>
        <span class="main"><div class="title">${esc(c.name)}</div><div class="sub">${esc(c.cell)}</div></span>
        <span class="callbtns">${c.text === false ? '' : `<a class="round" href="sms:${digits}" aria-label="Text ${esc(c.name)}">${I.text}</a>`}<a class="round call" href="tel:${digits}" aria-label="Call ${esc(c.name)}">${I.phone}</a></span></div>`;
    }).join('');
    $('#people').innerHTML = top + (list.length ? list.map((p, i) => {
      const digits = (p.cell || '').replace(/[^\d+]/g, '');
      const btns = digits ? `<span class="callbtns"><a class="round" href="sms:${digits}" aria-label="Text ${esc(p.name)}">${I.text}</a><a class="round call" href="tel:${digits}" aria-label="Call ${esc(p.name)}">${I.phone}</a></span>` : '';
      const info = `<span class="avatar">${esc(initials(p.name))}</span>
        <span class="main"><div class="title">${esc(p.name)}</div><div class="sub">${esc(p.cell || 'No cell phone listed')}</div>${p.position ? `<div class="pos">${esc(p.position)}</div>` : ''}</span>`;
      if (!p.details) return `<div class="person">${info}${btns}</div>`;
      const open = openName === p.name;
      return `<div class="person-wrap${open ? ' open' : ''}"><div class="person">
          <button class="person-tap" data-i="${i}" aria-expanded="${open}">${info}${I.chev}</button>${btns}</div>
          ${open ? detailsHtml(p.details) : ''}</div>`;
    }).join('') : (top ? '' : '<div class="empty">Nobody matches that search.</div>'));
    $('#people').querySelectorAll('.person-tap').forEach((b) => b.addEventListener('click', () => {
      const name = list[Number(b.dataset.i)].name;
      openName = openName === name ? null : name;
      draw();
    }));
  };
  draw();
  $('#q').addEventListener('input', (e) => { phoneQuery = e.target.value; draw(); });
}

initIncidents({ app, api, esc, I, bar, footer, me: () => me, loadJobs });
initSchedule({ app, api, esc, I, me: () => me, LINKS });

// ------------------------------- Router ------------------------------------
function route() {
  if (!me) return showLogin();
  const h = location.hash.replace(/^#\/?/, '');
  const sched = h === 'schedule' || h.startsWith('schedule/');
  document.body.classList.toggle('sched-on', sched);
  if (sched) return showSchedule(h.split('/')[1]);
  flushSchedule();   // save any change still waiting when leaving the schedule
  if (h === 'jobs') return showJobs();
  if (h.startsWith('job/')) return showJob(h.slice(4));
  if (h === 'phones') return showPhones();
  if (h === 'vendors') return showVendors();
  if (h === 'accident') return showAccident();
  if (h === 'incidents') return showIncidents();
  if (h.startsWith('incident-new')) return showIncidentForm(h.split('/')[1] || '');
  if (h.startsWith('incident/')) return showIncident(h.slice(9));
  showHome();
  window.scrollTo(0, 0);
}

// ---- one value, in a sheet that slides up (swipe through with the arrows) ----
function showValue(i) {
  document.querySelector('.sheet-back.value-back')?.remove();
  const v = VALUES[i];
  const back = document.createElement('div');
  back.className = 'sheet-back value-back';
  back.innerHTML = `<div class="sheet value-sheet" role="dialog" aria-modal="true" aria-labelledby="vTitle">
      <div class="vs-top"><span class="vs-ic">${I[v.icon]}</span><div><div class="eyebrow">Our values · ${i + 1} of ${VALUES.length}</div><h2 id="vTitle">${esc(v.name)}</h2></div></div>
      <p class="vs-text">${esc(v.text)}</p>
      <div class="vs-looks"><div class="dlabel">What it looks like on the job</div><ul>${v.looks.map((l) => `<li>${esc(l)}</li>`).join('')}</ul></div>
      <div class="vs-nav">
        <button class="btn btn-cancel" data-vgo="${(i + VALUES.length - 1) % VALUES.length}" aria-label="Previous value">${I.back}</button>
        <div class="vs-dots">${VALUES.map((_, k) => `<i class="${k === i ? 'on' : ''}"></i>`).join('')}</div>
        <button class="btn btn-cancel" data-vgo="${(i + 1) % VALUES.length}" aria-label="Next value"><span class="flip">${I.back}</span></button>
      </div>
      <button class="btn btn-green vs-close">Close</button>
    </div>`;
  back.addEventListener('click', (e) => {
    const go = e.target.closest('[data-vgo]');
    if (go) { showValue(Number(go.dataset.vgo)); return; }
    if (e.target === back || e.target.closest('.vs-close')) back.remove();
  });
  document.body.appendChild(back);
}

// ---- 911: always ask first, so nobody calls by accident ----
function confirm911() {
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="s911">
      <div class="sheet-ic">${I.phone}</div>
      <h2 id="s911">Call 911?</h2>
      <p>Only for an emergency or if anyone is hurt.</p>
      <a class="btn btn-red" href="tel:911" id="yes911">Yes, call 911</a>
      <button class="btn btn-cancel" id="no911">Cancel</button>
    </div>`;
  const close = () => back.remove();
  back.addEventListener('click', (e) => { if (e.target === back || e.target.id === 'no911') close(); });
  back.querySelector('#yes911').addEventListener('click', () => setTimeout(close, 300));
  document.body.appendChild(back);
  back.querySelector('#no911').focus();
}

// ---- Refresh: get the latest from Airtable (and the newest version of the app) without signing out ----
async function refreshNow(btn) {
  btn.classList.add('spin'); btn.disabled = true;
  try { await fetch('/api/me?fresh=1', { credentials: 'same-origin', cache: 'no-store' }); } catch { /* offline: reload anyway */ }
  location.reload();
}

app.addEventListener('click', (e) => {
  const r = e.target.closest('[data-refresh]');
  if (r) { e.preventDefault(); refreshNow(r); return; }
  const v = e.target.closest('[data-value]');
  if (v) { e.preventDefault(); showValue(Number(v.dataset.value)); return; }
  const n = e.target.closest('[data-911]');
  if (n) { e.preventDefault(); confirm911(); return; }
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

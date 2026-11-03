# Lyons & Hohl App

The company landing page: one place for crews to find job details, the phone
list, their timecard, vacation requests, the cost codes, shoring tab data and
jobsite base coordinates. It opens with the animated Lyons & Hohl logo (once a
day; tap to skip). It reads the **Emloyees** and **Job Name List** Airtable
bases and never changes them. It runs on Netlify, like the other apps.

- Sign in: **last name + Timecard Pin** (the same PIN as the timecard app)
- Who can sign in: every **Current Employee** whose Location is **SIte Contractors** and who has a Timecard Pin, plus anyone listed in `extraPeople` in `lib/config.mjs` (currently Tyler Enck)
- **Equipment Viewer** button: only for positions Management, Office, Superviser / SUP, Foreman and Shop
- **PM Service** button: only for position Shop
- **Vacation Calendar** button: only for position Management (see step 3)
- **Employee details in the phone list** (start date, driving list, medical card + expiration, license endorsements, home address): only Management and Superviser / SUP. Tap a name to open them. Other people's phones never receive this information.
- **Phone list:** Site Office and HR Cell are pinned at the top (`phoneListCompany` in `lib/config.mjs`); people listed in `phoneListHide` are left off the list but can still sign in
- **In Case of Vehicle Accident** (red button on the home screen): step-by-step page. Names, numbers and the photo list are in `ACCIDENT` in `public/app.js`
- **911** buttons never dial straight away: they open a "Call 911?" confirmation first
- **Supervisors** section (Superviser / SUP, Foreman, Management): E&S report forms (JotForm). Edit the list in `esReports` at the top of `public/app.js`
- **Our Values** (home screen; tap one for details) and the **mission** in the footer: edit `VALUES` and `MISSION` at the top of `public/app.js`
- People with the same last name (the Smokers) each sign in with their own PIN

---

## 1. Create an Airtable access token

1. Go to <https://airtable.com/create/tokens> and click **Create new token**.
2. Name it `L&H App`.
3. **Scopes:** add `data.records:read` and `data.records:write`.
4. **Access:** add these three bases: **Emloyees**, **Job Name List** and **Safety**.
   The app only ever writes to the **Safety** base (incident reports); it only reads the other two.
5. Click **Create token** and copy it. You'll paste it into Netlify in step 3.
   Don't email it or paste it anywhere else.

## 2. Put the site on Netlify

1. In Netlify: **Add new site → Import an existing project → GitHub**, pick `lh-app`.
2. Leave the build settings as they are (they come from `netlify.toml`) and click **Deploy**.

## 3. Add the two secrets in Netlify

**Site configuration → Environment variables → Add a variable**:

| Key | Value |
|---|---|
| `AIRTABLE_TOKEN` | the token from step 1 |
| `SESSION_SECRET` | any long random text, at least 24 characters (use a password generator) |
| `TEXTMAGIC_USERNAME` | same as the timecard app: your TextMagic username (for incident report texts) |
| `TEXTMAGIC_API_KEY` | same as the timecard app (TextMagic → Settings → API) |
| `VACATION_CALENDAR_URL` | the vacation calendar share link from the timecard app (office page → **Vacation calendar** → **Share link** → **Copy**). Optional: without it, the button doesn't show. |

The calendar link is kept here, not in the code, because anyone with it can see the calendar.

Then **Deploys → Trigger deploy → Deploy site** so the app picks them up.

## 4. Web address

Netlify gives the site an address like `random-name-123.netlify.app`. To change it:
**Site configuration → Site details → Change site name** (for example `lhapp` →
`lhapp.netlify.app`).

For your own address (for example `app.lyonshohl.com`): in Netlify, **Domain
management → Add a domain**, then in Squarespace **Settings → Domains →
lyonshohl.com → DNS → Add record**: type **CNAME**, host `app`, data = the
Netlify address. It can take a few hours to start working.

## Putting it on phones

Open the address in Safari (iPhone) or Chrome (Android) and choose
**Share → Add to Home Screen** (iPhone) or **⋮ → Add to Home screen** (Android).
It opens full-screen with the L&H icon.

## Changing things

- **Buttons and links** (cost codes, shoring, jobsite bases, timecard, social
  pages): edit the `LINKS` list at the top of `public/app.js`. When you upload a
  new Jobsite Bases PDF with a new file name, update `jobsiteBases` there.
- **Who sees Equipment Viewer:** `equipmentPositions` in `lib/config.mjs`.
- **Job order:** newest year first; inside a year, highest last-three-digits first,
  then that year's `000 X__` jobs. Rows whose Number isn't a number (VACATION,
  SHOP TIME, ABSENT, …) are hidden. See `lib/jobs.mjs`.
- Airtable changes show in the app within about 5 minutes, or right away when someone taps the **refresh** button (top right). Refresh also loads the newest version of the app; nobody has to sign out.

## Signing people out

- Changing someone's Timecard Pin, or marking them Past Employee, signs them out.
- Changing `SESSION_SECRET` in Netlify (then redeploying) signs everyone out.

## Local preview

`npm run dev`, then open <http://localhost:8899>. It uses made-up data; sign in
as `Walker` / `1234`. `npm test` runs the checks.

## Incident reports (Safety → Incident Report)

The paper *Lyons Hohl Loss Incident Investigation Report* as a 6-step form on the phone,
with photos and a finger signature. Saved in the **Safety** base → **Incident Reports**.

- **Who fills it out:** Superviser / SUP, Foreman, Management. Also reachable from step 7
  of the vehicle accident page (Automobile is pre-picked).
- **Who sees reports:** Management and supervisors see all; foremen see the ones they filed;
  James Woodard and Lisamarie Grafstrom see all.
- **Saved on the phone as they go** (including photos) — a dropped signal doesn't lose anything;
  "Try again" picks up where it stopped.
- **When sent:** texts with a link go to Bob Arment, James Woodard and the HR cell (TextMagic),
  and Airtable emails jamesw@ and pattim@ (automation **Email: new incident report** in the
  Safety base — it must be turned on in Airtable).
- **Sign-off:** Supervisor (any Superviser / SUP / Management), Safety Coordinator (James Woodard),
  Safety Committee (Lisamarie Grafstrom). When all three sign, the status becomes **Closed**.
- **Office only:** Drug test, Alcohol test and Office Notes (Management, James, Lisa).
- **Download PDF** on any report: laid out like the paper form, signatures included, photos on extra pages.
- Settings (who files / reviews / gets texts): `SAFETY` in `lib/config.mjs`.

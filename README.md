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
- People with the same last name (the Smokers) each sign in with their own PIN

---

## 1. Create an Airtable access token

1. Go to <https://airtable.com/create/tokens> and click **Create new token**.
2. Name it `L&H App`.
3. **Scopes:** add only `data.records:read`.
4. **Access:** add these two bases: **Emloyees** and **Job Name List**.
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
- Airtable changes show in the app within about 5 minutes.

## Signing people out

- Changing someone's Timecard Pin, or marking them Past Employee, signs them out.
- Changing `SESSION_SECRET` in Netlify (then redeploying) signs everyone out.

## Local preview

`npm run dev`, then open <http://localhost:8899>. It uses made-up data; sign in
as `Walker` / `1234`. `npm test` runs the checks.

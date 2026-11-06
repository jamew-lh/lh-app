# Notes for Claude — Lyons & Hohl App (lh-app)

The README explains what the app does and how it's set up. These notes are for working on the code.

## How James works with this repo

- James is not a developer. Explain in plain words, keep answers short, and say what changed and what is left.
- **`main` is live.** Netlify deploys `main` to lyonshohl.netlify.app and crews use it every day.
  Never commit straight to `main`.

### Publishing a change (Claude does it; James only says "go live")

1. `git fetch` and start a new branch from `origin/main` (James may also edit through other Claude chats or GitHub).
2. Make the change, run `npm test`, and try it in the local preview.
3. Commit, push the branch, open a pull request (`gh pr create`), and give James the Netlify Deploy Preview link
   (`https://deploy-preview-<PR number>--lyonshohl.netlify.app`). It uses real Airtable data and real TextMagic,
   so warn him that texts sent from the preview really go out.
4. **Merge only when James says "go live"** (`gh pr merge <n> --merge --delete-branch`), after the Netlify check is green.

Tools on James's Mac (Apple silicon, no Homebrew):
- **GitHub CLI (`gh`)** is signed in as `jamew-lh` (token in the macOS keychain, done Nov 6 2026), but the `gh` program
  itself is not installed. Download the official macOS arm64 zip from github.com/cli/cli/releases into the session's
  temporary folder, check it against the release's checksums file, and run it from there. No new sign-in needed.
- Don't change git's global settings (GitHub Desktop shares them). Push with a one-off credential helper:
  `git -c credential.helper= -c credential.helper="!<path to gh> auth git-credential" push -u origin <branch>`
- **Node.js** isn't installed either. With James's OK, download the official LTS from nodejs.org into the temporary
  folder (check SHASUMS256) and use it from there; `npm ci --ignore-scripts` installs the one dependency.
- James can still use **GitHub Desktop** himself (Fetch origin before work, Push origin after).
- Checks: `npm test` (fake Airtable, no network). Local preview: `npm run dev` → http://localhost:8899
  (`Walker`/`1234` office, `Rivera`/`4321` operator, `Woodard`/`6060` schedule editor; all made-up data).
- Airtable IDs (not names) live in `lib/config.mjs`. Secrets (Airtable token, TextMagic keys, session secret) live only in Netlify.

## Daily Schedule (built Nov 2026, branch `feature/daily-schedule`)

Replaces the Excel daily crew sheet (OneDrive → Dispatch - Documents → General → Daily Crew Sheets).

Files: `lib/schedule.mjs` (server), `public/schedule.js` (board), `public/schedule-view.js` (finished day for
email / print / shared page), `public/day.html` + `day.js` (no-sign-in page), `public/schedule.css`,
`test/schedule.test.mjs`. Settings: `SCHEDULE` in `lib/config.mjs`.

Decisions James made (keep them unless he changes them):

| Topic | Decision |
|---|---|
| Editors | **Schedule Editor** checkbox in the Employee List (James Woodard, Bob (Leon) Arment, Mike Hohl, Mike Wallace). Others may cover when James is on vacation. |
| First day | Start clean: jobs + equipment from the equipment app, no people. Never import the Excel sheet. Later days copy the last saved day. |
| People | **Include on Schedule** checkbox; display **Schedule Name**. Rushane Davis-Morgan is intentionally off. |
| Vacations | Timecard app → Scheduled Time Off. Approved/blank = off (removed on copy-forward); Requested = heads-up only; Denied = ignored; Hours per Day < 8 = part day. |
| Hired trucks | Vendors → Hired Trucks (quarries included). Count, type, material, from/to, time, note per job. **No texts to haulers.** |
| Equipment moves | The equipment app is the source of truth for where machines are. Its Change Log "Location" entries are applied to **today and later** days when they open (`board.eqSyncAt` remembers the last one applied; past days are left alone). That day's Moves table entries are applied when a day is created. The board does **not** write Moves (not asked for yet). |
| Equipment moves on the sheet | Equipment-app Moves for the day show under Drivers / Moves on email/print/link, matched to drivers by name (Move "Driver" vs Schedule Name, letters only). Drivers' texts list their moves; moves count like a job note for the txt flag. |
| Material / other moves | Saved with the day only. No table, no tracking — James said there's no benefit. |
| Crew texts | Flag anyone whose spot, note or job note changed since the last saved day. Send via TextMagic contact (TextMagic Contact ID), fall back to Cell Phone. |
| Email | Copy-and-paste into Outlook. **No Microsoft 365 connection.** |
| Shared link | No sign-in, **expires 4 days after the first publish**; re-publish keeps the link. Texted to employees with **Daily Schedule** checked — to **Schedule Link Phone** when filled in (link texts only), else TextMagic contact / Cell Phone. No phone numbers on it. |
| Look | LH App colors/fonts; full-width board; top bar links to the other apps. In job cards: Crew, then Hired trucks, then Equipment. |
| Landscaping Crew | Permanent crew (`LANDSCAPE`), top of the right side. Works like a job (crew, machines, note, texts) but has no Job Name List record. |
| Clicking a name | Editor has "Where … works" to move them anywhere, including a job not on the day yet (adds it). |
| Back burner | Comparing the schedule with timecard entries. Don't build unless asked. |

Board model (one JSON per day in Daily Schedules → Schedule Days, `Version` stops two editors overwriting each other):
`jobs`, `people {loc: [{id, role, machine, note}]}` (loc = job record ID | LANDSCAPE | OFF | SHOP | DRIVERS),
`equip {loc: [equipment record ID]}` (not listed = Yard; LANDSCAPE; REPAIR), `jobNotes`, `haul`, `moves`, `sent`.
An operator's machine stays in the job's `equip` list; the person only points to it.

Drag and drop uses pointer events (works on touch), not HTML5 drag-and-drop.

Open items when this was built: "Billy M." from the old sheet matches no employee; Tyler Enck has no TextMagic contact;
Hired Trucks rows have no contact info (not needed).

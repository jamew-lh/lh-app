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

## Equipment Tracker button (Nov 2026)

- Shown only to people whose **Equipment Tracker** field (Employee List, single select) is filled in:
  View Only / Driver User / Full Edit. No position rule (James, Nov 17 2026). `EQUIPMENT_APP` in `lib/config.mjs`.
- The button goes to `/api/go/equipment`, which redirects to `https://lh-equipment.netlify.app/api/sso?t=<pass>`.
  The pass (`lib/equipment-pass.mjs`) carries record id, name (Schedule Name, else "First Last"), level `v|d|o`
  and driver name, expires in 2 minutes, and is signed with `LH_HANDOFF_SECRET` (same value on both Netlify sites).
  The equipment app (`jamew-lh/equipment-viewer`) checks it; Driver User can mark done only moves where they're the driver.

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
| People | **Include on Schedule** checkbox; display **Schedule Name**. Rushane Davis-Morgan is intentionally off. Anyone made Past Employee or unchecked comes off today and later days automatically (past days untouched). |
| Vacations | Timecard app → Scheduled Time Off. Approved/blank = off (removed on copy-forward); Requested = heads-up only; Denied = ignored; Hours per Day < 8 = part day. |
| Hired trucks | Vendors → Hired Trucks (quarries included). Count, type, material, from/to, time, note per job. **No texts to haulers.** |
| Equipment moves | The equipment app is the source of truth for where machines are. Its Change Log "Location" entries are applied to **today and later** days when they open (`board.eqSyncAt` remembers the last one applied; past days are left alone). That day's Moves table entries are applied when a day is created. The board does **not** write Moves (not asked for yet). |
| Equipment moves on the sheet | Equipment-app Moves for the day show under Drivers / Moves on email/print/link, matched to drivers by name (Move "Driver" vs Schedule Name, letters only). Drivers' texts list their moves; moves count like a job note for the txt flag. Listed in the equipment app's "Scheduled and needed" order (its Arrange order number, Moves field `order`); unnumbered moves last. |
| Material / other moves | Saved with the day only. No table, no tracking — James said there's no benefit. ▲ ▼ buttons set the order; email/print/link follow it. |
| Crew text wording | Date, job (number), address (no map link — keeps texts short), foreman, "Planned machine: X. Check with your foreman." (foremen just "Planned machine: X."), job note, personal note. |
| Crew texts | Flag anyone whose spot, note or job note changed since the last saved day. Send via TextMagic contact (TextMagic Contact ID), fall back to Cell Phone. |
| Email | Copy-and-paste into Outlook. **No Microsoft 365 connection.** |
| Shared link | No sign-in, **expires 4 days after the first publish**; re-publish keeps the link. Texted to employees with **Daily Schedule** checked — to **Schedule Link Phone** when filled in (link texts only), else TextMagic contact / Cell Phone. No phone numbers on it. |
| Look | LH App colors/fonts; full-width board; top bar links to the other apps. In job cards: Crew, then Hired trucks, then Equipment. |
| Landscaping Crew | Permanent crew (`LANDSCAPE`), top of the right side. Works like a job (crew, machines, note, texts) but has no Job Name List record. |
| Clicking a name | Editor has "Where … works" to move them anywhere, including a job not on the day yet (adds it). |
| Saturdays | Smaller crew. A new Saturday (or Sunday) keeps jobs and machines from the last weekday but starts with empty crews, no notes, no hired trucks, no material moves. Everyone placed is flagged for a text. Weekdays always copy the last **weekday** (Monday copies Friday). Link goes to the usual Daily Schedule list. "Sat" button next to ◀ ▶: Tue–Fri jumps ahead to the coming Saturday; on Monday it reads "◀ Sat" and goes back to the Saturday before (◀ ▶ themselves skip weekends). |
| Equipment order | Unused equipment (job cards, Landscaping, Repair, Yard, machine picker, email/print/link) is sorted by Type: Excavator, Dozer, Articulating Truck, Roller, Rubber Tire Loader, Backhoe, Skid Loader, Track Loader, Slinger, Tractor, Plow Disk, Scraper, Sweeper, Attachment, Trench Box, Manhole Box, Stone Box, Shoring, Strawblower, Rental, Zipper, Bucket; other types A–Z; no type last. `TYPE_ORDER` in `schedule-view.js`. |
| Subcontractors | Vendors → Sub-Contractors (Name). Drag onto a job like hired trucks; each line is sub + note. Board key `subs {jobId: [{id, sub, note}]}`. Job card order: Crew, Hired trucks, Subcontractors, Equipment (same on email/print/link). No texts to subs. Carry over on weekdays; Saturdays start empty. |
| Empty jobs | Jobs with nobody on the crew fold to one line (name, number, counts of equipment / truck lines / subs, warnings). Click to open; drop people, machines, haulers or subs straight onto a folded card. "Show N empty jobs" / "Fold empty jobs" by the Jobs heading, remembered per browser (`lh-sched-fold`). Search lights up a folded job when a hidden machine, hauler or sub matches. Board only — email/print/link unchanged. |
| Placing people | Drop spot comes from the pointer height: above the first name whose middle is below the pointer, else at the bottom (gaps between names count). A green line shows where they will land; the dragged name rides just below the pointer so the line stays visible. 8px between names. |
| Read-only view | Home → Dispatch → **Daily Schedule** for positions Superviser / SUP / Foreman / Management / Office (`SCHEDULE.viewPositions`); editors keep the board. **Published days only.** Shows the 2 published days before today (so Monday keeps Saturday), today ("Not posted yet" if unpublished), and the next 2 published days (Friday → Saturday + Monday). **Personal notes left off**; job notes stay. Same layout as the shared link. Route `#day-view`, API `schedule/view-days` + `schedule/view`. |
| Machine between people | Drag the machine tag off one person's name onto another on the same job; if they had a machine, the two swap. Drag it to Equipment to free it, or to another job/Yard like any machine. Clicking the tag opens that person. Picking a machine in someone's edit box takes it off whoever had it (toast with Undo). A machine change alone never flags a text — only a change of job/spot, personal note or job note does. Helper `giveMachine` in `schedule-view.js`. |
| One-page PDF | Publish → "One-page PDF": Letter, portrait, 0.4in margins, 3 columns, Arial. Only jobs with people (plus Landscaping when it has people): crew with role and machine, hired trucks, subs, other equipment; then Moves (drivers with their moves, other equipment moves, material moves). No personal notes, job notes, addresses, supervisor, Off, Office/Shop, Vacation. Text starts at 10pt and shrinks to fit (smallest 6.5pt; past that the whole page is scaled down, so it is always exactly one page; page box is 10in tall, under the 10.2in printable height, and the print style zeroes body margins). Browser print window → "Save as PDF"; suggested file name "LH Daily Schedule YYYY-MM-DD". `onePageHtml` in `schedule-view.js`, `.v-one` styles; the regular Print / PDF is unchanged. Nov 18 2026 fit at 9pt. |
| No work days | "No work" button on the board for holidays, weather days, planned days off (any weekday). Saved as `board.noWork = { reason }`; the board, people and equipment stay saved and hidden, so turning it off brings them back. The board, phone link, email and both PDFs say "No work — reason". A No work day is never the copy source: the next day copies the last saved weekday that isn't No work. Once a No work day is published, a "Text everyone: no work" button texts the usual link list (pressed by hand, never automatic). Crew texts are off on a No work day. |
| Start from… | On a day that isn't published yet, "Start from…" (top bar, and the link in the new-day banner) rebuilds the day as a copy of any saved day in the 4 weeks before / 3 weeks after (No work days not offered). Same rules as a normal copy: vacations removed, equipment moves applied, Saturday rule if the day is a Saturday. Asks before replacing a day that already has changes. Crew text flags still compare with the last day actually worked (`S.prev`), not the day picked, so nobody misses a text. Made for planning ahead (e.g. Fri after Thanksgiving built early; Monday started from Wednesday). |
| Back burner | Comparing the schedule with timecard entries. Don't build unless asked. |

Board model (one JSON per day in Daily Schedules → Schedule Days, `Version` stops two editors overwriting each other):
`jobs`, `people {loc: [{id, role, machine, note}]}` (loc = job record ID | LANDSCAPE | OFF | SHOP | DRIVERS),
`equip {loc: [equipment record ID]}` (not listed = Yard; LANDSCAPE; REPAIR), `jobNotes`, `haul`, `moves`, `sent`.
An operator's machine stays in the job's `equip` list; the person only points to it.

Drag and drop uses pointer events (works on touch), not HTML5 drag-and-drop.

Open items when this was built: "Billy M." from the old sheet matches no employee; Tyler Enck has no TextMagic contact;
Hired Trucks rows have no contact info (not needed).

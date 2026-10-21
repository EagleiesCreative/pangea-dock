# Pangea Dock — Broadcast TD Command Center

Run-of-show, camera plot & patch matrix, media/CG, gear and pre-flight QC for live broadcasts —
shared with your crew in real time, with Clerk sign-in and per-person view/edit access.

## 1. Set up Clerk (5 min)
1. Create an application at https://dashboard.clerk.com (pick the sign-in methods you want, e.g. Email + Google).
2. **Configure → Organizations → Enable organizations.** (Each *Production* in Pangea Dock is a Clerk organization.)
3. **Organizations → Roles & Permissions → Create role**: name `Viewer`, key `viewer`.
   Then set *Default role for new members* to whatever you prefer (`Member` = can edit, `Viewer` = read-only).
4. *(Optional, recommended)* **Configure → Restrictions → Sign-up mode: Restricted** so only people you invite can join.
5. Copy the API keys into `.env.local`:

```bash
cp .env.example .env.local   # then paste your pk_… / sk_… keys
```

### Custom login pages
Sign-in/sign-up are Pangea Dock's own screens (`components/auth/*`) built on Clerk's API —
Google, email + password, email code, 2-step verification, forgot password and invitation links.
- **Clerk Dashboard → Configure → Paths**: set *Sign-in* and *Sign-up* to "application domain" at
  `/sign-in` and `/sign-up`, so invitation emails open these pages instead of Clerk's hosted ones.
- **SSO connections → Google** must be enabled for the Google button.
- Want a photo on the right-hand panel (like the reference)? Save it as `public/login-hero.jpg`.

## 2. Run
```bash
npm install
npm run dev            # http://localhost:3000
# or: npm run build && npm start
```

Sign in → create a production → **Invite** (sidebar, admins only) → enter emails and pick a role.

| Clerk role   | In Pangea Dock                     |
|--------------|-------------------------------------|
| `org:admin`  | Edit + invite / remove crew         |
| `org:member` | Edit                                |
| `org:viewer` | View only (all controls disabled, sees edits live) |

Roles live in `lib/roles.ts` — change `EDIT_ROLES` to adjust.

## 3. Storage & sync
- The server is the source of truth (`/api/show`). Each edit saves only the section that changed
  (cues, cameras, media, …), so two people editing different tabs never overwrite each other.
  Same section at the same moment → last save wins. Clients poll every 2 s for changes.
- **Default:** JSON files in `./.data/` on the machine running `npm start` — fine for a laptop/NUC in the control room.
- **Cloud / Vercel:** paste `supabase/setup.sql` into Supabase → SQL Editor → Run (one time) and set
  `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (server-only; never expose it to the browser).
- Cue timers use the clock of whoever pressed GO — keep control-room machines NTP-synced.

## Notes
- Space = GO when Live Show Mode is on, no input is focused, and you have edit access.
- Export menu: JSON (full backup incl. stream key), CSV (key omitted), Print/PDF, Import JSON, Reset demo data.
- Media tab → Export JSON/CSV for a vMix Data Source.

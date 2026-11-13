# Casanté Family Health Agent: clickable demo

A static React + Vite + TypeScript app for iPhone and iPad. It plays the three moments from `Designs/Demo App v3/FLOW.md` on mock data, with no server.

## Run it

```bash
cd app
npm install
npm run dev                 # http://localhost:5173
npm run dev -- --host       # also on your Wi-Fi, to open on an iPhone or iPad
```

- **iPhone or iPad:** runs full screen. In Safari, use Share → Add to Home Screen and it opens with no browser bars.
- **Desktop browser:** shows a phone frame. Add `?frame=0` to the URL to hide it, or `?frame=1` to force it.

## Present it

**Press and hold the Casanté logo** (top bar, about half a second) to open the demo menu:
- Jump to the start of Moment 1, 2 or 3. This resets the demo data and sets the demo clock: Wed Nov 11 for Moment 1, Sat Nov 14 at St. Luke's for Moments 2 and 3.
- Slow network, or fail the next request, to show the loading and error states.
- Reset demo data.
- With Cognatum sign-in on: **Ask answers** (scripted / demo questions scripted, others from Cognatum / everything from Cognatum), **Seed Mitchell records**, **Run recall test**. See [Ask on Cognatum](#ask-on-cognatum).

| Moment | Start | Path |
|---|---|---|
| 1 · Neurologist prep | Family home | tap Mom → type *What was Mom's BP at her last appointment with Dr. Green?* → **Add to tomorrow's prep** |
| 2 · Hospital | Ask about Mom | type *What year did Mom break her ankle?* → *Where were the X-rays taken?* → *When did she last take her warfarin?* → **Show answers to the nurse** |
| 3 · Interaction check | New medication | **Check against Mom's meds** → see results → **Ask the care team** → review and send |

Typed questions work too. The demo questions match with small wording differences ("when did mom break her ankle", "last warfarin dose"). Anything else gets "I can only answer from Mom's records in this demo".

## Ask on Cognatum

With sign-in on (`VITE_AUTH=auth0`), Ask can answer from Mom's records in Cognatum instead of the script. Records, visits and the interaction check stay on the demo fixtures; only Ask changes (`src/services/live/CognatumAskHealthApi.ts`).

- **Records in Cognatum:** one markdown file per record in `seed/cognatum/Margaret Mitchell/<subfolder>/`, named `… - <date> - <recordId>.md`. Demo menu → **Seed Mitchell records** uploads them to `Casanté · Mitchell family / Margaret Mitchell` in the `casante` workspace. It is safe to run again: unchanged files are skipped, changed files replace the old document.
- **Ask answers switch** (demo menu): *Demo questions scripted, others from Cognatum* (default) keeps the three moments on the designed answers and sends everything else to Cognatum. *Everything from Cognatum* sends every question. *Scripted only* needs no network.
- **How an answer is built:** the question goes to SIL folder chat for the member's folder ("Mom" becomes "Margaret"; documents dated after the demo clock are left out). Citations map back to record ids through the file names. BP questions add the BP card, warfarin dose questions add the dose log, advice questions add "ask her doctor", and an uncited reply is shown as out of scope.
- **Run recall test** asks 23 caregiver questions and checks each cites the expected record.
- **Hosted:** the browser can't call Cognatum from github.io (its CORS allowlist doesn't include it), so the hosted build calls the Supabase Edge Function `sil` (`supabase/functions/sil`, `VITE_SIL_API_URL` in `.env`). It forwards the user's Auth0 token and `X-SIL-Tenant` server-to-server, holds no secret, and allows only the calls Ask needs: memberships, `/auth/me`, folder and document listings, and folder chat. Seeding needs the local Vite proxy. Deploy changes with `supabase functions deploy sil --use-api --no-verify-jwt` from `app/`.

## Build and deploy

```bash
npm run build                                   # → dist/
VITE_BASE=/casante-demo/ npm run build          # when served from a sub-path
npm run preview                                 # serve dist/ locally
```

**GitHub Pages:** `.github/workflows/deploy-demo.yml` (at the repo root) builds `app/` and deploys on every push to `main`. One-time setup: repo **Settings → Pages → Source: GitHub Actions**. The workflow sets `VITE_BASE` to the repo's Pages path automatically. Routing uses `#/…` URLs, so refreshes and deep links work on Pages.

## Switch from mock to real

| | Mock (default) | Real |
|---|---|---|
| Health API | `VITE_HEALTH_API=mock` | `VITE_HEALTH_API=live` + `VITE_HEALTH_API_URL=https://…` |
| App store | `VITE_APP_STORE=mock` | `VITE_APP_STORE=supabase` + `VITE_AUTH=auth0` ([setup](#supabase-app-store)) |

Set these in `app/.env.local` (see `.env.example`) or in the workflow's `env:` block. The contract for both is in [DATA.md](DATA.md).

Everything in a `VITE_*` variable ends up in the public bundle, so never put a secret there.

## Sign in with the Cognatum account (Auth0)

With `VITE_AUTH=auth0` the app opens on a sign-in screen. The demo user signs in with their **Cognatum email and password** on Auth0's hosted page. Same Auth0 tenant, same user database, no separate account. The app then calls the Cognatum API as that user, in the workspace named by `VITE_SIL_TENANT` (e.g. `casante`). Every call carries `Authorization: Bearer <access token>` and `X-SIL-Tenant: <tenant id>` (`src/services/live/SilClient.ts`). Long-press the logo → **Cognatum → Test connection** to confirm it works: it calls `GET /auth/me` in the workspace and shows the account and roles SIL sees.

The Auth0 domain (`attrilock.us.auth0.com`), the caregiver app's client id, the Cognatum URL and the `casante` workspace are already set in `app/.env`. Turning sign-in on locally only needs:

```bash
# app/.env.local, local dev against beta
VITE_AUTH=auth0
VITE_SIL_API_URL=/api/v1
SIL_PROXY_TARGET=https://app.cognatum-demo.com
```

Locally, Vite proxies `/api/v1` to `SIL_PROXY_TARGET`, because beta's CORS never allows a `localhost` origin. The hosted build calls Cognatum through the `sil` Edge Function (`VITE_SIL_API_URL` in `app/.env`).

**One-time setup**

1. **Auth0 → Applications → Create Application**, type **Single Page Application**, in the same tenant Cognatum beta uses. Do not reuse the Cognatum web app's client: that one is a server-side app with a secret.
   - Allowed Callback URLs and Allowed Logout URLs: `https://sgetchel858.github.io/caregiver-application/, http://localhost:5173/`
   - Allowed Web Origins: `https://sgetchel858.github.io, http://localhost:5173`
   - Refresh Token Rotation: **on**.
   - **Connections** tab: enable only the database connection the Cognatum web app uses, so the Cognatum username and password is the only way in.
2. **Auth0 → APIs → the Cognatum API (`https://sil-api`)**: turn on **Allow Offline Access**, so the app gets refresh tokens and stays signed in on iPhone. If the API restricts user access by application, allow the new app.
3. **Auth0 → Actions → Login flow:** add the new client id wherever the Cognatum Actions list SIL clients: the roles Action that writes `https://sil.app/roles` and the `SIL_CLIENT_IDS` secret of the tenant-claim Action. **This one matters.** Cognatum re-syncs a user's Auth0-sourced roles from that claim on every request, so a token without it removes those roles from the account, in the Cognatum web app too.
4. **Cognatum beta CORS:** not needed. The hosted build reaches Cognatum through the `sil` Edge Function ([Ask on Cognatum](#ask-on-cognatum)); local dev goes through the Vite proxy.
5. The demo user must be an active member of the Casanté workspace in Cognatum.
6. **GitHub Pages build (optional):** set the repository **variable** `VITE_AUTH=auth0` (Settings → Secrets and variables → Actions → Variables). Everything else comes from `app/.env`. Without it the hosted demo stays offline with no sign-in.

**What Cognatum allows this token to do.** Cognatum counts only its own web app's tokens as a "human session" (ADR 152). A token issued to this app is treated as delegated, so it can read and query like the user, but approval routes, Ask's cached files and personal answer rules refuse it. Lifting that needs a Cognatum change and an ADR.

**Idle sign-out.** A signed-in user is signed out after 10 minutes without a tap, key or scroll, with a one-minute "Still there?" warning first. The time away counts across tabs and while the app is closed. The limits are in `src/lib/idle.ts`. It does not apply when sign-in is off (`VITE_AUTH=none`).

## Supabase app store

With `VITE_APP_STORE=supabase` the app keeps its own data (family, calendar, prep sheets, question lists, drafts, settings) in the "Casante Caregiver App" Supabase project instead of the browser. It needs `VITE_AUTH=auth0`: Supabase identifies the user by their Auth0 sign-in. The project URL and publishable key are in `app/.env`. Tables and rules: [DATA.md](DATA.md#part-2--app-store-supabase).

```
# app/.env.local
VITE_AUTH=auth0
VITE_APP_STORE=supabase
```

**Demo data only.** The database holds the fictional Mitchell family. Do not put real people's health details in it.

**One-time setup**

1. **Supabase → Authentication → Sign In / Providers → Third-Party Auth → Add provider → Auth0:** tenant `attrilock`, region `US`.
2. **Auth0 → Actions → Library → Create Action** (trigger: Login / Post Login), then add it to the Login flow. Supabase needs a `role` claim to treat the token as a signed-in user. The Action only touches this app's ID token, so the Cognatum access token and other apps in the tenant are unchanged:

   ```js
   exports.onExecutePostLogin = async (event, api) => {
     if (event.client.client_id !== '<the caregiver app client id, VITE_AUTH0_CLIENT_ID>') return
     api.idToken.setCustomClaim('role', 'authenticated')
   }
   ```
3. Sign out of the app and back in, so the new claim is in the token.

**Changing the database.** Add a SQL file under `app/supabase/migrations/`, then from `app/`: `supabase db push`, and `supabase gen types typescript --linked > src/services/live/database.types.ts`.

## Where things live

```
src/
  services/           typed interfaces, mock + live implementations, fixtures
    types.ts          every data shape
    HealthApi.ts      medical info + agent (ask, interaction check, prep sheet, drafts)
    AppStore.ts       family, saved prep sheets, question lists, drafts, settings
    mock/fixtures/    ALL demo data from FLOW.md
    mock/scriptedAnswers.ts   the scripted Ask answers + question matching
    demo/demoState.ts the demo clock and network simulation (demo menu only)
  components/         header, agent message, source chip, ask bar, sheets…
  screens/            one file per screen
  styles/app.css      brand tokens, iOS safe areas, iPad tuning, print
```

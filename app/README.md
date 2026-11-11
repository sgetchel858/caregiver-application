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

| Moment | Start | Path |
|---|---|---|
| 1 · Neurologist prep | Family home | tap Mom → send the pre-filled question → **Add to tomorrow's prep** |
| 2 · Hospital | Ask about Mom | send → *Where were the X-rays taken?* → *When did she last take her warfarin?* → **Show answers to the nurse** |
| 3 · Interaction check | New medication | **Check against Mom's meds** → see results → **Ask the care team** → review and send |

Typed questions work too. The demo questions match with small wording differences ("when did mom break her ankle", "last warfarin dose"). Anything else gets "I can only answer from Mom's records in this demo".

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
| App store | `VITE_APP_STORE=mock` | `VITE_APP_STORE=supabase` (finish `src/services/live/SupabaseAppStore.ts` first) |

Set these in `app/.env.local` (see `.env.example`) or in the workflow's `env:` block. The contract for both is in [DATA.md](DATA.md).

Everything in a `VITE_*` variable ends up in the public bundle, so never put a secret there.

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

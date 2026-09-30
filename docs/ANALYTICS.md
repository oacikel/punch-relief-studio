# Analytics (T10)

Opt-in, privacy-scoped product analytics, off by default. See
`docs/DECISIONS.md` ("Opt-in product analytics") for why this exists and
the retention/hosting decisions; this doc is the event dictionary and data
flow. Implementation lives in `src/analytics/**` and
`src/components/PrivacyControl.tsx`; see `docs/ARCHITECTURE.md` for the
module breakdown.

## Inert unless configured

Everything below is active only when **both** `VITE_VP_INGEST_URL` and
`VITE_VP_PROJECT_TOKEN` are set at build time (`src/analytics/config.ts`).
Neither is set for the public GitHub Pages build. When unset: no consent
prompt, no Privacy control, no localStorage/sessionStorage keys, no queue,
no network calls -- the app looks and behaves exactly as it did before T10.

## Consent

Nothing is stored or sent until the person clicks **Allow**. The prompt
(exact copy, `src/components/PrivacyControl.tsx`):

> Help improve Punch Relief Studio? If you allow it, we count anonymous
> steps like "pattern created" or "exported as PNG", tied to a random ID.
> Your models, images, file names and patterns never leave your browser.
> Change this anytime under Privacy.
>
> **[Allow]** **[No thanks]**

The browser's Global Privacy Control (`navigator.globalPrivacyControl ===
true`) counts as a standing "No": the prompt never appears, and no amount
of clicking "Allow" (even directly, bypassing the UI) can turn analytics on
while GPC is set (`src/analytics/consent.ts`). A **Privacy** control stays
reachable on every screen once analytics is configured, letting the choice
be changed in either direction at any time. Opting out deletes the
anonymous ID and the entire local queue immediately.

## IDs

- `anonymousId` -- a random ID in `localStorage`, created only after
  consent is granted, deleted on opt-out.
- `sessionId` -- a random ID in `sessionStorage`, per tab, independent of
  consent (only ever attached to an event when `anonymousId` is also
  present, i.e. only after consent).

## Event dictionary

Six event/location pairs, five distinct event names -- no others exist;
`src/analytics/eventBuilder.ts` is a whitelisting builder that cannot
produce anything outside this list, and rejects unlisted enum values.

| Event               | Trigger                                                                                                                                        | Fields                                                                                                          | Metric it serves                                                         |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| `page_viewed`       | App mount (`App.tsx`)                                                                                                                          | `path: "/"`                                                                                                     | Landing volume, denominator for the funnel                               |
| `page_viewed`       | Entering the Workspace stage (`App.tsx`'s stage effect)                                                                                        | `path: "/workspace"`                                                                                            | How many landings proceed past Import                                    |
| `project_created`   | A sample loads (`handleSelectSample`), a file import succeeds (`handleFilesSelected`), or an image import succeeds (`handleImageSelected`)     | `origin: "sample" \| "import"`                                                                                  | Funnel start; also starts the `pattern_completed` duration clock         |
| `pattern_completed` | The first successful generation for the current project -- `useLiveRelief`'s `onSuccess` (3D) or the image-processing success path (`App.tsx`) | `durationSeconds?` (time since `project_created`, integer, 0..604800, omitted if unavailable)                   | Time-to-first-result; funnel step before export                          |
| `export_succeeded`  | `ExportPanel.tsx`'s `exportSvg`/`exportPng`/`printPdf`                                                                                         | `format: "svg" \| "png" \| "pdf"` (`"pdf"` means the print dialog opened, not that a PDF was necessarily saved) | The target metric: completion rate, by format                            |
| `export_failed`     | `ExportPanel.tsx`'s `exportPng` rejection                                                                                                      | `reason: "unknown"`                                                                                             | Where the funnel silently drops, distinct from an export never attempted |

## Common fields

Attached to every event by `src/analytics/index.ts`'s `track()`, never by
the event builder itself:

- `eventId` (random UUID), `occurredAt` (ISO timestamp) -- generated fresh
  per event.
- `anonymousId`, `sessionId` -- see IDs above.
- `appVersion` -- from `package.json`'s `version`, injected at build time
  as `import.meta.env.VITE_APP_VERSION` via `vite.config.ts`'s `define`.
- `source` -- a coarse classification of `document.referrer` and
  `utm_medium`/`utm_source` on landing (`ad`/`social`/`search`/`referral`/
  `direct`/`other`), computed once per session and cached in
  `sessionStorage` (`src/analytics/source.ts`). The query string and
  referrer URL themselves are never stored or sent -- only this derived
  category.
- `experimentRef`/`variant` -- parsed from the landing URL's `?exp=EXP-002
&v=b`, validated against the ingest contract's patterns, cached in
  `sessionStorage` for the rest of the session. If no landing link supplied
  one, `initAnalytics()` may self-assign one instead -- see "EXP-007" below.

## EXP-007 -- fit-to-screen preview, standalone release

"Ship fit-to-screen default plus pan and zoom as a standalone release": the
pattern preview (`PatternCanvas.tsx` -> `PatternPreview.tsx`) now opens
scaled so the whole pattern is visible on the current viewport, with a
visible "Fit to screen" control and working pointer-drag pan plus
wheel/pinch zoom. Unlike an A/B-tested experiment, this change ships to
_everyone_ who opens the preview during the release window -- there is no
withheld control variant to compare against concurrently. Instead it's
measured against an equal-length window immediately _before_ the release,
by manually counting `export_succeeded`/`export_failed` events in each
window (see docs/DECISIONS.md).

For that pre/post comparison to be possible, every event from a
release-window session needs to carry `experimentRef: 'EXP-007'`, so
`initAnalytics()` self-assigns the session into EXP-007's single variant,
`fit` (`src/analytics/fitToScreenPreview.ts`), unless a landing `?exp=` link
already put it in some other experiment. Pre-release events have no
`experimentRef` at all, which is what tells the two windows apart.

**Never sent, under any configuration:** the query string, the referrer
URL, file names, images, mesh/model data, project settings, or project
names. `src/analytics/__tests__/eventBuilder.test.ts` proves this by
passing exactly those values into the builders and asserting they never
serialize.

## Transport and offline behavior

- Events queue in a capped (~200), `localStorage`-backed queue
  (`src/analytics/queue.ts`). Events older than 7 days are dropped on
  every prune, since the ingest server rejects them as stale anyway.
- The queue flushes in batches of up to 20 (`src/analytics/transport.ts`):
  opportunistically after every `track()` call, on a periodic timer, and
  on `visibilitychange`/`pagehide`/`online` (`src/analytics/scheduler.ts`).
- Sent via `fetch(url, { method: 'POST', keepalive: true, headers: {
'content-type': 'text/plain' } })`, body `{ token, events }` -- the
  token travels in the body and the content type is `text/plain`
  specifically to avoid a CORS preflight; the ingest server accepts and
  JSON-parses the body regardless of the declared type.
- Response handling: 2xx drops the sent batch; a non-429 4xx drops the
  batch without retrying (the server will never accept it); 429/5xx/a
  network error keeps the batch queued and backs off exponentially before
  the next attempt.
- The app works fully offline and when opted out -- analytics failure
  modes are always "nothing sent," never a broken pattern-creation/export
  path.

## Data flow

```
Consent granted (PrivacyControl.tsx)
  -> anonymousId created (ids.ts, localStorage)
  -> trackX() call site (App.tsx / ExportPanel.tsx)
    -> eventBuilder.ts whitelists name+properties
    -> index.ts's track() adds common fields (ids, source, experiment, appVersion)
    -> queue.ts appends to the localStorage queue
    -> transport.ts opportunistically flushes (<=20/batch)
      -> POST {VITE_VP_INGEST_URL}/v1/ingest/events (VenturePilot)
        -> T01's ingest contract validates/stores the event
        -> 90-day raw retention, then daily rollups by app version + source
           (see docs/DECISIONS.md) feed the completion-funnel query
```

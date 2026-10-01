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
  `sessionStorage` for the rest of the session. When the landing URL carries
  no experiment, `initAnalytics()` assigns EXP-002 instead (see below) and
  caches it in the same slot, so every event of a session carries one
  experiment label or the other -- never both, and never a relabelled one.

## EXP-002: "move yarn palette selection earlier"

Hypothesis: choosing yarn colors before tuning depth/shape may reduce
unfinished patterns. Implementation: `src/analytics/paletteOrder.ts`
(assignment) plus `src/components/workspace/Workspace.tsx` (the reordered
rail, swapping the Shape and Yarn setup steps -- Export always stays last).

- **Variants, 50/50, session-scoped:** `earlier` (rail opens on Yarn, then
  Shape, then Export) and `control` (today's Shape, then Yarn, then Export).
  Assigned once per session in `initAnalytics()`, from the parity of a fresh
  random ID, and stored in the same sessionStorage experiment slot the
  landing-URL parser uses. A session that arrived via an `?exp=` link keeps
  that experiment and stays out of EXP-002 entirely.
- **No new events, no new fields.** Measured entirely from the existing
  funnel, split by `variant`: `project_created` -> `pattern_completed` ->
  `export_succeeded`. "Finished a pattern" is `export_succeeded` (any
  format).
- **Defaults to `control`, unlike a purely additive self-assigned
  experiment would.** Reordering the rail's numbered steps has effects
  beyond what EXP-002 measures -- button labels like "2 Yarn", screenshots,
  e2e specs -- so an unassigned session (analytics unconfigured, GPC, or a
  link-provided experiment) gets today's order rather than the treatment.
  The public GitHub Pages build, when analytics is unconfigured for it,
  therefore keeps today's order for everyone rather than shipping the
  reorder unmeasured. See docs/DECISIONS.md.
- **Consent gates the measurement, not the order.** Which version of the
  product someone gets isn't personal data, and branching on consent would
  make the two variants' populations differ by more than the step order.

## EXP-003: "clarify the single-viewpoint preview"

Hypothesis: setting expectations _before_ the first preview will reduce
confusion during export. The product's output is a single-viewpoint bas-relief
interpretation, not a full 3D reconstruction, and until now that was one line
of helper text on the Import/Orient step. Implementation:
`src/analytics/previewExpectations.ts` (assignment) plus
`src/components/stages/PreviewExpectations.tsx` (the notice, rendered on the
Import/Orient step -- the last screen before the Workspace preview exists).

- **Historical variants, 50/50, session-scoped:** `expectations` (the notice replaces the
  one-line helper text, naming what the exported sheet will and won't contain:
  this view only, depth as a few `H{n}` steps rather than millimetres, no
  undercuts) and `control` (that step is exactly as it was). During EXP-003's
  measurement window, assignment happened once per session in `initAnalytics()`.
  EXP-002 now owns the live slot; the clearer notice remains shipped through
  `getPreviewExpectationsVariant()`'s unassigned-session fallback.
- **No new events, no new fields.** Measured from the existing funnel, split
  by `variant`. The step the hypothesis is about is the end of it:
  `pattern_completed` -> `export_succeeded` (and the `export_failed` rate
  beside it). `project_created` -> `pattern_completed` is the control check --
  copy on the step _before_ the preview shouldn't change whether a preview is
  reached, so a variant gap there is a signal the split is skewed rather than
  that the copy worked.
- **Not measured:** whether the notice was read. That would need either a new
  event name the ingest contract doesn't accept or an overloaded existing one;
  the funnel already answers the hypothesis, so neither was done.
- **Diluted by image imports, deliberately.** The notice lives on the
  Import/Orient step, which only exists for 3D models -- an image import goes
  straight to the Workspace, and a flat image has no hidden side to set
  expectations about. `project_created.origin` can't separate the two
  (`"import"` covers both), so image sessions are enrolled but untreated,
  which biases any measured effect _downward_. Accepted rather than worked
  around: the alternative is a new field on an event, for an experiment that
  is about 3D models.
- **Inert where it can't be measured:** with analytics unconfigured (the
  public GitHub Pages build) there is no assignment and no storage key, and
  the notice is simply on for everyone -- withholding a clearer explanation
  from a control group only buys something where the funnel is actually being
  recorded. A Global Privacy Control signal behaves the same way.
- **Consent gates the measurement, not the notice.** Which version of the
  product someone gets isn't personal data, and branching on consent would
  make the two variants' populations differ by more than the copy.

## EXP-007 -- fit-to-screen preview, standalone release

"Ship fit-to-screen default plus pan and zoom as a standalone release" shipped
before the later A/B assignments. The
pattern preview (`PatternCanvas.tsx` -> `PatternPreview.tsx`) now opens
scaled so the whole pattern is visible on the current viewport, with a
visible "Fit to screen" control and working pointer-drag pan plus
wheel/pinch zoom. Unlike an A/B-tested experiment, this change ships to
_everyone_ who opens the preview during the release window -- there is no
withheld control variant to compare against concurrently. Instead it's
measured against an equal-length window immediately _before_ the release,
by manually counting `export_succeeded`/`export_failed` events in each
window (see docs/DECISIONS.md).

During that release window, `initAnalytics()` self-assigned sessions into
EXP-007's single `fit` variant (`src/analytics/fitToScreenPreview.ts`) so the
pre/post windows could be distinguished. EXP-002 is now the live assignment;
the EXP-007 assignment module remains as the historical implementation, while
the shipped preview behavior remains enabled for everyone.

**Never sent, under any configuration:** the query string, the referrer
URL, file names, images, mesh/model data, project settings, or project
names. `src/analytics/__tests__/eventBuilder.test.ts` proves this by
passing exactly those values into the builders and asserting they never
serialize.

## EXP-011: "Express lane: one screen from import to export, with Export always visible"

Hypothesis: it's the Workspace rail's step gating -- Shape, then Yarn, then
Export, each hidden until its own numbered step is clicked -- that
suppresses completed exports, separate from the exported output itself.
Implementation: `src/analytics/expressLane.ts` (variant read) plus
`src/components/workspace/Workspace.tsx` (the `express` layout -- Shape,
Yarn and Export render together on one scroll, no step nav, no
Back/Continue gating, Export visible as soon as it's rendered rather than
only after clicking into its step).

- **Link-only, not a 50/50 split.** The task brief recruits 8-12 makers
  directly and hands each one a link, `?exp=EXP-011&v=rail` or
  `?exp=EXP-011&v=express` -- there is no self-assignment module, unlike
  every earlier experiment here. `getExpressLaneVariant()` reads the
  cached landing context when one exists (so it agrees with whatever
  `experimentRef`/`variant` product events carry) and otherwise parses
  `exp`/`v` directly off the live URL, so the link decides the build a
  maker sees whether or not this test build has ingest configured -- see
  the module doc comment and docs/DECISIONS.md.
- **No new events, no new fields.** The target metric is exactly
  `export_succeeded`/`export_failed`, split by `variant`, per the task
  brief's own collection plan: counted from these events where ingest is
  configured, tallied by hand from a post-session form otherwise. Either
  way, every event this session sends carries `experimentRef: 'EXP-011'`
  whenever the session arrived via one of the two links and ingest is
  configured.
- **Defaults to `rail`.** A session with no `?exp=EXP-011` link -- the
  public GitHub Pages build for all its normal traffic, included -- keeps
  today's gated three-step rail unchanged.
- **Consent gates the measurement, not which build renders.** Which layout
  a maker sees isn't personal data; branching that on consent would make
  the two builds' populations differ by more than the layout.

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

/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL of the VenturePilot ingest API, e.g.
   * `https://api.example.com`. Unset for the public GitHub Pages build --
   * analytics stays fully inert without it. See `src/analytics/config.ts`. */
  readonly VITE_VP_INGEST_URL?: string;
  /** Public VenturePilot project token (`vpp_...`). Unset for the public
   * GitHub Pages build. See `src/analytics/config.ts`. */
  readonly VITE_VP_PROJECT_TOKEN?: string;
  /** Injected via `vite.config.ts`'s `define` from `package.json`'s
   * `version` field -- not a real environment variable. */
  readonly VITE_APP_VERSION?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

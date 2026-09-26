/**
 * T10 opt-in analytics UI. Renders nothing at all when analytics isn't
 * configured at build time (`src/analytics/config.ts`) -- no consent
 * prompt, no Privacy control -- so the public GitHub Pages build (which
 * sets neither `VITE_VP_INGEST_URL` nor `VITE_VP_PROJECT_TOKEN`) looks and
 * behaves exactly as it did before this feature. See docs/ANALYTICS.md.
 *
 * When configured, this is the single place both surfaces live:
 * - the one-time consent prompt (exact required copy, `Allow`/`No thanks`),
 *   shown only when consent is still unknown and Global Privacy Control
 *   isn't asserted (a GPC signal counts as a standing "No" -- no prompt);
 * - a small, always-reachable "Privacy" toggle, so consent can be changed
 *   in either direction at any time.
 */
import { useState } from 'react';
import {
  allowAnalytics,
  declineAnalytics,
  hasGlobalPrivacyControl,
  isAnalyticsAllowed,
  isAnalyticsConfigured,
  shouldShowConsentPrompt,
} from '@/analytics';

export function PrivacyControl(): JSX.Element | null {
  const configured = isAnalyticsConfigured();
  // Lazily initialized from current storage/GPC state -- read once, then
  // owned by this component's own state so clicking Allow/No thanks
  // updates the UI immediately without needing to re-derive from storage.
  const [promptDismissed, setPromptDismissed] = useState(false);
  const [allowed, setAllowed] = useState(() => configured && isAnalyticsAllowed());
  const [panelOpen, setPanelOpen] = useState(false);

  if (!configured) return null;

  const gpc = hasGlobalPrivacyControl();
  const showPrompt = !promptDismissed && shouldShowConsentPrompt();

  const handleAllow = (): void => {
    allowAnalytics();
    setAllowed(true);
    setPromptDismissed(true);
  };

  const handleDecline = (): void => {
    declineAnalytics();
    setAllowed(false);
    setPromptDismissed(true);
  };

  return (
    <>
      <div className="privacy-control">
        <button
          type="button"
          className="privacy-control-toggle"
          aria-expanded={panelOpen}
          aria-haspopup="dialog"
          onClick={() => setPanelOpen((open) => !open)}
        >
          Privacy
        </button>
        {panelOpen && (
          <div className="privacy-panel" role="dialog" aria-label="Privacy settings">
            <p>
              Anonymous usage analytics: <strong>{allowed && !gpc ? 'on' : 'off'}</strong>.
            </p>
            {gpc ? (
              <p>Your browser's Global Privacy Control is on, so this stays off here.</p>
            ) : allowed ? (
              <button type="button" onClick={handleDecline}>
                Opt out
              </button>
            ) : (
              <button type="button" onClick={handleAllow}>
                Allow
              </button>
            )}
          </div>
        )}
      </div>

      {showPrompt && (
        <div className="consent-prompt" role="dialog" aria-label="Help improve Punch Relief Studio">
          <p>
            Help improve Punch Relief Studio? If you allow it, we count anonymous steps like
            &quot;pattern created&quot; or &quot;exported as PNG&quot;, tied to a random ID. Your
            models, images, file names and patterns never leave your browser. Change this anytime
            under Privacy.
          </p>
          <div className="consent-prompt-actions">
            <button type="button" onClick={handleAllow}>
              Allow
            </button>
            <button type="button" onClick={handleDecline}>
              No thanks
            </button>
          </div>
        </div>
      )}
    </>
  );
}

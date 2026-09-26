import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { resetAnalyticsConfigCacheForTests } from '@/analytics/config';
import { clearConsent } from '@/analytics/consent';
import { clearQueue } from '@/analytics/queue';
import { resetBackoffForTests } from '@/analytics/transport';
import { resetFlushSchedulerForTests } from '@/analytics/scheduler';
import { PrivacyControl } from '../PrivacyControl';

function configure(): void {
  vi.stubEnv('VITE_VP_INGEST_URL', 'https://ingest.example.com');
  vi.stubEnv('VITE_VP_PROJECT_TOKEN', 'vpp_abcdefghijklmnopqrstuvwx');
  resetAnalyticsConfigCacheForTests();
}

function setGpc(value: boolean | undefined): void {
  const nav = navigator as Navigator & { globalPrivacyControl?: boolean };
  if (value === undefined) delete nav.globalPrivacyControl;
  else nav.globalPrivacyControl = value;
}

describe('PrivacyControl', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
  });

  afterEach(() => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    clearConsent();
    clearQueue();
    setGpc(undefined);
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    resetAnalyticsConfigCacheForTests();
    resetBackoffForTests();
    resetFlushSchedulerForTests();
  });

  it('renders nothing when analytics is not configured', () => {
    const { container } = render(<PrivacyControl />);
    expect(container).toBeEmptyDOMElement();
  });

  it('shows the exact required consent copy and Allow/No thanks buttons when configured', () => {
    configure();
    render(<PrivacyControl />);
    expect(
      screen.getByText(
        /Help improve Punch Relief Studio\? If you allow it, we count anonymous steps like "pattern created" or "exported as PNG", tied to a random ID\. Your models, images, file names and patterns never leave your browser\. Change this anytime under Privacy\./,
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'No thanks' })).toBeInTheDocument();
  });

  it('does not show the prompt when Global Privacy Control is on, but still shows the Privacy control', async () => {
    configure();
    setGpc(true);
    render(<PrivacyControl />);
    expect(screen.queryByText(/Help improve Punch Relief Studio/)).not.toBeInTheDocument();
    const toggle = screen.getByRole('button', { name: 'Privacy' });
    expect(toggle).toBeInTheDocument();
    await userEvent.click(toggle);
    expect(screen.getByText(/Global Privacy Control is on/)).toBeInTheDocument();
  });

  it('clicking Allow dismisses the prompt and creates an anonymous ID', async () => {
    configure();
    render(<PrivacyControl />);
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }));
    expect(screen.queryByText(/Help improve Punch Relief Studio/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('prs:analytics:anonymous-id:v1')).not.toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(screen.getByText('on')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Opt out' })).toBeInTheDocument();
  });

  it('clicking No thanks dismisses the prompt and stores no anonymous ID', async () => {
    configure();
    render(<PrivacyControl />);
    await userEvent.click(screen.getByRole('button', { name: 'No thanks' }));
    expect(screen.queryByText(/Help improve Punch Relief Studio/)).not.toBeInTheDocument();
    expect(window.localStorage.getItem('prs:analytics:anonymous-id:v1')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    expect(screen.getByText('off')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Allow' })).toBeInTheDocument();
  });

  it('Opt out after Allow clears the anonymous ID', async () => {
    configure();
    render(<PrivacyControl />);
    await userEvent.click(screen.getByRole('button', { name: 'Allow' }));
    await userEvent.click(screen.getByRole('button', { name: 'Privacy' }));
    await userEvent.click(screen.getByRole('button', { name: 'Opt out' }));
    expect(window.localStorage.getItem('prs:analytics:anonymous-id:v1')).toBeNull();
    expect(screen.getByText('off')).toBeInTheDocument();
  });
});

//tanjo-client\src\App.tsx
import { useState, useEffect, useCallback } from 'react';
import { LibraryView } from './components/LibraryView';
import { UpdateChecker } from './components/UpdateChecker';
import { checkAuth, handleDeepLink, type AuthState, openBrowserAuth } from './lib/auth';
import { launchGame } from './lib/library';
import { logger } from './lib/logger';
import { I18nProvider, useI18n } from './i18n';
import './styles/global.css';
import './styles/components/update-checker.css';

function AppContent() {
  const { t } = useI18n();
  const [updateCheckComplete, setUpdateCheckComplete] = useState(false);
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const initAuth = async () => {
      try {
        const result = await checkAuth();
        if (!cancelled) {
          setAuth(result);
          setLoading(false);
        }
      } catch {
        if (!cancelled) setLoading(false);
      }
    };

    initAuth();

    let unlistenDeepLink: (() => void) | undefined;
    let unlistenLaunch: (() => void) | undefined;

    const setupListeners = async () => {
      try {
        if (typeof window !== 'undefined' && window.__TAURI__?.event?.listen) {
          const { listen } = await import('@tauri-apps/api/event');

          unlistenDeepLink = await listen<string>('deep-link-received', async (event) => {
            const url = event.payload;
            const result = await handleDeepLink(url);
            if (result && !cancelled) {
              setAuth(result);
              setLoading(false);
              setAuthError(null);
            } else if (!cancelled) {
              setAuthError(t.auth.authError);
            }
          });

          unlistenLaunch = await listen<{ slug: string }>('launch_requested', (event) => {
            launchGame(event.payload.slug).catch(logger.error);
          });
        }
      } catch (err) {
        logger.error('Failed to setup event listeners:', err);
      }
    };

    setupListeners();

    return () => {
      cancelled = true;
      if (unlistenDeepLink) unlistenDeepLink();
      if (unlistenLaunch) unlistenLaunch();
    };
  }, [t]);

  const handleDownloadGame = useCallback(async (slug: string) => {
    logger.info('Download requested:', slug);
  }, []);

  const handleLoginClick = useCallback(async () => {
    setAuthError(null);
    try {
      await openBrowserAuth();
    } catch {
      setAuthError(t.auth.loginError);
    }
  }, [t]);

  const handleLogout = useCallback(async () => {
    await import('./lib/auth').then(m => m.logout());
    window.location.reload();
  }, []);

  if (!updateCheckComplete) {
    return <UpdateChecker onCheckComplete={() => setUpdateCheckComplete(true)} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center">
        <div className="spinner" />
      </div>
    );
  }

  if (!auth?.isAuthenticated) {
    return (
      <div className="min-h-screen bg-bg-primary flex items-center justify-center p-md">
        <div className="card max-w-md w-full p-lg text-center">
          <h1 className="text-2xl font-bold title-gradient mb-md">{t.auth.title}</h1>
          <p className="text-secondary mb-lg">{t.auth.subtitle}</p>

          {authError && (
            <div className="error-box mb-md">
              <p className="text-error text-sm m-0">{authError}</p>
            </div>
          )}

          <button onClick={handleLoginClick} className="btn btn-primary btn-full justify-center">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
            </svg>
            {t.auth.connectButton}
          </button>

          <p className="text-muted text-xs mt-md">
            {t.auth.browserMessage}<br />
            {t.auth.returnMessage}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-bg-primary text-text-primary flex flex-col">
      <header className="app-header">
        <h1 className="text-xl font-bold title-gradient m-0">TANJO</h1>
        <div className="flex items-center gap-md">
          <span className="wallet-display">
            {auth.wallet?.slice(0, 6)}...{auth.wallet?.slice(-4)}
          </span>
          <button onClick={handleLogout} className="btn btn-ghost btn-sm text-error">
            {t.auth.logout}
          </button>
        </div>
      </header>

      <main className="flex-1 overflow-hidden">
        <LibraryView onDownloadGame={handleDownloadGame} />
      </main>
    </div>
  );
}

export default function App() {
  return (
    <I18nProvider>
      <AppContent />
    </I18nProvider>
  );
}
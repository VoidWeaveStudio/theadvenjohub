//tanjo-client\src\components\AuthFlow.tsx
import { useState, useCallback } from 'react';
import { logout } from '../lib/auth';
import { useI18n } from '../i18n';
import '../styles/components/auth.css';

export function AuthFlow() {
  const { t } = useI18n();
  const [status, setStatus] = useState<string>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleConnect = useCallback(async () => {
    setError(null);
    setStatus('connecting');

    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      
      const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
      const authUrl = isDev
        ? 'http://localhost:3000/auth/desktop?auto=1'
        : 'https://theadvenjo.online/auth/desktop?auto=1';
      
      await open(authUrl);
      setStatus('idle');
    } catch {
      setError(t.auth.failedToOpenBrowser);
      setStatus('error');
    }
  }, [t]);

  const handleLogout = useCallback(async () => {
    await logout();
    window.location.reload();
  }, []);

  const getStatusText = (): string => {
    const texts: Record<string, string> = {
      connecting: t.auth.connecting,
      signing: t.auth.signing,
      verifying: t.auth.verifying,
      syncing: t.auth.syncing,
    };
    return texts[status] || '';
  };

  if (status !== 'idle' && status !== 'error') {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
        <p className="text-secondary mt-md">{getStatusText()}</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-md">
        <div className="error-box">
          <p className="text-error text-sm m-0">{error}</p>
          <button
            onClick={() => { setStatus('idle'); setError(null); }}
            className="btn btn-ghost btn-sm mt-sm"
          >
            {t.auth.tryAgain}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-md p-md">
      <div className="text-center">
        <h2 className="text-xl font-bold mb-sm text-primary">{t.auth.signIn}</h2>
        <p className="text-sm text-secondary m-0">
          {t.auth.subtitle}
        </p>
      </div>

      <button
        onClick={handleConnect}
        className="btn btn-primary"
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <circle cx="12" cy="12" r="10" />
        </svg>
        {t.auth.connectButton}
      </button>

      <button
        onClick={handleLogout}
        className="btn btn-ghost btn-sm"
      >
        {t.auth.signOut}
      </button>
    </div>
  );
}
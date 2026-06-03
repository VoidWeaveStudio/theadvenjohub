//tanjo-client\src\components\UpdateChecker.tsx
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { Spinner } from '../ui/Spinner';
import { logger } from '../lib/logger'; 

interface UpdateInfo {
  available: boolean;
  version: string | null;
  current_version: string;
  body: string | null;
  date: string | null;
}

interface UpdateCheckerProps {
  onCheckComplete?: () => void;
}

export function UpdateChecker({ onCheckComplete }: UpdateCheckerProps) {
  const [checking, setChecking] = useState(true);
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      setChecking(true);
      setError(null);
      
      const info = await invoke<UpdateInfo>('check_app_update');
      setUpdateInfo(info);
      
      if (!info.available) {
        setTimeout(() => onCheckComplete?.(), 500);
      }
    } catch (err: any) {
      logger.error('Update check failed:', err);
      setError('Failed to check for updates');
      setTimeout(() => onCheckComplete?.(), 500);
    } finally {
      setChecking(false);
    }
  };

  const handleInstallUpdate = async () => {
    try {
      setInstalling(true);
      setError(null);
      
      await invoke('install_app_update');
    } catch (err: any) {
      logger.error('Update installation failed:', err);
      setError('Failed to install update');
      setInstalling(false);
    }
  };

  const handleSkipUpdate = () => {
    onCheckComplete?.();
  };

  if (checking) {
    return (
      <div className="update-checker">
        <div className="update-content">
          <Spinner size="lg" />
          <h2 className="update-title">Checking for updates...</h2>
          <p className="update-description">Please wait</p>
        </div>
      </div>
    );
  }

  if (updateInfo?.available) {
    return (
      <div className="update-checker">
        <div className="update-content">
          <div className="update-icon">🎉</div>
          <h2 className="update-title">Update Available!</h2>
          <div className="update-version-info">
            <span className="current-version">v{updateInfo.current_version}</span>
            <span className="arrow">→</span>
            <span className="new-version">v{updateInfo.version}</span>
          </div>
          
          {updateInfo.body && (
            <div className="update-changelog">
              <h3>What's New:</h3>
              <p>{updateInfo.body}</p>
            </div>
          )}

          {error && (
            <div className="update-error">
              <p>{error}</p>
            </div>
          )}

          <div className="update-actions">
            <button
              onClick={handleInstallUpdate}
              disabled={installing}
              className="btn btn-primary"
            >
              {installing ? (
                <>
                  <Spinner size="sm" />
                  Installing...
                </>
              ) : (
                'Install Update'
              )}
            </button>
            <button
              onClick={handleSkipUpdate}
              disabled={installing}
              className="btn btn-ghost"
            >
              Skip for now
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (error && !updateInfo) {
    return (
      <div className="update-checker">
        <div className="update-content">
          <div className="update-icon">⚠️</div>
          <h2 className="update-title">Update Check Failed</h2>
          <p className="update-description">{error}</p>
          <button onClick={onCheckComplete} className="btn btn-primary">
            Continue Anyway
          </button>
        </div>
      </div>
    );
  }

  return null;
}
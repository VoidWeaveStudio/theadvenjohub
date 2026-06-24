//tanjo-client\src\components\LibraryView.tsx
import { useState, useEffect, useRef } from 'react';
import { syncLibrary, type SyncedGame } from '../lib/library';
import { GameSidebar } from './GameSidebar';
import { GameDetails } from './GameDetails';
import { useI18n } from '../i18n';
import '../styles/components/library.css';

interface LibraryViewProps {
  onDownloadGame?: (slug: string) => void;
}

export function LibraryView({ onDownloadGame }: LibraryViewProps) {
  const { t } = useI18n();
  const [games, setGames] = useState<SyncedGame[]>([]);
  const [selectedGame, setSelectedGame] = useState<SyncedGame | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const isMountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const loadLibrary = async () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    abortControllerRef.current = new AbortController();
    
    try {
      if (isMountedRef.current) {
        setLoading(true);
      }
      
      const library = await syncLibrary();
      
      if (!isMountedRef.current) return;
      
      setGames(library);
      if (library.length > 0 && !selectedGame) {
        setSelectedGame(library[0]);
      }
    } catch (err: any) {
      if (err.name === 'AbortError') return;
      
      if (isMountedRef.current) {
        setError(err.message || 'Failed to load library');
      }
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    let interval: ReturnType<typeof setInterval>;

    const startPolling = () => {
      interval = setInterval(loadLibrary, 15 * 60 * 1000);
    };

    const handleVisibility = () => {
      if (document.hidden) {
        clearInterval(interval);
      } else {
        startPolling();
        loadLibrary();
      }
    };

    loadLibrary();
    startPolling();
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      isMountedRef.current = false;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  const handleSelectGame = (game: SyncedGame) => {
    setSelectedGame(game);
  };

  if (loading) {
    return (
      <div className="loading-overlay">
        <div className="spinner" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="error-container">
        <p className="text-error">{error}</p>
        <button onClick={loadLibrary} className="btn btn-primary">
          {t.common.retry}
        </button>
      </div>
    );
  }

  if (games.length === 0) {
    const storeUrl = import.meta.env.PROD
      ? 'https://theadvenjo.online'
      : 'http://localhost:3000';
    
    return (
      <div className="empty-state">
        <div className="empty-state-icon">🎮</div>
        <h3 className="text-lg font-semibold mb-sm text-primary">{t.library.libraryEmpty}</h3>
        <p className="text-sm text-secondary max-w-prose mb-lg">
          {t.library.purchaseGames}
        </p>
        <a
          href={storeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn btn-primary"
        >
          {t.library.goToStore}
        </a>
      </div>
    );
  }

  return (
    <div className="library-container">
      <GameSidebar
        games={games}
        selectedGame={selectedGame}
        onSelectGame={handleSelectGame}
      />
      <div className="library-main">
        {selectedGame ? (
          <GameDetails
            game={selectedGame}
            onDownload={onDownloadGame}
          />
        ) : (
          <div className="no-game-selected">
            <p className="text-secondary">{t.library.selectGame}</p>
          </div>
        )}
      </div>
    </div>
  );
}
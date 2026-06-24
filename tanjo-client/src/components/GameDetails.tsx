//tanjo-client\src\components\GameDetails.tsx
import { useState } from 'react';
import type { SyncedGame } from '../lib/library';
import { launchGame, checkForUpdates } from '../lib/library';
import { useI18n } from '../i18n';
import '../styles/components/game-details.css';

interface GameDetailsProps {
  game: SyncedGame;
  onDownload?: (slug: string) => void;
}

export function GameDetails({ game, onDownload }: GameDetailsProps) {
  const { t } = useI18n();
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [bgImageError, setBgImageError] = useState(false);

  const handlePlay = async () => {
    try {
      await launchGame(game.slug);
    } catch (err) {
      console.error('Failed to launch game:', err);
    }
  };

  const handleCheckUpdates = async () => {
    setCheckingUpdate(true);
    try {
      await checkForUpdates(game.slug);
    } finally {
      setCheckingUpdate(false);
    }
  };

  const handleDownload = () => {
    onDownload?.(game.slug);
  };

  const coverUrl = `/games/${game.slug}/cover.png`;

  return (
    <div className="game-details">
      <div className="game-background">
        {!bgImageError ? (
          <img
            src={coverUrl}
            alt={game.title}
            className="bg-image"
            onError={() => {
              setBgImageError(true);
            }}
          />
        ) : (
          <div className="bg-placeholder">🎮</div>
        )}
        <div className="bg-overlay" />
      </div>

      <div className="game-header">
        <div className="header-content">
          <h1 className="game-title">{game.title}</h1>

          <div className="news-section">
            <h3 className="news-title">{t.gameDetails.latestNews}</h3>
            <div className="news-content">
              <div className="news-item">
                <span className="news-date">{t.gameDetails.newsDate}</span>
                <p className="news-text">{t.gameDetails.newsText}</p>
              </div>
            </div>
          </div>

          {game.localData?.version && (
            <div className="version-info">
              <span className="version-label">{t.gameDetails.version}</span>
              <span className="version-value">{game.localData.version}</span>
            </div>
          )}
        </div>
      </div>

      <div className="game-actions">
        {game.installStatus === 'ready' && (
          <button onClick={handlePlay} className="btn-play">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M8 5v14l11-7z" />
            </svg>
            {t.gameDetails.playBeta}
          </button>
        )}

        {game.installStatus === 'update_available' && (
          <>
            <button onClick={handleCheckUpdates} disabled={checkingUpdate} className="btn-update">
              {checkingUpdate ? t.gameDetails.checking : t.gameDetails.update}
            </button>
            <button onClick={handlePlay} className="btn-play">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <path d="M8 5v14l11-7z" />
              </svg>
              {t.gameDetails.playBeta}
            </button>
          </>
        )}

        {game.installStatus === 'not_installed' && (
          <button onClick={handleDownload} className="btn-download">
            {t.gameDetails.download}
          </button>
        )}

        {game.installStatus === 'installing' && (
          <div className="install-progress">
            <div className="progress-bar">
              <div
                className="progress-fill"
                style={{ width: `${game.downloadProgress || 0}%` }}
              />
            </div>
            <span className="progress-text">
              {game.downloadProgress ? `${Math.round(game.downloadProgress)}%` : t.gameDetails.installing}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
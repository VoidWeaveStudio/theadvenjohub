// tanjo-client/src/components/GameSidebar.tsx
import type { SyncedGame } from '../lib/library';
import '../styles/components/game-sidebar.css';

interface GameSidebarProps {
  games: SyncedGame[];
  selectedGame: SyncedGame | null;
  onSelectGame: (game: SyncedGame) => void;
}

export function GameSidebar({ games, selectedGame, onSelectGame }: GameSidebarProps) {
  return (
    <aside className="game-sidebar">
      <div className="sidebar-header">
        <h2 className="sidebar-title">MY GAMES</h2>
        <span className="game-count">{games.length}</span>
      </div>

      <div className="game-list">
        {games.map(game => (
          <button
            key={game.id}
            onClick={() => onSelectGame(game)}
            className={`game-list-item ${selectedGame?.id === game.id ? 'active' : ''}`}
            type="button"
          >
            <div className="game-icon">
              <img
                src={`/games/${game.slug}/icon.png`}
                alt={game.title}
                onError={(e) => {
                  const img = e.target as HTMLImageElement;
                  if (img.src.includes('/icon.png') && game.coverImage) {
                    img.src = game.coverImage;
                  } else {
                    img.style.display = 'none';
                    const ph = img.parentElement?.querySelector('.game-icon-placeholder') as HTMLElement;
                    if (ph) ph.style.display = 'flex';
                  }
                }}
              />
              <div className="game-icon-placeholder" style={{ display: 'none' }}></div>
            </div>

            <div className="game-info">
              <span className="game-title">{game.title}</span>
              {game.localData?.version && (
                <span className="game-version">v{game.localData.version}</span>
              )}
            </div>

            {game.installStatus === 'ready' && <div className="status-indicator ready" />}
            {game.installStatus === 'update_available' && <div className="status-indicator update" />}
            {game.installStatus === 'installing' && <div className="status-indicator installing" />}
          </button>
        ))}
      </div>
    </aside>
  );
}
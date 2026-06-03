//tanjo-client\src\lib\library.ts
import { api } from './api';
import { store, type GameLocalData } from './store';
import { invoke } from '@tauri-apps/api/core';

export interface LibraryGame {
  id: string;
  gameId: string;
  title: string;
  slug: string;
  coverImage: string | null;
  purchasedAt: string;
  status: 'owned' | 'expired' | 'revoked';
}

export interface SyncedGame extends LibraryGame {
  localData?: GameLocalData;
  installStatus: 'not_installed' | 'installing' | 'update_available' | 'ready';
  downloadProgress?: number;
}

export async function syncLibrary(): Promise<SyncedGame[]> {
  const response = await api.get<{ library: LibraryGame[] }>('/api/client/sync');
  const localGames = await store.getAllGames();

  return response.library.map(game => {
    const local = localGames[game.slug];

    return {
      ...game,
      localData: local,
      installStatus: determineInstallStatus(game, local)
    };
  });
}

function determineInstallStatus(
  game: LibraryGame,
  local?: GameLocalData
): SyncedGame['installStatus'] {
  if (game.status !== 'owned') return 'not_installed';
  if (!local) return 'not_installed';
  return 'ready';
}

export async function markGameInstalled(
  slug: string,
  installPath: string,
  version: string
): Promise<void> {
  const localData: GameLocalData = {
    slug,
    installPath,
    version,
    lastPlayed: new Date().toISOString()
  };

  await store.setGame(slug, localData);

  await invoke('mark_game_installed', {
    info: {
      slug,
      version,
      install_path: installPath,
      executable: `${installPath}/Game.exe`
    }
  });
}

export async function launchGame(slug: string): Promise<void> {
  await invoke('launch_game', { slug });
}

export async function checkForUpdates(slug: string): Promise<{
  hasUpdate: boolean;
  currentVersion: string;
  latestVersion: string;
  downloadUrl?: string;
}> {
  const result = await invoke<{
    has_update: boolean;
    current_version: string;
    latest_version: string;
    download_url?: string;
  }>('check_game_updates', { slug });

  return {
    hasUpdate: result.has_update,
    currentVersion: result.current_version,
    latestVersion: result.latest_version,
    downloadUrl: result.download_url
  };
}
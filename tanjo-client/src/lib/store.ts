// src/lib/store.ts
import { Store } from '@tauri-apps/plugin-store';
import { encryptSensitive, decryptSensitive, isSensitiveKey } from './crypto';

let storeInstance: Store | null = null;

async function getStore(): Promise<Store> {
  if (!storeInstance) {
    storeInstance = await Store.load('store.bin');
  }
  return storeInstance;
}

export interface AuthData {
  wallet: string;
  deviceId: string;
  lastLogin: string;
}

export interface GameLocalData {
  slug: string;
  installPath: string;
  version: string;
  lastPlayed?: string;
  fileSize?: number;
}

export const store = {
  async setAuth(data: AuthData): Promise<void> {
    const s = await getStore();
    const encrypted: AuthData = {
      ...data,
      wallet: await encryptSensitive(data.wallet),
    };
    await s.set('auth', encrypted);
    await s.save();
  },

  async getAuth(): Promise<AuthData | null> {
    const s = await getStore();
    const data = await s.get<AuthData>('auth');
    if (!data) return null;

    return {
      ...data,
      wallet: await decryptSensitive(data.wallet),
    };
  },

  async clearAuth(): Promise<void> {
    const s = await getStore();
    await s.delete('auth');
    await s.save();
  },

  async setGame(slug: string, data: GameLocalData): Promise<void> {
    const s = await getStore();
    const games = await s.get<Record<string, GameLocalData>>('games') || {};
    games[slug] = data;
    await s.set('games', games);
    await s.save();
  },

  async getGame(slug: string): Promise<GameLocalData | null> {
    const s = await getStore();
    const games = await s.get<Record<string, GameLocalData>>('games');
    if (!games) return null;
    return games[slug] ?? null;
  },

  async getAllGames(): Promise<Record<string, GameLocalData>> {
    const s = await getStore();
    return (await s.get<Record<string, GameLocalData>>('games')) || {};
  },

  async removeGame(slug: string): Promise<void> {
    const s = await getStore();
    const games = (await s.get<Record<string, GameLocalData>>('games')) || {};
    delete games[slug];
    await s.set('games', games);
    await s.save();
  },

  async set<T>(key: string, value: T): Promise<void> {
    const s = await getStore();
    const finalValue = isSensitiveKey(key) && typeof value === 'string'
      ? (await encryptSensitive(value) as unknown as T)
      : value;
    await s.set(key, finalValue);
    await s.save();
  },

  async get<T>(key: string): Promise<T | null> {
    const s = await getStore();
    const data = await s.get<T>(key);
    if (data === null || data === undefined) return null;

    if (isSensitiveKey(key) && typeof data === 'string') {
      return (await decryptSensitive(data)) as T;
    }
    return data;
  },

  async delete(key: string): Promise<void> {
    const s = await getStore();
    await s.delete(key);
    await s.save();
  },

  async save(): Promise<void> {
    const s = await getStore();
    await s.save();
  }
};
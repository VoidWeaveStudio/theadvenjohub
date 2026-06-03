// tanjo-client/src/lib/auth.ts
import { api } from './api';
import { store } from './store';
import { logger } from './logger';

export interface AuthState {
  isAuthenticated: boolean;
  wallet: string | null;
  deviceId: string;
  accessToken?: string;
}

export async function getDeviceId(): Promise<string> {
  const auth = await store.getAuth();
  if (auth?.deviceId) return auth.deviceId;

  const random = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
  const deviceId = `device_${random}_${Date.now()}`.slice(0, 64);

  await store.setAuth({
    wallet: '',
    deviceId,
    lastLogin: new Date().toISOString()
  });

  return deviceId;
}

export async function handleDeepLink(url: string): Promise<AuthState | null> {
  try {
    const parsed = new URL(url);
    const search = parsed.search || parsed.hash.replace('#', '?');
    const params = new URLSearchParams(search);

    const token = params.get('token');
    const wallet = params.get('wallet');

    if (!token || !wallet) {
      return null;
    }

    await store.set('auth_token', token);
    await store.set('auth_wallet', wallet);
    await store.set('auth_timestamp', Date.now().toString());
    await store.save();

    return {
      isAuthenticated: true,
      wallet,
      deviceId: await getDeviceId(),
      accessToken: token
    };
  } catch {
    return null;
  }
}

export async function checkAuth(): Promise<AuthState | null> {
  const token = await store.get<string>('auth_token');
  const wallet = await store.get<string>('auth_wallet');

  if (!token || !wallet) {
    return null;
  }

  try {
    const response = await api.get<{ authenticated: boolean; user?: { wallet: string } }>('/api/auth/me', {
      credentials: 'include'
    });

    if (response.authenticated && response.user?.wallet) {
      return {
        isAuthenticated: true,
        wallet: response.user.wallet,
        deviceId: await getDeviceId(),
        accessToken: token
      };
    }
  } catch (error) {
    logger.error('Auth check failed:', error);
  }

  return null;
}

export async function logout(): Promise<void> {
  await store.delete('auth_token');
  await store.delete('auth_wallet');
  await store.delete('auth_timestamp');
  await store.save();

  const API_BASE = import.meta.env.PROD
    ? 'https://theadvenjo.online'
    : 'http://localhost:3000';

  await fetch(`${API_BASE}/api/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    mode: 'cors',
  }).catch((err) => {
    logger.error('Logout request failed:', err);
  });

  await store.clearAuth();
}

export async function openBrowserAuth(): Promise<void> {
  const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
  const authUrl = isDev
    ? 'http://localhost:3000/auth/desktop?auto=1'
    : 'https://theadvenjo.online/auth/desktop?auto=1';

  try {
    try {
      const { open } = await import('@tauri-apps/plugin-shell');
      await open(authUrl);
      return;
    } catch (shellError) {
      logger.error('Failed to open with Tauri shell:', shellError);
    }

    if (typeof window !== 'undefined' && window.open) {
      const newWindow = window.open(authUrl, '_blank');
      if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
        throw new Error('Popup blocked');
      }
      return;
    }

    window.location.href = authUrl;

  } catch (error) {
    logger.error('Failed to open browser auth:', error);
    if (typeof window !== 'undefined') {
      window.location.href = authUrl;
    }
  }
}
//tanjo-client\src\lib\api.ts
import { store } from './store';
import { logger } from './logger';

const API_BASE = import.meta.env.PROD
  ? 'https://theadvenjo.online'
  : 'http://localhost:3000';

const DEFAULT_TIMEOUT = 15000;

export interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
  timeout?: number;
}

export async function apiFetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
  const { skipAuth = false, timeout = DEFAULT_TIMEOUT, ...fetchOptions } = options;
  
  const headers = new Headers(fetchOptions.headers || {});
  headers.set('Content-Type', 'application/json');
  
  if (!skipAuth) {
    try {
      const token = await store.get<string>('auth_token');
      if (token) headers.set('Authorization', `Bearer ${token}`);
      
      const auth = await store.getAuth();
      if (auth?.deviceId) headers.set('x-device-id', auth.deviceId);
    } catch (error) {
      logger.error('Failed to get auth data:', error);
    }
  }
  
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  try {
    const response = await fetch(`${API_BASE}${endpoint}`, {
      ...fetchOptions,
      headers,
      credentials: 'include',
      mode: 'cors',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error.error || `HTTP ${response.status}`);
    }
    
    return await response.json();
  } catch (error: any) {
    clearTimeout(timeoutId);
    
    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }
    throw error;
  }
}

export const api = {
  get: <T>(url: string, options?: FetchOptions) => 
    apiFetch<T>(url, { ...options, method: 'GET' }),
  post: <T>(url: string, body: unknown, options?: FetchOptions) => 
    apiFetch<T>(url, { ...options, method: 'POST', body: JSON.stringify(body) }),
  delete: <T>(url: string, options?: FetchOptions) => 
    apiFetch<T>(url, { ...options, method: 'DELETE' }),
};
/// <reference types="vite/client" />

interface Window {
  __TAURI__?: {
    event?: {
      listen: (event: string, handler: (event: any) => void) => Promise<() => void>;
    };
    invoke: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
  };
}
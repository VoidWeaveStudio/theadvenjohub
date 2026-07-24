// src/core/types/tauri.d.ts
declare global {
  interface Window {
    __TAURI__?: {
      shell?: {
        open(path: string): Promise<void>;
      };
      event?: {
        listen: (event: string, handler: (event: any) => void) => Promise<() => void>;
      };
      invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
    };
  }
}

export { };

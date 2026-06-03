// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig((configEnv) => {
  const host = process.env.TAURI_DEV_HOST;

  return {
    plugins: [react()],
    clearScreen: false,
    server: {
      port: 1420,
      strictPort: true,
      host: host || false,
      hmr: host
        ? {
            protocol: "ws",
            host,
            port: 1421,
          }
        : undefined,
      watch: {
        ignored: ["**/src-tauri/**"],
      },
    },
    build: {
      target: 'esnext',
      minify: 'terser',
      terserOptions: {
        compress: {
          drop_console: configEnv.mode === 'production',
          pure_funcs: configEnv.mode === 'production' 
            ? ['console.log', 'console.debug', 'console.info', 'console.warn', 'console.error'] 
            : undefined,
          drop_debugger: configEnv.mode === 'production',
        },
      },
      sourcemap: configEnv.mode === 'development' ? 'inline' : false,
    },
    define: {
      'import.meta.env.PROD': JSON.stringify(configEnv.mode === 'production'),
      'import.meta.env.DEV': JSON.stringify(configEnv.mode === 'development'),
    },
    optimizeDeps: {
      exclude: ['@tauri-apps/api'],
    },
  };
});
//src\core\polyfills.ts
import { Buffer as BufferPolyfill } from 'buffer';

if (typeof window !== 'undefined' && !(window as any).Buffer) {
    (window as any).Buffer = BufferPolyfill;
}

if (typeof globalThis !== 'undefined' && !(globalThis as any).Buffer) {
    (globalThis as any).Buffer = BufferPolyfill;
}

if (typeof window !== 'undefined' && !(window as any).process) {
    (window as any).process = {
        env: {},
        version: '',
        nextTick: (fn: Function) => setTimeout(fn, 0),
    };
}

if (typeof window !== 'undefined' && !window.crypto?.subtle) {
    console.warn('⚠️ Web Crypto API not fully supported in this environment');
}

export { };
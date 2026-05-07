//src\games\warden-abyss\hooks\useSpriteCache.ts
"use client";

import { useEffect, useRef, useCallback } from "react";

const globalSpriteCache = new Map<string, HTMLImageElement>();
const globalSpritePromises = new Map<string, Promise<HTMLImageElement>>();

export interface SpriteCacheOptions {
  preload?: string[];
  retryAttempts?: number;
  retryDelay?: number;
}

export function useSpriteCache(options: SpriteCacheOptions = {}) {
  const { preload = [], retryAttempts = 3, retryDelay = 1000 } = options;
  
  const cleanupRef = useRef<Set<() => void>>(new Set());
  const isUnmountedRef = useRef(false);
  
  useEffect(() => {
    isUnmountedRef.current = false;
    return () => {
      isUnmountedRef.current = true;
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current.clear();
    };
  }, []);
  
  const preloadSprite = useCallback(async (src: string, attempt = 0): Promise<HTMLImageElement> => {
    if (globalSpriteCache.has(src)) {
      return globalSpriteCache.get(src)!;
    }
    
    if (globalSpritePromises.has(src)) {
      return globalSpritePromises.get(src)!;
    }
    
    if (attempt > retryAttempts) {
      throw new Error(`Failed to load sprite after ${retryAttempts} attempts: ${src}`);
    }
    
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      if (isUnmountedRef.current) {
        globalSpritePromises.delete(src);
        reject(new Error("Component unmounted"));
        return;
      }
      
      const img = new Image();
      
      img.decoding = 'async';
      img.loading = 'eager';
      
      const onLoad = () => {
        if (isUnmountedRef.current) {
          globalSpritePromises.delete(src);
          reject(new Error("Component unmounted"));
          return;
        }
        
        globalSpriteCache.set(src, img);
        globalSpritePromises.delete(src);
        resolve(img);
      };
      
      const onError = () => {
        globalSpritePromises.delete(src);
        
        if (isUnmountedRef.current) {
          reject(new Error("Component unmounted"));
          return;
        }
        
        const delay = retryDelay * Math.pow(2, attempt);
        setTimeout(() => {
          if (!isUnmountedRef.current) {
            preloadSprite(src, attempt + 1).then(resolve).catch(reject);
          } else {
            reject(new Error("Component unmounted"));
          }
        }, delay);
      };
      
      img.onload = onLoad;
      img.onerror = onError;
      img.src = src;
    });
    
    globalSpritePromises.set(src, loadPromise);
    return loadPromise;
  }, [retryAttempts, retryDelay]);
  
  const getSpriteSrc = useCallback((src: string): string => {
    const cached = globalSpriteCache.get(src);
    return cached?.src || src;
  }, []);
  
  const clearCache = useCallback((pattern?: string) => {
    if (pattern) {
      for (const key of globalSpriteCache.keys()) {
        if (key.includes(pattern)) {
          globalSpriteCache.delete(key);
        }
      }
      for (const key of globalSpritePromises.keys()) {
        if (key.includes(pattern)) {
          globalSpritePromises.delete(key);
        }
      }
    } else {
      globalSpriteCache.clear();
      globalSpritePromises.clear();
    }
  }, []);
  
  useEffect(() => {
    preload.forEach(src => {
      preloadSprite(src).catch(() => {
      });
    });
  }, [preload, preloadSprite]);
  
  return {
    preloadSprite,
    getSpriteSrc,
    clearCache,
    isLoaded: (src: string) => globalSpriteCache.has(src),
  };
}
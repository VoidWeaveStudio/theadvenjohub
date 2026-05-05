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
  
  const preloadSprite = useCallback(async (src: string, attempt = 0): Promise<HTMLImageElement> => {
    if (globalSpriteCache.has(src)) {
      return globalSpriteCache.get(src)!;
    }
    
    if (globalSpritePromises.has(src)) {
      return globalSpritePromises.get(src)!;
    }
    
    const loadPromise = new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image();
      
      img.decoding = 'sync';
      img.loading = 'eager';
      img.fetchPriority = 'high';
      
      const onLoad = () => {
        globalSpriteCache.set(src, img);
        globalSpritePromises.delete(src);
        resolve(img);
      };
      
      const onError = () => {
        globalSpritePromises.delete(src);
        
        if (attempt < retryAttempts) {
          const delay = retryDelay * Math.pow(1.5, attempt);
          setTimeout(() => {
            preloadSprite(src, attempt + 1).then(resolve).catch(reject);
          }, delay);
        } else {
          console.error(`[SpriteCache] Failed to load after ${retryAttempts} attempts: ${src}`);
          reject(new Error(`Failed to load sprite: ${src}`));
        }
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
    } else {
      globalSpriteCache.clear();
    }
  }, []);
  
  useEffect(() => {
    preload.forEach(src => {
      preloadSprite(src).catch(() => {});
    });
    
    return () => {
      cleanupRef.current.forEach(fn => fn());
      cleanupRef.current.clear();
    };
  }, [preload, preloadSprite]);
  
  return {
    preloadSprite,
    getSpriteSrc,
    clearCache,
    isLoaded: (src: string) => globalSpriteCache.has(src),
  };
}
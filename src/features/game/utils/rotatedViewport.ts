// src/features/game/utils/rotatedViewport.ts
export const GAME_ROOT_ID = "game-root";

const ROTATED_FLAG = "gameRotated";

export function setGameRotated(rotated: boolean): void {
  if (typeof document === "undefined") return;

  if (rotated) {
    document.documentElement.dataset[ROTATED_FLAG] = "true";
  } else {
    delete document.documentElement.dataset[ROTATED_FLAG];
  }
}

export function isGameRotated(): boolean {
  if (typeof document === "undefined") return false;
  return document.documentElement.dataset[ROTATED_FLAG] === "true";
}

export function getGameRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;
  return document.getElementById(GAME_ROOT_ID);
}

export function gameViewportSize(): { width: number; height: number } {
  if (typeof window === "undefined") return { width: 0, height: 0 };

  return isGameRotated()
    ? { width: window.innerHeight, height: window.innerWidth }
    : { width: window.innerWidth, height: window.innerHeight };
}

export function screenPointToGameSpace(x: number, y: number): { x: number; y: number } {
  if (typeof window === "undefined" || !isGameRotated()) return { x, y };
  return { x: y, y: window.innerWidth - x };
}

export function screenDeltaToGameSpace(dx: number, dy: number): { dx: number; dy: number } {
  if (!isGameRotated()) return { dx, dy };
  return { dx: dy, dy: -dx };
}

export function screenRectToGameSpace(rect: DOMRect): {
  left: number;
  top: number;
  right: number;
  bottom: number;
} {
  if (typeof window === "undefined" || !isGameRotated()) {
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom };
  }

  return {
    left: rect.top,
    top: window.innerWidth - rect.right,
    right: rect.bottom,
    bottom: window.innerWidth - rect.left,
  };
}

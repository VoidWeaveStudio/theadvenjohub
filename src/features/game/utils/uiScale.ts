// src/features/game/utils/uiScale.ts
const STORAGE_KEY = "tanjo_ui_scale";

export const UI_SCALE_MIN = 0.5;
export const UI_SCALE_MAX = 1;

const REFERENCE_SHORT_SIDE = 620;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return UI_SCALE_MAX;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, value));
}

export function defaultUiScale(): number {
  if (typeof window === "undefined") return UI_SCALE_MAX;

  const shortSide = Math.min(window.innerWidth, window.innerHeight);
  return clamp(Math.round((shortSide / REFERENCE_SHORT_SIDE) * 20) / 20);
}

export function getUiScale(): number {
  if (typeof window === "undefined") return UI_SCALE_MAX;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultUiScale();
    return clamp(Number.parseFloat(raw));
  } catch {
    return defaultUiScale();
  }
}

export function applyUiScale(value: number): void {
  if (typeof document === "undefined") return;
  document.documentElement.style.setProperty("--game-ui-scale", String(clamp(value)));
}

export function setUiScale(value: number): number {
  const next = clamp(value);

  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
  }

  applyUiScale(next);
  return next;
}

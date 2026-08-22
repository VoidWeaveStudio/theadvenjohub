// src/features/game/utils/touchSettings.ts
const STORAGE_KEY = "tanjo_touch_sensitivity";

export const TOUCH_SENSITIVITY_MIN = 0.6;
export const TOUCH_SENSITIVITY_MAX = 2.6;
export const TOUCH_SENSITIVITY_DEFAULT = 1.35;

function clamp(value: number): number {
  if (!Number.isFinite(value)) return TOUCH_SENSITIVITY_DEFAULT;
  return Math.min(TOUCH_SENSITIVITY_MAX, Math.max(TOUCH_SENSITIVITY_MIN, value));
}

export function getTouchSensitivity(): number {
  if (typeof window === "undefined") return TOUCH_SENSITIVITY_DEFAULT;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return TOUCH_SENSITIVITY_DEFAULT;
    return clamp(Number.parseFloat(raw));
  } catch {
    return TOUCH_SENSITIVITY_DEFAULT;
  }
}

export function setTouchSensitivity(value: number): number {
  const next = clamp(value);

  try {
    window.localStorage.setItem(STORAGE_KEY, String(next));
  } catch {
  }

  return next;
}

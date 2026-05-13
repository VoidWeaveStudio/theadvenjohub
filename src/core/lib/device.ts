//src\core\lib\device.ts
export function isMobile(): boolean {
  if (typeof window === "undefined") return false;
  
  const userAgent = navigator.userAgent || navigator.vendor || (window as any).opera;
  
  const mobileRegex = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i;
  
  const hasTouch = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  
  return mobileRegex.test(userAgent) || (hasTouch && window.innerWidth < 768);
}

export function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iPhone|iPad|iPod/i.test(navigator.userAgent);
}

export function isAndroid(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent);
}
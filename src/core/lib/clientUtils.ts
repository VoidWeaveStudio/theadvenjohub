// src/core/lib/clientUtils.ts


export function getCookie(name: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  
  if (parts.length === 2) {
    const raw = parts.pop()?.split(";").shift();
    if (raw) {
      return decodeURIComponent(raw.trim());
    }
  }
  return undefined;
}


export function getCsrfToken(): string | undefined {
  return getCookie("csrf_token");
}


export function formatDate(dateString: string, locale: string = "en-US"): string {
  try {
    return new Date(dateString).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return "Invalid date";
  }
}


export function formatDateTime(dateString: string, locale: string = "en-US"): string {
  try {
    return new Date(dateString).toLocaleDateString(locale, {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "Invalid date";
  }
}


export function getAuthorName(wallet: string | null | undefined): string {
  if (!wallet || wallet.length < 10) return "Unknown";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}

export function isClient(): boolean {
  return typeof window !== "undefined" && typeof document !== "undefined";
}
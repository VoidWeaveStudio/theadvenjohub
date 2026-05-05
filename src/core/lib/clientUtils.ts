//src\core\lib\clientUtils.ts
export function getCookie(name: string): string | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${name}=`);
  if (parts.length === 2) return parts.pop()?.split(';').shift() || null;
  return null;
}

export function getCsrfToken(): string {
  return getCookie("csrf_token") || "";
}

export function formatDate(dateString: string, locale: string = "en-US"): string {
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export function formatDateTime(dateString: string, locale: string = "en-US"): string {
  return new Date(dateString).toLocaleDateString(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export function getAuthorName(wallet: string | null | undefined): string {
  if (!wallet) return "Unknown";
  return `${wallet.slice(0, 6)}...${wallet.slice(-4)}`;
}
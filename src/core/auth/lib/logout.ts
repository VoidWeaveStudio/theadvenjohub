//src\core\auth\lib\logout.ts
"use client";

import { useRouter } from "next/navigation";

function clearAuthCookies() {
  const cookies = ["token", "refresh_token", "csrf_token", "session"];
  cookies.forEach((name) => {
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;`;
  });
}

export async function performLogout(
  disconnect: () => Promise<void>,
  router: ReturnType<typeof useRouter>
) {
  try {
    clearAuthCookies();
    await disconnect().catch(() => { });
    router.push("/");
    router.refresh();
  } catch (error) {
    console.error("Logout error:", error);
  }
}

export function useLogoutHandler() {
  const router = useRouter();

  return async (disconnect: () => Promise<void>) => {
    await performLogout(disconnect, router);
  };
}
// src/core/auth/lib/signMessage.ts

export type SignInPlatform = "web" | "desktop";

/**
 * Canonical domain embedded in the sign-in message so the wallet's
 * confirmation prompt shows a human-checkable domain, mirroring the intent
 * of SIWE/EIP-4361's `domain` field. Server-computed only (see challenge
 * route) — never trust a client-supplied domain when verifying.
 */
export function getExpectedDomain(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) {
    try {
      return new URL(configured).host;
    } catch {
      // fall through to defaults below
    }
  }
  return process.env.NODE_ENV === "production" ? "theadvenjo.online" : "localhost:3000";
}

export function buildSignInMessage(params: {
  domain: string;
  wallet: string;
  nonce: string;
  platform: SignInPlatform;
}): string {
  const { domain, wallet, nonce, platform } = params;
  const label = platform === "desktop" ? "TANJO Desktop" : "TANJO Game Store";
  return `${domain} wants you to sign in to ${label}\nWallet: ${wallet}\nNonce: ${nonce}`;
}

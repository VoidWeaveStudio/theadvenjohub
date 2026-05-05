// src/core/lib/admin.ts


export function isAdminWallet(walletAddress: string | null | undefined): boolean {
  if (!walletAddress || !process.env.NEXT_PUBLIC_ADMIN_WALLET) {
    return false;
  }
  return walletAddress.toLowerCase() === process.env.NEXT_PUBLIC_ADMIN_WALLET.toLowerCase();
}

export function requireAdmin(walletAddress: string | null | undefined): void {
  if (!isAdminWallet(walletAddress)) {
    throw new Error("Unauthorized: Admin access required");
  }
}
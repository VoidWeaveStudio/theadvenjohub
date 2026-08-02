// app/admin/login/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { buildSignInMessage } from "@/core/auth/lib/signMessage";

const WalletMultiButton = dynamic(
    () => import("@solana/wallet-adapter-react-ui").then((mod) => mod.WalletMultiButton),
    { ssr: false }
);

export default function AdminLoginPage() {
    const router = useRouter();
    const { publicKey, wallet, connected } = useWallet();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSignIn = async () => {
        if (!publicKey || !wallet?.adapter) return;

        setLoading(true);
        setError(null);

        try {
            const walletAddress = publicKey.toBase58();

            const challengeRes = await fetch(
                `/api/auth/challenge?wallet=${encodeURIComponent(walletAddress)}`,
                { method: "GET", credentials: "include" }
            );
            if (!challengeRes.ok) {
                const err = await challengeRes.json().catch(() => ({}));
                throw new Error(err.error || "Challenge failed");
            }

            const { nonce, domain, csrfToken } = await challengeRes.json();
            const message = buildSignInMessage({ domain, wallet: walletAddress, nonce, platform: "web" });
            const messageBytes = new TextEncoder().encode(message);

            const signMessageFn = (wallet.adapter as any).signMessage;
            if (typeof signMessageFn !== "function") {
                throw new Error("This wallet doesn't support message signing");
            }

            const signed = await signMessageFn.call(wallet.adapter, messageBytes);
            const signatureBytes = signed.signature || signed;
            const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

            const loginRes = await fetch("/api/admin/login", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", "x-csrf-token": csrfToken },
                body: JSON.stringify({ wallet: walletAddress, message, signature, nonce }),
            });

            if (!loginRes.ok) {
                const err = await loginRes.json().catch(() => ({}));
                throw new Error(err.error === "not_admin" ? "This wallet is not authorized" : (err.error || "Login failed"));
            }

            router.push("/admin");
        } catch (err: any) {
            setError(err.message || "Sign-in failed");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-black">
            <div className="w-full max-w-sm space-y-6 p-8 rounded-xl bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.08)]">
                <h1 className="text-white text-xl font-bold text-center">Admin Sign-In</h1>

                <div className="flex justify-center">
                    <WalletMultiButton />
                </div>

                {connected && (
                    <button
                        onClick={handleSignIn}
                        disabled={loading}
                        className="btn-primary w-full py-2.5 text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Signing..." : "Sign message to continue"}
                    </button>
                )}

                {error && (
                    <p className="text-xs text-red-400 text-center" role="alert">
                        {error}
                    </p>
                )}
            </div>
        </div>
    );
}

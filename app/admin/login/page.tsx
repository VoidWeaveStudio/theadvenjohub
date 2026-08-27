// app/admin/login/page.tsx
"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useWallet } from "@solana/wallet-adapter-react";
import { ShieldCheck } from "lucide-react";
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
        <div style={{ display: "flex", justifyContent: "center", paddingTop: "6vh" }}>
            <section className="a-panel" style={{ width: "100%", maxWidth: 380 }}>
                <header className="a-panel-head">
                    <span className="a-panel-title">
                        <ShieldCheck className="w-3 h-3" style={{ display: "inline", marginRight: 6 }} />
                        Admin sign-in
                    </span>
                </header>
                <div className="a-panel-body" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    <p className="a-hint">
                        Connect the admin wallet and sign a one-time message. The same wallet then signs every destructive
                        action inside the panel.
                    </p>

                    <div style={{ display: "flex", justifyContent: "center" }}>
                        <WalletMultiButton />
                    </div>

                    {connected && (
                        <button type="button" onClick={handleSignIn} disabled={loading} className="a-btn a-btn-primary" style={{ width: "100%" }}>
                            {loading ? "Signing…" : "Sign message to continue"}
                        </button>
                    )}

                    {error && (
                        <div className="a-alert" data-tone="bad" role="alert">
                            {error}
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}

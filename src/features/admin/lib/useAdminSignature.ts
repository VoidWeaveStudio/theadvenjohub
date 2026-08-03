// src/features/admin/lib/useAdminSignature.ts
"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { buildAdminActionMessage } from "@/core/admin/adminActionMessage";
import { getCsrfToken } from "@/core/lib/clientUtils";

export function useAdminSignature() {
    const { publicKey, wallet } = useWallet();

    async function signAction(action: string, target: string): Promise<{ wallet: string; signature: string; timestamp: number }> {
        if (!publicKey || !wallet?.adapter) {
            throw new Error("Connect your admin wallet first");
        }

        const timestamp = Date.now();
        const message = buildAdminActionMessage(action, target, timestamp);
        const messageBytes = new TextEncoder().encode(message);

        const signMessageFn = (wallet.adapter as any).signMessage;
        if (typeof signMessageFn !== "function") {
            throw new Error("This wallet doesn't support message signing");
        }

        const signed = await signMessageFn.call(wallet.adapter, messageBytes);
        const signatureBytes = signed.signature || signed;
        const signature = btoa(String.fromCharCode(...new Uint8Array(signatureBytes)));

        return { wallet: publicKey.toBase58(), signature, timestamp };
    }

    async function signedFetch(url: string, action: string, target: string, extraBody: Record<string, unknown> = {}, method: string = "PATCH") {
        const sig = await signAction(action, target);
        const csrfToken = getCsrfToken();

        return fetch(url, {
            method,
            credentials: "include",
            headers: {
                "Content-Type": "application/json",
                ...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
            },
            body: JSON.stringify({ ...extraBody, ...sig }),
        });
    }

    return { signAction, signedFetch };
}

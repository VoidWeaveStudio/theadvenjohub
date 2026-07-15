// src/features/game/world/locations/tower/SolanaMintListener.ts
import { Connection, PublicKey } from "@solana/web3.js";

export interface RawMintData {
    address: string;
    supply: bigint;
}

export class SolanaMintListener {
    private connection: Connection;
    private subscriptionId: number | null = null;
    private readonly TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
    
    private readonly RPC_URL = "wss://api.mainnet-beta.solana.com"; 

    public onNewMint?: (data: RawMintData) => void;

    constructor() {
        this.connection = new Connection(this.RPC_URL, "confirmed");
    }

    public start() {
        if (this.subscriptionId !== null) return;

        console.log("👂 [SolanaListener] n");

        this.subscriptionId = this.connection.onProgramAccountChange(
            this.TOKEN_PROGRAM_ID,
            (info) => {
                const data = info.accountInfo.data;

                if (data.length === 82) {
                    const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
                    const supply = view.getBigUint64(36, true);

                    if (supply > 0n) {
                        const isLikelyMeme = supply >= 1_000_000n && supply <= 10_000_000_000n;

                        if (isLikelyMeme) {
                            const address = info.accountId.toBase58();
                            this.onNewMint?.({ address, supply });
                        }
                    }
                }
            },
            "confirmed"
        );
    }

    public stop() {
        if (this.subscriptionId !== null) {
            this.connection.removeProgramAccountChangeListener(this.subscriptionId);
            this.subscriptionId = null;
            console.log("🔇 [SolanaListener] n.");
        }
    }
}
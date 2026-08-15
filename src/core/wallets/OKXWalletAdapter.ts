// src/core/wallets/OKXWalletAdapter.ts
import {
  BaseWalletAdapter,
  WalletConnectionError,
  WalletDisconnectedError,
  WalletName,
  WalletNotReadyError,
  WalletPublicKeyError,
  WalletReadyState,
  WalletSignMessageError,
  WalletSignTransactionError,
  WalletSendTransactionError,
  scopePollingDetectionStrategy,
} from "@solana/wallet-adapter-base";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export const OKXWalletName = "OKX Wallet" as WalletName<"OKX Wallet">;

interface OKXPublicKey {
  toBytes(): Uint8Array;
  toBase58(): string;
}

interface OKXWallet {
  isOKXWallet?: boolean;
  publicKey?: OKXPublicKey;
  isConnected: boolean;
  signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T>;
  signAllTransactions<T extends Transaction | VersionedTransaction>(transactions: T[]): Promise<T[]>;
  signMessage(message: Uint8Array): Promise<Uint8Array | { signature: Uint8Array }>;
  sendTransaction?(transaction: Transaction | VersionedTransaction, connection: any, options?: any): Promise<string>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(event: string, handler: (...args: any[]) => void): void;
  off(event: string, handler: (...args: any[]) => void): void;
}

interface OKXWindow extends Window {
  okxwallet?: {
    solana?: OKXWallet;
  };
}

function getOKXWallet(): OKXWallet | null {
  if (typeof window === "undefined") return null;
  return (window as OKXWindow).okxwallet?.solana || null;
}

export class OKXWalletAdapter extends BaseWalletAdapter {
  name = OKXWalletName;
  url = "https://www.okx.com/web3";
  icon = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHJ4PSI2IiBmaWxsPSIjMDAwIi8+PGcgZmlsbD0iI2ZmZiI+PHJlY3QgeD0iNyIgeT0iNyIgd2lkdGg9IjYiIGhlaWdodD0iNiIvPjxyZWN0IHg9IjEzIiB5PSIxMyIgd2lkdGg9IjYiIGhlaWdodD0iNiIvPjxyZWN0IHg9IjE5IiB5PSI3IiB3aWR0aD0iNiIgaGVpZ2h0PSI2Ii8+PHJlY3QgeD0iNyIgeT0iMTkiIHdpZHRoPSI2IiBoZWlnaHQ9IjYiLz48cmVjdCB4PSIxOSIgeT0iMTkiIHdpZHRoPSI2IiBoZWlnaHQ9IjYiLz48L2c+PC9zdmc+";

  private _wallet: OKXWallet | null;
  private _publicKey: PublicKey | null;
  private _connecting: boolean;
  private _readyState: WalletReadyState;

  constructor() {
    super();
    this._wallet = null;
    this._publicKey = null;
    this._connecting = false;
    this._readyState =
      typeof window === "undefined" || typeof document === "undefined"
        ? WalletReadyState.Unsupported
        : WalletReadyState.NotDetected;

    if (this._readyState !== WalletReadyState.Unsupported) {
      scopePollingDetectionStrategy(() => {
        const wallet = getOKXWallet();
        if (!wallet) return false;

        this._readyState = wallet.isOKXWallet ? WalletReadyState.Installed : WalletReadyState.Loadable;
        this.emit("readyStateChange", this._readyState);
        return true;
      });
    }
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    return this._readyState;
  }

  get supportedTransactionVersions() {
    return new Set(["legacy", 0] as const);
  }

  private _disconnected = () => {
    const wallet = this._wallet;
    if (!wallet) return;

    wallet.off("disconnect", this._disconnected);
    wallet.off("accountChanged", this._accountChanged);

    this._wallet = null;
    this._publicKey = null;

    this.emit("error", new WalletDisconnectedError());
    this.emit("disconnect");
  };

  private _accountChanged = (newPublicKey?: OKXPublicKey | null) => {
    if (!newPublicKey) {
      this._disconnected();
      return;
    }

    try {
      const publicKey = new PublicKey(newPublicKey.toBytes());
      if (this._publicKey?.equals(publicKey)) return;

      this._publicKey = publicKey;
      this.emit("connect", publicKey);
    } catch (error: any) {
      this.emit("error", new WalletPublicKeyError(error?.message));
    }
  };

  async connect(): Promise<void> {
    try {
      if (this.connected || this._connecting) return;
      if (this._readyState === WalletReadyState.Unsupported) throw new WalletNotReadyError();

      this._connecting = true;

      const wallet = getOKXWallet();

      if (!wallet) {
        throw new WalletNotReadyError();
      }

      if (!wallet.isConnected) {
        await wallet.connect();
      }

      if (!wallet.publicKey) {
        throw new WalletPublicKeyError("Public key not found");
      }

      let publicKey: PublicKey;
      try {
        publicKey = new PublicKey(wallet.publicKey.toBytes());
      } catch (error: any) {
        throw new WalletPublicKeyError(error?.message);
      }

      wallet.on("disconnect", this._disconnected);
      wallet.on("accountChanged", this._accountChanged);

      this._wallet = wallet;
      this._publicKey = publicKey;

      this.emit("connect", publicKey);
    } catch (error: any) {
      console.error("[OKX Wallet] Connection error:", error);
      this.emit("error", new WalletConnectionError(error?.message));
      throw error;
    } finally {
      this._connecting = false;
    }
  }

  async disconnect(): Promise<void> {
    const wallet = this._wallet;
    if (wallet) {
      wallet.off("disconnect", this._disconnected);
      wallet.off("accountChanged", this._accountChanged);

      this._wallet = null;
      this._publicKey = null;

      try {
        await wallet.disconnect();
      } catch (error: any) {
        console.error("[OKX Wallet] Disconnection error:", error);
        this.emit("error", new WalletDisconnectedError(error?.message));
      }
    }

    this._wallet = null;
    this._publicKey = null;

    this.emit("disconnect");
  }

  async signTransaction<T extends Transaction | VersionedTransaction>(transaction: T): Promise<T> {
    try {
      const wallet = this._wallet;
      if (!wallet) throw new WalletDisconnectedError();
      return await wallet.signTransaction(transaction);
    } catch (error: any) {
      console.error("[OKX Wallet] Sign transaction error:", error);
      this.emit("error", new WalletSignTransactionError(error?.message));
      throw error;
    }
  }

  async signMessage(message: Uint8Array): Promise<Uint8Array> {
    try {
      const wallet = this._wallet;
      if (!wallet) throw new WalletDisconnectedError();

      const result = await wallet.signMessage(message);

      const signature = result instanceof Uint8Array ? result : (result as any).signature;

      if (!signature) {
        throw new Error("Invalid signature format from OKX wallet");
      }

      return signature;
    } catch (error: any) {
      console.error("[OKX Wallet] Sign message error:", error);
      this.emit("error", new WalletSignMessageError(error?.message));
      throw error;
    }
  }

  async sendTransaction<T extends Transaction | VersionedTransaction>(
    transaction: T,
    connection: any,
    options?: any
  ): Promise<string> {
    try {
      const wallet = this._wallet;
      if (!wallet) throw new WalletDisconnectedError();

      if (wallet.sendTransaction) {
        return await wallet.sendTransaction(transaction, connection, options);
      }

      const signedTransaction = await wallet.signTransaction(transaction);
      const rawTransaction = signedTransaction.serialize();
      const signature = await connection.sendRawTransaction(rawTransaction, options);
      return signature;
    } catch (error: any) {
      console.error("[OKX Wallet] Send transaction error:", error);
      this.emit("error", new WalletSendTransactionError(error?.message));
      throw error;
    }
  }
}

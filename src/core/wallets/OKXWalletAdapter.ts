//src\core\wallets\OKXWalletAdapter.ts
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
} from "@solana/wallet-adapter-base";
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js";

export const OKXWalletName = "OKX Wallet" as WalletName<"OKX Wallet">;

interface OKXWallet {
  isOKXWallet?: boolean;
  publicKey?: { toBytes(): Uint8Array; toBase58(): string };
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
  icon = "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzIiIGhlaWdodD0iMzIiIHZpZXdCb3g9IjAgMCAzMiAzMiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KPHJlY3Qgd2lkdGg9IjMyIiBoZWlnaHQ9IjMyIiByeD0iNiIgZmlsbD0iIzAwMCIvPgo8cGF0aCBkPSJNOS41IDExLjVIOVYxMEg5LjVDMTAuMzI4IDEwIDExIDEwLjY3MiAxMSAxMS41VjEyLjVIMTAuNVYxMS41SDkuNVpNMTUuNSAxMS41SDE1VjEwSDE1LjVDMTYuMzI4IDEwIDE3IDEwLjY3MiAxNyAxMS41VjEyLjVIMTYuNVYxMS41SDE1LjVaTTIxLjUgMTEuNUgyMVYxMEgyMS41QzIyLjMyOCAxMCAyMyAxMC42NzIgMjMgMTEuNVYxMi41SDIyLjVWMTEuNUgyMS41Wk05LjUgMTUuNUg5VjE0SDkuNUMxMC4zMjggMTQgMTEgMTQuNjcyIDExIDE1LjVWMTYuNUgxMC41VjE1LjVIOS41Wk0xNS41IDE1LjVIMTVWMTROMEg5LjVDMTAuMzI4IDE0IDExIDE0LjY3MiAxMSAxNS41VjE2LjVIMTAuNVYxNS41SDE1LjVaTTIxLjUgMTUuNUgyMVYxNEgyMS41QzIyLjMyOCAxNCAyMyAxNC42NzIgMjMgMTUuNVYxNi41SDIyLjVWMTUuNUgyMS41Wk05LjUgMTkuNUg5VjE4SDkuNUMxMC4zMjggMTggMTEgMTguNjcyIDExIDE5LjVWMjAuNUgxMC41VjE5LjVIOS41Wk0xNS41IDE5LjVIMTVWMTNONEg5LjVDMTAuMzI4IDE4IDExIDE4LjY3MiAxMSAxOS41VjIwLjVIMTAuNVYxOS41SDE1LjVaTTIxLjUgMTkuNUgyMVYxOEgyMS41QzIyLjMyOCAxOCAyMyAxOC42NzIgMjMgMTkuNVYyMC41SDIyLjVWMTkuNUgyMS41WiIgZmlsbD0id2hpdGUiLz4KPC9zdmc+Cg==";
  
  private _wallet: OKXWallet | null;
  private _publicKey: PublicKey | null;
  private _connecting: boolean;

  constructor() {
    super();
    this._wallet = null;
    this._publicKey = null;
    this._connecting = false;
  }

  get publicKey(): PublicKey | null {
    return this._publicKey;
  }

  get connecting(): boolean {
    return this._connecting;
  }

  get readyState(): WalletReadyState {
    const wallet = getOKXWallet();
    if (!wallet) return WalletReadyState.NotDetected;
    if (wallet.isOKXWallet) return WalletReadyState.Installed;
    return WalletReadyState.Loadable;
  }

  get supportedTransactionVersions() {
    return new Set(["legacy", 0] as const);
  }

  async connect(): Promise<void> {
    try {
      if (this.connected || this._connecting) return;

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
      try {
        await wallet.disconnect();
      } catch (error: any) {
        console.error("[OKX Wallet] Disconnection error:", error);
        this.emit("error", new WalletDisconnectedError(error?.message));
        throw error;
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
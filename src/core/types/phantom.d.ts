//src\core\types\phantom.d.ts
export interface PhantomProvider {
  publicKey?: {
    toBase58(): string;
  };
  isConnected: boolean;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  on(event: string, callback: (args: any) => void): void;
  removeListener(event: string, callback: (args: any) => void): void;
}

export interface PhantomSolana {
  isPhantom?: boolean;
  provider?: PhantomProvider;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  signMessage(message: Uint8Array): Promise<Uint8Array>;
  publicKey?: {
    toBase58(): string;
  };
  isConnected: boolean;
}

declare global {
  interface Window {
    phantom?: {
      solana?: PhantomSolana;
    };
  }
}

export { };
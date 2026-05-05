//src\core\types\solana.d.ts
declare module "@solana/spl-token" {
  import { PublicKey, TransactionInstruction, AccountMeta } from "@solana/web3.js";

  export const TOKEN_PROGRAM_ID: PublicKey;

  export function getAssociatedTokenAddress(
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
  ): Promise<PublicKey>;

  export function getOrCreateAssociatedTokenAccount(
    connection: any,
    payer: any,
    mint: PublicKey,
    owner: PublicKey,
    allowOwnerOffCurve?: boolean,
    commitment?: any,
    confirmOptions?: any,
    programId?: PublicKey,
    associatedTokenProgramId?: PublicKey
  ): Promise<any>;

  export function createTransferInstruction(
    source: PublicKey,
    destination: PublicKey,
    owner: PublicKey,
    amount: number | bigint,
    multiSigners?: any[],
    programId?: PublicKey
  ): TransactionInstruction;
}
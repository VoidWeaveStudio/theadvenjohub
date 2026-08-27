// src/features/game/utils/factionTint.ts
const PALETTE = [
    0x6fd8ff, 0xffb347, 0x9d6bff, 0x59e07d, 0xff5f8f,
    0x4fd1c5, 0xffd166, 0xc084fc, 0x60a5fa, 0xf87171,
];

export function factionTint(factionId: string): number {
    let hash = 0;
    for (let i = 0; i < factionId.length; i++) {
        hash = (Math.imul(hash, 31) + factionId.charCodeAt(i)) | 0;
    }
    return PALETTE[Math.abs(hash) % PALETTE.length];
}

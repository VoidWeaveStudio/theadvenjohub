// src/features/game/ui/WeaponIcon.tsx
"use client";

interface WeaponIconProps {
    itemId: string;
    className?: string;
}

const PATHS: Record<string, string> = {
    "rug-beater":
        "M3 15.4 L6.2 14.4 L20.6 8.9 L21.6 11.1 L7.4 16.6 L4.2 17.2 Z"
        + " M20.4 8.6 L24.6 6.9 A2.6 2.6 0 0 1 27 8 L27.9 9.9 A2.2 2.2 0 0 1 26.8 12.6 L22.2 14.3 Z"
        + " M6.6 14.2 L8 17.6 L6.2 18.2 L5 15.1 Z",
    "dust-nine":
        "M6 6.2 H23.6 V10 H21.8 L21.8 11.4 H12.4 L14.2 18.4 H9.6 L7.2 11.4 H6 Z"
        + " M23.8 7.2 H26.8 V9 H23.8 Z"
        + " M11.6 11.6 H16.4 A3.2 3.2 0 0 1 13.4 14.2 H12.4 Z",
    "whale-cannon":
        "M4.4 5.4 H24 V9.8 H21.6 V11.4 H11.6 L13.8 19 H8.6 L6 11.4 H4.4 Z"
        + " M24.2 6 H28.6 V9.2 H24.2 Z"
        + " M4.6 10.2 H20 V11.2 H4.6 Z"
        + " M10.8 11.6 H16.2 A3.4 3.4 0 0 1 12.8 14.6 H11.8 Z",
    "pump-rifle":
        "M1.6 8.2 H13.4 V10 H1.6 Z"
        + " M4.6 6.6 H7 V8.4 H4.6 Z"
        + " M8.8 7 H12.6 V8.4 H8.8 Z"
        + " M12.6 6 H24.2 V11.4 H12.6 Z"
        + " M13.6 11.6 C13.6 15.4 15 17.4 17.6 18.4 L20.6 18.4 C18.6 16.8 17.8 14.4 17.8 11.6 Z"
        + " M19.4 11.6 H23 L21.4 17.6 H18.6 Z"
        + " M24.2 7 L30.4 8.6 V12.4 L24.2 10.6 Z",
    "bluechip-rifle":
        "M1.4 8 H12.8 V9.8 H1.4 Z"
        + " M3.4 6.6 H6.2 V8.2 H3.4 Z"
        + " M12.8 5.6 H23.6 V11.2 H12.8 Z"
        + " M13.6 4.2 H22.4 V5.6 H13.6 Z"
        + " M16.8 11.4 H20.4 V17.8 H16.8 Z"
        + " M20.8 11.4 H23.2 C23.2 14 22.4 15.6 20.8 16.6 Z"
        + " M23.6 6.6 H30.6 V10.6 H23.6 Z"
        + " M26.4 10.6 H30.4 V12.6 H26.4 Z",
    "moon-ladder":
        "M0.6 8.6 H14.6 V10 H0.6 Z"
        + " M3.2 7.4 H5 V8.8 H3.2 Z M7.4 7.4 H9.2 V8.8 H7.4 Z M11.6 7.4 H13.4 V8.8 H11.6 Z"
        + " M14.6 6.4 H24.4 V11.2 H14.6 Z"
        + " M15.8 2.6 H23.4 V5 H15.8 Z M14.6 2.8 H15.8 V4.8 H14.6 Z M23.4 2.8 H24.6 V4.8 H23.4 Z"
        + " M18.4 5 H20.8 V6.4 H18.4 Z"
        + " M17.4 11.4 H20 L19 15.6 H16.6 Z"
        + " M24.4 7.2 L31.4 8.4 V12 L24.4 10.8 Z"
        + " M24.4 11 H27.6 V13.4 H24.4 Z",
    "cold-wallet":
        "M10 3.4 H22 L24.2 6 V13.4 A5.4 5.4 0 0 1 16 18.4 A5.4 5.4 0 0 1 7.8 13.4 V6 Z"
        + " M14.6 3.4 H17.4 V17.6 H14.6 Z",
    "seed-phrase":
        "M10 6.4 H22 L24.2 8.6 V14 A5.4 5.4 0 0 1 16 18.6 A5.4 5.4 0 0 1 7.8 14 V8.6 Z"
        + " M14.8 6.4 H17.2 V18 H14.8 Z"
        + " M16 0.8 A6.4 6.4 0 0 1 22.4 6.2 H20 A4.2 4.2 0 0 0 12 6.2 H9.6 A6.4 6.4 0 0 1 16 0.8 Z",
    "rug-flash":
        "M13 5.6 H19 V16.2 A2.6 2.6 0 0 1 16.4 18.8 H15.6 A2.6 2.6 0 0 1 13 16.2 Z"
        + " M14 2.6 H18 V5.6 H14 Z"
        + " M18.4 2.2 H21.4 V3.6 H19.6 V8.4 H18.4 Z"
        + " M12.6 8.2 H19.4 V9.6 H12.6 Z",
    "fud-cloud":
        "M12.4 6 H19.6 A2.4 2.4 0 0 1 22 8.4 V16 A2.6 2.6 0 0 1 19.4 18.6 H12.6 A2.6 2.6 0 0 1 10 16 V8.4 A2.4 2.4 0 0 1 12.4 6 Z"
        + " M14.2 2.8 H17.8 V6 H14.2 Z"
        + " M18.2 2.4 H21.2 V3.8 H19.4 V8 H18.2 Z"
        + " M10.4 10.4 H21.6 V11.8 H10.4 Z M10.4 13.4 H21.6 V14.8 H10.4 Z",
    liquidation:
        "M16 4.6 A6 6 0 0 1 22 11.6 A6 6 0 0 1 16 18.8 A6 6 0 0 1 10 11.6 A6 6 0 0 1 16 4.6 Z"
        + " M14.2 1.8 H17.8 V5 H14.2 Z"
        + " M18.2 1.4 H21.4 V2.8 H19.6 V6.4 H18.2 Z"
        + " M10.6 9 H21.4 V10.2 H10.6 Z M10.6 12.6 H21.4 V13.8 H10.6 Z",
    "audit-kit":
        "M5.4 3.6 L15.4 12.2 L13.2 14.6 L4 5.6 Z"
        + " M26.6 3.6 L16.6 12.2 L18.8 14.6 L28 5.6 Z"
        + " M13.4 13.6 H18.6 V17.2 A2.6 2.6 0 0 1 13.4 17.2 Z"
        + " M2.4 2.2 H7 V4.6 H2.4 Z M25 2.2 H29.6 V4.6 H25 Z",
};

const SLOT_FALLBACK: Record<string, string> = {
    primary: "pump-rifle",
    pistol: "dust-nine",
    melee: "rug-beater",
    armor: "cold-wallet",
    grenade: "liquidation",
    kit: "audit-kit",
};

export function weaponIconPath(itemId: string, slot?: string): string {
    return PATHS[itemId] ?? PATHS[SLOT_FALLBACK[slot ?? ""] ?? "dust-nine"];
}

export function WeaponIcon({ itemId, className }: WeaponIconProps) {
    return (
        <svg viewBox="0 0 32 20" className={className} aria-hidden="true" focusable="false">
            <path d={weaponIconPath(itemId)} fill="currentColor" fillRule="evenodd" />
        </svg>
    );
}

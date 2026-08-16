// src/features/game/ui/hooks/useProgressionState.ts
import { useCallback, useRef, useState } from "react";
import { ProgressionStateData, XpGainData, LevelUpData, PlayerLevelUpdateData } from "../../network/NetworkManager";

export interface XpPopup {
    id: number;
    amount: number;
    source: string;
}

const XP_POPUP_LIFETIME_MS = 2200;
const LEVEL_UP_LIFETIME_MS = 6000;

export function useProgressionState() {
    const [progression, setProgression] = useState<ProgressionStateData | null>(null);
    const [xpPopups, setXpPopups] = useState<XpPopup[]>([]);
    const [levelUp, setLevelUp] = useState<LevelUpData | null>(null);
    const [otherPlayerLevels, setOtherPlayerLevels] = useState<Record<string, { level: number; tier: string }>>({});

    const popupIdRef = useRef(0);

    const handleProgressionState = useCallback((data: ProgressionStateData) => {
        setProgression(data);
    }, []);

    const handleXpGain = useCallback((data: XpGainData) => {
        const id = ++popupIdRef.current;

        setProgression((prev) =>
            prev
                ? {
                    ...prev,
                    totalXp: data.totalXp,
                    level: data.level,
                    xpIntoLevel: data.xpIntoLevel,
                    xpForLevel: data.xpForLevel,
                }
                : prev
        );

        setXpPopups((prev) => [...prev, { id, amount: data.amount, source: data.source }]);
        setTimeout(() => setXpPopups((prev) => prev.filter((p) => p.id !== id)), XP_POPUP_LIFETIME_MS);
    }, []);

    const handleLevelUp = useCallback((data: LevelUpData) => {
        setLevelUp(data);
        setTimeout(() => setLevelUp((current) => (current === data ? null : current)), LEVEL_UP_LIFETIME_MS);
    }, []);

    const handlePlayerLevelUpdate = useCallback((data: PlayerLevelUpdateData) => {
        setOtherPlayerLevels((prev) => ({
            ...prev,
            [data.playerId]: { level: data.level, tier: data.tier },
        }));
    }, []);

    const dismissLevelUp = useCallback(() => setLevelUp(null), []);

    return {
        progression,
        xpPopups,
        levelUp,
        otherPlayerLevels,
        handleProgressionState,
        handleXpGain,
        handleLevelUp,
        handlePlayerLevelUpdate,
        dismissLevelUp,
    };
}

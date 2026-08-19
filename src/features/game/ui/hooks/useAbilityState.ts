// src/features/game/ui/hooks/useAbilityState.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { AbilityMeterData, AbilityResultData, ProgressionStateData } from "../../network/NetworkManager";

const ENERGY_TICK_MS = 120;

// Returns a key, like the other error mappers — the caller runs it through t().
const REJECTION_MESSAGES: Record<string, string> = {
    cooldown: "g.ability.reject.cooldown",
    energy: "g.ability.reject.energy",
    safe_zone: "g.ability.reject.safeZone",
    no_target: "g.ability.reject.noTarget",
    not_bound: "g.ability.reject.notBound",
    not_learned: "g.ability.reject.notLearned",
    dead: "g.ability.reject.dead",
    bad_aim: "g.ability.reject.badAim",
};

export function rejectionMessage(reason: string | undefined): string {
    if (!reason) return "g.ability.reject.default";
    return REJECTION_MESSAGES[reason] ?? "g.ability.reject.default";
}

export function useAbilityState(progression: ProgressionStateData | null) {
    const [cooldowns, setCooldowns] = useState<Record<string, number>>({});
    const [energy, setEnergy] = useState(0);
    const [shield, setShield] = useState(0);

    const maxEnergy = progression?.stats?.maxEnergy ?? 100;
    const energyRegen = progression?.stats?.energyRegen ?? 0;

    const maxEnergyRef = useRef(maxEnergy);
    const regenRef = useRef(energyRegen);

    maxEnergyRef.current = maxEnergy;
    regenRef.current = energyRegen;

    useEffect(() => {
        if (!progression) return;

        setEnergy(progression.energy ?? progression.stats?.maxEnergy ?? 0);
        setCooldowns(progression.cooldowns ?? {});
    }, [progression]);

    useEffect(() => {
        const timer = window.setInterval(() => {
            setEnergy((current) => {
                if (current >= maxEnergyRef.current) return maxEnergyRef.current;
                return Math.min(maxEnergyRef.current, current + regenRef.current * (ENERGY_TICK_MS / 1000));
            });
        }, ENERGY_TICK_MS);

        return () => window.clearInterval(timer);
    }, []);

    const handleAbilityResult = useCallback((data: AbilityResultData) => {
        if (!data.ok) return;

        if (data.cooldowns) setCooldowns(data.cooldowns);
        else if (typeof data.readyAt === "number") {
            setCooldowns((prev) => ({ ...prev, [data.abilityId]: data.readyAt as number }));
        }

        if (typeof data.energy === "number") setEnergy(data.energy);
    }, []);

    const handleAbilityMeter = useCallback((data: AbilityMeterData) => {
        setEnergy(data.energy);
        setShield(data.shield);
    }, []);

    return {
        cooldowns,
        energy,
        shield,
        maxEnergy,
        handleAbilityResult,
        handleAbilityMeter,
    };
}

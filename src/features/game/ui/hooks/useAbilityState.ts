// src/features/game/ui/hooks/useAbilityState.ts
import { useCallback, useEffect, useRef, useState } from "react";
import { AbilityMeterData, AbilityResultData, ProgressionStateData } from "../../network/NetworkManager";

const ENERGY_TICK_MS = 120;

const REJECTION_MESSAGES: Record<string, string> = {
    cooldown: "Skill is still recharging",
    energy: "Not enough energy",
    safe_zone: "Cannot use combat skills in a safe zone",
    no_target: "No target in sight",
    not_bound: "Bind that skill to a slot first",
    not_learned: "You have not learned that skill",
    dead: "You are down",
    bad_aim: "Could not read your aim",
};

export function rejectionMessage(reason: string | undefined): string {
    if (!reason) return "Could not use that skill";
    return REJECTION_MESSAGES[reason] ?? "Could not use that skill";
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

// src/features/game/core/defusalAudio.ts
import { SoundManager, SoundHandle } from "./SoundManager";
import type { DefusalSide, DefusalStateData } from "../network/NetworkManager";

const BEEP_MIN_MS = 150;
const BEEP_MAX_MS = 950;
const BEEP_DIVISOR = 45;
const WARNING_AT_MS = 10000;

let beepTimer: number | null = null;
let channel: SoundHandle | null = null;
let channelKind: "plant" | "defuse" | null = null;
let warned = false;
let phase: string | null = null;
let localSide: DefusalSide | null = null;

function stopBeep() {
    if (beepTimer !== null) {
        window.clearTimeout(beepTimer);
        beepTimer = null;
    }
    warned = false;
}

function beep(explodesAt: number) {
    const remaining = explodesAt - Date.now();
    if (remaining <= 0) {
        stopBeep();
        return;
    }

    SoundManager.getInstance().play("bomb-beep", { volume: 0.5 });

    if (!warned && remaining <= WARNING_AT_MS) {
        warned = true;
        SoundManager.getInstance().play("ten-second", { volume: 0.45 });
    }

    const interval = Math.max(BEEP_MIN_MS, Math.min(BEEP_MAX_MS, remaining / BEEP_DIVISOR));
    beepTimer = window.setTimeout(() => beep(explodesAt), interval);
}

function stopChannel() {
    channel?.stop(0.05);
    channel = null;
    channelKind = null;
}

function setChannel(kind: "plant" | "defuse" | null) {
    if (kind === channelKind) return;
    stopChannel();
    if (!kind) return;

    channelKind = kind;
    channel = SoundManager.getInstance().playLoop(
        kind === "plant" ? "bomb-plant-loop" : "defuse-loop",
        { volume: 0.4 }
    );
}

export function updateDefusalAudio(state: DefusalStateData, localPlayerId: string | null) {
    const me = localPlayerId ? state.roster.find((entry) => entry.id === localPlayerId) : null;
    if (me) localSide = me.side;

    if (state.phase !== phase) {
        if (state.phase === "live" && phase !== null) {
            SoundManager.getInstance().play("round-start", { volume: 0.5 });
        }
        phase = state.phase;
    }

    const bomb = state.bomb;

    if (bomb?.state === "planted") {
        if (beepTimer === null) beep(bomb.explodesAt);
    } else {
        stopBeep();
    }

    setChannel(bomb?.planting ? "plant" : bomb?.defusing ? "defuse" : null);
}

export function playDefusalRoundEnd(winner: DefusalSide) {
    stopBeep();
    stopChannel();
    if (!localSide) return;
    SoundManager.getInstance().play(winner === localSide ? "round-win" : "round-lose", { volume: 0.55 });
}

export function playDefusalMatchEnd(winner: DefusalSide) {
    stopBeep();
    stopChannel();
    if (!localSide) return;
    SoundManager.getInstance().play(winner === localSide ? "sting-victory" : "sting-defeat", { volume: 0.6 });
}

export function playBombResolved(defused: boolean) {
    stopBeep();
    stopChannel();
    SoundManager.getInstance().play(defused ? "bomb-defused" : "bomb-explode", { volume: 0.7 });
}

export function resetDefusalAudio() {
    stopBeep();
    stopChannel();
    phase = null;
    localSide = null;
}

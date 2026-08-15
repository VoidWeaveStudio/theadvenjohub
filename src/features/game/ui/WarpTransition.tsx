// src/features/game/ui/WarpTransition.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";

interface WarpTransitionProps {
    active: boolean;
    progress: number;
    message: string;
}

type Phase = "idle" | "pull" | "travel" | "push";

const PULL_MS = 560;
const PUSH_MS = 780;

const RING_COUNT = 16;
const COIN_COUNT = 11;
const TUNNEL_DEPTH = 3200;
const RING_CYCLE = 3.1;
const COIN_CYCLE = 4.2;

const COIN_FACES = ["◎", "Ð", "$", "₿", "ASH", "◎", "Ξ", "$", "Ð", "ASH", "₿"];

const COIN_SKINS = [
    { rim: "#ffd76a", face: "#7a4b00", glow: "rgba(255, 200, 80, 0.55)" },
    { rim: "#7ef0ff", face: "#053b47", glow: "rgba(90, 230, 255, 0.5)" },
    { rim: "#ff7ad1", face: "#4a0730", glow: "rgba(255, 110, 200, 0.5)" },
    { rim: "#b6ff7a", face: "#123d05", glow: "rgba(160, 255, 110, 0.45)" },
];

const WARP_CSS = `
.warp-root {
    position: absolute;
    inset: 0;
    z-index: 50;
    overflow: hidden;
    background:
        radial-gradient(circle at 50% 50%, #1a0b3d 0%, #0a0320 45%, #030109 100%);
    perspective: 460px;
    perspective-origin: 50% 50%;
    contain: strict;
}

.warp-root[data-phase="idle"] {
    opacity: 0;
    pointer-events: none;
}

.warp-camera {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 0;
    height: 0;
    transform-style: preserve-3d;
    will-change: transform, opacity;
}

.warp-root[data-phase="pull"] .warp-camera {
    animation: warp-pull ${PULL_MS}ms cubic-bezier(0.32, 0.72, 0.36, 1) both;
}

.warp-root[data-phase="push"] .warp-camera {
    animation: warp-push ${PUSH_MS}ms cubic-bezier(0.52, 0, 0.72, 0.42) both;
}

.warp-root[data-phase="idle"] .warp-ring,
.warp-root[data-phase="idle"] .warp-coin,
.warp-root[data-phase="idle"] .warp-exit-core,
.warp-root[data-phase="idle"] .warp-grid {
    animation-play-state: paused;
}

.warp-ring {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 620px;
    height: 620px;
    margin-left: -310px;
    margin-top: -310px;
    border-radius: 50%;
    border: 3px solid rgba(56, 226, 255, 0.9);
    background: radial-gradient(closest-side,
        rgba(56, 226, 255, 0) 78%,
        rgba(56, 226, 255, 0.22) 92%,
        rgba(56, 226, 255, 0) 100%);
    backface-visibility: hidden;
    will-change: transform, opacity;
    animation: warp-fly ${RING_CYCLE}s linear infinite;
}

.warp-ring.magenta {
    border-color: rgba(255, 46, 152, 0.9);
    background: radial-gradient(closest-side,
        rgba(255, 46, 152, 0) 78%,
        rgba(255, 46, 152, 0.22) 92%,
        rgba(255, 46, 152, 0) 100%);
}

.warp-ring.violet {
    border-color: rgba(178, 92, 255, 0.85);
    border-width: 2px;
    background: radial-gradient(closest-side,
        rgba(178, 92, 255, 0) 80%,
        rgba(178, 92, 255, 0.18) 93%,
        rgba(178, 92, 255, 0) 100%);
}

.warp-ring.thin {
    border-width: 1px;
    width: 520px;
    height: 520px;
    margin-left: -260px;
    margin-top: -260px;
}

.warp-coin {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 74px;
    height: 74px;
    margin-left: -37px;
    margin-top: -37px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    font-family: ui-monospace, monospace;
    font-weight: 700;
    letter-spacing: 0.02em;
    will-change: transform, opacity;
    animation: warp-coin-fly ${COIN_CYCLE}s linear infinite;
}

.warp-coin-inner {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    will-change: transform;
    animation: warp-coin-spin 2.4s linear infinite;
}

.warp-grid {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 1400px;
    height: 1400px;
    margin-left: -700px;
    margin-top: -700px;
    background-image:
        repeating-linear-gradient(0deg, rgba(120, 60, 220, 0.22) 0 1px, transparent 1px 70px),
        repeating-linear-gradient(90deg, rgba(120, 60, 220, 0.22) 0 1px, transparent 1px 70px);
    will-change: transform, opacity;
    animation: warp-fly ${RING_CYCLE * 1.6}s linear infinite;
}

.warp-exit {
    position: absolute;
    left: 50%;
    top: 50%;
    width: 460px;
    height: 460px;
    margin-left: -230px;
    margin-top: -230px;
    border-radius: 50%;
    transition: transform 700ms cubic-bezier(0.33, 0.9, 0.4, 1), opacity 700ms ease-out;
    will-change: transform, opacity;
}

.warp-exit-core {
    position: absolute;
    inset: 0;
    border-radius: 50%;
    background: radial-gradient(circle,
        #ffffff 0%,
        #b8f6ff 14%,
        #46b4ff 34%,
        rgba(178, 92, 255, 0.5) 62%,
        rgba(10, 3, 32, 0) 100%);
    will-change: opacity;
    animation: warp-exit-pulse 2.3s ease-in-out infinite;
}

.warp-vignette {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle at 50% 50%,
        rgba(3, 1, 9, 0) 22%,
        rgba(3, 1, 9, 0.45) 56%,
        rgba(3, 1, 9, 0.96) 100%);
}

.warp-scan {
    position: absolute;
    inset: 0;
    pointer-events: none;
    opacity: 0.35;
    background: repeating-linear-gradient(180deg,
        rgba(255, 255, 255, 0.055) 0 1px,
        transparent 1px 3px);
}

.warp-flash {
    position: absolute;
    inset: 0;
    pointer-events: none;
    background: radial-gradient(circle, #ffffff 0%, #a9f2ff 40%, rgba(255, 46, 152, 0) 100%);
    animation: warp-flash ${PUSH_MS}ms ease-out both;
}

@keyframes warp-fly {
    from { transform: translateZ(${-TUNNEL_DEPTH}px); opacity: 0; }
    10%  { opacity: 1; }
    85%  { opacity: 1; }
    to   { transform: translateZ(380px); opacity: 0; }
}

@keyframes warp-coin-fly {
    from {
        transform: translate3d(var(--x), var(--y), ${-TUNNEL_DEPTH}px) rotate(var(--tilt));
        opacity: 0;
    }
    12%  { opacity: 1; }
    88%  { opacity: 1; }
    to {
        transform: translate3d(var(--x), var(--y), 420px) rotate(var(--tilt));
        opacity: 0;
    }
}

@keyframes warp-coin-spin {
    from { transform: rotateY(0deg); }
    to   { transform: rotateY(360deg); }
}

@keyframes warp-exit-pulse {
    0%, 100% { opacity: 0.82; }
    50%      { opacity: 1; }
}

@keyframes warp-pull {
    from { transform: translateZ(-460px); opacity: 0; }
    to   { transform: translateZ(0);      opacity: 1; }
}

@keyframes warp-push {
    from { transform: translateZ(0);      opacity: 1; }
    55%  { transform: translateZ(420px);  opacity: 1; }
    to   { transform: translateZ(1100px); opacity: 0; }
}

@keyframes warp-flash {
    0%   { opacity: 0; }
    28%  { opacity: 0.92; }
    100% { opacity: 0; }
}
`;

const RING_STYLES = ["", " magenta", " violet", " thin magenta", " thin"];

export function WarpTransition({ active, progress, message }: WarpTransitionProps) {
    const [phase, setPhase] = useState<Phase>("idle");
    const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
    const wasActive = useRef(false);

    useEffect(() => {
        if (active === wasActive.current) return;
        wasActive.current = active;

        timers.current.forEach(clearTimeout);
        timers.current = [];

        if (active) {
            setPhase("pull");
            timers.current.push(setTimeout(() => setPhase("travel"), PULL_MS));
        } else {
            setPhase("push");
            timers.current.push(setTimeout(() => setPhase("idle"), PUSH_MS));
        }
    }, [active]);

    useEffect(() => () => timers.current.forEach(clearTimeout), []);

    const coins = useMemo(
        () =>
            Array.from({ length: COIN_COUNT }, (_, i) => {
                const angle = (i / COIN_COUNT) * Math.PI * 2 + i * 0.7;
                const radius = 130 + (i % 4) * 62;
                const skin = COIN_SKINS[i % COIN_SKINS.length];

                return {
                    face: COIN_FACES[i % COIN_FACES.length],
                    x: `${Math.round(Math.cos(angle) * radius)}px`,
                    y: `${Math.round(Math.sin(angle) * radius)}px`,
                    tilt: `${(i % 5) * 14 - 28}deg`,
                    delay: (i * COIN_CYCLE) / COIN_COUNT,
                    spin: 1.7 + (i % 4) * 0.55,
                    scale: 0.7 + (i % 3) * 0.28,
                    skin,
                };
            }),
        []
    );

    const clamped = Math.max(0, Math.min(1, progress));
    const approach = Math.pow(clamped, 1.35);
    const exitZ = -TUNNEL_DEPTH * 0.92 + approach * TUNNEL_DEPTH * 0.86;
    const exitScale = 0.55 + approach * 1.25;

    return (
        <div className="warp-root" data-phase={phase} aria-hidden={phase === "idle"}>
            <style>{WARP_CSS}</style>

            <div className="warp-camera">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div
                        key={`grid-${i}`}
                        className="warp-grid"
                        style={{ animationDelay: `${(i * RING_CYCLE * 1.6) / 3 - RING_CYCLE * 1.6}s` }}
                    />
                ))}

                {Array.from({ length: RING_COUNT }).map((_, i) => (
                    <div
                        key={`ring-${i}`}
                        className={`warp-ring${RING_STYLES[i % RING_STYLES.length]}`}
                        style={{ animationDelay: `${(i * RING_CYCLE) / RING_COUNT - RING_CYCLE}s` }}
                    />
                ))}

                {coins.map((coin, i) => (
                    <div
                        key={`coin-${i}`}
                        className="warp-coin"
                        style={{
                            ["--x" as string]: coin.x,
                            ["--y" as string]: coin.y,
                            ["--tilt" as string]: coin.tilt,
                            animationDelay: `${coin.delay - COIN_CYCLE}s`,
                            width: `${Math.round(74 * coin.scale)}px`,
                            height: `${Math.round(74 * coin.scale)}px`,
                            marginLeft: `${Math.round(-37 * coin.scale)}px`,
                            marginTop: `${Math.round(-37 * coin.scale)}px`,
                            fontSize: `${Math.round(26 * coin.scale)}px`,
                        }}
                    >
                        <div
                            className="warp-coin-inner"
                            style={{
                                animationDuration: `${coin.spin}s`,
                                background: `radial-gradient(circle at 34% 28%, #ffffff 0%, ${coin.skin.rim} 42%, ${coin.skin.face} 100%)`,
                                border: `2px solid ${coin.skin.rim}`,
                                color: coin.skin.face,
                                boxShadow: `0 0 18px ${coin.skin.glow}`,
                            }}
                        >
                            {coin.face}
                        </div>
                    </div>
                ))}

                <div
                    className="warp-exit"
                    style={{
                        transform: `translateZ(${Math.round(exitZ)}px) scale(${exitScale.toFixed(3)})`,
                        opacity: 0.5 + approach * 0.5,
                    }}
                >
                    <div className="warp-exit-core" />
                </div>
            </div>

            <div className="warp-scan" />
            <div className="warp-vignette" />

            {phase === "push" && <div className="warp-flash" />}

            <div className="absolute inset-x-0 bottom-14 flex flex-col items-center pointer-events-none">
                <p className="font-mono text-base tracking-[0.28em] uppercase text-cyan-200/90 drop-shadow-[0_0_14px_rgba(56,226,255,0.75)]">
                    {message}
                </p>
                <div className="mt-4 w-80 h-[3px] bg-white/10 overflow-hidden">
                    <div
                        className="h-full transition-all duration-500 ease-out"
                        style={{
                            width: `${Math.round(clamped * 100)}%`,
                            background: "linear-gradient(90deg, #38e2ff, #b25cff, #ff2e98)",
                        }}
                    />
                </div>
            </div>
        </div>
    );
}

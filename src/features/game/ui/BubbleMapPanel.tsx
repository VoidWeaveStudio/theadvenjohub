// src/features/game/ui/BubbleMapPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import {
    GALAXY,
    ORBIT_OMEGA,
    galaxyOrbitTime,
    playerBubbleOrbit,
    factionBubbleOrbit,
    orbitPosition,
    hashString,
    hashInt,
} from "../world/locations/tower/floors/token-gates/galaxy/GalaxyLayout";
import type { FactionGateData } from "../network/NetworkManager";
import { useLanguage } from "@/core/i18n/LanguageContext";

interface BubbleMapPanelProps {
    isOpen: boolean;
    onClose: () => void;
    accountCount: number;
    ownBubbleIndex: number | null;
    waypointIndex: number | null;
    factions: FactionGateData[];
    myFactionIds: string[];
    getPlayerPosition: () => { x: number; z: number } | null;
    onSetWaypoint: (index: number | null) => void;
}

const REDRAW_MS = 400;
const MAX_DRAWN_BUBBLES = 12000;
const DUST_POINTS = 1600;
const STAR_POINTS = 320;
const ARM_COUNT = 2;
const ARM_TWIST = 0.0022;
const MIN_BUBBLE_PX = 0.7;

function THREE_CLAMP(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

interface DustMote {
    radius: number;
    phase: number;
    size: number;
    color: string;
}

function buildDust(): DustMote[] {
    const motes: DustMote[] = [];

    for (let i = 0; i < DUST_POINTS; i++) {
        const h1 = hashInt(i * 2654435761) / 4294967296;
        const h2 = hashInt(i * 40503 + 991) / 4294967296;
        const h3 = hashInt(i * 92837111 + 5) / 4294967296;

        const radius = GALAXY.coreBubbleRadius * 1.6 + Math.pow(h1, 0.65) * (GALAXY.maxRadius * 0.85);
        const spread = 1.1 + (1 - Math.min(1, radius / GALAXY.maxRadius)) * 1.5;
        const arm = Math.floor(h2 * ARM_COUNT);
        const offset = (h2 * ARM_COUNT - arm - 0.5) * spread;

        motes.push({
            radius,
            phase: (arm / ARM_COUNT) * Math.PI * 2 + radius * ARM_TWIST + offset,
            size: 0.6 + h3 * 1.7,
            color: `hsla(${Math.round(208 + h2 * 72)}, 75%, ${Math.round(52 + h1 * 24)}%, ${(0.10 + h3 * 0.22).toFixed(2)})`,
        });
    }

    return motes;
}

function drawStarfield(ctx: CanvasRenderingContext2D, width: number, height: number) {
    for (let i = 0; i < STAR_POINTS; i++) {
        const h1 = hashInt(i * 7919 + 1) / 4294967296;
        const h2 = hashInt(i * 104729 + 13) / 4294967296;
        const h3 = hashInt(i * 15485863 + 7) / 4294967296;

        ctx.fillStyle = `rgba(190, 220, 255, ${(0.12 + h3 * 0.4).toFixed(2)})`;
        ctx.fillRect(h1 * width, h2 * height, 1 + (h3 > 0.85 ? 1 : 0), 1 + (h3 > 0.85 ? 1 : 0));
    }
}

interface MappedFaction {
    data: FactionGateData;
    x: number;
    z: number;
    isMine: boolean;
}

export function BubbleMapPanel({
    isOpen,
    onClose,
    accountCount,
    ownBubbleIndex,
    waypointIndex,
    factions,
    myFactionIds,
    getPlayerPosition,
    onSetWaypoint,
}: BubbleMapPanelProps) {
    const { t } = useLanguage();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const dustRef = useRef<DustMote[] | null>(null);
    if (!dustRef.current) dustRef.current = buildDust();
    const scaleRef = useRef(1);
    const centerRef = useRef({ x: 0, y: 0 });
    const dragRef = useRef<{ x: number; y: number; moved: boolean } | null>(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [hoverLabel, setHoverLabel] = useState<string | null>(null);

    const draw = useCallback(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext("2d");
        if (!ctx) return;

        const width = canvas.clientWidth;
        const height = canvas.clientHeight;
        const dpr = window.devicePixelRatio || 1;

        if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
            canvas.width = width * dpr;
            canvas.height = height * dpr;
        }

        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        ctx.clearRect(0, 0, width, height);

        const cx = width / 2 + pan.x;
        const cy = height / 2 + pan.y;
        const scale = (Math.min(width, height) / (GALAXY.maxRadius * 2.1)) * zoom;

        scaleRef.current = scale;
        centerRef.current = { x: cx, y: cy };

        const time = galaxyOrbitTime();
        const scratch = { x: 0, y: 0, z: 0 };

        ctx.fillStyle = "#05030f";
        ctx.fillRect(0, 0, width, height);

        drawStarfield(ctx, width, height);

        const coreGlowRadius = GALAXY.coreBubbleRadius * 9 * scale;
        if (coreGlowRadius > 2) {
            const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, coreGlowRadius);
            glow.addColorStop(0, "rgba(255,186,110,0.30)");
            glow.addColorStop(0.35, "rgba(120,110,220,0.14)");
            glow.addColorStop(1, "rgba(40,30,90,0)");
            ctx.fillStyle = glow;
            ctx.fillRect(0, 0, width, height);
        }

        const spin = ORBIT_OMEGA * time;
        for (const mote of dustRef.current ?? []) {
            const angle = mote.phase + spin;
            const px = cx + Math.cos(angle) * mote.radius * scale;
            const py = cy + Math.sin(angle) * mote.radius * scale;
            if (px < -8 || py < -8 || px > width + 8 || py > height + 8) continue;

            const size = Math.max(1, mote.size * Math.sqrt(zoom));
            ctx.fillStyle = mote.color;
            ctx.fillRect(px - size * 0.5, py - size * 0.5, size, size);
        }

        ctx.strokeStyle = "rgba(120,160,255,0.08)";
        ctx.lineWidth = 1;
        for (let r = GALAXY.playerRingStart; r < GALAXY.maxRadius; r += 400) {
            ctx.beginPath();
            ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
            ctx.stroke();
        }

        const total = Math.min(accountCount, MAX_DRAWN_BUBBLES);
        const step = accountCount > MAX_DRAWN_BUBBLES ? Math.ceil(accountCount / MAX_DRAWN_BUBBLES) : 1;
        const bubblePx = Math.max(MIN_BUBBLE_PX, GALAXY.playerBubbleRadius * scale);
        const drawAsDisc = bubblePx > 1.4;

        ctx.fillStyle = "rgba(120,200,255,0.6)";
        for (let i = 0; i < accountCount; i += step) {
            orbitPosition(playerBubbleOrbit(i), time, scratch);
            const px = cx + scratch.x * scale;
            const py = cy + scratch.z * scale;
            if (px < -bubblePx || py < -bubblePx || px > width + bubblePx || py > height + bubblePx) continue;

            if (drawAsDisc) {
                ctx.beginPath();
                ctx.arc(px, py, bubblePx, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(px - bubblePx, py - bubblePx, bubblePx * 2, bubblePx * 2);
            }
            if (i / step > total) break;
        }

        if (drawAsDisc) {
            ctx.strokeStyle = "rgba(200,240,255,0.45)";
            ctx.lineWidth = Math.min(1.5, bubblePx * 0.3);
            for (let i = 0; i < accountCount; i += step) {
                orbitPosition(playerBubbleOrbit(i), time, scratch);
                const px = cx + scratch.x * scale;
                const py = cy + scratch.z * scale;
                if (px < -bubblePx || py < -bubblePx || px > width + bubblePx || py > height + bubblePx) continue;

                ctx.beginPath();
                ctx.arc(px, py, bubblePx * 0.82, 0, Math.PI * 2);
                ctx.stroke();
                if (i / step > total) break;
            }
        }

        const mapped: MappedFaction[] = [];
        let coreDrawn = false;

        for (const faction of factions) {
            const isMine = myFactionIds.includes(faction.factionId);
            if (faction.isAdmin && !coreDrawn) {
                coreDrawn = true;
                mapped.push({ data: faction, x: 0, z: 0, isMine });
                continue;
            }
            const slot = Math.max(0, (faction.number ?? 1) - 1);
            orbitPosition(factionBubbleOrbit(slot), time, scratch);
            mapped.push({ data: faction, x: scratch.x, z: scratch.z, isMine });
        }

        for (const entry of mapped) {
            const px = cx + entry.x * scale;
            const py = cy + entry.z * scale;
            const isCore = entry.data.isAdmin;
            const worldRadius = isCore ? GALAXY.coreBubbleRadius : GALAXY.factionBubbleRadius;
            const radius = Math.max(isCore ? 5 : 3, worldRadius * scale);

            const fill = isCore
                ? "#FFC46B"
                : entry.isMine
                    ? "#7FE6CF"
                    : `hsl(${hashString(entry.data.factionId) % 360}, 55%, 62%)`;

            const halo = ctx.createRadialGradient(px, py, radius * 0.2, px, py, radius * 2.4);
            halo.addColorStop(0, isCore ? "rgba(255,170,80,0.45)" : "rgba(150,210,255,0.22)");
            halo.addColorStop(1, "rgba(0,0,0,0)");
            ctx.fillStyle = halo;
            ctx.beginPath();
            ctx.arc(px, py, radius * 2.4, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fillStyle = fill;
            ctx.fill();

            if (isCore || entry.isMine) {
                ctx.strokeStyle = isCore ? "rgba(255,196,107,0.55)" : "rgba(127,230,207,0.5)";
                ctx.lineWidth = 1.5;
                ctx.beginPath();
                ctx.arc(px, py, radius + 5, 0, Math.PI * 2);
                ctx.stroke();

                ctx.fillStyle = isCore ? "#FFD9A0" : "#B8F5E6";
                ctx.font = "bold 11px sans-serif";
                ctx.textAlign = "center";
                ctx.fillText(entry.data.factionName, px, py - radius - 8);
            }
        }

        const markerRadius = Math.max(7, GALAXY.playerBubbleRadius * scale * 1.4);

        if (ownBubbleIndex !== null && ownBubbleIndex < accountCount) {
            orbitPosition(playerBubbleOrbit(ownBubbleIndex), time, scratch);
            const px = cx + scratch.x * scale;
            const py = cy + scratch.z * scale;
            ctx.strokeStyle = "#FFD166";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, markerRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "#FFD166";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText(t("g.map.myBubble"), px, py - markerRadius - 6);
        }

        if (waypointIndex !== null && waypointIndex < accountCount) {
            orbitPosition(playerBubbleOrbit(waypointIndex), time, scratch);
            const px = cx + scratch.x * scale;
            const py = cy + scratch.z * scale;
            const cross = markerRadius * 1.4;
            ctx.strokeStyle = "#7BFF9E";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, markerRadius, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px - cross, py);
            ctx.lineTo(px + cross, py);
            ctx.moveTo(px, py - cross);
            ctx.lineTo(px, py + cross);
            ctx.stroke();
        }

        const platformX = cx;
        const platformY = cy;
        const platformRadius = GALAXY.platformRadius * scale;
        if (platformRadius > 2) {
            ctx.strokeStyle = "rgba(127,230,207,0.55)";
            ctx.lineWidth = 1.5;
            ctx.beginPath();
            ctx.arc(platformX, platformY, platformRadius, 0, Math.PI * 2);
            ctx.stroke();
        }
        ctx.fillStyle = "#7FE6CF";
        ctx.beginPath();
        ctx.moveTo(platformX, platformY - 8);
        ctx.lineTo(platformX + 7, platformY + 5);
        ctx.lineTo(platformX - 7, platformY + 5);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#B8F5E6";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(t("g.map.platform"), platformX, platformY + 18);

        const player = getPlayerPosition();
        if (player) {
            const px = cx + player.x * scale;
            const py = cy + player.z * scale;
            ctx.fillStyle = "#FFFFFF";
            ctx.beginPath();
            ctx.arc(px, py, 3.5, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = "rgba(255,255,255,0.5)";
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.arc(px, py, 8, 0, Math.PI * 2);
            ctx.stroke();
        }
    }, [accountCount, factions, myFactionIds, ownBubbleIndex, waypointIndex, zoom, pan, getPlayerPosition]);

    useEffect(() => {
        if (!isOpen) return;
        SoundManager.getInstance().play('modal-open');
        draw();
        const timer = setInterval(draw, REDRAW_MS);
        return () => clearInterval(timer);
    }, [isOpen, draw]);

    const handleWheel = (event: React.WheelEvent<HTMLCanvasElement>) => {
        event.preventDefault();
        setZoom((current) => THREE_CLAMP(current * (event.deltaY < 0 ? 1.15 : 1 / 1.15), 0.4, 12));
    };

    const handlePointerDown = (event: React.PointerEvent<HTMLCanvasElement>) => {
        dragRef.current = { x: event.clientX, y: event.clientY, moved: false };
        event.currentTarget.setPointerCapture(event.pointerId);
    };

    const handlePointerMove = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current;
        if (!drag) return;

        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (Math.abs(dx) + Math.abs(dy) > 3) drag.moved = true;

        drag.x = event.clientX;
        drag.y = event.clientY;
        setPan((current) => ({ x: current.x + dx, y: current.y + dy }));
    };

    const handlePointerUp = (event: React.PointerEvent<HTMLCanvasElement>) => {
        const drag = dragRef.current;
        dragRef.current = null;
        event.currentTarget.releasePointerCapture(event.pointerId);
        if (drag && !drag.moved) handleClick(event);
    };

    const handleClick = (event: { clientX: number; clientY: number }) => {
        const canvas = canvasRef.current;
        if (!canvas || accountCount <= 0) return;

        const rect = canvas.getBoundingClientRect();
        const scale = scaleRef.current;
        const center = centerRef.current;
        const worldX = (event.clientX - rect.left - center.x) / scale;
        const worldZ = (event.clientY - rect.top - center.y) / scale;

        const time = galaxyOrbitTime();
        const scratch = { x: 0, y: 0, z: 0 };
        const threshold = Math.max(GALAXY.playerBubbleRadius * 1.6, 14 / scale);

        let best = -1;
        let bestDistance = Infinity;

        for (let i = 0; i < accountCount; i++) {
            orbitPosition(playerBubbleOrbit(i), time, scratch);
            const distance = Math.hypot(scratch.x - worldX, scratch.z - worldZ);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = i;
            }
        }

        if (best < 0 || bestDistance > threshold) {
            setHoverLabel(t("g.bubble.noneThere"));
            return;
        }

        if (best === waypointIndex) {
            onSetWaypoint(null);
            setHoverLabel(`Marker removed from bubble #${best + 1}`);
            return;
        }

        onSetWaypoint(best);
        setHoverLabel(`Marker set on bubble #${best + 1}`);
    };

    if (!isOpen) return null;

    return (
        <div className="absolute inset-0 bg-[rgba(4,4,8,0.9)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-2 sm:p-4">
            <div className="w-full max-w-4xl h-[80dvh] bg-[rgba(8,10,18,0.96)] border-2 border-[#66CCFF]/30 rounded-[16px] p-4 flex flex-col shadow-[0_0_35px_rgba(102,204,255,0.12)]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-[#66CCFF]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">{t("g.bubble.map")}</h2>
                        <span className="text-[#8B8F98] text-xs">{accountCount.toLocaleString("en-US")} bubbles</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                            className="btn-secondary px-3 py-1 text-sm"
                        >
                            {t("g.bubble.resetView")}
                        </button>
                        {waypointIndex !== null && (
                            <button
                                onClick={() => {
                                    onSetWaypoint(null);
                                    setHoverLabel(t("g.bubble.markerCleared"));
                                }}
                                className="btn-secondary px-3 py-1 text-sm"
                            >
                                {t("g.bubble.clearMarker")}
                            </button>
                        )}
                        <button onClick={onClose} className="bg-transparent border-0 p-1 text-[#8B8F98] hover:text-[#E5E7EB] transition-colors">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <canvas
                    ref={canvasRef}
                    onWheel={handleWheel}
                    onPointerDown={handlePointerDown}
                    onPointerMove={handlePointerMove}
                    onPointerUp={handlePointerUp}
                    className="flex-1 w-full rounded-lg border border-white/10 cursor-crosshair touch-none"
                />

                <div className="flex items-center justify-between mt-3 text-xs text-[#8B8F98]">
                    <div className="flex items-center gap-4">
                        <span><span className="text-[#FFC46B]">●</span> {t("g.map.coreFaction")}</span>
                        <span><span className="text-[#7FE6CF]">●</span> {t("g.map.myFactions")}</span>
                        <span><span className="text-[#FFD166]">○</span> {t("g.map.myBubble")}</span>
                        <span><span className="text-[#7BFF9E]">✛</span> {t("g.map.marker")}</span>
                    </div>
                    <div className="text-[#E5E7EB]">{hoverLabel ?? t("g.map.controls")}</div>
                </div>
            </div>
        </div>
    );
}

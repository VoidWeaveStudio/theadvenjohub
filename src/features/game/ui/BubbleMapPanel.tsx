// src/features/game/ui/BubbleMapPanel.tsx
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Map as MapIcon, X } from "lucide-react";
import { SoundManager } from "../core/SoundManager";
import {
    GALAXY,
    galaxyOrbitTime,
    playerBubbleOrbit,
    factionBubbleOrbit,
    orbitPosition,
    hashString,
} from "../world/locations/tower/floors/token-gates/galaxy/GalaxyLayout";
import type { FactionGateData } from "../network/NetworkManager";

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

function THREE_CLAMP(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
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
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
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

        ctx.strokeStyle = "rgba(120,160,255,0.10)";
        ctx.lineWidth = 1;
        for (let r = GALAXY.playerRingStart; r < GALAXY.maxRadius; r += 400) {
            ctx.beginPath();
            ctx.arc(cx, cy, r * scale, 0, Math.PI * 2);
            ctx.stroke();
        }

        const total = Math.min(accountCount, MAX_DRAWN_BUBBLES);
        const step = accountCount > MAX_DRAWN_BUBBLES ? Math.ceil(accountCount / MAX_DRAWN_BUBBLES) : 1;

        ctx.fillStyle = "rgba(120,200,255,0.55)";
        for (let i = 0; i < accountCount; i += step) {
            orbitPosition(playerBubbleOrbit(i), time, scratch);
            ctx.fillRect(cx + scratch.x * scale - 0.75, cy + scratch.z * scale - 0.75, 1.5, 1.5);
            if (i / step > total) break;
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
            const radius = isCore ? 9 : entry.isMine ? 6 : 4;

            ctx.beginPath();
            ctx.arc(px, py, radius, 0, Math.PI * 2);
            ctx.fillStyle = isCore
                ? "#FFC46B"
                : entry.isMine
                    ? "#7FE6CF"
                    : `hsl(${hashString(entry.data.factionId) % 360}, 55%, 62%)`;
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

        if (ownBubbleIndex !== null && ownBubbleIndex < accountCount) {
            orbitPosition(playerBubbleOrbit(ownBubbleIndex), time, scratch);
            const px = cx + scratch.x * scale;
            const py = cy + scratch.z * scale;
            ctx.strokeStyle = "#FFD166";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, 7, 0, Math.PI * 2);
            ctx.stroke();
            ctx.fillStyle = "#FFD166";
            ctx.font = "bold 11px sans-serif";
            ctx.textAlign = "center";
            ctx.fillText("my bubble", px, py - 12);
        }

        if (waypointIndex !== null && waypointIndex < accountCount) {
            orbitPosition(playerBubbleOrbit(waypointIndex), time, scratch);
            const px = cx + scratch.x * scale;
            const py = cy + scratch.z * scale;
            ctx.strokeStyle = "#7BFF9E";
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(px, py, 10, 0, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(px - 14, py);
            ctx.lineTo(px + 14, py);
            ctx.moveTo(px, py - 14);
            ctx.lineTo(px, py + 14);
            ctx.stroke();
        }

        const platformX = cx;
        const platformY = cy;
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
        ctx.fillText("platform", platformX, platformY + 18);

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
        const threshold = 14 / scale;

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
            setHoverLabel("No bubble there — click closer to a dot.");
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
        <div className="absolute inset-0 bg-[rgba(4,4,8,0.9)] backdrop-blur-sm flex items-center justify-center z-50 pointer-events-auto font-oxanium p-4">
            <div className="w-full max-w-4xl h-[80vh] bg-[rgba(8,10,18,0.96)] border-2 border-[#66CCFF]/30 rounded-[16px] p-4 flex flex-col shadow-[0_0_35px_rgba(102,204,255,0.12)]">
                <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                        <MapIcon className="w-5 h-5 text-[#66CCFF]" />
                        <h2 className="text-xl font-black text-[#E5E7EB]">Bubble Map</h2>
                        <span className="text-[#8B8F98] text-xs">{accountCount.toLocaleString("en-US")} bubbles</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); }}
                            className="btn-secondary px-3 py-1 text-sm"
                        >
                            Reset view
                        </button>
                        {waypointIndex !== null && (
                            <button
                                onClick={() => {
                                    onSetWaypoint(null);
                                    setHoverLabel("Marker cleared");
                                }}
                                className="btn-secondary px-3 py-1 text-sm"
                            >
                                Clear marker
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
                        <span><span className="text-[#FFC46B]">●</span> core faction</span>
                        <span><span className="text-[#7FE6CF]">●</span> my factions</span>
                        <span><span className="text-[#FFD166]">○</span> my bubble</span>
                        <span><span className="text-[#7BFF9E]">✛</span> marker</span>
                    </div>
                    <div className="text-[#E5E7EB]">{hoverLabel ?? "Wheel to zoom, drag to pan, click a bubble to mark it."}</div>
                </div>
            </div>
        </div>
    );
}
